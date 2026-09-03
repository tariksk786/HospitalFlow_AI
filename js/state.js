// ============================================
// HospitalFlow AI — Central Application State
// Single Operational Source of Truth
// ============================================

import Config from './config.js';
import Storage from './storage.js';
import eventBus, { EventTypes } from './events.js';
import { deepClone, formatMinutes } from './utils.js';

/** Default empty state shape */
function createEmptyState() {
  return {
    currentUser: null,
    currentRole: null,
    isDemo: Config.IS_DEMO,
    patients: [],
    doctors: [],
    departments: Config.DEPARTMENTS.map(name => ({ name, active: true })),
    appointments: [],
    queueEntries: [],
    bloodInventory: [],
    bloodRequests: [],
    facilities: [],
    donors: [],
    dischargePlans: [],
    reminders: [],
    followUps: [],
    notifications: [],
    ambulances: [],
    ambulanceRequests: [],
    emergencyCases: [],
    emergencyAlerts: [],
    careReentryRequests: [],
    warningReports: [],
    postDischargeReports: [],
    flowRecoveryState: {
      status: 'NORMALIZED',
      recoveryPercentage: 94,
      baselineWait: 18,
      peakWait: 18,
      currentWait: 18
    },
    impactMetrics: {
      beforeWait: 18,
      emergencyPeakWait: 31,
      afterInterventionWait: 23,
      delayAvoidedMinutes: 8,
      patientsAffected: 11,
      patientsRedistributed: 3,
      emergenciesCoordinated: 2,
      criticalBloodRequests: 1,
      flowRecoveryPercentage: 94
    },
    simulationScenarios: [],
    consultationStats: {
      totalToday: 12,
      avgDuration: 12,
      completed: 12
    },
    dashboardAnalytics: {
      totalActivePatients: 0,
      avgOPDWait: 18,
      criticalBloodAlerts: 0,
      todaysDischarges: 4
    }
  };
}

class AppState {
  constructor() {
    this.state = createEmptyState();
    this._subscribers = new Set();
    this._baselineSnapshot = null;
  }

  /** Get the current operational state */
  get() {
    return this.state;
  }

  /** Get a specific key from state */
  getKey(key) {
    return this.state[key];
  }

  /** Initialize state and preserve snapshot */
  initialize(newState) {
    this.state = { ...createEmptyState(), ...newState };
    this._recalculateDerivedMetrics();
    this._baselineSnapshot = deepClone(this.state);
    this._notifySubscribers();
  }

  /** Reset state deterministically to baseline demo state */
  resetToBaseline() {
    if (this._baselineSnapshot) {
      this.state = deepClone(this._baselineSnapshot);
      this._recalculateDerivedMetrics();
      this._notifySubscribers();
      this._persist();
      eventBus.emit(EventTypes.DEMO_STATE_RESET, {});
    }
  }

  /** Update one or more keys in state */
  update(partial) {
    Object.assign(this.state, partial);
    this._recalculateDerivedMetrics();
    this._notifySubscribers();
    this._persist();
    eventBus.emit(EventTypes.STATE_UPDATED, { keys: Object.keys(partial) });
  }

  /** Set a specific key */
  set(key, value) {
    this.state[key] = value;
    this._recalculateDerivedMetrics();
    this._notifySubscribers();
    this._persist();
    eventBus.emit(EventTypes.STATE_UPDATED, { key });
  }

  /** Find an item in a collection by ID */
  findById(collectionKey, id) {
    const collection = this.state[collectionKey];
    if (!Array.isArray(collection)) return null;
    return collection.find(item => item.id === id || item.userId === id || item.requestId === id || item.caseId === id) || null;
  }

  /** Add an item to a collection */
  addItem(collectionKey, item) {
    if (!Array.isArray(this.state[collectionKey])) return;
    this.state[collectionKey].push(item);
    this._recalculateDerivedMetrics();
    this._notifySubscribers();
    this._persist();
    eventBus.emit(EventTypes.STATE_UPDATED, { collection: collectionKey, action: 'add', item });
    return item;
  }

  /** Update an item in a collection by ID */
  updateItem(collectionKey, id, updates) {
    const collection = this.state[collectionKey];
    if (!Array.isArray(collection)) return;
    const index = collection.findIndex(item => item.id === id || item.requestId === id || item.caseId === id || item.ambulanceId === id);
    if (index !== -1) {
      collection[index] = { ...collection[index], ...updates };
      this._recalculateDerivedMetrics();
      this._notifySubscribers();
      this._persist();
      eventBus.emit(EventTypes.STATE_UPDATED, { collection: collectionKey, action: 'update', id, updates });
      return collection[index];
    }
    return null;
  }

