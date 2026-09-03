// ============================================
// HospitalFlow AI — Central Event Bus
// Single Operational Truth & Cross-Portal Synchronization
// ============================================

import { generateId } from './utils.js';

class EventBus {
  constructor() {
    this.listeners = new Map();
    this.history = [];
    this.maxHistory = 1000;
  }

  /**
   * Subscribe to an event type
   * @param {string} eventType - Event type or '*' for all events
   * @param {Function} callback
   * @returns {Function} unsubscribe function
   */
  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType).add(callback);
    return () => this.off(eventType, callback);
  }

  /**
   * Unsubscribe from an event
   */
  off(eventType, callback) {
    const listeners = this.listeners.get(eventType);
    if (listeners) listeners.delete(callback);
  }

  /**
   * Subscribe to an event once
   */
  once(eventType, callback) {
    const wrapper = (event) => {
      this.off(eventType, wrapper);
      callback(event);
    };
    return this.on(eventType, wrapper);
  }

  /**
   * Emit a domain event across all portals
   * @param {string} type - Event type constant
   * @param {Object} payload - Event data
   * @param {Object} meta - Additional metadata (source, userId, role, entityId)
   */
  emit(type, payload = {}, meta = {}) {
    const event = {
      id: generateId('evt'),
      type,
      timestamp: new Date().toISOString(),
      payload,
      source: meta.source || 'system',
      userId: meta.userId || null,
      role: meta.role || 'system',
      entityId: meta.entityId || null
    };

    // Add to history
    this.history.unshift(event);
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(0, this.maxHistory);
    }

    // Notify type-specific listeners
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      typeListeners.forEach(cb => {
        try { cb(event); }
        catch (err) { console.error(`EventBus handler error for ${type}:`, err); }
      });
    }

    // Notify wildcard listeners
    const wildListeners = this.listeners.get('*');
    if (wildListeners) {
      wildListeners.forEach(cb => {
        try { cb(event); }
        catch (err) { console.error('EventBus wildcard handler error:', err); }
      });
    }

    return event;
  }

  /**
   * Get event history, optionally filtered
   */
  getHistory(filter = {}) {
    let events = [...this.history];
    if (filter.type) events = events.filter(e => e.type === filter.type);
    if (filter.source) events = events.filter(e => e.source === filter.source);
    if (filter.entityId) events = events.filter(e => e.entityId === filter.entityId);
    if (filter.role) events = events.filter(e => e.role === filter.role);
    if (filter.search) {
      const q = filter.search.toLowerCase();
      events = events.filter(e =>
        e.type.toLowerCase().includes(q) ||
        JSON.stringify(e.payload).toLowerCase().includes(q)
      );
    }
    if (filter.limit) events = events.slice(0, filter.limit);
    return events;
  }

  /** Get recent activity for display */
  getRecentActivity(limit = 20) {
    return this.history.slice(0, limit);
  }

  /** Load history from storage */
  loadHistory(events) {
    if (Array.isArray(events)) {
      this.history = events;
    }
  }

  /** Clear all listeners and history */
  reset() {
    this.listeners.clear();
    this.history = [];
  }
}

