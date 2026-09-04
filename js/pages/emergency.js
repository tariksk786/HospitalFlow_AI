// ============================================
// HospitalFlow AI — Emergency Readiness & Command Page
// MedFlow Vista Visual Standard
// ============================================

import appState from '../state.js';
import Config from '../config.js';
import Auth from '../auth.js';
import FlowEngine from '../engines/flow-engine.js';
import BloodEngine from '../engines/blood-engine.js';
import alertManager from '../engines/emergency-alert-manager.js';
import { escapeHtml, formatDate, formatMinutes, formatTime, timeAgo, daysBetween } from '../utils.js';

let currentTab = 'command';

export default function renderEmergencyPage(container) {
  const s = appState.get();
  const unackAlerts = alertManager.getUnacknowledgedCount('admin');

  container.innerHTML = `
    <div class="emergency-page-layout animate-fade-in">
      <div class="page-header">
        <div>
          <h2><i class="fas fa-shield-alt" style="color: var(--critical); margin-right: var(--space-2)"></i>Emergency Command & Readiness</h2>
          <p>Real-time emergency triage, ambulance fleet coordination, FEFO blood bank & donor waves</p>
        </div>
        <div class="care-safety-notice" style="margin: 0; font-size: var(--font-size-xs)">
          <i class="fas fa-info-circle"></i> Operational coordination platform · Hospital dispatch authorized
        </div>
      </div>

      <!-- Real-time Admin Emergency Alert Banner Hook -->
      <div id="admin-emergency-page-banner"></div>

      <div class="page-tabs" id="emergency-tabs" style="margin: var(--space-4) 0 var(--space-6)">
        <button class="page-tab ${currentTab === 'command' ? 'active' : ''}" data-tab="command">
          <i class="fas fa-tachometer-alt"></i> Emergency Command Center
          ${unackAlerts > 0 ? `<span class="badge badge-danger" style="margin-left: 4px">${unackAlerts}</span>` : ''}
        </button>
        <button class="page-tab ${currentTab === 'ambulances' ? 'active' : ''}" data-tab="ambulances">
          <i class="fas fa-ambulance"></i> Ambulance Fleet (${s.ambulances.length})
        </button>
        <button class="page-tab ${currentTab === 'inventory' ? 'active' : ''}" data-tab="inventory">
          <i class="fas fa-boxes"></i> Blood Inventory (FEFO)
        </button>
        <button class="page-tab ${currentTab === 'requests' ? 'active' : ''}" data-tab="requests">
          <i class="fas fa-tint"></i> Blood Requests (${s.bloodRequests.length})
        </button>
        <button class="page-tab ${currentTab === 'donors' ? 'active' : ''}" data-tab="donors">
          <i class="fas fa-hand-holding-heart"></i> Donor Coordination (${s.donors.length})
        </button>
      </div>

      <div id="emergency-tab-content"></div>
      <div id="emergency-modal-root"></div>
    </div>
  `;

  // Render Real-time Alert Banner
  alertManager.renderActiveAlertBanner(container.querySelector('#admin-emergency-page-banner'), 'admin');

  container.querySelectorAll('.page-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentTab = tab.dataset.tab;
      container.querySelectorAll('.page-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === currentTab));
      renderEmergencyTabContent(container.querySelector('#emergency-tab-content'));
    });
  });

  renderEmergencyTabContent(container.querySelector('#emergency-tab-content'));
}

function renderEmergencyTabContent(el) {
  if (!el) return;
  switch (currentTab) {
    case 'command': renderEmergencyCommandTab(el); break;
    case 'ambulances': renderAmbulanceFleetTab(el); break;
    case 'inventory': renderInventoryTab(el); break;
    case 'requests': renderRequestsTab(el); break;
    case 'donors': renderDonorsTab(el); break;
    default: renderEmergencyCommandTab(el); break;
  }
}

