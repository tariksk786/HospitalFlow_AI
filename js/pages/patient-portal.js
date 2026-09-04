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
    try {
      const dept = deptSelect.value;
      const docId = docSelect.value;
      const date = el.querySelector('#apt-date').value || new Date().toISOString().split('T')[0];
      const timeVal = timeSelect.value;
      
      let scheduledTime;
      if (timeVal) {
        scheduledTime = timeVal;
      } else {
        const d = new Date(date);
        d.setHours(10, 30, 0, 0);
        scheduledTime = d.toISOString();
      }

      if (!docId) {
        alert('Please select a doctor.');
        return;
      }

      const result = FlowEngine.bookAppointment({
        patientId: patient.id,
        doctorId: docId,
        department: dept,
        scheduledTime
      });

      if (result && result.appointment) {
        appState.updateItem('appointments', result.appointment.id, {
          symptom_original_text: symptomInput.value.trim(),
          normalized_symptoms: selectedSymptomCodes
        });
      }

      renderPatientAppointments(el, patient);

      // Show persistent confirmation banner with QR
      const confirmBox = el.querySelector('#patient-booking-persistent-confirmation');
      if (confirmBox && result && result.appointment) {
        confirmBox.style.display = 'block';
        confirmBox.innerHTML = `
          <div class="card" style="border: 2px solid var(--primary); background: rgba(37, 99, 235, 0.05); padding: var(--space-4); border-radius: var(--radius-lg)">
            <div class="flex items-center justify-between" style="flex-wrap: wrap; gap: 12px">
              <div class="flex items-center gap-3">
                <div style="width: 44px; height: 44px; border-radius: 50%; background: #22c55e; color: white; display: flex; align-items: center; justify-content: center; font-size: 20px">
                  <i class="fas fa-check"></i>
                </div>
                <div>
                  <h4 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text-primary)">Appointment Confirmed (${result.appointment.id})</h4>
                  <p style="margin: 0; font-size: 12px; color: var(--text-secondary)">Your appointment with Dr. ${docSelect.options[docSelect.selectedIndex]?.text || 'Physician'} has been confirmed.</p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button class="btn btn-secondary btn-sm" onclick="window._showAppointmentQRModal('${result.appointment.id}')">
                  <i class="fas fa-qrcode"></i> View QR
                </button>
                <button class="btn btn-primary btn-sm" onclick="window.HospitalFlow.checkInPatient('${result.appointment.id}')">
                  <i class="fas fa-sign-in-alt"></i> Express Check-In Now
                </button>
              </div>
            </div>
          </div>
        `;
        confirmBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (err) {
      console.error('Appointment booking error:', err);
      alert(err.message || 'Unable to book appointment.');
    }
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
// PATIENT MY CARE & RECOVERY WORKSPACE (Phase 2)
// ============================================
function renderPatientCare(el, patient) {
  const s = appState.get();
  const plan = s.dischargePlans.find(dp => dp.patientId === patient.id && dp.active) || {
    id: 'DP-2048',
    patientId: patient.id,
    doctorId: 'D-0001',
    doctorName: 'Dr. Aarav Sharma',
    department: 'General Medicine',
    dischargeDate: new Date(Date.now() - 86400000).toISOString(),
    recoveryDay: 4,
    totalRecoveryDays: 7,
    active: true,
    medications: [
      { name: 'Azithromycin 250mg', dosage: '1 Tablet', timeSlot: 'Morning', timing: '08:00 AM', instructions: 'After breakfast', taken: true, takenTimeStr: '08:04 AM' },
      { name: 'Paracetamol 650mg', dosage: '1 Tablet', timeSlot: 'Afternoon', timing: '02:00 PM', instructions: 'After lunch', taken: false, skipped: true, skipReason: 'Feeling Unwell' },
      { name: 'Multivitamin Complex', dosage: '1 Capsule', timeSlot: 'Evening', timing: '06:00 PM', instructions: 'With warm water', taken: false },
      { name: 'Pantoprazole 40mg', dosage: '1 Tablet', timeSlot: 'Night', timing: '09:00 PM', instructions: '30 mins before dinner', taken: false }
    ],
    dietPlan: 'Light fluids, high-protein khichdi, avoid oily foods, warm water hydration',
    warningSigns: ['Fever rising above 101°F', 'Severe persistent breathlessness', 'Sudden acute dizziness or fainting'],
    followUpDate: '2026-09-12T10:00:00'
  };

  const adherence = CareEngine.getAdherence(patient.id);
  const meds = plan.medications || [];
  const takenCount = meds.filter(m => m.taken).length;
  const skippedCount = meds.filter(m => m.skipped).length;
  const nextScheduledMed = meds.find(m => !m.taken && !m.skipped) || meds[0];

  el.innerHTML = `
    <div class="patient-care-layout animate-fade-in" style="max-width: 920px; margin: 0 auto">
      <!-- 1. Top Clinical Recovery Header Card -->
      <div class="card" style="margin-bottom: var(--space-5); background: linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%); border: 1px solid var(--primary-border)">
        <div class="flex justify-between items-start" style="flex-wrap: wrap; gap: var(--space-4)">
          <div>
            <div class="flex items-center gap-2" style="margin-bottom: 4px">
              <span class="badge badge-primary">Care Plan: ${plan.id}</span>
              <span class="badge badge-success"><i class="fas fa-check-circle"></i> Clinical Team Approved</span>
            </div>
            <h2 style="margin: 0; font-size: var(--font-size-xl)">${t('care.recovery_workspace') || 'Recovery & Care Continuity Workspace'}</h2>
            <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-top: 4px">
              Treating Physician: <strong>Dr. Aarav Sharma (General Medicine)</strong> · Discharged: <strong>Yesterday</strong>
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

        <!-- Recovery Milestone Bar (Day 4 of 7) -->
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
            <div class="kpi-value" style="font-size: 18px">${nextScheduledMed ? nextScheduledMed.timing || nextScheduledMed.timeSlot : 'Completed'}</div>
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
                    <button class="btn btn-ghost btn-sm" onclick="window.HospitalFlow.toggleMedication('${patient.id}', '${med.name}', '${med.timeSlot}')" title="Undo and mark taken">
                      <i class="fas fa-redo"></i> Mark Taken
                    </button>
                  ` : `
                    <button class="btn btn-success btn-sm" onclick="window.HospitalFlow.toggleMedication('${patient.id}', '${med.name}', '${med.timeSlot}')">
                      <i class="fas fa-check"></i> ${t('care.mark_taken_btn') || 'Mark Taken'}
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="window._showSkipMedicationModal('${patient.id}', '${med.name}', '${med.timeSlot}')">
                      <i class="fas fa-forward"></i> ${t('care.skip_dose_btn') || 'Skip Dose'}
                    </button>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- 5. 7-Day Adherence & Warning Signs Grid -->
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
            <li><strong>Fever above 101°F</strong> persisting for over 4 hours</li>
            <li><strong>Severe shortness of breath</strong> or chest heaviness</li>
            <li><strong>Sudden dizziness / fainting</strong> or loss of balance</li>
            <li><strong>Allergic reactions</strong> (skin rash, lip swelling)</li>
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
// EMERGENCY HELP WITH TWO ENTRY MODES (Phase 3)
// ============================================
function renderPatientEmergencyWorkflow(el, patient) {
  const s = appState.get();
  const myAmbReq = (s.ambulanceRequests || []).find(r => r.patientId === patient.id && r.status !== 'ARRIVED' && r.status !== 'CANCELLED');
  const myPreArrival = (s.preArrivalEmergencies || []).find(p => p.patientId === patient.id && p.status !== 'COMPLETED');

  el.innerHTML = `
    <div class="patient-emergency-layout animate-fade-in" style="max-width: 960px; margin: 0 auto">
      <!-- Active Emergency Pre-Arrival Banner (if active) -->
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

      <!-- Active Ambulance Request Banner (if active) -->
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
                <input type="text" id="pre-symptoms" class="form-input" placeholder="e.g. Severe chest pain radiating to left arm, breathlessness" required>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Severity Level <span class="required">*</span></label>
                  <select id="pre-severity" class="form-select">
                    <option value="Critical">Critical (Severe Distress / Trauma)</option>
                    <option value="Urgent">Urgent Priority</option>
                    <option value="Moderate">Moderate</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Estimated Arrival Time (Minutes) <span class="required">*</span></label>
                  <input type="number" id="pre-eta" class="form-input" value="14" min="2" max="60" required>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Consciousness</label>
                  <select id="pre-consciousness" class="form-select">
                    <option value="Conscious">Fully Alert / Conscious</option>
                    <option value="Confused">Confused / Drowsy</option>
                    <option value="Unconscious">Unconscious / Unresponsive</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Breathing Difficulty</label>
                  <select id="pre-breathing" class="form-select">
                    <option value="None">None / Normal</option>
                    <option value="Mild">Mild</option>
                    <option value="Severe">Severe Gasping / Choking</option>
                  </select>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Major Bleeding</label>
                  <select id="pre-bleeding" class="form-select">
                    <option value="No">No active bleeding</option>
                    <option value="Yes">Yes (External Trauma)</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Contact Phone</label>
                  <input type="tel" id="pre-phone" class="form-input" value="${patient.phone || '+91 9876543210'}" required>
                </div>
              </div>

              <button type="submit" class="btn btn-primary btn-lg" style="width: 100%; margin-top: var(--space-2)">
                <i class="fas fa-bell"></i> Notify Hospital: I Am on the Way (~14 min)
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
                <input type="text" id="amb-pickup-loc" class="form-input" placeholder="e.g. Flat 402, Sunshine Apts, Andheri West" required>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Contact Phone <span class="required">*</span></label>
                  <input type="tel" id="amb-phone" class="form-input" value="${patient.phone || '+91 9876543210'}" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Emergency Symptoms <span class="required">*</span></label>
                  <input type="text" id="amb-symptoms" class="form-input" placeholder="e.g. Acute chest pain, shortness of breath" required>
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
              <div class="flex justify-between"><span>Blood Reserves:</span> <strong>FEFO Ready (All Groups)</strong></div>
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

  // Pre-Arrival Self Form Handler
  el.querySelector('#prearrival-self-form')?.addEventListener('submit', (e) => {
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

    alert('Pre-Arrival emergency alert sent. Hospital Emergency Command Center and Doctor have been notified.');
    renderPatientEmergencyWorkflow(el, patient);
  });

  // Ambulance Request Form Handler
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
