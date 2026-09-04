// ============================================
// HospitalFlow AI — Flow Intelligence Page
// Scenario Presets + Universal "Why?" Drawer + Data Confidence + Flow Recovery
// ============================================

import appState from '../state.js';
import Config from '../config.js';
import Auth from '../auth.js';
import FlowEngine from '../engines/flow-engine.js';
import PredictionEngine from '../engines/prediction-engine.js';
import impactEngine from '../engines/emergency-impact-engine.js';
import { escapeHtml, formatMinutes, formatTime, timeAgo } from '../utils.js';

let currentTab = 'intelligence';
let activeSimulationScenario = null;
let simulatedResults = null;

export default function renderFlowPage(container) {
  const s = appState.get();

  container.innerHTML = `
    <div class="flow-page-layout animate-fade-in">
      <div class="page-header flex justify-between items-center" style="margin-bottom: var(--space-5)">
        <div>
          <h2><i class="fas fa-project-diagram" style="color: var(--primary); margin-right: var(--space-2)"></i>Flow Intelligence</h2>
          <p>Real-time hospital capacity, queue prediction and closed-loop emergency recovery</p>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-secondary btn-sm" onclick="window._showUniversalWhyDrawer('emergency_redistribution')">
            <i class="fas fa-question-circle"></i> Why HospitalFlow AI Acted?
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="page-tabs" id="flow-tabs" style="margin-bottom: var(--space-6)">
        <button class="page-tab ${currentTab === 'intelligence' ? 'active' : ''}" data-tab="intelligence">
          <i class="fas fa-tachometer-alt"></i> Capacity & Department Flow
        </button>
        <button class="page-tab ${currentTab === 'recovery' ? 'active' : ''}" data-tab="recovery">
          <i class="fas fa-heartbeat"></i> Emergency Impact & Flow Recovery
        </button>
        <button class="page-tab ${currentTab === 'simulator' ? 'active' : ''}" data-tab="simulator">
          <i class="fas fa-brain"></i> What-If Scenario Presets
        </button>
      </div>

      <div id="flow-tab-content"></div>
      <div id="flow-modal-root"></div>
    </div>
  `;

  container.querySelectorAll('.page-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentTab = tab.dataset.tab;
      container.querySelectorAll('.page-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === currentTab));
      renderFlowTabContent(container.querySelector('#flow-tab-content'));
    });
  });

  renderFlowTabContent(container.querySelector('#flow-tab-content'));
}

function renderFlowTabContent(el) {
  if (!el) return;
  switch (currentTab) {
    case 'intelligence': renderCapacityTab(el); break;
    case 'recovery': renderRecoveryTab(el); break;
    case 'simulator': renderSimulatorTab(el); break;
    default: renderCapacityTab(el); break;
  }
}

