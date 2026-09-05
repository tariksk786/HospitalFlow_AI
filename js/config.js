// ============================================
// HospitalFlow AI — Configuration
// ============================================

const Config = {
  // Supabase configuration — set these for Connected Mode
  SUPABASE_URL: 'https://caivskzmhegdsvhjalfi.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_2qrOk7jSVGxhya_1DEsjRA_mA7P8jWY',

  // Application settings
  APP_NAME: 'HospitalFlow AI',
  APP_TAGLINE: 'Intelligent Hospital Flow, Emergency Readiness & Care Continuity',
  VERSION: '1.0.0',

  // Demo mode is auto-detected when Supabase config is missing
  get IS_DEMO() {
    return !this.SUPABASE_URL || !this.SUPABASE_ANON_KEY;
  },

  // Blood inventory thresholds (units)
  BLOOD_THRESHOLDS: {
    CRITICAL: 5,
    LOW: 15,
    ADEQUATE: 15  // >= this is adequate
  },

  // Blood unit shelf life in days
  BLOOD_EXPIRY_DAYS: 35,
  BLOOD_EXPIRY_WARNING_DAYS: 7,

  // Queue / Flow settings
  DEFAULT_CONSULTATION_MINUTES: 10,
  EMERGENCY_PRIORITY_BOOST: 100,
  MAX_QUEUE_DISPLAY: 50,
  CONGESTION_THRESHOLD_MINUTES: 30,

  // Departments
  DEPARTMENTS: [
    'General Medicine',
    'Cardiology',
    'Orthopedics',
    'Neurology',
    'Dermatology',
    'Pediatrics'
  ],

  BLOOD_GROUPS: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],

  BLOOD_COMPONENTS: ['Whole Blood', 'Packed RBCs', 'Platelets', 'Fresh Frozen Plasma', 'Cryoprecipitate'],

  // Urgency levels
  URGENCY_LEVELS: ['Routine', 'Urgent', 'Emergency'],

  // Roles
  ROLES: {
    ADMIN: 'admin',
    DOCTOR: 'doctor',
    RECEPTION: 'reception',
    BLOOD_BANK: 'blood_bank',
    PATIENT: 'patient'
  },

  ROLE_LABELS: {
    admin: 'Administrator',
    doctor: 'Doctor',
    reception: 'Reception',
    blood_bank: 'Blood Bank Staff',
    patient: 'Patient'
  },

  // Notification channels
  NOTIFICATION_CHANNELS: ['in_app', 'email', 'sms', 'whatsapp'],

  // Supported languages for discharge plans
  LANGUAGES: ['English', 'Hindi', 'Marathi'],

  // Medication time slots
  MED_TIME_SLOTS: ['Morning', 'Afternoon', 'Evening', 'Night'],

  // Queue statuses
  QUEUE_STATUSES: ['Waiting', 'Called', 'Consulting', 'Completed', 'Emergency'],

  // Appointment statuses
  APPOINTMENT_STATUSES: ['Scheduled', 'Checked-In', 'In-Queue', 'Consulting', 'Completed', 'No-Show', 'Cancelled'],

  // Doctor statuses
  DOCTOR_STATUSES: ['Available', 'Consulting', 'Break', 'Unavailable'],

  // Blood request statuses
  BLOOD_REQUEST_STATUSES: ['Created', 'Checking Internal', 'Searching Sources', 'Matched', 'Reserved', 'Issued', 'Resolved', 'Escalated'],

  // Reminder statuses
  REMINDER_STATUSES: ['Scheduled', 'Delivered', 'Read', 'Acknowledged', 'Missed'],

  // Notification priorities
  NOTIFICATION_PRIORITIES: ['Critical', 'High', 'Medium', 'Information'],

  // Notification categories
  NOTIFICATION_CATEGORIES: ['Operational', 'Queue', 'Emergency', 'Blood', 'Care', 'Reminder', 'System'],

  // Donor notification wave size
  DONOR_WAVE_SIZE: 5,

  // OTP settings
  OTP_LENGTH: 6,
  OTP_EXPIRY_SECONDS: 300,

  // No-show risk thresholds
  NO_SHOW_RISK: {
    LOW: 0.2,
    MEDIUM: 0.5,
    HIGH: 0.5
  },

  // Simulation limits
  SIM_MAX_EMERGENCY: 5,
  SIM_MAX_DOCTORS_UNAVAILABLE: 3,
  SIM_MAX_ADDITIONAL_PATIENTS: 50,

  // LocalStorage keys
  STORAGE_KEYS: {
    STATE: 'hfai_state',
    AUTH: 'hfai_auth',
    EVENTS: 'hfai_events',
    NOTIFICATIONS: 'hfai_notifications',
    SETTINGS: 'hfai_settings'
  }
};

export default Config;
