// ============================================
// HospitalFlow AI — Synthetic Demo Data
// Standardized Multi-Department Seeded Dataset
// ============================================

import Config from './config.js';
import { generateSeqId } from './utils.js';

/** Helper: date relative to today */
function relDate(dayOffset, hour = 9, min = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

function today(hour = 9, min = 0) {
  return relDate(0, hour, min);
}

// ============================================
// DOCTORS (12 doctors across 6 departments)
// ============================================
const doctors = [
  { id: 'D-0001', userId: 'u-doc-1', displayName: 'Dr. Aarav Sharma', department: 'General Medicine', specialty: 'Internal Medicine & Trauma Response', status: 'Available', averageConsultationMinutes: 9, currentPatientId: null, completedToday: 4, queueLoad: 3 },
  { id: 'D-0002', userId: 'u-doc-2', displayName: 'Dr. Priya Patel', department: 'General Medicine', specialty: 'Family Medicine & Emergency Triage', status: 'Consulting', averageConsultationMinutes: 11, currentPatientId: 'P-1002', completedToday: 3, queueLoad: 4 },
  { id: 'D-0003', userId: 'u-doc-3', displayName: 'Dr. Rajesh Mehta', department: 'Cardiology', specialty: 'Interventional Cardiology', status: 'Available', averageConsultationMinutes: 14, currentPatientId: null, completedToday: 2, queueLoad: 3 },
  { id: 'D-0004', userId: 'u-doc-4', displayName: 'Dr. Sunita Reddy', department: 'Cardiology', specialty: 'Cardiac Electrophysiology', status: 'Consulting', averageConsultationMinutes: 12, currentPatientId: 'P-1005', completedToday: 3, queueLoad: 2 },
  { id: 'D-0005', userId: 'u-doc-5', displayName: 'Dr. Vikram Singh', department: 'Orthopedics', specialty: 'Joint Replacement & Trauma', status: 'Available', averageConsultationMinutes: 10, currentPatientId: null, completedToday: 5, queueLoad: 2 },
  { id: 'D-0006', userId: 'u-doc-6', displayName: 'Dr. Anita Desai', department: 'Orthopedics', specialty: 'Sports Medicine', status: 'Break', averageConsultationMinutes: 8, currentPatientId: null, completedToday: 4, queueLoad: 0 },
  { id: 'D-0007', userId: 'u-doc-7', displayName: 'Dr. Manish Gupta', department: 'Neurology', specialty: 'Clinical Neurology & Stroke Response', status: 'Available', averageConsultationMinutes: 15, currentPatientId: null, completedToday: 2, queueLoad: 2 },
  { id: 'D-0008', userId: 'u-doc-8', displayName: 'Dr. Kavita Nair', department: 'Neurology', specialty: 'Neuro-psychiatry', status: 'Consulting', averageConsultationMinutes: 13, currentPatientId: 'P-1009', completedToday: 1, queueLoad: 1 },
  { id: 'D-0009', userId: 'u-doc-9', displayName: 'Dr. Rohit Kumar', department: 'Dermatology', specialty: 'Clinical Dermatology', status: 'Available', averageConsultationMinutes: 7, currentPatientId: null, completedToday: 6, queueLoad: 2 },
  { id: 'D-0010', userId: 'u-doc-10', displayName: 'Dr. Meera Joshi', department: 'Dermatology', specialty: 'Cosmetic Dermatology', status: 'Available', averageConsultationMinutes: 8, currentPatientId: null, completedToday: 5, queueLoad: 1 },
  { id: 'D-0011', userId: 'u-doc-11', displayName: 'Dr. Sanjay Verma', department: 'Pediatrics', specialty: 'General Pediatrics', status: 'Consulting', averageConsultationMinutes: 10, currentPatientId: 'P-1011', completedToday: 3, queueLoad: 2 },
  { id: 'D-0012', userId: 'u-doc-12', displayName: 'Dr. Pooja Bhatt', department: 'Pediatrics', specialty: 'Pediatric Pulmonology', status: 'Available', averageConsultationMinutes: 11, currentPatientId: null, completedToday: 2, queueLoad: 2 },
];

// ============================================
// PATIENTS (Standardized core 10 demo patients + extended pool)
// ============================================
const corePatientSeeds = [
  { id: 'P-1001', displayName: 'Amit Kumar', phone: '+91 9876543214', age: 34, gender: 'Male', bloodGroup: 'O+', department: 'General Medicine', status: 'Waiting' },
  { id: 'P-1002', displayName: 'Neha Patil', phone: '+91 9876543215', age: 29, gender: 'Female', bloodGroup: 'B+', department: 'General Medicine', status: 'Consulting' },
  { id: 'P-1003', displayName: 'Rahul Verma', phone: '+91 9876543216', age: 42, gender: 'Male', bloodGroup: 'A+', department: 'General Medicine', status: 'Waiting' },
  { id: 'P-1004', displayName: 'Priya Sharma', phone: '+91 9876543217', age: 26, gender: 'Female', bloodGroup: 'AB+', department: 'General Medicine', status: 'Waiting' },
  { id: 'P-1005', displayName: 'Arjun Mehta', phone: '+91 9876543218', age: 58, gender: 'Male', bloodGroup: 'O-', department: 'Cardiology', status: 'Consulting' },
  { id: 'P-1006', displayName: 'Sneha Joshi', phone: '+91 9876543219', age: 31, gender: 'Female', bloodGroup: 'A-', department: 'Cardiology', status: 'Waiting' },
  { id: 'P-1007', displayName: 'Rohan Singh', phone: '+91 9876543220', age: 45, gender: 'Male', bloodGroup: 'B-', department: 'Orthopedics', status: 'Waiting' },
  { id: 'P-1008', displayName: 'Kavya Deshmukh', phone: '+91 9876543221', age: 38, gender: 'Female', bloodGroup: 'O+', department: 'Orthopedics', status: 'Waiting' },
  { id: 'P-1009', displayName: 'Sameer Khan', phone: '+91 9876543222', age: 27, gender: 'Male', bloodGroup: 'AB-', department: 'Neurology', status: 'Consulting' },
  { id: 'P-1010', displayName: 'Anjali Rao', phone: '+91 9876543223', age: 33, gender: 'Female', bloodGroup: 'B+', department: 'Dermatology', status: 'Waiting' }
];

const patients = [];
corePatientSeeds.forEach((cp, i) => {
  patients.push({
    id: cp.id,
    userId: `u-pat-${i + 1}`,
    displayName: cp.displayName,
    phone: cp.phone,
    age: cp.age,
    gender: cp.gender,
    bloodGroup: cp.bloodGroup,
    previousNoShows: 0,
    registeredAt: relDate(-30 - i)
  });
});

// Additional pool up to 30 patients
const additionalNames = [
  'Deepak Verma', 'Pooja Singh', 'Suresh Mehta', 'Anjali Desai', 'Rahul Joshi',
  'Priyanka Bhatt', 'Vijay Kumar', 'Rekha Iyer', 'Anil Mishra', 'Sunita Rao',
  'Manoj Tiwari', 'Divya Kapoor', 'Sanjay Pillai', 'Geeta Chauhan', 'Kiran Bhat',
  'Nisha Pandey', 'Rajan Shetty', 'Meenakshi Das', 'Ashok Malhotra', 'Lakshmi Venkatesh'
];

additionalNames.forEach((name, i) => {
  const pid = generateSeqId('P', 1011 + i);
  patients.push({
    id: pid,
    userId: `u-pat-${11 + i}`,
    displayName: name,
    phone: `+91 98${String(76543210 + (i + 11) * 111).slice(0, 8)}`,
    age: 22 + (i * 3) % 50,
    gender: i % 2 === 0 ? 'Male' : 'Female',
    bloodGroup: Config.BLOOD_GROUPS[i % 8],
    previousNoShows: i % 5 === 0 ? 1 : 0,
    registeredAt: relDate(-20 - i)
  });
});

// ============================================
// APPOINTMENTS (Organized by Department)
// ============================================
const appointments = [
  // General Medicine
  { id: 'APT-2201', patientId: 'P-1001', doctorId: 'D-0001', department: 'General Medicine', status: 'In-Queue', scheduledTime: today(9, 30), predictedStart: today(9, 35), predictedEnd: today(9, 44), actualStart: null, actualEnd: null, priority: 'normal', noShowRisk: 'Low', symptom_original_text: 'Mild fever, dry cough, seasonal cold' },
  { id: 'APT-2202', patientId: 'P-1002', doctorId: 'D-0002', department: 'General Medicine', status: 'Consulting', scheduledTime: today(10, 0), predictedStart: today(10, 5), predictedEnd: today(10, 16), actualStart: today(10, 8), actualEnd: null, priority: 'normal', noShowRisk: 'Low', symptom_original_text: 'Fatigue, body ache, low energy' },
  { id: 'APT-2203', patientId: 'P-1003', doctorId: 'D-0001', department: 'General Medicine', status: 'In-Queue', scheduledTime: today(10, 30), predictedStart: today(10, 35), predictedEnd: today(10, 44), actualStart: null, actualEnd: null, priority: 'normal', noShowRisk: 'Medium', symptom_original_text: 'Stomach ache and acid reflux' },
  { id: 'APT-2204', patientId: 'P-1004', doctorId: 'D-0001', department: 'General Medicine', status: 'In-Queue', scheduledTime: today(10, 45), predictedStart: today(10, 50), predictedEnd: today(11, 0), actualStart: null, actualEnd: null, priority: 'normal', noShowRisk: 'Low', symptom_original_text: 'Throat irritation and mild headache' },

  // Cardiology
  { id: 'APT-2205', patientId: 'P-1005', doctorId: 'D-0004', department: 'Cardiology', status: 'Consulting', scheduledTime: today(9, 45), predictedStart: today(10, 0), predictedEnd: today(10, 12), actualStart: today(10, 2), actualEnd: null, priority: 'normal', noShowRisk: 'Low', symptom_original_text: 'Palpitations after climbing stairs' },
  { id: 'APT-2206', patientId: 'P-1006', doctorId: 'D-0003', department: 'Cardiology', status: 'In-Queue', scheduledTime: today(10, 15), predictedStart: today(10, 30), predictedEnd: today(10, 44), actualStart: null, actualEnd: null, priority: 'normal', noShowRisk: 'Low', symptom_original_text: 'Hypertension checkup and ECG review' },

  // Orthopedics
  { id: 'APT-2207', patientId: 'P-1007', doctorId: 'D-0005', department: 'Orthopedics', status: 'In-Queue', scheduledTime: today(10, 0), predictedStart: today(10, 15), predictedEnd: today(10, 25), actualStart: null, actualEnd: null, priority: 'normal', noShowRisk: 'Low', symptom_original_text: 'Lower back stiffness and knee pain' },
  { id: 'APT-2208', patientId: 'P-1008', doctorId: 'D-0005', department: 'Orthopedics', status: 'In-Queue', scheduledTime: today(10, 30), predictedStart: today(10, 25), predictedEnd: today(10, 35), actualStart: null, actualEnd: null, priority: 'normal', noShowRisk: 'Medium', symptom_original_text: 'Right ankle sprain recovery follow-up' },

  // Neurology
  { id: 'APT-2209', patientId: 'P-1009', doctorId: 'D-0008', department: 'Neurology', status: 'Consulting', scheduledTime: today(10, 0), predictedStart: today(10, 10), predictedEnd: today(10, 23), actualStart: today(10, 12), actualEnd: null, priority: 'normal', noShowRisk: 'Low', symptom_original_text: 'Migraine episodes and light sensitivity' },

  // Dermatology
  { id: 'APT-2210', patientId: 'P-1010', doctorId: 'D-0009', department: 'Dermatology', status: 'In-Queue', scheduledTime: today(10, 0), predictedStart: today(10, 10), predictedEnd: today(10, 17), actualStart: null, actualEnd: null, priority: 'normal', noShowRisk: 'Low', symptom_original_text: 'Skin allergy rash on forearms' },

  // Pediatrics
  { id: 'APT-2211', patientId: 'P-1011', doctorId: 'D-0011', department: 'Pediatrics', status: 'Consulting', scheduledTime: today(10, 0), predictedStart: today(10, 5), predictedEnd: today(10, 15), actualStart: today(10, 7), actualEnd: null, priority: 'normal', noShowRisk: 'Low', symptom_original_text: 'Pediatric vaccination and wellness check' }
];

// ============================================
// QUEUE ENTRIES (Multi-Department realistic queues)
// ============================================
const queueEntries = [
  // General Medicine Queue
  { id: 'GM-18', patientId: 'P-1001', doctorId: 'D-0001', department: 'General Medicine', appointmentId: 'APT-2201', position: 1, status: 'Waiting', priority: 'Routine', estimatedWait: 9, enteredAt: today(9, 20), calledAt: null, consultingAt: null, completedAt: null },
  { id: 'GM-19', patientId: 'P-1003', doctorId: 'D-0001', department: 'General Medicine', appointmentId: 'APT-2203', position: 2, status: 'Waiting', priority: 'Routine', estimatedWait: 18, enteredAt: today(9, 35), calledAt: null, consultingAt: null, completedAt: null },
  { id: 'GM-20', patientId: 'P-1004', doctorId: 'D-0001', department: 'General Medicine', appointmentId: 'APT-2204', position: 3, status: 'Waiting', priority: 'Routine', estimatedWait: 27, enteredAt: today(9, 45), calledAt: null, consultingAt: null, completedAt: null },
  { id: 'GM-17', patientId: 'P-1002', doctorId: 'D-0002', department: 'General Medicine', appointmentId: 'APT-2202', position: 0, status: 'Consulting', priority: 'Routine', estimatedWait: 0, enteredAt: today(9, 10), calledAt: today(10, 5), consultingAt: today(10, 8), completedAt: null },

  // Cardiology Queue
  { id: 'CARD-04', patientId: 'P-1005', doctorId: 'D-0004', department: 'Cardiology', appointmentId: 'APT-2205', position: 0, status: 'Consulting', priority: 'Routine', estimatedWait: 0, enteredAt: today(9, 25), calledAt: today(10, 0), consultingAt: today(10, 2), completedAt: null },
  { id: 'CARD-05', patientId: 'P-1006', doctorId: 'D-0003', department: 'Cardiology', appointmentId: 'APT-2206', position: 1, status: 'Waiting', priority: 'Routine', estimatedWait: 14, enteredAt: today(9, 40), calledAt: null, consultingAt: null, completedAt: null },

  // Orthopedics Queue
  { id: 'ORTHO-02', patientId: 'P-1007', doctorId: 'D-0005', department: 'Orthopedics', appointmentId: 'APT-2207', position: 1, status: 'Waiting', priority: 'Routine', estimatedWait: 10, enteredAt: today(9, 30), calledAt: null, consultingAt: null, completedAt: null },
  { id: 'ORTHO-03', patientId: 'P-1008', doctorId: 'D-0005', department: 'Orthopedics', appointmentId: 'APT-2208', position: 2, status: 'Waiting', priority: 'Routine', estimatedWait: 20, enteredAt: today(9, 50), calledAt: null, consultingAt: null, completedAt: null },

  // Neurology Queue
  { id: 'NEURO-01', patientId: 'P-1009', doctorId: 'D-0008', department: 'Neurology', appointmentId: 'APT-2209', position: 0, status: 'Consulting', priority: 'Routine', estimatedWait: 0, enteredAt: today(9, 30), calledAt: today(10, 10), consultingAt: today(10, 12), completedAt: null },

  // Dermatology Queue
  { id: 'DERM-01', patientId: 'P-1010', doctorId: 'D-0009', department: 'Dermatology', appointmentId: 'APT-2210', position: 1, status: 'Waiting', priority: 'Routine', estimatedWait: 7, enteredAt: today(9, 45), calledAt: null, consultingAt: null, completedAt: null }
];

// ============================================
// INITIAL SEEDED EMERGENCY CASES (Requirement 21)
// ============================================
const emergencyCases = [
  {
    id: 'EM-201',
    caseId: 'E-201',
    patientId: 'P-1081',
    patientName: 'Rameshwar Gupta',
    priority: 'P2 - Urgent',
    severity: 'Urgent',
    department: 'General Medicine',
    symptoms: 'Severe Chest Pain & Dizziness',
    transportMode: 'Private Vehicle',
    etaMinutes: 0,
    status: 'AWAITING_DOCTOR',
    doctorId: null,
    doctorName: null,
    createdAt: new Date(Date.now() - 15 * 60000).toISOString()
  },
  {
    id: 'EM-202',
    caseId: 'E-202',
    patientId: 'P-1082',
    patientName: 'Sunita Deshmukh',
    priority: 'P3 - Priority',
    severity: 'Priority',
    department: 'Orthopedics',
    symptoms: 'Moderate Fracture Injury to Left Forearm',
    transportMode: 'Ambulance (AMB-02)',
    etaMinutes: 12,
    status: 'INCOMING',
    doctorId: null,
    doctorName: null,
    createdAt: new Date(Date.now() - 8 * 60000).toISOString()
  },
  {
    id: 'EM-203',
    caseId: 'E-203',
    patientId: 'P-1083',
    patientName: 'Vikramaditya Rao',
    priority: 'P1 - Critical Emergency',
    severity: 'Critical',
    department: 'General Medicine',
    symptoms: 'Acute Respiratory Distress & Major Bleeding',
    transportMode: 'Ambulance (AMB-01)',
    etaMinutes: 0,
    status: 'EMERGENCY_ACTIVE',
    doctorId: 'D-0001',
    doctorName: 'Dr. Aarav Sharma',
    createdAt: new Date(Date.now() - 22 * 60000).toISOString(),
    assignedAt: new Date(Date.now() - 20 * 60000).toISOString()
  }
];

// ============================================
// BLOOD INVENTORY (Requirement 22: Exact 8 Blood Groups)
// ============================================
const bloodInventory = [
  { id: 'BI-001', facilityId: 'FAC-001', bloodGroup: 'A+', component: 'Whole Blood', units: 8, available: 5, reservedUnits: 2, expiringSoon: 1, collectionDate: relDate(-10), expiryDate: relDate(25), status: 'Adequate', updatedAt: today(8, 0) },
  { id: 'BI-002', facilityId: 'FAC-001', bloodGroup: 'A-', component: 'Whole Blood', units: 3, available: 2, reservedUnits: 1, expiringSoon: 0, collectionDate: relDate(-15), expiryDate: relDate(20), status: 'Low', updatedAt: today(8, 0) },
  { id: 'BI-003', facilityId: 'FAC-001', bloodGroup: 'B+', component: 'Whole Blood', units: 7, available: 4, reservedUnits: 2, expiringSoon: 1, collectionDate: relDate(-8), expiryDate: relDate(27), status: 'Adequate', updatedAt: today(8, 0) },
  { id: 'BI-004', facilityId: 'FAC-001', bloodGroup: 'B-', component: 'Whole Blood', units: 2, available: 1, reservedUnits: 1, expiringSoon: 0, collectionDate: relDate(-20), expiryDate: relDate(15), status: 'Low', updatedAt: today(8, 0) },
  { id: 'BI-005', facilityId: 'FAC-001', bloodGroup: 'AB+', component: 'Whole Blood', units: 4, available: 3, reservedUnits: 1, expiringSoon: 0, collectionDate: relDate(-5), expiryDate: relDate(30), status: 'Low', updatedAt: today(8, 0) },
  { id: 'BI-006', facilityId: 'FAC-001', bloodGroup: 'AB-', component: 'Whole Blood', units: 1, available: 1, reservedUnits: 0, expiringSoon: 0, collectionDate: relDate(-25), expiryDate: relDate(10), status: 'Critical', updatedAt: today(8, 0) },
  { id: 'BI-007', facilityId: 'FAC-001', bloodGroup: 'O+', component: 'Whole Blood', units: 9, available: 6, reservedUnits: 2, expiringSoon: 1, collectionDate: relDate(-3), expiryDate: relDate(32), status: 'Adequate', updatedAt: today(8, 0) },
  { id: 'BI-008', facilityId: 'FAC-001', bloodGroup: 'O-', component: 'Whole Blood', units: 3, available: 2, reservedUnits: 1, expiringSoon: 0, collectionDate: relDate(-18), expiryDate: relDate(17), status: 'Critical', updatedAt: today(8, 0) }
];

// ============================================
// FACILITIES (Source hospitals/blood banks)
// ============================================
const facilities = [
  { id: 'FAC-001', name: 'HospitalFlow Central Hospital', type: 'Hospital', city: 'Mumbai', latitude: 19.076, longitude: 72.8777, operationalStatus: 'Active', distance: 0 },
  { id: 'FAC-002', name: 'City Blood Bank', type: 'Blood Bank', city: 'Mumbai', latitude: 19.082, longitude: 72.890, operationalStatus: 'Active', distance: 4.7 },
  { id: 'FAC-003', name: 'Shree Hospital', type: 'Hospital', city: 'Mumbai', latitude: 19.065, longitude: 72.865, operationalStatus: 'Active', distance: 2.3 },
  { id: 'FAC-004', name: 'Metro General Hospital', type: 'Hospital', city: 'Mumbai', latitude: 19.095, longitude: 72.910, operationalStatus: 'Active', distance: 7.1 },
  { id: 'FAC-005', name: 'Regional Blood Centre', type: 'Blood Bank', city: 'Mumbai', latitude: 19.055, longitude: 72.840, operationalStatus: 'Active', distance: 5.9 }
];

const externalInventory = [
  { facilityId: 'FAC-002', bloodGroup: 'O-', component: 'Whole Blood', units: 8, reservedUnits: 2, expiryDate: relDate(20) },
  { facilityId: 'FAC-002', bloodGroup: 'A+', component: 'Whole Blood', units: 15, reservedUnits: 3, expiryDate: relDate(25) },
  { facilityId: 'FAC-002', bloodGroup: 'B+', component: 'Whole Blood', units: 12, reservedUnits: 1, expiryDate: relDate(22) },
  { facilityId: 'FAC-003', bloodGroup: 'O-', component: 'Whole Blood', units: 4, reservedUnits: 1, expiryDate: relDate(15) },
  { facilityId: 'FAC-004', bloodGroup: 'O-', component: 'Whole Blood', units: 6, reservedUnits: 3, expiryDate: relDate(12) },
  { facilityId: 'FAC-005', bloodGroup: 'O-', component: 'Whole Blood', units: 10, reservedUnits: 4, expiryDate: relDate(22) }
];

// ============================================
// BLOOD REQUESTS
// ============================================
const bloodRequests = [
  { id: 'BR-019', patientId: 'P-1083', bloodGroup: 'O-', component: 'Whole Blood', units: 2, urgency: 'Emergency', department: 'General Medicine', requestingHospital: 'HospitalFlow Central Hospital', status: 'Reserved', matchedFacilityId: 'FAC-001', createdAt: today(9, 15), resolvedAt: null },
  { id: 'BR-020', patientId: 'P-1005', bloodGroup: 'O-', component: 'Packed RBCs', units: 1, urgency: 'Urgent', department: 'Cardiology', requestingHospital: 'HospitalFlow Central Hospital', status: 'Checking Internal', matchedFacilityId: null, createdAt: today(9, 45), resolvedAt: null }
];

// ============================================
// DONORS (25 donors)
// ============================================
const donors = [];
const donorNames = [
  'Rajiv Menon', 'Sapna Thakur', 'Arun Patil', 'Lalita Deshpande', 'Gaurav Shah',
  'Bhavna Chopra', 'Harish Yadav', 'Nandini Murthy', 'Vishal Garg', 'Rashmi Srinivasan',
  'Alok Banerjee', 'Swati Kulkarni', 'Dinesh Choudhary', 'Padma Ramachandran', 'Yogesh Tiwari',
  'Jyoti Agarwal', 'Mahesh Naik', 'Usha Bhat', 'Pranav Solanki', 'Chitra Nambiar',
  'Sameer Dhawan', 'Ritu Gupta', 'Ajay Thatte', 'Deepa Iyer', 'Kunal Vaidya'
];

const localities = ['Andheri', 'Bandra', 'Dadar', 'Juhu', 'Malad', 'Goregaon', 'Borivali', 'Vile Parle', 'Santacruz', 'Kurla'];

for (let i = 0; i < 25; i++) {
  donors.push({
    id: generateSeqId('DN', 101 + i),
    userId: null,
    displayName: donorNames[i],
    bloodGroup: Config.BLOOD_GROUPS[i % 8],
    verified: i < 20,
    lastDonation: relDate(-90 - (i * 15)),
    eligibility: i < 18 ? 'Eligible' : i < 22 ? 'Cooldown' : 'Deferred',
    locality: localities[i % localities.length],
    contactPreference: i % 3 === 0 ? 'SMS' : i % 3 === 1 ? 'WhatsApp' : 'Phone',
    available: i < 20,
    phone: `+91 97${String(65432100 + i * 222).slice(0, 8)}`,
    notifiedForRequestId: null,
    notificationWave: null,
    notificationStatus: null,
    otpCode: null,
    otpVerified: false
  });
}

// ============================================
// DISCHARGE PLANS
// ============================================
const dischargePlans = [
  {
    id: 'DP-001',
    patientId: 'P-1001',
    approvedBy: 'D-0001',
    dischargeDate: today(12, 0),
    medications: [
      { name: 'Paracetamol 500mg', dosage: '1 tablet', timeSlot: 'Morning', duration: '5 days', instructions: 'After food' },
      { name: 'Paracetamol 500mg', dosage: '1 tablet', timeSlot: 'Night', duration: '5 days', instructions: 'After food' },
      { name: 'Omeprazole 20mg', dosage: '1 capsule', timeSlot: 'Morning', duration: '7 days', instructions: 'Before food, on empty stomach' },
      { name: 'Cetirizine 10mg', dosage: '1 tablet', timeSlot: 'Night', duration: '5 days', instructions: 'After food' }
    ],
    dietPlan: 'Light meals, avoid spicy and oily food. Increase fluid intake. Include fresh fruits and vegetables.',
    followUp: { department: 'General Medicine', doctorId: 'D-0001', date: relDate(7, 10, 0), time: '10:00 AM' },
    warningSigns: [
      'Persistent fever above 101°F for more than 2 days',
      'Severe headache or dizziness',
      'Difficulty breathing or chest pain',
      'Allergic reaction (rash, swelling, difficulty breathing)'
    ],
    instructions: 'Take rest for 3 days. Avoid strenuous physical activity. Complete the full course of antibiotics. Stay hydrated.',
    language: 'English',
    active: true,
    caregiverShared: false,
    createdAt: today(12, 0)
  }
];

const reminders = [
  { id: 'REM-001', patientId: 'P-1001', type: 'Medication', message: 'Time to take Paracetamol 500mg (Morning dose)', scheduledFor: today(8, 0), status: 'Acknowledged', acknowledgedAt: today(8, 15) },
  { id: 'REM-002', patientId: 'P-1001', type: 'Medication', message: 'Time to take Omeprazole 20mg (Morning dose)', scheduledFor: today(7, 30), status: 'Acknowledged', acknowledgedAt: today(7, 45) },
  { id: 'REM-003', patientId: 'P-1001', type: 'Medication', message: 'Time to take Paracetamol 500mg (Night dose)', scheduledFor: today(21, 0), status: 'Scheduled', acknowledgedAt: null },
  { id: 'REM-004', patientId: 'P-1001', type: 'Medication', message: 'Time to take Cetirizine 10mg (Night dose)', scheduledFor: today(21, 0), status: 'Scheduled', acknowledgedAt: null }
];

const followUps = [
  { id: 'FU-001', patientId: 'P-1001', department: 'General Medicine', doctorId: 'D-0001', date: relDate(7, 10, 0), time: '10:00 AM', status: 'Scheduled', dischargePlanId: 'DP-001', appointmentId: null }
];

const simulationScenarios = [
  {
    id: 'SIM-006',
    name: 'Peak Hour Stress Test',
    inputParameters: { emergencyPatients: 3, doctorsUnavailable: 1, additionalPatients: 15, department: 'All' },
    baselineResults: { avgWait: 18, peakCongestion: 'Cardiology', longestQueue: 8, activeDoctorCapacity: 10 },
    simulatedResults: { avgWait: 34, peakCongestion: 'Cardiology', longestQueue: 14, activeDoctorCapacity: 9 },
    recommendations: [
      'Open additional consultation room for Cardiology',
      'Temporarily redistribute 2 General Medicine patients',
      'Stagger non-urgent afternoon appointments by 15 minutes'
    ],
    createdBy: 'admin',
    createdAt: relDate(-2, 14, 0)
  }
];

const notifications = [
  { id: 'N-001', type: 'Blood', category: 'Emergency', priority: 'Critical', title: 'Critical Blood Stock', message: 'O- blood stock is critically low: 2 usable units remaining', read: false, dismissed: false, createdAt: today(9, 0), relatedModule: 'emergency', relatedEntityId: 'BI-008' },
  { id: 'N-002', type: 'Emergency', category: 'Emergency', priority: 'Critical', title: 'Emergency Bay Ready', message: 'Trauma Room 1 standby for incoming pre-arrival cases', read: false, dismissed: false, createdAt: today(9, 10), relatedModule: 'emergency', relatedEntityId: 'EM-203' }
];

const initialEvents = [
  { id: 'evt-init-1', type: 'USER_LOGGED_IN', timestamp: today(8, 0), payload: { displayName: 'Admin User', role: 'admin' }, source: 'auth', userId: 'u-admin', entityId: null },
  { id: 'evt-init-2', type: 'BLOOD_STOCK_CRITICAL', timestamp: today(9, 0), payload: { bloodGroup: 'O-', availableUnits: 2 }, source: 'blood-engine', userId: null, entityId: 'BI-008' },
  { id: 'evt-init-3', type: 'EMERGENCY_CASE_ASSIGNED', timestamp: today(9, 20), payload: { caseId: 'E-203', patientName: 'Vikramaditya Rao', doctorId: 'D-0001', doctorName: 'Dr. Aarav Sharma', priority: 'P1 - Critical Emergency' }, source: 'flow-engine', userId: 'u-admin', entityId: 'EM-203' }
];

const medicationTracking = {
  'P-1001': {
    totalDoses: 8,
    takenDoses: 4,
    missedDoses: 0,
    history: [
      { medication: 'Paracetamol 500mg', timeSlot: 'Morning', date: relDate(-1), taken: true, takenAt: relDate(-1, 8, 10) },
      { medication: 'Omeprazole 20mg', timeSlot: 'Morning', date: relDate(-1), taken: true, takenAt: relDate(-1, 7, 45) },
      { medication: 'Paracetamol 500mg', timeSlot: 'Night', date: relDate(-1), taken: true, takenAt: relDate(-1, 21, 15) },
      { medication: 'Cetirizine 10mg', timeSlot: 'Night', date: relDate(-1), taken: true, takenAt: relDate(-1, 21, 20) }
    ]
  }
};

const demoUsers = [
  { id: 'u-admin', email: 'admin@hospitalflow.ai', displayName: 'Admin User', role: 'admin', department: null, phone: '+91 9876543210' },
  { id: 'u-doc-1', email: 'dr.sharma@hospitalflow.ai', displayName: 'Dr. Aarav Sharma', role: 'doctor', department: 'General Medicine', phone: '+91 9876543211', doctorId: 'D-0001' },
  { id: 'u-doc-2', email: 'dr.patel@hospitalflow.ai', displayName: 'Dr. Priya Patel', role: 'doctor', department: 'General Medicine', phone: '+91 9876543215', doctorId: 'D-0002' },
  { id: 'u-doc-3', email: 'dr.mehta@hospitalflow.ai', displayName: 'Dr. Rajesh Mehta', role: 'doctor', department: 'Cardiology', phone: '+91 9876543216', doctorId: 'D-0003' },
  { id: 'u-reception', email: 'reception@hospitalflow.ai', displayName: 'Priya Menon', role: 'reception', department: null, phone: '+91 9876543212' },
  { id: 'u-bloodbank', email: 'bloodbank@hospitalflow.ai', displayName: 'Rahul Deshmukh', role: 'blood_bank', department: null, phone: '+91 9876543213' },
  { id: 'u-pat-1', email: 'amit.kumar@email.com', displayName: 'Amit Kumar', role: 'patient', department: null, phone: '+91 9876543214', patientId: 'P-1001' },
  { id: 'u-pat-demo-1', email: 'amit.demo@hospitalflow.ai', displayName: 'Amit Kumar (Demo)', role: 'patient', department: null, phone: '+91 9876543214', patientId: 'P-1001' },
  { id: 'u-pat-demo-2', email: 'neha.demo@hospitalflow.ai', displayName: 'Neha Patil (Demo)', role: 'patient', department: null, phone: '+91 9876543215', patientId: 'P-1002' },
  { id: 'u-doc-demo-1', email: 'sharma.demo@hospitalflow.ai', displayName: 'Dr. Aarav Sharma (Demo)', role: 'doctor', department: 'General Medicine', phone: '+91 9876543211', doctorId: 'D-0001' },
  { id: 'u-admin-demo', email: 'admin.demo@hospitalflow.ai', displayName: 'Admin Operations (Demo)', role: 'admin', department: null, phone: '+91 9876543210' }
];

const ambulances = [
  { ambulanceId: 'AMB-01', vehicleNumber: 'MH-31-AB-1024', driverName: 'Ramesh Kale', contact: '+91 98230 11221', status: 'AVAILABLE', currentLocation: 'Hospital Main Bay', assignedRequestId: null, estimatedArrival: null, lastUpdated: new Date().toISOString() },
  { ambulanceId: 'AMB-02', vehicleNumber: 'MH-31-CD-3045', driverName: 'Suresh Patil', contact: '+91 98230 33445', status: 'AVAILABLE', currentLocation: 'Emergency Standby', assignedRequestId: null, estimatedArrival: null, lastUpdated: new Date().toISOString() },
  { ambulanceId: 'AMB-03', vehicleNumber: 'MH-31-EF-5067', driverName: 'Ganesh Shinde', contact: '+91 98230 55667', status: 'AVAILABLE', currentLocation: 'Trauma Care Bay', assignedRequestId: null, estimatedArrival: null, lastUpdated: new Date().toISOString() },
  { ambulanceId: 'AMB-04', vehicleNumber: 'MH-31-GH-7089', driverName: 'Manoj Jadhav', contact: '+91 98230 77889', status: 'UNAVAILABLE', currentLocation: 'Vehicle Maintenance', assignedRequestId: null, estimatedArrival: null, lastUpdated: new Date().toISOString() }
];

const ambulanceRequests = [];
const emergencyAlerts = [];
const careReentryRequests = [];
const warningReports = [];

export function generateDemoState() {
  return {
    currentUser: null,
    currentRole: null,
    isDemo: Config.IS_DEMO,
    isRealtimeConnected: true,
    patients,
    doctors,
    departments: Config.DEPARTMENTS.map(name => ({ name, active: true })),
    appointments,
    queueEntries,
    bloodInventory,
    bloodRequests,
    facilities,
    externalInventory,
    donors,
    dischargePlans,
    reminders,
    followUps,
    notifications,
    ambulances,
    ambulanceRequests,
    emergencyCases,
    emergencyAlerts,
    careReentryRequests,
    warningReports,
    flowRecoveryState: {},
    simulationScenarios,
    medicationTracking,
    consultationStats: {
      totalToday: appointments.length,
      avgDuration: 10,
      completed: 4
    },
    dashboardAnalytics: {
      totalActivePatients: 6,
      avgOPDWait: 18,
      criticalBloodAlerts: 1,
      todaysDischarges: 1
    }
  };
}

export { demoUsers, initialEvents, externalInventory };
