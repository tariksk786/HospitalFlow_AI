// ============================================
// HospitalFlow AI — Emergency Readiness & Command Page
// Real-Time Emergency Triage, Doctor Assignment, Priority Queue & FEFO Blood Bank
// ============================================

import appState from '../state.js';
import Config from '../config.js';
import Auth from '../auth.js';
import FlowEngine from '../engines/flow-engine.js';
import BloodEngine from '../engines/blood-engine.js';
import alertManager from '../engines/emergency-alert-manager.js';
import eventBus, { EventTypes } from '../events.js';
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
          <p>Real-time cross-device emergency triage, intelligent doctor assignment, priority queueing & FEFO blood bank</p>
        </div>
        <div class="care-safety-notice" style="margin: 0; font-size: var(--font-size-xs)">
          <i class="fas fa-info-circle"></i> Supabase Realtime Connected · Shared Operational Source of Truth
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

  // Sort active emergencies by: 1. Priority (P1 > P2 > P3 > P4), 2. Created time (newest first)
  const activeCases = (s.emergencyCases || [])
    .filter(c => c.status !== 'COMPLETED')
    .sort((a, b) => {
      const pMap = {
        'P1 - Critical Emergency': 1, 'P1': 1, 'P1 Critical': 1, 'Critical': 1,
        'P2 - Urgent': 2, 'P2': 2, 'P2 Urgent': 2, 'Urgent': 2,
        'P3 - Priority': 3, 'P3': 3, 'P3 Priority': 3, 'Priority': 3,
        'P4 - Routine': 4, 'P4': 4, 'P4 Routine': 4, 'Routine': 4
      };
      const pA = pMap[a.priority] || pMap[a.severity] || 2;
      const pB = pMap[b.priority] || pMap[b.severity] || 2;
      if (pA !== pB) return pA - pB;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  const criticalCasesCount = activeCases.filter(c => (c.priority || '').includes('P1') || (c.severity || '').includes('Critical')).length;
  const availableDoctors = s.doctors.filter(d => ['Available', 'Consulting'].includes(d.status)).length;
  const availableTraumaDocs = s.doctors.filter(d => d.department === 'General Medicine' || d.department === 'Cardiology' || d.specialty?.includes('Trauma') || d.specialty?.includes('Emergency')).length;

  const isOverloaded = criticalCasesCount > availableTraumaDocs || (criticalCasesCount >= 3 && availableDoctors <= 2);

  const incomingAmb = (s.ambulanceRequests || []).filter(r => r.status === 'DISPATCHED' || r.status === 'EN_ROUTE');
  const availableAmbs = s.ambulances.filter(a => a.status === 'AVAILABLE').length;

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
          <div class="kpi-meta">${criticalCasesCount} P1 Critical · ${activeCases.length - criticalCasesCount} P2/P3</div>
        </div>
      </div>

      <div class="metric-card">
        <div class="kpi-icon ${availableDoctors < 3 ? 'orange' : 'teal'}">
          <i class="fas fa-user-md"></i>
        </div>
        <div class="kpi-content">
          <div class="kpi-label">Physician Availability</div>
          <div class="kpi-value">${availableDoctors} <span style="font-size: 14px; font-weight: normal; color: var(--text-secondary)">/ ${s.doctors.length}</span></div>
          <div class="kpi-meta">${availableTraumaDocs} trauma-capable</div>
        </div>
      </div>

      <div class="metric-card">
        <div class="kpi-icon green"><i class="fas fa-truck-medical"></i></div>
        <div class="kpi-content">
          <div class="kpi-label">Fleet Standby</div>
          <div class="kpi-value">${availableAmbs} <span style="font-size: 14px; font-weight: normal; color: var(--text-secondary)">/ ${s.ambulances.length}</span></div>
          <div class="kpi-meta">Ambulance bays ready</div>
        </div>
      </div>

      <div class="metric-card">
        <div class="kpi-icon ${incomingAmb.length > 0 ? 'orange' : 'blue'}">
          <i class="fas fa-ambulance"></i>
        </div>
        <div class="kpi-content">
          <div class="kpi-label">Inbound Dispatches</div>
          <div class="kpi-value">${incomingAmb.length}</div>
          <div class="kpi-meta">En route to hospital</div>
        </div>
      </div>
    </div>

    <!-- Emergency Capacity Warning (Requirement 18) -->
    ${isOverloaded ? `
      <div class="card" style="border: 2px solid #EF4444; background: #FEF2F2; margin-bottom: var(--space-6)">
        <div class="card-header flex justify-between items-center" style="border-bottom: 1px solid rgba(239, 68, 68, 0.2); padding-bottom: var(--space-3)">
          <div class="flex items-center gap-3">
            <div style="width: 38px; height: 38px; border-radius: 50%; background: #DC2626; color: white; display: flex; align-items: center; justify-content: center; font-size: 18px">
              <i class="fas fa-exclamation-triangle"></i>
            </div>
            <div>
              <h3 class="card-title" style="color: #991B1B">🚨 Emergency Capacity Warning</h3>
              <div class="card-subtitle" style="color: #B91C1C"><strong>${criticalCasesCount} Critical Cases</strong> active · <strong>${availableTraumaDocs} Emergency-Capable Doctors</strong> available</div>
            </div>
          </div>
          <span class="badge badge-danger">CAPACITY WARNING</span>
        </div>

        <div style="padding-top: var(--space-3)">
          <div style="font-size: var(--font-size-xs); font-weight: 700; color: #991B1B; margin-bottom: 6px">
            Recommended Action Plan:
          </div>
          <div class="grid-2" style="gap: var(--space-3); font-size: var(--font-size-xs)">
            <div class="card-inner-box" style="background: white; border: 1px solid rgba(239, 68, 68, 0.3); margin: 0">
              <strong>1. Activate Backup Doctor:</strong> Mobilize Dr. Sunita Reddy or Dr. Manish Gupta to handle overflow.
            </div>
            <div class="card-inner-box" style="background: white; border: 1px solid rgba(239, 68, 68, 0.3); margin: 0">
              <strong>2. Prepare Additional Emergency Bay:</strong> Clear Bay 4 and allocate dedicated respiratory support.
            </div>
            <div class="card-inner-box" style="background: white; border: 1px solid rgba(239, 68, 68, 0.3); margin: 0">
              <strong>3. Redistribute Routine Patients:</strong> Transfer OPD tokens to lighten primary physician load.
            </div>
            <div class="card-inner-box" style="background: white; border: 1px solid rgba(239, 68, 68, 0.3); margin: 0">
              <strong>4. Protect Critical Queue:</strong> Prevent non-urgent patient call-ins until emergency stabilizes.
            </div>
          </div>
        </div>
      </div>
    ` : ''}

    <!-- Active Emergency Cases (Requirement 1, 2, 3, 17) -->
    <div class="card" style="margin-bottom: var(--space-6)">
      <div class="card-header flex justify-between items-center">
        <div>
          <h3 class="card-title"><i class="fas fa-heartbeat" style="color: var(--critical)"></i> Emergency Command Queue (${activeCases.length} Active Cases)</h3>
          <div class="card-subtitle">Prioritized triage queue sorted by clinical severity (P1 > P2 > P3 > P4) and arrival timestamp</div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="window._showNewEmergencyIntakeModal()">
          <i class="fas fa-plus"></i> Manual Emergency Intake
        </button>
      </div>

      <div class="flex flex-col gap-3" style="margin-top: var(--space-4)">
        ${activeCases.length > 0 ? activeCases.map(c => {
          const isP1 = (c.priority || '').includes('P1') || (c.severity || '').includes('Critical');
          const isP2 = (c.priority || '').includes('P2') || (c.severity || '').includes('Urgent');
          const isP3 = (c.priority || '').includes('P3') || (c.severity || '').includes('Priority');
          
          const borderStyle = isP1 ? '4px solid #DC2626' : isP2 ? '4px solid #D97706' : isP3 ? '4px solid #2563EB' : '4px solid #10B981';
          const bgStyle = isP1 ? '#FFF5F5' : isP2 ? '#FFFDF5' : 'white';
          const priorityBadge = isP1 ? 'badge-danger' : isP2 ? 'badge-warning' : isP3 ? 'badge-info' : 'badge-neutral';
          const priorityLabel = isP1 ? 'P1 — CRITICAL' : isP2 ? 'P2 — URGENT' : isP3 ? 'P3 — PRIORITY' : 'P4 — ROUTINE';

          const isUnassigned = !c.doctorId || c.status === 'AWAITING_DOCTOR' || c.status === 'INCOMING';

          return `
            <div class="card-inner-box" style="margin: 0; border-left: ${borderStyle}; background: ${bgStyle}; border-top: 1px solid var(--border); border-right: 1px solid var(--border); border-bottom: 1px solid var(--border)">
              <div class="flex justify-between items-start" style="flex-wrap: wrap; gap: var(--space-3)">
                <div style="flex: 1; min-width: 280px">
                  <div class="flex items-center gap-2">
                    <span class="badge ${priorityBadge}" style="font-weight: 800; letter-spacing: 0.04em">${priorityLabel}</span>
                    <h4 style="margin: 0; font-size: var(--font-size-md); font-weight: 700">${escapeHtml(c.patientName)}</h4>
                    <span style="font-size: var(--font-size-xs); color: var(--text-tertiary)">(${c.caseId || c.id})</span>
                    <span class="badge badge-neutral" style="font-size: 11px">Patient ID: ${c.patientId || 'P-1084'}</span>
                  </div>

                  <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin: 6px 0 2px">
                    Reported Symptoms: <strong style="color: var(--text-primary)">"${escapeHtml(c.symptoms || c.reportedSymptoms || 'Severe breathing difficulty')}"</strong>
                  </div>

                  <div class="flex gap-4" style="font-size: var(--font-size-xs); color: var(--text-secondary); flex-wrap: wrap">
                    <span>Department: <strong>${escapeHtml(c.department || 'General Medicine')}</strong></span>
                    <span>Transport: <strong><i class="fas ${c.transportMode?.includes('Ambulance') ? 'fa-ambulance' : 'fa-car'}"></i> ${escapeHtml(c.transportMode || 'Private Vehicle')}</strong></span>
                    <span>Arrival ETA: <strong style="color: var(--critical)">${c.etaMinutes ? `${c.etaMinutes} min` : 'Arrived / In Bay'}</strong></span>
                    <span>Status: <strong class="badge ${isUnassigned ? 'badge-warning' : 'badge-success'}" style="font-size: 10px">${escapeHtml(c.status || 'Awaiting Doctor')}</strong></span>
                  </div>

                  ${c.doctorId ? `
                    <div style="font-size: var(--font-size-xs); margin-top: 6px; padding: 4px 8px; background: rgba(16, 185, 129, 0.1); border-radius: 4px; display: inline-block">
                      <i class="fas fa-user-md" style="color: #059669"></i> Assigned Doctor: <strong style="color: #065F46">Dr. ${escapeHtml(c.doctorName || 'Aarav Sharma')}</strong>
                    </div>
                  ` : ''}
                </div>

                <!-- Actions -->
                <div class="flex items-center gap-2" style="flex-wrap: wrap">
                  ${isUnassigned ? `
                    <button class="btn btn-primary" onclick="window._showAssignEmergencyDoctorModal('${c.caseId || c.id}')" style="box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3)">
                      <i class="fas fa-user-plus"></i> Assign Doctor
                    </button>
                  ` : `
                    <button class="btn btn-secondary btn-sm" onclick="window._showAssignEmergencyDoctorModal('${c.caseId || c.id}')">
                      <i class="fas fa-exchange-alt"></i> Reassign Doctor
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="window.HospitalFlow.completeEmergencyCase('${c.caseId || c.id}')">
                      <i class="fas fa-check-circle"></i> Complete Emergency
                    </button>
                  `}
                </div>
              </div>
            </div>
          `;
        }).join('') : `
          <div class="empty-state" style="padding: var(--space-8)">
            <i class="fas fa-check-circle" style="font-size: 36px; color: var(--success)"></i>
            <h4>No Active Emergency Cases</h4>
            <p>Trauma bays are standby ready. All emergency cases have been resolved.</p>
          </div>
        `}
      </div>
    </div>
  `;
}

// ============================================
// 2. AMBULANCE FLEET TAB
// ============================================
function renderAmbulanceFleetTab(el) {
  const s = appState.get();

  el.innerHTML = `
    <div class="card animate-fade-in">
      <div class="card-header flex justify-between items-center">
        <div>
          <h3 class="card-title"><i class="fas fa-ambulance"></i> Hospital Ambulance Fleet Directory</h3>
          <div class="card-subtitle">Real-time vehicle telemetry, driver dispatch, and inbound trauma mission coordination</div>
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
                <td><strong style="color: var(--primary)">${a.vehicleNumber}</strong></td>
                <td>${escapeHtml(a.driverName)}</td>
                <td><a href="tel:${a.contact}" style="color: var(--primary); font-weight: 600">${a.contact}</a></td>
                <td>
                  <span class="badge ${a.status === 'AVAILABLE' ? 'badge-success' : a.status === 'DISPATCHED' ? 'badge-warning' : 'badge-neutral'}">
                    ${a.status}
                  </span>
                </td>
                <td>${escapeHtml(a.currentLocation)}</td>
                <td>
                  ${a.assignedRequestId ? `
                    <span style="font-size: 11px; color: var(--critical); font-weight: 700">
                      <i class="fas fa-route"></i> Mission: ${a.assignedRequestId} (${a.estimatedArrival || 'En Route'})
                    </span>
                  ` : `
                    <span style="font-size: 11px; color: var(--text-tertiary)">Standby Bay</span>
                  `}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ============================================
// 3. BLOOD INVENTORY TAB (FEFO - 8 Blood Groups)
// ============================================
function renderInventoryTab(el) {
  const summary = appState.getBloodSummary();

  el.innerHTML = `
    <div class="card animate-fade-in">
      <div class="card-header flex justify-between items-center">
        <div>
          <h3 class="card-title"><i class="fas fa-boxes"></i> FEFO Blood Inventory Reserves (8 Groups)</h3>
          <div class="card-subtitle">First-Expiry-First-Out dynamic unit tracking and expiry monitoring across all 8 blood groups</div>
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
              <div class="blood-card-label">available units</div>
              <div class="progress-bar-track" style="margin: 8px 0">
                <div class="progress-bar-fill ${item.status === 'Critical' ? 'red' : item.status === 'Low' ? 'orange' : 'green'}" style="width: ${Math.min(100, item.available * 12)}%"></div>
              </div>
              <div class="flex justify-between" style="font-size: 11px; color: var(--text-secondary); margin-bottom: 6px">
                <span>Reserved: <strong>${item.reservedUnits}</strong></span>
                <span>Expiring Soon: <strong style="color: ${item.expiringSoon > 0 ? 'var(--warning)' : 'inherit'}">${item.expiringSoon || 0}</strong></span>
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
                      ${r.status === 'Created' || r.status === 'Pending' || r.status === 'Checking Internal' ? `
                        <button class="btn btn-primary btn-sm" onclick="window.HospitalFlow.reserveBlood('${r.id}', 'FAC-001', ${r.units})">
                          <i class="fas fa-lock"></i> Reserve Blood
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="window._handleInsufficientBlood('${r.id}')">
                          <i class="fas fa-exclamation-triangle"></i> Inventory Insufficient
                        </button>
                      ` : r.status === 'Matched' ? `
                        <button class="btn btn-primary btn-sm" onclick="window.HospitalFlow.reserveBlood('${r.id}', 'FAC-001', ${r.units})">
                          <i class="fas fa-lock"></i> Reserve
                        </button>
                      ` : r.status === 'Reserved' ? `
                        <button class="btn btn-info btn-sm" onclick="window._advanceBloodStatus('${r.id}', 'BLOOD_BANK_CONFIRMED')">
                          <i class="fas fa-check-double"></i> Confirm Reservation
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
                      ` : r.status === 'Searching External Source' ? `
                        <button class="btn btn-secondary btn-sm" onclick="window.HospitalFlow.sendDonorWave('${r.id}')">
                          <i class="fas fa-bullhorn"></i> Donor Coordination
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
// 5. DONOR COORDINATION TAB
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
// ASSIGN EMERGENCY DOCTOR MODAL (Requirements 3, 4, 8)
// ============================================
window._showAssignEmergencyDoctorModal = (caseId) => {
  const s = appState.get();
  const emCase = s.emergencyCases.find(c => c.id === caseId || c.caseId === caseId);
  if (!emCase) return;

  const rankedDoctors = FlowEngine.getRecommendedDoctorsForEmergency(emCase);
  const recommended = rankedDoctors[0];

  let selectedDocId = recommended?.doctorId || s.doctors[0]?.id;
  let currentStrategy = 'ASSIGN_NEXT';

  const modalRoot = document.getElementById('emergency-modal-root') || document.body;

  function renderModal() {
    const selectedDoc = s.doctors.find(d => d.id === selectedDocId);
    const isSelectedDocConsulting = selectedDoc?.status === 'Consulting';

    modalRoot.innerHTML = `
      <div class="modal-backdrop active">
        <div class="modal active" style="max-width: 680px; max-height: 90vh; overflow-y: auto">
          <div class="modal-header" style="border-bottom: 2px solid var(--critical-border)">
            <div>
              <h3 class="modal-title" style="color: var(--critical)"><i class="fas fa-user-md"></i> Assign Emergency Doctor</h3>
              <div class="card-subtitle">Intelligent physician matching based on department, clinical load & throughput</div>
            </div>
            <button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
          </div>

          <div class="modal-body">
            <!-- Case Summary Header -->
            <div class="card-inner-box" style="background: #FFF5F5; border-left: 4px solid var(--critical); margin-bottom: var(--space-4)">
              <div class="flex justify-between items-start">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="badge badge-danger">${emCase.priority || 'P1 - Critical Emergency'}</span>
                    <h4 style="margin: 0">${escapeHtml(emCase.patientName)}</h4>
                    <span style="font-size: var(--font-size-xs); color: var(--text-secondary)">(${emCase.caseId})</span>
                  </div>
                  <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-top: 4px">
                    Symptoms: <strong>"${escapeHtml(emCase.symptoms || 'Acute Respiratory Distress')}"</strong><br>
                    Transport: <strong>${escapeHtml(emCase.transportMode || 'Private Vehicle')}</strong> · ETA: <strong>${emCase.etaMinutes ? `${emCase.etaMinutes} min` : 'In Hospital'}</strong>
                  </div>
                </div>
              </div>
            </div>

            <!-- Top Recommended Doctor Hero Box (Requirement 4) -->
            ${recommended ? `
              <div class="card-inner-box" style="background: #F0FDF4; border: 2px solid #86EFAC; margin-bottom: var(--space-4)">
                <div class="flex justify-between items-center" style="margin-bottom: 6px">
                  <div class="flex items-center gap-2">
                    <span class="badge badge-success"><i class="fas fa-star"></i> Recommended Doctor</span>
                    <strong style="font-size: var(--font-size-md); color: #14532D">${escapeHtml(recommended.displayName)}</strong>
                  </div>
                  <span class="badge ${recommended.status === 'Available' ? 'badge-success' : 'badge-warning'}">${recommended.status}</span>
                </div>

                <div class="flex gap-4" style="font-size: var(--font-size-xs); color: #166534; margin-bottom: 8px">
                  <span>Department: <strong>${recommended.department}</strong></span>
                  <span>Queue: <strong>${recommended.queueLoad} waiting</strong></span>
                  <span>Operational Load: <strong>${recommended.loadPercentage}%</strong></span>
                </div>

                <div style="font-size: var(--font-size-xs); background: white; padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(22, 163, 74, 0.2)">
                  <strong style="color: #14532D">Why ${escapeHtml(recommended.displayName.split(' ')[1] || recommended.displayName)}?</strong>
                  <ul style="margin: 4px 0 0; padding-left: 18px; color: var(--text-secondary); line-height: 1.5">
                    ${recommended.reasons.map(r => `<li>${r}</li>`).join('')}
                    <li>Estimated minimum disruption to routine OPD schedule</li>
                  </ul>
                </div>
              </div>
            ` : ''}

            <!-- Ranked Physicians List (Requirement 3) -->
            <div class="form-group">
              <label class="form-label" style="font-weight: 700">Select Doctor from Hospital Staff:</label>
              <div class="flex flex-col gap-2" style="max-height: 220px; overflow-y: auto; padding-right: 4px">
                ${rankedDoctors.map(rd => `
                  <label class="card-inner-box flex items-center justify-between" style="margin: 0; cursor: pointer; border: 1px solid ${selectedDocId === rd.doctorId ? 'var(--primary)' : 'var(--border)'}; background: ${selectedDocId === rd.doctorId ? '#EFF6FF' : 'white'}">
                    <div class="flex items-center gap-3">
                      <input type="radio" name="em-doc-radio" value="${rd.doctorId}" ${selectedDocId === rd.doctorId ? 'checked' : ''} onchange="window._updateSelectedEmDoc('${rd.doctorId}')">
                      <div>
                        <strong>${escapeHtml(rd.displayName)}</strong>
                        <div style="font-size: 11px; color: var(--text-secondary)">
                          ${escapeHtml(rd.department)} · ${escapeHtml(rd.specialty)}
                        </div>
                      </div>
                    </div>

                    <div class="flex items-center gap-3" style="font-size: 11px">
                      <span class="badge ${rd.status === 'Available' ? 'badge-success' : rd.status === 'Consulting' ? 'badge-warning' : 'badge-danger'}">
                        ${rd.status}
                      </span>
                      <span>Queue: <strong>${rd.queueLoad}</strong></span>
                      <span>Load: <strong>${rd.loadPercentage}%</strong></span>
                    </div>
                  </label>
                `).join('')}
              </div>
            </div>

            <!-- Active Consultation Diversion Warning (Requirement 8) -->
            ${isSelectedDocConsulting ? `
              <div class="card-inner-box" style="background: #FFFBEB; border: 1px solid #FCD34D; margin-top: var(--space-4)">
                <div class="flex items-center gap-2" style="color: #92400E; font-weight: 700; margin-bottom: 4px">
                  <i class="fas fa-exclamation-triangle"></i> Doctor currently consulting active OPD patient
                </div>
                <p style="font-size: var(--font-size-xs); color: #78350F; margin: 0 0 8px">
                  Select handling strategy for Dr. ${escapeHtml(selectedDoc?.displayName)}:
                </p>
                <div class="flex flex-col gap-2" style="font-size: var(--font-size-xs)">
                  <label class="flex items-center gap-2" style="cursor: pointer">
                    <input type="radio" name="consult-strategy" value="ASSIGN_NEXT" ${currentStrategy === 'ASSIGN_NEXT' ? 'checked' : ''} onchange="window._updateEmStrategy('ASSIGN_NEXT')">
                    <span><strong>Assign Emergency Next:</strong> Let doctor complete current patient, insert emergency at Position #1 in queue.</span>
                  </label>
                  <label class="flex items-center gap-2" style="cursor: pointer">
                    <input type="radio" name="consult-strategy" value="DIVERSION" ${currentStrategy === 'DIVERSION' ? 'checked' : ''} onchange="window._updateEmStrategy('DIVERSION')">
                    <span><strong>Authorized Emergency Diversion:</strong> Immediately prioritize trauma bay and pause routine consultation.</span>
                  </label>
                </div>
              </div>
            ` : ''}
          </div>

          <div class="modal-footer flex justify-between items-center">
            <button class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
            <button class="btn btn-danger" id="btn-confirm-emergency-assignment" style="padding: 10px 20px; font-weight: 700">
              <i class="fas fa-check-circle"></i> Confirm Assignment
            </button>
          </div>
        </div>
      </div>
    `;

    modalRoot.querySelector('#btn-confirm-emergency-assignment')?.addEventListener('click', () => {
      try {
        FlowEngine.assignEmergencyDoctor(emCase.caseId || emCase.id, selectedDocId, {
          strategy: currentStrategy,
          assignedBy: Auth.getCurrentUser()?.displayName || 'Admin Command'
        });
        modalRoot.innerHTML = '';
        alert(`Emergency Case assigned to Dr. ${s.doctors.find(d => d.id === selectedDocId)?.displayName}. Priority queue and doctor workstation updated in real time.`);
        renderEmergencyCommandTab(document.getElementById('emergency-tab-content'));
      } catch (err) {
        alert(`Assignment failed: ${err.message}`);
      }
    });
  }

  window._updateSelectedEmDoc = (docId) => {
    selectedDocId = docId;
    renderModal();
  };

  window._updateEmStrategy = (strat) => {
    currentStrategy = strat;
  };

  renderModal();
};

window._handleInsufficientBlood = (requestId) => {
  appState.updateItem('bloodRequests', requestId, {
    status: 'Searching External Source'
  });
  eventBus.emit(EventTypes.EXTERNAL_BLOOD_SOURCE_REQUESTED, {
    requestId
  }, { source: 'admin' });
  alert(`Status updated to "Searching External Source". External blood bank sourcing & donor waves initialized.`);
  renderRequestsTab(document.getElementById('emergency-tab-content'));
};

window._advanceBloodStatus = (requestId, newStatus) => {
  appState.updateItem('bloodRequests', requestId, { status: newStatus });
  if (newStatus === 'BLOOD_BANK_CONFIRMED') {
    eventBus.emit(EventTypes.BLOOD_CONFIRMED_BY_BANK, { requestId }, { source: 'blood-bank' });
  }
  renderRequestsTab(document.getElementById('emergency-tab-content'));
};

window._showNewEmergencyIntakeModal = () => {
  const modalRoot = document.getElementById('emergency-modal-root') || document.body;
  modalRoot.innerHTML = `
    <div class="modal-backdrop active">
      <div class="modal active" style="max-width: 520px">
        <div class="modal-header">
          <h3 class="modal-title" style="color: var(--critical)"><i class="fas fa-ambulance"></i> Register Emergency Case</h3>
          <button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <form id="manual-emergency-form">
            <div class="form-group">
              <label class="form-label">Patient Name <span class="required">*</span></label>
              <input type="text" id="em-pat-name" class="form-input" placeholder="e.g. Rajesh Khurana" required>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Priority Level <span class="required">*</span></label>
                <select id="em-pat-priority" class="form-select">
                  <option value="P1 - Critical Emergency">P1 — CRITICAL (Life Threatening)</option>
                  <option value="P2 - Urgent">P2 — URGENT (Severe Condition)</option>
                  <option value="P3 - Priority">P3 — PRIORITY (Moderate Injury)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Department <span class="required">*</span></label>
                <select id="em-pat-dept" class="form-select">
                  ${Config.DEPARTMENTS.map(d => `<option value="${d}">${d}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Reported Symptoms <span class="required">*</span></label>
              <textarea id="em-pat-symptoms" class="form-textarea" rows="2" placeholder="e.g. Severe chest compression and breathing distress" required></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Transport Mode</label>
              <select id="em-pat-transport" class="form-select">
                <option value="Private Vehicle">Private Vehicle</option>
                <option value="Ambulance (AMB-01)">Ambulance (AMB-01)</option>
                <option value="Walk-in Triage">Walk-in Triage</option>
              </select>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
          <button class="btn btn-danger" id="btn-submit-manual-emergency"><i class="fas fa-check"></i> Create Emergency Case</button>
        </div>
      </div>
    </div>
  `;

  modalRoot.querySelector('#btn-submit-manual-emergency')?.addEventListener('click', () => {
    const name = modalRoot.querySelector('#em-pat-name').value.trim();
    const priority = modalRoot.querySelector('#em-pat-priority').value;
    const dept = modalRoot.querySelector('#em-pat-dept').value;
    const symptoms = modalRoot.querySelector('#em-pat-symptoms').value.trim();
    const transport = modalRoot.querySelector('#em-pat-transport').value;

    if (!name || !symptoms) {
      alert('Please enter patient name and symptoms.');
      return;
    }

    FlowEngine.createPreArrivalEmergency({
      patientName: name,
      department: dept,
      symptoms,
      transportMode: transport,
      priority,
      severity: priority.includes('P1') ? 'Critical' : 'Urgent',
      etaMinutes: 0
    });

    modalRoot.innerHTML = '';
    renderEmergencyCommandTab(document.getElementById('emergency-tab-content'));
  });
};

window._showNewBloodRequestModal = () => {
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
      patientId: 'P-1084',
      bloodGroup: bg,
      units,
      urgency,
      department: 'Emergency & Trauma'
    });

    modalRoot.innerHTML = '';
    alert(`Emergency blood request created for ${units} units of ${bg}.`);
    renderRequestsTab(document.getElementById('emergency-tab-content'));
  });
};
