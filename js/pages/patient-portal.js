// ============================================
// HospitalFlow AI — Patient Portal
// MedFlow Vista Standard + Health Identity Profile + Home Problem Reporting
// ============================================

import appState from '../state.js';
import Config from '../config.js';
import Auth from '../auth.js';
import Router from '../router.js';
import i18n, { t } from '../i18n.js';
import SymptomNormalizer from '../engines/symptom-normalizer.js';
import FlowEngine from '../engines/flow-engine.js';
import PredictionEngine from '../engines/prediction-engine.js';
import CareEngine from '../engines/care-engine.js';
import alertManager from '../engines/emergency-alert-manager.js';
import eventBus, { EventTypes } from '../events.js';
import { escapeHtml, formatMinutes, formatTime, formatDate, timeAgo, getInitials } from '../utils.js';

let bookingSymptomAnalysis = null;
let selectedSymptomCodes = [];

// Persistent zero-loss emergency form state
let emergencyFormState = {
  self: {
    symptoms: '',
    severity: 'Critical',
    eta: '14',
    consciousness: 'Conscious',
    breathing: 'None',
    bleeding: 'No',
    phone: ''
  },
  ambulance: {
    pickupLoc: '',
    phone: '',
    symptoms: '',
    severity: 'Critical'
  }
};

