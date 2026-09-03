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
  switch (subRoute) {
    case 'home': renderPatientHome(subContentEl, patient); break;
    case 'appointments': renderPatientAppointments(subContentEl, patient); break;
    case 'queue': renderPatientQueue(subContentEl, patient); break;
    case 'care': renderPatientCare(subContentEl, patient); break;
    case 'emergency-status': renderPatientEmergencyWorkflow(subContentEl, patient); break;
    case 'profile': renderPatientProfilePage(subContentEl, patient); break;
    default: renderPatientHome(subContentEl, patient); break;
  }
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

        <!-- Right Column: Live Queue & Medication -->
        <div class="flex flex-col gap-6">
          <!-- Live Queue Card -->
          <div class="patient-queue-card">
            <div class="card-header">
              <div>
                <h3 class="card-title">Live Queue</h3>
                <div class="card-subtitle">Updated continuously</div>
              </div>
              <span class="badge ${activeQueue ? 'badge-warning' : 'badge-neutral'}">
                <i class="fas ${activeQueue ? 'fa-clock' : 'fa-check'}"></i> ${activeQueue ? activeQueue.status : 'Not in Queue'}
              </span>
            </div>

            ${activeQueue ? `
              <div class="queue-metrics-grid">
                <div class="queue-metric-item">
                  <span class="queue-metric-label">Your Token</span>
                  <span class="queue-token-value">${activeQueue.id}</span>
                </div>
                <div class="queue-metric-item">
                  <span class="queue-metric-label">Position</span>
                  <span class="queue-metric-val">#${activeQueue.position}</span>
                </div>
                <div class="queue-metric-item">
                  <span class="queue-metric-label">Ahead</span>
                  <span class="queue-metric-val">${Math.max(0, activeQueue.position - 1)}</span>
                </div>
                <div class="queue-metric-item">
                  <span class="queue-metric-label">Predicted Wait</span>
                  <span class="queue-metric-val" style="color: var(--primary)">${formatMinutes(activeQueue.estimatedWait || 0)}</span>
                </div>
              </div>

              <!-- Horizontal Progress Track -->
              <div class="queue-progress-track">
                <div class="queue-progress-bar-bg"></div>
                <div class="queue-progress-bar-active" style="width: ${activeQueue.status === 'Consulting' ? '100%' : activeQueue.status === 'Called' ? '75%' : '35%'}"></div>
                <div class="queue-step-node completed"><i class="fas fa-check"></i></div>
                <div class="queue-step-node ${activeQueue.status !== 'Waiting' ? 'completed' : 'active'}"><i class="fas fa-user-clock"></i></div>
                <div class="queue-step-node ${activeQueue.status === 'Consulting' ? 'completed' : activeQueue.status === 'Called' ? 'active' : ''}"><i class="fas fa-bullhorn"></i></div>
                <div class="queue-step-node ${activeQueue.status === 'Consulting' ? 'active' : ''}"><i class="fas fa-stethoscope"></i></div>
              </div>
              <div class="flex justify-between" style="font-size: 10px; color: var(--text-tertiary); margin-top: -8px">
                <span>Checked in</span>
                <span>Your consultation</span>
              </div>

              <div style="margin-top: var(--space-4); border-top: 1px solid var(--border-light); padding-top: var(--space-3)">
                <a href="#/patient/queue" style="font-size: var(--font-size-xs); font-weight: 600; color: var(--primary); display: inline-flex; align-items: center; gap: 4px">
                  Open live queue <i class="fas fa-arrow-right" style="font-size: 10px"></i>
                </a>
              </div>
            ` : `
              <div class="empty-state" style="padding: var(--space-6)">
                <i class="fas fa-ticket-alt"></i>
                <h4>Not currently in queue</h4>
                <p>Check in for your scheduled appointment to get a live token.</p>
              </div>
            `}
          </div>

          <!-- Next Medication Card -->
          <div class="patient-med-card">
            <div class="card-header">
              <div>
                <h3 class="card-title">Next Medication</h3>
                <div class="card-subtitle">Today's schedule</div>
              </div>
              <span class="badge ${activePlan ? 'badge-success' : 'badge-neutral'}">${activePlan ? 'Plan Active' : 'None'}</span>
            </div>

            ${nextMed ? `
              <div class="med-schedule-item">
                <div class="med-icon-box"><i class="fas fa-pills"></i></div>
                <div style="flex: 1">
                  <div style="font-size: 11px; color: var(--text-secondary); font-weight: 600">${nextMed.timeSlot} · 02:00 PM</div>
                  <div style="font-size: var(--font-size-sm); font-weight: 700; color: var(--text-primary)">${escapeHtml(nextMed.name)}</div>
                  <div style="font-size: var(--font-size-xs); color: var(--text-secondary)">${escapeHtml(nextMed.dosage)} · ${escapeHtml(nextMed.instructions || 'After Food')}</div>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <button class="btn btn-success btn-sm" onclick="window.HospitalFlow.toggleMedication('${patient.id}', '${nextMed.name}', '${nextMed.timeSlot}')">
                  <i class="fas fa-check"></i> Mark Taken
                </button>
                <a href="#/patient/care" style="font-size: var(--font-size-xs); font-weight: 600; color: var(--primary); margin-left: auto">
                  Open My Care
                </a>
              </div>
            ` : `
              <div class="empty-state" style="padding: var(--space-4)">
                <i class="fas fa-clipboard-check"></i>
                <p>No active medications prescribed.</p>
              </div>
            `}
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================
// PATIENT APPOINTMENTS VIEW
// ============================================
function renderPatientAppointments(el, patient) {
  const s = appState.get();
  const myApts = s.appointments
    .filter(a => a.patientId === patient.id)
    .sort((a, b) => new Date(b.scheduledTime) - new Date(a.scheduledTime));

  el.innerHTML = `
    <div class="patient-appointments-layout animate-fade-in">
      <div id="patient-booking-persistent-confirmation" style="display: none; margin-bottom: var(--space-6)"></div>

      <div class="grid-2">
        <!-- 1. Symptom Guided Booking Form -->
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title"><i class="fas fa-notes-medical" style="color: var(--primary)"></i> Symptom-Guided Booking</h3>
              <div class="card-subtitle">Describe symptoms in English, Hindi, or Hinglish</div>
            </div>
          </div>

          <form id="symptom-booking-form">
            <div class="form-group">
              <label class="form-label">Describe your symptoms <span class="required">*</span></label>
              <textarea id="symptom-input-text" class="form-textarea" rows="3" placeholder="e.g. mujhe bukhar aur khansi hai..." required></textarea>
            </div>

            <button type="button" class="btn btn-secondary btn-sm" id="btn-analyze-symptoms" style="margin-bottom: var(--space-3)">
              <i class="fas fa-magic"></i> Analyze Symptoms
            </button>

            <!-- Detected Symptoms & Chips -->
            <div id="detected-symptoms-box" class="card-inner-box" style="display: none">
              <div class="flex justify-between items-center" style="margin-bottom: 6px">
                <span style="font-size: var(--font-size-xs); font-weight: 600; color: var(--text-secondary)">Detected Symptoms:</span>
                <span class="badge badge-success" id="symptom-confidence-badge">High Confidence</span>
              </div>
              <div id="symptom-chips-list" class="flex flex-wrap gap-1"></div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Department <span class="required">*</span></label>
                <select id="apt-dept-select" class="form-select" required>
                  ${Config.DEPARTMENTS.map(d => `<option value="${d}">${d}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Doctor <span class="required">*</span></label>
                <select id="apt-doctor-select" class="form-select" required></select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Preferred Date <span class="required">*</span></label>
                <input type="date" id="apt-date" class="form-input" value="${new Date().toISOString().split('T')[0]}" min="${new Date().toISOString().split('T')[0]}" required>
              </div>
              <div class="form-group">
                <label class="form-label">Time Slot <span class="required">*</span></label>
                <select id="apt-time" class="form-select" required>
                  <option value="">Next Available Slot</option>
                </select>
              </div>
            </div>

            <button type="submit" class="btn btn-primary btn-lg" style="width: 100%; margin-top: var(--space-2)">
              <i class="fas fa-check-circle"></i> Confirm & Book Appointment
            </button>
          </form>
        </div>

        <!-- 2. Upcoming & Past Appointments -->
        <div class="card">
          <div class="card-header flex justify-between items-center">
            <h3 class="card-title"><i class="fas fa-history"></i> My Appointments (${myApts.length})</h3>
          </div>

          <div class="appointments-feed" style="margin-top: var(--space-3)">
            ${myApts.map(apt => {
              const doc = s.doctors.find(d => d.id === apt.doctorId);
              const isScheduled = apt.status === 'Scheduled';
              return `
                <div class="card-inner-box" style="margin-bottom: var(--space-3); background: var(--bg-surface); border: 1px solid var(--border)">
                  <div class="flex justify-between items-center">
                    <div>
                      <strong style="font-size: var(--font-size-md)">${escapeHtml(apt.department)}</strong>
                      <span class="badge ${isScheduled ? 'badge-info' : 'badge-success'}" style="margin-left: 6px">${apt.status}</span>
                    </div>
                    <span style="font-size: var(--font-size-xs); color: var(--text-tertiary)">${apt.id}</span>
                  </div>
                  <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin: 4px 0">
                    Dr. ${escapeHtml(doc?.displayName || 'Physician')} · ${formatDate(apt.scheduledTime)} at ${formatTime(apt.scheduledTime)}
                  </div>
                  <div class="flex gap-2" style="margin-top: var(--space-3)">
                    <button class="btn btn-secondary btn-sm" onclick="window._showAppointmentQRModal('${apt.id}')">
                      <i class="fas fa-qrcode"></i> Show QR
                    </button>
                    ${isScheduled ? `
                      <button class="btn btn-primary btn-sm" onclick="window.HospitalFlow.checkInPatient('${apt.id}')">
                        <i class="fas fa-check"></i> Check-In Now
                      </button>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  // Booking handlers
  const deptSelect = el.querySelector('#apt-dept-select');
  const docSelect = el.querySelector('#apt-doctor-select');
  const timeSelect = el.querySelector('#apt-time');
  const symptomInput = el.querySelector('#symptom-input-text');
  const analyzeBtn = el.querySelector('#btn-analyze-symptoms');

  function updateDoctorsForDept(dept) {
    const docs = s.doctors.filter(d => d.department === dept);
    docSelect.innerHTML = docs.map(d => `<option value="${d.id}">Dr. ${escapeHtml(d.displayName)} (${d.specialty})</option>`).join('');
    updateTimeSlots();
  }

  function updateTimeSlots() {
    const docId = docSelect.value;
    const date = el.querySelector('#apt-date').value;
    if (!docId || !date) return;
    const slots = FlowEngine.getAvailableSlots(docId, date);
    timeSelect.innerHTML = '<option value="">Next Available Slot</option>' + slots.slice(0, 8).map(slot => `<option value="${slot}">${formatTime(slot)}</option>`).join('');
  }

  deptSelect?.addEventListener('change', (e) => updateDoctorsForDept(e.target.value));
  el.querySelector('#apt-date')?.addEventListener('change', updateTimeSlots);

  analyzeBtn?.addEventListener('click', () => {
    const text = symptomInput.value.trim();
    if (!text) return;
    bookingSymptomAnalysis = SymptomNormalizer.normalize(text);
    selectedSymptomCodes = [...bookingSymptomAnalysis.normalizedSymptoms];

    const chipsBox = el.querySelector('#detected-symptoms-box');
    const chipsList = el.querySelector('#symptom-chips-list');
    chipsBox.style.display = 'block';
    chipsList.innerHTML = selectedSymptomCodes.map(code => `<span class="symptom-chip active">${code}</span>`).join('');

    if (bookingSymptomAnalysis.suggestedDepartment) {
      deptSelect.value = bookingSymptomAnalysis.suggestedDepartment;
      updateDoctorsForDept(deptSelect.value);
    }
  });

  updateDoctorsForDept(deptSelect.value);

  el.querySelector('#symptom-booking-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const dept = deptSelect.value;
    const docId = docSelect.value;
    const date = el.querySelector('#apt-date').value;
    const timeVal = timeSelect.value;
    const scheduledTime = timeVal || new Date(date + 'T10:30:00').toISOString();

    const result = FlowEngine.bookAppointment({
      patientId: patient.id,
      doctorId: docId,
      department: dept,
      scheduledTime
    });

    appState.updateItem('appointments', result.appointment.id, {
      symptom_original_text: symptomInput.value.trim(),
      normalized_symptoms: selectedSymptomCodes
    });

    alert(`Appointment ${result.appointment.id} confirmed! Live schedule synchronized.`);
    renderPatientAppointments(el, patient);
  });
}

// ============================================
// PATIENT LIVE QUEUE
// ============================================
function renderPatientQueue(el, patient) {
  const s = appState.get();
  const queueEntry = s.queueEntries.find(q => q.patientId === patient.id && ['Waiting', 'Called', 'Consulting'].includes(q.status));

  if (!queueEntry) {
    el.innerHTML = `
      <div class="card" style="max-width: 540px; margin: var(--space-6) auto; text-align: center">
        <div class="empty-state" style="padding: var(--space-8)">
          <i class="fas fa-ticket-alt" style="font-size: 36px; color: var(--text-tertiary)"></i>
          <h3>Not currently in queue</h3>
          <p>Check in for your scheduled appointment to receive a live token.</p>
          <button class="btn btn-primary" onclick="window.HospitalFlow.router.navigate('/patient/appointments')">
            <i class="fas fa-calendar-check"></i> My Appointments
          </button>
        </div>
      </div>
    `;
    return;
  }

  const assignedDoc = s.doctors.find(d => d.id === queueEntry.doctorId);

  el.innerHTML = `
    <div class="patient-queue-layout animate-fade-in" style="max-width: 680px; margin: 0 auto">
      <div class="card">
        <div style="text-align: center; padding: var(--space-6); background: linear-gradient(145deg, #1D63ED 0%, #0284C7 100%); color: white; border-radius: var(--radius-xl)">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.9">LIVE TOKEN</div>
          <div style="font-size: 44px; font-weight: 800; margin: 2px 0">${queueEntry.id}</div>
          <div style="font-size: var(--font-size-sm); opacity: 0.95">${escapeHtml(queueEntry.department)} · Dr. ${escapeHtml(assignedDoc?.displayName || '')}</div>
        </div>

        <div class="grid-3" style="margin: var(--space-5) 0">
          <div class="metric-card">
            <div class="kpi-icon blue"><i class="fas fa-list-ol"></i></div>
            <div class="kpi-content">
              <div class="kpi-label">Position</div>
              <div class="kpi-value">#${queueEntry.position}</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="kpi-icon orange"><i class="fas fa-users"></i></div>
            <div class="kpi-content">
              <div class="kpi-label">Patients Ahead</div>
              <div class="kpi-value">${Math.max(0, queueEntry.position - 1)}</div>
            </div>
          </div>
          <div class="metric-card">
            <div class="kpi-icon green"><i class="fas fa-clock"></i></div>
            <div class="kpi-content">
              <div class="kpi-label">Predicted Wait</div>
              <div class="kpi-value">${queueEntry.estimatedWait != null ? formatMinutes(queueEntry.estimatedWait) : '0m'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================
// PATIENT MY CARE & POST-DISCHARGE HOME REPORTING
// ============================================
function renderPatientCare(el, patient) {
  const s = appState.get();
  const plan = s.dischargePlans.find(dp => dp.patientId === patient.id && dp.active);
  const adherence = CareEngine.getAdherence(patient.id);

  el.innerHTML = `
    <div class="patient-care-layout animate-fade-in" style="max-width: 840px; margin: 0 auto">
      <div class="card">
        <div class="card-header flex justify-between items-center" style="border-bottom: 1px solid var(--border-light); padding-bottom: var(--space-4)">
          <div>
            <h3 class="card-title"><i class="fas fa-file-medical" style="color: var(--success)"></i> Recovery & Care Continuity</h3>
            <div class="card-subtitle">${plan ? `Plan ID: ${plan.id} · Approved by Clinical Team` : 'No active care plan on record'}</div>
          </div>
          <div class="flex items-center gap-2">
            <span class="badge badge-success">Adherence: ${adherence.rate}%</span>
            <button class="btn btn-warning btn-sm" onclick="window._showPostDischargeReportModal('${patient.id}')">
              <i class="fas fa-flag"></i> Report a Problem from Home
            </button>
          </div>
        </div>

        ${plan ? `
          <div class="section" style="margin-top: var(--space-4)">
            <h4 style="font-size: var(--font-size-sm); margin-bottom: var(--space-3)"><i class="fas fa-pills"></i> Prescribed Medications</h4>
            ${plan.medications.map(med => `
              <div style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); background: var(--bg-subtle); border-radius: var(--radius-md); margin-bottom: 6px">
                <div class="med-icon-box" style="width: 32px; height: 32px; font-size: 14px"><i class="fas fa-pills"></i></div>
                <div style="flex: 1">
                  <strong>${escapeHtml(med.name)}</strong>
                  <div style="font-size: var(--font-size-xs); color: var(--text-secondary)">${med.dosage} · ${med.timeSlot} · ${med.instructions || 'After food'}</div>
                </div>
                <button class="btn btn-success btn-sm" onclick="window.HospitalFlow.toggleMedication('${patient.id}', '${med.name}', '${med.timeSlot}')">
                  <i class="fas fa-check"></i> Taken
                </button>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="empty-state" style="padding: var(--space-6)">
            <i class="fas fa-clipboard-check"></i>
            <p>Your discharge plan and medication schedule will appear here once approved by your physician.</p>
          </div>
        `}
      </div>
    </div>
  `;
}

// ============================================
// PATIENT HEALTH IDENTITY PROFILE REDESIGN (Phase 3)
// ============================================
function renderPatientProfilePage(el, patient) {
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
            <span class="badge badge-info">Completion: 85%</span>
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
            <div class="flex justify-between"><span>Email Address:</span> <strong>amit.kumar@email.com</strong></div>
          </div>
        </div>

        <!-- Emergency Contact Card (with Direct Call Button) -->
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
            <button class="btn btn-ghost btn-sm" style="margin-top: 6px" onclick="alert('Downloading Discharge Summary PDF...')"><i class="fas fa-download"></i> View Document</button>
          </div>
          <div class="card-inner-box" style="margin: 0">
            <div style="font-weight: 700; font-size: var(--font-size-sm)"><i class="fas fa-pills" style="color: var(--teal)"></i> Prescription Record</div>
            <div style="font-size: 11px; color: var(--text-secondary)">Dr. Aarav Sharma · 2 Medications</div>
            <button class="btn btn-ghost btn-sm" style="margin-top: 6px" onclick="alert('Downloading Prescription...')"><i class="fas fa-download"></i> View Document</button>
          </div>
          <div class="card-inner-box" style="margin: 0">
            <div style="font-weight: 700; font-size: var(--font-size-sm)"><i class="fas fa-qrcode" style="color: var(--success)"></i> Patient Health QR</div>
            <div style="font-size: 11px; color: var(--text-secondary)">Identity Token · P-1042</div>
            <button class="btn btn-ghost btn-sm" style="margin-top: 6px" onclick="window._showAppointmentQRModal('P-1042')"><i class="fas fa-qrcode"></i> Show Token</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================
// EMERGENCY & AMBULANCE DISPATCH VIEW
// ============================================
function renderPatientEmergencyWorkflow(el, patient) {
  const s = appState.get();
  const myAmbReq = (s.ambulanceRequests || []).find(r => r.patientId === patient.id && r.status !== 'ARRIVED' && r.status !== 'CANCELLED');

  el.innerHTML = `
    <div class="patient-emergency-layout animate-fade-in" style="max-width: 780px; margin: 0 auto">
      ${myAmbReq ? `
        <div class="card" style="border: 2px solid var(--critical-border); margin-bottom: var(--space-6); background: #FEF2F2">
          <div class="card-header flex justify-between items-center">
            <h3 class="card-title" style="color: #991B1B"><i class="fas fa-ambulance"></i> Active Ambulance Request (${myAmbReq.requestId})</h3>
            <span class="badge badge-danger">${myAmbReq.status}</span>
          </div>
          <div class="grid-3" style="margin: var(--space-4) 0">
            <div class="metric-card">
              <div class="kpi-icon red"><i class="fas fa-truck-medical"></i></div>
              <div class="kpi-content"><div class="kpi-label">Vehicle</div><div class="kpi-value" style="font-size: 16px">${myAmbReq.assignedAmbulanceId || 'Assigning...'}</div></div>
            </div>
            <div class="metric-card">
              <div class="kpi-icon orange"><i class="fas fa-stopwatch"></i></div>
              <div class="kpi-content"><div class="kpi-label">Pickup ETA</div><div class="kpi-value">${myAmbReq.estimatedPickup || 8}m</div></div>
            </div>
            <div class="metric-card">
              <div class="kpi-icon green"><i class="fas fa-hospital"></i></div>
              <div class="kpi-content"><div class="kpi-label">Hospital ETA</div><div class="kpi-value">${myAmbReq.estimatedHospitalArrival || 18}m</div></div>
            </div>
          </div>
        </div>
      ` : ''}

      <div class="card">
        <div class="card-header">
          <h3 class="card-title"><i class="fas fa-ambulance" style="color: var(--critical)"></i> Request Hospital Ambulance</h3>
        </div>

        <form id="patient-ambulance-request-form">
          <div class="form-group">
            <label class="form-label">Pickup Address / Location <span class="required">*</span></label>
            <input type="text" id="amb-pickup-loc" class="form-input" placeholder="e.g. Flat 402, Sunshine Apts, Andheri West" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Contact Phone <span class="required">*</span></label>
              <input type="tel" id="amb-phone" class="form-input" value="${patient.phone || '+91 9876543210'}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Symptoms / Emergency Description <span class="required">*</span></label>
              <input type="text" id="amb-symptoms" class="form-input" placeholder="e.g. Severe chest pain, breathing difficulty" required>
            </div>
          </div>
          <button type="submit" class="btn btn-danger btn-lg" style="width: 100%; margin-top: var(--space-3)">
            <i class="fas fa-truck-medical"></i> Dispatch Hospital Ambulance
          </button>
        </form>
      </div>
    </div>
  `;

  el.querySelector('#patient-ambulance-request-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const req = FlowEngine.requestHospitalAmbulance({
      patientId: patient.id,
      patientName: patient.displayName,
      pickupLocation: el.querySelector('#amb-pickup-loc').value.trim(),
      contactNumber: el.querySelector('#amb-phone').value.trim(),
      symptoms: el.querySelector('#amb-symptoms').value.trim(),
      severity: 'Critical'
    });
    alert(`Ambulance request ${req.requestId} submitted. Hospital Command Center alerted.`);
    renderPatientEmergencyWorkflow(el, patient);
  });
}

// Post-Discharge Report Problem Modal
window._showPostDischargeReportModal = (patientId) => {
  const modalRoot = document.getElementById('patient-modal-root') || document.body;
  modalRoot.innerHTML = `
    <div class="modal-backdrop active">
      <div class="modal active" style="max-width: 480px">
        <div class="modal-header">
          <h3 class="modal-title" style="color: var(--warning)"><i class="fas fa-flag"></i> Report a Problem from Home</h3>
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
