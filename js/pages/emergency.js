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
  const activeCases = (s.emergencyCases || []).filter(c => c.status !== 'COMPLETED');
  const incomingAmb = (s.ambulanceRequests || []).filter(r => r.status === 'DISPATCHED' || r.status === 'EN_ROUTE');
  const pendingRequests = (s.ambulanceRequests || []).filter(r => r.status === 'REQUESTED');
  const availableAmbs = s.ambulances.filter(a => a.status === 'AVAILABLE').length;

  el.innerHTML = `
    <!-- 4 Primary Emergency KPIs (Requirement 26) -->
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
        <div class="kpi-icon ${incomingAmb.length > 0 ? 'orange' : 'teal'}">
          <i class="fas fa-ambulance"></i>
        </div>
        <div class="kpi-content">
          <div class="kpi-label">Incoming Ambulances</div>
          <div class="kpi-value">${incomingAmb.length}</div>
          <div class="kpi-meta">En route to hospital</div>
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

    <!-- Active Inbound Ambulance Tracking & Pre-Arrival Checklist (Requirements 26 & 28) -->
    ${incomingAmb.length > 0 ? `
      <div class="card" style="border-left: 4px solid var(--critical); margin-bottom: var(--space-6); background: #FFFDF5">
        <div class="card-header flex justify-between items-center" style="border-bottom: 1px solid rgba(245, 158, 11, 0.2); padding-bottom: var(--space-3)">
          <div>
            <h3 class="card-title" style="color: #92400E">
              <i class="fas fa-ambulance"></i> Incoming Ambulance Pre-Arrival Readiness
            </h3>
            <div class="card-subtitle">Live trauma inbound tracking & preparation checklist</div>
          </div>
          <span class="badge badge-warning">INBOUND ETA ~${incomingAmb[0].estimatedHospitalArrival || 6} MIN</span>
        </div>

        <div style="padding-top: var(--space-4)">
          ${incomingAmb.map(req => `
            <div class="card-inner-box" style="background: white; border: 1px solid var(--border); margin-bottom: var(--space-3)">
              <div class="flex justify-between items-center" style="flex-wrap: wrap; gap: var(--space-3)">
                <div>
                  <h4 style="margin: 0; font-size: var(--font-size-md)">${escapeHtml(req.patientName)} (${req.requestId})</h4>
                  <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-top: 2px">
                    Vehicle: <strong>${req.assignedAmbulanceId || 'AMB-03'}</strong> · Pickup: ${escapeHtml(req.pickupLocation)} · Symptoms: <em>"${escapeHtml(req.symptoms)}"</em>
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

              <!-- Requirement 28: Pre-Arrival Readiness Checklist -->
              <div style="margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--border-light)">
                <div style="font-size: var(--font-size-xs); font-weight: 700; color: var(--text-secondary); margin-bottom: 6px">
                  Pre-Arrival Readiness Checklist:
                </div>
                <div class="flex gap-4" style="flex-wrap: wrap; font-size: var(--font-size-xs)">
                  <label class="flex items-center gap-1"><input type="checkbox" checked disabled> <span>Emergency Bed Ready</span></label>
                  <label class="flex items-center gap-1"><input type="checkbox" checked disabled> <span>Doctor Assigned</span></label>
                  <label class="flex items-center gap-1" style="cursor: pointer"><input type="checkbox" onchange="this.disabled = true"> <span>Trauma Team Mobilized</span></label>
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
              <div class="flex gap-2" style="margin-top: var(--space-3)">
                <button class="btn btn-danger btn-sm" onclick="window.HospitalFlow.completeEmergencyCase('${c.caseId}')">
                  <i class="fas fa-check-circle"></i> Complete Case (Restore Capacity)
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
// 2. AMBULANCE FLEET TAB (REQUIREMENT 27 TIMELINE)
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
// 3. BLOOD INVENTORY TAB (REQUIREMENT 29 FEFO)
// ============================================
function renderInventoryTab(el) {
  const summary = appState.getBloodSummary();

  el.innerHTML = `
    <div class="card animate-fade-in">
      <div class="card-header flex justify-between items-center">
        <div>
          <h3 class="card-title"><i class="fas fa-boxes"></i> FEFO Blood Inventory Reserves</h3>
          <div class="card-subtitle">First-Expiry-First-Out dynamic unit tracking and expiry monitoring</div>
        </div>
      </div>

      <!-- 8 Blood Group Cards (Requirement 29) -->
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

// Subroutes stubs
function renderRequestsTab(el) {
  const s = appState.get();
  el.innerHTML = `
    <div class="card animate-fade-in">
      <div class="card-header flex justify-between items-center">
        <h3 class="card-title"><i class="fas fa-tint"></i> Emergency Blood Sourcing Requests</h3>
        <span class="badge badge-info">${s.bloodRequests.length} Requests</span>
      </div>
      <div class="table-container" style="border: none; margin-top: var(--space-4)">
        <table class="data-table">
          <thead><tr><th>ID</th><th>Patient</th><th>Blood</th><th>Units</th><th>Urgency</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${s.bloodRequests.map(r => `
              <tr>
                <td><strong>${r.id}</strong></td>
                <td>${r.patientId}</td>
                <td><span class="badge badge-neutral">${r.bloodGroup}</span></td>
                <td><strong>${r.units}</strong></td>
                <td><span class="badge ${r.urgency === 'Emergency' ? 'badge-danger' : 'badge-warning'}">${r.urgency}</span></td>
                <td><span class="badge badge-info">${r.status}</span></td>
                <td>
                  ${r.status === 'Pending' || r.status === 'Open' ? `
                    <button class="btn btn-primary btn-sm" onclick="window.HospitalFlow.showSourceResults('${r.id}')"><i class="fas fa-search"></i> Source</button>
                  ` : r.status === 'Reserved' ? `
                    <button class="btn btn-success btn-sm" onclick="window.HospitalFlow.issueBlood('${r.id}')"><i class="fas fa-check"></i> Issue</button>
                  ` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderDonorsTab(el) {
  const s = appState.get();
  el.innerHTML = `
    <div class="card animate-fade-in">
      <div class="card-header flex justify-between items-center">
        <h3 class="card-title"><i class="fas fa-hand-holding-heart"></i> Community Donor Network</h3>
        <span class="badge badge-success">${s.donors.filter(d => d.available).length} Ready</span>
      </div>
      <div class="table-container" style="border: none; margin-top: var(--space-4)">
        <table class="data-table">
          <thead><tr><th>ID</th><th>Name</th><th>Blood</th><th>Locality</th><th>Phone</th><th>Actions</th></tr></thead>
          <tbody>
            ${s.donors.slice(0, 10).map(d => `
              <tr>
                <td><strong>${d.id}</strong></td>
                <td style="font-weight: 600">${escapeHtml(d.displayName)}</td>
                <td><span class="badge badge-neutral">${d.bloodGroup}</span></td>
                <td>${escapeHtml(d.locality)}</td>
                <td>${d.phone}</td>
                <td>
                  <button class="btn btn-secondary btn-sm" onclick="window.HospitalFlow.showOTPVerification('${d.id}')">
                    <i class="fas fa-key"></i> OTP Verify
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

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
