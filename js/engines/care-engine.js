// ============================================
// HospitalFlow AI — Care Engine
// ============================================

import Config from '../config.js';
import appState from '../state.js';
import eventBus, { EventTypes } from '../events.js';
import FlowEngine from './flow-engine.js';
import { generateId } from '../utils.js';
import NotificationManager from '../notifications.js';

let dpCounter = 2;
let fuCounter = 2;
let remCounter = 10;

// Pre-authored safe translations for demo
const translations = {
  Hindi: {
    medicationLabel: 'दवाइयाँ',
    dietLabel: 'आहार निर्देश',
    followUpLabel: 'अनुवर्ती भेंट',
    warningLabel: 'चेतावनी के संकेत',
    instructionLabel: 'अतिरिक्त निर्देश',
    safetyNotice: 'अपने स्वास्थ्य पेशेवर द्वारा दिए गए देखभाल निर्देशों का पालन करें।',
    morning: 'सुबह',
    afternoon: 'दोपहर',
    evening: 'शाम',
    night: 'रात',
    afterFood: 'खाने के बाद',
    beforeFood: 'खाने से पहले'
  },
  Marathi: {
    medicationLabel: 'औषधे',
    dietLabel: 'आहार सूचना',
    followUpLabel: 'पाठपुरावा भेट',
    warningLabel: 'धोक्याची चिन्हे',
    instructionLabel: 'अतिरिक्त सूचना',
    safetyNotice: 'आपल्या आरोग्य व्यावसायिकांनी दिलेल्या काळजी सूचनांचे पालन करा.',
    morning: 'सकाळ',
    afternoon: 'दुपार',
    evening: 'संध्याकाळ',
    night: 'रात्री',
    afterFood: 'जेवणानंतर',
    beforeFood: 'जेवणापूर्वी'
  },
  English: {
    medicationLabel: 'Medications',
    dietLabel: 'Diet Instructions',
    followUpLabel: 'Follow-Up Appointment',
    warningLabel: 'Warning Signs',
    instructionLabel: 'Additional Instructions',
    safetyNotice: 'Follow the care instructions provided by your healthcare professional.',
    morning: 'Morning',
    afternoon: 'Afternoon',
    evening: 'Evening',
    night: 'Night',
    afterFood: 'After food',
    beforeFood: 'Before food'
  }
};