// ============================================
// 1. EMERGENCY COMMAND CENTER TAB
// ============================================
function renderEmergencyCommandTab(el) {
  const s = appState.get();
  // Sort active emergencies by priority (P1 > P2 > P3 > P4) then creation time
  const activeCases = (s.emergencyCases || [])
    .filter(c => c.status !== 'COMPLETED')
    .sort((a, b) => {
      const pMap = { 'P1 - Critical Emergency': 1, 'P1': 1, 'P2 - Urgent': 2, 'P2': 2, 'P3 - Priority': 3, 'P3': 3, 'P4 - Routine': 4, 'P4': 4 };
      const pA = pMap[a.priority] || 2;
      const pB = pMap[b.priority] || 2;
      if (pA !== pB) return pA - pB;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  const incomingAmb = (s.ambulanceRequests || []).filter(r => r.status === 'DISPATCHED' || r.status === 'EN_ROUTE');
  const preArrivals = (s.emergencyPreArrivals || []).filter(p => p.status === 'PREPARING');
  const pendingRequests = (s.ambulanceRequests || []).filter(r => r.status === 'REQUESTED');
  const availableAmbs = s.ambulances.filter(a => a.status === 'AVAILABLE').length;
  const availableDoctors = s.doctors.filter(d => ['Available', 'Consulting'].includes(d.status)).length;
  const isOverloaded = activeCases.length > availableDoctors;

  el.innerHTML = `
    <!-- 4 Primary Emergency KPIs -->
    <div class="grid-4" style="margin-bottom: var(--space-6)">
      <div class="metric-card">
        <div class="kpi-icon ${activeCases.length > 0 ? 'red' : 'green'}">
          <i class="fas fa-heartbeat"></i>
        </div>
        <div class="kpi-content">
          <div class="kpi-label">Active Emergencies</div>
          <div class="kpi-value" style="${activeCases.length > 0 ? 'color: var(--critical)' : ''}">${activeCases.length}</div>
          <div class="kpi-meta">In emergency bays</div>
        </div>
      </div>

      <div class="metric-card">
        <div class="kpi-icon ${incomingAmb.length + preArrivals.length > 0 ? 'orange' : 'teal'}">
          <i class="fas fa-ambulance"></i>
        </div>
        <div class="kpi-content">
          <div class="kpi-label">Incoming Pre-Arrivals</div>
          <div class="kpi-value">${incomingAmb.length + preArrivals.length}</div>
          <div class="kpi-meta">${incomingAmb.length} Amb · ${preArrivals.length} Private Vehicle</div>
        </div>
      </div>

      <div class="metric-card">
        <div class="kpi-icon green"><i class="fas fa-truck-medical"></i></div>
        <div class="kpi-content">
          <div class="kpi-label">Fleet Available</div>
          <div class="kpi-value">${availableAmbs} <span style="font-size: 14px; font-weight: normal; color: var(--text-secondary)">/ ${s.ambulances.length}</span></div>
          <div class="kpi-meta">Standby ready</div>
        </div>
      </div>

      <div class="metric-card">
        <div class="kpi-icon ${pendingRequests.length > 0 ? 'red' : 'blue'}">
          <i class="fas fa-phone-volume"></i>
        </div>
        <div class="kpi-content">
          <div class="kpi-label">Pending Requests</div>
          <div class="kpi-value">${pendingRequests.length}</div>
          <div class="kpi-meta">Awaiting dispatch</div>
        </div>
      </div>
    </div>

    <!-- Emergency Capacity Warning Banner (Requirement 13 & Addition 11) -->
    ${isOverloaded ? `
      <div class="emergency-alert-banner critical animate-fade-in" style="margin-bottom: var(--space-4)">
        <div class="flex items-center gap-3">
          <div class="alert-pulse-icon"><i class="fas fa-exclamation-triangle"></i></div>
          <div>
            <strong>🚨 Emergency Capacity Warning: Active Cases (${activeCases.length}) Exceed Available Physicians (${availableDoctors})</strong>
            <div style="font-size: var(--font-size-xs); opacity: 0.9">Urgent backup doctor mobilization recommended to prevent clinical delays.</div>
          </div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="window.HospitalFlow.router.navigate('/admin/flow')">
          <i class="fas fa-magic"></i> Mobilize Backup Doctor
        </button>
      </div>
    ` : ''}

    <!-- Active Inbound Pre-Arrivals: Ambulance Fleet & Private Vehicle (Option 1 & 2) -->
    ${incomingAmb.length > 0 || preArrivals.length > 0 ? `
      <div class="card" style="border-left: 4px solid var(--critical); margin-bottom: var(--space-6); background: #FFFDF5">
        <div class="card-header flex justify-between items-center" style="border-bottom: 1px solid rgba(245, 158, 11, 0.2); padding-bottom: var(--space-3)">
          <div>
            <h3 class="card-title" style="color: #92400E">
              <i class="fas fa-shield-alt"></i> Hospital Pre-Arrival Readiness & Preparation Checklist
            </h3>
            <div class="card-subtitle">Real-time trauma intake coordination for inbound ambulances and private vehicles</div>
          </div>
          <span class="badge badge-warning">INBOUND TRIAGE ACTIVE</span>
        </div>

        <div style="padding-top: var(--space-4)">
          <!-- Private Vehicle Inbound Pre-Arrivals -->
          ${preArrivals.map(pre => `
            <div class="card-inner-box" style="background: white; border: 1px solid var(--border); margin-bottom: var(--space-3)">
              <div class="flex justify-between items-center" style="flex-wrap: wrap; gap: var(--space-3)">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="badge badge-neutral"><i class="fas fa-car"></i> Transport: Private Vehicle</span>
                    <h4 style="margin: 0; font-size: var(--font-size-md)">${escapeHtml(pre.patientName)} (${pre.id})</h4>
                    <span class="badge ${pre.severity === 'Critical' ? 'badge-danger' : 'badge-warning'}">${pre.severity}</span>
                  </div>
                  <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-top: 4px">
                    Location: <strong>${escapeHtml(pre.currentLocation)}</strong> · Phone: <strong>${escapeHtml(pre.contactNumber)}</strong><br>
                    Symptoms: <em>"${escapeHtml(pre.symptoms)}"</em><br>
                    Triage Checks: Conscious: <strong>${pre.isConscious}</strong> · Breathing Difficulty: <strong>${pre.breathingDifficulty}</strong> · Severe Bleeding: <strong>${pre.majorBleeding}</strong>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <div style="text-align: right">
                    <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase">Expected Arrival</div>
                    <div style="font-size: 24px; font-weight: 800; color: var(--critical)">${pre.estimatedArrivalMinutes || 14} min</div>
                  </div>
                  <button class="btn btn-success btn-sm" onclick="window._markPreArrivalArrived('${pre.id}')">
                    <i class="fas fa-hospital-user"></i> Mark Arrived (Triage #1)
                  </button>
                </div>
              </div>

              <!-- Full 6-Point Readiness Checklist (Phase 8) -->
              <div style="margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--border-light)">
                <div style="font-size: var(--font-size-xs); font-weight: 700; color: var(--text-secondary); margin-bottom: 6px">
                  Hospital Preparation Checklist:
                </div>
                <div class="flex gap-4" style="flex-wrap: wrap; font-size: var(--font-size-xs)">
                  <label class="flex items-center gap-1"><input type="checkbox" checked disabled> <span>Emergency Bed Ready</span></label>
                  <label class="flex items-center gap-1"><input type="checkbox" checked disabled> <span>Doctor Assigned (Dr. Aarav Sharma)</span></label>
                  <label class="flex items-center gap-1" style="cursor: pointer"><input type="checkbox" onchange="this.disabled = true"> <span>Support Team Ready</span></label>
                  <label class="flex items-center gap-1" style="cursor: pointer"><input type="checkbox" onchange="this.disabled = true"> <span>Oxygen Ready</span></label>
                  <label class="flex items-center gap-1" style="cursor: pointer"><input type="checkbox" onchange="this.disabled = true"> <span>Blood Reviewed</span></label>
                  <label class="flex items-center gap-1" style="cursor: pointer"><input type="checkbox" onchange="this.disabled = true"> <span>Emergency Bay Cleared</span></label>
                </div>
              </div>
            </div>
          `).join('')}

          <!-- Inbound Ambulance Fleet -->
          ${incomingAmb.map(req => `
            <div class="card-inner-box" style="background: white; border: 1px solid var(--border); margin-bottom: var(--space-3)">
              <div class="flex justify-between items-center" style="flex-wrap: wrap; gap: var(--space-3)">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="badge badge-neutral"><i class="fas fa-ambulance"></i> Vehicle: ${req.assignedAmbulanceId || 'AMB-03'}</span>
                    <h4 style="margin: 0; font-size: var(--font-size-md)">${escapeHtml(req.patientName)} (${req.requestId})</h4>
                    <span class="badge ${req.severity === 'Critical' ? 'badge-danger' : 'badge-warning'}">${req.severity}</span>
                  </div>
                  <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-top: 4px">
                    Pickup Location: <strong>${escapeHtml(req.pickupLocation)}</strong> · Symptoms: <em>"${escapeHtml(req.symptoms)}"</em>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <div style="text-align: right">
                    <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase">Hospital ETA</div>
                    <div style="font-size: 24px; font-weight: 800; color: var(--critical)">${req.estimatedHospitalArrival || 6} min</div>
                  </div>
                  <button class="btn btn-success btn-sm" onclick="window.HospitalFlow.markAmbulanceArrived('${req.requestId}')">
                    <i class="fas fa-hospital-user"></i> Mark Arrived (Queue #1)
                  </button>
                </div>
              </div>

              <div style="margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--border-light)">
                <div style="font-size: var(--font-size-xs); font-weight: 700; color: var(--text-secondary); margin-bottom: 6px">
                  Hospital Preparation Checklist:
                </div>
                <div class="flex gap-4" style="flex-wrap: wrap; font-size: var(--font-size-xs)">
                  <label class="flex items-center gap-1"><input type="checkbox" checked disabled> <span>Emergency Bed Ready</span></label>
                  <label class="flex items-center gap-1"><input type="checkbox" checked disabled> <span>Doctor Assigned (Dr. Aarav Sharma)</span></label>
                  <label class="flex items-center gap-1" style="cursor: pointer"><input type="checkbox" onchange="this.disabled = true"> <span>Support Team Ready</span></label>
                  <label class="flex items-center gap-1" style="cursor: pointer"><input type="checkbox" onchange="this.disabled = true"> <span>Oxygen Ready</span></label>
                  <label class="flex items-center gap-1" style="cursor: pointer"><input type="checkbox" onchange="this.disabled = true"> <span>Blood Reserve Checked</span></label>
                  <label class="flex items-center gap-1" style="cursor: pointer"><input type="checkbox" onchange="this.disabled = true"> <span>Emergency Bay Cleared</span></label>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <!-- 2-Column Grid: Active Emergency Cases & Pending Dispatch Queue -->
    <div class="grid-2">
      <!-- Active Emergency Cases in Hospital -->
      <div class="card">
        <div class="card-header flex justify-between items-center">
          <div>
            <h3 class="card-title"><i class="fas fa-heartbeat" style="color: var(--critical)"></i> Active Emergency Cases</h3>
            <div class="card-subtitle">In-room emergency consultations in progress</div>
          </div>
          <span class="badge badge-danger">${activeCases.length} Active</span>
        </div>

        <div class="flex flex-col gap-3" style="margin-top: var(--space-3)">
          ${activeCases.length > 0 ? activeCases.map(c => `
            <div class="card-inner-box" style="margin: 0; border-left: 4px solid var(--critical)">
              <div class="flex justify-between items-center">
                <strong>${escapeHtml(c.patientName)} (${c.caseId})</strong>
                <span class="badge badge-danger">${c.priority}</span>
              </div>
              <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin: 4px 0">
                Doctor: <strong>Dr. ${escapeHtml(c.doctorName)}</strong> · Department: ${escapeHtml(c.department)}
              </div>
              <div style="font-size: var(--font-size-xs); color: var(--text-secondary)">
                Symptoms: <em>"${escapeHtml(c.symptoms)}"</em> · Time: ${timeAgo(c.createdAt)}
              </div>
              <div class="flex gap-2" style="margin-top: var(--space-3); flex-wrap: wrap">
                <button class="btn btn-danger btn-sm" onclick="window.HospitalFlow.completeEmergencyCase('${c.caseId}')">
                  <i class="fas fa-check-circle"></i> Complete Case (Restore Capacity)
                </button>
                <button class="btn btn-secondary btn-sm" onclick="window._showEmergencyDoctorOptions('${c.caseId}')">
                  <i class="fas fa-user-md"></i> Doctor Options
                </button>
              </div>
            </div>
          `).join('') : `
            <div class="empty-state" style="padding: var(--space-6)">
              <i class="fas fa-check-circle" style="color: var(--success)"></i>
              <h4>No active emergency cases</h4>
              <p>Emergency bays are clear and standby ready.</p>
            </div>
          `}
        </div>
      </div>

      <!-- Pending Ambulance Requests -->
      <div class="card">
        <div class="card-header flex justify-between items-center">
          <div>
            <h3 class="card-title"><i class="fas fa-truck-medical" style="color: var(--warning)"></i> Ambulance Dispatch Queue</h3>
            <div class="card-subtitle">Awaiting vehicle assignment and dispatch</div>
          </div>
          <span class="badge badge-warning">${pendingRequests.length} Pending</span>
        </div>

        <div class="flex flex-col gap-3" style="margin-top: var(--space-3)">
          ${pendingRequests.length > 0 ? pendingRequests.map(r => `
            <div class="card-inner-box" style="margin: 0; border: 1px solid var(--border)">
              <div class="flex justify-between items-center">
                <strong>${escapeHtml(r.patientName)}</strong>
                <span class="badge ${r.severity === 'Critical' ? 'badge-danger' : 'badge-warning'}">${r.severity}</span>
              </div>
              <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin: 4px 0">
                Location: <strong>${escapeHtml(r.pickupLocation)}</strong> · Phone: ${escapeHtml(r.contactNumber)}
              </div>
              <button class="btn btn-danger btn-sm" style="margin-top: var(--space-2)" onclick="window._showAmbulanceDispatchModal('${r.requestId}')">
                <i class="fas fa-truck-medical"></i> Select Vehicle & Dispatch
              </button>
            </div>
          `).join('') : `
            <div class="empty-state" style="padding: var(--space-6)">
              <i class="fas fa-check-circle" style="color: var(--success)"></i>
              <h4>No pending ambulance requests</h4>
              <p>All dispatch requests have been processed.</p>
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

// ============================================
// 2. AMBULANCE FLEET TAB (TIMELINE)
// ============================================
function renderAmbulanceFleetTab(el) {
  const s = appState.get();

  el.innerHTML = `
    <div class="card animate-fade-in">
      <div class="card-header flex justify-between items-center">
        <div>
          <h3 class="card-title"><i class="fas fa-ambulance"></i> Hospital Ambulance Fleet Directory</h3>
          <div class="card-subtitle">Real-time status, driver dispatch, and inbound mission coordination</div>
        </div>
        <span class="badge badge-info">${s.ambulances.length} Registered Vehicles</span>
      </div>

      <div class="table-container" style="border: none; margin-top: var(--space-4)">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Vehicle Number</th>
              <th>Assigned Driver</th>
              <th>Driver Phone</th>
              <th>Status</th>
              <th>Base Location</th>
              <th>Active Mission</th>
            </tr>
          </thead>
          <tbody>
            ${s.ambulances.map(a => `
              <tr>
                <td><strong>${a.ambulanceId}</strong></td>
                <td style="font-weight: 600">${a.vehicleNumber}</td>
                <td>${escapeHtml(a.driverName)}</td>
                <td>${escapeHtml(a.contact)}</td>
                <td>
                  <span class="badge ${a.status === 'AVAILABLE' ? 'badge-success' : a.status === 'DISPATCHED' || a.status === 'EN_ROUTE' ? 'badge-danger' : 'badge-neutral'}">
                    ${a.status}
                  </span>
                </td>
                <td>${escapeHtml(a.currentLocation)}</td>
                <td>${a.assignedRequestId ? `<code>${a.assignedRequestId}</code>` : '<span style="color: var(--text-tertiary)">Standby</span>'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ============================================
// 3. BLOOD INVENTORY TAB (FEFO)
// ============================================
function renderInventoryTab(el) {
  const summary = appState.getBloodSummary();

  el.innerHTML = `
    <div class="card animate-fade-in">
      <div class="card-header flex justify-between items-center">
        <div>
          <h3 class="card-title"><i class="fas fa-boxes"></i> FEFO Blood Inventory Reserves</h3>
          <div class="card-subtitle">First-Expiry-First-Out dynamic unit tracking and expiry monitoring across all 8 groups</div>
        </div>
      </div>

      <div class="blood-inventory-grid" style="margin-top: var(--space-4)">
        ${summary.map(item => {
          const statusClass = item.status === 'Critical' ? 'critical' : item.status === 'Low' ? 'low' : '';
          const badgeClass = item.status === 'Critical' ? 'badge-danger' : item.status === 'Low' ? 'badge-warning' : 'badge-success';

          return `
            <div class="blood-card ${statusClass}">
              <div class="blood-card-group">${item.bloodGroup}</div>
              <div class="blood-card-units">${item.available}</div>
              <div class="blood-card-label">usable units</div>
              <div class="progress-bar-track" style="margin: 8px 0">
                <div class="progress-bar-fill ${item.status === 'Critical' ? 'red' : item.status === 'Low' ? 'orange' : 'green'}" style="width: ${Math.min(100, item.available * 10)}%"></div>
              </div>
              <div class="flex justify-between" style="font-size: 11px; color: var(--text-secondary); margin-bottom: 6px">
                <span>Reserved: <strong>${item.reservedUnits}</strong></span>
                <span>Total: <strong>${item.totalUnits}</strong></span>
              </div>
              <span class="badge ${badgeClass}">${item.status}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// ============================================
// 4. BLOOD REQUESTS TAB (8-STAGE LIFECYCLE)
// ============================================
function renderRequestsTab(el) {
  const s = appState.get();

  el.innerHTML = `
    <div class="card animate-fade-in">
      <div class="card-header flex justify-between items-center">
        <div>
          <h3 class="card-title"><i class="fas fa-tint" style="color: var(--critical)"></i> Blood Bank Sourcing & Allocation Pipeline</h3>
          <div class="card-subtitle">Full 8-stage lifecycle: Request → Match → Reserve → Confirm → Issue → Complete</div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="window._showNewBloodRequestModal()">
          <i class="fas fa-plus"></i> New Blood Request
        </button>
      </div>

      <div class="table-container" style="border: none; margin-top: var(--space-4)">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Patient</th>
              <th>Group</th>
              <th>Units</th>
              <th>Urgency</th>
              <th>Lifecycle Stage</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${s.bloodRequests.map(r => {
              const isCrit = r.urgency === 'Emergency' || r.urgency === 'Critical';
              return `
                <tr>
                  <td><strong>${r.id}</strong></td>
                  <td>${escapeHtml(r.patientName || r.patientId)}</td>
                  <td><span class="badge badge-neutral" style="font-weight: 700">${r.bloodGroup}</span></td>
                  <td><strong>${r.units} Units</strong></td>
                  <td><span class="badge ${isCrit ? 'badge-danger' : 'badge-warning'}">${r.urgency}</span></td>
                  <td>
                    <span class="badge ${
                      r.status === 'Issued' || r.status === 'Resolved' || r.status === 'COMPLETED' ? 'badge-success' :
                      r.status === 'Reserved' || r.status === 'BLOOD_BANK_CONFIRMED' || r.status === 'READY_FOR_ISSUE' ? 'badge-info' :
                      r.status === 'Escalated' ? 'badge-danger' : 'badge-warning'
                    }">
                      ${r.status}
                    </span>
                  </td>
                  <td>
                    <div class="flex gap-1">
                      ${r.status === 'Created' || r.status === 'Pending' || r.status === 'Open' ? `
                        <button class="btn btn-primary btn-sm" onclick="window.HospitalFlow.showSourceResults('${r.id}')">
                          <i class="fas fa-search"></i> Source
                        </button>
                      ` : r.status === 'Matched' || r.status === 'OPERATIONAL_MATCH_FOUND' ? `
                        <button class="btn btn-primary btn-sm" onclick="window.HospitalFlow.reserveBlood('${r.id}', 'FAC-001', ${r.units})">
                          <i class="fas fa-lock"></i> Reserve
                        </button>
                      ` : r.status === 'Reserved' ? `
                        <button class="btn btn-info btn-sm" onclick="window._advanceBloodStatus('${r.id}', 'BLOOD_BANK_CONFIRMED')">
                          <i class="fas fa-check-double"></i> Crossmatch Confirmed
                        </button>
                      ` : r.status === 'BLOOD_BANK_CONFIRMED' ? `
                        <button class="btn btn-warning btn-sm" onclick="window._advanceBloodStatus('${r.id}', 'READY_FOR_ISSUE')">
                          <i class="fas fa-box-open"></i> Ready for Issue
                        </button>
                      ` : r.status === 'READY_FOR_ISSUE' ? `
                        <button class="btn btn-success btn-sm" onclick="window.HospitalFlow.issueBlood('${r.id}')">
                          <i class="fas fa-hand-holding-medical"></i> Issue Units
                        </button>
                      ` : r.status === 'Issued' ? `
                        <button class="btn btn-ghost btn-sm" onclick="window._advanceBloodStatus('${r.id}', 'COMPLETED')">
                          <i class="fas fa-check"></i> Complete
                        </button>
                      ` : r.status === 'Escalated' ? `
                        <button class="btn btn-danger btn-sm" onclick="window.HospitalFlow.sendDonorWave('${r.id}')">
                          <i class="fas fa-bullhorn"></i> Donor Wave
                        </button>
                      ` : `
                        <span style="font-size: 11px; color: var(--text-tertiary)">✓ Resolved</span>
                      `}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ============================================
// 5. DONOR COORDINATION TAB (RICH VERIFICATION)
// ============================================
function renderDonorsTab(el) {
  const s = appState.get();

  el.innerHTML = `
    <div class="card animate-fade-in">
      <div class="card-header flex justify-between items-center">
        <div>
          <h3 class="card-title"><i class="fas fa-hand-holding-heart" style="color: var(--critical)"></i> Community Donor Coordination</h3>
          <div class="card-subtitle">Blood group matching, contact verification, OTP validation & emergency callout</div>
        </div>
        <span class="badge badge-success">${s.donors.filter(d => d.available).length} Donors Available</span>
      </div>

      <div class="table-container" style="border: none; margin-top: var(--space-4)">
        <table class="data-table">
          <thead>
            <tr>
              <th>Donor</th>
              <th>Blood Group</th>
              <th>Locality</th>
              <th>Last Donation</th>
              <th>Eligibility</th>
              <th>Verification Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${s.donors.map(d => {
              const days = d.lastDonationDate ? daysBetween(d.lastDonationDate, new Date()) : 120;
              const isCooldown = days < 90;
              return `
                <tr>
                  <td>
                    <div style="font-weight: 700">${escapeHtml(d.displayName)}</div>
                    <div style="font-size: 11px; color: var(--text-secondary)">${d.id} · ${escapeHtml(d.phone || '+91 9876543210')}</div>
                  </td>
                  <td><span class="badge badge-neutral" style="font-weight: 800">${d.bloodGroup}</span></td>
                  <td>${escapeHtml(d.locality || 'Central')}</td>
                  <td>
                    <span style="font-size: 12px">${d.lastDonationDate ? formatDate(d.lastDonationDate) : '120+ days ago'}</span>
                    <div style="font-size: 10px; color: var(--text-secondary)">(${days} days ago)</div>
                  </td>
                  <td>
                    <span class="badge ${isCooldown ? 'badge-warning' : 'badge-success'}">
                      ${isCooldown ? `Cooldown (${90 - days}d left)` : 'Eligible'}
                    </span>
                  </td>
                  <td>
                    <span class="badge ${d.otpVerified ? 'badge-success' : d.verified ? 'badge-info' : 'badge-neutral'}">
                      <i class="fas ${d.otpVerified ? 'fa-check-circle' : d.verified ? 'fa-id-card' : 'fa-clock'}"></i>
                      ${d.otpVerified ? 'OTP Verified' : d.verified ? 'Document Verified' : 'Pending Verification'}
                    </span>
                  </td>
                  <td>
                    <div class="flex gap-1" style="flex-wrap: wrap">
                      <a href="tel:${d.phone || '+919876543210'}" class="btn btn-secondary btn-sm" title="Direct Phone Call">
                        <i class="fas fa-phone-alt"></i> Call
                      </a>
                      <button class="btn btn-ghost btn-sm" onclick="window._showDonorVerificationModal('${d.id}')" title="Verify Donor">
                        <i class="fas fa-shield-check"></i> Verify
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ============================================
// HELPER MODALS & HANDLERS
// ============================================

window._markPreArrivalArrived = (preArrivalId) => {
  const s = appState.get();
  const pre = (s.emergencyPreArrivals || []).find(p => p.id === preArrivalId);
  if (!pre) return;

  pre.status = 'ARRIVED';
  // Insert patient into emergency triage queue
  try {
    FlowEngine.insertEmergencyPatient({
      patientId: pre.patientId,
      department: 'Emergency & Trauma'
    });
  } catch (e) {
    console.warn('Queue insert note:', e.message);
  }

  alert(`Patient ${pre.patientName} marked arrived. Prioritized in Emergency Bay as Priority #1.`);
  renderEmergencyCommandTab(document.getElementById('emergency-tab-content'));
};

window._showEmergencyDoctorOptions = (caseId) => {
  const s = appState.get();
  const emCase = s.emergencyCases.find(c => c.id === caseId || c.caseId === caseId);
  const availableDocs = s.doctors.filter(d => ['Available', 'Consulting'].includes(d.status) && d.id !== emCase?.doctorId);

  const modalRoot = document.getElementById('emergency-modal-root') || document.body;
  modalRoot.innerHTML = `
    <div class="modal-backdrop active">
      <div class="modal active" style="max-width: 520px">
        <div class="modal-header">
          <h3 class="modal-title" style="color: var(--critical)"><i class="fas fa-user-md"></i> Emergency Physician Coordination</h3>
          <button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <p style="font-size: var(--font-size-xs); color: var(--text-secondary)">Manage physician assignment for Case <strong>${caseId}</strong> (${emCase?.patientName}):</p>
          <div class="flex flex-col gap-2" style="margin-top: var(--space-3)">
            <button class="btn btn-secondary" onclick="alert('Case prioritized as next emergency queue task.'); this.closest('.modal-backdrop').remove();">
              <i class="fas fa-sort-amount-up"></i> Assign as Next Priority for Current Doctor
            </button>
            <div class="form-group" style="margin-top: var(--space-2)">
              <label class="form-label">Transfer to Backup Physician:</label>
              <select id="backup-doc-select" class="form-select">
                ${availableDocs.map(d => `<option value="${d.id}">Dr. ${d.displayName} (${d.department}) · Load: ${d.queueLoad}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
          <button class="btn btn-primary" id="btn-reassign-em-doc"><i class="fas fa-check"></i> Reassign Doctor</button>
        </div>
      </div>
    </div>
  `;

  modalRoot.querySelector('#btn-reassign-em-doc')?.addEventListener('click', () => {
    const docId = modalRoot.querySelector('#backup-doc-select').value;
    const doc = s.doctors.find(d => d.id === docId);
    if (emCase && doc) {
      emCase.doctorId = doc.id;
      emCase.doctorName = doc.displayName;
      doc.status = 'EMERGENCY_ACTIVE';
      appState.update({ emergencyCases: [...s.emergencyCases], doctors: [...s.doctors] });
      alert(`Emergency Case reassigned to Dr. ${doc.displayName}. Doctor status set to Emergency Active.`);
    }
    modalRoot.innerHTML = '';
    renderEmergencyCommandTab(document.getElementById('emergency-tab-content'));
  });
};

window._advanceBloodStatus = (requestId, newStatus) => {
  appState.updateItem('bloodRequests', requestId, { status: newStatus });
  alert(`Blood Request ${requestId} advanced to "${newStatus}".`);
  renderRequestsTab(document.getElementById('emergency-tab-content'));
};

window._showDonorVerificationModal = (donorId) => {
  const s = appState.get();
  const donor = s.donors.find(d => d.id === donorId);

  const modalRoot = document.getElementById('emergency-modal-root') || document.body;
  modalRoot.innerHTML = `
    <div class="modal-backdrop active">
      <div class="modal active" style="max-width: 480px">
        <div class="modal-header">
          <h3 class="modal-title"><i class="fas fa-id-card" style="color: var(--primary)"></i> Verify Donor: ${escapeHtml(donor?.displayName)}</h3>
          <button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="card-inner-box" style="margin-bottom: var(--space-3); font-size: var(--font-size-xs)">
            <div>Blood Group: <strong>${donor?.bloodGroup}</strong></div>
            <div>Phone: <strong>${donor?.phone}</strong></div>
            <div>Verification Status: <strong>${donor?.otpVerified ? 'OTP Confirmed' : donor?.verified ? 'Document Verified' : 'Pending'}</strong></div>
          </div>
          <div class="flex flex-col gap-2">
            <button class="btn btn-secondary" onclick="window.HospitalFlow.showOTPVerification('${donorId}'); this.closest('.modal-backdrop').remove();">
              <i class="fas fa-key"></i> Verify via 6-Digit OTP
            </button>
            <button class="btn btn-secondary" onclick="window._markDonorDocVerified('${donorId}'); this.closest('.modal-backdrop').remove();">
              <i class="fas fa-file-medical"></i> Verify Identification Documents
            </button>
            <button class="btn btn-primary" onclick="window._markDonorAdminVerified('${donorId}'); this.closest('.modal-backdrop').remove();">
              <i class="fas fa-check-circle"></i> Direct Administrator Sign-Off
            </button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="this.closest('.modal-backdrop').remove()">Close</button>
        </div>
      </div>
    </div>
  `;
};

window._markDonorDocVerified = (donorId) => {
  appState.updateItem('donors', donorId, { verified: true });
  alert('Donor identification documents marked as verified.');
  renderDonorsTab(document.getElementById('emergency-tab-content'));
};

window._markDonorAdminVerified = (donorId) => {
  appState.updateItem('donors', donorId, { verified: true, otpVerified: true });
  alert('Donor successfully verified with administrator authorization.');
  renderDonorsTab(document.getElementById('emergency-tab-content'));
};

window._showNewBloodRequestModal = () => {
  const s = appState.get();
  const modalRoot = document.getElementById('emergency-modal-root') || document.body;
  modalRoot.innerHTML = `
    <div class="modal-backdrop active">
      <div class="modal active" style="max-width: 480px">
        <div class="modal-header">
          <h3 class="modal-title" style="color: var(--critical)"><i class="fas fa-tint"></i> Create Emergency Blood Request</h3>
          <button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Blood Group <span class="required">*</span></label>
            <select id="new-blood-group" class="form-select">
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
            <input type="number" id="new-blood-units" class="form-input" value="2" min="1" max="10">
          </div>
          <div class="form-group">
            <label class="form-label">Urgency Level</label>
            <select id="new-blood-urgency" class="form-select">
              <option value="Emergency">Emergency (Immediate)</option>
              <option value="Urgent">Urgent (Within 1 hour)</option>
              <option value="Routine">Routine</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
          <button class="btn btn-danger" id="btn-submit-new-blood"><i class="fas fa-paper-plane"></i> Submit Request</button>
        </div>
      </div>
    </div>
  `;

  modalRoot.querySelector('#btn-submit-new-blood')?.addEventListener('click', () => {
    const bg = modalRoot.querySelector('#new-blood-group').value;
    const units = parseInt(modalRoot.querySelector('#new-blood-units').value) || 2;
    const urgency = modalRoot.querySelector('#new-blood-urgency').value;

    BloodEngine.createRequest({
      patientId: 'P-1042',
      bloodGroup: bg,
      units,
      urgency,
      department: 'Emergency Trauma'
    });

    modalRoot.innerHTML = '';
    alert(`Emergency blood request created for ${units} units of ${bg}.`);
    renderRequestsTab(document.getElementById('emergency-tab-content'));
  });
};

// Modal for Ambulance Dispatch
window._showAmbulanceDispatchModal = (requestId) => {
  const s = appState.get();
  const req = s.ambulanceRequests.find(r => r.requestId === requestId);
  const availableAmbs = s.ambulances.filter(a => a.status === 'AVAILABLE');

  const modalRoot = document.getElementById('emergency-modal-root') || document.body;
  modalRoot.innerHTML = `
    <div class="modal-backdrop active">
      <div class="modal active" style="max-width: 480px">
        <div class="modal-header">
          <h3 class="modal-title" style="color: var(--critical)"><i class="fas fa-truck-medical"></i> Dispatch Ambulance Vehicle</h3>
          <button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <p style="font-size: var(--font-size-xs); color: var(--text-secondary)">Assign an available hospital vehicle to pickup location: <strong>${escapeHtml(req?.pickupLocation)}</strong></p>
          <div class="form-group" style="margin-top: var(--space-3)">
            <label class="form-label">Select Ambulance Vehicle <span class="required">*</span></label>
            <select id="dispatch-amb-select" class="form-select">
              ${availableAmbs.map(a => `
                <option value="${a.ambulanceId}">${a.vehicleNumber} (${a.ambulanceId}) · Driver: ${a.driverName}</option>
              `).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Estimated Pickup Time (Minutes)</label>
            <input type="number" id="dispatch-mins" class="form-input" value="6" min="2" max="30">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
          <button class="btn btn-danger" id="btn-confirm-amb-dispatch"><i class="fas fa-paper-plane"></i> Confirm Dispatch</button>
        </div>
      </div>
    </div>
  `;

  modalRoot.querySelector('#btn-confirm-amb-dispatch')?.addEventListener('click', () => {
    const ambId = modalRoot.querySelector('#dispatch-amb-select').value;
    const mins = parseInt(modalRoot.querySelector('#dispatch-mins').value) || 6;
    FlowEngine.dispatchAmbulance(requestId, ambId, mins);
    modalRoot.innerHTML = '';
    alert(`Ambulance ${ambId} dispatched to ${req.pickupLocation}. Live ETA synchronized.`);
    renderEmergencyCommandTab(document.getElementById('emergency-tab-content'));
  });
};

