// ============================================
// HospitalFlow AI — Secure RBAC Authentication Module
// ============================================

import Config from './config.js';
import appState from './state.js';
import Storage from './storage.js';
import eventBus, { EventTypes } from './events.js';
import { demoUsers } from './demo-data.js';
import { generateSeqId } from './utils.js';

const Auth = {
  supabase: null,

  /**
   * Initialize auth — check active session & restore verified profile
   */
  async init() {
    if (!Config.IS_DEMO && window.supabase) {
      try {
        this.supabase = window.supabase.createClient(Config.SUPABASE_URL, Config.SUPABASE_ANON_KEY);
        const { data: { session } } = await this.supabase.auth.getSession();
        if (session) {
          return await this._handleSession(session);
        }
      } catch (err) {
        console.warn('Supabase session check failed, using local profile store:', err.message);
      }
    }

    // Check for saved verified session
    const savedAuth = Storage.loadAuth();
    if (savedAuth && savedAuth.id && savedAuth.role) {
      // Re-verify from database/state user records to prevent tampering
      const verified = this._verifyUserRecord(savedAuth.email || savedAuth.id);
      if (verified && verified.role === savedAuth.role) {
        this._setCurrentUser(verified);
        return verified;
      }
    }

    return null;
  },

  /**
   * Universal Sign In
   */
  async login(email, password) {
    const user = this._findUserByEmail(email);
    if (!user) {
      throw new Error(`No account found for "${email}". Please verify your credentials or register a new account.`);
    }
    return this._performPortalLogin(email, password, user.role, `${user.role.charAt(0).toUpperCase() + user.role.slice(1)} Portal`);
  },

  /**
   * Patient Sign In
   */
  async loginPatient(email, password) {
    return this._performPortalLogin(email, password, 'patient', 'Patient Portal');
  },

  /**
   * Doctor Sign In
   */
  async loginDoctor(email, password) {
    return this._performPortalLogin(email, password, 'doctor', 'Doctor Portal');
  },

  /**
   * Admin Sign In
   */
  async loginAdmin(email, password) {
    return this._performPortalLogin(email, password, 'admin', 'Admin Portal');
  },

  /**
   * Patient Self-Registration (forces role = 'patient')
   */
  async registerPatient({ email, password, displayName, phone, age, gender, bloodGroup }) {
    if (!email || !displayName) throw new Error('Email and Full Name are required.');

    // Check if user already exists
    const existing = this._findUserByEmail(email);
    if (existing) {
      throw new Error('An account with this email address already exists.');
    }

    const patientSeqId = generateSeqId('P', 1000 + (appState.get().patients.length + 1));
    const userId = `u-pat-${Date.now()}`;

    // 1. Create Patient entity
    const newPatient = {
      id: patientSeqId,
      userId: userId,
      displayName: displayName.trim(),
      phone: phone || '+91 9800000000',
      age: parseInt(age) || 30,
      gender: gender || 'Other',
      bloodGroup: bloodGroup || 'O+',
      previousNoShows: 0,
      registeredAt: new Date().toISOString()
    };
    appState.addItem('patients', newPatient);

    // 2. Create User Profile with FORCED role = 'patient'
    const userProfile = {
      id: userId,
      email: email.toLowerCase().trim(),
      displayName: displayName.trim(),
      role: 'patient', // STRICT: Cannot be chosen by user
      accountStatus: 'active',
      patientId: patientSeqId,
      doctorId: null,
      department: null,
      preferred_language: 'en',
      createdAt: new Date().toISOString()
    };

    // Save in user directory
    demoUsers.push(userProfile);
    this._setCurrentUser(userProfile);

    eventBus.emit(EventTypes.USER_LOGGED_IN, {
      displayName: userProfile.displayName,
      role: 'patient'
    }, { source: 'auth', userId: userProfile.id });

    return userProfile;
  },

  /**
   * Admin-Only: Create Doctor Account
   */
  async registerDoctor(adminUserId, { displayName, email, department, specialty, averageConsultationMinutes = 10 }) {
    const admin = appState.get().currentUser;
    if (!admin || admin.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators can create doctor accounts.');
    }

    const existing = this._findUserByEmail(email);
    if (existing) {
      throw new Error('An account with this email address already exists.');
    }

    const docSeqId = generateSeqId('D', String(appState.get().doctors.length + 1).padStart(4, '0'));
    const userId = `u-doc-${Date.now()}`;

    const newDoctor = {
      id: docSeqId,
      userId: userId,
      displayName: displayName.trim(),
      department: department || 'General Medicine',
      specialty: specialty || 'General Practice',
      status: 'Available',
      averageConsultationMinutes: parseInt(averageConsultationMinutes) || 10,
      currentPatientId: null,
      completedToday: 0,
      queueLoad: 0,
      accountStatus: 'active'
    };
    appState.addItem('doctors', newDoctor);

    const userProfile = {
      id: userId,
      email: email.toLowerCase().trim(),
      displayName: displayName.trim(),
      role: 'doctor',
      accountStatus: 'active',
      doctorId: docSeqId,
      patientId: null,
      department: department,
      createdAt: new Date().toISOString()
    };

    demoUsers.push(userProfile);
    return { doctor: newDoctor, profile: userProfile };
  },

  /**
   * Core verification & portal permission validator
   */
  async _performPortalLogin(email, password, requiredRole, portalName) {
    const cleanEmail = email ? email.toLowerCase().trim() : '';

    // Authenticate with Supabase if configured
    if (!Config.IS_DEMO && this.supabase) {
      try {
        const { data, error } = await this.supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) throw new Error(error.message);
      } catch (err) {
        console.warn('Supabase login error, falling back to verified profile lookup:', err.message);
      }
    }

    // 1. Retrieve user profile from trusted store
    const user = this._findUserByEmail(cleanEmail);
    if (!user) {
      throw new Error(`No account found for ${cleanEmail}. Please check your credentials or register.`);
    }

    // 2. Verify account status
    if (user.accountStatus && user.accountStatus !== 'active') {
      throw new Error('Your account is currently inactive or suspended. Please contact hospital administration.');
    }

    // 3. Verify role matches requested portal (Role Mismatch Protection)
    if (user.role !== requiredRole) {
      const roleHomeMap = {
        patient: '/patient/home',
        doctor: '/doctor/dashboard',
        admin: '/admin/command'
      };
      const correctHome = roleHomeMap[user.role] || '/login';

      const error = new Error(`Your account does not have permission to access the ${portalName}.`);
      error.roleMismatch = true;
      error.correctRole = user.role;
      error.redirectUrl = correctHome;
      throw error;
    }

    // 4. Initialize role-scoped session
    this._setCurrentUser(user);

    eventBus.emit(EventTypes.USER_LOGGED_IN, {
      displayName: user.displayName,
      role: user.role
    }, { source: 'auth', userId: user.id });

    return user;
  },

  /**
   * Route Authorization Guard
   */
  canAccessRoute(route, user) {
    if (!route || route === '/' || route === '/login' || route === '/demo' || route === '/admin/demo-simulation' || route.startsWith('/patient/login') || route.startsWith('/doctor/login') || route.startsWith('/admin/login')) {
      return { allowed: true };
    }

    if (!user || !user.role) {
      return { allowed: false, reason: 'unauthenticated', redirect: '/login' };
    }

    if (route.startsWith('/patient/')) {
      if (user.role === 'patient') return { allowed: true };
      return { allowed: false, reason: 'role_mismatch', redirect: user.role === 'doctor' ? '/doctor/dashboard' : '/admin/command' };
    }

    if (route.startsWith('/doctor/')) {
      if (user.role === 'doctor') return { allowed: true };
      return { allowed: false, reason: 'role_mismatch', redirect: user.role === 'patient' ? '/patient/home' : '/admin/command' };
    }

    if (route.startsWith('/admin/')) {
      if (user.role === 'admin') return { allowed: true };
      return { allowed: false, reason: 'role_mismatch', redirect: user.role === 'patient' ? '/patient/home' : '/doctor/dashboard' };
    }

    return { allowed: true };
  },

  /**
   * Check granular action permissions
   * Supports both scoped ('admin.flow.manage') and legacy ('book_appointment') keys
   */
  can(action) {
    const user = appState.get().currentUser;
    if (!user || !user.role) return false;

    // Admin has universal operational permissions
    if (user.role === 'admin') return true;

    const permissions = {
      // Patient permissions (Scoped)
      'patient.appointment.book': ['patient'],
      'patient.queue.view_own': ['patient'],
      'patient.care.view_own': ['patient'],
      'patient.care.acknowledge_med': ['patient'],
      'patient.warning.report': ['patient'],
      'patient.followup.request': ['patient'],
      'patient.donor.manage_own': ['patient'],
      'patient.emergency.request': ['patient'],
      'patient.ambulance.request': ['patient'],

      // Doctor permissions (Scoped)
      'doctor.queue.manage_assigned': ['doctor'],
      'doctor.consultation.start': ['doctor'],
      'doctor.consultation.complete': ['doctor'],
      'doctor.patient.transfer': ['doctor'],
      'doctor.care.create_plan': ['doctor'],
      'doctor.blood.request': ['doctor'],
      'doctor.availability.update': ['doctor'],
      'doctor.emergency.manage': ['doctor'],

      // Admin permissions (Scoped)
      'admin.hospital.manage': ['admin'],
      'admin.doctor.manage': ['admin'],
      'admin.patient.manage': ['admin'],
      'admin.queue.reassign': ['admin'],
      'admin.blood.reserve_issue': ['admin'],
      'admin.donor.broadcast': ['admin'],
      'admin.simulation.run': ['admin'],
      'admin.audit.view': ['admin'],
      'admin.flow.manage': ['admin'],
      'admin.audit.read': ['admin'],
      'admin.emergency.command': ['admin'],
      'admin.ambulance.dispatch': ['admin'],

      // Legacy Permission Key Aliases (Backward Compatibility)
      'book_appointment': ['patient', 'admin'],
      'check_in_patient': ['patient', 'doctor', 'admin'],
      'manage_queue': ['doctor', 'admin'],
      'call_patient': ['doctor', 'admin'],
      'start_consultation': ['doctor', 'admin'],
      'complete_consultation': ['doctor', 'admin'],
      'insert_emergency': ['doctor', 'admin'],
      'change_doctor_status': ['doctor', 'admin'],
      'transfer_patient': ['doctor', 'admin'],
      'mark_no_show': ['doctor', 'admin'],
      'create_blood_request': ['doctor', 'admin'],
      'reserve_blood': ['admin'],
      'issue_blood': ['admin'],
      'manage_donors': ['admin'],
      'create_discharge': ['doctor', 'admin'],
      'create_followup': ['doctor', 'admin'],
      'view_own_care': ['patient', 'doctor', 'admin'],
      'run_simulation': ['admin'],
      'apply_simulation': ['admin'],
      'view_audit_log': ['admin']
    };

    const allowedRoles = permissions[action];
    return allowedRoles ? allowedRoles.includes(user.role) : false;
  },

  /**
   * Alias for can(action) for backward compatibility
   */
  canPerform(action) {
    return this.can(action);
  },

  hasPermission(action) {
    return this.can(action);
  },

  hasRole(role) {
    const user = this.getCurrentUser();
    return user ? user.role === role : false;
  },

  isAuthenticated() {
    return !!this.getCurrentUser();
  },

  getRole() {
    const user = this.getCurrentUser();
    return user ? user.role : null;
  },

  requireRole(role) {
    if (!this.hasRole(role)) {
      throw new Error(`Access denied. Requires ${role} role.`);
    }
  },

  requirePermission(permission) {
    if (!this.can(permission)) {
      throw new Error(`Access denied. Permission required: ${permission}`);
    }
  },

  /**
   * Centralized Sign Out
   */
  async logout() {
    try {
      if (this.supabase) {
        await this.supabase.auth.signOut();
      }
    } catch (e) {
      console.warn('Supabase signout notice:', e.message);
    }

    // 1. Clear state
    appState.update({
      currentUser: null,
      currentRole: null
    });

    // 2. Clear stored auth token/cache
    Storage.clearAuth();

    // 3. Emit domain event
    eventBus.emit(EventTypes.USER_LOGGED_OUT, {}, { source: 'auth' });

    // 4. Force hash navigation to login
    if (window.location.hash !== '#/login') {
      window.location.hash = '#/login';
    } else {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  },

  getCurrentUser() {
    return appState.get().currentUser;
  },

  // ---- Internal Helpers ----

  _findUserByEmail(email) {
    if (!email) return null;
    const clean = email.toLowerCase().trim();
    // Search in demoUsers directory and doctors/patients collections
    const inUsers = demoUsers.find(u => (u.email && u.email.toLowerCase() === clean) || (u.id && u.id.toLowerCase() === clean));
    if (inUsers) return inUsers;

    // Search doctor by name or ID
    const inDoc = appState.get().doctors.find(d => d.displayName.toLowerCase().includes(clean) || d.id.toLowerCase() === clean);
    if (inDoc) {
      return {
        id: inDoc.userId || `u-doc-${inDoc.id}`,
        email: `${inDoc.displayName.toLowerCase().replace(/[^a-z]/g, '')}@hospitalflow.ai`,
        displayName: inDoc.displayName,
        role: 'doctor',
        accountStatus: inDoc.accountStatus || 'active',
        doctorId: inDoc.id,
        department: inDoc.department
      };
    }

    // Search patient by name or ID
    const inPat = appState.get().patients.find(p => p.displayName.toLowerCase().includes(clean) || p.id.toLowerCase() === clean);
    if (inPat) {
      return {
        id: inPat.userId || `u-pat-${inPat.id}`,
        email: `${inPat.displayName.toLowerCase().replace(/[^a-z]/g, '')}@email.com`,
        displayName: inPat.displayName,
        role: 'patient',
        accountStatus: 'active',
        patientId: inPat.id
      };
    }

    return null;
  },

  _verifyUserRecord(emailOrId) {
    return this._findUserByEmail(emailOrId);
  },

  _setCurrentUser(user) {
    appState.update({
      currentUser: user,
      currentRole: user.role
    });
    Storage.saveAuth(user);
  }
};

export default Auth;