const CareEngine = {
  /**
   * Create a discharge plan
   */
  createDischargePlan({ patientId, approvedBy, medications, dietPlan, followUp, warningSigns, instructions, language = 'English' }) {
    const s = appState.get();
    const patient = s.patients.find(p => p.id === patientId);
    const doctor = s.doctors.find(d => d.id === approvedBy);

    if (!patient) throw new Error('Patient not found');

    dpCounter++;
    const planId = `DP-${String(dpCounter).padStart(3, '0')}`;

    const plan = {
      id: planId,
      patientId,
      approvedBy,
      dischargeDate: new Date().toISOString(),
      medications: medications || [],
      dietPlan: dietPlan || '',
      followUp: followUp || null,
      warningSigns: warningSigns || [],
      instructions: instructions || '',
      language,
      active: true,
      caregiverShared: false,
      createdAt: new Date().toISOString()
    };

    appState.addItem('dischargePlans', plan);

    // Create medication reminders
    if (medications && medications.length > 0) {
      this._createMedicationReminders(patientId, medications);
    }

    // Create follow-up if specified
    if (followUp && followUp.date) {
      this.createFollowUp({
        patientId,
        department: followUp.department,
        doctorId: followUp.doctorId || approvedBy,
        date: followUp.date,
        time: followUp.time,
        dischargePlanId: planId
      });
    }

    // Initialize medication tracking
    const tracking = s.medicationTracking || {};
    tracking[patientId] = {
      totalDoses: medications.length * 2, // Approximate daily doses
      takenDoses: 0,
      missedDoses: 0,
      history: []
    };
    appState.update({ medicationTracking: tracking });

    eventBus.emit(EventTypes.DISCHARGE_PLAN_CREATED, {
      patientName: patient.displayName,
      planId,
      doctorName: doctor?.displayName,
      language,
      medicationCount: medications.length
    }, { source: 'care-engine', entityId: planId });

    NotificationManager.create({
      type: 'Care',
      category: 'Care',
      priority: 'Medium',
      title: 'Discharge Plan Created',
      message: `Discharge plan created for ${patient.displayName} with ${medications.length} medications`,
      relatedModule: 'care',
      relatedEntityId: planId
    });

    appState.recalculateDashboard();
    return plan;
  },

  /**
   * Acknowledge medication taken
   */
  acknowledgeMedication(patientId, medicationName, timeSlot) {
    const s = appState.get();
    const patient = s.patients.find(p => p.id === patientId);
    const tracking = s.medicationTracking || {};
    if (!tracking[patientId]) {
      tracking[patientId] = { totalDoses: 0, takenDoses: 0, missedDoses: 0, history: [] };
    }

    const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    tracking[patientId].takenDoses++;
    tracking[patientId].totalDoses++;
    tracking[patientId].history.push({
      id: generateId('med-take'),
      medication: medicationName,
      timeSlot,
      date: new Date().toISOString(),
      taken: true,
      takenAt: new Date().toISOString(),
      takenTimeStr: nowStr
    });

    appState.update({ medicationTracking: { ...tracking } });

    // Update discharge plan medications
    const plan = s.dischargePlans.find(dp => dp.patientId === patientId && dp.active);
    if (plan && plan.medications) {
      const med = plan.medications.find(m => m.name === medicationName && (!timeSlot || m.timeSlot === timeSlot));
      if (med) {
        med.taken = true;
        med.skipped = false;
        med.takenAt = new Date().toISOString();
        med.takenTimeStr = nowStr;
        appState.updateItem('dischargePlans', plan.id, { medications: [...plan.medications] });
      }
    }

    // Update related reminder
    const reminder = s.reminders.find(r =>
      r.patientId === patientId &&
      r.message.includes(medicationName) &&
      r.status !== 'Acknowledged'
    );
    if (reminder) {
      appState.updateItem('reminders', reminder.id, {
        status: 'Acknowledged',
        acknowledgedAt: new Date().toISOString()
      });
    }

    eventBus.emit(EventTypes.MEDICATION_TAKEN, {
      patientName: patient?.displayName,
      patientId,
      medicationName,
      timeSlot,
      takenAt: nowStr
    }, { source: 'care-engine', entityId: patientId });

    NotificationManager.create({
      type: 'Care',
      category: 'Reminder',
      priority: 'Low',
      title: 'Medication Taken',
      message: `${patient?.displayName || 'Patient'} confirmed ${timeSlot} dose of ${medicationName} at ${nowStr}`,
      relatedModule: 'care',
      relatedEntityId: patientId
    });
  },

  /**
   * Record medication as skipped with reason
   */
  recordSkippedMedication(patientId, medicationName, timeSlot, reason = 'Forgot') {
    const s = appState.get();
    const patient = s.patients.find(p => p.id === patientId);

    const tracking = s.medicationTracking || {};
    if (!tracking[patientId]) {
      tracking[patientId] = { totalDoses: 0, takenDoses: 0, missedDoses: 0, history: [] };
    }

    const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    tracking[patientId].missedDoses++;
    tracking[patientId].totalDoses++;
    tracking[patientId].history.push({
      id: generateId('med-skip'),
      medication: medicationName,
      timeSlot,
      date: new Date().toISOString(),
      taken: false,
      skipped: true,
      reason,
      takenAt: null,
      timestamp: nowStr
    });

    appState.update({ medicationTracking: { ...tracking } });

    // Update discharge plan medications
    const plan = s.dischargePlans.find(dp => dp.patientId === patientId && dp.active);
    if (plan && plan.medications) {
      const med = plan.medications.find(m => m.name === medicationName && (!timeSlot || m.timeSlot === timeSlot));
      if (med) {
        med.taken = false;
        med.skipped = true;
        med.skipReason = reason;
        appState.updateItem('dischargePlans', plan.id, { medications: [...plan.medications] });
      }
    }

    eventBus.emit(EventTypes.MEDICATION_MISSED, {
      patientName: patient?.displayName,
      patientId,
      medicationName,
      timeSlot,
      reason
    }, { source: 'care-engine', entityId: patientId });

    NotificationManager.create({
      type: 'Care',
      category: 'Reminder',
      priority: 'Medium',
      title: 'Medication Skipped',
      message: `${patient?.displayName || 'Patient'} recorded skipped ${timeSlot} dose of ${medicationName} (${reason})`,
      relatedModule: 'care',
      relatedEntityId: patientId
    });
  },

  /**
   * Update Dietary Instructions and persist Care Plan
   */
  updateDietaryInstructions(patientId, dietaryInstructions, medName = null) {
    const s = appState.get();
    let plan = s.dischargePlans.find(dp => dp.patientId === patientId && dp.active);
    if (plan) {
      const updatedMeds = plan.medications ? [...plan.medications] : [];
      if (medName && updatedMeds.length > 0) {
        updatedMeds[0] = { ...updatedMeds[0], name: medName };
      }
      appState.updateItem('dischargePlans', plan.id, {
        dietPlan: dietaryInstructions,
        medications: updatedMeds,
        updatedAt: new Date().toISOString()
      });
      plan = { ...plan, dietPlan: dietaryInstructions, medications: updatedMeds, updatedAt: new Date().toISOString() };
    } else {
      plan = this.createDischargePlan({
        patientId,
        approvedBy: s.currentUser?.doctorId || 'D-0001',
        dietPlan: dietaryInstructions,
        medications: [{ name: medName || 'Azithromycin 500mg', dosage: '1 Tablet', timeSlot: 'Morning', timing: '08:00 AM', instructions: 'After breakfast', taken: false }],
        warningSigns: ['Fever rising above 101°F', 'Severe persistent breathlessness', 'Sudden acute dizziness or fainting']
      });
    }

    eventBus.emit('CARE_PLAN_UPDATED', {
      planId: plan.id,
      patientId,
      dietPlan: dietaryInstructions,
      medications: plan.medications
    }, { source: 'care-engine', entityId: plan.id });

    return plan;
  },

  /**
   * Mark medication as missed
   */
  markMedicationMissed(patientId, medicationName, timeSlot) {
    this.recordSkippedMedication(patientId, medicationName, timeSlot, 'Forgot / Missed');
  },

  /**
   * Get medication adherence for a patient
   */
  getAdherence(patientId) {
    const tracking = (appState.get().medicationTracking || {})[patientId];
    if (!tracking || tracking.totalDoses === 0) return { rate: 100, taken: 0, total: 0, missed: 0 };

    const total = tracking.takenDoses + tracking.missedDoses;
    const rate = total > 0 ? Math.round((tracking.takenDoses / total) * 100) : 100;

    return {
      rate,
      taken: tracking.takenDoses,
      total,
      missed: tracking.missedDoses
    };
  },

  /**
   * Create a follow-up appointment (connects to Flow Intelligence)
   */
  createFollowUp({ patientId, department, doctorId, date, time, dischargePlanId = null }) {
    const s = appState.get();
    const patient = s.patients.find(p => p.id === patientId);
    const doctor = s.doctors.find(d => d.id === doctorId);

    fuCounter++;
    const followUpId = `FU-${String(fuCounter).padStart(3, '0')}`;

    // Create the follow-up record
    const followUp = {
      id: followUpId,
      patientId,
      department,
      doctorId,
      date,
      time: time || '10:00 AM',
      status: 'Scheduled',
      dischargePlanId,
      appointmentId: null
    };

    appState.addItem('followUps', followUp);

    // CROSS-PILLAR: Create actual appointment in Flow Intelligence
    try {
      const scheduledTime = new Date(date);
      if (time) {
        const [h, m] = time.replace(/\s*(AM|PM)/i, '').split(':');
        let hours = parseInt(h);
        if (time.toLowerCase().includes('pm') && hours < 12) hours += 12;
        scheduledTime.setHours(hours, parseInt(m) || 0, 0, 0);
      }

      const result = FlowEngine.bookAppointment({
        patientId,
        doctorId,
        department,
        scheduledTime: scheduledTime.toISOString(),
        priority: 'normal'
      });

      // Link follow-up to appointment
      appState.updateItem('followUps', followUpId, {
        appointmentId: result.appointment.id
      });
    } catch (err) {
      console.warn('Could not auto-create appointment for follow-up:', err.message);
    }

    eventBus.emit(EventTypes.FOLLOWUP_CREATED, {
      patientName: patient?.displayName,
      department,
      doctorName: doctor?.displayName,
      date,
      followUpId
    }, { source: 'care-engine', entityId: followUpId });

    NotificationManager.create({
      type: 'Care',
      category: 'Care',
      priority: 'Medium',
      title: 'Follow-Up Scheduled',
      message: `Follow-up scheduled for ${patient?.displayName} — ${department} on ${new Date(date).toLocaleDateString('en-IN')}`,
      relatedModule: 'care',
      relatedEntityId: followUpId
    });

    // Create reminder
    this._createFollowUpReminder(patientId, date, department, doctor?.displayName);

    return followUp;
  },

  /**
   * Report a warning sign (patient-initiated)
   */
  reportWarningSign(patientId, description) {
    const s = appState.get();
    const patient = s.patients.find(p => p.id === patientId);

    eventBus.emit(EventTypes.WARNING_SIGN_REPORTED, {
      patientName: patient?.displayName,
      description
    }, { source: 'care-engine', entityId: patientId });

    NotificationManager.create({
      type: 'Care',
      category: 'Emergency',
      priority: 'Critical',
      title: 'Warning Sign Reported',
      message: `${patient?.displayName} reported: ${description}. Recommend contacting hospital.`,
      relatedModule: 'care',
      relatedEntityId: patientId
    });
  },

  /**
   * Request care re-entry
   */
  requestReentry(patientId, reason) {
    const s = appState.get();
    const patient = s.patients.find(p => p.id === patientId);

    // Find patient's last department/doctor
    const lastPlan = s.dischargePlans.find(dp => dp.patientId === patientId && dp.active);
    const doctor = lastPlan ? s.doctors.find(d => d.id === lastPlan.approvedBy) : null;
    const department = doctor?.department || 'General Medicine';

    eventBus.emit(EventTypes.CARE_REENTRY_REQUESTED, {
      patientName: patient?.displayName,
      reason,
      department
    }, { source: 'care-engine', entityId: patientId });

    NotificationManager.create({
      type: 'Care',
      category: 'Emergency',
      priority: 'High',
      title: 'Care Re-Entry Requested',
      message: `${patient?.displayName} requires re-entry: ${reason}. Recommend prioritized follow-up.`,
      relatedModule: 'care',
      relatedEntityId: patientId
    });

    return { department, doctorId: doctor?.id, reason };
  },

  /**
   * Get translations for a language
   */
  getTranslations(language) {
    return translations[language] || translations.English;
  },

  /**
   * Share discharge plan with caregiver
   */
  shareWithCaregiver(planId) {
    appState.updateItem('dischargePlans', planId, { caregiverShared: true });

    NotificationManager.create({
      type: 'Care',
      category: 'Care',
      priority: 'Information',
      title: 'Plan Shared',
      message: 'Discharge plan shared with designated caregiver (simulated)',
      relatedModule: 'care'
    });
  },

  // ---- Private helpers ----

  _createMedicationReminders(patientId, medications) {
    const s = appState.get();
    medications.forEach(med => {
      remCounter++;
      const reminderId = `REM-${String(remCounter).padStart(3, '0')}`;
      const now = new Date();

      // Create a reminder for the next occurrence of this time slot
      const slotHours = { Morning: 8, Afternoon: 13, Evening: 18, Night: 21 };
      const hour = slotHours[med.timeSlot] || 8;
      const scheduledFor = new Date(now);
      scheduledFor.setHours(hour, 0, 0, 0);
      if (scheduledFor < now) scheduledFor.setDate(scheduledFor.getDate() + 1);

      appState.addItem('reminders', {
        id: reminderId,
        patientId,
        type: 'Medication',
        message: `Time to take ${med.name} (${med.timeSlot} dose)`,
        scheduledFor: scheduledFor.toISOString(),
        status: 'Scheduled',
        acknowledgedAt: null
      });
    });
  },

  _createFollowUpReminder(patientId, date, department, doctorName) {
    remCounter++;
    const remDate = new Date(date);
    remDate.setDate(remDate.getDate() - 1);
    remDate.setHours(9, 0, 0, 0);

    appState.addItem('reminders', {
      id: `REM-${String(remCounter).padStart(3, '0')}`,
      patientId,
      type: 'Follow-up',
      message: `Reminder: Follow-up appointment with ${doctorName || 'doctor'} (${department}) tomorrow`,
      scheduledFor: remDate.toISOString(),
      status: 'Scheduled',
      acknowledgedAt: null
    });
  }
};

export default CareEngine;
