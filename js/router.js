// ============================================
// HospitalFlow AI — Secure Role-Based Router
// ============================================

import Auth from './auth.js';
import appState from './state.js';
import { renderAuthLanding, renderPatientLogin, renderDoctorLogin, renderAdminLogin } from './pages/auth-portal.js';
import { renderPatientPortal } from './pages/patient-portal.js';
import { renderDoctorPortal } from './pages/doctor-portal.js';
import { renderAdminPortal } from './pages/admin-portal.js';

import { renderDemoSimulation } from './pages/demo-simulation.js';

const Router = {
  currentRoute: null,

  /**
   * Initialize router and bind hash listener
   */
  init() {
    window.addEventListener('hashchange', () => {
      this.handleRoute(this.getHashRoute());
    });
    this.handleRoute(this.getHashRoute());
  },

  /**
   * Get clean hash path (defaults to '/login' or user home)
   */
  getHashRoute() {
    let hash = window.location.hash.replace('#', '').trim();
    if (!hash || hash === '') {
      const user = Auth.getCurrentUser();
      if (!user) return '/login';
      return user.role === 'patient' ? '/patient/home' :
        user.role === 'doctor' ? '/doctor/dashboard' : '/admin/command';
    }
    if (!hash.startsWith('/')) hash = '/' + hash;
    return hash;
  },

  /**
   * Programmatic Navigation
   */
  navigate(route) {
    if (!route.startsWith('/')) route = '/' + route;
    if (window.location.hash === '#' + route) {
      this.handleRoute(route);
    } else {
      window.location.hash = route;
    }
  },

  /**
   * Core Route Handler & Authorization Gatekeeper
   */
  async handleRoute(route) {
    this.currentRoute = route;
    const user = Auth.getCurrentUser();
    const appRoot = document.getElementById('app-root') || document.body;

    // 1. Check Route Authorization Guard
    const access = Auth.canAccessRoute(route, user);
    if (!access.allowed) {
      console.warn(`Access denied for route "${route}": ${access.reason}`);
      if (access.reason === 'unauthenticated') {
        this.navigate('/login');
      } else {
        alert('Access denied. You do not have permission to access this page.');
        this.navigate(access.redirect);
      }
      return;
    }

    // 2. Render Matching View with Authorization Flash Prevention
    appRoot.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><span>Loading Authorized Workspace...</span></div>';

    requestAnimationFrame(() => {
      try {
        if (route === '/' || route === '/login') {
          renderAuthLanding(appRoot);
        } else if (route === '/demo') {
          renderDemoSimulation(appRoot);
        } else if (route === '/patient/login') {
          renderPatientLogin(appRoot);
        } else if (route === '/doctor/login') {
          renderDoctorLogin(appRoot);
        } else if (route === '/admin/login') {
          renderAdminLogin(appRoot);
        } else if (route.startsWith('/patient/')) {
          const subRoute = route.replace('/patient/', '') || 'home';
          renderPatientPortal(appRoot, subRoute);
        } else if (route.startsWith('/doctor/')) {
          const subRoute = route.replace('/doctor/', '') || 'dashboard';
          renderDoctorPortal(appRoot, subRoute);
        } else if (route.startsWith('/admin/')) {
          const subRoute = route.replace('/admin/', '') || 'command';
          renderAdminPortal(appRoot, subRoute);
        } else {
          // Unknown route -> redirect to role home or login
          if (user) {
            const roleHome = user.role === 'patient' ? '/patient/home' :
              user.role === 'doctor' ? '/doctor/dashboard' : '/admin/command';
            this.navigate(roleHome);
          } else {
            this.navigate('/login');
          }
        }
      } catch (err) {
        console.error('Routing render error:', err);
        appRoot.innerHTML = `
          <div class="empty-state" style="padding: var(--space-8)">
            <i class="fas fa-exclamation-triangle" style="color: var(--critical)"></i>
            <h4>Navigation Error</h4>
            <p>${err.message}</p>
            <button class="btn btn-primary" onclick="window.HospitalFlow.router.navigate('/login')">Return to Login</button>
          </div>
        `;
      }
    });
  }
};

export default Router;
