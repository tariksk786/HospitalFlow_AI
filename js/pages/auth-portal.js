// ============================================
// HospitalFlow AI — Auth Landing & Role Portal Logins
// MedFlow Vista Visual Standard
// ============================================

import Auth from '../auth.js';
import Config from '../config.js';
import Router from '../router.js';
import { escapeHtml } from '../utils.js';

/**
 * Main Auth Landing Page: MedFlow Vista 50/50 Split Screen
 */
export function renderAuthLanding(container) {
  container.innerHTML = `
    <div class="auth-split-layout animate-fade-in">
      <!-- Left Panel: Branding & Product Narrative -->
      <div class="auth-brand-panel">
        <div class="auth-brand-radar-bg"></div>

        <div class="auth-brand-header">
          <div class="auth-logo-badge">
            <i class="fas fa-heartbeat"></i>
          </div>
          <span class="auth-brand-name">HospitalFlow AI</span>
        </div>

        <div class="auth-brand-center">
          <div class="auth-hero-tag">Intelligent Hospital Operations Platform</div>
          <h1 class="auth-hero-title">One connected system for patient flow, emergency readiness and care continuity.</h1>
          <p class="auth-hero-desc">
            Symptom understanding, doctor recommendation, live queues, ambulance coordination and recovery — coordinated in real time across every role in the hospital.
          </p>

          <div class="auth-feature-pills">
            <div class="auth-pill"><i class="fas fa-check-circle"></i> <span>Live queue & ETA</span></div>
            <div class="auth-pill"><i class="fas fa-shield-alt"></i> <span>Emergency command</span></div>
            <div class="auth-pill"><i class="fas fa-tint"></i> <span>Blood readiness</span></div>
            <div class="auth-pill"><i class="fas fa-file-medical-alt"></i> <span>Care continuity</span></div>
          </div>
        </div>

        <div class="auth-brand-footer">
          <span>Secure role-based access · Audited activity · Bilingual patient experience</span>
        </div>
      </div>

      <!-- Right Panel: Portal Selection -->
      <div class="auth-portals-panel">
        <div class="auth-portals-container">
          <div class="auth-portals-header">
            <h2>Choose your portal</h2>
            <p>Sign in to the workspace that matches your role.</p>
          </div>

          <div class="auth-portal-cards">
            <!-- 1. Patient Portal Card -->
            <div class="auth-portal-card" onclick="window.HospitalFlow.router.navigate('/patient/login')">
              <div class="portal-card-icon patient">
                <i class="fas fa-user-friends"></i>
              </div>
              <div class="portal-card-content">
                <div class="portal-card-title">Patient</div>
                <div class="portal-card-desc">Manage appointments, queue and recovery.</div>
              </div>
              <div class="portal-card-action">
                <span>Open Portal</span>
                <i class="fas fa-arrow-right"></i>
              </div>
            </div>

            <!-- 2. Doctor Portal Card -->
            <div class="auth-portal-card" onclick="window.HospitalFlow.router.navigate('/doctor/login')">
              <div class="portal-card-icon doctor">
                <i class="fas fa-stethoscope"></i>
              </div>
              <div class="portal-card-content">
                <div class="portal-card-title">Doctor</div>
                <div class="portal-card-desc">Manage consultations and emergency cases.</div>
              </div>
              <div class="portal-card-action">
                <span>Open Portal</span>
                <i class="fas fa-arrow-right"></i>
              </div>
            </div>

            <!-- 3. Admin Portal Card -->
            <div class="auth-portal-card" onclick="window.HospitalFlow.router.navigate('/admin/login')">
              <div class="portal-card-icon admin">
                <i class="fas fa-tachometer-alt"></i>
              </div>
              <div class="portal-card-content">
                <div class="portal-card-title">Admin</div>
                <div class="portal-card-desc">Coordinate hospital flow and resources.</div>
              </div>
              <div class="portal-card-action">
                <span>Open Portal</span>
                <i class="fas fa-arrow-right"></i>
              </div>
            </div>
          </div>

          <div class="auth-notice-card">
            <i class="fas fa-lock"></i>
            <div>
              <strong>Secure Role Authentication</strong><br>
              <span>Using a hospital-issued account? Your role and access permissions are applied automatically after sign-in.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Dedicated Patient Login & Self-Registration
 */
export function renderPatientLogin(container) {
  let isRegisterTab = false;

  function update() {
    container.innerHTML = `
      <div class="auth-single-panel-layout animate-fade-in">
        <div class="auth-login-box">
          <div class="auth-box-header">
            <a href="#/login" class="auth-back-link"><i class="fas fa-arrow-left"></i> All Portals</a>
            <div class="badge badge-info" style="margin: 12px 0 6px"><i class="fas fa-user"></i> Patient Portal</div>
            <h2>${isRegisterTab ? 'Create Patient Account' : 'Patient Sign In'}</h2>
            <p>${isRegisterTab ? 'Register to manage appointments, live queue tokens and recovery' : 'Sign in to access your personal hospital care journey'}</p>
          </div>

          <div class="tabs-container" style="width: 100%; margin: var(--space-4) 0">
            <button class="tab-btn ${!isRegisterTab ? 'active' : ''}" style="flex: 1" id="tab-signin"><i class="fas fa-sign-in-alt"></i> Sign In</button>
            <button class="tab-btn ${isRegisterTab ? 'active' : ''}" style="flex: 1" id="tab-register"><i class="fas fa-user-plus"></i> New Registration</button>
          </div>

          <div id="login-alert" class="alert alert-critical" style="display: none; margin-bottom: var(--space-4)">
            <i class="fas fa-exclamation-circle"></i>
            <span id="login-alert-text"></span>
          </div>

          ${!isRegisterTab ? `
            <!-- Patient Sign In Form -->
            <form id="patient-signin-form" class="auth-form">
              <div class="form-group">
                <label class="form-label" for="pat-email">Email Address <span class="required">*</span></label>
                <input type="email" id="pat-email" class="form-input" placeholder="name@example.com" required autocomplete="email">
              </div>
              <div class="form-group">
                <label class="form-label" for="pat-password">Password <span class="required">*</span></label>
                <input type="password" id="pat-password" class="form-input" placeholder="Enter your password" required autocomplete="current-password">
              </div>
              <div class="flex justify-between items-center" style="margin-bottom: var(--space-4); font-size: var(--font-size-xs)">
                <label class="flex items-center gap-2" style="cursor: pointer; color: var(--text-secondary)">
                  <input type="checkbox" checked> Remember me
                </label>
                <a href="#" style="color: var(--primary); font-weight: 500" onclick="event.preventDefault(); alert('Please contact hospital helpdesk to reset patient credentials.')">Forgot password?</a>
              </div>
              <button type="submit" class="btn btn-primary btn-lg" style="width: 100%" id="signin-btn">
                <i class="fas fa-sign-in-alt"></i> Sign In to Patient Portal
              </button>
            </form>
          ` : `
            <!-- Patient Self-Registration Form -->
            <form id="patient-register-form" class="auth-form">
              <div class="form-group">
                <label class="form-label">Full Name <span class="required">*</span></label>
                <input type="text" id="reg-name" class="form-input" placeholder="e.g. Rohan Sharma" required>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Email Address <span class="required">*</span></label>
                  <input type="email" id="reg-email" class="form-input" placeholder="name@example.com" required autocomplete="email">
                </div>
                <div class="form-group">
                  <label class="form-label">Phone Number <span class="required">*</span></label>
                  <input type="tel" id="reg-phone" class="form-input" placeholder="+91 9876543210" required>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Age</label>
                  <input type="number" id="reg-age" class="form-input" value="28" min="1" max="120">
                </div>
                <div class="form-group">
                  <label class="form-label">Gender</label>
                  <select id="reg-gender" class="form-select">
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Blood Group</label>
                  <select id="reg-blood" class="form-select">
                    ${Config.BLOOD_GROUPS.map(g => `<option value="${g}">${g}</option>`).join('')}
                  </select>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Password <span class="required">*</span></label>
                  <input type="password" id="reg-password" class="form-input" placeholder="Min. 4 characters" required autocomplete="new-password">
                </div>
                <div class="form-group">
                  <label class="form-label">Confirm Password <span class="required">*</span></label>
                  <input type="password" id="reg-password-confirm" class="form-input" placeholder="Repeat password" required autocomplete="new-password">
                </div>
              </div>
              <button type="submit" class="btn btn-primary btn-lg" style="width: 100%" id="register-btn">
                <i class="fas fa-user-check"></i> Complete Registration & Log In
              </button>
            </form>
          `}
        </div>
      </div>
    `;

    // Event listeners
    container.querySelector('#tab-signin')?.addEventListener('click', () => { isRegisterTab = false; update(); });
    container.querySelector('#tab-register')?.addEventListener('click', () => { isRegisterTab = true; update(); });

    // Handle Sign In
    container.querySelector('#patient-signin-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = container.querySelector('#pat-email').value.trim();
      const password = container.querySelector('#pat-password').value;
      const alertEl = container.querySelector('#login-alert');
      const alertText = container.querySelector('#login-alert-text');
      const submitBtn = container.querySelector('#signin-btn');

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';
        alertEl.style.display = 'none';

        const user = await Auth.loginPatient(email, password);
        Router.navigate('/patient/home');
      } catch (err) {
        alertEl.style.display = 'flex';
        alertText.textContent = err.message || 'Authentication failed.';
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In to Patient Portal';
      }
    });

    // Handle Registration
    container.querySelector('#patient-register-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = container.querySelector('#reg-name').value.trim();
      const email = container.querySelector('#reg-email').value.trim();
      const phone = container.querySelector('#reg-phone').value.trim();
      const age = parseInt(container.querySelector('#reg-age').value) || 28;
      const gender = container.querySelector('#reg-gender').value;
      const bloodGroup = container.querySelector('#reg-blood').value;
      const password = container.querySelector('#reg-password').value;
      const passwordConfirm = container.querySelector('#reg-password-confirm').value;
      const alertEl = container.querySelector('#login-alert');
      const alertText = container.querySelector('#login-alert-text');
      const submitBtn = container.querySelector('#register-btn');

      try {
        if (password !== passwordConfirm) {
          throw new Error('Passwords do not match.');
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';
        alertEl.style.display = 'none';

        const user = await Auth.registerPatient({
          displayName: name,
          name,
          email,
          phone,
          age,
          gender,
          bloodGroup,
          password
        });

        Router.navigate('/patient/home');
      } catch (err) {
        alertEl.style.display = 'flex';
        alertText.textContent = err.message || 'Registration failed.';
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-user-check"></i> Complete Registration & Log In';
      }
    });
  }

  update();
}

/**
 * Dedicated Doctor Login
 */
export function renderDoctorLogin(container) {
  container.innerHTML = `
    <div class="auth-single-panel-layout animate-fade-in">
      <div class="auth-login-box">
        <div class="auth-box-header">
          <a href="#/login" class="auth-back-link"><i class="fas fa-arrow-left"></i> All Portals</a>
          <div class="badge badge-success" style="margin: 12px 0 6px"><i class="fas fa-user-md"></i> Clinical Staff</div>
          <h2>Doctor Sign In</h2>
          <p>Sign in to access your assigned queue, consultation room, and emergency workspace.</p>
        </div>

        <div id="doctor-login-alert" class="alert alert-critical" style="display: none; margin-bottom: var(--space-4)">
          <i class="fas fa-exclamation-circle"></i>
          <span id="doctor-login-alert-text"></span>
        </div>

        <form id="doctor-signin-form" class="auth-form" style="margin-top: var(--space-4)">
          <div class="form-group">
            <label class="form-label" for="doc-email">Clinical Email <span class="required">*</span></label>
            <input type="email" id="doc-email" class="form-input" placeholder="doctor@hospitalflow.ai" required autocomplete="email">
          </div>
          <div class="form-group">
            <label class="form-label" for="doc-password">Password <span class="required">*</span></label>
            <input type="password" id="doc-password" class="form-input" placeholder="Enter clinical password" required autocomplete="current-password">
          </div>
          <div class="flex justify-between items-center" style="margin-bottom: var(--space-4); font-size: var(--font-size-xs)">
            <label class="flex items-center gap-2" style="cursor: pointer; color: var(--text-secondary)">
              <input type="checkbox" checked> Remember this terminal
            </label>
            <a href="#" style="color: var(--primary); font-weight: 500" onclick="event.preventDefault(); alert('Clinical password resets must be authorized by Hospital IT Administration.')">Forgot password?</a>
          </div>
          <button type="submit" class="btn btn-primary btn-lg" style="width: 100%" id="doc-submit-btn">
            <i class="fas fa-user-md"></i> Sign In to Doctor Portal
          </button>
        </form>

        <div class="auth-notice-card" style="margin-top: var(--space-6)">
          <i class="fas fa-shield-alt"></i>
          <span>Clinical sessions are securely audited for medical compliance and real-time patient queue routing.</span>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#doctor-signin-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = container.querySelector('#doc-email').value.trim();
    const password = container.querySelector('#doc-password').value;
    const alertEl = container.querySelector('#doctor-login-alert');
    const alertText = container.querySelector('#doctor-login-alert-text');
    const submitBtn = container.querySelector('#doc-submit-btn');

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';
      alertEl.style.display = 'none';

      const user = await Auth.loginDoctor(email, password);
      Router.navigate('/doctor/dashboard');
    } catch (err) {
      alertEl.style.display = 'flex';
      alertText.textContent = err.message || 'Clinical authentication failed.';
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-user-md"></i> Sign In to Doctor Portal';
    }
  });
}

