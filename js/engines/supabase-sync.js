// ============================================
// HospitalFlow AI — Supabase Realtime Sync Engine
// Cross-Device Operational Synchronization across Multiple Laptops / Sessions
// ============================================

import Config from '../config.js';
import appState from '../state.js';
import eventBus, { EventTypes } from '../events.js';
import { generateId } from '../utils.js';

class SupabaseSyncEngine {
  constructor() {
    this.supabase = null;
    this.channel = null;
    this.clientId = generateId('client');
    this.isConnected = false;
    this.processedEventIds = new Set();
    this.eventTtlMs = 60000; // 60 seconds dedupe TTL
    this.retryTimer = null;
  }

  /**
   * Initialize Supabase Realtime Client & Subscriptions
   */
  async init() {
    if (!window.supabase) {
      console.warn('[SupabaseSync] window.supabase is not loaded from CDN.');
      return;
    }

    try {
      this.supabase = window.supabase.createClient(Config.SUPABASE_URL, Config.SUPABASE_ANON_KEY, {
        realtime: {
          params: {
            eventsPerSecond: 10
          }
        }
      });

      this._subscribeChannel();
      this._wireLocalEventBus();
      console.log(`%c [SupabaseSync] Initialized Realtime Client (${this.clientId}) `, 'background: #059669; color: white; padding: 2px 8px; border-radius: 4px;');
    } catch (err) {
      console.error('[SupabaseSync] Initialization error:', err);
    }
  }

