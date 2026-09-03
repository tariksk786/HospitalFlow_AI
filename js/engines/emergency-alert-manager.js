// ============================================
// HospitalFlow AI — Central Emergency Alert Manager
// Event-Specific Chimes + Speech Synthesis + Role-Scoped Routing
// ============================================

import appState from '../state.js';
import eventBus, { EventTypes } from '../events.js';
import { generateId, escapeHtml, timeAgo } from '../utils.js';

class EmergencyAlertManager {
  constructor() {
    this.audioContext = null;
    this.audioInitialized = false;
    this.escalationTimers = new Map();
    this.escalationThresholdMs = 30000; // 30 seconds

    this._initListeners();
    this._bindAudioInitializer();
  }

  /**
   * Bind user interaction to initialize AudioContext & SpeechSynthesis
   */
  _bindAudioInitializer() {
    const unlockAudio = () => {
      if (!this.audioContext) {
        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            this.audioContext = new AudioContextClass();
            if (this.audioContext.state === 'suspended') {
              this.audioContext.resume();
            }
            this.audioInitialized = true;
          }
        } catch (e) {
          console.warn('Web Audio initialization note:', e.message);
        }
      }
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
    };

    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('keydown', unlockAudio, { once: true });
  }

  /**
   * 1. Critical Emergency Tone (Urgent 1.5s harmonic chime)
   */
  playEmergencyChime(priority = 'P1') {
    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.audioContext = new AudioCtx();
      }
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      if (!this.audioContext) return;

      const now = this.audioContext.currentTime;
      const osc1 = this.audioContext.createOscillator();
      const osc2 = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.18);
      osc1.frequency.setValueAtTime(880, now + 0.4);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(440, now);
      osc2.frequency.exponentialRampToValueAtTime(660, now + 0.18);
      osc2.frequency.setValueAtTime(440, now + 0.4);

      gainNode.gain.setValueAtTime(0.01, now);
      gainNode.gain.linearRampToValueAtTime(0.2, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.2);
      osc2.stop(now + 1.2);
    } catch (e) {
      console.warn('Audio chime note:', e.message);
    }
  }

  /**
   * 2. Ambulance Dispatch Tone (1.4s alert chime)
   */
  playAmbulanceChime() {
    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.audioContext = new AudioCtx();
      }
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      if (!this.audioContext) return;

      const now = this.audioContext.currentTime;
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880.00, now + 0.2); // A5
      osc.frequency.setValueAtTime(1174.66, now + 0.4); // D6

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);

      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      osc.start(now);
      osc.stop(now + 1.1);
    } catch (e) {
      console.warn('Ambulance chime note:', e.message);
    }
  }

  /**
   * 3. Critical Blood Request Tone (1.0s distinctive bell)
   */
  playCriticalBloodChime() {
    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.audioContext = new AudioCtx();
      }
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      if (!this.audioContext) return;

      const now = this.audioContext.currentTime;
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.50, now); // C6
      osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.5); // C5

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      osc.start(now);
      osc.stop(now + 0.9);
    } catch (e) {
      console.warn('Blood chime note:', e.message);
    }
  }

  /**
   * Voice Alert using Web Speech API (Clean, professional, non-repeating)
   */
  speakAlert(text) {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel(); // Cancel any existing queue
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        utterance.lang = 'en-US';
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('Speech synthesis note:', e.message);
      }
    }
  }

  /**
   * Domain Event Subscriptions
   */
  _initListeners() {
    // 1. Ambulance request submitted by patient -> Alert Admin
    eventBus.on(EventTypes.AMBULANCE_REQUEST_CREATED, (event) => {
      const payload = event.payload;
      const alert = this.createAlert({
        targetRole: 'admin',
        title: `Ambulance Request: ${payload.patientName || payload.patientId}`,
        message: `Pickup: ${payload.pickupLocation} · Severity: ${payload.severity || 'Critical'}`,
        severity: 'CRITICAL',
        priority: 'P1',
        category: 'ambulance',
        metadata: {
          requestId: payload.requestId,
          pickupLocation: payload.pickupLocation,
          symptoms: payload.symptoms
        }
      });

      // Sound + Voice announcement for Admin
      this.playAmbulanceChime();
      setTimeout(() => {
        this.speakAlert('Emergency ambulance request received. Immediate dispatch attention required.');
      }, 400);
    });

    // 2. Doctor assigned to emergency -> Alert Doctor & Admin
    eventBus.on(EventTypes.EMERGENCY_CASE_ASSIGNED, (event) => {
      const payload = event.payload;
      this.createAlert({
        targetRole: 'doctor',
        targetUserId: payload.doctorId,
        title: `🚨 Assigned Emergency: ${payload.patientName}`,
        message: `Priority P1 emergency assigned in ${payload.department}. Room preparation required.`,
        severity: 'CRITICAL',
        priority: 'P1',
        category: 'doctor_assignment',
        metadata: { caseId: payload.caseId, patientId: payload.patientId }
      });

      // Doctor audio + speech
      const user = appState.get().currentUser;
      if (user && user.role === 'doctor' && (user.doctorId === payload.doctorId || !payload.doctorId)) {
        this.playEmergencyChime('P1');
        setTimeout(() => {
          this.speakAlert('Critical emergency patient assigned.');
        }, 400);
      }
    });

    // 3. Critical Emergency Case Created -> Alert Admin
    eventBus.on(EventTypes.EMERGENCY_CASE_CREATED, (event) => {
      const payload = event.payload;
      this.createAlert({
        targetRole: 'admin',
        title: `Critical Emergency Case: ${payload.patientName}`,
        message: `${payload.department} · Symptoms: ${payload.symptoms}`,
        severity: 'CRITICAL',
        priority: 'P1',
        category: 'emergency_intake',
        metadata: { caseId: payload.caseId }
      });

      this.playEmergencyChime('P1');
      setTimeout(() => {
        this.speakAlert('Critical emergency case detected. Immediate attention required.');
      }, 400);
    });

    // 4. Critical Blood Request Created -> Alert Admin
    eventBus.on(EventTypes.BLOOD_REQUEST_CRITICAL, (event) => {
      const payload = event.payload;
      this.createAlert({
        targetRole: 'admin',
        title: `Critical Blood Request: ${payload.units} Units ${payload.bloodGroup}`,
        message: `Emergency blood urgently requested for patient ${payload.patientId} in ${payload.department}`,
        severity: 'CRITICAL',
        priority: 'P1',
        category: 'blood',
        metadata: { requestId: payload.requestId, bloodGroup: payload.bloodGroup }
      });

      this.playCriticalBloodChime();
      setTimeout(() => {
        this.speakAlert('Critical blood request requires attention.');
      }, 400);
    });

    // 5. Post-discharge problem reported by patient -> Alert Admin & Doctor
    eventBus.on(EventTypes.POST_DISCHARGE_REPORT_CREATED, (event) => {
      const payload = event.payload;
      this.createAlert({
        targetRole: 'admin',
        title: `Post-Discharge Warning: ${payload.patientName || payload.patientId}`,
        message: `Condition: ${payload.condition} (${payload.severity}) · Care Plan: ${payload.planId || 'DP-001'}`,
        severity: payload.severity === 'Severe' ? 'CRITICAL' : 'WARNING',
        priority: payload.severity === 'Severe' ? 'P1' : 'P2',
        category: 'post_discharge',
        metadata: { reportId: payload.reportId, patientId: payload.patientId, doctorId: payload.doctorId }
      });

      if (payload.doctorId) {
        this.createAlert({
          targetRole: 'doctor',
          targetUserId: payload.doctorId,
          title: `Patient Warning Report: ${payload.patientName || payload.patientId}`,
          message: `Reported ${payload.condition}. Clinical review required.`,
          severity: 'WARNING',
          priority: 'P2',
          category: 'post_discharge',
          metadata: { reportId: payload.reportId, patientId: payload.patientId }
        });
      }
    });
  }

  /**
   * Create an alert in the central store
   */
  createAlert(data) {
    const alert = {
      id: generateId('alt'),
      targetRole: data.targetRole || 'admin',
      targetUserId: data.targetUserId || null,
      title: data.title || 'Operational Alert',
      message: data.message || '',
      severity: data.severity || 'WARNING',
      priority: data.priority || 'P2',
      category: data.category || 'general',
      acknowledged: false,
      acknowledgedBy: null,
      acknowledgedAt: null,
      createdAt: new Date().toISOString(),
      metadata: data.metadata || {}
    };

    appState.addItem('emergencyAlerts', alert);
    eventBus.emit(EventTypes.EMERGENCY_ALERT_CREATED, alert);

    return alert;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId, acknowledgedBy = 'User') {
    const s = appState.get();
    const alert = (s.emergencyAlerts || []).find(a => a.id === alertId);
    if (!alert || alert.acknowledged) return;

    appState.updateItem('emergencyAlerts', alertId, {
      acknowledged: true,
      acknowledgedBy,
      acknowledgedAt: new Date().toISOString()
    });

    eventBus.emit(EventTypes.EMERGENCY_ALERT_ACKNOWLEDGED, { alertId, acknowledgedBy });
  }

  /**
   * Get active alerts for current role
   */
  getActiveAlerts(role = 'admin', userId = null) {
    const s = appState.get();
    return (s.emergencyAlerts || []).filter(a => {
      if (a.acknowledged) return false;
      if (role === 'admin') return true;
      if (a.targetRole !== role) return false;
      if (a.targetUserId && userId && a.targetUserId !== userId) return false;
      return true;
    });
  }

  /**
   * Count unacknowledged alerts
   */
  getUnacknowledgedCount(role = 'admin', userId = null) {
    return this.getActiveAlerts(role, userId).length;
  }

  /**
   * Render alert banner directly into a container element
   */
  renderActiveAlertBanner(container, role = 'admin', userId = null) {
    if (!container) return;
    const activeAlerts = this.getActiveAlerts(role, userId);

    if (activeAlerts.length === 0) {
      container.innerHTML = '';
      return;
    }

    const topAlert = activeAlerts[0];
    const isCritical = topAlert.severity === 'CRITICAL' || topAlert.priority === 'P1';

    container.innerHTML = `
      <div class="emergency-alert-banner ${isCritical ? 'critical' : 'warning'} animate-fade-in" style="margin-bottom: var(--space-4)">
        <div class="flex items-center gap-3" style="flex: 1">
          <div class="alert-pulse-icon"><i class="fas ${isCritical ? 'fa-exclamation-triangle' : 'fa-bell'}"></i></div>
          <div style="flex: 1">
            <div style="font-weight: 800; font-size: var(--font-size-sm); display: flex; align-items: center; gap: 8px">
              <span>${escapeHtml(topAlert.title)}</span>
              <span class="badge ${isCritical ? 'badge-danger' : 'badge-warning'}" style="font-size: 10px">${topAlert.priority} · ${topAlert.severity}</span>
            </div>
            <div style="font-size: var(--font-size-xs); opacity: 0.9; margin-top: 2px">
              ${escapeHtml(topAlert.message)} · <span style="opacity: 0.75">${timeAgo(topAlert.createdAt)}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button class="btn btn-sm ${isCritical ? 'btn-danger' : 'btn-warning'}" onclick="window._ackAlert('${topAlert.id}')">
            <i class="fas fa-check"></i> Acknowledge
          </button>
          ${topAlert.category === 'ambulance' ? `
            <button class="btn btn-sm btn-secondary" onclick="window.HospitalFlow.router.navigate('/admin/emergency')">
              <i class="fas fa-truck-medical"></i> Dispatch
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }
}

// Global window handler for alert ack
window._ackAlert = (alertId) => {
  alertManager.acknowledgeAlert(alertId, 'Clinical Staff');
  const user = appState.get().currentUser;
  const role = user?.role || 'admin';
  const userId = user?.doctorId || user?.patientId || user?.id;

  const banner = document.getElementById(`${role}-emergency-alert-banner`) || document.getElementById('admin-emergency-page-banner');
  if (banner) {
    alertManager.renderActiveAlertBanner(banner, role, userId);
  }
};

const alertManager = new EmergencyAlertManager();
export default alertManager;
