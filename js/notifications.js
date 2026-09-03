// ============================================
// HospitalFlow AI — Notification Manager
// ============================================

import { generateId } from './utils.js';
import appState from './state.js';
import Storage from './storage.js';

const NotificationManager = {
  /**
   * Create a new notification
   */
  create({ type, category, priority, title, message, relatedModule = null, relatedEntityId = null }) {
    const notification = {
      id: generateId('N'),
      type,
      category,
      priority,
      title,
      message,
      read: false,
      dismissed: false,
      createdAt: new Date().toISOString(),
      relatedModule,
      relatedEntityId
    };

    appState.addItem('notifications', notification);

    // Show toast for high-priority notifications
    if (priority === 'Critical' || priority === 'High') {
      this._showToast(notification);
    }

    // Update badge
    this._updateBadge();

    return notification;
  },

  /**
   * Mark a notification as read
   */
  markRead(notificationId) {
    appState.updateItem('notifications', notificationId, { read: true });
    this._updateBadge();
  },

  /**
   * Mark all as read
   */
  markAllRead() {
    const notifications = appState.getKey('notifications');
    notifications.forEach(n => {
      if (!n.read) n.read = true;
    });
    appState.set('notifications', notifications);
    this._updateBadge();
  },

  /**
   * Dismiss a notification
   */
  dismiss(notificationId) {
    appState.updateItem('notifications', notificationId, { dismissed: true });
    this._updateBadge();
  },

  /**
   * Get unread count
   */
  getUnreadCount() {
    return (appState.getKey('notifications') || []).filter(n => !n.read && !n.dismissed).length;
  },

  /**
   * Get visible notifications (not dismissed)
   */
  getVisible() {
    return (appState.getKey('notifications') || [])
      .filter(n => !n.dismissed)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  /**
   * Show a toast notification
   */
  _showToast(notification) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const priorityClass = notification.priority === 'Critical' ? 'critical' :
      notification.priority === 'High' ? 'warning' : '';

    const iconMap = {
      Blood: 'fa-tint',
      Queue: 'fa-list-ol',
      Emergency: 'fa-exclamation-triangle',
      Care: 'fa-heartbeat',
      Operational: 'fa-cog',
      System: 'fa-info-circle',
      Reminder: 'fa-bell'
    };

    const toast = document.createElement('div');
    toast.className = `toast-item ${priorityClass}`;
    toast.innerHTML = `
      <i class="fas ${iconMap[notification.type] || 'fa-bell'} toast-icon" style="color: var(--${priorityClass === 'critical' ? 'critical' : 'primary'})"></i>
      <div class="toast-message">
        <strong>${notification.title}</strong><br>
        <span style="font-size: var(--font-size-xs); color: var(--text-secondary)">${notification.message}</span>
      </div>
      <button class="toast-close" onclick="this.parentElement.classList.add('removing'); setTimeout(() => this.parentElement.remove(), 300)">
        <i class="fas fa-times"></i>
      </button>
    `;

    container.appendChild(toast);

    // Auto-remove after 6 seconds
    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
      }
    }, 6000);
  },

  /**
   * Update the notification badge in the header
   */
  _updateBadge() {
    const badge = document.getElementById('notification-badge');
    if (!badge) return;

    const count = this.getUnreadCount();
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  },

  /**
   * Render the notification panel contents
   */
  renderPanel() {
    const container = document.getElementById('notification-list');
    if (!container) return;

    const notifications = this.getVisible();

    if (notifications.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: var(--space-8)">
          <i class="fas fa-bell-slash"></i>
          <h4>No Notifications</h4>
          <p>You're all caught up!</p>
        </div>
      `;
      return;
    }

    const iconMap = {
      Blood: 'fa-tint',
      Queue: 'fa-list-ol',
      Emergency: 'fa-exclamation-triangle',
      Care: 'fa-heartbeat',
      Operational: 'fa-cog',
      System: 'fa-info-circle',
      Reminder: 'fa-bell'
    };

    const colorMap = {
      Critical: 'var(--critical)',
      High: 'var(--warning)',
      Medium: 'var(--primary)',
      Information: 'var(--text-tertiary)'
    };

    container.innerHTML = notifications.map(n => `
      <div class="notification-item ${n.read ? '' : 'unread'} ${n.priority === 'Critical' ? 'critical' : ''}"
           data-notification-id="${n.id}"
           onclick="window.HospitalFlow.handleNotificationClick('${n.id}')">
        <div class="notification-icon" style="background: ${n.read ? 'var(--bg-muted)' : 'var(--primary-100)'}; color: ${colorMap[n.priority] || 'var(--primary)'}">
          <i class="fas ${iconMap[n.type] || 'fa-bell'}"></i>
        </div>
        <div class="notification-content">
          <div class="notification-text"><strong>${n.title}</strong></div>
          <div class="notification-text" style="color: var(--text-secondary); font-size: var(--font-size-xs)">${n.message}</div>
          <div class="notification-time">${new Date(n.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>
    `).join('');
  }
};

export default NotificationManager;