// Domain Event Types
export const EventTypes = {
  // Auth
  USER_LOGGED_IN: 'USER_LOGGED_IN',
  USER_LOGGED_OUT: 'USER_LOGGED_OUT',
  USER_LANGUAGE_CHANGED: 'USER_LANGUAGE_CHANGED',

  // Flow & Consultations
  PATIENT_REGISTERED: 'PATIENT_REGISTERED',
  APPOINTMENT_BOOKED: 'APPOINTMENT_BOOKED',
  APPOINTMENT_CANCELLED: 'APPOINTMENT_CANCELLED',
  PATIENT_CHECKED_IN: 'PATIENT_CHECKED_IN',
  QUEUE_ENTRY_CREATED: 'QUEUE_ENTRY_CREATED',
  QUEUE_RECALCULATED: 'QUEUE_RECALCULATED',
  PATIENT_CALLED: 'PATIENT_CALLED',
  CONSULTATION_STARTED: 'CONSULTATION_STARTED',
  CONSULTATION_COMPLETED: 'CONSULTATION_COMPLETED',
  EMERGENCY_PATIENT_INSERTED: 'EMERGENCY_PATIENT_INSERTED',
  DOCTOR_AVAILABILITY_CHANGED: 'DOCTOR_AVAILABILITY_CHANGED',
  PATIENT_TRANSFERRED: 'PATIENT_TRANSFERRED',
  PATIENT_REDISTRIBUTED: 'PATIENT_REDISTRIBUTED',
  CONGESTION_THRESHOLD_REACHED: 'CONGESTION_THRESHOLD_REACHED',
  PATIENT_NO_SHOW: 'PATIENT_NO_SHOW',

  // Emergency & Ambulance
  EMERGENCY_ALERT_CREATED: 'EMERGENCY_ALERT_CREATED',
  EMERGENCY_ALERT_ACKNOWLEDGED: 'EMERGENCY_ALERT_ACKNOWLEDGED',
  EMERGENCY_ALERT_ESCALATED: 'EMERGENCY_ALERT_ESCALATED',
  EMERGENCY_CASE_CREATED: 'EMERGENCY_CASE_CREATED',
  EMERGENCY_CASE_ASSIGNED: 'EMERGENCY_CASE_ASSIGNED',
  EMERGENCY_CASE_ACCEPTED: 'EMERGENCY_CASE_ACCEPTED',
  EMERGENCY_CASE_STARTED: 'EMERGENCY_CASE_STARTED',
  EMERGENCY_CASE_COMPLETED: 'EMERGENCY_CASE_COMPLETED',
  DOCTOR_DIVERTED_TO_EMERGENCY: 'DOCTOR_DIVERTED_TO_EMERGENCY',
  DOCTOR_EMERGENCY_RELEASED: 'DOCTOR_EMERGENCY_RELEASED',
  EMERGENCY_CAPACITY_CHANGED: 'EMERGENCY_CAPACITY_CHANGED',
  EMERGENCY_OVERLOAD_STARTED: 'EMERGENCY_OVERLOAD_STARTED',
  EMERGENCY_OVERLOAD_RESOLVED: 'EMERGENCY_OVERLOAD_RESOLVED',
  AMBULANCE_REQUEST_CREATED: 'AMBULANCE_REQUEST_CREATED',
  AMBULANCE_ALERT_ACKNOWLEDGED: 'AMBULANCE_ALERT_ACKNOWLEDGED',
  AMBULANCE_ASSIGNED: 'AMBULANCE_ASSIGNED',
  AMBULANCE_DISPATCHED: 'AMBULANCE_DISPATCHED',
  AMBULANCE_PATIENT_PICKED_UP: 'AMBULANCE_PATIENT_PICKED_UP',
  AMBULANCE_EN_ROUTE_HOSPITAL: 'AMBULANCE_EN_ROUTE_HOSPITAL',
  AMBULANCE_ARRIVED: 'AMBULANCE_ARRIVED',
  QUEUE_RECOVERY_STARTED: 'QUEUE_RECOVERY_STARTED',
  QUEUE_RECOVERY_COMPLETED: 'QUEUE_RECOVERY_COMPLETED',
  PATIENT_DELAY_NOTIFICATION_CREATED: 'PATIENT_DELAY_NOTIFICATION_CREATED',

  // Blood Bank & Donors
  BLOOD_REQUEST_CREATED: 'BLOOD_REQUEST_CREATED',
  BLOOD_REQUEST_CRITICAL: 'BLOOD_REQUEST_CRITICAL',
  BLOOD_SOURCE_MATCHED: 'BLOOD_SOURCE_MATCHED',
  BLOOD_UNITS_RESERVED: 'BLOOD_UNITS_RESERVED',
  BLOOD_CONFIRMED_BY_BANK: 'BLOOD_CONFIRMED_BY_BANK',
  BLOOD_READY_FOR_ISSUE: 'BLOOD_READY_FOR_ISSUE',
  BLOOD_UNITS_ISSUED: 'BLOOD_UNITS_ISSUED',
  BLOOD_STOCK_CRITICAL: 'BLOOD_STOCK_CRITICAL',
  EXTERNAL_BLOOD_SOURCE_REQUESTED: 'EXTERNAL_BLOOD_SOURCE_REQUESTED',
  DONOR_NOTIFICATION_SENT: 'DONOR_NOTIFICATION_SENT',
  DONOR_CONTACTED: 'DONOR_CONTACTED',
  DONOR_CONFIRMED: 'DONOR_CONFIRMED',
  DONOR_VERIFIED: 'DONOR_VERIFIED',

  // Care Continuity & Post-Discharge
  DISCHARGE_PLAN_CREATED: 'DISCHARGE_PLAN_CREATED',
  CARE_PLAN_UPDATED: 'CARE_PLAN_UPDATED',
  MEDICATION_ACKNOWLEDGED: 'MEDICATION_ACKNOWLEDGED',
  MEDICATION_MISSED: 'MEDICATION_MISSED',
  FOLLOWUP_CREATED: 'FOLLOWUP_CREATED',
  WARNING_SIGN_REPORTED: 'WARNING_SIGN_REPORTED',
  POST_DISCHARGE_REPORT_CREATED: 'POST_DISCHARGE_REPORT_CREATED',
  POST_DISCHARGE_REPORT_ASSIGNED: 'POST_DISCHARGE_REPORT_ASSIGNED',
  CARE_REENTRY_REQUESTED: 'CARE_REENTRY_REQUESTED',
  CARE_REENTRY_RECOMMENDED: 'CARE_REENTRY_RECOMMENDED',

  // Simulation & Demo
  SIMULATION_RUN: 'SIMULATION_RUN',
  SIMULATION_APPLIED: 'SIMULATION_APPLIED',
  DEMO_SIMULATION_STARTED: 'DEMO_SIMULATION_STARTED',
  DEMO_STAGE_CHANGED: 'DEMO_STAGE_CHANGED',
  DEMO_SIMULATION_COMPLETED: 'DEMO_SIMULATION_COMPLETED',
  DEMO_STATE_RESET: 'DEMO_STATE_RESET',

  // System
  STATE_UPDATED: 'STATE_UPDATED',
  NOTIFICATION_CREATED: 'NOTIFICATION_CREATED'
};