  /** Remove an item from a collection */
  removeItem(collectionKey, id) {
    const collection = this.state[collectionKey];
    if (!Array.isArray(collection)) return;
    const index = collection.findIndex(item => item.id === id || item.requestId === id || item.caseId === id);
    if (index !== -1) {
      const removed = collection.splice(index, 1)[0];
      this._recalculateDerivedMetrics();
      this._notifySubscribers();
      this._persist();
      eventBus.emit(EventTypes.STATE_UPDATED, { collection: collectionKey, action: 'remove', id });
      return removed;
    }
    return null;
  }

  // ---- Derived Selectors (Single Source of Truth) ----

  /**
   * Derive Patient's Lifecycle Journey State
   * Values: 'Scheduled' | 'Arriving' | 'Checked In' | 'Waiting' | 'Called' | 'Consulting' | 'Emergency' | 'Discharged' | 'Care at Home' | 'Needs Review'
   */
  getPatientJourneyState(patientId) {
    const s = this.state;

    // 1. Emergency active override
    const emergency = (s.emergencyCases || []).find(c => c.patientId === patientId && c.status !== 'COMPLETED');
    if (emergency) return { status: 'P1 Emergency', variant: 'danger', icon: 'fa-exclamation-triangle', isEmergency: true };

    // 2. Post-discharge problem reported
    const warning = (s.postDischargeReports || []).find(r => r.patientId === patientId && r.status === 'Needs Review') ||
                    (s.warningReports || []).find(w => w.patientId === patientId && w.status === 'Open');
    if (warning) return { status: 'Needs Review', variant: 'warning', icon: 'fa-flag', isWarning: true };

    // 3. In-Queue / Consultation state
    const queue = (s.queueEntries || []).find(q => q.patientId === patientId && ['Waiting', 'Called', 'Consulting'].includes(q.status));
    if (queue) {
      if (queue.status === 'Consulting') return { status: 'Consulting', variant: 'primary', icon: 'fa-stethoscope' };
      if (queue.status === 'Called') return { status: 'Called', variant: 'warning', icon: 'fa-bullhorn' };
      return { status: 'Waiting', variant: 'info', icon: 'fa-user-clock' };
    }

    // 4. Scheduled appointment
    const apt = (s.appointments || []).find(a => a.patientId === patientId && a.status === 'Scheduled');
    if (apt) {
      return { status: 'Scheduled', variant: 'neutral', icon: 'fa-calendar-check' };
    }

    // 5. Active Discharge Plan / Care at Home
    const carePlan = (s.dischargePlans || []).find(dp => dp.patientId === patientId && dp.active);
    if (carePlan) return { status: 'Care at Home', variant: 'success', icon: 'fa-heartbeat' };

    // 6. Completed
    const completedApt = (s.appointments || []).find(a => a.patientId === patientId && a.status === 'Completed');
    if (completedApt) return { status: 'Discharged', variant: 'success', icon: 'fa-check-circle' };

    return { status: 'Registered', variant: 'neutral', icon: 'fa-user' };
  }

  /**
   * Derive Doctor's Live Operational Workload & State
   */
  getDoctorOperationalState(doctorId) {
    const s = this.state;
    const doc = s.doctors.find(d => d.id === doctorId);
    if (!doc) return null;

    const assignedEmergency = (s.emergencyCases || []).find(c => c.doctorId === doctorId && c.status !== 'COMPLETED');
    const myQueue = (s.queueEntries || []).filter(q => q.doctorId === doctorId && ['Waiting', 'Called', 'Consulting'].includes(q.status));
    const consultingEntry = myQueue.find(q => q.status === 'Consulting');
    const waitingQueue = myQueue.filter(q => q.status === 'Waiting');
    const currentPatient = consultingEntry ? s.patients.find(p => p.id === consultingEntry.patientId) : null;
    const nextQueue = waitingQueue[0] ? s.patients.find(p => p.id === waitingQueue[0].patientId) : null;

    let operationalStatus = doc.status || 'Available';
    if (assignedEmergency) {
      operationalStatus = doc.status === 'EMERGENCY_ACTIVE' ? 'Emergency Active' : 'Emergency Assigned';
    } else if (consultingEntry) {
      operationalStatus = 'Consulting';
    }

    const loadPercentage = Math.min(100, Math.round((myQueue.length / 6) * 100));

    return {
      doctor: doc,
      operationalStatus,
      statusVariant: assignedEmergency ? 'danger' : consultingEntry ? 'primary' : doc.status === 'Available' ? 'success' : 'warning',
      currentPatient,
      consultingEntry,
      waitingCount: waitingQueue.length,
      nextPatient: nextQueue,
      loadPercentage,
      loadVariant: loadPercentage > 75 ? 'red' : loadPercentage > 45 ? 'orange' : 'blue',
      emergencyCase: assignedEmergency,
      completedToday: doc.completedToday || 4,
      avgConsultation: doc.averageConsultationMinutes || 12
    };
  }

