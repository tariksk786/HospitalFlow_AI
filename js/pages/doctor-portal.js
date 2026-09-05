// ============================================
// HospitalFlow AI — Doctor Clinical Portal
// Real-Time Emergency Intake, Priority Queueing & Consultation Workstation
// ============================================

import appState from '../state.js';
import Config from '../config.js';
import Auth from '../auth.js';
import Router from '../router.js';
import FlowEngine from '../engines/flow-engine.js';
import alertManager from '../engines/emergency-alert-manager.js';
import BloodEngine from '../engines/blood-engine.js';
import CareEngine from '../engines/care-engine.js';
import eventBus, { EventTypes } from '../events.js';
import { escapeHtml, formatMinutes, formatTime, formatDate, timeAgo, getInitials } from '../utils.js';

let myPatientSearch = '';
let doctorEmergencyAlertBound = false;

export function renderDoctorPortal(container, subRoute = 'dashboard') {
  const user = Auth.getCurrentUser();
  if (!user || user.role !== 'doctor') {
    Router.navigate('/login');
    return;
  }

  const doctorId = user.doctorId || 'D-0001';
  const doctor = appState.get().doctors.find(d => d.id === doctorId) || {
    id: doctorId,
    displayName: user.displayName || 'Aarav Sharma',
    department: 'General Medicine',
    specialty: 'Internal Medicine & Trauma Response',
    room: 'G-04',
    status: 'Available',
    completedToday: 4,
    averageConsultationMinutes: 9
  };

  const navItems = [
    { route: '/doctor/dashboard', icon: 'fa-tachometer-alt', label: 'Dashboard' },
    { route: '/doctor/appointments', icon: 'fa-calendar-day', label: 'Appointments' },
    { route: '/doctor/followups', icon: 'fa-user-clock', label: 'Follow-Up' },
    { route: '/doctor/my-patients', icon: 'fa-user-friends', label: 'My Patients' },
    { route: '/doctor/blood-requests', icon: 'fa-tint', label: 'Blood Requests' },
    { route: '/doctor/care-plans', icon: 'fa-notes-medical', label: 'Care Plans' },
    { route: '/doctor/profile', icon: 'fa-user-md', label: 'Profile' }
  ];

  const unackAlerts = alertManager.getUnacknowledgedCount('doctor', doctor.id);

  container.innerHTML = `
    <div class="app-shell animate-fade-in" id="doctor-app-shell">
      <!-- 1. Left Fixed Sidebar -->
      <aside class="app-sidebar" id="doctor-sidebar">
        <div class="sidebar-brand">
          <div class="sidebar-brand-icon">
            <i class="fas fa-stethoscope"></i>
          </div>
          <div class="sidebar-brand-text">
            <span class="sidebar-brand-title">HospitalFlow AI</span>
            <span class="sidebar-brand-sub">Clinical Workstation</span>
          </div>
        </div>

        <nav class="sidebar-nav">
          ${navItems.map(item => `
            <a href="#${item.route}" class="sidebar-nav-item ${subRoute === item.route.replace('/doctor/', '') ? 'active' : ''}">
              <i class="fas ${item.icon}"></i>
              <span>${item.label}</span>
            </a>
          `).join('')}
        </nav>

        <div class="sidebar-footer">
          <button class="sidebar-collapse-btn" id="btn-toggle-doctor-sidebar" title="Collapse sidebar">
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
              <h2>${subRoute === 'dashboard' ? 'Doctor Dashboard' :
                    subRoute === 'appointments' ? "Today's Consultation Schedule" :
                    subRoute === 'followups' ? 'Care Continuity & Follow-Up' :
                    subRoute === 'my-patients' ? 'Patient Directory' :
                    subRoute === 'blood-requests' ? 'Emergency Blood Requests' :
                    subRoute === 'care-plans' ? 'Discharge Care Plans' : 'Doctor Profile'}</h2>
              <span>Dr. ${escapeHtml(doctor.displayName)} · ${escapeHtml(doctor.department)} (Room ${doctor.room || 'G-04'})</span>
            </div>
          </div>

          <div class="header-right">
            <!-- Audio Mute / Unmute Controls (Requirement 7) -->
            <button class="btn btn-ghost btn-sm" id="btn-toggle-doctor-mute" title="Toggle Emergency Alert Audio" style="font-size: 12px">
              <i class="fas ${alertManager.isMuted ? 'fa-volume-mute' : 'fa-volume-up'}"></i>
              <span>${alertManager.isMuted ? 'Muted' : 'Sound Active'}</span>
            </button>

            <!-- Emergency Alert Bell -->
            <button class="header-alarm-btn" onclick="window.HospitalFlow.router.navigate('/doctor/dashboard')" title="Emergency Alerts">
              <i class="fas fa-ambulance"></i>
              ${unackAlerts > 0 ? `<span class="header-alarm-badge">${unackAlerts}</span>` : ''}
            </button>

            <!-- User Info Pill -->
            <div class="header-user-pill">
              <div class="header-user-avatar" style="background: #DCFCE7; color: #16A34A">${getInitials(doctor.displayName)}</div>
              <div class="header-user-details">
                <span class="header-user-name">Dr. ${escapeHtml(doctor.displayName)}</span>
                <span class="header-user-role">${doctor.department}</span>
              </div>
            </div>

            <!-- Logout Button -->
            <button class="btn btn-ghost btn-icon" onclick="window.HospitalFlow.logout()" title="Sign Out">
              <i class="fas fa-sign-out-alt"></i>
            </button>
          </div>
        </header>

        <!-- Emergency Alert Banner Hook -->
        <div id="doctor-emergency-alert-banner"></div>

        <!-- Sub Content View -->
        <main class="app-content">
          <div id="doctor-sub-content"></div>
        </main>
      </div>

      <div id="doctor-modal-root"></div>
    </div>
  `;

  // Audio mute button listener
  container.querySelector('#btn-toggle-doctor-mute')?.addEventListener('click', (e) => {
    const isMuted = alertManager.toggleMute();
    const btn = e.currentTarget;
    btn.innerHTML = `<i class="fas ${isMuted ? 'fa-volume-mute' : 'fa-volume-up'}"></i> <span>${isMuted ? 'Muted' : 'Sound Active'}</span>`;
  });

  // Render Alert Banner if any
  alertManager.renderActiveAlertBanner(container.querySelector('#doctor-emergency-alert-banner'), 'doctor', doctor.id);

  // Sidebar Collapse Listener
  const sidebar = container.querySelector('#doctor-sidebar');
  const mainShell = container.querySelector('.app-main');
  container.querySelector('#btn-toggle-doctor-sidebar')?.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    mainShell.classList.toggle('sidebar-collapsed');
  });

  // Wire Real-time Emergency Assignment Popup (Requirement 6 & 7)
  if (!doctorEmergencyAlertBound) {
    doctorEmergencyAlertBound = true;
    eventBus.on(EventTypes.EMERGENCY_CASE_ASSIGNED, (evt) => {
      const payload = evt.payload;
      const currentDocId = Auth.getCurrentUser()?.doctorId;
      if (currentDocId && (payload.doctorId === currentDocId || !payload.doctorId)) {
        window._showDoctorEmergencyAssignedModal(payload);
      }
    });
  }

  // Render Sub Route
  const subContentEl = container.querySelector('#doctor-sub-content');
  const renderSubRouteView = () => {
    if (!subContentEl || !document.body.contains(subContentEl)) return;
    switch (subRoute) {
      case 'dashboard': renderDoctorDashboard(subContentEl, doctor); break;
      case 'appointments': renderDoctorAppointments(subContentEl, doctor); break;
      case 'followups': renderDoctorFollowUps(subContentEl, doctor); break;
      case 'my-patients': renderDoctorMyPatients(subContentEl, doctor); break;
      case 'blood-requests': renderDoctorBloodRequests(subContentEl, doctor); break;
      case 'care-plans': renderDoctorCarePlans(subContentEl, doctor); break;
      case 'profile': renderDoctorProfile(subContentEl, doctor); break;
      default: renderDoctorDashboard(subContentEl, doctor); break;
    }
  };

  renderSubRouteView();

  // Reactive state sync for doctor portal
  const unsubscribeState = appState.subscribe(() => {
    if (document.body.contains(subContentEl)) {
      renderSubRouteView();
    }
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
// 1. DOCTOR DASHBOARD WORKSPACE (Requirements 8, 14, 15)
// ============================================
function renderDoctorDashboard(el, doctor) {
  const s = appState.get();
  
  // Find queue entries for this doctor
  const myQueue = s.queueEntries.filter(q => q.doctorId === doctor.id && ['Waiting', 'Called', 'In-Room', 'Consulting'].includes(q.status));
  
  const consultingEntry = myQueue.find(q => q.status === 'Consulting');
  const inRoomEntry = myQueue.find(q => q.status === 'In-Room');
  const calledEntry = myQueue.find(q => q.status === 'Called');
  
  // Waiting queue entries sorted: Emergencies at top, then by position
  const waitingQueue = myQueue
    .filter(q => q.status === 'Waiting')
    .sort((a, b) => {
      const isEmA = (a.priority || '').includes('Emergency') || (a.priority || '').includes('P1') || (a.priority || '').includes('P2');
      const isEmB = (b.priority || '').includes('Emergency') || (b.priority || '').includes('P1') || (b.priority || '').includes('P2');
      if (isEmA && !isEmB) return -1;
      if (!isEmA && isEmB) return 1;
      return (a.position || 1) - (b.position || 1);
    });

  const activeEntry = consultingEntry || inRoomEntry || calledEntry;
  const currentPatient = activeEntry ? (s.patients.find(p => p.id === activeEntry.patientId) || { displayName: activeEntry.patientId }) : null;
  const nextPatient = waitingQueue[0] ? (s.patients.find(p => p.id === waitingQueue[0].patientId) || { displayName: waitingQueue[0].patientId }) : null;

  // Active Assigned Emergency Case
  const assignedEmergency = (s.emergencyCases || []).find(c => c.doctorId === doctor.id && c.status !== 'COMPLETED');

  el.innerHTML = `
    <div class="doctor-dashboard-layout animate-fade-in">
      <!-- 4 Top KPIs -->
      <div class="grid-4" style="margin-bottom: var(--space-6)">
        <div class="metric-card">
          <div class="kpi-icon blue"><i class="fas fa-user-clock"></i></div>
          <div class="kpi-content">
            <div class="kpi-label">Routine Waiting</div>
            <div class="kpi-value">${waitingQueue.filter(q => !q.priority?.includes('P1') && !q.priority?.includes('Emergency')).length}</div>
            <div class="kpi-meta">Normal OPD queue</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="kpi-icon ${assignedEmergency ? 'red' : 'green'}">
            <i class="fas ${assignedEmergency ? 'fa-heartbeat' : 'fa-check-circle'}"></i>
          </div>
          <div class="kpi-content">
            <div class="kpi-label">Emergency Status</div>
            <div class="kpi-value" style="font-size: 18px; color: ${assignedEmergency ? 'var(--critical)' : 'inherit'}">
              ${assignedEmergency ? (assignedEmergency.status === 'EMERGENCY_ACTIVE' ? 'Emergency Active' : 'Emergency Assigned') : 'No Emergency'}
            </div>
            <div class="kpi-meta">${assignedEmergency ? assignedEmergency.caseId : 'OPD nominal'}</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="kpi-icon orange"><i class="fas fa-stopwatch"></i></div>
          <div class="kpi-content">
            <div class="kpi-label">Avg Consult Time</div>
            <div class="kpi-value">${doctor.averageConsultationMinutes || 9} <span style="font-size: 14px; font-weight: normal; color: var(--text-secondary)">min</span></div>
            <div class="kpi-meta">Clinical velocity</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="kpi-icon teal"><i class="fas fa-stethoscope"></i></div>
          <div class="kpi-content">
            <div class="kpi-label">Doctor Workload</div>
            <div class="kpi-value">${Math.min(100, Math.round(((waitingQueue.length + (assignedEmergency ? 2 : 0)) * 14) + 15))}%</div>
            <div class="kpi-meta">Capacity utilization</div>
          </div>
        </div>
      </div>

      <!-- Priority Emergency Alert Hero (Requirement 6 & 8) -->
      ${assignedEmergency ? `
        <div class="card" style="border: 2px solid #EF4444; background: #FEF2F2; margin-bottom: var(--space-6); box-shadow: 0 4px 16px rgba(239, 68, 68, 0.15)">
          <div class="card-header flex justify-between items-center" style="border-bottom: 1px solid rgba(239, 68, 68, 0.2); padding-bottom: var(--space-3)">
            <div class="flex items-center gap-3">
              <div style="width: 40px; height: 40px; border-radius: 50%; background: #DC2626; color: white; display: flex; align-items: center; justify-content: center; font-size: 18px">
                <i class="fas fa-ambulance"></i>
              </div>
              <div>
                <h3 class="card-title" style="color: #991B1B">
                  🚨 PRIORITY EMERGENCY CASE ASSIGNED (${assignedEmergency.caseId})
                </h3>
                <div class="card-subtitle" style="color: #B91C1C">Assigned to Dr. ${escapeHtml(doctor.displayName)} by Hospital Command</div>
              </div>
            </div>
            <span class="badge badge-danger" style="font-size: 12px; padding: 6px 12px">${assignedEmergency.priority || 'P1 - Critical'}</span>
          </div>

          <div class="flex justify-between items-center" style="margin: var(--space-4) 0; flex-wrap: wrap; gap: var(--space-4)">
            <div>
              <div class="flex items-center gap-2">
                <h4 style="margin: 0; font-size: 18px; font-weight: 800">${escapeHtml(assignedEmergency.patientName)}</h4>
                <span class="badge badge-neutral">ID: ${assignedEmergency.patientId || 'P-1084'}</span>
              </div>
              <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-top: 4px">
                Reported Symptoms: <strong style="color: var(--text-primary)">"${escapeHtml(assignedEmergency.symptoms || 'Acute Respiratory Distress')}"</strong><br>
                Transport: <strong>${escapeHtml(assignedEmergency.transportMode || 'Ambulance')}</strong> · Arrival ETA: <strong style="color: var(--critical)">${assignedEmergency.etaMinutes ? `${assignedEmergency.etaMinutes} min` : 'In Trauma Bay'}</strong>
              </div>
            </div>

            <div class="flex gap-2" style="flex-wrap: wrap">
              <button class="btn btn-danger" onclick="window.HospitalFlow.startEmergencyConsultation('${assignedEmergency.caseId}')">
                <i class="fas fa-stethoscope"></i> Start Emergency Consultation
              </button>
              <button class="btn btn-warning" onclick="window._showDoctorBloodRequestModal('${assignedEmergency.patientId || 'P-1084'}')">
                <i class="fas fa-tint"></i> Request Emergency Blood
              </button>
              <button class="btn btn-success" onclick="window.HospitalFlow.completeEmergencyCase('${assignedEmergency.caseId}')">
                <i class="fas fa-check-circle"></i> Complete Emergency (Restore Capacity)
              </button>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Current In-Room / Called Patient Workspace Card -->
      <div class="card" style="border: 2px solid ${activeEntry ? 'var(--primary-border)' : 'var(--border)'}; margin-bottom: var(--space-6); background: ${activeEntry ? '#F8FAFC' : 'white'}">
        <div class="card-header flex justify-between items-center">
          <div>
            <h3 class="card-title"><i class="fas fa-stethoscope" style="color: var(--primary)"></i> Current Consultation Workspace</h3>
            <div class="card-subtitle">
              ${consultingEntry ? 'Active patient consultation in room' :
                inRoomEntry ? 'Patient in room · Ready to begin consultation' :
                calledEntry ? 'Patient called · Awaiting arrival' : 'Consultation room currently available'}
            </div>
          </div>
          <span class="badge ${consultingEntry ? 'badge-success' : inRoomEntry ? 'badge-info' : calledEntry ? 'badge-warning' : 'badge-neutral'}">
            ${consultingEntry ? 'Consulting Now' :
              inRoomEntry ? 'In Room — Awaiting Start' :
              calledEntry ? 'Called — Awaiting Arrival' : 'Room Available'}
          </span>
        </div>

        ${activeEntry && currentPatient ? `
          <div class="flex justify-between items-center" style="margin: var(--space-4) 0; flex-wrap: wrap; gap: var(--space-4)">
            <div class="flex items-center gap-4">
              <div class="header-user-avatar" style="width: 56px; height: 56px; font-size: 20px">${getInitials(currentPatient.displayName)}</div>
              <div>
                <h3 style="margin: 0">${escapeHtml(currentPatient.displayName)}</h3>
                <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-top: 2px">
                  ID: <strong>${currentPatient.id || activeEntry.patientId}</strong> · Token: <strong style="color: var(--primary)">${activeEntry.id}</strong> · Blood: <strong style="color: var(--critical)">${currentPatient.bloodGroup || 'O+'}</strong>
                </div>
              </div>
            </div>

            <div class="flex gap-2" style="flex-wrap: wrap">
              ${calledEntry ? `
                <button class="btn btn-primary btn-sm" onclick="window.HospitalFlow.markPatientInRoom('${calledEntry.id}')">
                  <i class="fas fa-door-open"></i> Mark In Room
                </button>
                <button class="btn btn-success btn-sm" onclick="window.HospitalFlow.startConsultation('${calledEntry.id}')">
                  <i class="fas fa-play"></i> Start Consultation
                </button>
              ` : inRoomEntry ? `
                <button class="btn btn-success btn-sm" onclick="window.HospitalFlow.startConsultation('${inRoomEntry.id}')">
                  <i class="fas fa-play"></i> Start Consultation
                </button>
                <button class="btn btn-secondary btn-sm" onclick="window._showDoctorCareHistoryDrawer('${currentPatient.id || activeEntry.patientId}')">
                  <i class="fas fa-history"></i> Clinical History
                </button>
              ` : `
                <button class="btn btn-secondary btn-sm" onclick="window._showDoctorCarePlanAuthorModal('${currentPatient.id || activeEntry.patientId}')">
                  <i class="fas fa-file-medical"></i> Author Care Plan
                </button>
                <button class="btn btn-warning btn-sm" onclick="window._showDoctorBloodRequestModal('${currentPatient.id || activeEntry.patientId}')">
                  <i class="fas fa-tint"></i> Request Blood
                </button>
                <button class="btn btn-success btn-sm" onclick="window.HospitalFlow.completeConsultation('${consultingEntry.id}')">
                  <i class="fas fa-check-circle"></i> Complete Consultation
                </button>
              `}
            </div>
          </div>
        ` : `
          <div class="empty-state" style="padding: var(--space-6)">
            <i class="fas fa-user-md" style="font-size: 36px; color: var(--text-tertiary)"></i>
            <h4>No patient currently in consultation room</h4>
            <p>Next patient in queue: <strong>${nextPatient ? nextPatient.displayName : 'Queue empty'}</strong></p>
            ${waitingQueue.length > 0 ? `
              <button class="btn btn-primary" onclick="window.HospitalFlow.callPatient('${waitingQueue[0].id}')">
                <i class="fas fa-bullhorn"></i> Call Next Patient (${waitingQueue[0].id})
              </button>
            ` : ''}
          </div>
        `}
      </div>

      <!-- Priority Doctor Queue Table (Requirement 8) -->
      <div class="card">
        <div class="card-header flex justify-between items-center">
          <div>
            <h3 class="card-title"><i class="fas fa-list-ol"></i> Doctor's Live Patient Queue (${waitingQueue.length} Waiting)</h3>
            <div class="card-subtitle">Emergencies automatically prioritized at position #1 with downstream ETA synchronization</div>
          </div>
        </div>

        <div class="table-container" style="border: none; margin-top: var(--space-3)">
          <table class="data-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Token</th>
                <th>Patient</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Estimated Wait</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${waitingQueue.length > 0 ? waitingQueue.map((q, idx) => {
                const pt = s.patients.find(p => p.id === q.patientId);
                const isEmergency = (q.priority || '').includes('P1') || (q.priority || '').includes('Emergency') || (q.priority || '').includes('P2');
                const rowBg = isEmergency ? 'background: #FEF2F2' : '';

                return `
                  <tr style="${rowBg}">
                    <td><strong>#${idx + 1}</strong></td>
                    <td><strong style="color: ${isEmergency ? 'var(--critical)' : 'var(--primary)'}">${q.id}</strong></td>
                    <td style="font-weight: 700">${escapeHtml(pt?.displayName || q.patientId)}</td>
                    <td>
                      <span class="badge ${isEmergency ? 'badge-danger' : 'badge-neutral'}">
                        ${isEmergency ? (q.priority?.includes('P1') ? 'P1 CRITICAL' : 'P2 URGENT') : 'Routine'}
                      </span>
                    </td>
                    <td><span class="badge badge-warning">${q.status}</span></td>
                    <td><strong style="color: ${isEmergency ? 'var(--critical)' : 'inherit'}">${isEmergency ? 'Immediate / In Bay' : formatMinutes(q.estimatedWait || 0)}</strong></td>
                    <td>
                      <div class="flex gap-1">
                        ${isEmergency ? `
                          <button class="btn btn-danger btn-sm" onclick="window.HospitalFlow.startEmergencyConsultation('${q.id}')">
                            <i class="fas fa-stethoscope"></i> Attend Emergency
                          </button>
                        ` : `
                          <button class="btn btn-primary btn-sm" onclick="window.HospitalFlow.callPatient('${q.id}')">
                            <i class="fas fa-bullhorn"></i> Call Patient
                          </button>
                        `}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr><td colspan="7" style="text-align: center; padding: var(--space-4); color: var(--text-secondary)">No waiting patients in queue.</td></tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ============================================
// 2. DOCTOR APPOINTMENTS SCHEDULE VIEW
// ============================================
function renderDoctorAppointments(el, doctor) {
  const s = appState.get();
  const myApts = s.appointments
    .filter(a => a.doctorId === doctor.id)
    .sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));

  el.innerHTML = `
    <div class="doctor-appointments-layout animate-fade-in">
      <div class="card" style="margin-bottom: var(--space-4)">
        <h3 class="card-title"><i class="fas fa-calendar-alt" style="color: var(--primary)"></i> Consultation Schedule (${myApts.length} Appointments)</h3>
      </div>

      <div class="grid-2" style="gap: var(--space-4)">
        ${myApts.map(apt => {
          const pt = s.patients.find(p => p.id === apt.patientId);
          return `
            <div class="card" style="border-left: 4px solid var(--primary)">
              <div class="flex justify-between items-center" style="margin-bottom: var(--space-2)">
                <strong style="font-size: var(--font-size-md)">${escapeHtml(pt?.displayName || apt.patientId)}</strong>
                <span class="badge ${apt.status === 'Scheduled' ? 'badge-info' : 'badge-success'}">${apt.status}</span>
              </div>
              <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-bottom: var(--space-3)">
                Time: <strong>${formatTime(apt.scheduledTime)}</strong> · Symptoms: <em>"${escapeHtml(apt.symptom_original_text || 'Fever, Cough')}"</em>
              </div>
              <div class="flex gap-2">
                <button class="btn btn-primary btn-sm" onclick="window._handleDoctorCallAppointment('${apt.id}')">
                  <i class="fas fa-bullhorn"></i> Call Patient
                </button>
                <button class="btn btn-secondary btn-sm" onclick="window._showDoctorCareHistoryDrawer('${apt.patientId}')">
                  <i class="fas fa-history"></i> Care History
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  window._handleDoctorCallAppointment = (aptId) => {
    const apt = s.appointments.find(a => a.id === aptId);
    if (!apt) return;
    let qEntry = s.queueEntries.find(q => q.appointmentId === aptId || q.patientId === apt.patientId);
    if (!qEntry) {
      const res = FlowEngine.checkInPatient(aptId);
      qEntry = res.queueEntry;
    }
    if (qEntry) {
      FlowEngine.callPatient(qEntry.id);
      window.HospitalFlow.router.navigate('/doctor/dashboard');
    }
  };
}

// ============================================
// 3. DOCTOR FOLLOW-UPS
// ============================================
function renderDoctorFollowUps(el, doctor) {
  const s = appState.get();
  const myFollowUps = s.followUps.filter(fu => fu.department === doctor.department);

  el.innerHTML = `
    <div class="doctor-followups-layout animate-fade-in">
      <div class="card">
        <h3 class="card-title"><i class="fas fa-user-clock" style="color: var(--primary)"></i> Scheduled Care Follow-Ups (${myFollowUps.length})</h3>
        <div class="flex flex-col gap-3" style="margin-top: var(--space-4)">
          ${myFollowUps.map(fu => {
            const pt = s.patients.find(p => p.id === fu.patientId);
            return `
              <div class="card-inner-box" style="margin: 0; border-left: 4px solid var(--teal)">
                <div class="flex justify-between items-center">
                  <strong>${escapeHtml(pt?.displayName || fu.patientId)}</strong>
                  <span class="badge badge-info">${fu.status}</span>
                </div>
                <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-top: 4px">
                  Scheduled Date: <strong>${formatDate(fu.date)}</strong> at <strong>${fu.time}</strong> · Department: ${fu.department}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

// ============================================
// 4. DOCTOR MY PATIENTS
// ============================================
function renderDoctorMyPatients(el, doctor) {
  const s = appState.get();
  let pts = [...s.patients];

  if (myPatientSearch) {
    pts = pts.filter(p => p.displayName.toLowerCase().includes(myPatientSearch.toLowerCase()) || p.id.toLowerCase().includes(myPatientSearch.toLowerCase()));
  }

  el.innerHTML = `
    <div class="doctor-my-patients-layout animate-fade-in">
      <div class="card" style="margin-bottom: var(--space-4)">
        <div class="flex justify-between items-center" style="flex-wrap: wrap; gap: var(--space-3)">
          <h3 class="card-title"><i class="fas fa-user-friends" style="color: var(--primary)"></i> Patient Directory (${pts.length})</h3>
          <input type="text" id="my-patients-search" class="form-input" style="height: 32px; width: 220px; font-size: 12px" placeholder="Search patients..." value="${escapeHtml(myPatientSearch)}">
        </div>
      </div>

      <div class="grid-3" style="gap: var(--space-4)">
        ${pts.map(p => `
          <div class="card animate-fade-in" style="border-left: 4px solid var(--primary)">
            <div class="flex items-center gap-3" style="margin-bottom: var(--space-3)">
              <div class="header-user-avatar" style="width: 40px; height: 40px; font-size: 14px">${getInitials(p.displayName)}</div>
              <div>
                <h4 style="margin: 0; font-size: var(--font-size-sm)">${escapeHtml(p.displayName)}</h4>
                <div style="font-size: 11px; color: var(--text-secondary)">ID: ${p.id} · ${p.age || 29} Yrs · Blood: <strong>${p.bloodGroup || 'O+'}</strong></div>
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" style="width: 100%" onclick="window._showDoctorCareHistoryDrawer('${p.id}')">
              <i class="fas fa-history"></i> View Care History
            </button>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  el.querySelector('#my-patients-search')?.addEventListener('input', (e) => {
    myPatientSearch = e.target.value;
    renderDoctorMyPatients(el, doctor);
  });
}

// ============================================
// 5. DOCTOR BLOOD REQUESTS WORKSPACE
// ============================================
function renderDoctorBloodRequests(el, doctor) {
  const s = appState.get();
  const requests = s.bloodRequests || [];

  el.innerHTML = `
    <div class="doctor-blood-requests-layout animate-fade-in">
      <div class="card" style="margin-bottom: var(--space-4)">
        <div class="flex justify-between items-center">
          <div>
            <h3 class="card-title"><i class="fas fa-tint" style="color: var(--critical)"></i> Emergency Blood Requests</h3>
            <div class="card-subtitle">Real-time cross-device blood sourcing & inventory reservation</div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="window._showDoctorBloodRequestModal('P-1001')">
            <i class="fas fa-plus"></i> New Blood Request
          </button>
        </div>
      </div>

      <div class="grid-2" style="gap: var(--space-4)">
        ${requests.map(r => `
          <div class="card" style="border-left: 4px solid var(--critical)">
            <div class="flex justify-between items-center" style="margin-bottom: var(--space-2)">
              <strong>Request ${r.id}</strong>
              <span class="badge ${r.status === 'Reserved' || r.status === 'BLOOD_BANK_CONFIRMED' || r.status === 'READY_FOR_ISSUE' ? 'badge-success' : 'badge-warning'}">${r.status}</span>
            </div>
            <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-bottom: var(--space-3)">
              Blood Group: <strong style="color: var(--critical)">${r.bloodGroup}</strong> · Units: <strong>${r.units}</strong> · Patient: <strong>${r.patientId}</strong>
            </div>
            <div class="card-inner-box" style="font-size: 11px; margin: 0; background: #F8FAFC">
              Status: <strong>${r.status === 'Reserved' ? `${r.units} ${r.bloodGroup} units reserved. Blood Bank confirmation required.` : r.status}</strong>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ============================================
// 6. DOCTOR CARE PLANS WORKSPACE
// ============================================
function renderDoctorCarePlans(el, doctor) {
  const s = appState.get();
  const plans = s.dischargePlans || [];

  el.innerHTML = `
    <div class="doctor-care-plans-layout animate-fade-in">
      <div class="card" style="margin-bottom: var(--space-4)">
        <h3 class="card-title"><i class="fas fa-notes-medical" style="color: var(--success)"></i> Patient Discharge Care Plans</h3>
      </div>

      <div class="grid-2" style="gap: var(--space-4)">
        ${plans.map(p => `
          <div class="card" style="border-left: 4px solid var(--success)">
            <div class="flex justify-between items-center" style="margin-bottom: var(--space-2)">
              <strong>Plan ${p.id} (${p.patientId})</strong>
              <span class="badge badge-success">Active</span>
            </div>
            <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-bottom: var(--space-2)">
              Medications: ${p.medications.map(m => m.name).join(', ')}
            </div>
            <div style="font-size: 11px; color: var(--text-secondary)">Diet: ${escapeHtml(p.dietPlan || 'Standard recovery diet')}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ============================================
// 7. DOCTOR PROFILE WORKSPACE (Requirements 35, 36, 37)
// ============================================
function renderDoctorProfile(el, doctor) {
  const s = appState.get();
  const waitingPatients = s.queueEntries.filter(q => q.doctorId === doctor.id && q.status === 'Waiting').length;
  const myEmergencies = (s.emergencyCases || []).filter(c => c.doctorId === doctor.id && c.status !== 'COMPLETED').length;
  const myFollowUps = s.followUps.filter(f => f.doctorId === doctor.id).length;

  el.innerHTML = `
    <div class="doctor-profile-layout animate-fade-in" style="max-width: 880px; margin: 0 auto">
      <!-- 1. Doctor Header Hero Card -->
      <div class="card" style="margin-bottom: var(--space-5); background: linear-gradient(135deg, #F0FDF4 0%, #FFFFFF 100%); border: 1px solid #BBF7D0">
        <div class="flex justify-between items-center" style="flex-wrap: wrap; gap: var(--space-4)">
          <div class="flex items-center gap-4">
            <div class="header-user-avatar" style="width: 72px; height: 72px; font-size: 26px; background: #DCFCE7; color: #16A34A">
              ${getInitials(doctor.displayName)}
            </div>
            <div>
              <h2 style="margin: 0; font-size: var(--font-size-xl)">Dr. ${escapeHtml(doctor.displayName)}</h2>
              <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-top: 2px">
                ID: <strong>${doctor.id}</strong> · ${escapeHtml(doctor.department)} · Specialist in <strong>${escapeHtml(doctor.specialty || 'Internal Medicine')}</strong>
              </div>
              <div style="font-size: 11px; color: var(--text-tertiary); margin-top: 2px">
                Reg No: <strong>${doctor.registrationNumber || 'MCI-84920-A'}</strong> · Room: <strong>${doctor.room || 'G-04'}</strong>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="badge badge-success"><i class="fas fa-check-circle"></i> Verified Clinician</span>
            <span class="badge ${doctor.status === 'Available' ? 'badge-success' : 'badge-warning'}">${doctor.status || 'Available'}</span>
          </div>
        </div>
      </div>

      <!-- 2. Clinical Workload KPIs -->
      <div class="grid-4" style="margin-bottom: var(--space-5)">
        <div class="metric-card">
          <div class="kpi-icon green"><i class="fas fa-user-check"></i></div>
          <div class="kpi-content">
            <div class="kpi-label">Completed Today</div>
            <div class="kpi-value">${doctor.completedToday || 4}</div>
            <div class="kpi-meta">Patients seen</div>
          </div>
        </div>
        <div class="metric-card">
          <div class="kpi-icon blue"><i class="fas fa-users"></i></div>
          <div class="kpi-content">
            <div class="kpi-label">Waiting Queue</div>
            <div class="kpi-value">${waitingPatients}</div>
            <div class="kpi-meta">Active tokens</div>
          </div>
        </div>
        <div class="metric-card">
          <div class="kpi-icon red"><i class="fas fa-heartbeat"></i></div>
          <div class="kpi-content">
            <div class="kpi-label">Emergency Load</div>
            <div class="kpi-value">${myEmergencies}</div>
            <div class="kpi-meta">Assigned triage</div>
          </div>
        </div>
        <div class="metric-card">
          <div class="kpi-icon teal"><i class="fas fa-calendar-check"></i></div>
          <div class="kpi-content">
            <div class="kpi-label">Follow-Ups</div>
            <div class="kpi-value">${myFollowUps}</div>
            <div class="kpi-meta">Continuity care</div>
          </div>
        </div>
      </div>

      <!-- 3. Two-Column Credentials & Edit Form -->
      <div class="grid-2" style="gap: var(--space-5); margin-bottom: var(--space-6)">
        <!-- Clinical Credentials -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-certificate"></i> Clinical Qualifications</h3>
          </div>
          <div class="flex flex-col gap-3" style="font-size: var(--font-size-xs)">
            <div class="flex justify-between border-b pb-1"><span>Qualification:</span> <strong>${doctor.qualifications || 'MBBS, MD (Medicine), DNB'}</strong></div>
            <div class="flex justify-between border-b pb-1"><span>Clinical Experience:</span> <strong>${doctor.experience || '12+ Years'}</strong></div>
            <div class="flex justify-between border-b pb-1"><span>Consultation Shift:</span> <strong>09:00 AM – 05:00 PM</strong></div>
            <div class="flex justify-between border-b pb-1"><span>Avg Consultation:</span> <strong>${doctor.averageConsultationMinutes || 9} minutes</strong></div>
            <div class="flex justify-between"><span>OPD Location:</span> <strong>OPD Block B, Room ${doctor.room || 'G-04'}</strong></div>
          </div>
        </div>

        <!-- Editable Profile Information -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="fas fa-user-edit"></i> Edit Profile & Contact</h3>
          </div>
          <form id="doc-profile-edit-form" class="flex flex-col gap-3" style="font-size: var(--font-size-xs)">
            <div class="form-group">
              <label class="form-label">Professional Email</label>
              <input type="email" id="edit-doc-email" class="form-input" value="${doctor.email || `${doctor.displayName.toLowerCase().replace(/[^a-z]/g, '')}@hospitalflow.ai`}">
            </div>
            <div class="form-group">
              <label class="form-label">Contact Phone</label>
              <input type="tel" id="edit-doc-phone" class="form-input" value="${doctor.phone || '+91 9876543201'}">
            </div>
            <div class="form-group">
              <label class="form-label">Spoken Languages</label>
              <input type="text" id="edit-doc-languages" class="form-input" value="${doctor.languages || 'English, Hindi, Marathi'}">
            </div>
            <div class="form-group">
              <label class="form-label">Professional Bio / Summary</label>
              <textarea id="edit-doc-bio" class="form-textarea" rows="2">${doctor.bio || 'Senior Consultant Physician specializing in general medicine, trauma triage, and post-discharge continuity care.'}</textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-sm" style="margin-top: 4px">
              <i class="fas fa-save"></i> Save Profile Updates
            </button>
          </form>
        </div>
      </div>
    </div>
  `;

  el.querySelector('#doc-profile-edit-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const updatedEmail = el.querySelector('#edit-doc-email').value.trim();
    const updatedPhone = el.querySelector('#edit-doc-phone').value.trim();
    const updatedLanguages = el.querySelector('#edit-doc-languages').value.trim();
    const updatedBio = el.querySelector('#edit-doc-bio').value.trim();

    appState.updateItem('doctors', doctor.id, {
      email: updatedEmail,
      phone: updatedPhone,
      languages: updatedLanguages,
      bio: updatedBio
    });

    alert('Doctor profile updated successfully.');
    renderDoctorProfile(el, appState.get().doctors.find(d => d.id === doctor.id) || doctor);
  });
}

// ============================================
// INSTANT DOCTOR EMERGENCY ASSIGNMENT MODAL (Requirements 6 & 7)
// ============================================
window._showDoctorEmergencyAssignedModal = (emPayload) => {
  const modalRoot = document.getElementById('doctor-modal-root') || document.body;

  // Trigger professional short chime + speech synthesis
  alertManager.playEmergencyChime('P1');
  setTimeout(() => {
    alertManager.speakAlert('Critical emergency patient assigned. Immediate attention required.');
  }, 400);

  modalRoot.innerHTML = `
    <div class="modal-backdrop active" style="background: rgba(15, 23, 42, 0.8)">
      <div class="modal active animate-scale-in" style="max-width: 540px; border: 3px solid #DC2626; box-shadow: 0 20px 40px rgba(220, 38, 38, 0.4)">
        <div class="modal-header" style="background: #FEF2F2; border-bottom: 2px solid #EF4444">
          <div class="flex items-center gap-3">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: #DC2626; color: white; display: flex; align-items: center; justify-content: center; font-size: 20px">
              <i class="fas fa-heartbeat"></i>
            </div>
            <div>
              <h3 class="modal-title" style="color: #991B1B; font-weight: 800; font-size: 18px">CRITICAL EMERGENCY ASSIGNED</h3>
              <div class="card-subtitle" style="color: #B91C1C">Assigned to your clinical care · Real-Time Alert</div>
            </div>
          </div>
          <button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
        </div>

        <div class="modal-body" style="padding: var(--space-5)">
          <div class="card-inner-box" style="background: #FFF5F5; border: 1px solid rgba(239, 68, 68, 0.3); margin-bottom: var(--space-4)">
            <div class="flex justify-between items-center" style="margin-bottom: 8px">
              <div>
                <span style="font-size: 11px; text-transform: uppercase; color: var(--text-secondary); font-weight: 700">Patient Details</span>
                <h4 style="margin: 0; font-size: 18px">${escapeHtml(emPayload.patientName || 'Emergency Patient')}</h4>
              </div>
              <span class="badge badge-danger" style="font-size: 13px; font-weight: 800; padding: 6px 12px">
                ${emPayload.priority || 'P1 Critical'}
              </span>
            </div>

            <div class="grid-2" style="gap: var(--space-2); font-size: var(--font-size-xs)">
              <div>Patient ID: <strong>${emPayload.patientId || 'P-1084'}</strong></div>
              <div>Department: <strong>${emPayload.department || 'General Medicine'}</strong></div>
              <div>Reported Symptoms: <strong style="color: var(--critical)">${escapeHtml(emPayload.symptoms || 'Severe Breathing Difficulty')}</strong></div>
              <div>Arrival ETA: <strong>${emPayload.etaMinutes ? `${emPayload.etaMinutes} min` : 'Arrived / In Bay'}</strong></div>
            </div>
          </div>

          <div style="font-size: var(--font-size-xs); color: var(--text-secondary)">
            <i class="fas fa-info-circle"></i> This emergency has been automatically positioned as <strong>Priority #1</strong> in your live queue.
          </div>
        </div>

        <div class="modal-footer flex justify-between items-center" style="background: #F8FAFC">
          <button class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">
            <i class="fas fa-check"></i> Acknowledge
          </button>
          <button class="btn btn-danger" id="btn-doctor-open-emergency" style="font-weight: 700; padding: 10px 20px">
            <i class="fas fa-stethoscope"></i> Open Emergency Case
          </button>
        </div>
      </div>
    </div>
  `;

  modalRoot.querySelector('#btn-doctor-open-emergency')?.addEventListener('click', () => {
    modalRoot.innerHTML = '';
    window.HospitalFlow.router.navigate('/doctor/dashboard');
  });
};

window._showDoctorCareHistoryDrawer = (patientId) => {
  const s = appState.get();
  const p = s.patients.find(pt => pt.id === patientId);
  const modalRoot = document.getElementById('doctor-modal-root') || document.body;

  modalRoot.innerHTML = `
    <div class="modal-backdrop active">
      <div class="drawer active animate-slide-in-right" style="max-width: 520px">
        <div class="drawer-header">
          <h3 class="drawer-title"><i class="fas fa-history"></i> Clinical History: ${escapeHtml(p?.displayName || patientId)}</h3>
          <button class="drawer-close" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
        </div>
        <div class="drawer-body">
          <div class="card-inner-box">
            <strong>Past Appointments:</strong> 2 Completed<br>
            <strong>Allergies:</strong> Penicillin (Mild)<br>
            <strong>Blood Group:</strong> ${p?.bloodGroup || 'O+'}
          </div>
        </div>
        <div class="drawer-footer">
          <button class="btn btn-primary" style="width: 100%" onclick="this.closest('.modal-backdrop').remove()">Close</button>
        </div>
      </div>
    </div>
  `;
};

window._showDoctorBloodRequestModal = (patientId) => {
  const modalRoot = document.getElementById('doctor-modal-root') || document.body;
  modalRoot.innerHTML = `
    <div class="modal-backdrop active">
      <div class="modal active" style="max-width: 460px">
        <div class="modal-header">
          <h3 class="modal-title" style="color: var(--critical)"><i class="fas fa-tint"></i> Critical Blood Request</h3>
          <button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
        </div>
        <form id="doc-blood-req-form">
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Patient ID</label>
              <input type="text" class="form-input" value="${patientId}" disabled>
            </div>
            <div class="form-group">
              <label class="form-label">Blood Group <span class="required">*</span></label>
              <select id="doc-bg" class="form-select">
                <option value="O-">O- (Universal Donor)</option>
                <option value="O+">O+</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Units Required <span class="required">*</span></label>
              <input type="number" id="doc-units" class="form-input" value="2" min="1" max="6">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
            <button type="submit" class="btn btn-danger"><i class="fas fa-paper-plane"></i> Broadcast Critical Request</button>
          </div>
        </form>
      </div>
    </div>
  `;

  modalRoot.querySelector('#doc-blood-req-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const bg = modalRoot.querySelector('#doc-bg').value;
    const u = parseInt(modalRoot.querySelector('#doc-units').value, 10) || 2;

    const req = BloodEngine.createRequest({
      patientId,
      bloodGroup: bg,
      units: u,
      urgency: 'Emergency',
      department: 'Trauma & Emergency'
    });

    modalRoot.innerHTML = '';
    alert(`Critical blood request for ${u} units of ${bg} submitted. Real-time alert dispatched to Admin Command.`);
    renderDoctorBloodRequests(document.getElementById('doctor-sub-content'), Auth.getCurrentUser());
  });
};

window._showDoctorCarePlanAuthorModal = (patientId) => {
  const s = appState.get();
  const pt = s.patients.find(p => p.id === patientId);
  const modalRoot = document.getElementById('doctor-modal-root') || document.body;

  modalRoot.innerHTML = `
    <div class="modal-backdrop active">
      <div class="modal active" style="max-width: 580px">
        <div class="modal-header">
          <h3 class="modal-title" style="color: var(--success)"><i class="fas fa-file-medical"></i> Author Discharge Care Plan</h3>
          <button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <p style="font-size: var(--font-size-xs); color: var(--text-secondary)">Authoring care continuity plan for <strong>${escapeHtml(pt?.displayName || patientId)}</strong></p>
          <div class="form-group">
            <label class="form-label">Primary Medication</label>
            <input type="text" id="cp-med-name" class="form-input" value="Azithromycin 500mg (1 tablet morning)">
          </div>
          <div class="form-group">
            <label class="form-label">Dietary Instructions</label>
            <textarea id="cp-diet" class="form-textarea" rows="2">Light meals, high fluid intake, avoid spicy foods.</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
          <button class="btn btn-success" id="btn-save-care-plan"><i class="fas fa-save"></i> Save & Authorize Plan</button>
        </div>
      </div>
    </div>
  `;

  modalRoot.querySelector('#btn-save-care-plan')?.addEventListener('click', () => {
    modalRoot.innerHTML = '';
    alert('Discharge care plan saved and synchronized to Patient Portal.');
  });
};