// Event descriptions for display
export const EventDescriptions = {
  [EventTypes.USER_LOGGED_IN]: (e) => `${e.payload.displayName || 'User'} logged in as ${e.payload.role}`,
  [EventTypes.USER_LOGGED_OUT]: (e) => `User logged out`,
  [EventTypes.PATIENT_REGISTERED]: (e) => `Patient ${e.payload.displayName || e.payload.patientId} registered in hospital system`,
  [EventTypes.APPOINTMENT_BOOKED]: (e) => `Appointment ${e.payload.appointmentId} booked for ${e.payload.patientName || e.payload.patientId} with Dr. ${e.payload.doctorName || 'Physician'} (${e.payload.department})`,
  [EventTypes.PATIENT_CHECKED_IN]: (e) => `Patient ${e.payload.patientName || e.payload.patientId} checked in — Token ${e.payload.tokenId || e.payload.queueId}`,
  [EventTypes.QUEUE_ENTRY_CREATED]: (e) => `Token ${e.payload.tokenId || e.payload.queueId} created in ${e.payload.department} queue`,
  [EventTypes.QUEUE_RECALCULATED]: (e) => `Queue recalculated for ${e.payload.department} — ${e.payload.affectedPatients || 0} patients affected`,
  [EventTypes.PATIENT_CALLED]: (e) => `Token ${e.payload.tokenId || e.payload.queueId} (${e.payload.patientName || 'Patient'}) called by Dr. ${e.payload.doctorName || 'Doctor'}`,
  [EventTypes.CONSULTATION_STARTED]: (e) => `Consultation started: ${e.payload.patientName || 'Patient'} with Dr. ${e.payload.doctorName || 'Doctor'}`,
  [EventTypes.CONSULTATION_COMPLETED]: (e) => `Consultation completed: ${e.payload.patientName || 'Patient'} with Dr. ${e.payload.doctorName || 'Doctor'}`,
  [EventTypes.EMERGENCY_PATIENT_INSERTED]: (e) => `Emergency patient ${e.payload.patientName || 'Emergency'} inserted into ${e.payload.department} queue (Priority: ${e.payload.priority || 'P1'})`,
  [EventTypes.DOCTOR_AVAILABILITY_CHANGED]: (e) => `Dr. ${e.payload.doctorName || 'Doctor'} availability changed to ${e.payload.newStatus}`,
  [EventTypes.PATIENT_TRANSFERRED]: (e) => `Patient ${e.payload.patientName || 'Patient'} transferred from Dr. ${e.payload.fromDoctor} to Dr. ${e.payload.toDoctor}`,
  [EventTypes.PATIENT_REDISTRIBUTED]: (e) => `${e.payload.count || 3} patients redistributed to Dr. ${e.payload.toDoctor} to alleviate delay`,
  [EventTypes.CONGESTION_THRESHOLD_REACHED]: (e) => `${e.payload.department} congestion threshold reached (${e.payload.waitMinutes} min avg wait)`,
  [EventTypes.BLOOD_REQUEST_CREATED]: (e) => `Blood request ${e.payload.requestId}: ${e.payload.units} units ${e.payload.bloodGroup} (${e.payload.urgency})`,
  [EventTypes.BLOOD_REQUEST_CRITICAL]: (e) => `🚨 Critical Blood Alert: ${e.payload.units} units ${e.payload.bloodGroup} urgently required`,
  [EventTypes.BLOOD_SOURCE_MATCHED]: (e) => `Operational blood match found for request ${e.payload.requestId}: ${e.payload.facilityName || 'Internal Inventory'}`,
  [EventTypes.BLOOD_UNITS_RESERVED]: (e) => `${e.payload.units} units ${e.payload.bloodGroup} reserved from ${e.payload.facilityName || 'Internal Blood Bank'}`,
  [EventTypes.BLOOD_CONFIRMED_BY_BANK]: (e) => `Blood Bank confirmed reservation for request ${e.payload.requestId}`,
  [EventTypes.BLOOD_READY_FOR_ISSUE]: (e) => `Blood units ready for collection at Emergency Ward`,
  [EventTypes.BLOOD_UNITS_ISSUED]: (e) => `${e.payload.units} units ${e.payload.bloodGroup} issued for patient ${e.payload.patientId}`,
  [EventTypes.BLOOD_STOCK_CRITICAL]: (e) => `Blood ${e.payload.bloodGroup} stock critical: ${e.payload.availableUnits} units remaining`,
  [EventTypes.EXTERNAL_BLOOD_SOURCE_REQUESTED]: (e) => `External blood sourcing requested from ${e.payload.facilityName || 'Partner Bank'}`,
  [EventTypes.DONOR_NOTIFICATION_SENT]: (e) => `Donor notification sent to ${e.payload.donorName} (Wave ${e.payload.wave || 1})`,
  [EventTypes.DONOR_CONTACTED]: (e) => `Donor ${e.payload.donorName} contacted for emergency blood donation`,
  [EventTypes.DONOR_CONFIRMED]: (e) => `Donor ${e.payload.donorName} confirmed availability for ${e.payload.bloodGroup}`,
  [EventTypes.DONOR_VERIFIED]: (e) => `Donor ${e.payload.donorName} identity verified by Blood Operations`,
  [EventTypes.DISCHARGE_PLAN_CREATED]: (e) => `Discharge plan created for ${e.payload.patientName || e.payload.patientId}`,
  [EventTypes.CARE_PLAN_UPDATED]: (e) => `Care plan updated for ${e.payload.patientName || e.payload.patientId}`,
  [EventTypes.MEDICATION_ACKNOWLEDGED]: (e) => `${e.payload.patientName || 'Patient'} acknowledged medication: ${e.payload.medicationName}`,
  [EventTypes.MEDICATION_MISSED]: (e) => `${e.payload.patientName || 'Patient'} missed medication: ${e.payload.medicationName}`,
  [EventTypes.FOLLOWUP_CREATED]: (e) => `Follow-up scheduled for ${e.payload.patientName || 'Patient'} on ${e.payload.date} (${e.payload.department})`,
  [EventTypes.WARNING_SIGN_REPORTED]: (e) => `Warning condition reported by ${e.payload.patientName || e.payload.patientId}: ${e.payload.reportedCondition || e.payload.description} (${e.payload.severity || 'Moderate'})`,
  [EventTypes.POST_DISCHARGE_REPORT_CREATED]: (e) => `Post-discharge report submitted by ${e.payload.patientName || e.payload.patientId}: ${e.payload.condition || 'Condition alert'} (${e.payload.severity})`,
  [EventTypes.POST_DISCHARGE_REPORT_ASSIGNED]: (e) => `Post-discharge case routed to Dr. ${e.payload.doctorName || 'Physician'} for clinical review`,
  [EventTypes.CARE_REENTRY_REQUESTED]: (e) => `Care re-entry requested for ${e.payload.patientName || e.payload.patientId}: ${e.payload.reason || 'Symptom relapse'}`,
  [EventTypes.CARE_REENTRY_RECOMMENDED]: (e) => `Clinical staff recommended hospital re-entry for patient ${e.payload.patientId}`,
  [EventTypes.EMERGENCY_ALERT_CREATED]: (e) => `🚨 Emergency Alert: ${e.payload.title || 'Trauma Case'} (${e.payload.severity || 'Critical'})`,
  [EventTypes.EMERGENCY_ALERT_ACKNOWLEDGED]: (e) => `Emergency alert acknowledged by ${e.payload.acknowledgedBy || 'Command Center'}`,
  [EventTypes.AMBULANCE_REQUEST_CREATED]: (e) => `🚑 Ambulance requested for ${e.payload.patientName || e.payload.patientId} at ${e.payload.pickupLocation}`,
  [EventTypes.AMBULANCE_DISPATCHED]: (e) => `Ambulance ${e.payload.ambulanceId} dispatched to ${e.payload.pickupLocation}`,
  [EventTypes.AMBULANCE_ARRIVED]: (e) => `Ambulance ${e.payload.ambulanceId} arrived at hospital with patient ${e.payload.patientId}`,
  [EventTypes.DOCTOR_DIVERTED_TO_EMERGENCY]: (e) => `Dr. ${e.payload.doctorName} diverted to emergency response (Capacity reduced)`,
  [EventTypes.DOCTOR_EMERGENCY_RELEASED]: (e) => `Dr. ${e.payload.doctorName} released from emergency duty to routine OPD`,
  [EventTypes.QUEUE_RECOVERY_STARTED]: (e) => `Flow recovery in progress for ${e.payload.department} (State: Recovering)`,
  [EventTypes.QUEUE_RECOVERY_COMPLETED]: (e) => `Flow normalized for ${e.payload.department} (State: Normalized)`,
  [EventTypes.SIMULATION_RUN]: (e) => `Simulation scenario executed: +${e.payload.emergencyPatients || 0} emergencies, -${e.payload.doctorsUnavailable || 0} doctors`,
  [EventTypes.SIMULATION_APPLIED]: (e) => `Simulation scenario response applied to live state`,
  [EventTypes.DEMO_SIMULATION_STARTED]: (e) => `Live interactive demo simulation started`,
  [EventTypes.DEMO_STAGE_CHANGED]: (e) => `Demo simulation advanced to Stage ${e.payload.stage}: ${e.payload.title}`,
  [EventTypes.DEMO_SIMULATION_COMPLETED]: (e) => `Live demo simulation finished successfully`,
  [EventTypes.DEMO_STATE_RESET]: (e) => `Demo state reset to baseline`
};

