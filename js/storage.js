// ============================================
// HospitalFlow AI — Storage Layer
// ============================================

import Config from './config.js';

const Storage = {
  /**
   * Save data to localStorage
   */
  save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (err) {
      console.warn('Storage save error:', err);
      return false;
    }
  },

  /**
   * Load data from localStorage
   */
  load(key, defaultValue = null) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (err) {
      console.warn('Storage load error:', err);
      return defaultValue;
    }
  },

  /**
   * Remove item from localStorage
   */
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.warn('Storage remove error:', err);
    }
  },

  /**
   * Save the entire app state
   */
  saveState(state) {
    return this.save(Config.STORAGE_KEYS.STATE, state);
  },

  /**
   * Load the saved app state
   */
  loadState() {
    return this.load(Config.STORAGE_KEYS.STATE, null);
  },

  /**
   * Save auth session info
   */
  saveAuth(auth) {
    return this.save(Config.STORAGE_KEYS.AUTH, auth);
  },

  /**
   * Load auth session info
   */
  loadAuth() {
    return this.load(Config.STORAGE_KEYS.AUTH, null);
  },

  /**
   * Clear auth session
   */
  clearAuth() {
    this.remove(Config.STORAGE_KEYS.AUTH);
  },

  /**
   * Save events history
   */
  saveEvents(events) {
    // Only save the latest 200 events to avoid storage limits
    const trimmed = events.slice(0, 200);
    return this.save(Config.STORAGE_KEYS.EVENTS, trimmed);
  },

  /**
   * Load events history
   */
  loadEvents() {
    return this.load(Config.STORAGE_KEYS.EVENTS, []);
  },

  /**
   * Save notifications
   */
  saveNotifications(notifications) {
    const trimmed = notifications.slice(0, 100);
    return this.save(Config.STORAGE_KEYS.NOTIFICATIONS, trimmed);
  },

  /**
   * Load notifications
   */
  loadNotifications() {
    return this.load(Config.STORAGE_KEYS.NOTIFICATIONS, []);
  },

  /**
   * Save language preference
   */
  saveLanguage(lang) {
    return this.save('hospitalflow_lang', lang);
  },

  /**
   * Load language preference
   */
  loadLanguage() {
    return this.load('hospitalflow_lang', 'en');
  },

  /**
   * Save registered users dictionary
   */
  saveRegisteredUsers(users) {
    return this.save('hospitalflow_registered_users', users);
  },

  /**
   * Load registered users dictionary
   */
  loadRegisteredUsers() {
    return this.load('hospitalflow_registered_users', []);
  },

  /**
   * Save entire app state alias
   */
  saveAll(state) {
    return this.saveState(state);
  },

  /**
   * Clear all HospitalFlow data
   */
  clearAll() {
    Object.values(Config.STORAGE_KEYS).forEach(key => this.remove(key));
  }
};

export default Storage;
