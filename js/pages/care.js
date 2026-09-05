// ============================================
// HospitalFlow AI — Care Continuity Page
// ============================================

import appState from '../state.js';
import Config from '../config.js';
import Auth from '../auth.js';
import CareEngine from '../engines/care-engine.js';
import { escapeHtml, formatDate, formatTime, getInitials, stringToColor } from '../utils.js';

let currentTab = 'plans';
let selectedPlanId = null;

export default function renderCarePage(container) {
  const s = appState.get();

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h2><i class="fas fa-heartbeat" style="color: var(--success); margin-right: var(--space-2)"></i>Care Continuity</h2>
        <p>Discharge plans, medication tracking, follow-ups & recovery guidance</p>
      </div>
    </div>

    <div class="page-tabs" id="care-tabs">
      <button class="page-tab ${currentTab === 'plans' ? 'active' : ''}" data-tab="plans"><i class="fas fa-file-medical"></i> Discharge Plans</button>
      <button class="page-tab ${currentTab === 'create' ? 'active' : ''}" data-tab="create"><i class="fas fa-plus-circle"></i> Create Plan</button>
      <button class="page-tab ${currentTab === 'medications' ? 'active' : ''}" data-tab="medications"><i class="fas fa-pills"></i> Medications</button>
      <button class="page-tab ${currentTab === 'followups' ? 'active' : ''}" data-tab="followups"><i class="fas fa-calendar-check"></i> Follow-Ups</button>
      <button class="page-tab ${currentTab === 'reminders' ? 'active' : ''}" data-tab="reminders"><i class="fas fa-bell"></i> Reminders</button>
    </div>

    <div id="care-tab-content"></div>
  `;

  container.querySelectorAll('.page-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentTab = tab.dataset.tab;
      container.querySelectorAll('.page-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === currentTab));
      renderCareTabContent(container.querySelector('#care-tab-content'));
    });
  });

  renderCareTabContent(container.querySelector('#care-tab-content'));
}

function renderCareTabContent(el) {
  if (!el) return;
  switch (currentTab) {
    case 'plans': renderPlansTab(el); break;
    case 'create': renderCreatePlanTab(el); break;
    case 'medications': renderMedicationsTab(el); break;
    case 'followups': renderFollowUpsTab(el); break;
    case 'reminders': renderRemindersTab(el); break;
  }
}

// ============================================
// DISCHARGE PLANS TAB
// ============================================
function renderPlansTab(el) {
  const s = appState.get();
  const plans = s.dischargePlans.filter(dp => dp.active);
  const role = s.currentRole;

  // If patient, show only their plan
  let filteredPlans = plans;
  if (role === 'patient' && s.currentUser?.patientId) {
    filteredPlans = plans.filter(dp => dp.patientId === s.currentUser.patientId);
  }

  if (filteredPlans.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-file-medical"></i>
        <h4>No Active Discharge Plans</h4>
        <p>Discharge plans will appear here after consultations are completed and plans are created.</p>
        ${Auth.canPerform('create_discharge') ? '<button class="btn btn-primary" onclick="window.HospitalFlow.router.navigate(\'care\')"><i class="fas fa-plus"></i> Create Plan</button>' : ''}
      </div>
    `;
    return;
  }

  if (!selectedPlanId && filteredPlans.length > 0) {
    selectedPlanId = filteredPlans[0].id;
  }

  el.innerHTML = `
    <div class="grid-2">
      <!-- Plan List -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Active Plans</h3>
          <span class="badge badge-info">${filteredPlans.length}</span>
        </div>
        ${filteredPlans.map(plan => {
          const patient = s.patients.find(p => p.id === plan.patientId);
          const doctor = s.doctors.find(d => d.id === plan.approvedBy);
          const adherence = CareEngine.getAdherence(plan.patientId);
          const selected = plan.id === selectedPlanId;

          return `
          <div class="queue-item" style="cursor: pointer; ${selected ? 'background: var(--primary-50); border-left: 3px solid var(--primary)' : ''}"
               onclick="window.HospitalFlow.selectDischargePlan('${plan.id}')">
            <div style="flex: 1">
              <div style="font-weight: var(--font-weight-semibold)">${escapeHtml(patient?.displayName || plan.patientId)}</div>
              <div style="font-size: var(--font-size-xs); color: var(--text-secondary)">
                ${plan.id} · ${escapeHtml(doctor?.displayName || '')} · ${formatDate(plan.createdAt)}
              </div>
              <div style="margin-top: var(--space-2)">
                <span class="badge badge-info">${plan.medications.length} medications</span>
                <span class="badge ${plan.language !== 'English' ? 'badge-warning' : 'badge-neutral'}">${plan.language}</span>
                ${adherence.total > 0 ? `<span class="badge ${adherence.rate >= 80 ? 'badge-success' : 'badge-warning'}">Adherence: ${adherence.rate}%</span>` : ''}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>

      <!-- Plan Detail -->
      <div id="plan-detail">
        ${selectedPlanId ? renderPlanDetail(selectedPlanId) : `
        <div class="card">
          <div class="empty-state" style="padding: var(--space-8)">
            <i class="fas fa-hand-pointer"></i>
            <h4>Select a Plan</h4>
            <p>Click on a discharge plan to view details</p>
          </div>
        </div>`}
      </div>
    </div>
  `;
}

function renderPlanDetail(planId) {
  const s = appState.get();
  const plan = s.dischargePlans.find(dp => dp.id === planId);
  if (!plan) return '<div class="card"><p>Plan not found</p></div>';

  const patient = s.patients.find(p => p.id === plan.patientId);
  const doctor = s.doctors.find(d => d.id === plan.approvedBy);
  const translations = CareEngine.getTranslations(plan.language);
  const adherence = CareEngine.getAdherence(plan.patientId);

  return `
    <div class="card">
      <div class="care-plan-header" style="margin-bottom: var(--space-4)">
        <div>
          <h3 style="font-size: var(--font-size-lg)">${escapeHtml(patient?.displayName || plan.patientId)}</h3>
          <div style="font-size: var(--font-size-xs); color: var(--text-secondary)">
            Discharge: ${formatDate(plan.dischargeDate)} · Approved by: ${escapeHtml(doctor?.displayName || '')}
          </div>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-secondary btn-sm" onclick="window.HospitalFlow.shareCarePlan('${plan.id}')">
            <i class="fas fa-share-alt"></i> Share
          </button>
        </div>
      </div>

      <!-- Medications -->
      <div class="section">
        <h4 class="section-title"><i class="fas fa-pills"></i> ${translations.medicationLabel}</h4>
        <div class="medication-timeline">
          ${Config.MED_TIME_SLOTS.map(slot => {
            const slotMeds = plan.medications.filter(m => m.timeSlot === slot);
            if (slotMeds.length === 0) return '';
            const slotIcon = slot === 'Morning' ? 'fa-sun' : slot === 'Afternoon' ? 'fa-cloud-sun' : slot === 'Evening' ? 'fa-cloud-moon' : 'fa-moon';
            return `
              <div class="med-time-group">
                <div class="med-time-header">
                  <i class="fas ${slotIcon}"></i>
                  ${translations[slot.toLowerCase()] || slot}
                </div>
                ${slotMeds.map(med => {
                  const tracking = (s.medicationTracking || {})[plan.patientId];
                  const taken = tracking?.history.some(h => h.medication === med.name && h.timeSlot === slot && h.taken);
                  return `
                  <div class="med-item ${taken ? 'taken' : ''}">
                    <div class="med-check ${taken ? 'checked' : ''}"
                         onclick="window.HospitalFlow.toggleMedication('${plan.patientId}', '${med.name}', '${slot}')">
                      <i class="fas fa-check"></i>
                    </div>
                    <div class="med-info">
                      <div class="med-name">${escapeHtml(med.name)}</div>
                      <div class="med-dose">${escapeHtml(med.dosage)} · ${escapeHtml(med.duration)} · ${escapeHtml(med.instructions)}</div>
                    </div>
                  </div>`;
                }).join('')}
              </div>`;
          }).join('')}
        </div>
        ${adherence.total > 0 ? `
        <div style="margin-top: var(--space-3)">
          <div class="flex justify-between" style="font-size: var(--font-size-xs); margin-bottom: var(--space-1)">
            <span>Adherence: ${adherence.taken}/${adherence.total} doses</span>
            <span style="font-weight: var(--font-weight-semibold)">${adherence.rate}%</span>
          </div>
          <div class="adherence-bar">
            <div class="adherence-fill" style="width: ${adherence.rate}%; background: ${adherence.rate >= 80 ? 'var(--success)' : adherence.rate >= 50 ? 'var(--warning)' : 'var(--critical)'}"></div>
          </div>
        </div>` : ''}
      </div>

      <!-- Diet -->
      ${plan.dietPlan ? `
      <div class="section">
        <h4 class="section-title"><i class="fas fa-utensils"></i> ${translations.dietLabel}</h4>
        <p style="font-size: var(--font-size-sm); color: var(--text-secondary); line-height: var(--line-height-relaxed)">${escapeHtml(plan.dietPlan)}</p>
      </div>` : ''}

      <!-- Follow-Up -->
      ${plan.followUp ? `
      <div class="section">
        <h4 class="section-title"><i class="fas fa-calendar-check"></i> ${translations.followUpLabel}</h4>
        <div class="followup-card" style="margin: 0">
          <div class="followup-date">
            <div class="followup-day">${new Date(plan.followUp.date).getDate()}</div>
            <div class="followup-month">${new Date(plan.followUp.date).toLocaleString('en-IN', { month: 'short' })}</div>
          </div>
          <div style="flex: 1">
            <div style="font-weight: var(--font-weight-semibold)">${escapeHtml(plan.followUp.department)}</div>
            <div style="font-size: var(--font-size-xs); color: var(--text-secondary)">${plan.followUp.time}</div>
          </div>
        </div>
      </div>` : ''}

      <!-- Warning Signs -->
      ${plan.warningSigns && plan.warningSigns.length > 0 ? `
      <div class="section">
        <h4 class="section-title"><i class="fas fa-exclamation-triangle" style="color: var(--warning)"></i> ${translations.warningLabel}</h4>
        ${plan.warningSigns.map(ws => `
          <div class="warning-sign-item">
            <i class="fas fa-exclamation-triangle"></i>
            <span style="font-size: var(--font-size-sm)">${escapeHtml(ws)}</span>
          </div>
        `).join('')}
        <button class="btn btn-warning btn-sm" style="margin-top: var(--space-2)"
          onclick="window.HospitalFlow.reportWarningSign('${plan.patientId}')">
          <i class="fas fa-flag"></i> Report Warning Sign
        </button>
      </div>` : ''}

      <!-- Instructions -->
      ${plan.instructions ? `
      <div class="section">
        <h4 class="section-title"><i class="fas fa-clipboard-list"></i> ${translations.instructionLabel}</h4>
        <p style="font-size: var(--font-size-sm); color: var(--text-secondary); line-height: var(--line-height-relaxed)">${escapeHtml(plan.instructions)}</p>
      </div>` : ''}

      <!-- Re-entry -->
      <div class="section">
        <button class="btn btn-secondary" onclick="window.HospitalFlow.requestReentry('${plan.patientId}')">
          <i class="fas fa-redo"></i> Request Care Re-Entry
        </button>
      </div>

      <!-- Safety Notice -->
      <div class="care-safety-notice">
        <i class="fas fa-info-circle"></i>
        ${translations.safetyNotice}
      </div>
    </div>
  `;
}

// ============================================
// CREATE PLAN TAB
// ============================================
function renderCreatePlanTab(el) {
  const s = appState.get();
  const canCreate = Auth.canPerform('create_discharge') || true; // Admins and Doctors can create

  el.innerHTML = `
    <div class="card" style="max-width: 760px; margin: 0 auto">
      <div class="card-header" style="border-bottom: 1px solid var(--border-light); padding-bottom: var(--space-3)">
        <div>
          <h3 class="card-title" style="color: var(--primary)"><i class="fas fa-file-medical"></i> Author Patient Care Plan</h3>
          <div class="card-subtitle">Create structured recovery instructions, prescription schedule, and warning sign triggers</div>
        </div>
        <span class="badge badge-primary">Active Clinical Flow</span>
      </div>

      <form id="discharge-form" style="padding-top: var(--space-4)">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Patient <span class="required">*</span></label>
            <select class="form-select" id="dp-patient" required>
              <option value="">Select patient...</option>
              ${s.patients.map(p => `<option value="${p.id}">${escapeHtml(p.displayName)} (${p.id}) · ${p.bloodGroup || 'B+'}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Authoring / Assigned Doctor <span class="required">*</span></label>
            <select class="form-select" id="dp-doctor" required>
              ${s.doctors.map(d => `<option value="${d.id}">Dr. ${escapeHtml(d.displayName)} (${escapeHtml(d.department)})</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Care Plan Title / Recovery Focus</label>
            <input type="text" id="dp-title" class="form-input" placeholder="e.g. Post-Consultation Antibiotic & Recovery Protocol" value="Post-Consultation Recovery Protocol">
          </div>
          <div class="form-group">
            <label class="form-label">Patient Language</label>
            <select class="form-select" id="dp-language">
              ${Config.LANGUAGES.map(l => `<option value="${l}">${l}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Medications -->
        <div class="section" style="background: var(--bg-subtle); padding: var(--space-4); border-radius: var(--radius-lg); margin-bottom: var(--space-4); border: 1px solid var(--border-light)">
          <div class="flex items-center justify-between" style="margin-bottom: var(--space-3)">
            <div>
              <h4 class="section-title" style="margin: 0"><i class="fas fa-pills" style="color: var(--primary)"></i> Prescribed Medications</h4>
              <div style="font-size: 11px; color: var(--text-secondary)">Specify medicine name, dosage, time slot, and food timing</div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" id="add-med-btn">
              <i class="fas fa-plus"></i> Add Medication
            </button>
          </div>
          <div id="medications-list"></div>
        </div>

        <!-- Dietary Instructions -->
        <div class="form-group">
          <label class="form-label">Dietary Instructions <span class="required">*</span></label>
          <textarea class="form-textarea" id="dp-diet" rows="2" placeholder="e.g. Light meals, high fluid intake (2-3L/day), avoid oily and spicy foods." required>Light meals, high fluid intake, avoid spicy and fried foods.</textarea>
        </div>

        <!-- Recovery Guidelines -->
        <div class="form-group">
          <label class="form-label">Recovery Guidelines & Instructions</label>
          <textarea class="form-textarea" id="dp-instructions" rows="2" placeholder="e.g. Bed rest for 48h, avoid heavy lifting for 7 days, complete full antibiotic course.">Strict bed rest for 48 hours. Avoid heavy physical exertion for 7 days. Complete full medication course.</textarea>
        </div>

        <!-- Follow-up -->
        <div class="section" style="border: 1px solid var(--border-light); padding: var(--space-4); border-radius: var(--radius-lg); margin-bottom: var(--space-4)">
          <h4 class="section-title" style="margin-bottom: var(--space-3)"><i class="fas fa-calendar-check" style="color: var(--teal)"></i> Follow-Up Consultation</h4>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Department</label>
              <select class="form-select" id="dp-fu-dept">
                ${Config.DEPARTMENTS.map(d => `<option value="${d}">${d}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Follow-Up Date</label>
              <input type="date" class="form-input" id="dp-fu-date" value="${new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]}">
            </div>
          </div>
        </div>

        <!-- Warning Signs -->
        <div class="form-group">
          <label class="form-label">Warning Signs (Triggers for Hospital Re-entry, one per line)</label>
          <textarea class="form-textarea" id="dp-warnings" rows="3" placeholder="Enter warning signs...">Fever above 101°F persisting for over 4 hours
Severe shortness of breath or chest heaviness
Sudden dizziness / fainting or loss of balance
Allergic reactions (skin rash, lip swelling)</textarea>
        </div>

        <div id="dp-error" style="display: none" class="alert alert-critical"><i class="fas fa-exclamation-circle"></i> <span></span></div>

        <div class="flex gap-3" style="margin-top: var(--space-4)">
          <button type="submit" class="btn btn-primary btn-lg" id="btn-submit-care-plan" style="flex: 1">
            <i class="fas fa-check-circle"></i> Create & Authorize Care Plan
          </button>
        </div>
      </form>
    </div>
  `;

  let medCount = 0;
  const medList = el.querySelector('#medications-list');

  function addMedicationRow(name = '', dosage = '1 tablet', timeSlot = 'Morning', duration = '5 days', instructions = 'After food') {
    medCount++;
    const row = document.createElement('div');
    row.className = 'form-row';
    row.style.marginBottom = 'var(--space-3)';
    row.style.alignItems = 'end';
    row.innerHTML = `
      <div class="form-group" style="margin: 0; flex: 2">
        <label class="form-label" style="font-size: 10px">Medicine & Strength</label>
        <input type="text" class="form-input med-name" placeholder="e.g. Azithromycin 500mg" value="${escapeHtml(name)}">
      </div>
      <div class="form-group" style="margin: 0; flex: 1">
        <label class="form-label" style="font-size: 10px">Dosage</label>
        <input type="text" class="form-input med-dosage" placeholder="1 tablet" value="${escapeHtml(dosage)}">
      </div>
      <div class="form-group" style="margin: 0; flex: 1.2">
        <label class="form-label" style="font-size: 10px">Time Slot</label>
        <select class="form-select med-time">
          ${Config.MED_TIME_SLOTS.map(t => `<option value="${t}" ${t === timeSlot ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin: 0; flex: 1">
        <label class="form-label" style="font-size: 10px">Duration</label>
        <input type="text" class="form-input med-duration" placeholder="5 days" value="${escapeHtml(duration)}">
      </div>
      <div class="form-group" style="margin: 0; flex: 1.5">
        <label class="form-label" style="font-size: 10px">Food Timing</label>
        <input type="text" class="form-input med-instructions" placeholder="After food" value="${escapeHtml(instructions)}">
      </div>
      <button type="button" class="btn btn-ghost btn-icon" onclick="this.parentElement.remove()" style="color: var(--critical); margin-bottom: 2px" title="Remove medication">
        <i class="fas fa-trash"></i>
      </button>
    `;
    medList.appendChild(row);
  }

  el.querySelector('#add-med-btn')?.addEventListener('click', () => addMedicationRow('', '1 tablet', 'Morning', '5 days', 'After food'));

  // Add default medication rows
  addMedicationRow('Azithromycin 500mg', '1 tablet', 'Morning', '5 days', 'After breakfast');
  addMedicationRow('Paracetamol 650mg', '1 tablet (SOS)', 'Night', '3 days', 'If fever > 100°F');

  // Form submit
  el.querySelector('#discharge-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const errorDiv = el.querySelector('#dp-error');
    errorDiv.style.display = 'none';

    const patientId = el.querySelector('#dp-patient').value;
    const doctorId = el.querySelector('#dp-doctor').value;

    if (!patientId) {
      errorDiv.querySelector('span').textContent = 'Please select a patient';
      errorDiv.style.display = 'flex';
      return;
    }

    const submitBtn = el.querySelector('#btn-submit-care-plan');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Plan...';
    }

    // Collect medications
    const medications = [];
    medList.querySelectorAll('.form-row').forEach(row => {
      const name = row.querySelector('.med-name')?.value.trim();
      const dosage = row.querySelector('.med-dosage')?.value.trim() || '1 tablet';
      const timeSlot = row.querySelector('.med-time')?.value || 'Morning';
      const duration = row.querySelector('.med-duration')?.value.trim() || '5 days';
      const instructions = row.querySelector('.med-instructions')?.value.trim() || 'After food';
      if (name) {
        medications.push({ name, dosage, timeSlot, duration, instructions, taken: false, skipped: false });
      }
    });

    const warnings = el.querySelector('#dp-warnings').value.split('\n').map(w => w.trim()).filter(Boolean);
    const diet = el.querySelector('#dp-diet').value.trim();
    const instructions = el.querySelector('#dp-instructions').value.trim();
    const fuDept = el.querySelector('#dp-fu-dept').value;
    const fuDate = el.querySelector('#dp-fu-date').value;
    const language = el.querySelector('#dp-language').value;

    try {
      const plan = CareEngine.createDischargePlan({
        patientId,
        approvedBy: doctorId || 'D-0001',
        medications,
        dietPlan: diet,
        dietaryInstructions: diet,
        recoveryInstructions: instructions,
        followUp: {
          department: fuDept,
          date: fuDate,
          time: '10:00 AM'
        },
        warningSigns: warnings,
        instructions: instructions,
        language: language
      });

      alert('✓ Care Plan created and synchronized successfully across Patient, Doctor, and Admin portals.');

      selectedPlanId = plan.id;
      currentTab = 'plans';

      // Find the main container to re-render
      const mainContainer = document.querySelector('#admin-sub-content') ||
                            document.querySelector('#care-tab-content')?.parentElement ||
                            document.querySelector('.app-content');
      if (mainContainer) {
        renderCarePage(mainContainer);
      }
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Create & Authorize Care Plan';
      }
      errorDiv.querySelector('span').textContent = err.message || 'Unable to create care plan. Your entered information has been preserved.';
      errorDiv.style.display = 'flex';
    }
  });
}

// ============================================
// MEDICATIONS TAB
// ============================================
function renderMedicationsTab(el) {
  const s = appState.get();
  const plans = s.dischargePlans.filter(dp => dp.active);

  if (plans.length === 0) {
    el.innerHTML = '<div class="empty-state"><i class="fas fa-pills"></i><h4>No Active Medication Plans</h4></div>';
    return;
  }

  el.innerHTML = plans.map(plan => {
    const patient = s.patients.find(p => p.id === plan.patientId);
    const adherence = CareEngine.getAdherence(plan.patientId);

    return `
      <div class="card" style="margin-bottom: var(--space-4)">
        <div class="card-header">
          <h3 class="card-title">${escapeHtml(patient?.displayName || plan.patientId)}</h3>
          <span class="badge ${adherence.rate >= 80 ? 'badge-success' : 'badge-warning'}">Adherence: ${adherence.rate}%</span>
        </div>
        <div class="medication-timeline">
          ${Config.MED_TIME_SLOTS.map(slot => {
            const slotMeds = plan.medications.filter(m => m.timeSlot === slot);
            if (slotMeds.length === 0) return '';
            const slotIcon = slot === 'Morning' ? 'fa-sun' : slot === 'Afternoon' ? 'fa-cloud-sun' : slot === 'Evening' ? 'fa-cloud-moon' : 'fa-moon';
            return `
              <div class="med-time-group">
                <div class="med-time-header"><i class="fas ${slotIcon}"></i> ${slot}</div>
                ${slotMeds.map(med => {
                  const tracking = (s.medicationTracking || {})[plan.patientId];
                  const taken = tracking?.history.some(h => h.medication === med.name && h.timeSlot === slot && h.taken);
                  return `
                  <div class="med-item ${taken ? 'taken' : ''}">
                    <div class="med-check ${taken ? 'checked' : ''}"
                         onclick="window.HospitalFlow.toggleMedication('${plan.patientId}', '${med.name}', '${slot}')">
                      <i class="fas fa-check"></i>
                    </div>
                    <div class="med-info">
                      <div class="med-name">${escapeHtml(med.name)}</div>
                      <div class="med-dose">${escapeHtml(med.dosage)} · ${escapeHtml(med.duration)}</div>
                    </div>
                  </div>`;
                }).join('')}
              </div>`;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// ============================================
// FOLLOW-UPS TAB
// ============================================
function renderFollowUpsTab(el) {
  const s = appState.get();
  const followUps = s.followUps.sort((a, b) => new Date(a.date) - new Date(b.date));

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Scheduled Follow-Ups</h3>
        <span class="badge badge-info">${followUps.length}</span>
      </div>
      ${followUps.length === 0 ? `
        <div class="empty-state" style="padding: var(--space-6)">
          <i class="fas fa-calendar"></i>
          <h4>No Follow-Ups Scheduled</h4>
        </div>
      ` : followUps.map(fu => {
        const patient = s.patients.find(p => p.id === fu.patientId);
        const doctor = s.doctors.find(d => d.id === fu.doctorId);
        const fuDate = new Date(fu.date);

        return `
        <div class="followup-card">
          <div class="followup-date">
            <div class="followup-day">${fuDate.getDate()}</div>
            <div class="followup-month">${fuDate.toLocaleString('en-IN', { month: 'short' })}</div>
          </div>
          <div style="flex: 1">
            <div style="font-weight: var(--font-weight-semibold)">${escapeHtml(patient?.displayName || fu.patientId)}</div>
            <div style="font-size: var(--font-size-xs); color: var(--text-secondary)">
              ${escapeHtml(fu.department)} · ${escapeHtml(doctor?.displayName || '')} · ${fu.time}
            </div>
            ${fu.appointmentId ? `<span class="badge badge-success" style="margin-top: var(--space-1)"><i class="fas fa-link"></i> Linked: ${fu.appointmentId}</span>` : ''}
          </div>
          <span class="badge ${fu.status === 'Scheduled' ? 'badge-info' : 'badge-success'}">${fu.status}</span>
        </div>`;
      }).join('')}
    </div>

    <div class="care-safety-notice" style="margin-top: var(--space-4)">
      <i class="fas fa-link"></i>
      Follow-up appointments automatically appear in Flow Intelligence when created from Care Continuity
    </div>
  `;
}

// ============================================
// REMINDERS TAB
// ============================================
function renderRemindersTab(el) {
  const s = appState.get();
  const reminders = s.reminders.sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor));

  const statusIcons = {
    Scheduled: 'fa-clock',
    Delivered: 'fa-envelope',
    Read: 'fa-envelope-open',
    Acknowledged: 'fa-check-circle',
    Missed: 'fa-times-circle'
  };

  const statusColors = {
    Scheduled: 'badge-neutral',
    Delivered: 'badge-info',
    Read: 'badge-info',
    Acknowledged: 'badge-success',
    Missed: 'badge-danger'
  };

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Care Reminders</h3>
      </div>
      ${reminders.length === 0 ? `
        <div class="empty-state"><i class="fas fa-bell-slash"></i><h4>No Reminders</h4></div>
      ` : `
      <div class="table-container" style="border: none">
        <table class="data-table">
          <thead><tr><th>Type</th><th>Patient</th><th>Message</th><th>Scheduled</th><th>Status</th></tr></thead>
          <tbody>
            ${reminders.map(rem => {
              const patient = s.patients.find(p => p.id === rem.patientId);
              return `
              <tr>
                <td><span class="badge ${rem.type === 'Medication' ? 'badge-info' : 'badge-warning'}"><i class="fas ${rem.type === 'Medication' ? 'fa-pills' : 'fa-calendar'}"></i> ${rem.type}</span></td>
                <td style="font-weight: var(--font-weight-medium)">${escapeHtml(patient?.displayName || rem.patientId)}</td>
                <td style="font-size: var(--font-size-xs)">${escapeHtml(rem.message)}</td>
                <td style="font-size: var(--font-size-xs)">${formatDate(rem.scheduledFor)} ${formatTime(rem.scheduledFor)}</td>
                <td><span class="badge ${statusColors[rem.status] || 'badge-neutral'}"><i class="fas ${statusIcons[rem.status] || 'fa-circle'}"></i> ${rem.status}</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`}
    </div>
  `;
}

export function setSelectedPlanId(id) {
  selectedPlanId = id;
}

export { renderPlanDetail, selectedPlanId };
