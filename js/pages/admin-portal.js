// ============================================
// HospitalFlow AI — Admin Portal
// Live Patient Journey Cards + Live Doctor Operational Cards + Audit Trail
// ============================================

import appState from '../state.js';
import Config from '../config.js';
import Auth from '../auth.js';
import Router from '../router.js';
import alertManager from '../engines/emergency-alert-manager.js';
import eventBus, { EventTypes, getEventDescription, getEventIcon, getEventColor } from '../events.js';
import { escapeHtml, formatMinutes, formatTime, formatDate, timeAgo, getInitials } from '../utils.js';
import renderFlowPage from './flow.js';
import renderEmergencyPage from './emergency.js';
import renderCarePage from './care.js';
import renderDashboard from './dashboard.js';
import { renderDemoSimulation } from './demo-simulation.js';

let patientFilter = 'All';
let patientSort = 'Priority';
let patientSearch = '';
let doctorFilter = 'All';
let doctorSort = 'Load';
let doctorSearch = '';
let auditFilterType = '';
let auditSearch = '';

export function renderAdminPortal(container, subRoute = 'command') {
  const user = Auth.getCurrentUser();
  if (!user || user.role !== 'admin') {
    Router.navigate('/login');
    return;
  }

  const navItems = [
    { route: '/admin/command', icon: 'fa-th-large', label: 'Command Center' },
    { route: '/admin/flow', icon: 'fa-project-diagram', label: 'Flow Intelligence' },
    { route: '/admin/emergency', icon: 'fa-shield-alt', label: 'Emergency Readiness' },
    { route: '/admin/patients', icon: 'fa-users', label: 'Patients' },
    { route: '/admin/doctors', icon: 'fa-user-md', label: 'Doctors' },
    { route: '/admin/care', icon: 'fa-heartbeat', label: 'Care Continuity' },
    { route: '/admin/audit', icon: 'fa-stream', label: 'Audit & Activity' },
    { route: '/admin/demo-simulation', icon: 'fa-play-circle', label: 'Live Demo' }
  ];

  const unackAlerts = alertManager.getUnacknowledgedCount('admin');

  // Trigger emergency alert check on admin initialization if active P1/P2 cases exist
  const activeEmergencies = (appState.get().emergencyCases || []).filter(c => c.status !== 'COMPLETED');
  if (activeEmergencies.length > 0) {
    try {
      alertManager.checkAndAlert('admin');
    } catch (e) {
      console.warn('AlertManager init warning:', e);
    }
  }

  container.innerHTML = `
    <div class="app-shell animate-fade-in" id="admin-app-shell">
      <!-- 1. Left Fixed Sidebar -->
      <aside class="app-sidebar" id="admin-sidebar">
        <div class="sidebar-brand">
          <div class="sidebar-brand-icon">
            <i class="fas fa-tachometer-alt"></i>
          </div>
          <div class="sidebar-brand-text">
            <span class="sidebar-brand-title">HospitalFlow AI</span>
            <span class="sidebar-brand-sub">Hospital Operations Command</span>
          </div>
        </div>

        <nav class="sidebar-nav">
          ${navItems.map(item => `
            <a href="#${item.route}" class="sidebar-nav-item ${subRoute === item.route.replace('/admin/', '') ? 'active' : ''}">
              <i class="fas ${item.icon}"></i>
              <span>${item.label}</span>
              ${item.route === '/admin/emergency' && unackAlerts > 0 ? `<span class="badge badge-danger" style="margin-left: auto; font-size: 10px">${unackAlerts}</span>` : ''}
            </a>
          `).join('')}
        </nav>

        <div class="sidebar-footer">
          <button class="sidebar-collapse-btn" id="btn-toggle-admin-sidebar" title="Collapse sidebar">
            <i class="fas fa-chevron-left"></i>
            <span>Collapse</span>
          </button>
        </div>
      </aside>

      <!-- 2. Main Admin Content Area -->
      <div class="app-main">
        <!-- Sticky Header -->
        <header class="app-header">
          <div class="header-left">
            <div class="header-page-title">
              <h2>${subRoute === 'command' ? 'Hospital Command Center' :
                    subRoute === 'flow' ? 'Flow Intelligence' :
                    subRoute === 'emergency' ? 'Emergency Readiness & Command' :
                    subRoute === 'patients' ? 'Live Patient Directory' :
                    subRoute === 'doctors' ? 'Clinical Staff & Workload' :
                    subRoute === 'care' ? 'Care Continuity' :
                    subRoute === 'demo-simulation' ? 'Live Operational Demo' : 'Audit Trail & Operations'}</h2>
              <span>HospitalFlow AI v${Config.VERSION} · Administrative Command Suite</span>
            </div>
          </div>

          <div class="header-right">
            <!-- Audio Alerts Status Toggle -->
            <button id="admin-sound-toggle-btn" class="btn btn-ghost btn-sm" onclick="window._toggleAdminSound()" title="Audio Alerts & Chimes" style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: ${alertManager.isMuted ? 'var(--text-muted)' : 'var(--primary)'}">
              <i class="fas ${alertManager.isMuted ? 'fa-volume-mute' : 'fa-volume-up'}"></i>
              <span>${alertManager.isMuted ? 'Muted' : 'Sound Active'}</span>
            </button>

            <!-- Emergency Alert Bell -->
            <button class="header-alarm-btn" onclick="window.HospitalFlow.router.navigate('/admin/emergency')" title="Emergency Command">
              <i class="fas fa-ambulance"></i>
              ${unackAlerts > 0 ? `<span class="header-alarm-badge">${unackAlerts}</span>` : ''}
            </button>

            <!-- Notifications Bell -->
            <button class="btn btn-ghost btn-icon" onclick="window.HospitalFlow.router.navigate('/admin/audit')" title="Audit Trail">
              <i class="fas fa-stream"></i>
            </button>

            <!-- Admin User Pill -->
            <div class="header-user-pill">
              <div class="header-user-avatar" style="background: var(--primary-100); color: var(--primary-dark)"><i class="fas fa-shield-alt"></i></div>
              <div class="header-user-details">
                <span class="header-user-name">${escapeHtml(user.displayName)}</span>
                <span class="header-user-role">Administrator</span>
              </div>
            </div>

            <!-- Logout Button -->
            <button class="btn btn-ghost btn-icon" onclick="window.HospitalFlow.logout()" title="Sign Out">
              <i class="fas fa-sign-out-alt"></i>
            </button>
          </div>
        </header>

        <!-- Emergency Alert Banner Hook -->
        <div id="admin-emergency-alert-banner"></div>

        <!-- Sub Content View -->
        <main class="app-content">
          <div id="admin-sub-content"></div>
        </main>
      </div>

      <div id="admin-modal-root"></div>
    </div>
  `;

  // Render Alert Banner if any
  const alertBannerContainer = container.querySelector('#admin-emergency-alert-banner');
  alertManager.renderActiveAlertBanner(alertBannerContainer, 'admin');

  // Sidebar Collapse
  const sidebar = container.querySelector('#admin-sidebar');
  const mainShell = container.querySelector('.app-main');
  container.querySelector('#btn-toggle-admin-sidebar')?.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    mainShell.classList.toggle('sidebar-collapsed');
  });

  // Render Sub Route
  const subContentEl = container.querySelector('#admin-sub-content');
  const renderCurrentSubRoute = () => {
    if (!subContentEl || !document.body.contains(subContentEl)) return;
    switch (subRoute) {
      case 'command': renderDashboard(subContentEl); break;
      case 'flow': renderFlowPage(subContentEl); break;
      case 'emergency': renderEmergencyPage(subContentEl); break;
      case 'care': renderCarePage(subContentEl); break;
      case 'patients': renderAdminPatientsPage(subContentEl); break;
      case 'doctors': renderAdminDoctorsPage(subContentEl); break;
      case 'audit': renderAdminAuditPage(subContentEl); break;
      case 'demo-simulation': renderDemoSimulation(subContentEl); break;
      default: renderDashboard(subContentEl); break;
    }
  };

  renderCurrentSubRoute();

  const updateAlarmBadgeAndBanner = () => {
    if (!document.body.contains(container)) return;
    const unack = alertManager.getUnacknowledgedCount('admin');
    const alarmBtn = container.querySelector('.header-alarm-btn');
    if (alarmBtn) {
      const existingBadge = alarmBtn.querySelector('.header-alarm-badge');
      if (unack > 0) {
        if (existingBadge) existingBadge.textContent = unack;
        else alarmBtn.insertAdjacentHTML('beforeend', `<span class="header-alarm-badge">${unack}</span>`);
      } else if (existingBadge) {
        existingBadge.remove();
      }
    }
    const bannerEl = container.querySelector('#admin-emergency-alert-banner');
    if (bannerEl) alertManager.renderActiveAlertBanner(bannerEl, 'admin');
  };

  // Reactive subscription for zero-refresh operational synchronization across devices
  const unsubscribeState = appState.subscribe(() => {
    updateAlarmBadgeAndBanner();
    if (['patients', 'doctors', 'command', 'emergency'].includes(subRoute)) {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA')) {
        return; // Don't interrupt user typing
      }
      renderCurrentSubRoute();
    }
  });

  // Listen to remote realtime emergency events
  const unsubsEvents = [
    eventBus.on(EventTypes.EMERGENCY_ALERT_CREATED, (event) => {
      alertManager.ensureAudioUnlocked();
      if (event?.payload?.severity === 'CRITICAL' || event?.payload?.priority === 'P1') {
        alertManager.playEmergencyChime('P1');
      }
      updateAlarmBadgeAndBanner();
      if (['emergency', 'command'].includes(subRoute)) renderCurrentSubRoute();
    }),
    eventBus.on(EventTypes.EMERGENCY_PREARRIVAL_CREATED, (event) => {
      alertManager.ensureAudioUnlocked();
      alertManager.playEmergencyChime(event?.payload?.severity === 'Critical' ? 'P1' : 'P2');
      setTimeout(() => {
        alertManager.speakAlert(`Emergency pre-arrival alert. ${event?.payload?.patientName || 'Emergency patient'} incoming.`);
      }, 350);
      updateAlarmBadgeAndBanner();
      if (['emergency', 'command'].includes(subRoute)) renderCurrentSubRoute();
    }),
    eventBus.on(EventTypes.EMERGENCY_CASE_CREATED, (event) => {
      alertManager.ensureAudioUnlocked();
      alertManager.playEmergencyChime('P1');
      setTimeout(() => {
        alertManager.speakAlert(`Critical emergency case detected. ${event?.payload?.patientName || 'Patient'} requires immediate attention.`);
      }, 350);
      updateAlarmBadgeAndBanner();
      if (['emergency', 'command'].includes(subRoute)) renderCurrentSubRoute();
    }),
    eventBus.on(EventTypes.AMBULANCE_REQUEST_CREATED, (event) => {
      alertManager.ensureAudioUnlocked();
      alertManager.playAmbulanceChime();
      setTimeout(() => {
        alertManager.speakAlert('Emergency ambulance request received. Immediate attention required.');
      }, 350);
      updateAlarmBadgeAndBanner();
      if (['emergency', 'command'].includes(subRoute)) renderCurrentSubRoute();
    }),
    eventBus.on(EventTypes.EMERGENCY_ALERT_ACKNOWLEDGED, () => {
      updateAlarmBadgeAndBanner();
    })
  ];

  // Auto clean up when container unmounts
  const observer = new MutationObserver(() => {
    if (!document.body.contains(container)) {
      unsubscribeState();
      unsubsEvents.forEach(unsub => unsub?.());
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// Global window handler for Admin sound toggle
window._toggleAdminSound = () => {
  const isMuted = alertManager.toggleMute();
  if (!isMuted) {
    alertManager.ensureAudioUnlocked();
    alertManager.playEmergencyChime('P2');
  }
  const btn = document.getElementById('admin-sound-toggle-btn');
  if (btn) {
    btn.innerHTML = `<i class="fas ${isMuted ? 'fa-volume-mute' : 'fa-volume-up'}"></i> <span>${isMuted ? 'Muted' : 'Sound Active'}</span>`;
    btn.style.color = isMuted ? 'var(--text-muted)' : 'var(--primary)';
  }
};

// ============================================
// 1. ADMIN PATIENTS PAGE (LIVE JOURNEY CARDS + SEARCH)
// ============================================
function renderAdminPatientsPage(el) {
  const s = appState.get();
  const emergencyCases = (s.emergencyCases || []).filter(c => c.status !== 'COMPLETED');

  let patientsList = [...s.patients];

  // Search Filter
  if (patientSearch.trim()) {
    const q = patientSearch.toLowerCase().trim();
    patientsList = patientsList.filter(p =>
      p.displayName?.toLowerCase().includes(q) ||
      p.id?.toLowerCase().includes(q) ||
      p.phone?.includes(q) ||
      p.bloodGroup?.toLowerCase().includes(q)
    );
  }

  // Status Filtering
  if (patientFilter !== 'All') {
    patientsList = patientsList.filter(p => {
      const journey = appState.getPatientJourneyState(p.id);
      return journey.status.toLowerCase().includes(patientFilter.toLowerCase());
    });
  }

  // Sorting
  if (patientSort === 'Priority') {
    patientsList.sort((a, b) => {
      const jA = appState.getPatientJourneyState(a.id);
      const jB = appState.getPatientJourneyState(b.id);
      if (jA.isEmergency && !jB.isEmergency) return -1;
      if (!jA.isEmergency && jB.isEmergency) return 1;
      if (jA.isWarning && !jB.isWarning) return -1;
      if (!jA.isWarning && jB.isWarning) return 1;
      return 0;
    });
  }

  el.innerHTML = `
    <div class="admin-patients-layout animate-fade-in">
      <!-- Dedicated Emergency / Priority Patients Section -->
      ${emergencyCases.length > 0 ? `
        <div class="card" style="border-left: 4px solid var(--critical); margin-bottom: var(--space-6); background: #FFF5F5">
          <div class="card-header flex justify-between items-center" style="border-bottom: 1px solid rgba(239, 68, 68, 0.2); padding-bottom: var(--space-3)">
            <div>
              <h3 class="card-title" style="color: #991B1B"><i class="fas fa-heartbeat"></i> Emergency & Priority Patients (${emergencyCases.length})</h3>
              <div class="card-subtitle" style="color: #B91C1C">High priority trauma & emergency cases requiring active physician supervision</div>
            </div>
            <span class="badge badge-danger">CRITICAL PRIORITY</span>
          </div>
          <div class="grid-2" style="gap: var(--space-3); margin-top: var(--space-4)">
            ${emergencyCases.map(ec => `
              <div class="card-inner-box" style="background: white; border: 1px solid rgba(239, 68, 68, 0.3); margin: 0">
                <div class="flex justify-between items-start">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="badge badge-danger">${ec.priority || 'P1 CRITICAL'}</span>
                      <strong style="font-size: var(--font-size-md)">${escapeHtml(ec.patientName)}</strong>
                      <span style="font-size: 11px; color: var(--text-secondary)">(${ec.patientId || ec.caseId})</span>
                    </div>
                    <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-top: 4px; line-height: 1.6">
                      Assigned Doctor: <strong>Dr. ${escapeHtml(ec.doctorName || 'Awaiting Assignment')}</strong><br>
                      Transport: <strong>${escapeHtml(ec.transportMode || 'Ambulance')}</strong> · ETA: <strong style="color: var(--critical)">${ec.etaMinutes ? `${ec.etaMinutes} min` : 'In Trauma Bay'}</strong><br>
                      Status: <strong class="badge ${ec.doctorId ? 'badge-success' : 'badge-warning'}" style="font-size: 10px">${escapeHtml(ec.status || 'Incoming')}</strong>
                    </div>
                  </div>
                  <button class="btn btn-danger btn-sm" onclick="window.HospitalFlow.router.navigate('/admin/emergency')">
                    <i class="fas fa-shield-alt"></i> Manage
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Search & Filter Bar -->
      <div class="card" style="margin-bottom: var(--space-4); padding: var(--space-4)">
        <div class="flex justify-between items-center" style="flex-wrap: wrap; gap: var(--space-3); margin-bottom: var(--space-3)">
          <!-- Search Box -->
          <div class="flex items-center gap-2" style="flex: 1; min-width: 280px; position: relative">
            <div style="position: absolute; left: 12px; color: var(--text-secondary); pointer-events: none">
              <i class="fas fa-search"></i>
            </div>
            <input type="text" id="patient-search-input" class="form-input" style="padding-left: 36px; padding-right: 32px; height: 38px"
              placeholder="Search patients by name or Patient ID (e.g. Amit, P-1042)..." value="${escapeHtml(patientSearch)}">
            ${patientSearch ? `
              <button id="btn-clear-patient-search" class="btn btn-ghost btn-icon" style="position: absolute; right: 4px; height: 30px; width: 30px; color: var(--text-secondary)" title="Clear search">
                <i class="fas fa-times"></i>
              </button>
            ` : ''}
          </div>

          <div class="flex items-center gap-3">
            <span class="badge badge-info">${patientsList.length} of ${s.patients.length} Patients</span>
            <div class="flex items-center gap-2">
              <span style="font-size: var(--font-size-xs); color: var(--text-secondary)">Sort:</span>
              <select id="patient-sort-select" class="form-select" style="height: 36px; font-size: 12px">
                <option value="Priority" ${patientSort === 'Priority' ? 'selected' : ''}>Highest Priority First</option>
                <option value="Name" ${patientSort === 'Name' ? 'selected' : ''}>Patient Name</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Filter Chips -->
        <div class="flex items-center gap-2" style="flex-wrap: wrap; padding-top: var(--space-2); border-top: 1px solid var(--border-light)">
          <span style="font-size: var(--font-size-xs); font-weight: 700; color: var(--text-secondary)">Filter Status:</span>
          ${['All', 'Scheduled', 'Waiting', 'Consulting', 'Emergency', 'Discharged', 'Care at Home', 'Needs Review'].map(f => `
            <button class="btn btn-sm ${patientFilter === f ? 'btn-primary' : 'btn-ghost'}" onclick="window._setPatientFilter('${f}')">
              ${f}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Live Patient Cards Grid -->
      ${patientsList.length > 0 ? `
        <div class="grid-2" style="gap: var(--space-4)">
          ${patientsList.map(p => {
            const journey = appState.getPatientJourneyState(p.id);
            const apt = s.appointments.find(a => a.patientId === p.id && a.status === 'Scheduled');
            const queue = s.queueEntries.find(q => q.patientId === p.id && ['Waiting', 'Called', 'Consulting'].includes(q.status));
            const doc = apt ? s.doctors.find(d => d.id === apt.doctorId) : (queue ? s.doctors.find(d => d.id === queue.doctorId) : null);

            return `
              <div class="card live-patient-card animate-fade-in" style="border-left: 4px solid var(--${journey.variant === 'danger' ? 'critical' : journey.variant === 'warning' ? 'warning' : journey.variant === 'success' ? 'success' : 'primary'})">
                <div class="flex justify-between items-start" style="margin-bottom: var(--space-3)">
                  <div class="flex items-center gap-3">
                    <div class="header-user-avatar" style="width: 44px; height: 44px; font-size: 16px">${getInitials(p.displayName)}</div>
                    <div>
                      <h4 style="margin: 0; font-size: var(--font-size-md)">${escapeHtml(p.displayName)}</h4>
                      <div style="font-size: var(--font-size-xs); color: var(--text-secondary)">
                        ID: <strong>${p.id}</strong> · ${p.age || 29} Yrs · ${p.gender || 'Male'} · Blood: <strong>${p.bloodGroup || 'O+'}</strong>
                      </div>
                    </div>
                  </div>
                  <span class="badge badge-${journey.variant}">
                    <i class="fas ${journey.icon}"></i> ${journey.status}
                  </span>
                </div>

                <!-- Live Operational Journey Details -->
                <div class="card-inner-box" style="background: var(--bg-subtle); margin: var(--space-3) 0; font-size: var(--font-size-xs)">
                  <div class="flex justify-between" style="margin-bottom: 4px">
                    <span>Department: <strong>${escapeHtml(apt?.department || queue?.department || 'General Medicine')}</strong></span>
                    <span>Doctor: <strong>Dr. ${escapeHtml(doc?.displayName || 'Aarav Sharma')}</strong></span>
                  </div>
                  <div class="flex justify-between" style="margin-bottom: 4px">
                    <span>Token: <strong style="color: var(--primary)">${queue?.id || 'Not Checked In'}</strong></span>
                    <span>ETA: <strong style="color: var(--primary)">${queue?.estimatedWait != null ? formatMinutes(queue.estimatedWait) : '~18m'}</strong></span>
                  </div>
                  <div class="flex justify-between">
                    <span>Symptoms: <em>"${escapeHtml(apt?.symptom_original_text || 'Fever, Cough')}"</em></span>
                    <span>Ahead: <strong>${queue ? Math.max(0, queue.position - 1) : '0'}</strong></span>
                  </div>
                </div>

                <!-- Live Action Bar -->
                <div class="flex gap-2" style="margin-top: var(--space-3)">
                  <button class="btn btn-primary btn-sm" onclick="window._showPatientJourneyDrawer('${p.id}')">
                    <i class="fas fa-stream"></i> View Journey
                  </button>
                  <a href="tel:${p.phone || '+919876543210'}" class="btn btn-secondary btn-sm" title="Direct Phone Call">
                    <i class="fas fa-phone-alt"></i> Call
                  </a>
                  <button class="btn btn-ghost btn-sm" onclick="window._showPatientCareModal('${p.id}')">
                    <i class="fas fa-file-medical"></i> Care Plan
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <div class="card empty-state" style="padding: var(--space-8); text-align: center">
          <i class="fas fa-user-slash" style="font-size: 40px; color: var(--text-secondary); margin-bottom: 12px"></i>
          <h4>No patients found matching "${escapeHtml(patientSearch)}"</h4>
          <p style="color: var(--text-secondary); font-size: var(--font-size-xs)">Try searching by patient name (e.g. Amit, Neha) or ID (e.g. P-1001, 1042).</p>
          <button class="btn btn-secondary btn-sm" onclick="window._clearPatientSearch()" style="margin-top: 12px">
            <i class="fas fa-times"></i> Clear Search
          </button>
        </div>
      `}
    </div>
  `;

  const searchInput = el.querySelector('#patient-search-input');
  searchInput?.addEventListener('input', (e) => {
    patientSearch = e.target.value;
    renderAdminPatientsPage(el);
    const updatedInput = el.querySelector('#patient-search-input');
    if (updatedInput) {
      updatedInput.focus();
      updatedInput.setSelectionRange(patientSearch.length, patientSearch.length);
    }
  });

  el.querySelector('#btn-clear-patient-search')?.addEventListener('click', () => {
    patientSearch = '';
    renderAdminPatientsPage(el);
  });

  window._clearPatientSearch = () => {
    patientSearch = '';
    renderAdminPatientsPage(el);
  };

  window._setPatientFilter = (filter) => {
    patientFilter = filter;
    renderAdminPatientsPage(el);
  };

  el.querySelector('#patient-sort-select')?.addEventListener('change', (e) => {
    patientSort = e.target.value;
    renderAdminPatientsPage(el);
  });
}

// ============================================
// 2. ADMIN DOCTORS PAGE (OPERATIONAL WORKLOAD CARDS + SEARCH)
// ============================================
function renderAdminDoctorsPage(el) {
  const s = appState.get();

  let docsList = [...s.doctors];

  // Search Filter
  if (doctorSearch.trim()) {
    const q = doctorSearch.toLowerCase().trim();
    docsList = docsList.filter(d =>
      d.displayName?.toLowerCase().includes(q) ||
      d.id?.toLowerCase().includes(q) ||
      d.department?.toLowerCase().includes(q) ||
      d.specialty?.toLowerCase().includes(q) ||
      d.room?.toLowerCase().includes(q)
    );
  }

  if (doctorFilter !== 'All') {
    docsList = docsList.filter(d => d.status === doctorFilter || (doctorFilter === 'Emergency Active' && (d.status === 'EMERGENCY_ACTIVE' || d.status === 'EMERGENCY_ASSIGNED')));
  }

  el.innerHTML = `
    <div class="admin-doctors-layout animate-fade-in">
      <!-- Search & Filter Bar -->
      <div class="card" style="margin-bottom: var(--space-4); padding: var(--space-4)">
        <div class="flex justify-between items-center" style="flex-wrap: wrap; gap: var(--space-3); margin-bottom: var(--space-3)">
          <!-- Search Box -->
          <div class="flex items-center gap-2" style="flex: 1; min-width: 280px; position: relative">
            <div style="position: absolute; left: 12px; color: var(--text-secondary); pointer-events: none">
              <i class="fas fa-search"></i>
            </div>
            <input type="text" id="doctor-search-input" class="form-input" style="padding-left: 36px; padding-right: 32px; height: 38px"
              placeholder="Search doctors by name, Doctor ID, department or specialization..." value="${escapeHtml(doctorSearch)}">
            ${doctorSearch ? `
              <button id="btn-clear-doctor-search" class="btn btn-ghost btn-icon" style="position: absolute; right: 4px; height: 30px; width: 30px; color: var(--text-secondary)" title="Clear search">
                <i class="fas fa-times"></i>
              </button>
            ` : ''}
          </div>

          <div class="flex items-center gap-3">
            <span class="badge badge-info">${docsList.length} of ${s.doctors.length} Doctors</span>
          </div>
        </div>

        <!-- Filter Chips -->
        <div class="flex items-center gap-2" style="flex-wrap: wrap; padding-top: var(--space-2); border-top: 1px solid var(--border-light)">
          <span style="font-size: var(--font-size-xs); font-weight: 700; color: var(--text-secondary)">Filter Status:</span>
          ${['All', 'Available', 'Consulting', 'Emergency Active', 'Break'].map(f => `
            <button class="btn btn-sm ${doctorFilter === f ? 'btn-primary' : 'btn-ghost'}" onclick="window._setDoctorFilter('${f}')">
              ${f}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Live Doctor Operational Cards Grid -->
      ${docsList.length > 0 ? `
        <div class="grid-2" style="gap: var(--space-4)">
          ${docsList.map(doc => {
            const op = appState.getDoctorOperationalState(doc.id);
            const currentPatient = op?.currentPatient;
            const assignedEm = (s.emergencyCases || []).find(c => c.doctorId === doc.id && c.status !== 'COMPLETED');
            const waitingRoutine = s.queueEntries.filter(q => q.doctorId === doc.id && q.status === 'Waiting' && !q.priority?.includes('Emergency') && !q.priority?.includes('P1'));
            const nextRoutine = waitingRoutine[0] ? (s.patients.find(p => p.id === waitingRoutine[0].patientId) || { displayName: waitingRoutine[0].patientId }) : null;

            return `
              <div class="card live-doctor-card animate-fade-in" style="border-left: 4px solid var(--${assignedEm ? 'critical' : op.statusVariant === 'danger' ? 'critical' : op.statusVariant === 'success' ? 'success' : op.statusVariant === 'primary' ? 'primary' : 'warning'})">
                <div class="flex justify-between items-start" style="margin-bottom: var(--space-3)">
                  <div class="flex items-center gap-3">
                    <div class="header-user-avatar" style="width: 44px; height: 44px; background: #F0FDF4; color: #16A34A; font-size: 16px">${getInitials(doc.displayName)}</div>
                    <div>
                      <h4 style="margin: 0; font-size: var(--font-size-md)">${escapeHtml(doc.displayName)}</h4>
                      <div style="font-size: var(--font-size-xs); color: var(--text-secondary)">
                        ${escapeHtml(doc.department)} · Room <strong>${doc.room || 'G-04'}</strong> · <em>${escapeHtml(doc.specialty || 'General')}</em>
                      </div>
                    </div>
                  </div>
                  <span class="badge ${assignedEm ? 'badge-danger' : `badge-${op.statusVariant}`}">
                    ${assignedEm ? (doc.status === 'EMERGENCY_ACTIVE' ? 'EMERGENCY_ACTIVE' : 'EMERGENCY_ASSIGNED') : op.operationalStatus}
                  </span>
                </div>

                <!-- Active Emergency Case Hero Box -->
                ${assignedEm ? `
                  <div class="card-inner-box" style="background: #FEF2F2; border: 1px solid #FECACA; margin: var(--space-3) 0">
                    <div class="flex justify-between items-center" style="margin-bottom: 2px">
                      <strong style="color: #991B1B; font-size: var(--font-size-xs)"><i class="fas fa-heartbeat"></i> Current Emergency:</strong>
                      <span class="badge badge-danger" style="font-size: 10px">${assignedEm.priority || 'P1'}</span>
                    </div>
                    <div style="font-weight: 700; font-size: var(--font-size-sm); color: #7F1D1D">
                      ${escapeHtml(assignedEm.patientName)} (${assignedEm.caseId})
                    </div>
                    <div style="font-size: 11px; color: #991B1B; margin-top: 2px">
                      Symptoms: "${escapeHtml(assignedEm.symptoms || 'Breathing Difficulty')}" · Next Routine: <strong>${nextRoutine ? nextRoutine.displayName : 'None'}</strong>
                    </div>
                  </div>
                ` : `
                  <!-- Current Patient In-Room Hero Box -->
                  <div class="card-inner-box" style="background: ${currentPatient ? '#F0FDF4' : 'var(--bg-subtle)'}; border: 1px solid ${currentPatient ? '#BBF7D0' : 'var(--border)'}; margin: var(--space-3) 0">
                    <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 2px">Current Patient in Room:</div>
                    ${currentPatient ? `
                      <div style="font-weight: 700; font-size: var(--font-size-sm); color: #14532D">
                        ${escapeHtml(currentPatient.displayName)} (Token: ${op.consultingEntry?.id || 'GM-18'})
                      </div>
                      <div style="font-size: 11px; color: #15803D; margin-top: 2px">
                        Next in Queue: <strong>${op.nextPatient ? op.nextPatient.displayName : 'Queue empty'}</strong>
                      </div>
                    ` : `
                      <div style="font-size: var(--font-size-xs); color: var(--text-secondary)">No patient in room · Next: <strong>${op.nextPatient ? op.nextPatient.displayName : 'Queue empty'}</strong></div>
                    `}
                  </div>
                `}

                <!-- Workload Progress Bar -->
                <div style="margin: var(--space-3) 0">
                  <div class="flex justify-between" style="font-size: 11px; margin-bottom: 4px">
                    <span>Operational Load: <strong>${assignedEm ? Math.min(100, op.loadPercentage + 35) : op.loadPercentage}%</strong></span>
                    <span>Normal Waiting: <strong>${waitingRoutine.length} patients</strong></span>
                  </div>
                  <div class="progress-bar-track">
                    <div class="progress-bar-fill ${assignedEm ? 'red' : op.loadVariant}" style="width: ${assignedEm ? Math.min(100, op.loadPercentage + 35) : op.loadPercentage}%"></div>
                  </div>
                </div>

                <div class="flex justify-between" style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-bottom: var(--space-3)">
                  <span>Completed Today: <strong>${op.completedToday}</strong></span>
                  <span>Next Routine: <strong>${nextRoutine ? nextRoutine.displayName : 'Queue Clear'}</strong></span>
                </div>

                <!-- Action Bar -->
                <div class="flex gap-2">
                  <button class="btn btn-primary btn-sm" onclick="window._showDoctorDetailDrawer('${doc.id}')">
                    <i class="fas fa-stethoscope"></i> View Doctor
                  </button>
                  <a href="tel:${doc.phone || '+919876543200'}" class="btn btn-secondary btn-sm">
                    <i class="fas fa-phone-alt"></i> Call
                  </a>
                  <button class="btn btn-ghost btn-sm" onclick="window._showDoctorWorkloadRebalanceModal('${doc.id}')">
                    <i class="fas fa-balance-scale"></i> Rebalance
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <div class="card empty-state" style="padding: var(--space-8); text-align: center">
          <i class="fas fa-user-md" style="font-size: 40px; color: var(--text-secondary); margin-bottom: 12px"></i>
          <h4>No doctors found matching "${escapeHtml(doctorSearch)}"</h4>
          <p style="color: var(--text-secondary); font-size: var(--font-size-xs)">Try searching by doctor name (e.g. Sharma, Mehta), ID (e.g. D-0001), or department (e.g. Cardiology).</p>
          <button class="btn btn-secondary btn-sm" onclick="window._clearDoctorSearch()" style="margin-top: 12px">
            <i class="fas fa-times"></i> Clear Search
          </button>
        </div>
      `}
    </div>
  `;

  const searchDocInput = el.querySelector('#doctor-search-input');
  searchDocInput?.addEventListener('input', (e) => {
    doctorSearch = e.target.value;
    renderAdminDoctorsPage(el);
    const updatedInput = el.querySelector('#doctor-search-input');
    if (updatedInput) {
      updatedInput.focus();
      updatedInput.setSelectionRange(doctorSearch.length, doctorSearch.length);
    }
  });

  el.querySelector('#btn-clear-doctor-search')?.addEventListener('click', () => {
    doctorSearch = '';
    renderAdminDoctorsPage(el);
  });

  window._clearDoctorSearch = () => {
    doctorSearch = '';
    renderAdminDoctorsPage(el);
  };

  window._setDoctorFilter = (filter) => {
    doctorFilter = filter;
    renderAdminDoctorsPage(el);
  };
}

// ============================================
// 3. ADMIN AUDIT & ACTIVITY PAGE (Requirement 18, 35)
// ============================================
function renderAdminAuditPage(el) {
  let events = eventBus.getHistory({ limit: 50 });

  if (auditFilterType) {
    events = events.filter(e => e.type.toLowerCase().includes(auditFilterType.toLowerCase()));
  }
  if (auditSearch) {
    const q = auditSearch.toLowerCase();
    events = events.filter(e =>
      e.type.toLowerCase().includes(q) ||
      JSON.stringify(e.payload).toLowerCase().includes(q)
    );
  }

  el.innerHTML = `
    <div class="admin-audit-layout animate-fade-in">
      <div class="card" style="margin-bottom: var(--space-4)">
        <div class="flex justify-between items-center" style="flex-wrap: wrap; gap: var(--space-3)">
          <div>
            <h3 class="card-title"><i class="fas fa-stream" style="color: var(--primary)"></i> Audit Trail & Operational Logs</h3>
            <div class="card-subtitle">Real-time immutable event log across hospital flow, triage, and emergency coordination</div>
          </div>

          <div class="flex items-center gap-2">
            <input type="text" id="audit-search-input" class="form-input" style="height: 32px; width: 220px; font-size: 12px" placeholder="Search event history..." value="${escapeHtml(auditSearch)}">
            <select id="audit-filter-select" class="form-select" style="height: 32px; font-size: 12px">
              <option value="">All Event Categories</option>
              <option value="APPOINTMENT" ${auditFilterType === 'APPOINTMENT' ? 'selected' : ''}>Appointments</option>
              <option value="QUEUE" ${auditFilterType === 'QUEUE' ? 'selected' : ''}>Queue & Tokens</option>
              <option value="EMERGENCY" ${auditFilterType === 'EMERGENCY' ? 'selected' : ''}>Emergencies</option>
              <option value="AMBULANCE" ${auditFilterType === 'AMBULANCE' ? 'selected' : ''}>Ambulance</option>
              <option value="BLOOD" ${auditFilterType === 'BLOOD' ? 'selected' : ''}>Blood Requests</option>
              <option value="CARE" ${auditFilterType === 'CARE' ? 'selected' : ''}>Care Continuity</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Events Table -->
      <div class="card">
        <div class="table-container" style="border: none">
          <table class="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Event Type</th>
                <th>Description</th>
                <th>Actor Role</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              ${events.length > 0 ? events.map(e => {
                const color = getEventColor(e.type);
                const icon = getEventIcon(e.type);

                return `
                  <tr style="cursor: pointer" onclick="window._showEventDetailDrawer('${e.id}')">
                    <td style="font-family: monospace; font-size: 11px; color: var(--text-secondary)">${new Date(e.timestamp).toLocaleTimeString()}</td>
                    <td>
                      <span class="badge badge-${color === 'red' ? 'danger' : color === 'green' ? 'success' : color === 'orange' ? 'warning' : 'info'}">
                        <i class="fas ${icon}"></i> ${e.type}
                      </span>
                    </td>
                    <td style="font-size: var(--font-size-xs); font-weight: 500">${escapeHtml(getEventDescription(e))}</td>
                    <td><span class="badge badge-neutral">${e.role || 'system'}</span></td>
                    <td>
                      <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); window._showEventDetailDrawer('${e.id}')">
                        <i class="fas fa-eye"></i>
                      </button>
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr><td colspan="5" style="text-align: center; padding: var(--space-6); color: var(--text-secondary)">No audit events matched your search filter.</td></tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  el.querySelector('#audit-search-input')?.addEventListener('input', (e) => {
    auditSearch = e.target.value;
    renderAdminAuditPage(el);
  });

  el.querySelector('#audit-filter-select')?.addEventListener('change', (e) => {
    auditFilterType = e.target.value;
    renderAdminAuditPage(el);
  });
}

// ============================================
// PATIENT JOURNEY TIMELINE DRAWER (Requirement 4)
// ============================================
window._showPatientJourneyDrawer = (patientId) => {
  const s = appState.get();
  const p = s.patients.find(pt => pt.id === patientId);
  const events = eventBus.getHistory().filter(e => e.payload.patientId === patientId || e.entityId === patientId || JSON.stringify(e.payload).includes(patientId));
  const journey = appState.getPatientJourneyState(patientId);

  const modalRoot = document.getElementById('admin-modal-root') || document.body;
  modalRoot.innerHTML = `
    <div class="modal-backdrop active">
      <div class="drawer active animate-slide-in-right" style="max-width: 560px">
        <div class="drawer-header">
          <div>
            <h3 class="drawer-title"><i class="fas fa-stream" style="color: var(--primary)"></i> Patient Journey Timeline: ${escapeHtml(p?.displayName || patientId)}</h3>
            <div style="font-size: 11px; color: var(--text-secondary)">Current State: <span class="badge badge-${journey.variant}">${journey.status}</span></div>
          </div>
          <button class="drawer-close" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
        </div>

        <div class="drawer-body">
          <h4 style="font-size: var(--font-size-sm); margin-bottom: var(--space-3)">Real-Time Journey Events</h4>
          <div class="timeline-container">
            ${events.length > 0 ? events.map(e => `
              <div class="timeline-item">
                <div class="timeline-badge"><i class="fas ${getEventIcon(e.type)}"></i></div>
                <div class="timeline-content">
                  <div class="flex justify-between">
                    <strong>${e.type}</strong>
                    <span style="font-size: 10px; color: var(--text-tertiary)">${new Date(e.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-top: 2px">${escapeHtml(getEventDescription(e))}</div>
                </div>
              </div>
            `).join('') : `
              <div class="empty-state" style="padding: var(--space-4)">
                <p>No recent event activity recorded for this patient.</p>
              </div>
            `}
          </div>
        </div>
        <div class="drawer-footer">
          <button class="btn btn-primary" style="width: 100%" onclick="this.closest('.modal-backdrop').remove()">Close Journey</button>
        </div>
      </div>
    </div>
  `;
};

// Event Detail Drawer
window._showEventDetailDrawer = (eventId) => {
  const event = eventBus.getHistory().find(e => e.id === eventId);
  if (!event) return;

  const modalRoot = document.getElementById('admin-modal-root') || document.body;
  modalRoot.innerHTML = `
    <div class="modal-backdrop active">
      <div class="drawer active animate-slide-in-right" style="max-width: 480px">
        <div class="drawer-header">
          <h3 class="drawer-title"><i class="fas fa-info-circle"></i> Event: ${event.type}</h3>
          <button class="drawer-close" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
        </div>
        <div class="drawer-body">
          <div class="form-group"><label class="form-label">Event ID</label><input type="text" class="form-input" value="${event.id}" readonly></div>
          <div class="form-group"><label class="form-label">Timestamp</label><input type="text" class="form-input" value="${new Date(event.timestamp).toLocaleString()}" readonly></div>
          <div class="form-group"><label class="form-label">Actor Role</label><input type="text" class="form-input" value="${event.role || 'system'}" readonly></div>
          <div class="form-group"><label class="form-label">Payload Data</label><pre style="background: var(--bg-subtle); padding: var(--space-3); border-radius: var(--radius-md); font-size: 11px; overflow-x: auto">${JSON.stringify(event.payload, null, 2)}</pre></div>
        </div>
        <div class="drawer-footer">
          <button class="btn btn-primary" style="width: 100%" onclick="this.closest('.modal-backdrop').remove()">Close</button>
        </div>
      </div>
    </div>
  `;
};

// Doctor Detail Drawer
window._showDoctorDetailDrawer = (doctorId) => {
  const s = appState.get();
  const doc = s.doctors.find(d => d.id === doctorId);
  const op = appState.getDoctorOperationalState(doctorId);

  const modalRoot = document.getElementById('admin-modal-root') || document.body;
  modalRoot.innerHTML = `
    <div class="modal-backdrop active">
      <div class="drawer active animate-slide-in-right" style="max-width: 480px">
        <div class="drawer-header">
          <h3 class="drawer-title"><i class="fas fa-user-md"></i> Dr. ${escapeHtml(doc?.displayName || doctorId)}</h3>
          <button class="drawer-close" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
        </div>
        <div class="drawer-body">
          <div class="card-inner-box">
            <div>Department: <strong>${escapeHtml(doc?.department)}</strong> · Room ${doc?.room || 'G-04'}</div>
            <div>Status: <span class="badge badge-${op.statusVariant}">${op.operationalStatus}</span></div>
            <div>Operational Load: <strong>${op.loadPercentage}%</strong> (${op.waitingCount} waiting)</div>
            <div>Completed Today: <strong>${op.completedToday} consultations</strong></div>
          </div>
        </div>
        <div class="drawer-footer">
          <button class="btn btn-primary" style="width: 100%" onclick="this.closest('.modal-backdrop').remove()">Close</button>
        </div>
      </div>
    </div>
  `;
};

window._showPatientCareModal = (patientId) => {
  const s = appState.get();
  const plan = s.dischargePlans.find(dp => dp.patientId === patientId && dp.active);
  const modalRoot = document.getElementById('admin-modal-root') || document.body;
  modalRoot.innerHTML = `
    <div class="modal-backdrop active">
      <div class="modal active" style="max-width: 500px">
        <div class="modal-header">
          <h3 class="modal-title"><i class="fas fa-heartbeat"></i> Care Continuity Status</h3>
          <button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
        </div>
        <div class="modal-body">
          ${plan ? `
            <div class="card-inner-box">
              <strong>Active Care Plan: ${plan.id}</strong>
              <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-top: 4px">
                Medications: ${plan.medications.map(m => m.name).join(', ')}<br>
                Diet: ${plan.dietPlan || 'Standard recovery diet'}
              </div>
            </div>
          ` : `
            <p style="font-size: var(--font-size-xs); color: var(--text-secondary)">No active care plan on record for patient ${patientId}.</p>
          `}
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" onclick="this.closest('.modal-backdrop').remove()">Close</button>
        </div>
      </div>
    </div>
  `;
};
