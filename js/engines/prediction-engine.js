// ============================================
// HospitalFlow AI — Prediction Engine
// ============================================

import Config from '../config.js';
import appState from '../state.js';

const PredictionEngine = {
  /**
   * Calculate predicted wait time for a patient joining a department queue
   * Uses transparent, explainable operational heuristics
   */
  calculateETA(department, doctorId = null) {
    const s = appState.get();

    // Get active doctors for this department
    let activeDoctors = s.doctors.filter(d =>
      d.department === department && ['Available', 'Consulting'].includes(d.status)
    );

    if (doctorId) {
      activeDoctors = activeDoctors.filter(d => d.id === doctorId);
    }

    if (activeDoctors.length === 0) {
      return {
        estimatedMinutes: null,
        explanation: `No active doctors available in ${department}`,
        factors: { activeDoctors: 0 }
      };
    }

    // Patients ahead in queue
    const waitingPatients = s.queueEntries.filter(q =>
      q.department === department &&
      ['Waiting', 'Called'].includes(q.status) &&
      (doctorId ? q.doctorId === doctorId : true)
    ).length;

    // Average consultation duration for these doctors
    const avgConsultation = activeDoctors.reduce((sum, d) =>
      sum + d.averageConsultationMinutes, 0
    ) / activeDoctors.length;

    // Service capacity: doctors / avg duration
    const serviceCapacity = activeDoctors.length / avgConsultation;

    // Base estimated wait
    let estimatedWait = waitingPatients / serviceCapacity;

    // Currently consulting patients — estimate remaining time
    const consultingEntries = s.queueEntries.filter(q =>
      q.department === department && q.status === 'Consulting'
    );

    if (consultingEntries.length > 0) {
      // Estimate average remaining consultation time
      const avgRemaining = consultingEntries.reduce((sum, q) => {
        if (q.consultingAt) {
          const elapsed = (Date.now() - new Date(q.consultingAt).getTime()) / 60000;
          const doctor = s.doctors.find(d => d.id === q.doctorId);
          const expected = doctor ? doctor.averageConsultationMinutes : avgConsultation;
          return sum + Math.max(0, expected - elapsed);
        }
        return sum + avgConsultation * 0.5;
      }, 0) / consultingEntries.length;

      // The first in queue will be seen when current consultation ends
      if (waitingPatients > 0 && avgRemaining < estimatedWait) {
        estimatedWait = avgRemaining + ((waitingPatients - 1) * avgConsultation / activeDoctors.length);
      }
    }

    // Emergency insertion buffer
    const emergencyCount = s.queueEntries.filter(q =>
      q.department === department && q.priority === 'Emergency' && q.status === 'Waiting'
    ).length;
    if (emergencyCount > 0) {
      estimatedWait += emergencyCount * avgConsultation * 0.5;
    }

    estimatedWait = Math.max(0, Math.round(estimatedWait));

    const explanation = this._buildExplanation(waitingPatients, activeDoctors.length, avgConsultation, emergencyCount);

    return {
      estimatedMinutes: estimatedWait,
      explanation,
      factors: {
        patientsAhead: waitingPatients,
        activeDoctors: activeDoctors.length,
        avgConsultationMinutes: Math.round(avgConsultation),
        emergencyInsertions: emergencyCount,
        consultingNow: consultingEntries.length
      }
    };
  },

  /**
   * Calculate predicted consultation window for an appointment
   */
  calculateConsultationWindow(appointment) {
    const eta = this.calculateETA(appointment.department, appointment.doctorId);
    const doctor = appState.findById('doctors', appointment.doctorId);
    const duration = doctor ? doctor.averageConsultationMinutes : Config.DEFAULT_CONSULTATION_MINUTES;

    const scheduledTime = new Date(appointment.scheduledTime);
    const predictedStart = new Date(scheduledTime.getTime() + (eta.estimatedMinutes || 0) * 60000);
    const predictedEnd = new Date(predictedStart.getTime() + duration * 60000);

    return {
      scheduledTime: scheduledTime.toISOString(),
      predictedStart: predictedStart.toISOString(),
      predictedEnd: predictedEnd.toISOString(),
      estimatedWaitMinutes: eta.estimatedMinutes,
      consultationDurationMinutes: duration,
      explanation: eta.explanation,
      factors: eta.factors
    };
  },

  /**
   * Recalculate all queue ETAs for a department
   */
  recalculateQueueETAs(department) {
    const s = appState.get();
    const waitingEntries = s.queueEntries
      .filter(q => q.department === department && ['Waiting', 'Called'].includes(q.status))
      .sort((a, b) => {
        if (a.priority === 'Emergency' && b.priority !== 'Emergency') return -1;
        if (b.priority === 'Emergency' && a.priority !== 'Emergency') return 1;
        return a.position - b.position;
      });

    const activeDoctors = s.doctors.filter(d =>
      d.department === department && ['Available', 'Consulting'].includes(d.status)
    );

    if (activeDoctors.length === 0) {
      waitingEntries.forEach((entry, i) => {
        appState.updateItem('queueEntries', entry.id, {
          position: i + 1,
          estimatedWait: null
        });
      });
      return;
    }

    const avgConsultation = activeDoctors.reduce((sum, d) =>
      sum + d.averageConsultationMinutes, 0
    ) / activeDoctors.length;

    waitingEntries.forEach((entry, i) => {
      const patientsAhead = i;
      const estimatedWait = Math.round(patientsAhead * avgConsultation / activeDoctors.length);
      appState.updateItem('queueEntries', entry.id, {
        position: i + 1,
        estimatedWait: Math.max(0, estimatedWait)
      });
    });
  },

  /**
   * Calculate no-show risk score (transparent heuristic)
   */
  calculateNoShowRisk(patient, appointment) {
    let score = 0;
    const factors = [];

    // Previous no-shows
    if (patient.previousNoShows >= 2) {
      score += 0.35;
      factors.push(`${patient.previousNoShows} previous no-shows`);
    } else if (patient.previousNoShows === 1) {
      score += 0.15;
      factors.push('1 previous no-show');
    }

    // Booking lead time (booked far in advance = higher risk)
    if (appointment.scheduledTime) {
      const leadDays = (new Date(appointment.scheduledTime) - new Date()) / (1000 * 60 * 60 * 24);
      if (leadDays > 14) {
        score += 0.15;
        factors.push(`Booked ${Math.round(leadDays)} days in advance`);
      }
    }

    // Late morning / afternoon appointments slightly higher risk
    if (appointment.scheduledTime) {
      const hour = new Date(appointment.scheduledTime).getHours();
      if (hour >= 14) {
        score += 0.1;
        factors.push('Afternoon appointment slot');
      }
    }

    let level = 'Low';
    if (score >= 0.5) level = 'High';
    else if (score >= 0.2) level = 'Medium';

    return { level, score: Math.min(1, score), factors };
  },

  /**
   * Generate congestion forecast for a department
   */
  forecastCongestion(department) {
    const s = appState.get();

    const activeDoctors = s.doctors.filter(d =>
      d.department === department && ['Available', 'Consulting'].includes(d.status)
    ).length;

    const currentWaiting = s.queueEntries.filter(q =>
      q.department === department && ['Waiting', 'Called'].includes(q.status)
    ).length;

    // Count scheduled arrivals in next hour
    const now = new Date();
    const scheduledNext60 = s.appointments.filter(a => {
      if (a.department !== department || a.status !== 'Scheduled') return false;
      const time = new Date(a.scheduledTime);
      return time > now && time <= new Date(now.getTime() + 60 * 60000);
    }).length;

    const scheduledNext30 = s.appointments.filter(a => {
      if (a.department !== department || a.status !== 'Scheduled') return false;
      const time = new Date(a.scheduledTime);
      return time > now && time <= new Date(now.getTime() + 30 * 60000);
    }).length;

    const scheduledNext15 = s.appointments.filter(a => {
      if (a.department !== department || a.status !== 'Scheduled') return false;
      const time = new Date(a.scheduledTime);
      return time > now && time <= new Date(now.getTime() + 15 * 60000);
    }).length;

    const getLevel = (waiting, doctors) => {
      if (doctors === 0) return 'High';
      const ratio = waiting / doctors;
      if (ratio >= 6) return 'High';
      if (ratio >= 3) return 'Moderate';
      return 'Low';
    };

    const currentLevel = getLevel(currentWaiting, activeDoctors);

    // Estimate expected throughput (consultations completed)
    const avgConsultation = 10;
    const throughput15 = activeDoctors * (15 / avgConsultation);
    const throughput30 = activeDoctors * (30 / avgConsultation);
    const throughput60 = activeDoctors * (60 / avgConsultation);

    const projected15 = Math.max(0, currentWaiting + scheduledNext15 - throughput15);
    const projected30 = Math.max(0, currentWaiting + scheduledNext30 - throughput30);
    const projected60 = Math.max(0, currentWaiting + scheduledNext60 - throughput60);

    const reasons = [];
    if (scheduledNext60 > 3) reasons.push(`${scheduledNext60} scheduled arrivals in next hour`);
    if (activeDoctors <= 1) reasons.push('Limited active doctor capacity');
    if (currentWaiting > 5) reasons.push(`${currentWaiting} patients currently waiting`);

    return {
      department,
      current: { level: currentLevel, waiting: currentWaiting, activeDoctors },
      plus15: { level: getLevel(projected15, activeDoctors), projected: Math.round(projected15) },
      plus30: { level: getLevel(projected30, activeDoctors), projected: Math.round(projected30) },
      plus60: { level: getLevel(projected60, activeDoctors), projected: Math.round(projected60) },
      reasons
    };
  },

  /**
   * Generate redistribution recommendations
   */
  getRedistributionRecommendations(department) {
    const s = appState.get();
    const recommendations = [];

    const deptDoctors = s.doctors.filter(d => d.department === department);
    const availableDoctors = deptDoctors.filter(d => ['Available', 'Consulting'].includes(d.status));

    if (availableDoctors.length < 2) return recommendations;

    // Find doctors with uneven queue loads
    const doctorLoads = availableDoctors.map(d => {
      const waiting = s.queueEntries.filter(q =>
        q.doctorId === d.id && ['Waiting', 'Called'].includes(q.status)
      ).length;
      return { doctor: d, waiting };
    }).sort((a, b) => b.waiting - a.waiting);

    if (doctorLoads.length >= 2) {
      const busiest = doctorLoads[0];
      const leastBusy = doctorLoads[doctorLoads.length - 1];
      const diff = busiest.waiting - leastBusy.waiting;

      if (diff >= 3) {
        // Find a transferable patient (last non-emergency in busiest queue)
        const transferable = s.queueEntries
          .filter(q => q.doctorId === busiest.doctor.id && q.status === 'Waiting' && q.priority !== 'Emergency')
          .sort((a, b) => b.position - a.position)[0];

        if (transferable) {
          const patient = s.patients.find(p => p.id === transferable.patientId);
          const waitReduction = Math.round(busiest.doctor.averageConsultationMinutes * (diff / (availableDoctors.length)));

          recommendations.push({
            type: 'transfer',
            fromDoctor: busiest.doctor,
            toDoctor: leastBusy.doctor,
            patient: patient,
            queueEntryId: transferable.id,
            fromLoad: busiest.waiting,
            toLoad: leastBusy.waiting,
            estimatedImprovementMinutes: waitReduction,
            explanation: `Transfer ${patient?.displayName || 'patient'} from ${busiest.doctor.displayName} (${busiest.waiting} waiting) to ${leastBusy.doctor.displayName} (${leastBusy.waiting} waiting) to reduce predicted delay by ~${waitReduction} minutes`
          });
        }
      }
    }

    return recommendations;
  },

  _buildExplanation(patientsAhead, activeDoctors, avgConsultation, emergencyCount) {
    let parts = [];
    parts.push(`${patientsAhead} ${patientsAhead === 1 ? 'patient' : 'patients'} ahead`);
    parts.push(`${activeDoctors} active ${activeDoctors === 1 ? 'doctor' : 'doctors'}`);
    parts.push(`avg consultation ${Math.round(avgConsultation)} min`);
    if (emergencyCount > 0) {
      parts.push(`${emergencyCount} emergency ${emergencyCount === 1 ? 'case' : 'cases'} prioritized`);
    }
    return `Based on ${parts.join(', ')}`;
  }
};

export default PredictionEngine;
