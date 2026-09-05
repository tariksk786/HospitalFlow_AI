// ============================================
// HospitalFlow AI — Central Emergency Alert Manager
// Dual-Engine Audio (Web Audio + Synthetic WAV Fallback) + Web Speech API + Cross-Portal Routing
// ============================================

import appState from '../state.js';
import eventBus, { EventTypes } from '../events.js';
import { generateId, escapeHtml, timeAgo } from '../utils.js';

/**
 * Generate a standalone WAV Audio Data-URI for zero-dependency HTML5 fallback sound
 */
function generateChimeWavUri(freq1 = 880, freq2 = 1320, duration = 0.8) {
  try {
    const sampleRate = 22050;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    // RIFF header
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + numSamples * 2, true);
    view.setUint32(8, 0x57415645, false); // "WAVE"
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, numSamples * 2, true);

    const half = Math.floor(numSamples / 2);
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const freq = i < half ? freq1 : freq2;
      const envelope = Math.sin(Math.PI * (i / numSamples)); // smooth attack & decay
      const sample = Math.sin(2 * Math.PI * freq * t) * envelope * 0.85 * 32767;
      view.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, sample)), true);
    }

    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return 'data:audio/wav;base64,' + btoa(binary);
  } catch (e) {
    return null;
  }
}

class EmergencyAlertManager {
  constructor() {
    this.audioContext = null;
    this.audioInitialized = false;
    this.isMuted = false;
    this.escalationTimers = new Map();
    this.escalationThresholdMs = 30000;
    this._activeUtterance = null;

    this._initListeners();
    this._bindAudioInitializer();
    this._requestNotificationPermission();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (!this.isMuted) {
      this.ensureAudioUnlocked();
      this.playEmergencyChime('P2');
    }
    return this.isMuted;
  }