  /**
   * Get Live Operations Feed from Domain Event Bus
   */
  getLiveOperationsFeed(limit = 10) {
    return eventBus.getRecentActivity(limit);
  }

  /**
   * Public alias to recalculate dashboard analytics
   */
  recalculateDashboard() {
    this._recalculateDerivedMetrics();
    this._notifySubscribers();
  }

  /** Recalculate derived dashboard and department load stats */
  _recalculateDerivedMetrics() {
    const s = this.state;

    // 1. Active waiting and consulting patients
    const activeEntries = (s.queueEntries || []).filter(q => ['Waiting', 'Called', 'Consulting'].includes(q.status));
    const waitingEntries = (s.queueEntries || []).filter(q => q.status === 'Waiting');

    // 2. Average wait time
    let totalWait = 0;
    waitingEntries.forEach(q => { totalWait += (q.estimatedWait || 0); });
    const avgWait = waitingEntries.length > 0 ? Math.round(totalWait / waitingEntries.length) : 18;

    // 3. Critical blood alerts
    const bloodSummary = this.getBloodSummary();
    const criticalBloodCount = bloodSummary.filter(b => b.status === 'Critical').length;

    // 4. Update dashboardAnalytics
    s.dashboardAnalytics = {
      totalActivePatients: activeEntries.length + (s.emergencyCases || []).filter(c => c.status !== 'COMPLETED').length,
      avgOPDWait: avgWait,
      criticalBloodAlerts: criticalBloodCount,
      todaysDischarges: (s.dischargePlans || []).filter(dp => dp.active).length
    };
  }

  /** Get aggregated blood summary by group */
  getBloodSummary() {
    const s = this.state;
    const groups = Config.BLOOD_GROUPS;
    return groups.map(bg => {
      const units = s.bloodInventory.filter(u => u.bloodGroup === bg && u.status === 'Available');
      const reserved = s.bloodInventory.filter(u => u.bloodGroup === bg && u.status === 'Reserved');
      const count = units.length;
      let status = 'Adequate';
      if (count <= Config.BLOOD_THRESHOLDS.CRITICAL) status = 'Critical';
      else if (count <= Config.BLOOD_THRESHOLDS.LOW) status = 'Low';

      return {
        bloodGroup: bg,
        available: count,
        reservedUnits: reserved.length,
        totalUnits: count + reserved.length,
        status
      };
    });
  }

  /** Get department loads */
  getDepartmentLoads() {
    const s = this.state;
    return Config.DEPARTMENTS.map(dept => {
      const deptDocs = s.doctors.filter(d => d.department === dept);
      const availableDocs = deptDocs.filter(d => d.status === 'Available');
      const deptQueue = s.queueEntries.filter(q => q.department === dept && q.status === 'Waiting');
      let totalWait = 0;
      deptQueue.forEach(q => { totalWait += (q.estimatedWait || 0); });
      const avgWait = deptQueue.length > 0 ? Math.round(totalWait / deptQueue.length) : 15;

      return {
        department: dept,
        totalDoctors: deptDocs.length,
        availableDoctors: availableDocs.length,
        waiting: deptQueue.length,
        avgWait
      };
    });
  }

  /** Subscribe to state changes */
  subscribe(callback) {
    this._subscribers.add(callback);
    return () => this._subscribers.delete(callback);
  }

  _notifySubscribers() {
    this._subscribers.forEach(cb => {
      try { cb(this.state); }
      catch (err) { console.error('AppState subscriber error:', err); }
    });
  }

  _persist() {
    if (Config.IS_DEMO) {
      Storage.saveAll(this.state);
    }
  }
}

const appState = new AppState();
export default appState;