/** Get human-readable description for an event */
export function getEventDescription(event) {
  const descFn = EventDescriptions[event.type];
  if (descFn) {
    try { return descFn(event); }
    catch { return event.type.replace(/_/g, ' ').toLowerCase(); }
  }
  return event.type.replace(/_/g, ' ').toLowerCase();
}

/** Get icon class for event type */
export function getEventIcon(eventType) {
  const icons = {
    [EventTypes.USER_LOGGED_IN]: 'fa-sign-in-alt',
    [EventTypes.USER_LOGGED_OUT]: 'fa-sign-out-alt',
    [EventTypes.PATIENT_REGISTERED]: 'fa-user-plus',
    [EventTypes.APPOINTMENT_BOOKED]: 'fa-calendar-check',
    [EventTypes.PATIENT_CHECKED_IN]: 'fa-qrcode',
    [EventTypes.QUEUE_ENTRY_CREATED]: 'fa-list-ol',
    [EventTypes.PATIENT_CALLED]: 'fa-bullhorn',
    [EventTypes.CONSULTATION_STARTED]: 'fa-stethoscope',
    [EventTypes.CONSULTATION_COMPLETED]: 'fa-check-circle',
    [EventTypes.EMERGENCY_PATIENT_INSERTED]: 'fa-exclamation-triangle',
    [EventTypes.DOCTOR_AVAILABILITY_CHANGED]: 'fa-user-md',
    [EventTypes.PATIENT_TRANSFERRED]: 'fa-exchange-alt',
    [EventTypes.PATIENT_REDISTRIBUTED]: 'fa-random',
    [EventTypes.BLOOD_REQUEST_CREATED]: 'fa-tint',
    [EventTypes.BLOOD_REQUEST_CRITICAL]: 'fa-ambulance',
    [EventTypes.BLOOD_SOURCE_MATCHED]: 'fa-search-location',
    [EventTypes.BLOOD_UNITS_RESERVED]: 'fa-box',
    [EventTypes.BLOOD_CONFIRMED_BY_BANK]: 'fa-check-double',
    [EventTypes.BLOOD_READY_FOR_ISSUE]: 'fa-hand-holding-medical',
    [EventTypes.BLOOD_UNITS_ISSUED]: 'fa-share-square',
    [EventTypes.DISCHARGE_PLAN_CREATED]: 'fa-file-medical',
    [EventTypes.CARE_PLAN_UPDATED]: 'fa-notes-medical',
    [EventTypes.WARNING_SIGN_REPORTED]: 'fa-flag',
    [EventTypes.POST_DISCHARGE_REPORT_CREATED]: 'fa-headset',
    [EventTypes.POST_DISCHARGE_REPORT_ASSIGNED]: 'fa-user-check',
    [EventTypes.CARE_REENTRY_REQUESTED]: 'fa-redo',
    [EventTypes.AMBULANCE_REQUEST_CREATED]: 'fa-truck-medical',
    [EventTypes.AMBULANCE_DISPATCHED]: 'fa-ambulance',
    [EventTypes.AMBULANCE_ARRIVED]: 'fa-hospital-user',
    [EventTypes.DOCTOR_DIVERTED_TO_EMERGENCY]: 'fa-user-shield',
    [EventTypes.QUEUE_RECOVERY_STARTED]: 'fa-heartbeat',
    [EventTypes.QUEUE_RECOVERY_COMPLETED]: 'fa-smile',
    [EventTypes.DEMO_SIMULATION_STARTED]: 'fa-play-circle',
    [EventTypes.DEMO_STAGE_CHANGED]: 'fa-forward',
    [EventTypes.DEMO_SIMULATION_COMPLETED]: 'fa-award'
  };
  return icons[eventType] || 'fa-info-circle';
}

/** Get semantic color class for event type */
export function getEventColor(eventType) {
  if (eventType.includes('EMERGENCY') || eventType.includes('CRITICAL')) return 'red';
  if (eventType.includes('WARNING') || eventType.includes('CONGESTION') || eventType.includes('CALLED')) return 'orange';
  if (eventType.includes('COMPLETED') || eventType.includes('RECOVER') || eventType.includes('CONFIRMED')) return 'green';
  if (eventType.includes('BLOOD') || eventType.includes('DISCHARGE') || eventType.includes('CARE')) return 'teal';
  return 'blue';
}

// Global Singleton Event Bus Instance
const eventBus = new EventBus();
export default eventBus;