  _requestNotificationPermission() {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      try {
        Notification.requestPermission().catch(() => {});
      } catch (e) {}
    }
  }

  ensureAudioUnlocked() {
    try {
      if (!this.audioContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.audioContext = new AudioContextClass();
        }
      }
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      this.audioInitialized = true;
    } catch (e) {
      console.warn('Web Audio resume note:', e.message);
    }
  }

  /**
   * Bind user interaction to initialize AudioContext & SpeechSynthesis
   */
  _bindAudioInitializer() {
    const unlockAudio = () => {
      this.ensureAudioUnlocked();
    };

    ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(evt => {
      document.addEventListener(evt, unlockAudio, { passive: true });
    });
  }

  /**
   * 1. Critical Emergency Tone (Dual-tone Harmonic Siren + Fallback)
   */
  playEmergencyChime(priority = 'P1') {
    if (this.isMuted) return;

    // A. Web Audio Oscillator Harmonics
    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.audioContext = new AudioCtx();
      }

      const scheduleEmergency = () => {
        if (!this.audioContext) return;
        const now = this.audioContext.currentTime;

        const osc1 = this.audioContext.createOscillator();
        const osc2 = this.audioContext.createOscillator();
        const osc3 = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        // Primary alarm frequency
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(880, now);
        osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.2);
        osc1.frequency.setValueAtTime(880, now + 0.45);
        osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.7);

        // Harmonic overtone
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(440, now);
        osc2.frequency.exponentialRampToValueAtTime(660, now + 0.2);
        osc2.frequency.setValueAtTime(440, now + 0.45);
        osc2.frequency.exponentialRampToValueAtTime(660, now + 0.7);

        // High presence tone
        osc3.type = 'triangle';
        osc3.frequency.setValueAtTime(1760, now);
        osc3.frequency.exponentialRampToValueAtTime(2640, now + 0.2);
        osc3.frequency.setValueAtTime(1760, now + 0.45);

        // Gain curve (Audible, crisp & clear)
        gainNode.gain.setValueAtTime(0.01, now);
        gainNode.gain.linearRampToValueAtTime(0.75, now + 0.05);
        gainNode.gain.setValueAtTime(0.70, now + 0.45);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        osc3.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        osc1.start(now);
        osc2.start(now);
        osc3.start(now);
        osc1.stop(now + 1.4);
        osc2.stop(now + 1.4);
        osc3.stop(now + 1.4);
      };

      if (this.audioContext) {
        if (this.audioContext.state === 'suspended') {
          this.audioContext.resume().then(scheduleEmergency).catch(scheduleEmergency);
        } else {
          scheduleEmergency();
        }
      }
    } catch (e) {
      console.warn('Audio chime note:', e.message);
    }

    // B. Backup Synthetic Audio Player
    try {
      const wavUri = generateChimeWavUri(880, 1320, 0.9);
      if (wavUri) {
        const audio = new Audio(wavUri);
        audio.volume = 1.0;
        audio.play().catch(() => {});
      }
    } catch (e) {}
  }

  /**
   * 2. Ambulance Dispatch Tone (1.4s alert chime)
   */
  playAmbulanceChime() {
    if (this.isMuted) return;

    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.audioContext = new AudioCtx();
      }

      const scheduleAmbulance = () => {
        if (!this.audioContext) return;
        const now = this.audioContext.currentTime;

        const osc = this.audioContext.createOscillator();
        const osc2 = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880.00, now + 0.25); // A5
        osc.frequency.setValueAtTime(1174.66, now + 0.5); // D6

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(293.66, now); // D4
        osc2.frequency.setValueAtTime(440.00, now + 0.25); // A4
        osc2.frequency.setValueAtTime(587.33, now + 0.5); // D5

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.7, now + 0.05);
        gain.gain.setValueAtTime(0.65, now + 0.5);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(this.audioContext.destination);

        osc.start(now);
        osc2.start(now);
        osc.stop(now + 1.3);
        osc2.stop(now + 1.3);
      };

      if (this.audioContext) {
        if (this.audioContext.state === 'suspended') {
          this.audioContext.resume().then(scheduleAmbulance).catch(scheduleAmbulance);
        } else {
          scheduleAmbulance();
        }
      }
    } catch (e) {
      console.warn('Ambulance chime note:', e.message);
    }

    try {
      const wavUri = generateChimeWavUri(587, 1174, 0.9);
      if (wavUri) {
        const audio = new Audio(wavUri);
        audio.volume = 1.0;
        audio.play().catch(() => {});
      }
    } catch (e) {}
  }

  /**
   * 3. Critical Blood Request Tone (1.0s distinctive bell)
   */
  playCriticalBloodChime() {
    if (this.isMuted) return;

    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.audioContext = new AudioCtx();
      }

      const scheduleBlood = () => {
        if (!this.audioContext) return;
        const now = this.audioContext.currentTime;

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1046.50, now); // C6
        osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.5); // C5

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.65, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);

        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        osc.start(now);
        osc.stop(now + 1.0);
      };

      if (this.audioContext) {
        if (this.audioContext.state === 'suspended') {
          this.audioContext.resume().then(scheduleBlood).catch(scheduleBlood);
        } else {
          scheduleBlood();
        }
      }
    } catch (e) {
      console.warn('Blood chime note:', e.message);
    }

    try {
      const wavUri = generateChimeWavUri(1046, 523, 0.8);
      if (wavUri) {
        const audio = new Audio(wavUri);
        audio.volume = 1.0;
        audio.play().catch(() => {});
      }
    } catch (e) {}
  }

  /**
   * Voice Alert using Web Speech API (Garbage-collection protected)
   */
  speakAlert(text) {
    if (this.isMuted) return;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.02;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        utterance.lang = 'en-US';

        this._activeUtterance = utterance;
        utterance.onend = () => { this._activeUtterance = null; };
        utterance.onerror = () => { this._activeUtterance = null; };

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
      this.createAlert({
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

      this.ensureAudioUnlocked();
      this.playAmbulanceChime();
      setTimeout(() => {
        this.speakAlert('Emergency ambulance request received. Immediate dispatch attention required.');
      }, 350);
    });

    // 1b. Patient arrives by Private Vehicle -> Alert Admin & Doctor
    eventBus.on(EventTypes.EMERGENCY_PREARRIVAL_CREATED, (event) => {
      const payload = event.payload;
      this.createAlert({
        targetRole: 'admin',
        title: `🚨 Pre-Arrival: ${payload.patientName || 'Emergency Patient'} (${payload.transportMode || 'Private Vehicle'})`,
        message: `Expected arrival: ~${payload.estimatedArrivalMinutes || 15} min. Severity: ${payload.severity || 'Critical'}. Symptoms: ${payload.symptoms}`,
        severity: payload.severity === 'Critical' ? 'CRITICAL' : 'WARNING',
        priority: payload.severity === 'Critical' ? 'P1' : 'P2',
        category: 'emergency_prearrival',
        metadata: {
          requestId: payload.requestId,
          transportMode: payload.transportMode,
          patientName: payload.patientName,
          symptoms: payload.symptoms,
          estimatedArrivalMinutes: payload.estimatedArrivalMinutes
        }
      });

      this.ensureAudioUnlocked();
      this.playEmergencyChime(payload.severity === 'Critical' ? 'P1' : 'P2');
      setTimeout(() => {
        this.speakAlert('Emergency pre-arrival alert. Private vehicle arriving.');
      }, 350);
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

      const user = appState.get().currentUser;
      if (user && user.role === 'doctor' && (user.doctorId === payload.doctorId || !payload.doctorId)) {
        this.ensureAudioUnlocked();
        this.playEmergencyChime('P1');
        setTimeout(() => {
          this.speakAlert('Critical emergency patient assigned.');
        }, 350);
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

      this.ensureAudioUnlocked();
      this.playEmergencyChime('P1');
      setTimeout(() => {
        this.speakAlert('Critical emergency case detected. Immediate attention required.');
      }, 350);
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

      this.ensureAudioUnlocked();
      this.playCriticalBloodChime();
      setTimeout(() => {
        this.speakAlert('Critical blood request requires attention.');
      }, 350);
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

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`🚨 ${alert.title}`, {
          body: alert.message,
          icon: 'favicon.ico'
        });
      } catch (e) {}
    }

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
          <button class="btn btn-sm btn-ghost" onclick="window._replayAlertSound('${topAlert.priority}')" title="Replay Sound Alert" style="color: inherit; border: 1px solid rgba(0,0,0,0.15)">
            <i class="fas fa-volume-up"></i> Play Sound
          </button>
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

// Global window handler for alert sound replay
window._replayAlertSound = (priority = 'P1') => {
  alertManager.ensureAudioUnlocked();
  alertManager.playEmergencyChime(priority);
};

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
