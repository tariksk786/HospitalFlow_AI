// ============================================
// HospitalFlow AI — Live Interactive Demo Simulation (Story Mode)
// Judge-Proof Deterministic Showcase Engine
// ============================================

import appState from '../state.js';
import Config from '../config.js';
import Router from '../router.js';
import i18n, { t } from '../i18n.js';
import alertManager from '../engines/emergency-alert-manager.js';
import eventBus, { EventTypes } from '../events.js';
import { escapeHtml, formatMinutes } from '../utils.js';

export function renderDemoSimulation(container) {
  let currentStage = 1;
  let isPlaying = false;
  let speedMultiplier = 1; // 1x or 2x
  let timerId = null;
  let isPresenterMode = true;

  const totalStages = 16;
  const stages = [
    { id: 1, title: 'Patient Registration', icon: 'fa-user-plus' },
    { id: 2, title: 'Symptom Input & Normalization', icon: 'fa-notes-medical' },
    { id: 3, title: 'Intelligent Doctor Routing', icon: 'fa-route' },
    { id: 4, title: 'Appointment Booking & QR', icon: 'fa-calendar-check' },
    { id: 5, title: 'Check-In & Live Token', icon: 'fa-qrcode' },
    { id: 6, title: 'Critical Emergency Arrival', icon: 'fa-ambulance' },
    { id: 7, title: 'Ambulance Fleet Dispatch', icon: 'fa-truck-medical' },
    { id: 8, title: 'Doctor Emergency Diversion', icon: 'fa-user-shield' },
    { id: 9, title: 'Capacity Loss & ETA Impact', icon: 'fa-clock' },
    { id: 10, title: 'AI Recommendation & Redistribution', icon: 'fa-random' },
    { id: 11, title: 'FEFO Blood Bank Readiness', icon: 'fa-tint' },
    { id: 12, title: 'Emergency Resolution & Flow Recovery', icon: 'fa-heartbeat' },
    { id: 13, title: 'Patient Consultation', icon: 'fa-stethoscope' },
    { id: 14, title: 'Care Plan & Discharge', icon: 'fa-file-medical' },
    { id: 15, title: 'Multilingual Patient Experience', icon: 'fa-language' },
    { id: 16, title: 'Executive Impact Summary', icon: 'fa-award' }
  ];

  function getStageDuration(stageId) {
    const baseDurations = {
      1: 3500, 2: 3500, 3: 4000, 4: 3500, 5: 3500,
      6: 4500, 7: 4000, 8: 4000, 9: 4500, 10: 4500,
      11: 4000, 12: 4500, 13: 3500, 14: 4000, 15: 4000, 16: 6000
    };
    return (baseDurations[stageId] || 4000) / speedMultiplier;
  }

  function render() {
    container.innerHTML = `
      <div class="demo-simulation-layout animate-fade-in">
        <!-- Top Sticky Control Header -->
        <div class="demo-sim-header">
          <div class="flex items-center gap-3">
            <a href="#/admin/command" class="btn btn-ghost btn-sm"><i class="fas fa-arrow-left"></i> Exit to Command Center</a>
            <div class="demo-brand-title">
              <i class="fas fa-play-circle" style="color: var(--primary)"></i>
              <span>Live Operational Simulation · Story Mode</span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button class="btn ${isPlaying ? 'btn-warning' : 'btn-primary'} btn-sm" id="btn-play-pause">
              <i class="fas ${isPlaying ? 'fa-pause' : 'fa-play'}"></i> ${isPlaying ? 'Pause' : currentStage === 1 ? 'Start Demo' : 'Resume'}
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-restart-demo">
              <i class="fas fa-redo"></i> Restart
            </button>
            <div class="lang-toggle-capsule" style="height: 32px">
              <button class="lang-toggle-btn ${speedMultiplier === 1 ? 'active' : ''}" id="speed-1x">1×</button>
              <button class="lang-toggle-btn ${speedMultiplier === 2 ? 'active' : ''}" id="speed-2x">2×</button>
            </div>
            <button class="btn btn-ghost btn-sm" id="toggle-presenter">
              <i class="fas fa-chalkboard-teacher"></i> ${isPresenterMode ? 'Hide Judge Notes' : 'Show Judge Notes'}
            </button>
          </div>
        </div>

        <!-- 16-Stage Interactive Stepper Track -->
        <div class="demo-stepper-container">
          <div class="demo-stepper-track">
            ${stages.map(st => `
              <div class="demo-step-item ${st.id === currentStage ? 'active' : st.id < currentStage ? 'completed' : ''}" onclick="window._jumpToDemoStage(${st.id})">
                <div class="demo-step-bubble">
                  ${st.id < currentStage ? '<i class="fas fa-check"></i>' : `<i class="fas ${st.icon}"></i>`}
                </div>
                <div class="demo-step-label">${st.title}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Main Simulation Stage Screen -->
        <div class="demo-stage-screen">
          <div class="demo-stage-card animate-scale-in" id="demo-stage-view">
            ${renderStageContent(currentStage)}
          </div>

          <!-- Judge / Presenter Notes Side Panel -->
          ${isPresenterMode ? `
            <div class="demo-presenter-panel animate-fade-in">
              <div class="presenter-badge"><i class="fas fa-award"></i> Judge / Presenter Notes</div>
              <h4 class="presenter-title">${getPresenterNotes(currentStage).headline}</h4>
              <p class="presenter-desc">${getPresenterNotes(currentStage).whatHappened}</p>
              <div class="presenter-box">
                <strong>Hospital Operational Impact:</strong>
                <div>${getPresenterNotes(currentStage).impact}</div>
              </div>
              <div class="presenter-box" style="margin-top: 8px">
                <strong>System Response & Evidence:</strong>
                <div>${getPresenterNotes(currentStage).systemResponse}</div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    container.querySelector('#btn-play-pause')?.addEventListener('click', () => {
      if (isPlaying) {
        pauseDemo();
      } else {
        startDemo();
      }
    });

    container.querySelector('#btn-restart-demo')?.addEventListener('click', () => {
      restartDemo();
    });

    container.querySelector('#speed-1x')?.addEventListener('click', () => {
      speedMultiplier = 1;
      render();
    });

    container.querySelector('#speed-2x')?.addEventListener('click', () => {
      speedMultiplier = 2;
      render();
    });

    container.querySelector('#toggle-presenter')?.addEventListener('click', () => {
      isPresenterMode = !isPresenterMode;
      render();
    });

    window._jumpToDemoStage = (stageId) => {
      clearTimeout(timerId);
      currentStage = stageId;
      triggerStageSideEffects(currentStage);
      render();
      if (isPlaying) scheduleNext();
    };
  }

  function startDemo() {
    isPlaying = true;
    eventBus.emit(EventTypes.DEMO_SIMULATION_STARTED, { stage: currentStage });
    triggerStageSideEffects(currentStage);
    render();
    scheduleNext();
  }

  function pauseDemo() {
    isPlaying = false;
    clearTimeout(timerId);
    render();
  }

  function restartDemo() {
    clearTimeout(timerId);
    currentStage = 1;
    isPlaying = false;
    appState.resetToBaseline();
    render();
  }

  function scheduleNext() {
    clearTimeout(timerId);
    if (!isPlaying) return;

    const duration = getStageDuration(currentStage);
    timerId = setTimeout(() => {
      if (currentStage < totalStages) {
        currentStage++;
        eventBus.emit(EventTypes.DEMO_STAGE_CHANGED, { stage: currentStage, title: stages[currentStage - 1].title });
        triggerStageSideEffects(currentStage);
        render();
        scheduleNext();
      } else {
        isPlaying = false;
        eventBus.emit(EventTypes.DEMO_SIMULATION_COMPLETED, {});
        render();
      }
    }, duration);
  }

  function triggerStageSideEffects(stageId) {
    // Proactive sound + voice for emergency stages
    if (stageId === 6) {
      alertManager.playEmergencyChime('P1');
      alertManager.speakAlert('Emergency ambulance request received. Immediate dispatch attention required.');
    } else if (stageId === 8) {
      alertManager.playEmergencyChime('P1');
      alertManager.speakAlert('Critical emergency patient assigned.');
    } else if (stageId === 11) {
      alertManager.playCriticalBloodChime();
      alertManager.speakAlert('Critical blood request requires attention.');
    }
  }

  function renderStageContent(stageId) {
    switch (stageId) {
      case 1:
        return `
          <div class="stage-body">
            <div class="stage-tag"><i class="fas fa-user-plus"></i> STAGE 1 — PATIENT REGISTRATION</div>
            <h2 class="stage-title">New Patient Intake & Unified Healthcare Identity</h2>
            <div class="stage-visual-box">
              <div class="card" style="max-width: 480px; margin: 0 auto; border: 1px solid var(--primary-border)">
                <div class="flex items-center gap-3">
                  <div class="header-user-avatar" style="width: 48px; height: 48px; font-size: 18px">AK</div>
                  <div>
                    <h3 style="margin: 0; font-size: var(--font-size-md)">Amit Kumar</h3>
                    <div style="font-size: var(--font-size-xs); color: var(--text-secondary)">ID: <strong>P-1042</strong> · 29 Yrs · Male · Blood: <strong>B+</strong></div>
                  </div>
                </div>
                <div class="flex justify-between" style="margin-top: var(--space-4); font-size: var(--font-size-xs); border-top: 1px solid var(--border-light); padding-top: var(--space-3)">
                  <span>Registration Status: <strong style="color: var(--success)">Active ✓</strong></span>
                  <span>Preferred Language: <strong>English</strong></span>
                </div>
              </div>
            </div>
          </div>
        `;

      case 2:
        return `
          <div class="stage-body">
            <div class="stage-tag"><i class="fas fa-notes-medical"></i> STAGE 2 — MULTILINGUAL SYMPTOM INTAKE</div>
            <h2 class="stage-title">Natural Language Symptom Normalization</h2>
            <div class="stage-visual-box">
              <div class="card" style="max-width: 520px; margin: 0 auto">
                <label class="form-label" style="color: var(--text-secondary)">Patient Types in Hinglish:</label>
                <div style="background: var(--bg-subtle); padding: var(--space-3); border-radius: var(--radius-md); font-family: monospace; font-size: 14px; margin-bottom: var(--space-3)">
                  "mujhe bukhar aur khansi hai pichle 2 din se"
                </div>
                <div class="flex items-center gap-2" style="margin-top: var(--space-3)">
                  <span style="font-size: var(--font-size-xs); font-weight: 700; color: var(--text-secondary)">Detected Symptoms:</span>
                  <span class="badge badge-success"><i class="fas fa-check"></i> Fever (बुखार)</span>
                  <span class="badge badge-success"><i class="fas fa-check"></i> Cough (खांसी)</span>
                  <span class="badge badge-info" style="margin-left: auto">High Confidence</span>
                </div>
              </div>
            </div>
          </div>
        `;

      case 3:
        return `
          <div class="stage-body">
            <div class="stage-tag"><i class="fas fa-route"></i> STAGE 3 — INTELLIGENT CLINICAL ROUTING</div>
            <h2 class="stage-title">Workload-Aware Doctor Recommendation</h2>
            <div class="stage-visual-box">
              <div class="grid-2" style="max-width: 600px; margin: 0 auto; gap: var(--space-4)">
                <!-- Option A: Recommended -->
                <div class="card" style="border: 2px solid var(--primary); background: #EFF6FF">
                  <div class="badge badge-success" style="margin-bottom: 4px"><i class="fas fa-star"></i> Recommended</div>
                  <h4 style="margin: 0">Dr. Aarav Sharma</h4>
                  <div style="font-size: var(--font-size-xs); color: var(--text-secondary)">General Medicine · Room G-04</div>
                  <div class="flex justify-between" style="font-size: var(--font-size-xs); margin-top: var(--space-3)">
                    <span>Queue: <strong>4 Waiting</strong></span>
                    <span>Est. Wait: <strong style="color: var(--primary)">18 min</strong></span>
                  </div>
                </div>

                <!-- Option B: Alternative -->
                <div class="card" style="opacity: 0.75">
                  <div class="badge badge-neutral" style="margin-bottom: 4px">Alternative</div>
                  <h4 style="margin: 0">Dr. Sunita Mehta</h4>
                  <div style="font-size: var(--font-size-xs); color: var(--text-secondary)">General Medicine · Room G-06</div>
                  <div class="flex justify-between" style="font-size: var(--font-size-xs); margin-top: var(--space-3)">
                    <span>Queue: <strong>8 Waiting</strong></span>
                    <span>Est. Wait: <strong>31 min</strong></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;

      case 4:
        return `
          <div class="stage-body">
            <div class="stage-tag"><i class="fas fa-calendar-check"></i> STAGE 4 — APPOINTMENT CONFIRMATION</div>
            <h2 class="stage-title">Express Check-In QR Code Generated</h2>
            <div class="stage-visual-box">
              <div class="card" style="max-width: 440px; margin: 0 auto; text-align: center; border: 1px solid var(--primary-border)">
                <div class="badge badge-success" style="margin-bottom: 6px"><i class="fas fa-check"></i> Confirmed ✓</div>
                <h3 style="margin: 0">General Medicine · Dr. Aarav Sharma</h3>
                <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin: 4px 0 12px">Appointment ID: <strong>APT-2048</strong></div>

                <div style="width: 120px; height: 120px; background: white; border: 1px solid var(--border); border-radius: var(--radius-md); margin: 0 auto; display: flex; align-items: center; justify-content: center; font-size: 54px; color: var(--text-primary)">
                  <i class="fas fa-qrcode"></i>
                </div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 8px">Consultation Window: <strong>10:30 AM – 10:50 AM</strong></div>
              </div>
            </div>
          </div>
        `;

      case 5:
        return `
          <div class="stage-body">
            <div class="stage-tag"><i class="fas fa-qrcode"></i> STAGE 5 — EXPRESS CHECK-IN & TOKEN</div>
            <h2 class="stage-title">Live Queue Insertion & Initial Predicted Wait</h2>
            <div class="stage-visual-box">
              <div class="card" style="max-width: 520px; margin: 0 auto">
                <div class="flex justify-between items-center" style="background: linear-gradient(145deg, #1D63ED, #0284C7); color: white; padding: var(--space-4); border-radius: var(--radius-lg)">
                  <div>
                    <div style="font-size: 10px; text-transform: uppercase; opacity: 0.9">Your Live Token</div>
                    <div style="font-size: 32px; font-weight: 800">GM-18</div>
                  </div>
                  <div style="text-align: right">
                    <div style="font-size: 10px; text-transform: uppercase; opacity: 0.9">Predicted Wait</div>
                    <div style="font-size: 26px; font-weight: 800">18 min</div>
                  </div>
                </div>
                <div class="grid-3" style="margin-top: var(--space-3); font-size: var(--font-size-xs); text-align: center">
                  <div>Position: <strong>#5</strong></div>
                  <div>Ahead: <strong>4 Patients</strong></div>
                  <div>Status: <span class="badge badge-warning">Waiting</span></div>
                </div>
              </div>
            </div>
          </div>
        `;

      case 6:
        return `
          <div class="stage-body">
            <div class="stage-tag" style="background: #FEF2F2; color: var(--critical)"><i class="fas fa-exclamation-triangle"></i> STAGE 6 — CRITICAL EMERGENCY ARRIVAL</div>
            <h2 class="stage-title" style="color: var(--critical)">Ambulance Dispatch Request Detected</h2>
            <div class="stage-visual-box">
              <div class="emergency-alert-banner critical animate-fade-in" style="max-width: 560px; margin: 0 auto">
                <div class="alert-pulse-icon"><i class="fas fa-ambulance"></i></div>
                <div>
                  <div style="font-weight: 800; font-size: var(--font-size-md)">CRITICAL EMERGENCY DETECTED (P1)</div>
                  <div style="font-size: var(--font-size-xs); opacity: 0.95; margin-top: 2px">
                    Patient with severe breathing difficulty · Location: Sunshine Apts, Andheri
                  </div>
                </div>
                <span class="badge badge-danger">Audio & Voice Alert</span>
              </div>
            </div>
          </div>
        `;

      case 7:
        return `
          <div class="stage-body">
            <div class="stage-tag"><i class="fas fa-truck-medical"></i> STAGE 7 — HOSPITAL AMBULANCE DISPATCH</div>
            <h2 class="stage-title">Fleet Coordination & Real-Time Inbound Timeline</h2>
            <div class="stage-visual-box">
              <div class="card" style="max-width: 580px; margin: 0 auto">
                <div class="flex justify-between items-center" style="margin-bottom: var(--space-3)">
                  <strong>Vehicle: AMB-03 (MH-02-AB-1234)</strong>
                  <span class="badge badge-danger">Inbound ETA ~6 min</span>
                </div>
                <div class="flex justify-between items-center" style="font-size: 11px; margin-top: var(--space-4)">
                  <span style="color: var(--success); font-weight: 700"><i class="fas fa-check"></i> Requested</span>
                  <span style="color: var(--success); font-weight: 700"><i class="fas fa-check"></i> Assigned</span>
                  <span style="color: var(--success); font-weight: 700"><i class="fas fa-check"></i> Dispatched</span>
                  <span style="color: var(--primary); font-weight: 700"><i class="fas fa-truck-medical"></i> En Route</span>
                  <span style="color: var(--text-tertiary)">Hospital Arrival</span>
                </div>
              </div>
            </div>
          </div>
        `;

      case 8:
        return `
          <div class="stage-body">
            <div class="stage-tag"><i class="fas fa-user-shield"></i> STAGE 8 — DOCTOR DIVERSION</div>
            <h2 class="stage-title">Clinical Capacity Reallocated to Trauma Bay</h2>
            <div class="stage-visual-box">
              <div class="card" style="max-width: 520px; margin: 0 auto; border-left: 4px solid var(--critical)">
                <div class="flex justify-between items-center">
                  <div>
                    <h4 style="margin: 0">Dr. Aarav Sharma</h4>
                    <div style="font-size: var(--font-size-xs); color: var(--text-secondary)">Diverted to Critical Emergency Consultation</div>
                  </div>
                  <span class="badge badge-danger">Emergency Active</span>
                </div>
                <div class="flex justify-between" style="font-size: var(--font-size-xs); margin-top: var(--space-3); border-top: 1px solid var(--border-light); padding-top: var(--space-2)">
                  <span>Dept Active Doctors: <strong>3 → 2</strong></span>
                  <span style="color: var(--critical); font-weight: 700">Capacity -33%</span>
                </div>
              </div>
            </div>
          </div>
        `;

      case 9:
        return `
          <div class="stage-body">
            <div class="stage-tag" style="background: #FFFBEB; color: var(--warning)"><i class="fas fa-clock"></i> STAGE 9 — QUEUE IMPACT & ETA SHIFT</div>
            <h2 class="stage-title">Downstream Delay Propagation & Patient Alert</h2>
            <div class="stage-visual-box">
              <div class="grid-2" style="max-width: 580px; margin: 0 auto; gap: var(--space-3)">
                <div class="card" style="border: 1px solid var(--warning-border)">
                  <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase">Dept Average Wait</div>
                  <div style="font-size: 24px; font-weight: 800; color: var(--warning)">18 → 31 min</div>
                  <div style="font-size: 11px; color: var(--text-secondary)">11 patients affected</div>
                </div>
                <div class="card" style="border: 1px solid var(--warning-border)">
                  <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase">Amit's Live Token GM-18</div>
                  <div style="font-size: 24px; font-weight: 800; color: var(--critical)">18 → 29 min</div>
                  <div style="font-size: 11px; color: var(--text-secondary)">Privacy-safe delay notified</div>
                </div>
              </div>
            </div>
          </div>
        `;

      case 10:
        return `
          <div class="stage-body">
            <div class="stage-tag"><i class="fas fa-random"></i> STAGE 10 — AI REDISTRIBUTION INTERVENTION</div>
            <h2 class="stage-title">Closed-Loop Patient Load Balancing</h2>
            <div class="stage-visual-box">
              <div class="card" style="max-width: 560px; margin: 0 auto; border: 2px solid var(--primary-border); background: #EFF6FF">
                <div class="badge badge-info" style="margin-bottom: 4px"><i class="fas fa-magic"></i> Recommended Intervention</div>
                <h4 style="margin: 0">Redistribute 3 eligible patients to Dr. Sunita Mehta</h4>
                <div style="font-size: var(--font-size-xs); color: var(--text-secondary); margin: 4px 0 12px">
                  Leverages available physician capacity to mitigate downstream congestion.
                </div>
                <div class="flex justify-between items-center" style="border-top: 1px solid var(--primary-100); padding-top: var(--space-3)">
                  <span style="font-size: var(--font-size-xs)">Projected Delay Recovery: <strong>29 min → 23 min</strong></span>
                  <button class="btn btn-primary btn-sm"><i class="fas fa-check"></i> Applied ✓</button>
                </div>
              </div>
            </div>
          </div>
        `;

      case 11:
        return `
          <div class="stage-body">
            <div class="stage-tag"><i class="fas fa-tint"></i> STAGE 11 — FEFO BLOOD READINESS</div>
            <h2 class="stage-title">Automated Internal Inventory Match & Reservation</h2>
            <div class="stage-visual-box">
              <div class="card" style="max-width: 520px; margin: 0 auto">
                <div class="flex justify-between items-center" style="margin-bottom: var(--space-3)">
                  <strong>Request: 2 Units O- (Emergency Bay)</strong>
                  <span class="badge badge-danger">Priority: Critical</span>
                </div>
                <div class="flex items-center gap-3" style="background: var(--bg-subtle); padding: var(--space-3); border-radius: var(--radius-md)">
                  <div style="width: 36px; height: 36px; border-radius: var(--radius-full); background: var(--success-light); color: var(--success); display: flex; align-items: center; justify-content: center">
                    <i class="fas fa-check"></i>
                  </div>
                  <div>
                    <div style="font-weight: 700; font-size: var(--font-size-sm)">Operational Match Found (Internal FEFO Bank)</div>
                    <div style="font-size: var(--font-size-xs); color: var(--text-secondary)">2 Units Reserved · Ready for Issue</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;

      case 12:
        return `
          <div class="stage-body">
            <div class="stage-tag" style="background: #ECFDF5; color: var(--success)"><i class="fas fa-heartbeat"></i> STAGE 12 — EMERGENCY RESOLUTION & FLOW RECOVERY</div>
            <h2 class="stage-title" style="color: var(--success)">Clinical Capacity Restored & Queue Normalized</h2>
            <div class="stage-visual-box">
              <div class="flow-recovery-card" style="max-width: 540px; margin: 0 auto">
                <div class="flex justify-between items-center">
                  <div>
                    <h4 style="margin: 0; color: #14532D">Flow Recovery Status</h4>
                    <div style="font-size: var(--font-size-xs); color: #15803D">Emergency case treated · Dr. Sharma returned to OPD</div>
                  </div>
                  <span class="badge badge-success">Recovery: 94% · Normalized</span>
                </div>
                <div class="flow-recovery-bar" style="margin: var(--space-3) 0">
                  <div class="flow-recovery-bar-fill" style="width: 94%"></div>
                </div>
                <div class="flex justify-between" style="font-size: var(--font-size-xs)">
                  <span>Baseline: <strong>18m</strong></span>
                  <span>Emergency Peak: <strong style="color: var(--critical)">31m</strong></span>
                  <span>Current Recovered: <strong style="color: var(--success)">20m</strong></span>
                </div>
              </div>
            </div>
          </div>
        `;

      case 13:
        return `
          <div class="stage-body">
            <div class="stage-tag"><i class="fas fa-stethoscope"></i> STAGE 13 — IN-ROOM CONSULTATION</div>
            <h2 class="stage-title">Physician Consultation Completed for Amit Kumar</h2>
            <div class="stage-visual-box">
              <div class="card" style="max-width: 480px; margin: 0 auto; border: 1px solid #BBF7D0; background: #F0FDF4">
                <div class="flex items-center gap-3">
                  <div class="header-user-avatar" style="width: 44px; height: 44px; background: #DCFCE7; color: #16A34A">AK</div>
                  <div>
                    <h4 style="margin: 0">Amit Kumar (Token GM-18)</h4>
                    <div style="font-size: var(--font-size-xs); color: var(--text-secondary)">Consultation Duration: 12 min · Dr. Aarav Sharma</div>
                  </div>
                </div>
                <div class="flex justify-between items-center" style="margin-top: var(--space-4); border-top: 1px solid #BBF7D0; padding-top: var(--space-3)">
                  <span class="badge badge-success">Status: Completed ✓</span>
                  <span style="font-size: var(--font-size-xs); color: var(--text-secondary)">Discharge Care Plan Initiated</span>
                </div>
              </div>
            </div>
          </div>
        `;

      case 14:
        return `
          <div class="stage-body">
            <div class="stage-tag"><i class="fas fa-file-medical"></i> STAGE 14 — DISCHARGE & CARE CONTINUITY</div>
            <h2 class="stage-title">Structured Post-Discharge Care Plan Authored</h2>
            <div class="stage-visual-box">
              <div class="card" style="max-width: 520px; margin: 0 auto">
                <div class="flex justify-between items-center" style="margin-bottom: var(--space-3)">
                  <strong>Plan ID: DP-2048 (General Medicine)</strong>
                  <span class="badge badge-success">Active at Home</span>
                </div>
                <div class="flex flex-col gap-2" style="font-size: var(--font-size-xs)">
                  <div>💊 <strong>Medications:</strong> Azithromycin 250mg (1 Tab After Food), Paracetamol 500mg</div>
                  <div>🥗 <strong>Diet:</strong> Warm fluids, light meals, hydration</div>
                  <div>📅 <strong>Follow-Up:</strong> 08 Sep 2026 at 10:00 AM</div>
                </div>
              </div>
            </div>
          </div>
        `;

      case 15:
        return `
          <div class="stage-body">
            <div class="stage-tag"><i class="fas fa-language"></i> STAGE 15 — BILINGUAL PATIENT EXPERIENCE</div>
            <h2 class="stage-title">Seamless English ↔ हिंदी Interface Localization</h2>
            <div class="stage-visual-box">
              <div class="card" style="max-width: 520px; margin: 0 auto; border: 1px solid var(--primary-border)">
                <div class="flex justify-between items-center" style="margin-bottom: var(--space-3)">
                  <strong>मेरी देखभाल एवं स्वास्थ्य लाभ योजना</strong>
                  <span class="badge badge-success">सक्रिय योजना</span>
                </div>
                <div class="flex flex-col gap-2" style="font-size: var(--font-size-xs)">
                  <div>💊 <strong>दवाइयाँ:</strong> एजिथ्रोमाइसिन 250 मि.ग्रा (1 गोली भोजन के बाद)</div>
                  <div>🥗 <strong>आहार:</strong> हल्का भोजन, पर्याप्त जल सेवन</div>
                  <div>📅 <strong>अगली जांच (फॉलो-अप):</strong> 08 सितम्बर 2026, प्रातः 10:00 बजे</div>
                </div>
              </div>
            </div>
          </div>
        `;

      case 16:
        return `
          <div class="stage-body">
            <div class="stage-tag" style="background: var(--primary-50); color: var(--primary)"><i class="fas fa-award"></i> STAGE 16 — EXECUTIVE IMPACT SUMMARY</div>
            <h2 class="stage-title">Measurable Hospital Operational Results</h2>
            <div class="stage-visual-box">
              <div class="grid-3" style="max-width: 620px; margin: 0 auto; gap: var(--space-3)">
                <div class="card" style="text-align: center">
                  <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase">Delay Avoided</div>
                  <div style="font-size: 28px; font-weight: 800; color: var(--success)">11 min</div>
                  <div style="font-size: 10px; color: var(--text-secondary)">Peak delay reduction</div>
                </div>
                <div class="card" style="text-align: center">
                  <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase">Redistributed</div>
                  <div style="font-size: 28px; font-weight: 800; color: var(--primary)">3 Patients</div>
                  <div style="font-size: 10px; color: var(--text-secondary)">Capacity balanced</div>
                </div>
                <div class="card" style="text-align: center">
                  <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase">Flow Status</div>
                  <div style="font-size: 20px; font-weight: 800; color: var(--success); margin-top: 6px">Normalized</div>
                  <div style="font-size: 10px; color: var(--text-secondary)">94% Recovery index</div>
                </div>
              </div>

              <div class="flex gap-3" style="justify-content: center; margin-top: var(--space-6)">
                <button class="btn btn-primary btn-lg" onclick="window._jumpToDemoStage(1); window.HospitalFlow.router.navigate('/admin/command');">
                  <i class="fas fa-tachometer-alt"></i> Open Admin Command Center
                </button>
                <button class="btn btn-secondary btn-lg" onclick="window._jumpToDemoStage(1)">
                  <i class="fas fa-redo"></i> Replay Simulation
                </button>
              </div>
            </div>
          </div>
        `;

      default:
        return '';
    }
  }

  function getPresenterNotes(stageId) {
    const notes = {
      1: {
        headline: 'Single Operational Record Creation',
        whatHappened: 'Patient registers once. The identity record is instantly synchronized to the master hospital registry.',
        impact: 'Zero duplicate entries; immediately accessible by Triage and Doctor rosters.',
        systemResponse: 'Issued unique identifier P-1042 with role-scoped RBAC authorization.'
      },
      2: {
        headline: 'Bilingual NLP & Symptom Extraction',
        whatHappened: 'Patient entered colloquial Hinglish symptoms ("mujhe bukhar aur khansi hai").',
        impact: 'Eliminates miscommunication during intake; structures messy text into SNOMED/ICD-aligned concepts.',
        systemResponse: 'Normalized symptoms to Fever & Cough with High Confidence score.'
      },
      3: {
        headline: 'Capacity-Aware Doctor Recommendation',
        whatHappened: 'System evaluated active department queues and doctor consultation velocities in real time.',
        impact: 'Directs patient away from overloaded Dr. Mehta (31m wait) toward Dr. Sharma (18m wait).',
        systemResponse: 'Recommended Dr. Aarav Sharma with lower current projected queue.'
      },
      4: {
        headline: 'Express Check-In QR Generation',
        whatHappened: 'Appointment APT-2048 confirmed. Consultation window predicted (10:30–10:50 AM).',
        impact: 'Provides contactless express check-in token for kiosk or reception.',
        systemResponse: 'Persisted to shared database and synchronized to Dr. Sharma\'s schedule.'
      },
      5: {
        headline: 'Real-Time Queue Token Generation',
        whatHappened: 'Patient scanned QR. Token GM-18 assigned at Position #5.',
        impact: 'Patient sees live countdown (18m); Admin Command Center reflects active waiting load.',
        systemResponse: 'Dynamic ETA calculation initialized based on live doctor velocity.'
      },
      6: {
        headline: 'Critical Inbound Emergency Alert',
        whatHappened: 'P1 trauma case with respiratory distress reported via Hospital Ambulance dispatch.',
        impact: 'Admin Command Center receives distinct audio chime + voice speech alert.',
        systemResponse: 'Immediate emergency alert created and escalated to triage coordinators.'
      },
      7: {
        headline: 'Fleet Dispatch & Inbound Countdown',
        whatHappened: 'Vehicle AMB-03 dispatched with live 6-minute hospital ETA tracking.',
        impact: 'Trauma team and emergency bed pre-arrival readiness mobilized before vehicle arrival.',
        systemResponse: 'Emergency bay checklist initiated and synchronized across stations.'
      },
      8: {
        headline: 'Doctor Diversion to Trauma Bay',
        whatHappened: 'Dr. Sharma assigned to incoming P1 emergency. Capacity shifted from OPD.',
        impact: 'General Medicine active physicians decrease from 3 to 2 (-33% operational capacity).',
        systemResponse: 'Admin Doctor Card updates to Emergency Active; routine queue locked.'
      },
      9: {
        headline: 'Explainable Downstream Delay Propagation',
        whatHappened: 'Doctor diversion increases department average wait from 18m to 31m.',
        impact: '11 patients affected. Amit\'s wait increases from 18m to 29m.',
        systemResponse: 'Privacy-safe delay notification pushed to patient devices without leaking clinical reasons.'
      },
      10: {
        headline: 'Closed-Loop AI Load Balancing',
        whatHappened: 'HospitalFlow AI computed optimal redistribution: move 3 eligible patients to Dr. Mehta.',
        impact: 'Admin approves recommendation; patient wait drops from 29m to 23m (6 min immediate recovery).',
        systemResponse: 'Human-in-the-loop approved; queue entries reassigned deterministically.'
      },
      11: {
        headline: 'FEFO Blood Bank Readiness',
        whatHappened: 'Emergency doctor requested 2 units of O- blood.',
        impact: 'First-Expiry-First-Out dynamic check confirmed internal inventory units available.',
        systemResponse: 'Operational match reserved immediately with zero cross-matching delay.'
      },
      12: {
        headline: 'Emergency Completion & Flow Recovery',
        whatHappened: 'Emergency case resolved. Dr. Sharma returned to routine consultation suite.',
        impact: 'Physician capacity returns to 3; Flow Recovery Index reaches 94% (Normalized).',
        systemResponse: 'Closed-loop recovery verified; average wait normalizes back to 20m.'
      },
      13: {
        headline: 'Seamless Consultation Resumption',
        whatHappened: 'Dr. Sharma called token GM-18 (Amit Kumar) and conducted 12-minute consultation.',
        impact: 'Doctor completed consultation; Admin completed count updates to 13.',
        systemResponse: 'Consultation marked completed; automated care continuity workflow triggered.'
      },
      14: {
        headline: 'Structured Post-Discharge Care Plan',
        whatHappened: 'Physician authored bilingual discharge plan with medications, diet, and follow-up.',
        impact: 'Care plan synchronized directly into patient\'s My Care tab with medication reminders.',
        systemResponse: 'Adherence tracking activated; clinical follow-up scheduled for 08 Sep 2026.'
      },
      15: {
        headline: 'Multilingual UI & Medication Translation',
        whatHappened: 'Patient toggled language to हिंदी in their portal header.',
        impact: 'Entire interface, medication dosages, and diet instructions translated without layout shifts.',
        systemResponse: 'Full Hindi dictionary rendered with zero English leaks.'
      },
      16: {
        headline: 'Executive Impact Demonstration for Judges',
        whatHappened: 'Complete closed-loop hospital lifecycle demonstrated end-to-end.',
        impact: '11 min peak delay avoided, 3 patients redistributed, 100% emergency response, 94% flow recovery.',
        systemResponse: 'Audit log captured complete immutable event sequence for hospital compliance.'
      }
    };
    return notes[stageId] || { headline: 'Operational State', whatHappened: '', impact: '', systemResponse: '' };
  }

  render();
}
