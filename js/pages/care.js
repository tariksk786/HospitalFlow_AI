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
  const canCreate = Auth.canPerform('create_discharge');

  // Get patients with completed consultations (candidates for discharge)
  const completedPatients = s.queueEntries
    .filter(q => q.status === 'Completed')
    .map(q => q.patientId)
    .filter((id, i, arr) => arr.indexOf(id) === i);

  el.innerHTML = `
    <div class="card" style="max-width: 720px">
      <div class="card-header">
        <h3 class="card-title"><i class="fas fa-file-medical" style="color: var(--primary)"></i> Create Discharge Plan</h3>
      </div>
      ${!canCreate ? '<div class="alert alert-info" style="margin-bottom: var(--space-4)"><i class="fas fa-lock"></i> Only doctors and admins can create discharge plans</div>' : ''}

      <form id="discharge-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Patient <span class="required">*</span></label>
            <select class="form-select" id="dp-patient" required ${!canCreate ? 'disabled' : ''}>
              <option value="">Select patient...</option>
              ${s.patients.map(p => `<option value="${p.id}">${escapeHtml(p.displayName)} (${p.id})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Language</label>
            <select class="form-select" id="dp-language" ${!canCreate ? 'disabled' : ''}>
              ${Config.LANGUAGES.map(l => `<option value="${l}">${l}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Medications -->
        <div class="section">
          <div class="flex items-center justify-between" style="margin-bottom: var(--space-3)">
            <h4 class="section-title" style="margin: 0"><i class="fas fa-pills"></i> Medications</h4>
            <button type="button" class="btn btn-secondary btn-sm" id="add-med-btn" ${!canCreate ? 'disabled' : ''}>
              <i class="fas fa-plus"></i> Add Medication
            </button>
          </div>
          <div id="medications-list"></div>
        </div>

        <div class="form-group">
          <label class="form-label">Diet / Recovery Instructions</label>
          <textarea class="form-textarea" id="dp-diet" placeholder="Enter diet and recovery instructions..." ${!canCreate ? 'disabled' : ''}></textarea>
        </div>

        <!-- Follow-up -->
        <div class="section">
          <h4 class="section-title"><i class="fas fa-calendar-check"></i> Follow-Up Appointment</h4>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Department</label>
              <select class="form-select" id="dp-fu-dept" ${!canCreate ? 'disabled' : ''}>
                ${Config.DEPARTMENTS.map(d => `<option value="${d}">${d}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Date</label>
              <input type="date" class="form-input" id="dp-fu-date" value="${new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]}" ${!canCreate ? 'disabled' : ''}>
            </div>
          </div>
        </div>

        <!-- Warning Signs -->
        <div class="form-group">
          <label class="form-label">Warning Signs (one per line)</label>
          <textarea class="form-textarea" id="dp-warnings" placeholder="Enter warning signs, one per line..." ${!canCreate ? 'disabled' : ''}></textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Additional Instructions</label>
          <textarea class="form-textarea" id="dp-instructions" placeholder="Enter additional care instructions..." ${!canCreate ? 'disabled' : ''}></textarea>
        </div>

        <div id="dp-error" style="display: none" class="alert alert-critical"><i class="fas fa-exclamation-circle"></i> <span></span></div>

        <button type="submit" class="btn btn-primary btn-lg" ${!canCreate ? 'disabled' : ''}>
          <i class="fas fa-file-medical"></i> Create Discharge Plan
        </button>
      </form>
    </div>
  `;

  let medCount = 0;
  const medList = el.querySelector('#medications-list');

  function addMedicationRow(name = '', dosage = '', timeSlot = 'Morning', duration = '', instructions = '') {
    medCount++;
    const row = document.createElement('div');
    row.className = 'form-row';
    row.style.marginBottom = 'var(--space-3)';
    row.style.alignItems = 'end';
    row.innerHTML = `
      <div class="form-group" style="margin: 0">
        <input type="text" class="form-input med-name" placeholder="Medication name" value="${escapeHtml(name)}">
      </div>
      <div class="form-group" style="margin: 0">
        <input type="text" class="form-input med-dosage" placeholder="Dosage (e.g. 1 tablet)" value="${escapeHtml(dosage)}">
      </div>
      <div class="form-group" style="margin: 0">
        <select class="form-select med-time">
          ${Config.MED_TIME_SLOTS.map(t => `<option value="${t}" ${t === timeSlot ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin: 0">
        <input type="text" class="form-input med-duration" placeholder="Duration" value="${escapeHtml(duration)}">
      </div>
      <button type="button" class="btn btn-ghost btn-icon" onclick="this.parentElement.remove()" style="color: var(--critical)">
        <i class="fas fa-trash"></i>
      </button>
    `;
    medList.appendChild(row);
  }

  el.querySelector('#add-med-btn')?.addEventListener('click', () => addMedicationRow());

  // Add one empty row by default
  addMedicationRow();

  // Form submit
  el.querySelector('#discharge-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const errorDiv = el.querySelector('#dp-error');
    errorDiv.style.display = 'none';

    const patientId = el.querySelector('#dp-patient').value;
    if (!patientId) {
      errorDiv.querySelector('span').textContent = 'Please select a patient';
      errorDiv.style.display = 'flex';
      return;
    }

    // Collect medications
    const medications = [];
    medList.querySelectorAll('.form-row').forEach(row => {
      const name = row.querySelector('.med-name')?.value.trim();
      const dosage = row.querySelector('.med-dosage')?.value.trim();
      const timeSlot = row.querySelector('.med-time')?.value;
      const duration = row.querySelector('.med-duration')?.value.trim();
      if (name) {
        medications.push({ name, dosage, timeSlot, duration, instructions: '' });
      }
    });

    const warnings = el.querySelector('#dp-warnings').value.split('\n').filter(w => w.trim());

    try {
      const plan = CareEngine.createDischargePlan({
        patientId,
        approvedBy: appState.get().currentUser?.doctorId || 'D-0001',
        medications,
        dietPlan: el.querySelector('#dp-diet').value.trim(),
        followUp: {
          department: el.querySelector('#dp-fu-dept').value,
          date: el.querySelector('#dp-fu-date').value,
          time: '10:00 AM'
        },
        warningSigns: warnings,
        instructions: el.querySelector('#dp-instructions').value.trim(),
        language: el.querySelector('#dp-language').value
      });

      // Switch to plans tab and select the new plan
      selectedPlanId = plan.id;
      currentTab = 'plans';
      renderCarePage(document.getElementById('app-content'));
    } catch (err) {
      errorDiv.querySelector('span').textContent = err.message;
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