// ============================================
// 1. CAPACITY & DEPARTMENT FLOW TAB
// ============================================
function renderCapacityTab(el) {
  const s = appState.get();
  const deptLoads = appState.getDepartmentLoads();
  const analytics = s.dashboardAnalytics;
  const activeEmergencies = (s.emergencyCases || []).filter(c => c.status !== 'COMPLETED').length;
  const availableDocs = s.doctors.filter(d => d.status === 'Available').length;
  const waitingCount = s.queueEntries.filter(q => q.status === 'Waiting').length;

  el.innerHTML = `
    <!-- 4 Primary Flow KPIs with Data Confidence -->
    <div class="grid-4" style="margin-bottom: var(--space-6)">
      <div class="metric-card">
        <div class="kpi-icon orange"><i class="fas fa-clock"></i></div>
        <div class="kpi-content">
          <div class="kpi-label">Average OPD Wait</div>
          <div class="kpi-value">${analytics.avgOPDWait} <span style="font-size: 14px; font-weight: normal; color: var(--text-secondary)">min</span></div>
          <div class="kpi-meta flex items-center gap-1">
            <span>Confidence:</span>
            <span class="badge badge-success" style="font-size: 10px; padding: 1px 6px">HIGH</span>
          </div>
        </div>
      </div>

      <div class="metric-card">
        <div class="kpi-icon blue"><i class="fas fa-list-ol"></i></div>
        <div class="kpi-content">
          <div class="kpi-label">Active Waiting Queue</div>
          <div class="kpi-value">${waitingCount}</div>
          <div class="kpi-meta">6 hospital departments</div>
        </div>
      </div>

      <div class="metric-card">
        <div class="kpi-icon teal"><i class="fas fa-user-md"></i></div>
        <div class="kpi-content">
          <div class="kpi-label">Physicians Available</div>
          <div class="kpi-value">${availableDocs} <span style="font-size: 14px; font-weight: normal; color: var(--text-secondary)">/ ${s.doctors.length}</span></div>
          <div class="kpi-meta">Active clinical capacity</div>
        </div>
      </div>

      <div class="metric-card">
        <div class="kpi-icon ${activeEmergencies > 0 ? 'red' : 'green'}">
          <i class="fas ${activeEmergencies > 0 ? 'fa-ambulance' : 'fa-check'}"></i>
        </div>
        <div class="kpi-content">
          <div class="kpi-label">Emergency Diversion</div>
          <div class="kpi-value">${activeEmergencies > 0 ? `${activeEmergencies} Active` : 'Normal'}</div>
          <div class="kpi-meta">${activeEmergencies > 0 ? 'Diverted to trauma bay' : 'No active diversion'}</div>
        </div>
      </div>
    </div>

    <!-- Department Flow Cards Grid -->
    <div class="grid-3" style="margin-bottom: var(--space-6)">
      ${deptLoads.map(d => {
        const capacityPct = Math.min(100, Math.round((d.waiting / Math.max(1, d.totalDoctors * 3)) * 100));
        const statusClass = capacityPct > 75 ? 'badge-danger' : capacityPct > 50 ? 'badge-warning' : 'badge-success';
        const statusLabel = capacityPct > 75 ? 'Critical Load' : capacityPct > 50 ? 'Moderate' : 'Optimal';

        return `
          <div class="dept-flow-card">
            <div class="dept-flow-header">
              <div>
                <h4 style="margin: 0; font-size: var(--font-size-md)">${escapeHtml(d.department)}</h4>
                <div style="font-size: var(--font-size-xs); color: var(--text-secondary)">${d.availableDoctors} of ${d.totalDoctors} doctors consulting</div>
              </div>
              <span class="badge ${statusClass}">${statusLabel}</span>
            </div>

            <div style="margin: var(--space-4) 0">
              <div class="flex justify-between" style="font-size: var(--font-size-xs); margin-bottom: 4px">
                <span style="color: var(--text-secondary)">Capacity Utilization:</span>
                <strong>${capacityPct}%</strong>
              </div>
              <div class="progress-bar-track">
                <div class="progress-bar-fill ${capacityPct > 75 ? 'red' : capacityPct > 50 ? 'orange' : 'blue'}" style="width: ${capacityPct}%"></div>
              </div>
            </div>

            <div class="dept-flow-metrics">
              <span>Waiting: <strong>${d.waiting} patients</strong></span>
              <span>Avg Wait: <strong>~${d.avgWait} min</strong></span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ============================================
// 2. EMERGENCY IMPACT & FLOW RECOVERY TAB
// ============================================
// 2. EMERGENCY IMPACT & FLOW RECOVERY TAB
// ============================================
function renderRecoveryTab(el) {
  const s = appState.get();
  const impactSummary = impactEngine.getImpactSummary();
  const recState = s.flowRecoveryState?.['General Medicine'] || s.flowRecoveryState || {
    status: 'NORMALIZED',
    recoveryPercentage: 94,
    baselineWait: 18,
    peakWait: 31,
    currentWait: 20
  };
  const isInterventionApplied = s.lastInterventionApplied || recState.status === 'RECOVERING';
  const recommendations = impactEngine.getRecommendations();

  el.innerHTML = `
    <!-- Flow Recovery Showcase Card (Requirement 6 & 24) -->
    <div class="flow-recovery-card" style="margin-bottom: var(--space-6)">
      <div class="flex justify-between items-center">
        <div>
          <h3 style="margin: 0; font-size: var(--font-size-lg); color: #14532D">
            <i class="fas fa-heartbeat"></i> Flow Recovery Intelligence
          </h3>
          <div style="font-size: var(--font-size-xs); color: #15803D">
            Closed-loop department recovery status following emergency resolution & load balancing
          </div>
        </div>
        <span class="badge ${recState.status === 'NORMALIZED' ? 'badge-success' : recState.status === 'RECOVERING' ? 'badge-info' : 'badge-danger'}">
          ${recState.status === 'NORMALIZED' ? 'Recovery: 94% · Normalized' : recState.status === 'RECOVERING' ? 'Recovery: 88% · Recovering' : 'Emergency Active'}
        </span>
      </div>

      <div class="flow-recovery-bar">
        <div class="flow-recovery-bar-fill" style="width: ${recState.recoveryPercentage || (isInterventionApplied ? 88 : 45)}%"></div>
      </div>

      <div class="grid-3" style="margin-top: var(--space-3); font-size: var(--font-size-xs)">
        <div>Baseline Wait: <strong>${recState.baselineWait || 18} min</strong></div>
        <div>Emergency Peak: <strong style="color: var(--critical)">${recState.peakWait || 31} min</strong></div>
        <div>Current Recovered Wait: <strong style="color: var(--success)">${recState.currentWait || (isInterventionApplied ? 23 : 31)} min</strong></div>
      </div>
    </div>

    <!-- Intervention Result Box (Displays after applying recommendation) -->
    ${isInterventionApplied ? `
      <div class="card animate-fade-in" style="background: #F0FDF4; border: 2px solid #86EFAC; margin-bottom: var(--space-6)">
        <div class="flex justify-between items-center" style="margin-bottom: var(--space-3)">
          <div class="flex items-center gap-2">
            <i class="fas fa-check-circle" style="color: var(--success); font-size: 20px"></i>
            <div>
              <h4 style="margin: 0; font-size: var(--font-size-md); color: #14532D">Load Balancing Intervention Active</h4>
              <div style="font-size: var(--font-size-xs); color: #15803D">3 routine patients successfully redistributed from Dr. Aarav Sharma to Dr. Sunita Mehta</div>
            </div>
          </div>
          <span class="badge badge-success">✓ Applied & Active</span>
        </div>

        <div class="grid-4" style="gap: var(--space-3); font-size: var(--font-size-xs)">
          <div class="card-inner-box" style="background: white; margin: 0">
            <div style="color: var(--text-secondary); text-transform: uppercase; font-size: 10px">Wait Time Reduction</div>
            <div style="font-size: 20px; font-weight: 800; color: var(--success)">31 min → 23 min</div>
            <div style="color: var(--text-secondary); font-size: 11px">8 min delay avoided</div>
          </div>
          <div class="card-inner-box" style="background: white; margin: 0">
            <div style="color: var(--text-secondary); text-transform: uppercase; font-size: 10px">Redistributed Patients</div>
            <div style="font-size: 20px; font-weight: 800; color: var(--primary)">3 Patients</div>
            <div style="color: var(--text-secondary); font-size: 11px">To Dr. Sunita Mehta</div>
          </div>
          <div class="card-inner-box" style="background: white; margin: 0">
            <div style="color: var(--text-secondary); text-transform: uppercase; font-size: 10px">Notifications Dispatched</div>
            <div style="font-size: 20px; font-weight: 800; color: var(--teal)">100% Privacy-Safe</div>
            <div style="color: var(--text-secondary); font-size: 11px">ETAs updated</div>
          </div>
          <div class="card-inner-box" style="background: white; margin: 0">
            <div style="color: var(--text-secondary); text-transform: uppercase; font-size: 10px">Department Recovery</div>
            <div style="font-size: 20px; font-weight: 800; color: #15803D">88% Recovered</div>
            <div style="color: var(--text-secondary); font-size: 11px">Stabilizing trend</div>
          </div>
        </div>
      </div>
    ` : ''}

    <!-- Active Emergency Impact Box (Requirement 23) -->
    <div class="card" style="border-left: 4px solid ${impactSummary.activeImpactCases > 0 ? 'var(--critical)' : 'var(--success)'}; margin-bottom: var(--space-6)">
      <div class="card-header flex justify-between items-center">
        <div>
          <h3 class="card-title"><i class="fas fa-exclamation-triangle" style="color: var(--critical)"></i> Emergency Department Impact Analysis</h3>
          <div class="card-subtitle">Real-time doctor diversion capacity calculation & delay propagation</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="window._showUniversalWhyDrawer('emergency_redistribution')">
          <i class="fas fa-question-circle"></i> Why?
        </button>
      </div>

      <div class="grid-3" style="margin: var(--space-4) 0">
        <div class="card-inner-box" style="margin: 0">
          <div style="font-size: var(--font-size-xs); color: var(--text-secondary)">Doctor Capacity Shift</div>
          <div style="font-size: 22px; font-weight: 800; color: var(--critical)">3 → 2 Active</div>
          <div style="font-size: 11px; color: var(--text-secondary)">1 Specialist diverted to Trauma</div>
        </div>
        <div class="card-inner-box" style="margin: 0">
          <div style="font-size: var(--font-size-xs); color: var(--text-secondary)">Average Wait Delta</div>
          <div style="font-size: 22px; font-weight: 800; color: var(--warning)">+13 min Projected</div>
          <div style="font-size: 11px; color: var(--text-secondary)">Dynamic ETA recalculation</div>
        </div>
        <div class="card-inner-box" style="margin: 0">
          <div style="font-size: var(--font-size-xs); color: var(--text-secondary)">Downstream Patients Affected</div>
          <div style="font-size: 22px; font-weight: 800; color: var(--primary)">${impactSummary.totalAffectedPatients || 11} Patients</div>
          <div style="font-size: 11px; color: var(--text-secondary)">100% Privacy-safe delay notified</div>
        </div>
      </div>

      <!-- Actionable Smart Recommendations -->
      <div style="margin-top: var(--space-4); border-top: 1px solid var(--border-light); padding-top: var(--space-3)">
        <h4 style="font-size: var(--font-size-sm); margin-bottom: var(--space-3)"><i class="fas fa-magic" style="color: var(--primary)"></i> Actionable Operational Recommendations</h4>
        ${recommendations.map(rec => {
          const isApplied = isInterventionApplied || rec.applied;
          return `
            <div class="card-inner-box" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2); background: ${isApplied ? '#F8FAFC' : 'white'}">
              <div>
                <strong style="font-size: var(--font-size-sm)">${escapeHtml(rec.title)}</strong>
                <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-top: 2px">${escapeHtml(rec.description)}</div>
              </div>
              <div class="flex items-center gap-2">
                <button class="btn btn-ghost btn-sm" onclick="window._showUniversalWhyDrawer('${rec.id}')">
                  <i class="fas fa-question-circle"></i> Why?
                </button>
                ${isApplied ? `
                  <button class="btn btn-secondary btn-sm" disabled style="background: #E2E8F0; color: #475569; cursor: not-allowed">
                    <i class="fas fa-check"></i> Applied
                  </button>
                ` : `
                  <button class="btn btn-primary btn-sm" onclick="window._confirmApplyRecommendation('${rec.id}')">
                    <i class="fas fa-check"></i> Apply Recommendation
                  </button>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// ============================================
// 3. WHAT-IF SCENARIO PRESETS TAB (Requirement 5)
// ============================================
function renderSimulatorTab(el) {
  const s = appState.get();

  const presets = [
    { id: 'normal', name: 'Normal OPD Baseline', desc: 'Standard operating capacity with 0 active emergencies', emergencies: 0, docsDown: 0, surge: 0 },
    { id: 'doc_down', name: 'Doctor Suddenly Unavailable', desc: '1 physician takes sudden leave; queue load shifts', emergencies: 0, docsDown: 1, surge: 4 },
    { id: 'two_emergencies', name: '2 Emergency Arrivals', desc: '2 incoming P1 trauma cases; 1 specialist diverted', emergencies: 2, docsDown: 1, surge: 8 },
    { id: 'amb_surge', name: 'Ambulance Surge', desc: '3 simultaneous inbound hospital ambulance cases', emergencies: 3, docsDown: 1, surge: 12 },
    { id: 'opd_load', name: 'High OPD Load Peak', desc: 'Surge of 15 walk-in patients during morning rush', emergencies: 0, docsDown: 0, surge: 15 },
    { id: 'severe', name: 'Severe Disruption', desc: '3 emergencies + 2 doctors unavailable simultaneously', emergencies: 3, docsDown: 2, surge: 20 }
  ];

  el.innerHTML = `
    <div class="what-if-layout animate-fade-in">
      <div style="margin-bottom: var(--space-4)">
        <h3 style="font-size: var(--font-size-md); margin-bottom: 4px"><i class="fas fa-brain" style="color: var(--primary)"></i> One-Click Simulation Presets</h3>
        <p style="font-size: var(--font-size-xs); color: var(--text-secondary)">Select a pre-configured hospital stress scenario or adjust custom variables below.</p>
      </div>

      <!-- Preset Cards Grid (Requirement 5) -->
      <div class="grid-3" style="gap: var(--space-3); margin-bottom: var(--space-6)">
        ${presets.map(p => `
          <div class="card scenario-preset-card ${activeSimulationScenario === p.id ? 'active' : ''}" style="cursor: pointer; padding: var(--space-4); border: 1px solid ${activeSimulationScenario === p.id ? 'var(--primary)' : 'var(--border)'}" onclick="window._runScenarioPreset('${p.id}')">
            <div class="flex justify-between items-center" style="margin-bottom: 4px">
              <strong style="font-size: var(--font-size-sm)">${p.name}</strong>
              <span class="badge ${p.emergencies > 0 ? 'badge-danger' : 'badge-neutral'}">${p.emergencies > 0 ? `+${p.emergencies} ER` : 'Routine'}</span>
            </div>
            <div style="font-size: var(--font-size-xs); color: var(--text-secondary); line-height: 1.4">${p.desc}</div>
          </div>
        `).join('')}
      </div>

      <!-- Side-by-Side Current vs Simulated Result View -->
      ${simulatedResults ? `
        <div class="card animate-scale-in" style="margin-bottom: var(--space-6); background: #F8FAFC; border: 2px solid var(--primary-border)">
          <div class="card-header flex justify-between items-center" style="border-bottom: 1px solid var(--border)">
            <div>
              <h4 style="margin: 0; font-size: var(--font-size-md); color: var(--text-primary)"><i class="fas fa-chart-bar" style="color: var(--primary)"></i> Simulation Projected Impact: ${escapeHtml(simulatedResults.name)}</h4>
              <div style="font-size: var(--font-size-xs); color: var(--text-secondary)">Side-by-side comparison with live hospital state</div>
            </div>
            <div class="flex gap-2">
              <button class="btn btn-secondary btn-sm" onclick="window._resetSimulation()"><i class="fas fa-undo"></i> Reset Simulation</button>
              <button class="btn btn-primary btn-sm" onclick="window._applySimulatedResponse()"><i class="fas fa-check"></i> Apply Recommended Response</button>
            </div>
          </div>

          <div class="grid-4" style="gap: var(--space-4); padding: var(--space-4) 0">
            <div class="card-inner-box" style="background: white">
              <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase">Average Wait Time</div>
              <div style="font-size: 22px; font-weight: 800; color: ${simulatedResults.waitDelta > 0 ? 'var(--critical)' : 'var(--success)'}">
                18m → ${simulatedResults.projectedWait}m
              </div>
              <div style="font-size: 11px; color: var(--text-secondary)">${simulatedResults.waitDelta > 0 ? `+${simulatedResults.waitDelta} min surge` : 'Stable baseline'}</div>
            </div>

            <div class="card-inner-box" style="background: white">
              <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase">Doctors Available</div>
              <div style="font-size: 22px; font-weight: 800; color: ${simulatedResults.docsAvailable < 3 ? 'var(--warning)' : 'var(--teal)'}">
                3 → ${simulatedResults.docsAvailable}
              </div>
              <div style="font-size: 11px; color: var(--text-secondary)">Physicians consulting</div>
            </div>

            <div class="card-inner-box" style="background: white">
              <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase">Affected Patients</div>
              <div style="font-size: 22px; font-weight: 800; color: var(--primary)">${simulatedResults.affectedPatients} Patients</div>
              <div style="font-size: 11px; color: var(--text-secondary)">Delay notification required</div>
            </div>

            <div class="card-inner-box" style="background: white">
              <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase">Department State</div>
              <div style="font-size: 18px; font-weight: 800; color: ${simulatedResults.status === 'Critical' ? 'var(--critical)' : 'var(--success)'}; margin-top: 4px">
                ${simulatedResults.status}
              </div>
              <div style="font-size: 11px; color: var(--text-secondary)">Operational capacity</div>
            </div>
          </div>

          <div style="background: white; padding: var(--space-3) var(--space-4); border-radius: var(--radius-lg); border: 1px solid var(--border); margin-top: var(--space-2)">
            <strong style="font-size: var(--font-size-xs); color: var(--text-primary)"><i class="fas fa-magic" style="color: var(--primary)"></i> System Recommended Response:</strong>
            <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-top: 2px">
              ${simulatedResults.recommendation}
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  window._runScenarioPreset = (presetId) => {
    activeSimulationScenario = presetId;
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;

    const baseWait = 18;
    const waitDelta = preset.emergencies * 6 + preset.docsDown * 8 + Math.round(preset.surge * 0.8);
    const projectedWait = baseWait + waitDelta;
    const docsAvailable = Math.max(1, 3 - preset.docsDown - (preset.emergencies > 0 ? 1 : 0));
    const affectedPatients = preset.emergencies * 4 + preset.surge + 2;

    simulatedResults = {
      name: preset.name,
      projectedWait,
      waitDelta,
      docsAvailable,
      affectedPatients,
      status: waitDelta > 10 ? 'Critical' : waitDelta > 5 ? 'Moderate' : 'Optimal',
      recommendation: preset.emergencies > 0 ?
        `Redistribute ${Math.min(5, Math.ceil(affectedPatients / 3))} eligible routine patients to Dr. Sunita Mehta and notify ${affectedPatients} waiting patients of updated ETAs.` :
        preset.docsDown > 0 ?
        'Activate backup on-call physician for General Medicine and offer alternate appointment slots.' :
        'Department is operating within normal baseline limits. No load balancing intervention required.'
    };

    renderSimulatorTab(el);
  };

  window._resetSimulation = () => {
    activeSimulationScenario = null;
    simulatedResults = null;
    renderSimulatorTab(el);
  };

  window._applySimulatedResponse = () => {
    if (!simulatedResults) return;
    alert(`Response applied: ${simulatedResults.recommendation}\nLive operational queue recalculated.`);
    simulatedResults = null;
    currentTab = 'recovery';
    renderFlowTabContent(el);
  };
}

// ============================================
// CONFIRMATION MODAL FOR APPLYING RECOMMENDATION
// ============================================
window._confirmApplyRecommendation = (recId) => {
  const modalRoot = document.getElementById('flow-modal-root') || document.body;
  modalRoot.innerHTML = `
    <div class="modal-backdrop active">
      <div class="modal active" style="max-width: 500px">
        <div class="modal-header">
          <h3 class="modal-title" style="color: var(--primary)"><i class="fas fa-random"></i> Authorize Patient Redistribution</h3>
          <button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <p style="font-size: var(--font-size-sm); color: var(--text-primary); margin-bottom: var(--space-3)">
            Are you sure you want to execute this load-balancing intervention?
          </p>
          <div class="card-inner-box" style="background: var(--bg-subtle); margin-bottom: var(--space-3); font-size: var(--font-size-xs)">
            <div>• <strong>3 eligible routine waiting patients</strong> will be transferred from Dr. Aarav Sharma to Dr. Sunita Mehta.</div>
            <div style="margin-top: 4px">• Emergency patients (P1/P2) and patients already in consultation are protected and will <strong>not</strong> be moved.</div>
            <div style="margin-top: 4px">• Expected department wait time improves from <strong>31 min → 23 min</strong> (saving ~8 min per patient).</div>
            <div style="margin-top: 4px">• Privacy-safe delay notices will be automatically dispatched to affected patients.</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
          <button class="btn btn-primary" id="btn-confirm-apply-rec">
            <i class="fas fa-check"></i> Confirm & Execute Redistribution
          </button>
        </div>
      </div>
    </div>
  `;

  modalRoot.querySelector('#btn-confirm-apply-rec')?.addEventListener('click', () => {
    modalRoot.innerHTML = '';
    impactEngine.applyRecommendation(recId);
    // Re-render current recovery tab
    const tabContent = document.getElementById('flow-tab-content');
    if (tabContent) renderRecoveryTab(tabContent);
  });
};

// ============================================
// DATA CONFIDENCE EXPLANATION MODAL
// ============================================
window._showDataConfidenceModal = (confidence = 'HIGH') => {
  const modalRoot = document.getElementById('flow-modal-root') || document.body;
  modalRoot.innerHTML = `
    <div class="modal-backdrop active">
      <div class="modal active" style="max-width: 480px">
        <div class="modal-header">
          <h3 class="modal-title"><i class="fas fa-chart-line" style="color: var(--primary)"></i> Predictive Model Confidence: ${confidence}</h3>
          <button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="card-inner-box" style="background: var(--bg-subtle); font-size: var(--font-size-xs)">
            <div style="font-weight: 700; margin-bottom: 4px">Operational Input Factors Used:</div>
            <div>• Historical consultation velocity (Dr. Sharma: 9.8m avg, Dr. Mehta: 10.2m avg)</div>
            <div>• Active real-time waiting token queue depth</div>
            <div>• Dynamic emergency trauma diversion subtraction</div>
            <div>• No-show probability weighting (historical 4.2%)</div>
          </div>
          <div style="font-size: 11px; color: var(--text-secondary); margin-top: var(--space-3); line-height: 1.4">
            <i class="fas fa-info-circle"></i> <strong>Disclaimer:</strong> Predictions represent operational queue estimations for administrative resource balancing and do not constitute clinical prognostications.
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" onclick="this.closest('.modal-backdrop').remove()">Understood</button>
        </div>
      </div>
    </div>
  `;
};

// ============================================
// UNIVERSAL "WHY HOSPITALFLOW AI ACTED?" DRAWER (Requirement 7 & Addition 5)
// ============================================
window._showUniversalWhyDrawer = (topic = 'emergency_redistribution') => {
  const s = appState.get();
  const isApplied = s.lastInterventionApplied;
  const modalRoot = document.getElementById('flow-modal-root') || document.body;

  modalRoot.innerHTML = `
    <div class="modal-backdrop active">
      <div class="drawer active animate-slide-in-right" style="max-width: 580px">
        <div class="drawer-header">
          <div class="flex items-center gap-2">
            <i class="fas fa-question-circle" style="color: var(--primary); font-size: 22px"></i>
            <div>
              <h3 class="drawer-title">Why HospitalFlow AI Acted?</h3>
              <div style="font-size: 11px; color: var(--text-secondary)">Explainable AI Decision-Support & Closed-Loop Lineage</div>
            </div>
          </div>
          <button class="drawer-close" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
        </div>

        <div class="drawer-body" style="padding-bottom: var(--space-6)">
          <!-- 1. Detected Event -->
          <div class="why-factor-card" style="margin-bottom: var(--space-3)">
            <div class="why-step-badge">1. DETECTED EVENT</div>
            <h4 style="margin: 4px 0">P1 Emergency Arrival (Inbound Ambulance AMB-03)</h4>
            <p style="font-size: var(--font-size-xs); color: var(--text-secondary)">
              Incoming trauma patient (Rahul Verma) with acute respiratory distress and severe blood loss required immediate emergency bay triage.
            </p>
          </div>

          <!-- 2. Operational Impact -->
          <div class="why-factor-card" style="margin-bottom: var(--space-3)">
            <div class="why-step-badge">2. OPERATIONAL IMPACT</div>
            <h4 style="margin: 4px 0">Specialist Diverted · Department Capacity Reduced</h4>
            <p style="font-size: var(--font-size-xs); color: var(--text-secondary)">
              Dr. Aarav Sharma reassigned to Trauma Bay 1. General Medicine active physicians reduced from 3 to 2 (-33% operational capacity).
            </p>
          </div>

          <!-- 3. Prediction Engine -->
          <div class="why-factor-card" style="margin-bottom: var(--space-3)">
            <div class="why-step-badge">3. PREDICTION ENGINE</div>
            <h4 style="margin: 4px 0">Average OPD Wait Surge: 18 min → 31 min (+13 min)</h4>
            <p style="font-size: var(--font-size-xs); color: var(--text-secondary)">
              Dynamic queue simulation calculated that remaining 11 waiting patients under Dr. Sharma would experience severe delay cascading.
            </p>
          </div>

          <!-- 4. AI Recommendation -->
          <div class="why-factor-card" style="margin-bottom: var(--space-3)">
            <div class="why-step-badge">4. AI RECOMMENDATION</div>
            <h4 style="margin: 4px 0">Redistribute 3 Routine Patients to Dr. Sunita Mehta</h4>
            <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin-top: 4px">
              <strong>Clinical & Operational Rationale:</strong><br>
              • Same General Medicine clinical department<br>
              • Dr. Mehta's queue load is light (1 waiting patient vs Dr. Sharma's 5)<br>
              • Preserves clinical safety by selecting only routine triage tokens
            </div>
          </div>

          <!-- 5. Expected Result -->
          <div class="why-factor-card" style="margin-bottom: var(--space-3)">
            <div class="why-step-badge">5. EXPECTED RESULT</div>
            <h4 style="margin: 4px 0">Wait Time Reduction: 31 min → 23 min (8 min saved)</h4>
            <p style="font-size: var(--font-size-xs); color: var(--text-secondary)">
              Mitigates 61% of the emergency-induced bottleneck and stabilizes downstream patient throughput.
            </p>
          </div>

          <!-- 6. Human In The Loop Decision -->
          <div class="why-factor-card" style="margin-bottom: var(--space-3)">
            <div class="why-step-badge">6. HUMAN-IN-THE-LOOP AUTHORIZATION</div>
            <h4 style="margin: 4px 0">Admin Decision: ${isApplied ? 'Approved & Executed' : 'Awaiting Operational Authorization'}</h4>
            <p style="font-size: var(--font-size-xs); color: var(--text-secondary)">
              System requires explicit hospital staff confirmation before reallocating patient tokens or altering doctor rosters.
            </p>
          </div>

          <!-- 7. Actual Result -->
          <div class="why-factor-card" style="margin-bottom: var(--space-3); background: #F0FDF4; border-color: #BBF7D0">
            <div class="why-step-badge" style="background: var(--success); color: white">7. ACTUAL POST-INTERVENTION RESULT</div>
            <h4 style="margin: 4px 0; color: #14532D">${isApplied ? 'Recovered OPD Wait: 23 min · 3 Patients Moved' : 'Projected Recovered Wait: 23 min'}</h4>
            <p style="font-size: var(--font-size-xs); color: #15803D">
              Patients transferred seamlessly in the database; automated privacy-safe delay notifications delivered.
            </p>
          </div>

          <!-- 8. Current Flow Recovery State -->
          <div class="why-factor-card" style="background: #F8FAFC; border-color: var(--border)">
            <div class="why-step-badge" style="background: var(--primary); color: white">8. CURRENT FLOW RECOVERY STATE</div>
            <h4 style="margin: 4px 0">${isApplied ? 'Status: RECOVERING (88% Index)' : 'Status: NORMALIZED (94% Index)'}</h4>
            <p style="font-size: var(--font-size-xs); color: var(--text-secondary)">
              Department capacity is dynamically monitoring consultation completion velocities until full baseline return.
            </p>
          </div>
        </div>

        <div class="drawer-footer">
          <button class="btn btn-primary" style="width: 100%" onclick="this.closest('.modal-backdrop').remove()">Close Explanation</button>
        </div>
      </div>
    </div>
  `;
};

