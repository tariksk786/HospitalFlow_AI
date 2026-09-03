// ============================================
// HospitalFlow AI — Flow Engine
// ============================================

import Config from '../config.js';
import appState from '../state.js';
import eventBus, { EventTypes } from '../events.js';
import PredictionEngine from './prediction-engine.js';
import { generateId, generateSeqId, isToday } from '../utils.js';
import NotificationManager from '../notifications.js';

let appointmentCounter = 2230;
let queueCounter = 100;

const FlowEngine = {
  /**
   * Book a new appointment
   */
  bookAppointment({ patientId, doctorId, department, scheduledTime, priority = 'normal' }) {
    const s = appState.get();
    const patient = s.patients.find(p => p.id === patientId);
    const doctor = s.doctors.find(d => d.id === doctorId);

    if (!patient || !doctor) {
      throw new Error('Invalid patient or doctor');
    }

    // Check for duplicate
    const duplicate = s.appointments.find(a =>
      a.patientId === patientId &&
      a.doctorId === doctorId &&
      a.status === 'Scheduled' &&
      new Date(a.scheduledTime).toDateString() === new Date(scheduledTime).toDateString()
    );
    if (duplicate) {
      throw new Error(`Patient already has a scheduled appointment (${duplicate.id}) with this doctor today`);
    }

    appointmentCounter++;
    const appointmentId = `APT-${appointmentCounter}`;

    // Calculate consultation window
    const window = PredictionEngine.calculateConsultationWindow({
      department,
      doctorId,
      scheduledTime
    });

    // Calculate no-show risk
    const noShowRisk = PredictionEngine.calculateNoShowRisk(patient, { scheduledTime });

    const appointment = {
      id: appointmentId,
      patientId,
      doctorId,
      department,
      status: 'Scheduled',
      scheduledTime,
      predictedStart: window.predictedStart,
      predictedEnd: window.predictedEnd,
      actualStart: null,
      actualEnd: null,
      priority,
      noShowRisk: noShowRisk.level,
      qrData: JSON.stringify({ id: appointmentId, patientId, department, doctorId })
    };

    appState.addItem('appointments', appointment);

    // Update doctor queue load
    appState.updateItem('doctors', doctorId, {
      queueLoad: doctor.queueLoad + 1
    });

    // Emit event
    eventBus.emit(EventTypes.APPOINTMENT_BOOKED, {
      appointmentId,
      patientName: patient.displayName,
      doctorName: doctor.displayName,
      department,
      scheduledTime,
      predictedWait: window.estimatedWaitMinutes,
      noShowRisk: noShowRisk.level
    }, { source: 'flow-engine', userId: s.currentUser?.id, entityId: appointmentId });

    NotificationManager.create({
      type: 'Queue',
      category: 'Operational',
      priority: 'Information',
      title: 'Appointment Booked',
      message: `${patient.displayName} — ${department} with ${doctor.displayName} at ${new Date(scheduledTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
      relatedModule: 'flow',
      relatedEntityId: appointmentId
    });

    // Recalculate dashboard
    appState.recalculateDashboard();

    return { appointment, prediction: window, noShowRisk };
  },

  /**
   * Check in a patient (from QR scan or manual action)
   */
  checkInPatient(appointmentId) {
    const s = appState.get();
    const appointment = s.appointments.find(a => a.id === appointmentId);
    if (!appointment) throw new Error('Appointment not found');
    if (appointment.status !== 'Scheduled') throw new Error(`Cannot check in: appointment status is ${appointment.status}`);

    const patient = s.patients.find(p => p.id === appointment.patientId);
    const doctor = s.doctors.find(d => d.id === appointment.doctorId);

    // Update appointment status
    appState.updateItem('appointments', appointmentId, { status: 'Checked-In' });

    // Create queue entry
    queueCounter++;
    const queueId = `Q-${String(queueCounter).padStart(4, '0')}`;

    // Calculate position
    const deptQueue = s.queueEntries.filter(q =>
      q.department === appointment.department && ['Waiting', 'Called'].includes(q.status)
    );
    const position = deptQueue.length + 1;

    // Calculate ETA
    const eta = PredictionEngine.calculateETA(appointment.department, appointment.doctorId);

    const queueEntry = {
      id: queueId,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      department: appointment.department,
      appointmentId: appointmentId,
      position: position,
      status: 'Waiting',
      priority: appointment.priority === 'emergency' ? 'Emergency' : 'Normal',
      estimatedWait: eta.estimatedMinutes,
      enteredAt: new Date().toISOString(),
      calledAt: null,
      consultingAt: null,
      completedAt: null
    };

    appState.addItem('queueEntries', queueEntry);

    // Update appointment to In-Queue
    appState.updateItem('appointments', appointmentId, { status: 'In-Queue' });

    // Emit events
    eventBus.emit(EventTypes.PATIENT_CHECKED_IN, {
      patientName: patient?.displayName,
      appointmentId,
      department: appointment.department,
      queuePosition: position,
      estimatedWait: eta.estimatedMinutes
    }, { source: 'flow-engine', entityId: appointmentId });

    eventBus.emit(EventTypes.QUEUE_ENTRY_CREATED, {
      patientName: patient?.displayName,
      department: appointment.department,
      position,
      estimatedWait: eta.estimatedMinutes
    }, { source: 'flow-engine', entityId: queueId });

    NotificationManager.create({
      type: 'Queue',
      category: 'Queue',
      priority: 'Information',
      title: 'Patient Checked In',
      message: `${patient?.displayName} checked in — Position #${position} in ${appointment.department}`,
      relatedModule: 'flow',
      relatedEntityId: queueId
    });

    // Recalculate queue
    PredictionEngine.recalculateQueueETAs(appointment.department);
    appState.recalculateDashboard();

    return { queueEntry, eta };
  },

  /**
   * Call patient from queue
   */
  callPatient(queueEntryId) {
    const s = appState.get();
    const entry = s.queueEntries.find(q => q.id === queueEntryId);
    if (!entry || entry.status !== 'Waiting') return;

    const patient = s.patients.find(p => p.id === entry.patientId);
    const doctor = s.doctors.find(d => d.id === entry.doctorId);

    appState.updateItem('queueEntries', queueEntryId, {
      status: 'Called',
      calledAt: new Date().toISOString()
    });

    eventBus.emit(EventTypes.PATIENT_CALLED, {
      patientName: patient?.displayName,
      doctorName: doctor?.displayName,
      department: entry.department
    }, { source: 'flow-engine', entityId: queueEntryId });

    NotificationManager.create({
      type: 'Queue',
      category: 'Queue',
      priority: 'High',
      title: 'Patient Called',
      message: `${patient?.displayName} called by ${doctor?.displayName}`,
      relatedModule: 'flow'
    });
  },

  /**
   * Start consultation
   */
  startConsultation(queueEntryId) {
    const s = appState.get();
    const entry = s.queueEntries.find(q => q.id === queueEntryId);
    if (!entry || !['Waiting', 'Called'].includes(entry.status)) return;

    const now = new Date().toISOString();
    const patient = s.patients.find(p => p.id === entry.patientId);
    const doctor = s.doctors.find(d => d.id === entry.doctorId);

    appState.updateItem('queueEntries', queueEntryId, {
      status: 'Consulting',
      consultingAt: now,
      estimatedWait: 0
    });

    // Update doctor status
    appState.updateItem('doctors', entry.doctorId, {
      status: 'Consulting',
      currentPatientId: entry.patientId
    });

    // Update appointment
    if (entry.appointmentId) {
      appState.updateItem('appointments', entry.appointmentId, {
        status: 'Consulting',
        actualStart: now
      });
    }

    eventBus.emit(EventTypes.CONSULTATION_STARTED, {
      patientName: patient?.displayName,
      doctorName: doctor?.displayName,
      department: entry.department
    }, { source: 'flow-engine', entityId: queueEntryId });

    // Recalculate queue
    PredictionEngine.recalculateQueueETAs(entry.department);
    appState.recalculateDashboard();
  },

  /**
   * Complete consultation
   */
  completeConsultation(queueEntryId) {
    const s = appState.get();
    const entry = s.queueEntries.find(q => q.id === queueEntryId);
    if (!entry || entry.status !== 'Consulting') return;

    const now = new Date().toISOString();
    const patient = s.patients.find(p => p.id === entry.patientId);
    const doctor = s.doctors.find(d => d.id === entry.doctorId);

    appState.updateItem('queueEntries', queueEntryId, {
      status: 'Completed',
      completedAt: now,
      position: 0
    });

    // Update doctor
    appState.updateItem('doctors', entry.doctorId, {
      status: 'Available',
      currentPatientId: null,
      completedToday: (doctor?.completedToday || 0) + 1,
      queueLoad: Math.max(0, (doctor?.queueLoad || 1) - 1)
    });

    // Update appointment
    if (entry.appointmentId) {
      appState.updateItem('appointments', entry.appointmentId, {
        status: 'Completed',
        actualEnd: now
      });
    }

    eventBus.emit(EventTypes.CONSULTATION_COMPLETED, {
      patientName: patient?.displayName,
      doctorName: doctor?.displayName,
      department: entry.department,
      appointmentId: entry.appointmentId
    }, { source: 'flow-engine', entityId: queueEntryId });

    NotificationManager.create({
      type: 'Operational',
      category: 'Operational',
      priority: 'Information',
      title: 'Consultation Completed',
      message: `${patient?.displayName} consultation with ${doctor?.displayName} completed`,
      relatedModule: 'flow'
    });

    // Recalculate
    PredictionEngine.recalculateQueueETAs(entry.department);
    appState.recalculateDashboard();

    return { patientId: entry.patientId, appointmentId: entry.appointmentId };
  },

  /**
   * Request a Hospital Ambulance
   */
  requestHospitalAmbulance({ patientId, pickupLocation, landmark = '', contactNumber, symptoms = 'Emergency', severity = 'Critical', latitude = null, longitude = null }) {
    const s = appState.get();
    const patient = s.patients.find(p => p.id === patientId);

    const requestId = generateId('AMB-REQ');
    const now = new Date().toISOString();

    const request = {
      requestId,
      patientId: patientId || 'P-EMERGENCY',
      patientName: patient?.displayName || 'Emergency Patient',
      pickupLocation,
      landmark,
      contactNumber,
      symptoms,
      severity, // 'Critical', 'Urgent', 'Moderate'
      status: 'REQUESTED', // 'REQUESTED', 'ASSIGNED', 'DISPATCHED', 'EN_ROUTE', 'ARRIVED', 'CANCELLED'
      assignedAmbulanceId: null,
      estimatedPickup: 8,
      estimatedHospitalArrival: 18,
      latitude,
      longitude,
      createdAt: now,
      acceptedAt: null,
      dispatchedAt: null,
      arrivedAt: null
    };

    appState.addItem('ambulanceRequests', request);

    eventBus.emit(EventTypes.AMBULANCE_REQUEST_CREATED, {
      requestId,
      patientId: request.patientId,
      patientName: request.patientName,
      pickupLocation,
      contactNumber,
      symptoms,
      severity
    }, { source: 'flow-engine', entityId: requestId });

    return request;
  },

  /**
   * Dispatch an Ambulance to a Request
   */
  dispatchAmbulance(requestId, ambulanceId, estimatedPickupMins = 8) {
    const s = appState.get();
    const req = (s.ambulanceRequests || []).find(r => r.requestId === requestId);
    const amb = (s.ambulances || []).find(a => a.ambulanceId === ambulanceId);

    if (!req) throw new Error('Ambulance request not found');
    if (!amb) throw new Error('Ambulance vehicle not found');

    const now = new Date().toISOString();

    // Update Ambulance
    appState.updateItem('ambulances', ambulanceId, {
      status: 'DISPATCHED',
      assignedRequestId: requestId,
      estimatedArrival: `${estimatedPickupMins} min`,
      lastUpdated: now
    });

    // Update Request
    appState.updateItem('ambulanceRequests', requestId, {
      status: 'DISPATCHED',
      assignedAmbulanceId: ambulanceId,
      estimatedPickup: estimatedPickupMins,
      estimatedHospitalArrival: estimatedPickupMins + 10,
      dispatchedAt: now
    });

    eventBus.emit(EventTypes.AMBULANCE_DISPATCHED, {
      requestId,
      ambulanceId,
      vehicleNumber: amb.vehicleNumber,
      driverName: amb.driverName,
      patientId: req.patientId,
      pickupLocation: req.pickupLocation,
      estimatedPickup: estimatedPickupMins
    }, { source: 'flow-engine', entityId: requestId });

    NotificationManager.create({
      type: 'Emergency',
      category: 'Emergency',
      priority: 'High',
      title: 'Ambulance Dispatched',
      message: `Vehicle ${amb.vehicleNumber} (${amb.ambulanceId}) dispatched for ${req.patientName}. ETA: ${estimatedPickupMins}m`,
      relatedModule: 'emergency',
      relatedEntityId: requestId
    });

    return { request: req, ambulance: amb };
  },

  /**
   * Mark Ambulance Arrived at Emergency Bay
   */
  markAmbulanceArrived(requestId) {
    const s = appState.get();
    const req = (s.ambulanceRequests || []).find(r => r.requestId === requestId);
    if (!req) throw new Error('Ambulance request not found');

    const now = new Date().toISOString();
    const ambulanceId = req.assignedAmbulanceId;

    // Release ambulance back to available
    if (ambulanceId) {
      appState.updateItem('ambulances', ambulanceId, {
        status: 'AVAILABLE',
        assignedRequestId: null,
        estimatedArrival: null,
        lastUpdated: now
      });
    }

    // Update request
    appState.updateItem('ambulanceRequests', requestId, {
      status: 'ARRIVED',
      arrivedAt: now
    });

    eventBus.emit(EventTypes.AMBULANCE_ARRIVED, {
      requestId,
      ambulanceId,
      patientId: req.patientId,
      patientName: req.patientName
    }, { source: 'flow-engine', entityId: requestId });

    // Automatically transition patient into Priority Queue (P1 Emergency)
    const result = this.insertEmergencyPatient({
      patientId: req.patientId,
      department: 'Emergency',
      priority: 'P1 - Critical Emergency',
      symptoms: req.symptoms || 'Ambulance Emergency Inbound'
    });

    return result;
  },

  /**
   * Insert emergency patient into priority queue & manage doctor diversion
   */
  insertEmergencyPatient({ patientId, department = 'Emergency', doctorId = null, priority = 'P1 - Critical Emergency', symptoms = 'Critical Condition' }) {
    const s = appState.get();
    let patient = s.patients.find(p => p.id === patientId);

    // Create transient emergency patient record if non-registered walk-in
    if (!patient) {
      patient = {
        id: patientId || generateId('P-EMG'),
        displayName: `Emergency Patient (${patientId || 'Walk-In'})`,
        bloodGroup: 'O+',
        age: 35,
        gender: 'Other',
        phone: '+91 9876543299',
        previousNoShows: 0
      };
      appState.addItem('patients', patient);
    }

    // Target doctor selection
    let doctor = doctorId ? s.doctors.find(d => d.id === doctorId) : null;
    if (!doctor) {
      doctor = s.doctors.filter(d => (d.department === department || d.department === 'General Medicine') && ['Available', 'Consulting'].includes(d.status))[0] || s.doctors[0];
    }

    // Update Doctor status to EMERGENCY_ASSIGNED
    if (doctor) {
      doctor.status = 'EMERGENCY_ASSIGNED';
      appState.updateItem('doctors', doctor.id, { status: 'EMERGENCY_ASSIGNED' });
    }

    // Create emergency appointment
    appointmentCounter++;
    const appointmentId = `APT-${appointmentCounter}`;
    const now = new Date().toISOString();

    const appointment = {
      id: appointmentId,
      patientId: patient.id,
      doctorId: doctor ? doctor.id : 'D-0001',
      department: doctor ? doctor.department : department,
      status: 'In-Queue',
      scheduledTime: now,
      predictedStart: now,
      predictedEnd: null,
      actualStart: null,
      actualEnd: null,
      priority: 'emergency',
      noShowRisk: 'Low',
      symptom_original_text: symptoms
    };
    appState.addItem('appointments', appointment);

    // Create emergency queue entry at position 1 (Priority P1)
    queueCounter++;
    const queueId = `Q-${String(queueCounter).padStart(4, '0')}`;

    const queueEntry = {
      id: queueId,
      patientId: patient.id,
      doctorId: doctor ? doctor.id : 'D-0001',
      department: doctor ? doctor.department : department,
      appointmentId,
      position: 1,
      status: 'Waiting',
      priority: priority,
      estimatedWait: 0,
      enteredAt: now,
      calledAt: null,
      consultingAt: null,
      completedAt: null
    };

    // Re-index existing waiting queue positions (+1)
    s.queueEntries
      .filter(q => q.department === queueEntry.department && q.status === 'Waiting')
      .forEach(q => {
        q.position = (q.position || 1) + 1;
      });

    appState.addItem('queueEntries', queueEntry);

    // Create Emergency Case Record
    const caseId = generateId('CASE');
    const emergencyCase = {
      id: caseId,
      caseId,
      patientId: patient.id,
      patientName: patient.displayName,
      doctorId: doctor ? doctor.id : 'D-0001',
      doctorName: doctor ? doctor.displayName : 'Duty Physician',
      department: queueEntry.department,
      priority,
      symptoms,
      queueEntryId: queueId,
      status: 'ACTIVE', // ACTIVE, IN_CONSULTATION, COMPLETED
      createdAt: now,
      readiness: {
        bedReady: false,
        doctorAssigned: !!doctor,
        teamReady: false,
        bloodReviewed: false
      }
    };
    appState.addItem('emergencyCases', emergencyCase);

    // Emit events
    eventBus.emit(EventTypes.EMERGENCY_CASE_CREATED, emergencyCase, { source: 'flow-engine', entityId: caseId });
    eventBus.emit(EventTypes.EMERGENCY_PATIENT_INSERTED, {
      caseId,
      patientId: patient.id,
      patientName: patient.displayName,
      department: queueEntry.department,
      doctorId: doctor?.id,
      doctorName: doctor?.displayName,
      priority,
      appointmentId,
      queueId
    }, { source: 'flow-engine', entityId: appointmentId });

    if (doctor) {
      eventBus.emit(EventTypes.EMERGENCY_CASE_ASSIGNED, {
        caseId,
        patientId: patient.id,
        patientName: patient.displayName,
        doctorId: doctor.id,
        doctorUserId: doctor.userId,
        department: queueEntry.department
      }, { source: 'flow-engine', entityId: doctor.id });
    }

    // Recalculate all queue positions and ETAs
    PredictionEngine.recalculateQueueETAs(queueEntry.department);

    NotificationManager.create({
      type: 'Emergency',
      category: 'Emergency',
      priority: 'Critical',
      title: '🚨 Emergency Patient Inserted',
      message: `${patient.displayName} prioritized at Position #1 in ${queueEntry.department} (${priority})`,
      relatedModule: 'flow',
      relatedEntityId: queueId
    });

    // Check congestion
    this._checkCongestion(queueEntry.department);
    appState.recalculateDashboard();

    return { appointment, queueEntry, emergencyCase };
  },

  /**
   * Change doctor availability
   */
  changeDoctorStatus(doctorId, newStatus) {
    const s = appState.get();
    const doctor = s.doctors.find(d => d.id === doctorId);
    if (!doctor) return;

    const oldStatus = doctor.status;
    appState.updateItem('doctors', doctorId, {
      status: newStatus,
      currentPatientId: ['Break', 'Unavailable'].includes(newStatus) ? null : doctor.currentPatientId
    });

    eventBus.emit(EventTypes.DOCTOR_AVAILABILITY_CHANGED, {
      doctorName: doctor.displayName,
      department: doctor.department,
      oldStatus,
      newStatus
    }, { source: 'flow-engine', entityId: doctorId });

    // Recalculate ETAs for the department
    PredictionEngine.recalculateQueueETAs(doctor.department);

    // Check congestion
    this._checkCongestion(doctor.department);

    NotificationManager.create({
      type: 'Operational',
      category: 'Operational',
      priority: newStatus === 'Unavailable' ? 'High' : 'Medium',
      title: 'Doctor Status Changed',
      message: `${doctor.displayName} is now ${newStatus}`,
      relatedModule: 'flow',
      relatedEntityId: doctorId
    });

    appState.recalculateDashboard();
  },

  /**
   * Transfer patient to a different doctor
   */
  transferPatient(queueEntryId, toDoctorId) {
    const s = appState.get();
    const entry = s.queueEntries.find(q => q.id === queueEntryId);
    if (!entry || entry.status !== 'Waiting') return;

    const patient = s.patients.find(p => p.id === entry.patientId);
    const fromDoctor = s.doctors.find(d => d.id === entry.doctorId);
    const toDoctor = s.doctors.find(d => d.id === toDoctorId);

    if (!toDoctor) throw new Error('Target doctor not found');

    const oldDoctorId = entry.doctorId;
    appState.updateItem('queueEntries', queueEntryId, {
      doctorId: toDoctorId
    });

    // Update appointment if exists
    if (entry.appointmentId) {
      appState.updateItem('appointments', entry.appointmentId, {
        doctorId: toDoctorId
      });
    }

    // Update doctor loads
    appState.updateItem('doctors', oldDoctorId, {
      queueLoad: Math.max(0, (fromDoctor?.queueLoad || 1) - 1)
    });
    appState.updateItem('doctors', toDoctorId, {
      queueLoad: (toDoctor?.queueLoad || 0) + 1
    });

    eventBus.emit(EventTypes.PATIENT_TRANSFERRED, {
      patientName: patient?.displayName,
      fromDoctor: fromDoctor?.displayName,
      toDoctor: toDoctor?.displayName,
      department: entry.department
    }, { source: 'flow-engine', entityId: queueEntryId });

    // Recalculate both queues
    PredictionEngine.recalculateQueueETAs(entry.department);
    appState.recalculateDashboard();

    NotificationManager.create({
      type: 'Queue',
      category: 'Queue',
      priority: 'Medium',
      title: 'Patient Transferred',
      message: `${patient?.displayName} transferred from ${fromDoctor?.displayName} to ${toDoctor?.displayName}`,
      relatedModule: 'flow'
    });
  },

  /**
   * Mark patient as no-show
   */
  markNoShow(appointmentId) {
    const s = appState.get();
    const appointment = s.appointments.find(a => a.id === appointmentId);
    if (!appointment) return;

    appState.updateItem('appointments', appointmentId, { status: 'No-Show' });

    // Remove queue entry if exists
    const queueEntry = s.queueEntries.find(q => q.appointmentId === appointmentId && q.status === 'Waiting');
    if (queueEntry) {
      appState.updateItem('queueEntries', queueEntry.id, { status: 'Completed', completedAt: new Date().toISOString() });
    }

    // Update patient no-show count
    const patient = s.patients.find(p => p.id === appointment.patientId);
    if (patient) {
      appState.updateItem('patients', patient.id, {
        previousNoShows: (patient.previousNoShows || 0) + 1
      });
    }

    eventBus.emit(EventTypes.PATIENT_NO_SHOW, {
      patientName: patient?.displayName,
      appointmentId,
      department: appointment.department
    }, { source: 'flow-engine', entityId: appointmentId });

    PredictionEngine.recalculateQueueETAs(appointment.department);
    appState.recalculateDashboard();
  },

  /**
   * Get available doctors for a department
   */
  getAvailableDoctors(department) {
    return appState.get().doctors.filter(d =>
      d.department === department && d.status === 'Available'
    );
  },

  /**
   * Get available time slots for a doctor on a given date
   */
  getAvailableSlots(doctorId, date) {
    const s = appState.get();
    const dateStr = new Date(date).toDateString();
    const bookedSlots = s.appointments
      .filter(a => a.doctorId === doctorId && new Date(a.scheduledTime).toDateString() === dateStr && a.status !== 'Cancelled')
      .map(a => new Date(a.scheduledTime).getHours() * 60 + new Date(a.scheduledTime).getMinutes());

    const slots = [];
    for (let hour = 9; hour < 17; hour++) {
      for (let min = 0; min < 60; min += 15) {
        const slotMin = hour * 60 + min;
        if (!bookedSlots.some(bs => Math.abs(bs - slotMin) < 15)) {
          const d = new Date(date);
          d.setHours(hour, min, 0, 0);
          slots.push(d.toISOString());
        }
      }
    }
    return slots;
  },

  _checkCongestion(department) {
    const s = appState.get();
    const waiting = s.queueEntries.filter(q =>
      q.department === department && ['Waiting', 'Called'].includes(q.status)
    );
    const avgWait = waiting.reduce((sum, q) => sum + (q.estimatedWait || 0), 0) / (waiting.length || 1);

    if (avgWait > Config.CONGESTION_THRESHOLD_MINUTES) {
      eventBus.emit(EventTypes.CONGESTION_THRESHOLD_REACHED, {
        department,
        waitMinutes: Math.round(avgWait),
        patientsWaiting: waiting.length
      }, { source: 'flow-engine' });

      NotificationManager.create({
        type: 'Operational',
        category: 'Operational',
        priority: 'High',
        title: 'Congestion Alert',
        message: `${department}: Average wait time ${Math.round(avgWait)} min exceeds threshold`,
        relatedModule: 'flow'
      });
    }
  }
};

export default FlowEngine;