  /**
   * Subscribe to the Shared Realtime Broadcast Channel & Database Tables
   */
  _subscribeChannel() {
    if (!this.supabase) return;

    // 1. Broadcast Channel for Instant Cross-Device Event Propagation
    this.channel = this.supabase.channel('hfai-realtime-sync', {
      config: {
        broadcast: { ack: true, self: false } // don't receive own broadcasts
      }
    });

    this.channel
      .on('broadcast', { event: 'hfai_domain_event' }, ({ payload }) => {
        this._handleIncomingBroadcast(payload);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.isConnected = true;
          console.log('[SupabaseSync] Connected to Realtime channel: hfai-realtime-sync');
          // Update global state indicator
          appState.update({ isRealtimeConnected: true });
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          this.isConnected = false;
          appState.update({ isRealtimeConnected: false });
          console.warn('[SupabaseSync] Realtime channel disconnected. Will attempt reconnect...');
          this._scheduleReconnect();
        }
      });
  }

  _scheduleReconnect() {
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (!this.isConnected && this.supabase) {
        this._subscribeChannel();
      }
    }, 5000);
  }

  /**
   * Broadcast an event to all other connected laptops/browser sessions
   * @param {string} type - Event Type
   * @param {Object} payload - Event Payload
   * @param {Object} meta - Event Metadata
   */
  broadcastEvent(type, payload = {}, meta = {}) {
    const eventId = meta.eventId || generateId('evt');
    const senderRole = meta.role || appState.get().currentRole || 'system';
    const senderUserId = meta.userId || appState.get().currentUser?.id || null;

    // Track own event to prevent reprocessing
    this._trackEventId(eventId);

    const broadcastMessage = {
      eventId,
      senderClientId: this.clientId,
      senderRole,
      senderUserId,
      type,
      payload,
      timestamp: new Date().toISOString()
    };

    if (this.channel && this.isConnected) {
      this.channel.send({
        type: 'broadcast',
        event: 'hfai_domain_event',
        payload: broadcastMessage
      }).catch(err => {
        console.warn('[SupabaseSync] Broadcast send failed:', err.message);
      });
    }

    // Also persist critical audit event to Supabase if client is ready
    this._persistAuditEvent(broadcastMessage);
  }

  /**
   * Handle incoming broadcast from another device
   */
  _handleIncomingBroadcast(message) {
    if (!message || !message.type || !message.eventId) return;

    // Ignore messages from self
    if (message.senderClientId === this.clientId) return;

    // Deduplication check
    if (this.processedEventIds.has(message.eventId)) {
      return;
    }
    this._trackEventId(message.eventId);

    console.log(`%c [SupabaseSync] Received Cross-Device Event: ${message.type} `, 'background: #2563EB; color: white; padding: 2px 6px; border-radius: 4px;', message.payload);

    // 1. Sync State Changes to Local appState
    this._syncLocalStateFromEvent(message.type, message.payload);

    // 2. Emit to local EventBus so UI views and audio chimes trigger without page reload
    eventBus.emit(message.type, message.payload, {
      source: 'supabase-realtime',
      role: message.senderRole,
      userId: message.senderUserId,
      eventId: message.eventId,
      isRemote: true
    });
  }

  /**
   * Safely reconcile local state according to incoming domain event
   */
  _syncLocalStateFromEvent(type, payload) {
    const s = appState.get();

    switch (type) {
      case EventTypes.EMERGENCY_CASE_CREATED:
      case EventTypes.EMERGENCY_PREARRIVAL_CREATED: {
        const existing = (s.emergencyCases || []).find(c => c.caseId === payload.caseId || c.id === payload.caseId);
        if (!existing) {
          const newCase = {
            id: payload.caseId || generateId('EM'),
            caseId: payload.caseId || `E-${Date.now().toString().slice(-4)}`,
            patientId: payload.patientId || `P-${Date.now().toString().slice(-4)}`,
            patientName: payload.patientName || 'Emergency Patient',
            priority: payload.priority || 'P1 - Critical Emergency',
            department: payload.department || 'General Medicine',
            symptoms: payload.symptoms || payload.reportedSymptoms || 'Acute emergency symptoms',
            transportMode: payload.transportMode || 'Private Vehicle',
            etaMinutes: payload.etaMinutes || payload.estimatedArrivalMinutes || 7,
            status: payload.status || 'AWAITING_DOCTOR',
            doctorId: payload.doctorId || null,
            doctorName: payload.doctorName || null,
            createdAt: payload.createdAt || new Date().toISOString()
          };
          appState.addItem('emergencyCases', newCase);
        }
        break;
      }

      case EventTypes.EMERGENCY_CASE_ASSIGNED:
      case 'EMERGENCY_DOCTOR_ASSIGNED': {
        const caseId = payload.caseId || payload.id;
        const doctorId = payload.doctorId;
        const doctorName = payload.doctorName;

        // Update emergency case
        const emCase = (s.emergencyCases || []).find(c => c.caseId === caseId || c.id === caseId);
        if (emCase) {
          appState.updateItem('emergencyCases', emCase.id, {
            doctorId,
            doctorName,
            status: 'EMERGENCY_ASSIGNED',
            assignedAt: new Date().toISOString()
          });
        }

        // Update doctor status
        if (doctorId) {
          appState.updateItem('doctors', doctorId, {
            status: 'EMERGENCY_ASSIGNED',
            currentEmergencyCaseId: caseId
          });
        }
        break;
      }

      case EventTypes.EMERGENCY_CASE_STARTED: {
        const caseId = payload.caseId;
        const emCase = (s.emergencyCases || []).find(c => c.caseId === caseId || c.id === caseId);
        if (emCase) {
          appState.updateItem('emergencyCases', emCase.id, {
            status: 'EMERGENCY_ACTIVE',
            startedAt: new Date().toISOString()
          });
        }
        if (emCase?.doctorId) {
          appState.updateItem('doctors', emCase.doctorId, {
            status: 'EMERGENCY_ACTIVE'
          });
        }
        break;
      }

      case EventTypes.EMERGENCY_CASE_COMPLETED: {
        const caseId = payload.caseId;
        const emCase = (s.emergencyCases || []).find(c => c.caseId === caseId || c.id === caseId);
        if (emCase) {
          appState.updateItem('emergencyCases', emCase.id, {
            status: 'COMPLETED',
            completedAt: new Date().toISOString()
          });
        }
        if (payload.doctorId || emCase?.doctorId) {
          const docId = payload.doctorId || emCase.doctorId;
          appState.updateItem('doctors', docId, {
            status: 'Available',
            currentEmergencyCaseId: null
          });
        }
        break;
      }

      case EventTypes.BLOOD_REQUEST_CREATED:
      case EventTypes.BLOOD_REQUEST_CRITICAL: {
        const existing = (s.bloodRequests || []).find(b => b.id === payload.id || b.id === payload.requestId);
        if (!existing) {
          const newReq = {
            id: payload.id || payload.requestId || generateId('BR'),
            patientId: payload.patientId || 'P-1084',
            bloodGroup: payload.bloodGroup || 'O-',
            units: payload.units || 2,
            urgency: payload.urgency || 'Emergency',
            department: payload.department || 'General Medicine',
            requestingHospital: 'HospitalFlow Central Hospital',
            status: payload.status || 'Created',
            createdAt: payload.createdAt || new Date().toISOString()
          };
          appState.addItem('bloodRequests', newReq);
        }
        break;
      }

      case EventTypes.BLOOD_UNITS_RESERVED: {
        const reqId = payload.requestId || payload.id;
        const req = (s.bloodRequests || []).find(b => b.id === reqId);
        if (req) {
          appState.updateItem('bloodRequests', req.id, {
            status: 'Reserved',
            matchedFacilityId: payload.facilityId || 'FAC-001',
            reservedUnits: payload.units || req.units
          });
        }
        // Update blood inventory reserved units
        if (payload.bloodGroup) {
          const invItem = (s.bloodInventory || []).find(b => b.bloodGroup === payload.bloodGroup);
          if (invItem) {
            const newAvail = Math.max(0, (invItem.available || invItem.units) - (payload.units || 1));
            const newRes = (invItem.reservedUnits || 0) + (payload.units || 1);
            appState.updateItem('bloodInventory', invItem.id, {
              available: newAvail,
              reservedUnits: newRes
            });
          }
        }
        break;
      }

      case EventTypes.QUEUE_ENTRY_CREATED:
      case EventTypes.PATIENT_CHECKED_IN: {
        if (payload.queueEntry) {
          const existing = (s.queueEntries || []).find(q => q.id === payload.queueEntry.id);
          if (!existing) {
            appState.addItem('queueEntries', payload.queueEntry);
          }
        }
        break;
      }

      case EventTypes.CONSULTATION_STARTED:
      case EventTypes.PATIENT_CALLED:
      case EventTypes.CONSULTATION_COMPLETED: {
        if (payload.queueEntryId) {
          const q = (s.queueEntries || []).find(qe => qe.id === payload.queueEntryId);
          if (q) {
            appState.updateItem('queueEntries', q.id, {
              status: payload.status || (type === EventTypes.CONSULTATION_COMPLETED ? 'Completed' : type === EventTypes.CONSULTATION_STARTED ? 'Consulting' : 'Called')
            });
          }
        }
        break;
      }

      case EventTypes.FLOW_INTERVENTION_APPLIED: {
        if (payload.department && payload.recoveryState) {
          const recState = s.flowRecoveryState || {};
          recState[payload.department] = payload.recoveryState;
          appState.update({ flowRecoveryState: { ...recState } });
        }
        break;
      }
    }

    // Always recalculate dashboard metrics on remote sync
    appState.recalculateDashboard();
  }

  /**
   * Listen to outgoing local eventBus emissions and automatically broadcast them
   */
  _wireLocalEventBus() {
    const broadcastEventTypes = [
      EventTypes.USER_LOGGED_IN,
      EventTypes.USER_REGISTERED,
      EventTypes.EMERGENCY_CASE_CREATED,
      EventTypes.EMERGENCY_PREARRIVAL_CREATED,
      EventTypes.EMERGENCY_CASE_ASSIGNED,
      'EMERGENCY_DOCTOR_ASSIGNED',
      EventTypes.EMERGENCY_CASE_STARTED,
      EventTypes.EMERGENCY_CASE_COMPLETED,
      EventTypes.BLOOD_REQUEST_CREATED,
      EventTypes.BLOOD_REQUEST_CRITICAL,
      EventTypes.BLOOD_UNITS_RESERVED,
      EventTypes.BLOOD_CONFIRMED_BY_BANK,
      EventTypes.PATIENT_CHECKED_IN,
      EventTypes.APPOINTMENT_BOOKED,
      EventTypes.QUEUE_ENTRY_CREATED,
      EventTypes.PATIENT_CALLED,
      EventTypes.CONSULTATION_STARTED,
      EventTypes.CONSULTATION_COMPLETED,
      EventTypes.CARE_PLAN_CREATED,
      EventTypes.AMBULANCE_REQUEST_CREATED,
      EventTypes.AMBULANCE_DISPATCHED,
      EventTypes.AMBULANCE_ARRIVED,
      EventTypes.FLOW_INTERVENTION_APPLIED
    ];

    broadcastEventTypes.forEach(evtType => {
      eventBus.on(evtType, (event) => {
        // Automatically persist to Supabase tables
        this._persistToDatabase(evtType, event.payload, event);

        // Do not re-broadcast events that originated from remote Realtime sync
        if (event.isRemote || event.source === 'supabase-realtime') return;

        this.broadcastEvent(evtType, event.payload, {
          eventId: event.id,
          role: event.role,
          userId: event.userId
        });
      });
    });
  }

  /**
   * Smooth database sync across Supabase tables
   */
  async _persistToDatabase(type, payload = {}, event = {}) {
    if (!this.supabase) return;

    try {
      // 1. User Logins & Registrations -> public.users
      if (type === EventTypes.USER_LOGGED_IN || type === EventTypes.USER_REGISTERED) {
        const user = payload.user || payload;
        if (user && user.email) {
          const cleanEmail = user.email.toLowerCase().trim();
          await this.supabase.from('users').upsert({
            id: user.id || generateId('u'),
            email: cleanEmail,
            display_name: user.displayName || user.name || cleanEmail.split('@')[0],
            role: user.role || 'patient',
            department: user.department || null,
            phone: user.phone || '+91 9800000000',
            account_status: 'active'
          }, { onConflict: 'email' }).catch(err => {
            console.warn('[SupabaseSync] users table upsert notice:', err?.message);
          });
        }
      }

      // 2. Appointments -> public.appointments
      if (type === EventTypes.APPOINTMENT_BOOKED || payload.appointmentId) {
        const aptId = payload.id || payload.appointmentId || generateId('APT');
        await this.supabase.from('appointments').upsert({
          id: aptId,
          patient_id: payload.patientId || 'P-1001',
          doctor_id: payload.doctorId || 'D0001',
          department: payload.department || 'General Medicine',
          scheduled_time: payload.scheduledTime || new Date().toISOString(),
          symptom_original_text: payload.symptoms || payload.symptom_original_text || '',
          symptom_detected_language: payload.detectedLanguage || 'en',
          normalized_symptoms: payload.normalizedSymptoms || [],
          status: payload.status || 'Scheduled'
        }, { onConflict: 'id' }).catch(err => {
          console.warn('[SupabaseSync] appointments table upsert notice:', err?.message);
        });
      }

      // 3. Care Plans -> public.discharge_plans
      if (type === EventTypes.CARE_PLAN_CREATED || payload.planId) {
        await this.supabase.from('discharge_plans').upsert({
          id: payload.planId || payload.id || generateId('DP'),
          patient_id: payload.patientId || 'P-1001',
          approved_by: payload.doctorId || payload.approvedBy || 'D0001',
          discharge_date: new Date().toISOString(),
          medications: payload.medications || [],
          instructions: payload.instructions || payload.dietPlan || '',
          language: payload.language || 'English',
          active: true
        }, { onConflict: 'id' }).catch(err => {
          console.warn('[SupabaseSync] discharge_plans table upsert notice:', err?.message);
        });
      }
    } catch (e) {
      // Non-blocking graceful catch
    }
  }

  /**
   * Save audit event to Supabase table public.audit_events (if table exists and connected)
   */
  async _persistAuditEvent(msg) {
    if (!this.supabase) return;
    try {
      await this.supabase.from('audit_events').insert({
        id: msg.eventId,
        event_type: msg.type,
        timestamp: msg.timestamp,
        payload: msg.payload,
        source: msg.senderRole,
        user_id: msg.senderUserId,
        entity_id: msg.payload?.caseId || msg.payload?.patientId || msg.payload?.id || null
      }).catch(() => {});
    } catch {
      // Non-blocking catch for standalone mode
    }
  }

  _trackEventId(id) {
    this.processedEventIds.add(id);
    setTimeout(() => {
      this.processedEventIds.delete(id);
    }, this.eventTtlMs);
  }
}

const SupabaseSync = new SupabaseSyncEngine();
export default SupabaseSync;
