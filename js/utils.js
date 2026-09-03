// ============================================
// HospitalFlow AI — Utility Functions
// ============================================

/** Generate a unique ID with optional prefix */
export function generateId(prefix = '') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}-${timestamp}${random}` : `${timestamp}${random}`;
}

/** Generate a formatted sequential ID like P-1042 */
export function generateSeqId(prefix, number) {
  return `${prefix}-${String(number).padStart(4, '0')}`;
}

/** Format date to locale string */
export function formatDate(date, options = {}) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '—';
  const defaults = { year: 'numeric', month: 'short', day: 'numeric' };
  return d.toLocaleDateString('en-IN', { ...defaults, ...options });
}

/** Format time */
export function formatTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

/** Format date and time */
export function formatDateTime(date) {
  return `${formatDate(date)} ${formatTime(date)}`;
}

/** Relative time string (e.g., "5 min ago") */
export function timeAgo(date) {
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(d);
}

/** Clamp a number between min and max */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/** Deep clone an object */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/** Debounce function */
export function debounce(fn, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/** Throttle function */
export function throttle(fn, limit = 200) {
  let inThrottle = false;
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/** Safely escape HTML to prevent XSS */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** Safely set text content (no innerHTML for untrusted data) */
export function safeText(element, text) {
  if (element) element.textContent = text;
}

/** Create DOM element with attributes */
export function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') el.className = value;
    else if (key === 'textContent') el.textContent = value;
    else if (key === 'innerHTML') el.innerHTML = value; // only for trusted content
    else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else el.setAttribute(key, value);
  }
  children.forEach(child => {
    if (typeof child === 'string') el.appendChild(document.createTextNode(child));
    else if (child instanceof Node) el.appendChild(child);
  });
  return el;
}

/** Get initials from name */
export function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/** Validate email */
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Round to decimal places */
export function round(num, decimals = 1) {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/** Get a deterministic color for a string (for avatars) */
export function stringToColor(str) {
  const colors = [
    '#0EA5E9', '#10B981', '#6366F1', '#F59E0B', '#EF4444',
    '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#3B82F6'
  ];
  let hash = 0;
  for (let i = 0; i < (str || '').length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/** Calculate days between two dates */
export function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
}

/** Check if date is today */
export function isToday(date) {
  const d = new Date(date);
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

/** Generate a random integer between min and max (inclusive) with seed support */
export function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Format minutes to human-readable */
export function formatMinutes(mins) {
  if (mins < 1) return '< 1 min';
  if (mins < 60) return `${Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Pluralize a word */
export function pluralize(count, singular, plural) {
  return count === 1 ? singular : (plural || singular + 's');
}

/** Sort array by key */
export function sortBy(arr, key, desc = false) {
  return [...arr].sort((a, b) => {
    const va = typeof key === 'function' ? key(a) : a[key];
    const vb = typeof key === 'function' ? key(b) : b[key];
    if (va < vb) return desc ? 1 : -1;
    if (va > vb) return desc ? -1 : 1;
    return 0;
  });
}

/** Group array by key */
export function groupBy(arr, key) {
  return arr.reduce((groups, item) => {
    const k = typeof key === 'function' ? key(item) : item[key];
    (groups[k] = groups[k] || []).push(item);
    return groups;
  }, {});
}

/** Simple hash for deterministic values */
export function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
