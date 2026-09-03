// ============================================
// HospitalFlow AI — Doctor Clinical Portal
// Appointments vs Follow-Ups · Dashboard vs My Patients · Blood Requests · Care Plans
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
let myPatientFilter = 'All';

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
    specialty: 'Internal Medicine',
    room: 'G-04',
    status: 'Available',
    completedToday: 4,
    averageConsultationMinutes: 12
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

  // Render Alert Banner if any
  alertManager.renderActiveAlertBanner(container.querySelector('#doctor-emergency-alert-banner'), 'doctor', doctor.id);

  // Sidebar Collapse Listener
  const sidebar = container.querySelector('#doctor-sidebar');
  const mainShell = container.querySelector('.app-main');
  container.querySelector('#btn-toggle-doctor-sidebar')?.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    mainShell.classList.toggle('sidebar-collapsed');
  });

  // Render Sub Route
  const subContentEl = container.querySelector('#doctor-sub-content');
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
}

// ============================================
// 1. DOCTOR DASHBOARD WORKSPACE
// ============================================
function renderDoctorDashboard(el, doctor) {
  const s = appState.get();
  const myQueue = s.queueEntries.filter(q => q.doctorId === doctor.id && ['Waiting', 'Called', 'Consulting'].includes(q.status));
  const consultingEntry = myQueue.find(q => q.status === 'Consulting');
  const currentPatient = consultingEntry ? s.patients.find(p => p.id === consultingEntry.patientId) : null;
  const waitingQueue = myQueue.filter(q => q.status === 'Waiting');
  const nextPatient = waitingQueue[0] ? s.patients.find(p => p.id === waitingQueue[0].patientId) : null;

  const assignedEmergency = (s.emergencyCases || []).find(c => c.doctorId === doctor.id && c.status !== 'COMPLETED');

  el.innerHTML = `
    <div class="doctor-dashboard-layout animate-fade-in">
      <!-- 4 Top KPIs -->
      <div class="grid-4" style="margin-bottom: var(--space-6)">
        <div class="metric-card">
          <div class="kpi-icon blue"><i class="fas fa-user-clock"></i></div>
          <div class="kpi-content">
            <div class="kpi-label">Patients Waiting</div>
            <div class="kpi-value">${waitingQueue.length}</div>
            <div class="kpi-meta">In your routine queue</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="kpi-icon green"><i class="fas fa-check-circle"></i></div>
          <div class="kpi-content">
            <div class="kpi-label">Completed Today</div>
            <div class="kpi-value">${doctor.completedToday || 4}</div>
            <div class="kpi-meta">Consultations completed</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="kpi-icon orange"><i class="fas fa-stopwatch"></i></div>
          <div class="kpi-content">
            <div class="kpi-label">Avg Consult Time</div>
            <div class="kpi-value">${doctor.averageConsultationMinutes || 12} <span style="font-size: 14px; font-weight: normal; color: var(--text-secondary)">min</span></div>
            <div class="kpi-meta">Clinical velocity</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="kpi-icon ${assignedEmergency ? 'red' : 'teal'}">
            <i class="fas ${assignedEmergency ? 'fa-ambulance' : 'fa-user-md'}"></i>
          </div>
          <div class="kpi-content">
            <div class="kpi-label">Doctor Status</div>
            <div class="kpi-value" style="font-size: 18px">${assignedEmergency ? 'Emergency' : doctor.status || 'Available'}</div>
            <div class="kpi-meta">${assignedEmergency ? 'Trauma bay duty' : 'OPD active'}</div>
          </div>
        </div>
      </div>

      <!-- Current In-Room Patient Hero Card -->
      <div class="card" style="border: 2px solid ${currentPatient ? 'var(--primary-border)' : 'var(--border)'}; margin-bottom: var(--space-6); background: ${currentPatient ? '#F8FAFC' : 'white'}">
        <div class="card-header flex justify-between items-center">
          <div>
            <h3 class="card-title"><i class="fas fa-stethoscope" style="color: var(--primary)"></i> Current In-Room Patient</h3>
            <div class="card-subtitle">Active consultation in progress</div>
          </div>
          <span class="badge ${currentPatient ? 'badge-success' : 'badge-neutral'}">${currentPatient ? 'Consulting Now' : 'Room Empty'}</span>
        </div>

        ${currentPatient ? `
          <div class="flex justify-between items-center" style="margin: var(--space-4) 0; flex-wrap: wrap; gap: var(--space-4)">
            <div class="flex items-center gap-4">
              <div class="header-user-avatar" style="width: 56px; height: 56px; font-size: 20px">${getInitials(currentPatient.displayName)}</div>
              <div>
                <h3 style="margin: 0">${escapeHtml(currentPatient.displayName)}</h3>
                <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-top: 2px">
                  ID: <strong>${currentPatient.id}</strong> · Token: <strong style="color: var(--primary)">${consultingEntry.id}</strong> · ${currentPatient.age || 29} Yrs / ${currentPatient.gender || 'Male'}
                </div>
              </div>
            </div>

            <div class="flex gap-2">
              <button class="btn btn-secondary btn-sm" onclick="window._showDoctorCarePlanAuthorModal('${currentPatient.id}')">
                <i class="fas fa-file-medical"></i> Author Care Plan
              </button>
              <button class="btn btn-warning btn-sm" onclick="window._showDoctorBloodRequestModal('${currentPatient.id}')">
                <i class="fas fa-tint"></i> Request Blood
              </button>
              <button class="btn btn-success btn-sm" onclick="window.HospitalFlow.completeConsultation('${consultingEntry.id}')">
                <i class="fas fa-check-circle"></i> Complete Consultation
              </button>
            </div>
          </div>
        ` : `
          <div class="empty-state" style="padding: var(--space-6)">
            <i class="fas fa-user-md" style="font-size: 36px; color: var(--text-tertiary)"></i>
            <h4>No patient currently in consultation room</h4>
            <p>Next patient in line: <strong>${nextPatient ? nextPatient.displayName : 'No waiting patients'}</strong></p>
            ${waitingQueue.length > 0 ? `
              <button class="btn btn-primary" onclick="window.HospitalFlow.callPatient('${waitingQueue[0].id}')">
                <i class="fas fa-bullhorn"></i> Call Next Patient (${waitingQueue[0].id})
              </button>
            ` : ''}
          </div>
        `}
      </div>

      <!-- Live Waiting Queue Table -->
      <div class="card">
        <div class="card-header flex justify-between items-center">
          <h3 class="card-title"><i class="fas fa-list-ol"></i> Live Department Queue (${waitingQueue.length} waiting)</h3>
        </div>

        <div class="table-container" style="border: none; margin-top: var(--space-3)">
          <table class="data-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Token</th>
                <th>Patient</th>
                <th>Status</th>
                <th>Estimated Wait</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${waitingQueue.length > 0 ? waitingQueue.map(q => {
                const pt = s.patients.find(p => p.id === q.patientId);
                return `
                  <tr>
                    <td><strong>#${q.position}</strong></td>
                    <td><strong>${q.id}</strong></td>
                    <td style="font-weight: 600">${escapeHtml(pt?.displayName || q.patientId)}</td>
                    <td><span class="badge badge-warning">${q.status}</span></td>
                    <td>${formatMinutes(q.estimatedWait || 0)}</td>
                    <td>
                      <button class="btn btn-primary btn-sm" onclick="window.HospitalFlow.callPatient('${q.id}')">
                        <i class="fas fa-bullhorn"></i> Call
                      </button>
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr><td colspan="6" style="text-align: center; padding: var(--space-4); color: var(--text-secondary)">No waiting patients in queue.</td></tr>
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
                <button class="btn btn-primary btn-sm" onclick="alert('Calling patient to room...')"><i class="fas fa-bullhorn"></i> Call Patient</button>
                <button class="btn btn-secondary btn-sm" onclick="window._showDoctorCareHistoryDrawer('${apt.patientId}')"><i class="fas fa-history"></i> Care History</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// ============================================
// 3. DOCTOR FOLLOW-UPS & POST-DISCHARGE REVIEW
// ============================================
function renderDoctorFollowUps(el, doctor) {
  const s = appState.get();
  const reports = (s.postDischargeReports || []).filter(r => r.doctorId === doctor.id || !r.doctorId);
  const myFollowUps = s.followUps.filter(fu => fu.department === doctor.department);

  el.innerHTML = `
    <div class="doctor-followups-layout animate-fade-in">
      <!-- Problem Reports from Home (Requirement 15) -->
      <div class="card" style="margin-bottom: var(--space-6); border: 2px solid var(--warning-border)">
        <div class="card-header flex justify-between items-center">
          <div>
            <h3 class="card-title" style="color: #92400E"><i class="fas fa-flag"></i> Post-Discharge Patient Problem Reports</h3>
            <div class="card-subtitle">Reports submitted by patients recovering at home</div>
          </div>
          <span class="badge badge-warning">${reports.length} Needs Review</span>
        </div>

        <div class="flex flex-col gap-3" style="margin-top: var(--space-3)">
          ${reports.length > 0 ? reports.map(r => `
            <div class="card-inner-box" style="background: #FFFBEB; border: 1px solid #FDE68A; display: flex; justify-content: space-between; align-items: center">
              <div>
                <strong style="font-size: var(--font-size-sm)">${escapeHtml(r.patientName || r.patientId)}</strong> · <span class="badge badge-danger">${r.severity}</span>
                <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-top: 2px">
                  Condition: <strong>${escapeHtml(r.condition)}</strong> — "${escapeHtml(r.description)}"
                </div>
              </div>
              <div class="flex gap-2">
                <a href="tel:+919876543210" class="btn btn-secondary btn-sm"><i class="fas fa-phone-alt"></i> Call</a>
                <button class="btn btn-primary btn-sm" onclick="alert('Care plan updated with revised medication.')"><i class="fas fa-check"></i> Review & Update</button>
              </div>
            </div>
          `).join('') : `
            <p style="font-size: var(--font-size-xs); color: var(--text-secondary)">No urgent problem reports submitted from home.</p>
          `}
        </div>
      </div>

      <!-- Scheduled Follow-Ups -->
      <div class="card">
        <div class="card-header"><h3 class="card-title"><i class="fas fa-calendar-check"></i> Scheduled Clinical Follow-Ups</h3></div>
        <div class="grid-2" style="gap: var(--space-3); margin-top: var(--space-3)">
          ${myFollowUps.map(fu => `
            <div class="card-inner-box">
              <div class="flex justify-between"><strong>${escapeHtml(fu.patientName || fu.patientId)}</strong> <span class="badge badge-info">${fu.status}</span></div>
              <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-top: 2px">Date: ${formatDate(fu.date)} at ${fu.time}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// ============================================
// 4. DOCTOR MY PATIENTS DIRECTORY (Requirement 29)
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
        ${pts.map(p => {
          const journey = appState.getPatientJourneyState(p.id);
          return `
            <div class="card animate-fade-in" style="border-left: 4px solid var(--primary)">
              <div class="flex items-center gap-3" style="margin-bottom: var(--space-3)">
                <div class="header-user-avatar" style="width: 40px; height: 40px; font-size: 14px">${getInitials(p.displayName)}</div>
                <div>
                  <h4 style="margin: 0; font-size: var(--font-size-sm)">${escapeHtml(p.displayName)}</h4>
                  <div style="font-size: 11px; color: var(--text-secondary)">ID: ${p.id} · ${p.age || 29} Yrs · Blood: <strong>${p.bloodGroup || 'O+'}</strong></div>
                </div>
              </div>
              <div style="margin-bottom: var(--space-3)">
                <span class="badge badge-${journey.variant}">${journey.status}</span>
              </div>
              <button class="btn btn-secondary btn-sm" style="width: 100%" onclick="window._showDoctorCareHistoryDrawer('${p.id}')">
                <i class="fas fa-history"></i> View Care History
              </button>
            </div>
          `;
        }).join('')}
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
            <div class="card-subtitle">Real-time blood sourcing lifecycle & inventory readiness</div>
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
              <strong>Request ${r.requestId || r.id}</strong>
              <span class="badge ${r.status === 'Completed' || r.status === 'Ready for Issue' ? 'badge-success' : 'badge-warning'}">${r.status || 'Operational Match Found'}</span>
            </div>
            <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-bottom: var(--space-3)">
              Blood Group: <strong style="color: var(--critical)">${r.bloodGroup}</strong> · Units: <strong>${r.units}</strong> · Patient: <strong>${r.patientId}</strong>
            </div>
            <div class="card-inner-box" style="font-size: 11px; margin: 0">
              Sourcing Status: <strong>Operational Match Found (Internal FEFO Bank)</strong><br>
              Ready for collection at Trauma Bay.
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
// 7. DOCTOR PROFILE REDESIGN (Phase 6)
// ============================================
function renderDoctorProfile(el, doctor) {
  el.innerHTML = `
    <div class="doctor-profile-layout animate-fade-in" style="max-width: 840px; margin: 0 auto">
      <div class="card" style="margin-bottom: var(--space-6); background: linear-gradient(135deg, #F0FDF4 0%, #FFFFFF 100%); border: 1px solid #BBF7D0">
        <div class="flex items-center gap-4">
          <div class="header-user-avatar" style="width: 64px; height: 64px; font-size: 24px; background: #DCFCE7; color: #16A34A">
            ${getInitials(doctor.displayName)}
          </div>
          <div>
            <h2 style="margin: 0">Dr. ${escapeHtml(doctor.displayName)}</h2>
            <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-top: 2px">
              ${escapeHtml(doctor.department)} · Specialist in ${escapeHtml(doctor.specialty || 'Internal Medicine')} · Room <strong>${doctor.room || 'G-04'}</strong>
            </div>
          </div>
        </div>
      </div>

      <div class="grid-2" style="gap: var(--space-6)">
        <div class="card">
          <div class="card-header"><h3 class="card-title"><i class="fas fa-award"></i> Professional Details</h3></div>
          <div class="flex flex-col gap-3" style="font-size: var(--font-size-xs)">
            <div class="flex justify-between border-b pb-1"><span>Qualification:</span> <strong>MBBS, MD (General Medicine)</strong></div>
            <div class="flex justify-between border-b pb-1"><span>Experience:</span> <strong>11 Years Clinical Practice</strong></div>
            <div class="flex justify-between border-b pb-1"><span>Medical License:</span> <strong>MCI-849204</strong></div>
            <div class="flex justify-between"><span>Shift Hours:</span> <strong>09:00 AM – 05:00 PM (OPD & Trauma)</strong></div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3 class="card-title"><i class="fas fa-chart-line"></i> Today's Performance</h3></div>
          <div class="flex flex-col gap-3" style="font-size: var(--font-size-xs)">
            <div class="flex justify-between border-b pb-1"><span>Completed Consultations:</span> <strong>${doctor.completedToday || 4}</strong></div>
            <div class="flex justify-between border-b pb-1"><span>Average Consult Time:</span> <strong>${doctor.averageConsultationMinutes || 12} min</strong></div>
            <div class="flex justify-between"><span>Clinical Adherence Rating:</span> <strong style="color: var(--success)">98% Optimal</strong></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Modals
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
            <strong>Current Care Plan:</strong> DP-2048 (Azithromycin 250mg)
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
      <div class="modal active" style="max-width: 440px">
        <div class="modal-header">
          <h3 class="modal-title" style="color: var(--critical)"><i class="fas fa-tint"></i> Request Emergency Blood</h3>
          <button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
        </div>
        <form id="doc-blood-req-form">
          <div class="modal-body">
            <div class="form-group"><label class="form-label">Blood Group</label><select id="doc-bg" class="form-select">${Config.BLOOD_GROUPS.map(g => `<option value="${g}">${g}</option>`).join('')}</select></div>
            <div class="form-group"><label class="form-label">Units Required</label><input type="number" id="doc-units" class="form-input" value="2" min="1" max="6"></div>
          </div>
          <div class="modal-footer">
            <button type="submit" class="btn btn-danger"><i class="fas fa-paper-plane"></i> Submit Request</button>
          </div>
        </form>
      </div>
    </div>
  `;

  modalRoot.querySelector('#doc-blood-req-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const bg = modalRoot.querySelector('#doc-bg').value;
    const u = parseInt(modalRoot.querySelector('#doc-units').value, 10);

    const req = BloodEngine.createRequest({ patientId, bloodGroup: bg, units: u, urgency: 'Critical' });
    modalRoot.innerHTML = '';
    alert(`Blood request ${req.requestId} submitted for ${u} units of ${bg}. Operational match initiated.`);
  });
};

window._showDoctorCarePlanAuthorModal = (patientId) => {
  const modalRoot = document.getElementById('doctor-modal-root') || document.body;
  modalRoot.innerHTML = `
    <div class="modal-backdrop active">
      <div class="modal active" style="max-width: 480px">
        <div class="modal-header">
          <h3 class="modal-title"><i class="fas fa-file-medical"></i> Author Discharge Care Plan</h3>
          <button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
        </div>
        <form id="doc-author-plan-form">
          <div class="modal-body">
            <div class="form-group"><label class="form-label">Medications (comma separated)</label><input type="text" id="doc-meds" class="form-input" value="Azithromycin 250mg, Paracetamol 500mg"></div>
            <div class="form-group"><label class="form-label">Diet & Nutrition Instructions</label><input type="text" id="doc-diet" class="form-input" value="Light fluids, warm water, low sodium"></div>
          </div>
          <div class="modal-footer">
            <button type="submit" class="btn btn-success"><i class="fas fa-save"></i> Save & Issue Plan</button>
          </div>
        </form>
      </div>
    </div>
  `;

  modalRoot.querySelector('#doc-author-plan-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const meds = modalRoot.querySelector('#doc-meds').value.split(',').map((name, i) => ({
      name: name.trim(),
      dosage: '1 Tab',
      timeSlot: i === 0 ? 'Morning' : 'Night',
      instructions: 'After Food'
    }));
    const diet = modalRoot.querySelector('#doc-diet').value;

    CareEngine.createDischargePlan({
      patientId,
      doctorId: 'D-0001',
      medications: meds,
      dietPlan: diet,
      warningSigns: ['Fever above 101F', 'Persistent breathlessness']
    });

    modalRoot.innerHTML = '';
    alert('Discharge plan authored and synchronized to patient portal.');
  });
};
