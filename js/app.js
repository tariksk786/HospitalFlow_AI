// ============================================
// HospitalFlow AI — Main Application Bootstrap
// ============================================

import Config from './config.js';
import appState from './state.js';
import eventBus, { EventTypes, getEventDescription, getEventIcon, getEventColor } from './events.js';
import Storage from './storage.js';
import Auth from './auth.js';
import Router from './router.js';
import i18n from './i18n.js';
import SymptomNormalizer from './engines/symptom-normalizer.js';
import NotificationManager from './notifications.js';
import ChartManager from './charts.js';
import { generateDemoState, initialEvents } from './demo-data.js';
import { escapeHtml, timeAgo } from './utils.js';

// Engines
import FlowEngine from './engines/flow-engine.js';
import BloodEngine from './engines/blood-engine.js';
import CareEngine from './engines/care-engine.js';
import SimulationEngine from './engines/simulation-engine.js';
import PredictionEngine from './engines/prediction-engine.js';
import alertManager from './engines/emergency-alert-manager.js';
import impactEngine from './engines/emergency-impact-engine.js';
import SupabaseSync from './engines/supabase-sync.js';

// ============================================
// GLOBAL API (window.HospitalFlow)
// ============================================

const HospitalFlow = {
  router: Router,
  state: appState,
  events: eventBus,
  auth: Auth,
  i18n: i18n,
  symptomNormalizer: SymptomNormalizer,
  flow: FlowEngine,
  blood: BloodEngine,
  care: CareEngine,
  simulation: SimulationEngine,
  prediction: PredictionEngine,
  alerts: alertManager,
  impact: impactEngine,
  sync: SupabaseSync,

  // Direct logout alias
  logout() {
    Auth.logout();
  },

  // ---- Patient & Clinical Actions ----
  checkInPatient(appointmentId) {
    try {
      FlowEngine.checkInPatient(appointmentId);
      const user = Auth.getCurrentUser();
      if (user?.role === 'patient') {
        Router.navigate('/patient/queue');
      } else if (user?.role === 'doctor') {
        Router.navigate('/doctor/queue');
      } else {
        Router.navigate('/admin/flow');
      }
    } catch (err) {
      alert(`Check-in failed: ${err.message}`);
    }
  },

  callPatient(queueEntryId) {
    FlowEngine.callPatient(queueEntryId);
    const user = Auth.getCurrentUser();
    Router.navigate(user?.role === 'doctor' ? '/doctor/dashboard' : '/admin/flow');
  },

  markPatientInRoom(queueEntryId) {
    FlowEngine.markPatientInRoom(queueEntryId);
    const user = Auth.getCurrentUser();
    Router.navigate(user?.role === 'doctor' ? '/doctor/dashboard' : '/admin/flow');
  },

  startConsultation(queueEntryId) {
    FlowEngine.startConsultation(queueEntryId);
    const user = Auth.getCurrentUser();
    Router.navigate(user?.role === 'doctor' ? '/doctor/dashboard' : '/admin/flow');
  },

  completeConsultation(queueEntryId) {
    FlowEngine.completeConsultation(queueEntryId);
    const user = Auth.getCurrentUser();
    Router.navigate(user?.role === 'doctor' ? '/doctor/dashboard' : '/admin/flow');
  },

  createPreArrivalEmergency(data) {
    return FlowEngine.createPreArrivalEmergency(data);
  },

  transferPatient(queueEntryId, toDoctorId) {
    FlowEngine.transferPatient(queueEntryId, toDoctorId);
    const user = Auth.getCurrentUser();
    Router.navigate(user?.role === 'doctor' ? '/doctor/queue' : '/admin/flow');
  },

  changeDoctorStatus(doctorId, status) {
    FlowEngine.changeDoctorStatus(doctorId, status);
    const user = Auth.getCurrentUser();
    if (user?.role === 'doctor') {
      Router.navigate('/doctor/dashboard');
    } else {
      Router.navigate('/admin/doctors');
    }
  },

  showEmergencyInsert() {
    const patientId = prompt('Enter Patient ID (e.g. P-1025):');
    if (!patientId) return;
    const department = prompt('Enter Department (e.g. General Medicine, Cardiology):', 'General Medicine');
    if (!department) return;

    try {
      FlowEngine.insertEmergencyPatient({ patientId, department });
      const user = Auth.getCurrentUser();
      Router.navigate(user?.role === 'doctor' ? '/doctor/queue' : '/admin/flow');
    } catch (err) {
      alert(`Emergency insert failed: ${err.message}`);
    }
  },

  // ---- Emergency & Ambulance Actions ----
  acknowledgeEmergencyAlert(alertId) {
    const user = Auth.getCurrentUser();
    alertManager.acknowledgeAlert(alertId, user?.displayName || 'Staff');
    const banner = document.querySelector(`[id^="active-emergency-banner-"]`);
    if (banner) banner.remove();
  },

  assignEmergencyDoctor(caseId, doctorId, options = {}) {
    try {
      FlowEngine.assignEmergencyDoctor(caseId, doctorId, options);
      const user = Auth.getCurrentUser();
      Router.navigate(user?.role === 'doctor' ? '/doctor/queue' : '/admin/emergency');
    } catch (err) {
      alert(`Assignment failed: ${err.message}`);
    }
  },

  startEmergencyConsultation(caseId) {
    const s = appState.get();
    const emCase = s.emergencyCases.find(c => c.id === caseId || c.caseId === caseId);
    if (emCase && emCase.queueEntryId) {
      FlowEngine.startConsultation(emCase.queueEntryId);
      emCase.status = 'IN_CONSULTATION';
      appState.updateItem('emergencyCases', emCase.id, { status: 'IN_CONSULTATION' });
    }
    const user = Auth.getCurrentUser();
    Router.navigate(user?.role === 'doctor' ? '/doctor/dashboard' : '/admin/emergency');
  },

  completeEmergencyCase(caseId) {
    try {
      FlowEngine.completeEmergencyCase(caseId);
    } catch {
      impactEngine.completeEmergencyCase(caseId);
    }
    alert('Emergency case completed. Doctor capacity restored and queue entering recovery.');
    const user = Auth.getCurrentUser();
    Router.navigate(user?.role === 'doctor' ? '/doctor/dashboard' : '/admin/emergency');
  },

  markAmbulanceArrived(requestId) {
    FlowEngine.markAmbulanceArrived(requestId);
    alert('Ambulance marked arrived. Patient prioritized in emergency queue.');
    Router.navigate('/admin/emergency');
  },

  dispatchAmbulance(requestId, ambulanceId, mins) {
    FlowEngine.dispatchAmbulance(requestId, ambulanceId, mins);
    Router.navigate('/admin/emergency');
  },

  applyEmergencyRecommendation(recId) {
    impactEngine.applyRecommendation(recId);
    Router.navigate('/admin/flow');
  },

  // ---- Blood Bank & Emergency Actions ----
  showSourceResults(requestId) {
    BloodEngine.processRequest(requestId);
    Router.navigate('/admin/emergency');
  },

  reserveBlood(requestId, facilityId, units) {
    try {
      BloodEngine.reserveUnits(requestId, facilityId, units);
      Router.navigate('/admin/emergency');
    } catch (err) {
      alert(`Reserve failed: ${err.message}`);
    }
  },

  issueBlood(requestId) {
    BloodEngine.issueUnits(requestId);
    Router.navigate('/admin/emergency');
  },

  sendDonorWave(requestId) {
    const donors = BloodEngine.sendDonorNotificationWave(requestId);
    if (donors.length === 0) {
      alert('No more eligible donors available for this blood group.');
    }
    Router.navigate('/admin/emergency');
  },

  showOTPVerification(donorId) {
    const otp = prompt('Enter the 6-digit OTP code sent to donor:');
    if (!otp) return;
    const result = BloodEngine.verifyDonorOTP(donorId, otp);
    alert(result.message);
    Router.navigate('/admin/emergency');
  },

  // ---- Care Continuity Actions ----
  toggleMedication(patientId, medName, timeSlot) {
    CareEngine.acknowledgeMedication(patientId, medName, timeSlot);
    const user = Auth.getCurrentUser();
    if (user?.role === 'patient') {
      Router.navigate('/patient/care');
    }
  },

  reportWarningSign(patientId) {
    const desc = prompt('Describe the warning sign/symptoms experienced:');
    if (!desc) return;
    CareEngine.reportWarningSign(patientId, desc);
    alert('Warning sign reported. Hospital triage team has been notified.');
  },

  requestReentry(patientId) {
    const reason = prompt('Reason for hospital care re-entry:');
    if (!reason) return;
    CareEngine.requestReentry(patientId, reason);
    alert('Care re-entry requested. Your follow-up is being prioritized.');
  },

  markAllNotificationsRead() {
    NotificationManager.markAllRead();
    const user = Auth.getCurrentUser();
    if (user?.role === 'patient') Router.navigate('/patient/notifications');
    else if (user?.role === 'doctor') Router.navigate('/doctor/notifications');
    else Router.navigate('/admin/notifications');
  }
};

// ============================================
// BOOTSTRAP INITIALIZATION
// ============================================
async function bootstrap() {
  console.log(`%c HospitalFlow AI v${Config.VERSION} — Multi-Role Healthcare Coordination `, 'background: #0EA5E9; color: white; font-weight: bold; padding: 4px 12px; border-radius: 6px; font-size: 14px;');

  // 1. Initialize persistent or synthetic demo dataset
  const savedState = Storage.loadState();
  if (savedState && savedState.patients && savedState.patients.length > 0) {
    appState.initialize(savedState);
  } else {
    const demoState = generateDemoState();
    appState.initialize(demoState);
  }

  // 2. Load audit events into event bus
  if (eventBus.history.length === 0) {
    initialEvents.forEach(evt => eventBus.history.unshift(evt));
  }

  // 3. Recalculate dashboard analytics
  appState.recalculateDashboard();

  // 4. Initialize Authentication
  await Auth.init();

  // 5. Initialize Supabase Realtime Synchronization
  await SupabaseSync.init();

  // 6. Initialize Router
  Router.init();
}

// Expose globally
window.HospitalFlow = HospitalFlow;

// Launch on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