export function renderPatientPortal(container, subRoute = 'home') {
  const user = Auth.getCurrentUser();
  if (!user || user.role !== 'patient') {
    Router.navigate('/login');
    return;
  }

  const patientId = user.patientId || 'P-1001';
  const patient = appState.get().patients.find(p => p.id === patientId) || {
    id: patientId,
    displayName: user.displayName || 'Amit Kumar',
    bloodGroup: 'B+',
    age: 29,
    gender: 'Male',
    phone: '+91 9876543210'
  };

  const navItems = [
    { route: '/patient/home', icon: 'fa-home', label: t('nav.home') || 'Home' },
    { route: '/patient/appointments', icon: 'fa-calendar-check', label: t('nav.appointments') || 'Appointments' },
    { route: '/patient/queue', icon: 'fa-list-ol', label: t('nav.queue') || 'Live Queue' },
    { route: '/patient/care', icon: 'fa-pills', label: t('nav.care') || 'My Care' },
    { route: '/patient/emergency-status', icon: 'fa-ambulance', label: 'Emergency Help' },
    { route: '/patient/profile', icon: 'fa-user', label: t('nav.profile') || 'Profile' }
  ];

  const currentLang = i18n.getLanguage();
  const unackAlerts = alertManager.getUnacknowledgedCount('patient', patient.id);

  container.innerHTML = `
    <div class="app-shell animate-fade-in" id="patient-app-shell">
      <!-- 1. Left Fixed Sidebar -->
      <aside class="app-sidebar" id="patient-sidebar">
        <div class="sidebar-brand">
          <div class="sidebar-brand-icon">
            <i class="fas fa-heartbeat"></i>
          </div>
          <div class="sidebar-brand-text">
            <span class="sidebar-brand-title">HospitalFlow AI</span>
            <span class="sidebar-brand-sub">Patient Care Coordination</span>
          </div>
        </div>

        <nav class="sidebar-nav">
          ${navItems.map(item => `
            <a href="#${item.route}" class="sidebar-nav-item ${subRoute === item.route.replace('/patient/', '') ? 'active' : ''}">
              <i class="fas ${item.icon}"></i>
              <span>${item.label}</span>
            </a>
          `).join('')}
        </nav>

        <div class="sidebar-footer">
          <button class="sidebar-collapse-btn" id="btn-toggle-sidebar" title="Collapse sidebar">
            <i class="fas fa-chevron-left"></i>
            <span>Collapse</span>
          </button>
        </div>
      </aside>

      <!-- 2. Main Content Area -->
      <div class="app-main">
        <!-- Sticky Header -->
        <header class="app-header">
          <div class="header-left">
            <div class="header-page-title">
              <h2>${subRoute === 'home' ? (t('nav.home') || 'Home') :
                    subRoute === 'appointments' ? (t('nav.appointments') || 'Appointments') :
                    subRoute === 'queue' ? (t('nav.queue') || 'Live Queue') :
                    subRoute === 'care' ? (t('nav.care') || 'My Care') :
                    subRoute === 'emergency-status' ? 'Emergency & Ambulance' : 'Profile'}</h2>
              <span>${t('patient.portal_subtitle') || "Here's your hospital journey today."}</span>
            </div>
          </div>

          <div class="header-right">
            <!-- Language Toggle Capsule (Explicit User Choice) -->
            <div class="lang-toggle-capsule">
              <button class="lang-toggle-btn ${currentLang === 'en' ? 'active' : ''}" data-lang="en">English</button>
              <button class="lang-toggle-btn ${currentLang === 'hi' ? 'active' : ''}" data-lang="hi">हिंदी</button>
            </div>

            <!-- Emergency Alert Bell -->
            <button class="header-alarm-btn" onclick="window.HospitalFlow.router.navigate('/patient/emergency-status')" title="Emergency Status">
              <i class="fas fa-ambulance"></i>
              ${unackAlerts > 0 ? `<span class="header-alarm-badge">${unackAlerts}</span>` : ''}
            </button>

            <!-- Notifications Bell -->
            <button class="btn btn-ghost btn-icon" onclick="window.HospitalFlow.router.navigate('/patient/notifications')" title="Notifications">
              <i class="fas fa-bell"></i>
            </button>

            <!-- User Info Pill -->
            <div class="header-user-pill">
              <div class="header-user-avatar">${getInitials(patient.displayName)}</div>
              <div class="header-user-details">
                <span class="header-user-name">${escapeHtml(patient.displayName)}</span>
                <span class="header-user-role">Patient · ${patient.id}</span>
              </div>
            </div>

            <!-- Logout Button -->
            <button class="btn btn-ghost btn-icon" onclick="window.HospitalFlow.logout()" title="Sign Out">
              <i class="fas fa-sign-out-alt"></i>
            </button>
          </div>
        </header>

        <!-- Sub Content View -->
        <main class="app-content">
          <div id="patient-sub-content"></div>
        </main>
      </div>

      <!-- Mobile Bottom Navigation Bar -->
      <nav class="mobile-bottom-nav">
        <a href="#/patient/home" class="mobile-nav-item ${subRoute === 'home' ? 'active' : ''}">
          <i class="fas fa-home"></i>
          <span>Home</span>
        </a>
        <a href="#/patient/appointments" class="mobile-nav-item ${subRoute === 'appointments' ? 'active' : ''}">
          <i class="fas fa-calendar-check"></i>
          <span>Apts</span>
        </a>
        <a href="#/patient/queue" class="mobile-nav-item ${subRoute === 'queue' ? 'active' : ''}">
          <i class="fas fa-list-ol"></i>
          <span>Queue</span>
        </a>
        <a href="#/patient/care" class="mobile-nav-item ${subRoute === 'care' ? 'active' : ''}">
          <i class="fas fa-pills"></i>
          <span>Care</span>
        </a>
        <a href="#/patient/emergency-status" class="mobile-nav-item ${subRoute === 'emergency-status' ? 'active' : ''}" style="color: var(--critical)">
          <i class="fas fa-ambulance"></i>
          <span>Emergency</span>
        </a>
      </nav>

      <!-- Global Modal Hook -->
      <div id="patient-modal-root"></div>
    </div>
  `;

  // Language Toggle Listeners
  container.querySelectorAll('.lang-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const newLang = btn.dataset.lang;
      if (newLang !== i18n.getLanguage()) {
        i18n.setLanguage(newLang);
        renderPatientPortal(container, subRoute);
      }
    });
  });

  // Sidebar Collapse Listener
  const sidebar = container.querySelector('#patient-sidebar');
  const mainShell = container.querySelector('.app-main');
  container.querySelector('#btn-toggle-sidebar')?.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    mainShell.classList.toggle('sidebar-collapsed');
  });

  // Render Sub Route
  const subContentEl = container.querySelector('#patient-sub-content');
  const renderCurrentSubRoute = () => {
    if (!subContentEl || !document.body.contains(subContentEl)) return;
    switch (subRoute) {
      case 'home': renderPatientHome(subContentEl, patient); break;
      case 'appointments': renderPatientAppointments(subContentEl, patient); break;
      case 'queue': renderPatientQueue(subContentEl, patient); break;
      case 'care': renderPatientCare(subContentEl, patient); break;
      case 'emergency-status': renderPatientEmergencyWorkflow(subContentEl, patient); break;
      case 'profile': renderPatientProfilePage(subContentEl, patient); break;
      default: renderPatientHome(subContentEl, patient); break;
    }
  };

  renderCurrentSubRoute();

  // Reactive subscription for zero-refresh operational synchronization (protected from destroying modals)
  const unsubscribeState = appState.subscribe(() => {
    if (!document.body.contains(subContentEl)) return;
    if (document.querySelector('.modal-backdrop') || document.querySelector('.modal.active') || document.querySelector('.modal')) {
      return; // Never re-render while patient is booking appointment or interacting with modal
    }
    if (subRoute === 'emergency-status') {
      const active = document.activeElement;
      if (active && (active.id?.startsWith('pre-') || active.id?.startsWith('amb-'))) {
        return; // Avoid destroying form while user is actively entering emergency information
      }
    }
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA')) {
      return; // Do not interrupt user typing
    }
    renderCurrentSubRoute();
  });

  // Clean up observer
  const observer = new MutationObserver(() => {
    if (!document.body.contains(container)) {
      unsubscribeState();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// ============================================
// PATIENT HOME DASHBOARD
// ============================================
function renderPatientHome(el, patient) {
  const s = appState.get();

  const myApts = s.appointments
    .filter(a => a.patientId === patient.id && a.status === 'Scheduled')
    .sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));
  const nextApt = myApts[0] || null;
  const nextDoc = nextApt ? s.doctors.find(d => d.id === nextApt.doctorId) : null;

  const activeQueue = s.queueEntries.find(q => q.patientId === patient.id && ['Waiting', 'Called', 'Consulting'].includes(q.status));
  const activePlan = s.dischargePlans.find(dp => dp.patientId === patient.id && dp.active);
  const nextMed = activePlan && activePlan.medications.length > 0 ? activePlan.medications[0] : null;

  const myFollowUps = s.followUps.filter(fu => fu.patientId === patient.id);
  const nextFollowUp = myFollowUps[0] || null;

  const activeAmbReq = (s.ambulanceRequests || []).find(r => r.patientId === patient.id && r.status !== 'ARRIVED' && r.status !== 'CANCELLED');

  el.innerHTML = `
    <div class="patient-home-layout animate-fade-in">
      <div class="patient-greeting-header">
        <h1>${t('patient.welcome') || 'Welcome back'}, ${escapeHtml(patient.displayName.split(' ')[0])}</h1>
        <p>${t('patient.portal_subtitle') || "Here's your hospital journey today."}</p>
      </div>

      <!-- Calm Emergency Assistance Card -->
      <div class="emergency-calm-card">
        <div class="emergency-calm-left">
          <div class="emergency-calm-icon"><i class="fas fa-ambulance"></i></div>
          <div>
            <div class="emergency-calm-title">${t('patient.need_urgent_help') || 'Need urgent help?'}</div>
            <p class="emergency-calm-desc">
              ${activeAmbReq ?
                `<strong>Active Hospital Ambulance (${activeAmbReq.status}):</strong> ETA ~${activeAmbReq.estimatedPickup || 8} min` :
                (t('patient.emergency_desc') || 'Our emergency team can guide you immediately, or send a hospital ambulance to your location.')}
            </p>
          </div>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-secondary btn-sm" onclick="window._showEmergencyHelpModal('${patient.id}')">
            ${t('patient.emergency_assistance') || 'Emergency Assistance'}
          </button>
          <button class="btn btn-danger btn-sm" onclick="window.HospitalFlow.router.navigate('/patient/emergency-status')">
            <i class="fas fa-truck-medical"></i> ${activeAmbReq ? 'View Live Status' : (t('patient.request_ambulance') || 'Request Hospital Ambulance')}
          </button>
        </div>
      </div>

      <!-- Main 2-Column Responsive Grid -->
      <div class="grid-patient-home">
        <!-- Left Column: Primary Cards -->
        <div class="flex flex-col gap-6">
          <!-- Next Appointment Card -->
          <div class="patient-apt-card">
            <div class="apt-card-top">
              <span class="apt-card-tag">NEXT APPOINTMENT</span>
              ${nextApt ? `<span class="badge badge-success"><i class="fas fa-check"></i> Confirmed</span>` : `<span class="badge badge-neutral">No Upcoming</span>`}
            </div>

            ${nextApt ? `
              <div class="apt-dept-title">${escapeHtml(nextApt.department)}</div>
              <div class="apt-doctor-name">Dr. ${escapeHtml(nextDoc?.displayName || 'Assigned Physician')} (${escapeHtml(nextDoc?.specialty || '')})</div>

              <div class="apt-time-inner-box">
                <div class="apt-time-row">
                  <div>
                    <div style="font-size: 10px; text-transform: uppercase; color: var(--text-secondary); font-weight: 700">Time</div>
                    <div class="apt-time-large">${formatTime(nextApt.scheduledTime)}</div>
                  </div>
                  <div style="text-align: right">
                    <div style="font-size: 10px; text-transform: uppercase; color: var(--text-secondary); font-weight: 700">Date</div>
                    <div class="apt-date-text">${formatDate(nextApt.scheduledTime)}</div>
                  </div>
                </div>
                <div class="apt-window-text">
                  <strong>Consultation Window:</strong> ${formatTime(nextApt.predictedStart)} – ${formatTime(nextApt.predictedEnd)}
                </div>
              </div>

              <div class="flex gap-3">
                <button class="btn btn-primary btn-sm" style="flex: 1" onclick="window._showAppointmentQRModal('${nextApt.id}')">
                  <i class="fas fa-qrcode"></i> View QR
                </button>
                <button class="btn btn-secondary btn-sm" style="flex: 1" onclick="window._showAppointmentDetailsModal('${nextApt.id}')">
                  <i class="fas fa-info-circle"></i> View Details
                </button>
              </div>

              <div class="apt-meta-footer">
                <span>Appointment ID: <strong>${nextApt.id}</strong></span>
                <span>Reported symptoms: <strong>${nextApt.normalized_symptoms && nextApt.normalized_symptoms.length > 0 ? nextApt.normalized_symptoms.join(', ') : 'Routine'}</strong></span>
              </div>
            ` : `
              <div class="empty-state" style="padding: var(--space-6)">
                <i class="fas fa-calendar-plus"></i>
                <h4>No scheduled appointments</h4>
                <p>Book a consultation with our specialist doctors.</p>
                <button class="btn btn-primary btn-sm" onclick="window.HospitalFlow.router.navigate('/patient/appointments')">
                  <i class="fas fa-plus"></i> Book Appointment
                </button>
              </div>
            `}
          </div>

          <!-- Follow-Up Card -->
          <div class="card">
            <div class="card-header">
              <div>
                <h3 class="card-title">Follow-Up</h3>
                <div class="card-subtitle">Review recovery and scheduled check-ins</div>
              </div>
              <span class="badge ${nextFollowUp ? 'badge-info' : 'badge-neutral'}">${nextFollowUp ? nextFollowUp.status : 'None'}</span>
            </div>

            ${nextFollowUp ? `
              <div class="flex items-center gap-3" style="background: var(--bg-subtle); padding: var(--space-4); border-radius: var(--radius-lg); border: 1px solid var(--border-light)">
                <div style="width: 40px; height: 40px; border-radius: var(--radius-md); background: var(--primary-50); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 18px">
                  <i class="fas fa-calendar-alt"></i>
                </div>
                <div style="flex: 1">
                  <div style="font-weight: 700; font-size: var(--font-size-sm)">${formatDate(nextFollowUp.date)} · ${nextFollowUp.time}</div>
                  <div style="font-size: var(--font-size-xs); color: var(--text-secondary)">Dept: ${escapeHtml(nextFollowUp.department)} · Linked Care Plan (${activePlan?.id || 'DP-001'})</div>
                </div>
              </div>
            ` : `
              <div class="empty-state" style="padding: var(--space-4)">
                <p style="margin-bottom: var(--space-2)">No pending clinical follow-ups scheduled.</p>
              </div>
            `}
          </div>
        </div>

        <!-- Right Column: Queue & Care Shortcuts -->
        <div class="flex flex-col gap-6">
          <!-- Queue Status Card -->
          <div class="card">
            <div class="card-header">
              <div>
                <h3 class="card-title">${t('nav.queue') || 'Live Queue Status'}</h3>
                <div class="card-subtitle">Your position in hospital flow</div>
              </div>
              <span class="badge ${activeQueue ? 'badge-primary' : 'badge-neutral'}">
                ${activeQueue ? activeQueue.status : 'Not in Queue'}
              </span>
            </div>

            ${activeQueue ? `
              <div class="queue-status-box" style="background: var(--primary-50); padding: var(--space-4); border-radius: var(--radius-lg); border: 1px solid var(--primary-200); margin-bottom: var(--space-4)">
                <div class="flex justify-between items-center">
                  <div>
                    <div style="font-size: var(--font-size-xs); color: var(--text-secondary)">Token Number</div>
                    <div style="font-size: 28px; font-weight: 800; color: var(--primary)">${activeQueue.id}</div>
                  </div>
                  <div style="text-align: right">
                    <div style="font-size: var(--font-size-xs); color: var(--text-secondary)">Est. Wait</div>
                    <div style="font-size: 24px; font-weight: 700; color: var(--warning)">${formatMinutes(activeQueue.estimatedWait || 15)}</div>
                  </div>
                </div>
                <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-top: var(--space-2)">
                  Patients ahead: <strong>${Math.max(0, (activeQueue.position || 1) - 1)}</strong> · Room: <strong>${activeQueue.room || '102'}</strong>
                </div>
              </div>
              <button class="btn btn-secondary btn-sm" style="width: 100%" onclick="window.HospitalFlow.router.navigate('/patient/queue')">
                <i class="fas fa-list-ol"></i> View Full Live Queue
              </button>
            ` : `
              <div class="empty-state" style="padding: var(--space-4)">
                <p style="margin-bottom: var(--space-2)">You are not currently in an active doctor queue.</p>
                <button class="btn btn-ghost btn-sm" onclick="window.HospitalFlow.router.navigate('/patient/appointments')">
                  View Appointments & Check-in
                </button>
              </div>
            `}
          </div>

          <!-- My Care Shortcut -->
          <div class="card">
            <div class="card-header">
              <div>
                <h3 class="card-title">${t('nav.care') || 'My Care & Medications'}</h3>
                <div class="card-subtitle">Active prescriptions & instructions</div>
              </div>
              <span class="badge ${activePlan ? 'badge-success' : 'badge-neutral'}">
                ${activePlan ? 'Active Plan' : 'No Plan'}
              </span>
            </div>

            ${activePlan && nextMed ? `
              <div class="med-item" style="margin-bottom: var(--space-3)">
                <div class="med-check ${nextMed.taken ? 'checked' : ''}" onclick="window.HospitalFlow.toggleMedication('${patient.id}', '${nextMed.name}', '${nextMed.timeSlot}')">
                  <i class="fas fa-check"></i>
                </div>
                <div class="med-info">
                  <div class="med-name">${escapeHtml(nextMed.name)}</div>
                  <div class="med-dose">${escapeHtml(nextMed.dosage)} · ${escapeHtml(nextMed.timeSlot)} (${escapeHtml(nextMed.timing || 'Slot')})</div>
                </div>
              </div>
              <button class="btn btn-secondary btn-sm" style="width: 100%" onclick="window.HospitalFlow.router.navigate('/patient/care')">
                <i class="fas fa-pills"></i> Open Recovery Workspace
              </button>
            ` : `
              <div class="empty-state" style="padding: var(--space-4)">
                <p>No active care plan prescribed at this time.</p>
              </div>
            `}
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================
// PATIENT APPOINTMENTS TAB
// ============================================
function renderPatientAppointments(el, patient) {
  const s = appState.get();
  const myApts = s.appointments
    .filter(a => a.patientId === patient.id)
    .sort((a, b) => new Date(b.scheduledTime) - new Date(a.scheduledTime));

  el.innerHTML = `
    <div class="patient-apts-layout animate-fade-in">
      <div class="flex justify-between items-center" style="margin-bottom: var(--space-4)">
        <div>
          <h2 style="margin: 0; font-size: var(--font-size-xl)">${t('patient.appointments_title') || 'Your Consultations'}</h2>
          <p style="margin: 0; font-size: var(--font-size-xs); color: var(--text-secondary)">Manage bookings, check-in QR codes, and clinical consultations</p>
        </div>
        <button class="btn btn-primary btn-sm" onclick="window._showBookAppointmentModal('${patient.id}')">
          <i class="fas fa-plus"></i> ${t('patient.book_new_apt') || 'Book New Consultation'}
        </button>
      </div>

      ${myApts.length > 0 ? `
        <div class="grid-2" style="gap: var(--space-4)">
          ${myApts.map(apt => {
            const doc = s.doctors.find(d => d.id === apt.doctorId);
            const isToday = new Date(apt.scheduledTime).toDateString() === new Date().toDateString();

            return `
              <div class="card apt-item-card">
                <div class="flex justify-between items-start" style="margin-bottom: var(--space-3)">
                  <div>
                    <span class="badge ${apt.status === 'Scheduled' ? 'badge-primary' : apt.status === 'Completed' ? 'badge-success' : 'badge-neutral'}">${apt.status}</span>
                    <h3 style="margin: var(--space-2) 0 2px; font-size: var(--font-size-md)">${escapeHtml(apt.department)}</h3>
                    <div style="font-size: var(--font-size-xs); color: var(--text-secondary)">Dr. ${escapeHtml(doc?.displayName || 'Physician')}</div>
                  </div>
                  <div style="text-align: right">
                    <div style="font-weight: 700; font-size: var(--font-size-md); color: var(--primary)">${formatTime(apt.scheduledTime)}</div>
                    <div style="font-size: var(--font-size-xs); color: var(--text-secondary)">${formatDate(apt.scheduledTime)}</div>
                  </div>
                </div>

                <div class="card-inner-box" style="background: var(--bg-subtle); margin: var(--space-3) 0">
                  <div style="font-size: var(--font-size-xs); color: var(--text-secondary)">Reported Symptoms:</div>
                  <div style="font-weight: 600; font-size: var(--font-size-xs); color: var(--text)">"${escapeHtml(apt.symptom_original_text || 'General Checkup')}"</div>
                  <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px">
                    Normalized: <strong>${(apt.normalized_symptoms || []).join(', ') || 'Routine'}</strong>
                  </div>
                </div>

                <div class="flex gap-2" style="margin-top: var(--space-3)">
                  ${apt.status === 'Scheduled' ? `
                    <button class="btn btn-primary btn-sm" style="flex: 1" onclick="window.HospitalFlow.checkInPatient('${apt.id}')">
                      <i class="fas fa-check"></i> Check In
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="window._showAppointmentQRModal('${apt.id}')">
                      <i class="fas fa-qrcode"></i> QR
                    </button>
                  ` : `
                    <button class="btn btn-ghost btn-sm" style="flex: 1" onclick="window._showAppointmentDetailsModal('${apt.id}')">
                      <i class="fas fa-info-circle"></i> Details
                    </button>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <div class="card empty-state" style="padding: var(--space-8)">
          <i class="fas fa-calendar-times"></i>
          <h3>No consultations found</h3>
          <p>You have not scheduled any clinical consultations yet.</p>
          <button class="btn btn-primary btn-sm" onclick="window._showBookAppointmentModal('${patient.id}')">
            <i class="fas fa-plus"></i> Book Consultation
          </button>
        </div>
      `}
    </div>
  `;
}

// ============================================
// PATIENT LIVE QUEUE TAB
// ============================================
function renderPatientQueue(el, patient) {
  const s = appState.get();
  const myQueue = s.queueEntries.find(q => q.patientId === patient.id && ['Waiting', 'Called', 'Consulting'].includes(q.status));

  el.innerHTML = `
    <div class="patient-queue-layout animate-fade-in" style="max-width: 800px; margin: 0 auto">
      ${myQueue ? `
        <div class="card" style="border-top: 4px solid var(--primary); margin-bottom: var(--space-6)">
          <div class="card-header flex justify-between items-center">
            <div>
              <h2 style="margin: 0; font-size: var(--font-size-xl)">Live Queue Tracker</h2>
              <div style="font-size: var(--font-size-xs); color: var(--text-secondary)">Department: <strong>${escapeHtml(myQueue.department)}</strong></div>
            </div>
            <span class="badge ${myQueue.status === 'Called' ? 'badge-warning animate-pulse' : myQueue.status === 'Consulting' ? 'badge-success' : 'badge-primary'}" style="font-size: 12px; padding: 6px 14px">
              ${myQueue.status === 'Called' ? 'PLEASE ENTER ROOM' : myQueue.status === 'Consulting' ? 'IN CONSULTATION' : 'WAITING IN QUEUE'}
            </span>
          </div>

          <div class="grid-3" style="margin: var(--space-5) 0">
            <div class="metric-card">
              <div class="kpi-icon blue"><i class="fas fa-ticket-alt"></i></div>
              <div class="kpi-content">
                <div class="kpi-label">Your Token</div>
                <div class="kpi-value">${myQueue.id}</div>
                <div class="kpi-meta">Position: #${myQueue.position}</div>
              </div>
            </div>

            <div class="metric-card">
              <div class="kpi-icon orange"><i class="fas fa-users"></i></div>
              <div class="kpi-content">
                <div class="kpi-label">Patients Ahead</div>
                <div class="kpi-value">${Math.max(0, myQueue.position - 1)}</div>
                <div class="kpi-meta">Avg: 6m / patient</div>
              </div>
            </div>

            <div class="metric-card">
              <div class="kpi-icon green"><i class="fas fa-door-open"></i></div>
              <div class="kpi-content">
                <div class="kpi-label">Consultation Room</div>
                <div class="kpi-value">${myQueue.room || '102'}</div>
                <div class="kpi-meta">OPD Wing B</div>
              </div>
            </div>
          </div>

          <div class="card-inner-box" style="background: #EFF6FF; border: 1px solid #BFDBFE">
            <div class="flex items-center gap-3">
              <div style="font-size: 24px; color: var(--primary)"><i class="fas fa-info-circle"></i></div>
              <div>
                <strong style="color: #1E40AF">Estimated Consultation Start:</strong>
                <div style="font-size: var(--font-size-sm); color: #1E3A8A">
                  Expected in ~${myQueue.estimatedWait || 12} minutes. Please remain seated near Room ${myQueue.room || '102'}.
                </div>
              </div>
            </div>
          </div>
        </div>
      ` : `
        <div class="card empty-state" style="padding: var(--space-8)">
          <i class="fas fa-check-circle" style="color: var(--success); font-size: 48px"></i>
          <h3>No active queue entry</h3>
          <p>You have not checked in to any consultation queues today.</p>
          <button class="btn btn-primary btn-sm" onclick="window.HospitalFlow.router.navigate('/patient/appointments')">
            View Appointments
          </button>
        </div>
      `}
    </div>
  `;
}

// ============================================
// PATIENT MY CARE & RECOVERY WORKSPACE
// ============================================
function renderPatientCare(el, patient) {
  const s = appState.get();
  const plan = s.dischargePlans.find(dp => dp.patientId === patient.id && dp.active) || s.dischargePlans[0] || {
    id: 'DP-2048',
    patientId: patient.id,
    active: true,
    medications: [
      { name: 'Azithromycin 500mg', dosage: '1 tablet', timeSlot: 'Morning', timing: 'Morning (08:00 AM)', duration: '5 days', instructions: 'After breakfast', taken: true, takenTimeStr: '08:04 AM' },
      { name: 'Paracetamol 650mg', dosage: '1 tablet (SOS)', timeSlot: 'Afternoon', timing: 'Afternoon (01:00 PM)', duration: '3 days', instructions: 'After food', taken: false, skipped: false },
      { name: 'Vitamin C 500mg', dosage: '1 tablet', timeSlot: 'Evening', timing: 'Evening (08:00 PM)', duration: '7 days', instructions: 'After dinner', taken: false, skipped: false }
    ],
    dietPlan: 'Light meals, high fluid intake, avoid spicy foods.',
    dietaryInstructions: 'Light meals, high fluid intake, avoid spicy foods.',
    instructions: 'Strict bed rest for 48 hours. Avoid heavy physical lifting. Resume routine activities gradually.',
    recoveryInstructions: 'Strict bed rest for 48 hours. Avoid heavy physical lifting. Resume routine activities gradually.',
    warningSigns: ['Fever above 101°F persisting for over 4 hours', 'Severe shortness of breath or chest heaviness', 'Sudden dizziness / fainting or loss of balance', 'Allergic reactions (skin rash, lip swelling)'],
    followUp: { department: 'General Medicine', date: 'In 7 Days', time: '10:00 AM' }
  };

  const meds = plan.medications || [];
  const takenCount = meds.filter(m => m.taken).length;
  const skippedCount = meds.filter(m => m.skipped).length;
  const nextScheduledMed = meds.find(m => !m.taken && !m.skipped) || null;
  const adherence = CareEngine.getAdherence(patient.id);

  el.innerHTML = `
    <div class="patient-care-layout animate-fade-in" style="max-width: 960px; margin: 0 auto">
      <!-- 1. Header Hero Card -->
      <div class="card" style="margin-bottom: var(--space-6); background: linear-gradient(135deg, #F0FDF4 0%, #FFFFFF 100%); border: 1px solid var(--success-border)">
        <div class="flex justify-between items-start" style="flex-wrap: wrap; gap: var(--space-4)">
          <div>
            <div class="flex items-center gap-2" style="margin-bottom: 4px">
              <span class="badge badge-primary">Care Plan: ${plan.id}</span>
              <span class="badge badge-success"><i class="fas fa-check-circle"></i> Clinical Team Approved</span>
            </div>
            <h2 style="margin: 0; font-size: var(--font-size-xl)">${t('care.recovery_workspace') || 'Recovery & Care Continuity Workspace'}</h2>
            <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-top: 4px">
              Treating Physician: <strong>Dr. Aarav Sharma (General Medicine)</strong> · Discharged: <strong>Active Plan</strong>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button class="btn btn-warning btn-sm" onclick="window._showPostDischargeReportModal('${patient.id}')">
              <i class="fas fa-flag"></i> ${t('care.report_home_problem') || 'Report a Problem from Home'}
            </button>
            <button class="btn btn-secondary btn-sm" onclick="window._showMissedDoseInstructionsModal('${patient.id}')">
              <i class="fas fa-file-medical"></i> View Instructions
            </button>
          </div>
        </div>

        <!-- Recovery Milestone Bar -->
        <div style="margin-top: var(--space-4); padding-top: var(--space-3); border-top: 1px solid var(--border-light)">
          <div class="flex justify-between items-center" style="font-size: var(--font-size-xs); margin-bottom: 6px">
            <span style="font-weight: 700; color: var(--primary)">
              <i class="fas fa-walking"></i> Recovery Progress: Day 4 of 7 (57% Complete)
            </span>
            <span style="color: var(--text-secondary)">Status: <strong style="color: var(--success)">Recovering on Track</strong></span>
          </div>
          <div class="progress-bar-track" style="height: 8px">
            <div class="progress-bar-fill blue" style="width: 57%"></div>
          </div>
        </div>
      </div>

      <!-- 2. Top 4 KPI Cards -->
      <div class="grid-4" style="margin-bottom: var(--space-6)">
        <div class="metric-card">
          <div class="kpi-icon blue"><i class="fas fa-pills"></i></div>
          <div class="kpi-content">
            <div class="kpi-label">${t('care.todays_medicines') || "Today's Medicines"}</div>
            <div class="kpi-value">${meds.length}</div>
            <div class="kpi-meta">Daily schedule</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="kpi-icon green"><i class="fas fa-check-circle"></i></div>
          <div class="kpi-content">
            <div class="kpi-label">${t('care.taken_count') || 'Taken'}</div>
            <div class="kpi-value" style="color: var(--success)">${takenCount}</div>
            <div class="kpi-meta">Adherence rate: ${adherence.rate}%</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="kpi-icon orange"><i class="fas fa-exclamation-circle"></i></div>
          <div class="kpi-content">
            <div class="kpi-label">${t('care.skipped_count') || 'Missed / Skipped'}</div>
            <div class="kpi-value" style="color: var(--warning)">${skippedCount}</div>
            <div class="kpi-meta">Reason logged</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="kpi-icon teal"><i class="fas fa-stopwatch"></i></div>
          <div class="kpi-content">
            <div class="kpi-label">${t('care.next_dose') || 'Next Dose'}</div>
            <div class="kpi-value" style="font-size: 16px">${nextScheduledMed ? (nextScheduledMed.timing || nextScheduledMed.timeSlot) : 'Completed'}</div>
            <div class="kpi-meta">${nextScheduledMed ? escapeHtml(nextScheduledMed.name.split(' ')[0]) : 'All done today'}</div>
          </div>
        </div>
      </div>

      <!-- 3. Missed Dose Safety Advisory Box -->
      ${skippedCount > 0 ? `
        <div class="card" style="border: 2px solid var(--warning-border); background: #FFFBEB; margin-bottom: var(--space-6)">
          <div class="flex justify-between items-start" style="flex-wrap: wrap; gap: var(--space-3)">
            <div class="flex items-start gap-3" style="max-width: 620px">
              <div style="font-size: 24px; color: #D97706"><i class="fas fa-shield-alt"></i></div>
              <div>
                <h4 style="margin: 0; color: #92400E; font-size: var(--font-size-md)">${t('care.missed_advisory_title') || 'Missed Dose Safety Advisory'}</h4>
                <p style="margin: 4px 0 0; font-size: var(--font-size-xs); color: #78350F; line-height: 1.5">
                  ${t('care.missed_advisory_text') || 'You missed this dose. Do not automatically double your next dose. Follow your prescription instructions or contact your care team if you are unsure.'}
                </p>
              </div>
            </div>
            <div class="flex gap-2">
              <button class="btn btn-secondary btn-sm" onclick="window._showMissedDoseInstructionsModal('${patient.id}')">
                <i class="fas fa-book-medical"></i> ${t('care.view_instructions') || 'View Instructions'}
              </button>
              <a href="tel:+919876543210" class="btn btn-warning btn-sm">
                <i class="fas fa-phone-alt"></i> ${t('care.contact_care_team') || 'Contact Care Team'}
              </a>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- 4. Medication Schedule Timeline -->
      <div class="card" style="margin-bottom: var(--space-6)">
        <div class="card-header flex justify-between items-center" style="border-bottom: 1px solid var(--border-light); padding-bottom: var(--space-3)">
          <div>
            <h3 class="card-title"><i class="fas fa-clock" style="color: var(--primary)"></i> Daily Medication Schedule</h3>
            <div class="card-subtitle">Morning, Afternoon, Evening and Night clinical dosages</div>
          </div>
          <span class="badge badge-info">${meds.length} Prescribed Medications</span>
        </div>

        <div class="flex flex-col gap-3" style="margin-top: var(--space-4)">
          ${meds.map(med => {
            const isTaken = med.taken;
            const isSkipped = med.skipped;

            return `
              <div class="card-inner-box" style="display: flex; justify-content: space-between; align-items: center; background: ${isTaken ? '#F0FDF4' : isSkipped ? '#FFFBEB' : 'white'}; border: 1px solid ${isTaken ? '#BBF7D0' : isSkipped ? '#FDE68A' : 'var(--border)'}; margin: 0">
                <div class="flex items-center gap-3">
                  <div class="med-icon-box" style="width: 40px; height: 40px; font-size: 16px; background: ${isTaken ? '#DCFCE7' : isSkipped ? '#FEF3C7' : 'var(--primary-100)'}; color: ${isTaken ? '#16A34A' : isSkipped ? '#D97706' : 'var(--primary)'}">
                    <i class="fas ${isTaken ? 'fa-check' : isSkipped ? 'fa-forward' : 'fa-pills'}"></i>
                  </div>
                  <div>
                    <div style="font-weight: 700; font-size: var(--font-size-md)">
                      ${escapeHtml(med.name)}
                      <span class="badge ${isTaken ? 'badge-success' : isSkipped ? 'badge-warning' : 'badge-neutral'}" style="margin-left: 6px; font-size: 10px">
                        ${med.timeSlot} (${med.timing || 'Slot'})
                      </span>
                    </div>
                    <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-top: 2px">
                      Dosage: <strong>${med.dosage}</strong> · Instructions: <em>${med.instructions || 'After food'}</em>
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  ${isTaken ? `
                    <span class="badge badge-success" style="padding: 6px 12px; font-size: 12px">
                      <i class="fas fa-check-circle"></i> Taken at ${med.takenTimeStr || '08:04 AM'}
                    </span>
                  ` : isSkipped ? `
                    <span class="badge badge-warning" style="padding: 6px 12px; font-size: 12px">
                      <i class="fas fa-exclamation-triangle"></i> Skipped (${med.skipReason || 'Feeling Unwell'})
                    </span>
                    <button class="btn btn-ghost btn-sm" onclick="window.HospitalFlow.toggleMedication('${patient.id}', '${med.name}', '${med.timeSlot}', '${plan.id}')" title="Undo and mark taken">
                      <i class="fas fa-redo"></i> Mark Taken
                    </button>
                  ` : `
                    <button class="btn btn-success btn-sm" onclick="window.HospitalFlow.toggleMedication('${patient.id}', '${med.name}', '${med.timeSlot}', '${plan.id}')">
                      <i class="fas fa-check"></i> ${t('care.mark_taken_btn') || 'Mark Taken'}
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="window._showSkipMedicationModal('${patient.id}', '${med.name}', '${med.timeSlot}', '${plan.id}')">
                      <i class="fas fa-forward"></i> ${t('care.skip_dose_btn') || 'Skip Dose'}
                    </button>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- 5. Dietary & Recovery Protocol from Doctor -->
      ${plan.dietaryInstructions || plan.dietPlan || plan.recoveryInstructions || plan.instructions ? `
        <div class="card" style="margin-bottom: var(--space-6); background: #F8FAFC; border: 1px solid var(--border-light)">
          <div class="card-header flex justify-between items-center">
            <h3 class="card-title"><i class="fas fa-utensils" style="color: var(--teal)"></i> Dietary & Recovery Instructions</h3>
            <span class="badge badge-success"><i class="fas fa-check-circle"></i> Care Plan Sync</span>
          </div>
          <div class="grid-2" style="gap: var(--space-4); margin-top: var(--space-3)">
            <div class="card-inner-box" style="background: white; margin: 0">
              <div style="font-weight: 700; font-size: var(--font-size-xs); color: var(--teal); margin-bottom: 4px"><i class="fas fa-apple-alt"></i> Dietary Protocol:</div>
              <p style="margin: 0; font-size: var(--font-size-xs); color: var(--text); line-height: 1.6">
                ${escapeHtml(plan.dietaryInstructions || plan.dietPlan || 'Light meals, high fluid intake, avoid spicy foods.')}
              </p>
            </div>
            <div class="card-inner-box" style="background: white; margin: 0">
              <div style="font-weight: 700; font-size: var(--font-size-xs); color: var(--primary); margin-bottom: 4px"><i class="fas fa-bed"></i> Recovery Guidelines:</div>
              <p style="margin: 0; font-size: var(--font-size-xs); color: var(--text); line-height: 1.6">
                ${escapeHtml(plan.recoveryInstructions || plan.instructions || 'Adequate bed rest, avoid heavy lifting for 7 days, complete antibiotic course.')}
              </p>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- 6. 7-Day Adherence & Warning Signs Grid -->
      <div class="grid-2" style="gap: var(--space-5); margin-bottom: var(--space-6)">
        <!-- 7-Day Adherence History -->
        <div class="card">
          <div class="card-header flex justify-between items-center">
            <h3 class="card-title"><i class="fas fa-calendar-alt" style="color: var(--primary)"></i> 7-Day Adherence History</h3>
            <span class="badge badge-success">${adherence.rate}% Consistency</span>
          </div>

          <div style="margin-top: var(--space-4)">
            <div class="flex justify-between items-end" style="height: 100px; padding: 0 var(--space-2); gap: var(--space-2)">
              ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => {
                const height = idx === 3 ? '60%' : idx > 4 ? '0%' : '100%';
                const bg = idx === 3 ? 'var(--warning)' : idx > 4 ? 'var(--border)' : 'var(--success)';
                return `
                  <div style="flex: 1; display: flex; flex-col; align-items: center; gap: 4px; height: 100%; justify-content: flex-end">
                    <div style="width: 100%; height: ${height}; background: ${bg}; border-radius: 4px 4px 0 0; min-height: 4px"></div>
                    <span style="font-size: 10px; color: var(--text-secondary)">${day}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Warning Signs to Watch -->
        <div class="card" style="border-left: 4px solid var(--critical)">
          <div class="card-header flex justify-between items-center">
            <h3 class="card-title"><i class="fas fa-exclamation-triangle" style="color: var(--critical)"></i> Warning Signs to Watch</h3>
            <span class="badge badge-danger">High Priority</span>
          </div>

          <ul style="margin: var(--space-3) 0 0; padding-left: 20px; font-size: var(--font-size-xs); line-height: 1.8; color: var(--text-secondary)">
            ${(plan.warningSigns && plan.warningSigns.length > 0 ? plan.warningSigns : ['Fever above 101°F persisting for over 4 hours', 'Severe shortness of breath or chest heaviness', 'Sudden dizziness / fainting or loss of balance', 'Allergic reactions (skin rash, lip swelling)']).map(w => `<li><strong>${escapeHtml(w)}</strong></li>`).join('')}
          </ul>

          <div style="margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--border-light)">
            <button class="btn btn-danger btn-sm" style="width: 100%" onclick="window._showPostDischargeReportModal('${patient.id}')">
              <i class="fas fa-exclamation-circle"></i> Report Warning Sign to Hospital
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================
// PATIENT HEALTH IDENTITY PROFILE
// ============================================
function renderPatientProfilePage(el, patient) {
  const user = Auth.getCurrentUser();
  const displayEmail = user?.email || patient.email || 'patient@hospitalflow.ai';

  el.innerHTML = `
    <div class="patient-profile-layout animate-fade-in" style="max-width: 860px; margin: 0 auto">
      <!-- 1. Profile Header Hero Card -->
      <div class="card" style="margin-bottom: var(--space-6); background: linear-gradient(135deg, #EFF6FF 0%, #FFFFFF 100%); border: 1px solid var(--primary-border)">
        <div class="flex justify-between items-center" style="flex-wrap: wrap; gap: var(--space-4)">
          <div class="flex items-center gap-4">
            <div class="header-user-avatar" style="width: 64px; height: 64px; font-size: 24px; background: var(--primary); color: white">
              ${getInitials(patient.displayName)}
            </div>
            <div>
              <h2 style="margin: 0; font-size: var(--font-size-xl)">${escapeHtml(patient.displayName)}</h2>
              <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-top: 2px">
                Patient ID: <strong>${patient.id}</strong> · Preferred Language: <strong>${i18n.getLanguage() === 'hi' ? 'हिंदी' : 'English'}</strong>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="badge badge-success"><i class="fas fa-check-circle"></i> Profile Verified</span>
            <span class="badge badge-info">Auth Synchronized</span>
          </div>
        </div>
      </div>

      <!-- 2-Column Details Grid -->
      <div class="grid-2" style="gap: var(--space-6); margin-bottom: var(--space-6)">
        <!-- Personal Information -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-id-card"></i> Personal Information</h3>
          </div>
          <div class="flex flex-col gap-3" style="font-size: var(--font-size-xs)">
            <div class="flex justify-between border-b pb-1"><span>Full Name:</span> <strong>${escapeHtml(patient.displayName)}</strong></div>
            <div class="flex justify-between border-b pb-1"><span>Age / Gender:</span> <strong>${patient.age || 29} Yrs / ${patient.gender || 'Male'}</strong></div>
            <div class="flex justify-between border-b pb-1"><span>Blood Group:</span> <strong style="color: var(--critical)">${patient.bloodGroup || 'B+'}</strong></div>
            <div class="flex justify-between border-b pb-1"><span>Phone Number:</span> <strong>${patient.phone || '+91 9876543210'}</strong></div>
            <div class="flex justify-between"><span>Email Address:</span> <strong style="color: var(--primary)">${escapeHtml(displayEmail)}</strong></div>
          </div>
        </div>

        <!-- Emergency Contact Card -->
        <div class="card">
          <div class="card-header flex justify-between items-center">
            <h3 class="card-title"><i class="fas fa-phone-square-alt" style="color: var(--critical)"></i> Emergency Contact</h3>
            <a href="tel:+919876543299" class="btn btn-danger btn-sm"><i class="fas fa-phone-alt"></i> Call Contact</a>
          </div>
          <div class="flex flex-col gap-3" style="font-size: var(--font-size-xs)">
            <div class="flex justify-between border-b pb-1"><span>Contact Person:</span> <strong>Priya Kumar</strong></div>
            <div class="flex justify-between border-b pb-1"><span>Relationship:</span> <strong>Spouse</strong></div>
            <div class="flex justify-between border-b pb-1"><span>Primary Phone:</span> <strong>+91 9876543299</strong></div>
            <div class="flex justify-between"><span>Address:</span> <strong>Flat 402, Sunshine Apts, Andheri West</strong></div>
          </div>
        </div>
      </div>

      <!-- Health Information & Documents -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-folder-open"></i> Health Identity Documents & Records</h3>
        </div>
        <div class="grid-3" style="gap: var(--space-3); margin-top: var(--space-3)">
          <div class="card-inner-box" style="margin: 0">
            <div style="font-weight: 700; font-size: var(--font-size-sm)"><i class="fas fa-file-medical-alt" style="color: var(--primary)"></i> Discharge Summary</div>
            <div style="font-size: 11px; color: var(--text-secondary)">Plan DP-2048 · General Medicine</div>
            <button class="btn btn-primary btn-sm" style="margin-top: 8px; width: 100%" onclick="window._downloadDischargeSummary('${patient.id}')">
              <i class="fas fa-download"></i> Download Summary
            </button>
          </div>
          <div class="card-inner-box" style="margin: 0">
            <div style="font-weight: 700; font-size: var(--font-size-sm)"><i class="fas fa-pills" style="color: var(--teal)"></i> Prescription Record</div>
            <div style="font-size: 11px; color: var(--text-secondary)">Dr. Aarav Sharma · Prescribed Rx</div>
            <button class="btn btn-secondary btn-sm" style="margin-top: 8px; width: 100%" onclick="window._downloadPrescriptionRecord('${patient.id}')">
              <i class="fas fa-download"></i> Download Rx
            </button>
          </div>
          <div class="card-inner-box" style="margin: 0">
            <div style="font-weight: 700; font-size: var(--font-size-sm)"><i class="fas fa-qrcode" style="color: var(--success)"></i> Patient Health QR</div>
            <div style="font-size: 11px; color: var(--text-secondary)">Identity Token · ${patient.id}</div>
            <button class="btn btn-ghost btn-sm" style="margin-top: 8px; width: 100%" onclick="window._showAppointmentQRModal('${patient.id}')">
              <i class="fas fa-qrcode"></i> Show Token
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================
// EMERGENCY HELP WITH TWO ENTRY MODES (Controlled Form State)
// ============================================
function renderPatientEmergencyWorkflow(el, patient) {
  const s = appState.get();
  const myAmbReq = (s.ambulanceRequests || []).find(r => r.patientId === patient.id && r.status !== 'ARRIVED' && r.status !== 'CANCELLED');
  const myPreArrival = (s.preArrivalEmergencies || []).find(p => p.patientId === patient.id && p.status !== 'COMPLETED');

  // Initialize phone defaults if unset
  if (!emergencyFormState.self.phone && patient.phone) emergencyFormState.self.phone = patient.phone;
  if (!emergencyFormState.ambulance.phone && patient.phone) emergencyFormState.ambulance.phone = patient.phone;

  el.innerHTML = `
    <div class="patient-emergency-layout animate-fade-in" style="max-width: 960px; margin: 0 auto">
      <!-- Active Emergency Pre-Arrival Banner -->
      ${myPreArrival ? `
        <div class="card" style="border: 2px solid var(--critical-border); margin-bottom: var(--space-6); background: #FEF2F2">
          <div class="card-header flex justify-between items-center" style="border-bottom: 1px solid rgba(239, 68, 68, 0.2); padding-bottom: var(--space-3)">
            <div>
              <h3 class="card-title" style="color: #991B1B"><i class="fas fa-car-side"></i> Self-Arrival Emergency Active (${myPreArrival.caseId})</h3>
              <div class="card-subtitle">Hospital Trauma Team is alerted and preparing for your arrival</div>
            </div>
            <span class="badge badge-danger">PREPARING FOR ARRIVAL</span>
          </div>
          <div class="grid-3" style="margin: var(--space-4) 0">
            <div class="metric-card">
              <div class="kpi-icon red"><i class="fas fa-car-side"></i></div>
              <div class="kpi-content"><div class="kpi-label">Transport</div><div class="kpi-value" style="font-size: 16px">${myPreArrival.transportMode}</div></div>
            </div>
            <div class="metric-card">
              <div class="kpi-icon orange"><i class="fas fa-clock"></i></div>
              <div class="kpi-content"><div class="kpi-label">Expected Arrival</div><div class="kpi-value">~${myPreArrival.etaMinutes} min</div></div>
            </div>
            <div class="metric-card">
              <div class="kpi-icon green"><i class="fas fa-hospital-user"></i></div>
              <div class="kpi-content"><div class="kpi-label">Assigned Doctor</div><div class="kpi-value" style="font-size: 15px">Dr. Aarav Sharma</div></div>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Active Ambulance Request Banner -->
      ${myAmbReq ? `
        <div class="card" style="border: 2px solid var(--critical-border); margin-bottom: var(--space-6); background: #FEF2F2">
          <div class="card-header flex justify-between items-center" style="border-bottom: 1px solid rgba(239, 68, 68, 0.2); padding-bottom: var(--space-3)">
            <h3 class="card-title" style="color: #991B1B"><i class="fas fa-ambulance"></i> Active Hospital Ambulance Request (${myAmbReq.requestId})</h3>
            <span class="badge badge-danger">${myAmbReq.status}</span>
          </div>
          <div class="grid-3" style="margin: var(--space-4) 0">
            <div class="metric-card">
              <div class="kpi-icon red"><i class="fas fa-truck-medical"></i></div>
              <div class="kpi-content"><div class="kpi-label">Vehicle</div><div class="kpi-value" style="font-size: 16px">${myAmbReq.assignedAmbulanceId || 'Assigning...'}</div></div>
            </div>
            <div class="metric-card">
              <div class="kpi-icon orange"><i class="fas fa-stopwatch"></i></div>
              <div class="kpi-content"><div class="kpi-label">Pickup ETA</div><div class="kpi-value">~${myAmbReq.estimatedPickup || 8} min</div></div>
            </div>
            <div class="metric-card">
              <div class="kpi-icon green"><i class="fas fa-hospital"></i></div>
              <div class="kpi-content"><div class="kpi-label">Hospital ETA</div><div class="kpi-value">~${myAmbReq.estimatedHospitalArrival || 18} min</div></div>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Main 65% / 35% Layout -->
      <div style="display: grid; grid-template-columns: 1.8fr 1fr; gap: var(--space-6)">
        <!-- Left: Two Entry Modes -->
        <div>
          <!-- Mode 1: Private Vehicle / Self Arrival -->
          <div class="card" style="margin-bottom: var(--space-6); border: 2px solid var(--primary-border)">
            <div class="card-header" style="border-bottom: 1px solid var(--border-light); padding-bottom: var(--space-3)">
              <div class="flex items-center gap-2">
                <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--primary-100); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 18px">
                  <i class="fas fa-car-side"></i>
                </div>
                <div>
                  <h3 class="card-title" style="color: var(--primary)">Option 1: I Am Coming to the Hospital</h3>
                  <div class="card-subtitle">Private Vehicle / Self Arrival Pre-Arrival Triage Notification</div>
                </div>
              </div>
            </div>

            <form id="prearrival-self-form" style="padding-top: var(--space-4)">
              <div class="form-group">
                <label class="form-label">Primary Symptoms / Emergency Condition <span class="required">*</span></label>
                <input type="text" id="pre-symptoms" class="form-input" placeholder="e.g. Severe chest pain radiating to left arm, breathlessness" value="${escapeHtml(emergencyFormState.self.symptoms)}" required>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Severity Level <span class="required">*</span></label>
                  <select id="pre-severity" class="form-select">
                    <option value="Critical" ${emergencyFormState.self.severity === 'Critical' ? 'selected' : ''}>Critical (Severe Distress / Trauma)</option>
                    <option value="Urgent" ${emergencyFormState.self.severity === 'Urgent' ? 'selected' : ''}>Urgent Priority</option>
                    <option value="Moderate" ${emergencyFormState.self.severity === 'Moderate' ? 'selected' : ''}>Moderate</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Estimated Arrival Time (Minutes) <span class="required">*</span></label>
                  <input type="number" id="pre-eta" class="form-input" value="${escapeHtml(emergencyFormState.self.eta || '14')}" min="2" max="60" required>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Consciousness</label>
                  <select id="pre-consciousness" class="form-select">
                    <option value="Conscious" ${emergencyFormState.self.consciousness === 'Conscious' ? 'selected' : ''}>Fully Alert / Conscious</option>
                    <option value="Confused" ${emergencyFormState.self.consciousness === 'Confused' ? 'selected' : ''}>Confused / Drowsy</option>
                    <option value="Unconscious" ${emergencyFormState.self.consciousness === 'Unconscious' ? 'selected' : ''}>Unconscious / Unresponsive</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Breathing Difficulty</label>
                  <select id="pre-breathing" class="form-select">
                    <option value="None" ${emergencyFormState.self.breathing === 'None' ? 'selected' : ''}>None / Normal</option>
                    <option value="Mild" ${emergencyFormState.self.breathing === 'Mild' ? 'selected' : ''}>Mild</option>
                    <option value="Severe" ${emergencyFormState.self.breathing === 'Severe' ? 'selected' : ''}>Severe Gasping / Choking</option>
                  </select>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Major Bleeding</label>
                  <select id="pre-bleeding" class="form-select">
                    <option value="No" ${emergencyFormState.self.bleeding === 'No' ? 'selected' : ''}>No active bleeding</option>
                    <option value="Yes" ${emergencyFormState.self.bleeding === 'Yes' ? 'selected' : ''}>Yes (External Trauma)</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Contact Phone</label>
                  <input type="tel" id="pre-phone" class="form-input" value="${escapeHtml(emergencyFormState.self.phone)}" required>
                </div>
              </div>

              <button type="submit" class="btn btn-primary btn-lg" style="width: 100%; margin-top: var(--space-2)">
                <i class="fas fa-bell"></i> Notify Hospital: I Am on the Way (~${emergencyFormState.self.eta || 14} min)
              </button>
            </form>
          </div>

          <!-- Mode 2: Request Hospital Ambulance -->
          <div class="card" style="border: 2px solid var(--critical-border)">
            <div class="card-header" style="border-bottom: 1px solid var(--border-light); padding-bottom: var(--space-3)">
              <div class="flex items-center gap-2">
                <div style="width: 36px; height: 36px; border-radius: 50%; background: #FEE2E2; color: var(--critical); display: flex; align-items: center; justify-content: center; font-size: 18px">
                  <i class="fas fa-truck-medical"></i>
                </div>
                <div>
                  <h3 class="card-title" style="color: var(--critical)">Option 2: Request Hospital Ambulance</h3>
                  <div class="card-subtitle">Hospital fleet dispatch with live telemetry and GPS tracking</div>
                </div>
              </div>
            </div>

            <form id="patient-ambulance-request-form" style="padding-top: var(--space-4)">
              <div class="form-group">
                <label class="form-label">Pickup Address / Location <span class="required">*</span></label>
                <input type="text" id="amb-pickup-loc" class="form-input" placeholder="e.g. Flat 402, Sunshine Apts, Andheri West" value="${escapeHtml(emergencyFormState.ambulance.pickupLoc)}" required>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Contact Phone <span class="required">*</span></label>
                  <input type="tel" id="amb-phone" class="form-input" value="${escapeHtml(emergencyFormState.ambulance.phone)}" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Emergency Symptoms <span class="required">*</span></label>
                  <input type="text" id="amb-symptoms" class="form-input" placeholder="e.g. Acute chest pain, shortness of breath" value="${escapeHtml(emergencyFormState.ambulance.symptoms)}" required>
                </div>
              </div>
              <button type="submit" class="btn btn-danger btn-lg" style="width: 100%; margin-top: var(--space-2)">
                <i class="fas fa-truck-medical"></i> Request Hospital Ambulance
              </button>
            </form>
          </div>
        </div>

        <!-- Right 35%: Emergency Readiness & First Aid Guide -->
        <div>
          <!-- Direct Emergency Hotline -->
          <div class="card" style="background: linear-gradient(135deg, #FEF2F2 0%, #FFFFFF 100%); border: 1px solid #FECACA; margin-bottom: var(--space-5)">
            <div class="flex items-center gap-3">
              <div style="width: 44px; height: 44px; border-radius: 50%; background: var(--critical); color: white; display: flex; align-items: center; justify-content: center; font-size: 20px">
                <i class="fas fa-phone-alt"></i>
              </div>
              <div>
                <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary)">24/7 EMERGENCY HOTLINE</div>
                <div style="font-size: 20px; font-weight: 800; color: var(--critical)">108 / +91 9876543299</div>
              </div>
            </div>
          </div>

          <!-- Pre-Arrival Hospital Status -->
          <div class="card" style="margin-bottom: var(--space-5)">
            <h4 style="font-size: var(--font-size-sm); margin-bottom: var(--space-3)"><i class="fas fa-hospital-alt" style="color: var(--primary)"></i> Trauma Center Readiness</h4>
            <div class="flex flex-col gap-2" style="font-size: var(--font-size-xs)">
              <div class="flex justify-between border-b pb-1"><span>Emergency Bays:</span> <strong style="color: var(--success)">2 Available</strong></div>
              <div class="flex justify-between border-b pb-1"><span>On-Duty Doctor:</span> <strong>Dr. Aarav Sharma</strong></div>
              <div class="flex justify-between border-b pb-1"><span>Trauma Team:</span> <strong>Active Standby</strong></div>
              <div class="flex justify-between"><span>Blood Reserves:</span> <strong>FEFO Ready (All 8 Groups)</strong></div>
            </div>
          </div>

          <!-- Immediate First-Aid Guidance -->
          <div class="card">
            <h4 style="font-size: var(--font-size-sm); margin-bottom: var(--space-3)"><i class="fas fa-first-aid" style="color: var(--critical)"></i> Immediate Guidance While in Transit</h4>
            <ul style="margin: 0; padding-left: 18px; font-size: var(--font-size-xs); line-height: 1.6; color: var(--text-secondary)">
              <li><strong>Stay Calm:</strong> Keep the patient seated upright if experiencing breathlessness.</li>
              <li><strong>Loosen Tight Clothing:</strong> Ensure airway is completely clear.</li>
              <li><strong>Do not administer unprescribed solid foods or fluids</strong> until evaluated by ER doctor.</li>
              <li><strong>Keep medical identity or token ready</strong> for instant triage intake upon arrival.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `;

  // Real-time input synchronization to prevent any keystroke loss
  const selfForm = el.querySelector('#prearrival-self-form');
  if (selfForm) {
    selfForm.querySelectorAll('input, select').forEach(input => {
      const syncHandler = () => {
        const id = input.id;
        if (id === 'pre-symptoms') emergencyFormState.self.symptoms = input.value;
        if (id === 'pre-severity') emergencyFormState.self.severity = input.value;
        if (id === 'pre-eta') emergencyFormState.self.eta = input.value;
        if (id === 'pre-consciousness') emergencyFormState.self.consciousness = input.value;
        if (id === 'pre-breathing') emergencyFormState.self.breathing = input.value;
        if (id === 'pre-bleeding') emergencyFormState.self.bleeding = input.value;
        if (id === 'pre-phone') emergencyFormState.self.phone = input.value;
      };
      input.addEventListener('input', syncHandler);
      input.addEventListener('change', syncHandler);
    });

    selfForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const symptoms = el.querySelector('#pre-symptoms').value.trim();
      const severity = el.querySelector('#pre-severity').value;
      const eta = el.querySelector('#pre-eta').value;
      const consciousness = el.querySelector('#pre-consciousness').value;
      const breathing = el.querySelector('#pre-breathing').value;
      const bleeding = el.querySelector('#pre-bleeding').value;
      const phone = el.querySelector('#pre-phone').value.trim();

      FlowEngine.createPreArrivalEmergency({
        patientId: patient.id,
        patientName: patient.displayName,
        transportMode: 'Private Vehicle',
        location: 'En route to hospital',
        symptoms,
        severity,
        etaMinutes: eta,
        phone,
        consciousness,
        breathingDifficulty: breathing,
        majorBleeding: bleeding
      });

      // Clear state only on successful submission
      emergencyFormState.self = {
        symptoms: '',
        severity: 'Critical',
        eta: '14',
        consciousness: 'Conscious',
        breathing: 'None',
        bleeding: 'No',
        phone: patient.phone || ''
      };

      alert('Pre-Arrival emergency alert sent. Hospital Emergency Command Center and Doctor have been notified.');
      renderPatientEmergencyWorkflow(el, patient);
    });
  }

  const ambForm = el.querySelector('#patient-ambulance-request-form');
  if (ambForm) {
    ambForm.querySelectorAll('input, select').forEach(input => {
      const syncHandler = () => {
        const id = input.id;
        if (id === 'amb-pickup-loc') emergencyFormState.ambulance.pickupLoc = input.value;
        if (id === 'amb-phone') emergencyFormState.ambulance.phone = input.value;
        if (id === 'amb-symptoms') emergencyFormState.ambulance.symptoms = input.value;
      };
      input.addEventListener('input', syncHandler);
      input.addEventListener('change', syncHandler);
    });

    ambForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const req = FlowEngine.requestHospitalAmbulance({
        patientId: patient.id,
        patientName: patient.displayName,
        pickupLocation: el.querySelector('#amb-pickup-loc').value.trim(),
        contactNumber: el.querySelector('#amb-phone').value.trim(),
        symptoms: el.querySelector('#amb-symptoms').value.trim(),
        severity: 'Critical'
      });

      emergencyFormState.ambulance = {
        pickupLoc: '',
        phone: patient.phone || '',
        symptoms: '',
        severity: 'Critical'
      };

      alert(`Ambulance request ${req.requestId} submitted. Hospital Command Center alerted.`);
      renderPatientEmergencyWorkflow(el, patient);
    });
  }
}

// Download Discharge Summary Implementation
window._downloadDischargeSummary = (patientId) => {
  const s = appState.get();
  const user = Auth.getCurrentUser();
  const patient = s.patients.find(p => p.id === patientId) || {
    id: patientId,
    displayName: user?.displayName || 'Amit Kumar',
    age: 29,
    gender: 'Male',
    phone: '+91 9876543210',
    bloodGroup: 'B+'
  };
  const plan = s.dischargePlans.find(dp => dp.patientId === patientId) || s.dischargePlans[0] || {
    id: 'DP-2048',
    dischargeDate: new Date().toISOString(),
    approvedBy: 'D-0001',
    medications: [
      { name: 'Azithromycin 500mg', dosage: '1 tablet', timeSlot: 'Morning', duration: '5 days', instructions: 'After breakfast' },
      { name: 'Paracetamol 650mg', dosage: '1 tablet (SOS)', timeSlot: 'Night', duration: 'As needed', instructions: 'If fever > 100°F' }
    ],
    dietPlan: 'Light meals, high fluid intake, avoid spicy foods.',
    dietaryInstructions: 'Light meals, high fluid intake, avoid spicy foods.',
    instructions: 'Adequate rest, avoid strenuous exercise for 1 week.',
    warningSigns: ['Fever above 101°F', 'Persistent breathlessness', 'Dizziness or confusion'],
    followUp: { department: 'General Medicine', date: 'In 7 Days', time: '10:00 AM' }
  };
  const doc = s.doctors.find(d => d.id === plan.approvedBy) || s.doctors[0] || { displayName: 'Aarav Sharma', specialty: 'General Medicine', id: 'D-0001' };

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Discharge Summary - ${escapeHtml(patient.displayName)} (${patient.id})</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #0F172A; line-height: 1.5; max-width: 800px; margin: 0 auto; background: #fff; }
    .header { border-bottom: 2px solid #0284C7; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
    .hospital-title { font-size: 24px; font-weight: 800; color: #0284C7; }
    .hospital-sub { font-size: 12px; color: #64748B; }
    .doc-type { font-size: 18px; font-weight: 700; color: #1E293B; margin-top: 8px; }
    .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .meta-table td { padding: 8px; border: 1px solid #E2E8F0; font-size: 13px; }
    .meta-label { font-weight: 700; background: #F8FAFC; width: 25%; color: #475569; }
    h3 { font-size: 15px; color: #0369A1; border-bottom: 1px solid #E2E8F0; padding-bottom: 6px; margin-top: 20px; }
    table.med-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
    table.med-table th { background: #F1F5F9; text-align: left; padding: 8px; border: 1px solid #CBD5E1; }
    table.med-table td { padding: 8px; border: 1px solid #E2E8F0; }
    ul { margin: 8px 0; padding-left: 20px; font-size: 13px; color: #334155; }
    .footer { margin-top: 40px; border-top: 1px solid #E2E8F0; padding-top: 16px; display: flex; justify-content: space-between; font-size: 12px; color: #64748B; }
    .stamp { border: 2px dashed #0284C7; color: #0284C7; font-weight: 700; padding: 8px 16px; border-radius: 6px; display: inline-block; font-size: 12px; }
    @media print { body { padding: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; text-align: right;">
    <button onclick="window.print()" style="padding: 8px 16px; background: #0284C7; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">🖨️ Print / Save PDF</button>
  </div>
  <div class="header">
    <div>
      <div class="hospital-title">🏥 HospitalFlow AI Medical Center</div>
      <div class="hospital-sub">NABH Accredited Tertiary Care Hospital · 24x7 Emergency Services</div>
      <div class="doc-type">CLINICAL DISCHARGE SUMMARY</div>
    </div>
    <div style="text-align: right; font-size: 12px; color: #64748B;">
      Plan ID: <strong>${plan.id || 'DP-2048'}</strong><br>
      Date: <strong>${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
    </div>
  </div>

  <table class="meta-table">
    <tr>
      <td class="meta-label">Patient Name</td>
      <td><strong>${escapeHtml(patient.displayName)}</strong></td>
      <td class="meta-label">Patient ID</td>
      <td><strong>${patient.id}</strong></td>
    </tr>
    <tr>
      <td class="meta-label">Age / Gender</td>
      <td>${patient.age || 29} Yrs / ${patient.gender || 'Male'}</td>
      <td class="meta-label">Blood Group</td>
      <td><strong style="color: #DC2626">${patient.bloodGroup || 'B+'}</strong></td>
    </tr>
    <tr>
      <td class="meta-label">Attending Physician</td>
      <td><strong>Dr. ${escapeHtml(doc.displayName)}</strong> (${escapeHtml(doc.specialty || 'General Medicine')})</td>
      <td class="meta-label">Contact Phone</td>
      <td>${patient.phone || '+91 9876543210'}</td>
    </tr>
  </table>

  <h3>1. Discharge Medications & Prescription</h3>
  <table class="med-table">
    <thead>
      <tr>
        <th>Medication</th>
        <th>Dosage</th>
        <th>Timing / Slot</th>
        <th>Duration</th>
        <th>Food Relation</th>
      </tr>
    </thead>
    <tbody>
      ${(plan.medications || []).map(m => `
        <tr>
          <td><strong>${escapeHtml(m.name)}</strong></td>
          <td>${escapeHtml(m.dosage || '1 dose')}</td>
          <td>${escapeHtml(m.timeSlot || m.timing || 'Daily')}</td>
          <td>${escapeHtml(m.duration || '5 days')}</td>
          <td>${escapeHtml(m.instructions || 'After food')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h3>2. Dietary & Nutrition Instructions</h3>
  <p style="font-size: 13px; color: #334155; margin: 6px 0;">
    ${escapeHtml(plan.dietaryInstructions || plan.dietPlan || 'Light meals, high fluid intake (2-3L water/day), avoid spicy or greasy foods.')}
  </p>

  <h3>3. Recovery & Activity Guidelines</h3>
  <p style="font-size: 13px; color: #334155; margin: 6px 0;">
    ${escapeHtml(plan.recoveryInstructions || plan.instructions || 'Strict bed rest for 48 hours. Avoid heavy physical lifting. Resume routine activities gradually.')}
  </p>

  <h3>4. Warning Signs Requiring Immediate Hospital Re-Entry</h3>
  <ul>
    ${(plan.warningSigns && plan.warningSigns.length > 0 ? plan.warningSigns : ['Fever exceeding 101°F for over 4 hours', 'Acute shortness of breath or chest heaviness', 'Sudden dizziness, severe nausea, or allergic rash']).map(w => `<li><strong>${escapeHtml(w)}</strong></li>`).join('')}
  </ul>

  <h3>5. Scheduled Clinical Follow-Up</h3>
  <p style="font-size: 13px; color: #334155; margin: 6px 0;">
    Scheduled with <strong>${escapeHtml(plan.followUp?.department || 'General Medicine')}</strong> on <strong>${plan.followUp?.date ? (plan.followUp.date) : 'In 7 Days'}</strong> at <strong>${plan.followUp?.time || '10:00 AM'}</strong>.
  </p>

  <div class="footer">
    <div>
      <div class="stamp">✓ CLINICALLY AUTHORIZED</div>
      <div style="font-size: 11px; margin-top: 4px;">HospitalFlow AI Digital Health Records</div>
    </div>
    <div style="text-align: right;">
      <div style="font-weight: 700;">Dr. ${escapeHtml(doc.displayName)}</div>
      <div style="font-size: 11px;">MCI Reg #${doc.registrationNo || 'MCI-58492-A'}</div>
      <div style="font-size: 11px; color: #94A3B8;">Digital Signature Verified</div>
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Discharge_Summary_${patient.id}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  const printWindow = window.open(url, '_blank');
  if (printWindow) printWindow.focus();
};

// Download Prescription Record Implementation
window._downloadPrescriptionRecord = (patientId) => {
  const s = appState.get();
  const user = Auth.getCurrentUser();
  const patient = s.patients.find(p => p.id === patientId) || {
    id: patientId,
    displayName: user?.displayName || 'Amit Kumar',
    age: 29,
    gender: 'Male',
    phone: '+91 9876543210',
    bloodGroup: 'B+'
  };
  const plan = s.dischargePlans.find(dp => dp.patientId === patientId) || s.dischargePlans[0] || {
    id: 'DP-2048',
    approvedBy: 'D-0001',
    medications: [
      { name: 'Azithromycin 500mg', dosage: '1 tablet', timeSlot: 'Morning', duration: '5 days', instructions: 'After breakfast' },
      { name: 'Paracetamol 650mg', dosage: '1 tablet (SOS)', timeSlot: 'Night', duration: 'As needed', instructions: 'If fever > 100°F' }
    ]
  };
  const doc = s.doctors.find(d => d.id === plan.approvedBy) || s.doctors[0] || { displayName: 'Aarav Sharma', specialty: 'General Medicine', id: 'D-0001' };

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Prescription Record - ${escapeHtml(patient.displayName)} (${patient.id})</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #0F172A; line-height: 1.5; max-width: 800px; margin: 0 auto; background: #fff; }
    .header { border-bottom: 2px solid #0D9488; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; }
    .rx-symbol { font-size: 32px; font-weight: 800; color: #0D9488; font-family: serif; }
    .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .meta-table td { padding: 8px; border: 1px solid #E2E8F0; font-size: 13px; }
    .meta-label { font-weight: 700; background: #F8FAFC; width: 25%; color: #475569; }
    table.med-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
    table.med-table th { background: #F0FDFA; color: #0F766E; text-align: left; padding: 8px; border: 1px solid #CCFBF1; }
    table.med-table td { padding: 8px; border: 1px solid #E2E8F0; }
    .footer { margin-top: 40px; border-top: 1px solid #E2E8F0; padding-top: 16px; display: flex; justify-content: space-between; font-size: 12px; color: #64748B; }
    @media print { body { padding: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; text-align: right;">
    <button onclick="window.print()" style="padding: 8px 16px; background: #0D9488; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">🖨️ Print Prescription</button>
  </div>
  <div class="header">
    <div>
      <div style="font-size: 20px; font-weight: 800; color: #0F766E;">Dr. ${escapeHtml(doc.displayName)}</div>
      <div style="font-size: 12px; color: #64748B;">MBBS, MD (${escapeHtml(doc.specialty || 'General Medicine')}) · Reg #${doc.registrationNo || 'MCI-58492-A'}</div>
      <div style="font-size: 12px; color: #64748B;">HospitalFlow AI Clinical Health System</div>
    </div>
    <div style="text-align: right; font-size: 12px; color: #64748B;">
      <div>Date: <strong>${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div>
      <div class="rx-symbol">℞</div>
    </div>
  </div>

  <table class="meta-table">
    <tr>
      <td class="meta-label">Patient Name</td>
      <td><strong>${escapeHtml(patient.displayName)}</strong></td>
      <td class="meta-label">Patient ID</td>
      <td><strong>${patient.id}</strong></td>
    </tr>
    <tr>
      <td class="meta-label">Age / Gender</td>
      <td>${patient.age || 29} Yrs / ${patient.gender || 'Male'}</td>
      <td class="meta-label">Blood Group</td>
      <td><strong style="color: #DC2626">${patient.bloodGroup || 'B+'}</strong></td>
    </tr>
  </table>

  <h3 style="color: #0F766E; font-size: 15px; margin-top: 16px;">Prescribed Medications (Rx)</h3>
  <table class="med-table">
    <thead>
      <tr>
        <th>#</th>
        <th>Medicine Name & Strength</th>
        <th>Dose</th>
        <th>Frequency / Timing</th>
        <th>Duration</th>
        <th>Instructions</th>
      </tr>
    </thead>
    <tbody>
      ${(plan.medications || []).map((m, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${escapeHtml(m.name)}</strong></td>
          <td>${escapeHtml(m.dosage || '1 tablet')}</td>
          <td>${escapeHtml(m.timeSlot || m.timing || 'Daily')}</td>
          <td>${escapeHtml(m.duration || '5 days')}</td>
          <td>${escapeHtml(m.instructions || 'After food')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div style="margin-top: 24px; padding: 12px; background: #F8FAFC; border-radius: 6px; font-size: 12px; color: #475569;">
    <strong>Special Clinical Notes:</strong><br>
    Please adhere strictly to the timing instructions. In case of allergic reactions, discontinue and report to hospital emergency immediately.
  </div>

  <div class="footer">
    <div>HospitalFlow AI Verified E-Prescription</div>
    <div style="text-align: right;">
      <div style="font-weight: 700;">Dr. ${escapeHtml(doc.displayName)}</div>
      <div style="font-size: 11px; color: #94A3B8;">Digitally Signed & Validated</div>
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Prescription_${patient.id}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  const printWindow = window.open(url, '_blank');
  if (printWindow) printWindow.focus();
};

// Skip Medication Modal
window._showSkipMedicationModal = (patientId, medName, timeSlot) => {
  const modalRoot = document.getElementById('patient-modal-root') || document.body;
  modalRoot.innerHTML = `
    <div class="modal-backdrop active">
      <div class="modal active" style="max-width: 440px">
        <div class="modal-header">
          <h3 class="modal-title" style="color: var(--warning)"><i class="fas fa-forward"></i> ${t('care.skip_modal_title') || 'Record Reason for Skipping Dose'}</h3>
          <button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
        </div>
        <form id="skip-med-form">
          <div class="modal-body">
            <p style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-bottom: var(--space-3)">
              Please record why you are skipping <strong>${escapeHtml(medName)}</strong> (${timeSlot}). This information helps your doctor optimize your care.
            </p>
            <div class="form-group">
              <label class="form-label">Select Reason <span class="required">*</span></label>
              <select id="skip-reason-select" class="form-select" required>
                <option value="Forgot / Missed Time">${t('care.skip_reason_forgot') || 'Forgot / Missed Time'}</option>
                <option value="Feeling Unwell / Nauseous">${t('care.skip_reason_unwell') || 'Feeling Unwell / Nauseous'}</option>
                <option value="Medicine Not Available">${t('care.skip_reason_unavailable') || 'Medicine Not Available'}</option>
                <option value="Doctor Advised">${t('care.skip_reason_advised') || 'Doctor / Pharmacist Advised'}</option>
                <option value="Other">${t('care.skip_reason_other') || 'Other Reason'}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Additional Note (Optional)</label>
              <input type="text" id="skip-note" class="form-input" placeholder="e.g. Experiencing mild stomach upset">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
            <button type="submit" class="btn btn-warning"><i class="fas fa-check"></i> Record Skipped Dose</button>
          </div>
        </form>
      </div>
    </div>
  `;

  modalRoot.querySelector('#skip-med-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const reason = modalRoot.querySelector('#skip-reason-select').value;
    CareEngine.recordSkippedMedication(patientId, medName, timeSlot, reason);
    modalRoot.innerHTML = '';
    const subContentEl = document.querySelector('#patient-sub-content');
    const user = Auth.getCurrentUser();
    const patient = appState.get().patients.find(p => p.id === patientId) || { id: patientId, displayName: user?.displayName || 'Patient' };
    if (subContentEl) renderPatientCare(subContentEl, patient);
  });
};

// Missed Dose Instructions Modal
window._showMissedDoseInstructionsModal = (patientId) => {
  const modalRoot = document.getElementById('patient-modal-root') || document.body;
  modalRoot.innerHTML = `
    <div class="modal-backdrop active">
      <div class="modal active" style="max-width: 500px">
        <div class="modal-header">
          <h3 class="modal-title" style="color: var(--primary)"><i class="fas fa-book-medical"></i> Physician Prescription & Safety Guidelines</h3>
          <button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
        </div>
        <div class="modal-body" style="font-size: var(--font-size-xs); line-height: 1.6; color: var(--text-secondary)">
          <div class="card-inner-box" style="background: #EFF6FF; border: 1px solid #BFDBFE; margin-bottom: var(--space-3); color: #1E40AF">
            <strong>Clinical Rule for Missed Dosages:</strong><br>
            • If you remember within 2 hours of scheduled time, take the prescribed dose immediately.<br>
            • If it is almost time for your next scheduled dose, skip the missed dose completely.<br>
            • <strong>NEVER take a double dose</strong> to make up for a missed one.
          </div>
          <div class="form-group">
            <label class="form-label" style="font-weight: 700">Special Instructions from Dr. Aarav Sharma:</label>
            <p style="margin: 4px 0">Take Azithromycin strictly after breakfast. Stay hydrated with warm fluids. If symptoms worsen, report via home problem reporting immediately.</p>
          </div>
        </div>
        <div class="modal-footer">
          <a href="tel:+919876543210" class="btn btn-secondary btn-sm"><i class="fas fa-phone-alt"></i> Call Clinic</a>
          <button class="btn btn-primary btn-sm" onclick="this.closest('.modal-backdrop').remove()">Close Instructions</button>
        </div>
      </div>
    </div>
  `;
};

// Post-Discharge Report Problem Modal
window._showPostDischargeReportModal = (patientId) => {
  const modalRoot = document.getElementById('patient-modal-root') || document.body;
  modalRoot.innerHTML = `
    <div class="modal-backdrop active">
      <div class="modal active" style="max-width: 480px">
        <div class="modal-header">
          <h3 class="modal-title" style="color: var(--warning)"><i class="fas fa-flag"></i> ${t('care.report_home_problem') || 'Report a Problem from Home'}</h3>
          <button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
        </div>
        <form id="post-discharge-report-form">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Reported Condition / Symptom <span class="required">*</span></label>
              <select id="pdr-condition" class="form-select" required>
                <option value="Persistent High Fever">Persistent High Fever</option>
                <option value="Severe Breathing Difficulty">Severe Breathing Difficulty</option>
                <option value="Severe Dizziness / Fainting">Severe Dizziness / Fainting</option>
                <option value="Medication Side Effect / Rash">Medication Side Effect / Rash</option>
                <option value="Extreme Pain">Extreme Pain</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Severity Level</label>
              <select id="pdr-severity" class="form-select">
                <option value="Moderate">Moderate (Review within 24h)</option>
                <option value="Severe">Severe (Urgent Attention Required)</option>
                <option value="Mild">Mild</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Description of Symptoms</label>
              <textarea id="pdr-desc" class="form-textarea" rows="3" placeholder="Describe what you are experiencing..." required></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
            <button type="submit" class="btn btn-warning"><i class="fas fa-paper-plane"></i> Submit to Care Team</button>
          </div>
        </form>
      </div>
    </div>
  `;

  modalRoot.querySelector('#post-discharge-report-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const cond = modalRoot.querySelector('#pdr-condition').value;
    const sev = modalRoot.querySelector('#pdr-severity').value;
    const desc = modalRoot.querySelector('#pdr-desc').value;

    const report = {
      id: `pdr-${Date.now()}`,
      patientId,
      patientName: 'Amit Kumar',
      doctorId: 'D-0001',
      condition: cond,
      severity: sev,
      description: desc,
      status: 'Needs Review',
      createdAt: new Date().toISOString()
    };

    appState.addItem('postDischargeReports', report);
    eventBus.emit(EventTypes.POST_DISCHARGE_REPORT_CREATED, report);

    modalRoot.innerHTML = '';
alert('Problem report submitted. Your physician and hospital care team have been alerted.');
  });
};

window._showAppointmentQRModal = (appointmentId) => {
  const modalRoot = document.getElementById('patient-modal-root') || document.body;
  modalRoot.innerHTML = `
    <div class="modal-backdrop active">
      <div class="modal active" style="max-width: 380px; text-align: center">
        <div class="modal-header">
          <h3 class="modal-title"><i class="fas fa-qrcode"></i> Express Check-In QR</h3>
          <button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
        </div>
        <div class="modal-body" style="padding: var(--space-6)">
          <div id="modal-qr-container" style="display: inline-block; padding: 12px; background: white; border-radius: var(--radius-lg); box-shadow: var(--shadow-sm)"></div>
          <div style="margin-top: var(--space-3); font-weight: 800; font-family: monospace; font-size: 16px">${appointmentId}</div>
          <p style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-top: 4px">Present at hospital reception for express check-in.</p>
        </div>
        <div class="modal-footer" style="justify-content: center">
          <button class="btn btn-primary btn-sm" onclick="window.HospitalFlow.checkInPatient('${appointmentId}')"><i class="fas fa-check"></i> Check-In Now</button>
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-backdrop').remove()">Close</button>
        </div>
      </div>
    </div>
  `;

  if (typeof QRCode !== 'undefined') {
    new QRCode(modalRoot.querySelector('#modal-qr-container'), {
      text: appointmentId,
      width: 160,
      height: 160,
      colorDark: '#0F172A',
      colorLight: '#ffffff'
    });
  }
};

// Book New Appointment Modal with Multilingual AI Symptom Translator
window._showBookAppointmentModal = (patientId) => {
  const s = appState.get();
  const modalRoot = document.getElementById('patient-modal-root') || document.body;
  const user = Auth.getCurrentUser();
  const pt = s.patients.find(p => p.id === patientId) || { id: patientId, displayName: user?.displayName || 'Patient' };

  modalRoot.innerHTML = `
    <div class="modal-backdrop active">
      <div class="modal active" style="max-width: 620px; max-height: 90vh; overflow-y: auto">
        <div class="modal-header" style="border-bottom: 2px solid var(--primary-100)">
          <div>
            <h3 class="modal-title" style="color: var(--primary)"><i class="fas fa-calendar-plus"></i> ${t('patient.book_new_apt') || 'Book New Consultation'}</h3>
            <div class="card-subtitle">AI Multilingual Symptom Normalizer & Clinical Routing</div>
          </div>
          <button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
        </div>
        <form id="patient-book-apt-form">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Patient Identity</label>
              <input type="text" class="form-input" value="${escapeHtml(pt.displayName)} (${pt.id})" disabled style="background: var(--bg-subtle)">
            </div>

            <!-- Reported Symptoms / Reason for Visit -->
            <div class="form-group">
              <div class="flex justify-between items-center" style="margin-bottom: 6px">
                <label class="form-label" style="font-weight: 700; color: var(--primary); margin: 0">
                  <i class="fas fa-language"></i> Describe Symptoms / तकलीफ बताएं (Hindi / English) <span class="required">*</span>
                </label>
                <span class="badge badge-teal" style="font-size: 10px"><i class="fas fa-robot"></i> AI Auto-Translate & Clinical Triage</span>
              </div>
              <textarea id="book-symptoms" class="form-textarea" rows="2" placeholder="e.g. 2 din se tez bukhar, khasi aur gale me dard hai (or in English: High fever and sore throat)" required></textarea>

              <!-- Quick Common Symptom Tag Chips -->
              <div style="margin-top: 8px">
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 4px">Quick Symptom Tags (Click to Add):</div>
                <div class="flex flex-wrap gap-1" id="symptom-tag-chips">
                  <button type="button" class="badge" style="cursor: pointer; background: var(--bg-subtle); border: 1px solid var(--border)" data-symptom="Fever (बुखार)">+ Fever / बुखार</button>
                  <button type="button" class="badge" style="cursor: pointer; background: var(--bg-subtle); border: 1px solid var(--border)" data-symptom="Cough (खांसी)">+ Cough / खांसी</button>
                  <button type="button" class="badge" style="cursor: pointer; background: var(--bg-subtle); border: 1px solid var(--border)" data-symptom="Headache (सिर दर्द)">+ Headache / सिर दर्द</button>
                  <button type="button" class="badge" style="cursor: pointer; background: var(--bg-subtle); border: 1px solid var(--border)" data-symptom="Abdominal Pain (पेट दर्द)">+ Stomach Pain / पेट दर्द</button>
                  <button type="button" class="badge" style="cursor: pointer; background: var(--bg-subtle); border: 1px solid var(--border)" data-symptom="Chest Pain (सीने में दर्द)">+ Chest Pain / सीने में दर्द</button>
                  <button type="button" class="badge" style="cursor: pointer; background: var(--bg-subtle); border: 1px solid var(--border)" data-symptom="Vomiting (उल्टी)">+ Vomiting / उल्टी</button>
                  <button type="button" class="badge" style="cursor: pointer; background: var(--bg-subtle); border: 1px solid var(--border)" data-symptom="Skin Rash (त्वचा पर चकत्ते)">+ Rash / खुजली</button>
                </div>
              </div>

              <!-- Real-Time AI Normalization & Translation Preview Box -->
              <div id="ai-symptom-preview" style="display: none; margin-top: 10px; padding: 10px 14px; background: #F0FDF4; border: 1px solid #86EFAC; border-radius: 8px">
                <div class="flex items-center gap-2" style="margin-bottom: 4px">
                  <i class="fas fa-brain" style="color: #166534"></i>
                  <strong style="font-size: 12px; color: #166534">AI Clinical Standardization & Translation:</strong>
                  <span id="ai-lang-badge" class="badge badge-success" style="font-size: 10px; margin-left: auto">Hindi Detected</span>
                </div>
                <div id="ai-clinical-text" style="font-size: 12px; font-weight: 600; color: #14532D; margin-bottom: 6px"></div>
                <div class="flex flex-wrap gap-1 items-center" id="ai-concepts-container"></div>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Recommended Department <span class="required">*</span></label>
                <select id="book-dept-select" class="form-select" required>
                  ${Config.DEPARTMENTS.map(d => `<option value="${d}">${d}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Consulting Doctor</label>
                <select id="book-doc-select" class="form-select">
                  ${s.doctors.map(doc => `<option value="${doc.id}">Dr. ${escapeHtml(doc.displayName)} (${doc.department})</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Consultation Date <span class="required">*</span></label>
                <input type="date" id="book-date" class="form-input" value="${new Date().toISOString().split('T')[0]}" required>
              </div>
              <div class="form-group">
                <label class="form-label">Preferred Time Slot <span class="required">*</span></label>
                <select id="book-slot-select" class="form-select" required>
                  <option value="10:00 AM">10:00 AM (Morning Slot)</option>
                  <option value="10:30 AM">10:30 AM (Morning Slot)</option>
                  <option value="11:00 AM">11:00 AM (Morning Slot)</option>
                  <option value="11:30 AM">11:30 AM (Morning Slot)</option>
                  <option value="02:00 PM">02:00 PM (Afternoon Slot)</option>
                  <option value="03:00 PM">03:00 PM (Afternoon Slot)</option>
                  <option value="04:30 PM">04:30 PM (Evening Slot)</option>
                </select>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
            <button type="submit" class="btn btn-primary"><i class="fas fa-check-circle"></i> Confirm Consultation Booking</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Elements
  const deptSelect = modalRoot.querySelector('#book-dept-select');
  const docSelect = modalRoot.querySelector('#book-doc-select');
  const symptomsInput = modalRoot.querySelector('#book-symptoms');
  const aiPreview = modalRoot.querySelector('#ai-symptom-preview');
  const aiLangBadge = modalRoot.querySelector('#ai-lang-badge');
  const aiClinicalText = modalRoot.querySelector('#ai-clinical-text');
  const aiConcepts = modalRoot.querySelector('#ai-concepts-container');

  // Filter doctor select when department changes
  const updateDoctorList = (selectedDept) => {
    const filteredDocs = s.doctors.filter(d => d.department === selectedDept);
    docSelect.innerHTML = (filteredDocs.length > 0 ? filteredDocs : s.doctors).map(doc =>
      `<option value="${doc.id}">Dr. ${escapeHtml(doc.displayName)} (${doc.department})</option>`
    ).join('');
  };

  deptSelect?.addEventListener('change', () => {
    updateDoctorList(deptSelect.value);
  });

  // Multilingual Symptom Analysis & Translation logic
  const handleSymptomAnalysis = () => {
    const raw = symptomsInput.value.trim();
    if (!raw) {
      aiPreview.style.display = 'none';
      return;
    }

    const analysis = SymptomNormalizer.normalize(raw);
    aiPreview.style.display = 'block';

    if (analysis.detectedLanguage === 'hi') {
      aiLangBadge.textContent = 'Hindi / Hinglish Detected';
      aiLangBadge.className = 'badge badge-warning';
    } else {
      aiLangBadge.textContent = 'English Clinical';
      aiLangBadge.className = 'badge badge-success';
    }

    const concepts = SymptomNormalizer.getLocalizedLabels(analysis.normalizedSymptoms);
    const conceptNames = concepts.map(c => c.label).join(', ');

    aiClinicalText.innerHTML = `
      <span>Clinical English: <strong>"${escapeHtml(conceptNames ? `Reported ${conceptNames} with clinical symptoms` : raw)}"</strong></span>
      ${analysis.isEmergency ? `<div style="color: var(--critical); font-size: 11px; margin-top: 2px">⚠️ Severe / urgent symptom detected</div>` : ''}
    `;

    aiConcepts.innerHTML = `
      <span style="font-size: 11px; color: #166534">Concepts:</span>
      ${concepts.length > 0 ? concepts.map(c => `
        <span class="badge badge-primary" style="font-size: 10px"><i class="fas fa-check"></i> ${c.label}</span>
      `).join('') : `<span class="badge badge-neutral" style="font-size: 10px">General Consultation</span>`}
      <span class="badge badge-teal" style="font-size: 10px; margin-left: auto">Suggested Dept: ${analysis.suggestedDepartment}</span>
    `;

    // Auto-select recommended department if matched
    if (analysis.suggestedDepartment && analysis.suggestedDepartment !== deptSelect.value) {
      if ([...deptSelect.options].some(opt => opt.value === analysis.suggestedDepartment)) {
        deptSelect.value = analysis.suggestedDepartment;
        updateDoctorList(analysis.suggestedDepartment);
      }
    }
  };

  symptomsInput?.addEventListener('input', handleSymptomAnalysis);

  // Quick symptom tag chip clicks
  modalRoot.querySelectorAll('#symptom-tag-chips button').forEach(btn => {
    btn.addEventListener('click', () => {
      const sym = btn.dataset.symptom;
      if (symptomsInput.value.trim()) {
        symptomsInput.value += `, ${sym}`;
      } else {
        symptomsInput.value = sym;
      }
      handleSymptomAnalysis();
    });
  });

  // Submit appointment booking
  modalRoot.querySelector('#patient-book-apt-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const department = deptSelect.value;
    const doctorId = docSelect.value;
    const symptoms = symptomsInput.value;
    const timeSlot = modalRoot.querySelector('#book-slot-select').value;
    const dateStr = modalRoot.querySelector('#book-date').value;

    const aptResult = FlowEngine.bookAppointment({
      patientId: pt.id,
      doctorId,
      department,
      symptoms,
      scheduledTime: `${dateStr}T${timeSlot.includes('PM') ? (parseInt(timeSlot) + 12 || 14) : timeSlot.slice(0, 2)}:00:00`,
      priority: 'normal'
    });

    modalRoot.innerHTML = '';
    alert('Appointment booked successfully! Express Check-In QR code is ready in your Appointments tab.');
    const subContentEl = document.querySelector('#patient-sub-content');
    if (subContentEl) renderPatientAppointments(subContentEl, pt);
  });
};

// Emergency Assistance Modal
window._showEmergencyHelpModal = (patientId) => {
  const modalRoot = document.getElementById('patient-modal-root') || document.body;

  modalRoot.innerHTML = `
    <div class="modal-backdrop active">
      <div class="modal active" style="max-width: 500px">
        <div class="modal-header" style="background: var(--critical); color: white; border-radius: var(--radius-lg) var(--radius-lg) 0 0">
          <h3 class="modal-title" style="color: white"><i class="fas fa-truck-medical"></i> 24x7 Emergency Assistance</h3>
          <button class="modal-close" style="color: white" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="card-inner-box" style="background: #FEF2F2; border: 1px solid #FECACA; color: #991B1B; margin-bottom: var(--space-4)">
            <strong>Hospital Emergency Helpline:</strong><br>
            Direct 24/7 Hotline: <a href="tel:108" style="color: #DC2626; font-weight: 800; font-size: 16px">108</a> · Hospital Trauma Bay: <a href="tel:+919876543210" style="color: #DC2626; font-weight: 800">+91 98765 43210</a>
          </div>

          <div class="flex flex-col gap-3">
            <button class="btn btn-danger btn-lg" style="width: 100%; justify-content: flex-start; text-align: left; padding: 14px 18px" onclick="this.closest('.modal-backdrop').remove(); window.HospitalFlow.router.navigate('/patient/emergency-status');">
              <i class="fas fa-ambulance" style="font-size: 20px; margin-right: 10px"></i>
              <div>
                <div style="font-weight: 700">Request Hospital Ambulance Dispatch</div>
                <div style="font-size: 11px; opacity: 0.9">Immediate GPS-enabled ambulance with paramedic triage</div>
              </div>
            </button>

            <button class="btn btn-warning btn-lg" style="width: 100%; justify-content: flex-start; text-align: left; padding: 14px 18px" onclick="this.closest('.modal-backdrop').remove(); window.HospitalFlow.router.navigate('/patient/emergency-status');">
              <i class="fas fa-car" style="font-size: 20px; margin-right: 10px"></i>
              <div>
                <div style="font-weight: 700">Self Arrival / Private Vehicle Notification</div>
                <div style="font-size: 11px; opacity: 0.9">Notify Trauma Bay in advance so doctors are ready at the door</div>
              </div>
            </button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Close</button>
        </div>
      </div>
    </div>
  `;
};

// Appointment Details Modal
window._showAppointmentDetailsModal = (appointmentId) => {
  const s = appState.get();
  const apt = s.appointments.find(a => a.id === appointmentId) || { id: appointmentId, department: 'General Medicine', status: 'Scheduled', scheduledTime: new Date().toISOString() };
  const doc = s.doctors.find(d => d.id === apt.doctorId);
  const modalRoot = document.getElementById('patient-modal-root') || document.body;

  modalRoot.innerHTML = `
    <div class="modal-backdrop active">
      <div class="modal active" style="max-width: 440px">
        <div class="modal-header">
          <h3 class="modal-title"><i class="fas fa-info-circle"></i> Consultation Details</h3>
          <button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="flex justify-between items-center" style="margin-bottom: var(--space-3)">
            <strong>${escapeHtml(apt.department)}</strong>
            <span class="badge ${apt.status === 'Scheduled' ? 'badge-primary' : 'badge-success'}">${apt.status}</span>
          </div>
          <p style="font-size: var(--font-size-xs); color: var(--text-secondary); margin: 0 0 var(--space-2)">
            Assigned Doctor: <strong>Dr. ${escapeHtml(doc?.displayName || 'Physician')}</strong> (${doc?.specialty || 'Specialist'})
          </p>
          <p style="font-size: var(--font-size-xs); color: var(--text-secondary); margin: 0 0 var(--space-3)">
            Consultation Time: <strong>${formatTime(apt.scheduledTime)}</strong> (${formatDate(apt.scheduledTime)})
          </p>
          <div class="card-inner-box" style="background: var(--bg-subtle)">
            <div style="font-size: 11px; color: var(--text-secondary)">Reported Symptoms:</div>
            <div style="font-size: var(--font-size-xs); font-weight: 600">${escapeHtml(apt.symptom_original_text || 'Routine Clinical Checkup')}</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-sm" onclick="this.closest('.modal-backdrop').remove()">Close</button>
          ${apt.status === 'Scheduled' ? `<button class="btn btn-primary btn-sm" onclick="this.closest('.modal-backdrop').remove(); window.HospitalFlow.checkInPatient('${apt.id}')"><i class="fas fa-check"></i> Check In</button>` : ''}
        </div>
      </div>
    </div>
  `;
};