/**
 * Dedicated Admin Login
 */
export function renderAdminLogin(container) {
  container.innerHTML = `
    <div class="auth-single-panel-layout animate-fade-in">
      <div class="auth-login-box">
        <div class="auth-box-header">
          <a href="#/login" class="auth-back-link"><i class="fas fa-arrow-left"></i> All Portals</a>
          <div class="badge badge-neutral" style="margin: 12px 0 6px"><i class="fas fa-shield-alt"></i> Operations Command</div>
          <h2>Hospital Administrator Sign In</h2>
          <p>Sign in to access the Hospital Command Center, Flow Intelligence, and Emergency Readiness.</p>
        </div>

        <div id="admin-login-alert" class="alert alert-critical" style="display: none; margin-bottom: var(--space-4)">
          <i class="fas fa-exclamation-circle"></i>
          <span id="admin-login-alert-text"></span>
        </div>

        <form id="admin-signin-form" class="auth-form" style="margin-top: var(--space-4)">
          <div class="form-group">
            <label class="form-label" for="adm-email">Administrator Email <span class="required">*</span></label>
            <input type="email" id="adm-email" class="form-input" placeholder="admin@hospitalflow.ai" required autocomplete="email">
          </div>
          <div class="form-group">
            <label class="form-label" for="adm-password">Password <span class="required">*</span></label>
            <input type="password" id="adm-password" class="form-input" placeholder="Enter administrator password" required autocomplete="current-password">
          </div>
          <div class="flex justify-between items-center" style="margin-bottom: var(--space-4); font-size: var(--font-size-xs)">
            <label class="flex items-center gap-2" style="cursor: pointer; color: var(--text-secondary)">
              <input type="checkbox" checked> Secure Station
            </label>
            <a href="#" style="color: var(--primary); font-weight: 500" onclick="event.preventDefault(); alert('Master Admin key required for administrative credential recovery.')">Forgot password?</a>
          </div>
          <button type="submit" class="btn btn-primary btn-lg" style="width: 100%" id="adm-submit-btn">
            <i class="fas fa-shield-alt"></i> Sign In to Admin Portal
          </button>
        </form>

        <div class="auth-notice-card" style="margin-top: var(--space-6)">
          <i class="fas fa-lock"></i>
          <span>Administrative privileges include flow orchestration, doctor capacity diversion, ambulance dispatch, and blood bank management.</span>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#admin-signin-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = container.querySelector('#adm-email').value.trim();
    const password = container.querySelector('#adm-password').value;
    const alertEl = container.querySelector('#admin-login-alert');
    const alertText = container.querySelector('#admin-login-alert-text');
    const submitBtn = container.querySelector('#adm-submit-btn');

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';
      alertEl.style.display = 'none';

      const user = await Auth.loginAdmin(email, password);
      Router.navigate('/admin/command');
    } catch (err) {
      alertEl.style.display = 'flex';
      alertText.textContent = err.message || 'Administrative authentication failed.';
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-shield-alt"></i> Sign In to Admin Portal';
    }
  });
}
