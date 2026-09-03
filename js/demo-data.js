// ============================================
// HospitalFlow AI — Synthetic Demo Data
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
  { id: 'D-0001', userId: 'u-doc-1', displayName: 'Dr. Aarav Sharma', department: 'General Medicine', specialty: 'Internal Medicine', status: 'Available', averageConsultationMinutes: 9, currentPatientId: null, completedToday: 4, queueLoad: 3 },
  { id: 'D-0002', userId: 'u-doc-2', displayName: 'Dr. Priya Patel', department: 'General Medicine', specialty: 'Family Medicine', status: 'Consulting', averageConsultationMinutes: 11, currentPatientId: 'P-1003', completedToday: 3, queueLoad: 4 },
  { id: 'D-0003', userId: 'u-doc-3', displayName: 'Dr. Rajesh Mehta', department: 'Cardiology', specialty: 'Interventional Cardiology', status: 'Available', averageConsultationMinutes: 14, currentPatientId: null, completedToday: 2, queueLoad: 5 },
  { id: 'D-0004', userId: 'u-doc-4', displayName: 'Dr. Sunita Reddy', department: 'Cardiology', specialty: 'Cardiac Electrophysiology', status: 'Consulting', averageConsultationMinutes: 12, currentPatientId: 'P-1008', completedToday: 3, queueLoad: 3 },
  { id: 'D-0005', userId: 'u-doc-5', displayName: 'Dr. Vikram Singh', department: 'Orthopedics', specialty: 'Joint Replacement', status: 'Available', averageConsultationMinutes: 10, currentPatientId: null, completedToday: 5, queueLoad: 2 },
  { id: 'D-0006', userId: 'u-doc-6', displayName: 'Dr. Anita Desai', department: 'Orthopedics', specialty: 'Sports Medicine', status: 'Break', averageConsultationMinutes: 8, currentPatientId: null, completedToday: 4, queueLoad: 0 },
  { id: 'D-0007', userId: 'u-doc-7', displayName: 'Dr. Manish Gupta', department: 'Neurology', specialty: 'Clinical Neurology', status: 'Available', averageConsultationMinutes: 15, currentPatientId: null, completedToday: 2, queueLoad: 4 },
  { id: 'D-0008', userId: 'u-doc-8', displayName: 'Dr. Kavita Nair', department: 'Neurology', specialty: 'Neuro-psychiatry', status: 'Consulting', averageConsultationMinutes: 13, currentPatientId: 'P-1015', completedToday: 1, queueLoad: 3 },
  { id: 'D-0009', userId: 'u-doc-9', displayName: 'Dr. Rohit Kumar', department: 'Dermatology', specialty: 'Clinical Dermatology', status: 'Available', averageConsultationMinutes: 7, currentPatientId: null, completedToday: 6, queueLoad: 2 },
  { id: 'D-0010', userId: 'u-doc-10', displayName: 'Dr. Meera Joshi', department: 'Dermatology', specialty: 'Cosmetic Dermatology', status: 'Available', averageConsultationMinutes: 8, currentPatientId: null, completedToday: 5, queueLoad: 1 },
  { id: 'D-0011', userId: 'u-doc-11', displayName: 'Dr. Sanjay Verma', department: 'Pediatrics', specialty: 'General Pediatrics', status: 'Consulting', averageConsultationMinutes: 10, currentPatientId: 'P-1020', completedToday: 3, queueLoad: 4 },
  { id: 'D-0012', userId: 'u-doc-12', displayName: 'Dr. Pooja Bhatt', department: 'Pediatrics', specialty: 'Pediatric Pulmonology', status: 'Available', averageConsultationMinutes: 11, currentPatientId: null, completedToday: 2, queueLoad: 3 },
];

// ============================================
// PATIENTS (35 patients)
// ============================================
const patients = [];
const patientNames = [
  'Amit Kumar', 'Neha Sharma', 'Ravi Patel', 'Sonia Gupta', 'Deepak Verma',
  'Pooja Singh', 'Arjun Reddy', 'Kavita Nair', 'Suresh Mehta', 'Anjali Desai',
  'Rahul Joshi', 'Priyanka Bhatt', 'Vijay Kumar', 'Rekha Iyer', 'Anil Mishra',
  'Sunita Rao', 'Manoj Tiwari', 'Divya Kapoor', 'Sanjay Pillai', 'Geeta Chauhan',
  'Kiran Bhat', 'Nisha Pandey', 'Rajan Shetty', 'Meenakshi Das', 'Ashok Malhotra',
  'Lakshmi Venkatesh', 'Prakash Jain', 'Rani Chowdhury', 'Sunil Hegde', 'Ananya Mukherjee',
  'Hemant Kulkarni', 'Sarita Agrawal', 'Nikhil Saxena', 'Parveen Kaur', 'Tarun Bose'
];

for (let i = 0; i < 35; i++) {
  patients.push({
    id: generateSeqId('P', 1001 + i),
    userId: `u-pat-${i + 1}`,
    displayName: patientNames[i],
    phone: `+91 98${String(76543210 + i * 111).slice(0, 8)}`,
    age: 22 + (i * 3) % 55,
    gender: i % 3 === 0 ? 'Male' : i % 3 === 1 ? 'Female' : 'Male',
    bloodGroup: Config.BLOOD_GROUPS[i % 8],
    previousNoShows: i % 7 === 0 ? 2 : i % 5 === 0 ? 1 : 0,
    registeredAt: relDate(-30 - i)
  });
}

// ============================================
// APPOINTMENTS (mix of statuses)
// ============================================
const appointments = [
  { id: 'APT-2201', patientId: 'P-1001', doctorId: 'D-0001', department: 'General Medicine', status: 'Completed', scheduledTime: today(9, 0), predictedStart: today(9, 5), predictedEnd: today(9, 14), actualStart: today(9, 3), actualEnd: today(9, 12), priority: 'normal', noShowRisk: 'Low' },
  { id: 'APT-2202', patientId: 'P-1002', doctorId: 'D-0001', department: 'General Medicine', status: 'Completed', scheduledTime: today(9, 15), predictedStart: today(9, 20), predictedEnd: today(9, 29), actualStart: today(9, 18), actualEnd: today(9, 28), priority: 'normal', noShowRisk: 'Low' },
  { id: 'APT-2203', patientId: 'P-1003', doctorId: 'D-0002', department: 'General Medicine', status: 'Consulting', scheduledTime: today(10, 0), predictedStart: today(10, 5), predictedEnd: today(10, 16), actualStart: today(10, 8), actualEnd: null, priority: 'normal', noShowRisk: 'Low' },
  { id: 'APT-2204', patientId: 'P-1004', doctorId: 'D-0001', department: 'General Medicine', status: 'In-Queue', scheduledTime: today(10, 30), predictedStart: today(10, 35), predictedEnd: today(10, 44), actualStart: null, actualEnd: null, priority: 'normal', noShowRisk: 'Medium' },
  { id: 'APT-2205', patientId: 'P-1005', doctorId: 'D-0002', department: 'General Medicine', status: 'In-Queue', scheduledTime: today(10, 45), predictedStart: today(10, 50), predictedEnd: today(11, 1), actualStart: null, actualEnd: null, priority: 'normal', noShowRisk: 'Low' },
  { id: 'APT-2206', patientId: 'P-1006', doctorId: 'D-0001', department: 'General Medicine', status: 'Scheduled', scheduledTime: today(11, 0), predictedStart: today(11, 10), predictedEnd: today(11, 19), actualStart: null, actualEnd: null, priority: 'normal', noShowRisk: 'Low' },
  { id: 'APT-2207', patientId: 'P-1007', doctorId: 'D-0003', department: 'Cardiology', status: 'In-Queue', scheduledTime: today(9, 30), predictedStart: today(10, 0), predictedEnd: today(10, 14), actualStart: null, actualEnd: null, priority: 'normal', noShowRisk: 'Low' },
  { id: 'APT-2208', patientId: 'P-1008', doctorId: 'D-0004', department: 'Cardiology', status: 'Consulting', scheduledTime: today(9, 45), predictedStart: today(10, 0), predictedEnd: today(10, 12), actualStart: today(10, 2), actualEnd: null, priority: 'normal', noShowRisk: 'Low' },
  { id: 'APT-2209', patientId: 'P-1009', doctorId: 'D-0003', department: 'Cardiology', status: 'In-Queue', scheduledTime: today(10, 15), predictedStart: today(10, 30), predictedEnd: today(10, 44), actualStart: null, actualEnd: null, priority: 'normal', noShowRisk: 'High' },
  { id: 'APT-2210', patientId: 'P-1010', doctorId: 'D-0003', department: 'Cardiology', status: 'In-Queue', scheduledTime: today(10, 30), predictedStart: today(10, 44), predictedEnd: today(10, 58), actualStart: null, actualEnd: null, priority: 'normal', noShowRisk: 'Low' },
  { id: 'APT-2211', patientId: 'P-1011', doctorId: 'D-0004', department: 'Cardiology', status: 'In-Queue', scheduledTime: today(10, 30), predictedStart: today(10, 45), predictedEnd: today(10, 57), actualStart: null, actualEnd: null, priority: 'normal', noShowRisk: 'Low' },
  { id: 'APT-2212', patientId: 'P-1012', doctorId: 'D-0005', department: 'Orthopedics', status: 'In-Queue', scheduledTime: today(10, 0), predictedStart: today(10, 15), predictedEnd: today(10, 25), actualStart: null, actualEnd: null, priority: 'normal', noShowRisk: 'Low' },
  { id: 'APT-2213', patientId: 'P-1013', doctorId: 'D-0005', department: 'Orthopedics', status: 'In-Queue', scheduledTime: today(10, 30), predictedStart: today(10, 25), predictedEnd: today(10, 35), actualStart: null, actualEnd: null, priority: 'normal', noShowRisk: 'Medium' },
  { id: 'APT-2214', patientId: 'P-1014', doctorId: 'D-0007', department: 'Neurology', status: 'In-Queue', scheduledTime: today(10, 0), predictedStart: today(10, 20), predictedEnd: today(10, 35), actualStart: null, actualEnd: null, priority: 'normal', noShowRisk: 'Low' },
  { id: 'APT-2215', patientId: 'P-1015', doctorId: 'D-0008', department: 'Neurology', status: 'Consulting', scheduledTime: today(10, 0), predictedStart: today(10, 10), predictedEnd: today(10, 23), actualStart: today(10, 12), actualEnd: null, priority: 'normal', noShowRisk: 'Low' },
  { id: 'APT-2216', patientId: 'P-1016', doctorId: 'D-0007', department: 'Neurology', status: 'In-Queue', scheduledTime: today(10, 30), predictedStart: today(10, 45), predictedEnd: today(11, 0), actualStart: null, actualEnd: null, priority: 'normal', noShowRisk: 'Low' },
  { id: 'APT-2217', patientId: 'P-1017', doctorId: 'D-0009', department: 'Dermatology', status: 'In-Queue', scheduledTime: today(10, 0), predictedStart: today(10, 10), predictedEnd: today(10, 17), actualStart: null, actualEnd: null, priority: 'normal', noShowRisk: 'Low' },
  { id: 'APT-2218', patientId: 'P-1018', doctorId: 'D-0010', department: 'Dermatology', status: 'Scheduled', scheduledTime: today(11, 0), predictedStart: today(11, 5), predictedEnd: today(11, 13), actualStart: null, actualEnd: null, priority: 'normal', noShowRisk: 'Low' },
  { id: 'APT-2219', patientId: 'P-1019', doctorId: 'D-0009', department: 'Dermatology', status: 'In-Queue', scheduledTime: today(10, 30), predictedStart: today(10, 17), predictedEnd: today(10, 24), actualStart: null, actualEnd: null, priority: 'normal', noShowRisk: 'Low' },
  { id: 'APT-2220', patientId: 'P-1020', doctorId: 'D-0011', department: 'Pediatrics', status: 'Consulting', scheduledTime: today(10, 0), predictedStart: today(10, 5), predictedEnd: today(10, 15), actualStart: today(10, 7), actualEnd: null, priority: 'normal', noShowRisk: 'Low' },
  { id: 'APT-2221', patientId: 'P-1021', doctorId: 'D-0012', department: 'Pediatrics', status: 'In-Queue', scheduledTime: today(10, 15), predictedStart: today(10, 20), predictedEnd: today(10, 31), actualStart: null, actualEnd: null, priority: 'normal', noShowRisk: 'Low' },
  { id: 'APT-2222', patientId: 'P-1022', doctorId: 'D-0011', department: 'Pediatrics', status: 'In-Queue', scheduledTime: today(10, 30), predictedStart: today(10, 45), predictedEnd: today(10, 55), actualStart: null, actualEnd: null, priority: 'normal', noShowRisk: 'Low' },
  { id: 'APT-2223', patientId: 'P-1023', doctorId: 'D-0012', department: 'Pediatrics', status: 'In-Queue', scheduledTime: today(10, 45), predictedStart: today(10, 50), predictedEnd: today(11, 1), actualStart: null, actualEnd: null, priority: 'normal', noShowRisk: 'Medium' },
  // Scheduled future appointments
  { id: 'APT-2224', patientId: 'P-1024', doctorId: 'D-0003', department: 'Cardiology', status: 'Scheduled', scheduledTime: today(14, 0), predictedStart: today(14, 5), predictedEnd: today(14, 19), actualStart: null, actualEnd: null, priority: 'normal', noShowRisk: 'Low' },
  { id: 'APT-2225', patientId: 'P-1025', doctorId: 'D-0007', department: 'Neurology', status: 'Scheduled', scheduledTime: today(14, 30), predictedStart: today(14, 35), predictedEnd: today(14, 50), actualStart: null, actualEnd: null, priority: 'normal', noShowRisk: 'Low' },
];

// ============================================
// QUEUE ENTRIES (match appointments in-queue/consulting)
// ============================================
const queueEntries = [];
let qPos = 1;
appointments.forEach(apt => {
  if (['In-Queue', 'Consulting'].includes(apt.status)) {
    queueEntries.push({
      id: `Q-${String(qPos).padStart(4, '0')}`,
      patientId: apt.patientId,
      doctorId: apt.doctorId,
      department: apt.department,
      appointmentId: apt.id,
      position: qPos,
      status: apt.status === 'Consulting' ? 'Consulting' : 'Waiting',
      priority: apt.priority === 'emergency' ? 'Emergency' : 'Normal',
      estimatedWait: apt.status === 'Consulting' ? 0 : 5 + (qPos * 4),
      enteredAt: today(9, 30 + qPos * 2),
      calledAt: apt.status === 'Consulting' ? apt.actualStart : null,
      consultingAt: apt.status === 'Consulting' ? apt.actualStart : null,
      completedAt: null
    });
    qPos++;
  }
});

// Add completed entries for history
['P-1001', 'P-1002'].forEach((pid, i) => {
  queueEntries.push({
    id: `Q-C${String(i + 1).padStart(3, '0')}`,
    patientId: pid,
    doctorId: 'D-0001',
    department: 'General Medicine',
    appointmentId: `APT-220${i + 1}`,
    position: 0,
    status: 'Completed',
    priority: 'Normal',
    estimatedWait: 0,
    enteredAt: today(8, 45 + i * 15),
    calledAt: today(9, 0 + i * 15),
    consultingAt: today(9, 2 + i * 15),
    completedAt: today(9, 12 + i * 15)
  });
});

// ============================================
// BLOOD INVENTORY (Whole Blood for each group)
// ============================================
const bloodInventory = [
  { id: 'BI-001', facilityId: 'FAC-001', bloodGroup: 'A+', component: 'Whole Blood', units: 28, reservedUnits: 3, collectionDate: relDate(-10), expiryDate: relDate(25), status: 'Adequate', updatedAt: today(8, 0) },
  { id: 'BI-002', facilityId: 'FAC-001', bloodGroup: 'A-', component: 'Whole Blood', units: 8, reservedUnits: 2, collectionDate: relDate(-15), expiryDate: relDate(20), status: 'Low', updatedAt: today(8, 0) },
  { id: 'BI-003', facilityId: 'FAC-001', bloodGroup: 'B+', component: 'Whole Blood', units: 22, reservedUnits: 4, collectionDate: relDate(-8), expiryDate: relDate(27), status: 'Adequate', updatedAt: today(8, 0) },
  { id: 'BI-004', facilityId: 'FAC-001', bloodGroup: 'B-', component: 'Whole Blood', units: 6, reservedUnits: 1, collectionDate: relDate(-20), expiryDate: relDate(15), status: 'Low', updatedAt: today(8, 0) },
  { id: 'BI-005', facilityId: 'FAC-001', bloodGroup: 'AB+', component: 'Whole Blood', units: 12, reservedUnits: 0, collectionDate: relDate(-5), expiryDate: relDate(30), status: 'Low', updatedAt: today(8, 0) },
  { id: 'BI-006', facilityId: 'FAC-001', bloodGroup: 'AB-', component: 'Whole Blood', units: 4, reservedUnits: 1, collectionDate: relDate(-25), expiryDate: relDate(10), status: 'Critical', updatedAt: today(8, 0) },
  { id: 'BI-007', facilityId: 'FAC-001', bloodGroup: 'O+', component: 'Whole Blood', units: 35, reservedUnits: 5, collectionDate: relDate(-3), expiryDate: relDate(32), status: 'Adequate', updatedAt: today(8, 0) },
  { id: 'BI-008', facilityId: 'FAC-001', bloodGroup: 'O-', component: 'Whole Blood', units: 3, reservedUnits: 1, collectionDate: relDate(-18), expiryDate: relDate(17), status: 'Critical', updatedAt: today(8, 0) },
  // Packed RBCs
  { id: 'BI-009', facilityId: 'FAC-001', bloodGroup: 'O+', component: 'Packed RBCs', units: 15, reservedUnits: 2, collectionDate: relDate(-6), expiryDate: relDate(29), status: 'Adequate', updatedAt: today(8, 0) },
  { id: 'BI-010', facilityId: 'FAC-001', bloodGroup: 'A+', component: 'Packed RBCs', units: 10, reservedUnits: 1, collectionDate: relDate(-7), expiryDate: relDate(28), status: 'Low', updatedAt: today(8, 0) },
  { id: 'BI-011', facilityId: 'FAC-001', bloodGroup: 'O-', component: 'Packed RBCs', units: 2, reservedUnits: 0, collectionDate: relDate(-12), expiryDate: relDate(23), status: 'Critical', updatedAt: today(8, 0) },
];

// ============================================
// FACILITIES (Source hospitals/blood banks)
// ============================================
const facilities = [
  { id: 'FAC-001', name: 'HospitalFlow Central Hospital', type: 'Hospital', city: 'Mumbai', latitude: 19.076, longitude: 72.8777, operationalStatus: 'Active', distance: 0 },
  { id: 'FAC-002', name: 'City Blood Bank', type: 'Blood Bank', city: 'Mumbai', latitude: 19.082, longitude: 72.890, operationalStatus: 'Active', distance: 4.7 },
  { id: 'FAC-003', name: 'Shree Hospital', type: 'Hospital', city: 'Mumbai', latitude: 19.065, longitude: 72.865, operationalStatus: 'Active', distance: 2.3 },
  { id: 'FAC-004', name: 'Metro General Hospital', type: 'Hospital', city: 'Mumbai', latitude: 19.095, longitude: 72.910, operationalStatus: 'Active', distance: 7.1 },
  { id: 'FAC-005', name: 'Regional Blood Centre', type: 'Blood Bank', city: 'Mumbai', latitude: 19.055, longitude: 72.840, operationalStatus: 'Active', distance: 5.9 },
];

// External facility inventory (what other facilities have)
const externalInventory = [
  { facilityId: 'FAC-002', bloodGroup: 'O-', component: 'Whole Blood', units: 8, reservedUnits: 2, expiryDate: relDate(20) },
  { facilityId: 'FAC-002', bloodGroup: 'A+', component: 'Whole Blood', units: 15, reservedUnits: 3, expiryDate: relDate(25) },
  { facilityId: 'FAC-002', bloodGroup: 'B+', component: 'Whole Blood', units: 12, reservedUnits: 1, expiryDate: relDate(22) },
  { facilityId: 'FAC-002', bloodGroup: 'AB-', component: 'Whole Blood', units: 5, reservedUnits: 0, expiryDate: relDate(18) },
  { facilityId: 'FAC-003', bloodGroup: 'O-', component: 'Whole Blood', units: 4, reservedUnits: 1, expiryDate: relDate(15) },
  { facilityId: 'FAC-003', bloodGroup: 'A-', component: 'Whole Blood', units: 6, reservedUnits: 0, expiryDate: relDate(28) },
  { facilityId: 'FAC-003', bloodGroup: 'B-', component: 'Whole Blood', units: 3, reservedUnits: 0, expiryDate: relDate(20) },
  { facilityId: 'FAC-004', bloodGroup: 'O-', component: 'Whole Blood', units: 6, reservedUnits: 3, expiryDate: relDate(12) },
  { facilityId: 'FAC-004', bloodGroup: 'O+', component: 'Whole Blood', units: 20, reservedUnits: 5, expiryDate: relDate(30) },
  { facilityId: 'FAC-004', bloodGroup: 'A+', component: 'Whole Blood', units: 18, reservedUnits: 2, expiryDate: relDate(26) },
  { facilityId: 'FAC-005', bloodGroup: 'O-', component: 'Whole Blood', units: 10, reservedUnits: 4, expiryDate: relDate(22) },
  { facilityId: 'FAC-005', bloodGroup: 'AB-', component: 'Whole Blood', units: 7, reservedUnits: 1, expiryDate: relDate(19) },
  { facilityId: 'FAC-005', bloodGroup: 'B+', component: 'Whole Blood', units: 14, reservedUnits: 2, expiryDate: relDate(24) },
];

// ============================================
// BLOOD REQUESTS
// ============================================
const bloodRequests = [
  { id: 'BR-019', patientId: 'P-1008', bloodGroup: 'B+', component: 'Whole Blood', units: 2, urgency: 'Urgent', department: 'Cardiology', requestingHospital: 'HospitalFlow Central Hospital', status: 'Resolved', matchedFacilityId: 'FAC-001', createdAt: relDate(-1, 14, 30), resolvedAt: relDate(-1, 16, 0) },
  { id: 'BR-020', patientId: 'P-1014', bloodGroup: 'A-', component: 'Packed RBCs', units: 1, urgency: 'Routine', department: 'Neurology', requestingHospital: 'HospitalFlow Central Hospital', status: 'Reserved', matchedFacilityId: 'FAC-001', createdAt: today(8, 30), resolvedAt: null },
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
// DISCHARGE PLANS (3 existing)
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
  },
  {
    id: 'DP-002',
    patientId: 'P-1002',
    approvedBy: 'D-0001',
    dischargeDate: today(11, 30),
    medications: [
      { name: 'Metformin 500mg', dosage: '1 tablet', timeSlot: 'Morning', duration: '30 days', instructions: 'With breakfast' },
      { name: 'Metformin 500mg', dosage: '1 tablet', timeSlot: 'Evening', duration: '30 days', instructions: 'With dinner' },
      { name: 'Amlodipine 5mg', dosage: '1 tablet', timeSlot: 'Morning', duration: '30 days', instructions: 'Before food' }
    ],
    dietPlan: 'Low sugar, low sodium diet. Small frequent meals. Avoid processed foods and sugary drinks.',
    followUp: { department: 'General Medicine', doctorId: 'D-0001', date: relDate(14, 10, 0), time: '10:00 AM' },
    warningSigns: [
      'Blood sugar below 70 mg/dL or above 300 mg/dL',
      'Unusual fatigue or weakness',
      'Blurred vision or persistent headache',
      'Swelling in feet or ankles'
    ],
    instructions: 'Monitor blood sugar twice daily. Maintain a sugar log. Walk for 20 minutes daily. Avoid alcohol.',
    language: 'English',
    active: true,
    caregiverShared: true,
    createdAt: today(11, 30)
  }
];

// ============================================
// REMINDERS
// ============================================
const reminders = [
  { id: 'REM-001', patientId: 'P-1001', type: 'Medication', message: 'Time to take Paracetamol 500mg (Morning dose)', scheduledFor: today(8, 0), status: 'Acknowledged', acknowledgedAt: today(8, 15) },
  { id: 'REM-002', patientId: 'P-1001', type: 'Medication', message: 'Time to take Omeprazole 20mg (Morning dose)', scheduledFor: today(7, 30), status: 'Acknowledged', acknowledgedAt: today(7, 45) },
  { id: 'REM-003', patientId: 'P-1001', type: 'Medication', message: 'Time to take Paracetamol 500mg (Night dose)', scheduledFor: today(21, 0), status: 'Scheduled', acknowledgedAt: null },
  { id: 'REM-004', patientId: 'P-1001', type: 'Medication', message: 'Time to take Cetirizine 10mg (Night dose)', scheduledFor: today(21, 0), status: 'Scheduled', acknowledgedAt: null },
  { id: 'REM-005', patientId: 'P-1001', type: 'Follow-up', message: 'Follow-up appointment with Dr. Aarav Sharma in 7 days', scheduledFor: relDate(5, 9, 0), status: 'Scheduled', acknowledgedAt: null },
  { id: 'REM-006', patientId: 'P-1002', type: 'Medication', message: 'Time to take Metformin 500mg (Morning dose)', scheduledFor: today(8, 0), status: 'Missed', acknowledgedAt: null },
  { id: 'REM-007', patientId: 'P-1002', type: 'Medication', message: 'Time to take Amlodipine 5mg (Morning dose)', scheduledFor: today(8, 0), status: 'Delivered', acknowledgedAt: null },
];

// ============================================
// FOLLOW-UPS
// ============================================
const followUps = [
  { id: 'FU-001', patientId: 'P-1001', department: 'General Medicine', doctorId: 'D-0001', date: relDate(7, 10, 0), time: '10:00 AM', status: 'Scheduled', dischargePlanId: 'DP-001', appointmentId: null },
  { id: 'FU-002', patientId: 'P-1002', department: 'General Medicine', doctorId: 'D-0001', date: relDate(14, 10, 0), time: '10:00 AM', status: 'Scheduled', dischargePlanId: 'DP-002', appointmentId: null },
];

// ============================================
// SIMULATION SCENARIOS
// ============================================
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

// ============================================
// INITIAL NOTIFICATIONS
// ============================================
const notifications = [
  { id: 'N-001', type: 'Blood', category: 'Emergency', priority: 'Critical', title: 'Critical Blood Stock', message: 'O- blood stock is critically low: 2 usable units remaining', read: false, dismissed: false, createdAt: today(9, 0), relatedModule: 'emergency', relatedEntityId: 'BI-008' },
  { id: 'N-002', type: 'Blood', category: 'Emergency', priority: 'Critical', title: 'Critical Blood Stock', message: 'AB- blood stock is critically low: 3 usable units remaining', read: false, dismissed: false, createdAt: today(9, 5), relatedModule: 'emergency', relatedEntityId: 'BI-006' },
  { id: 'N-003', type: 'Queue', category: 'Operational', priority: 'High', title: 'Cardiology Queue Growing', message: 'Cardiology department has 5 patients waiting with 2 active doctors', read: false, dismissed: false, createdAt: today(9, 30), relatedModule: 'flow', relatedEntityId: null },
  { id: 'N-004', type: 'Care', category: 'Reminder', priority: 'Medium', title: 'Medication Missed', message: 'Patient Neha Sharma missed morning Metformin dose', read: true, dismissed: false, createdAt: today(9, 15), relatedModule: 'care', relatedEntityId: 'REM-006' },
  { id: 'N-005', type: 'System', category: 'System', priority: 'Information', title: 'System Initialized', message: 'HospitalFlow AI demo environment loaded successfully', read: true, dismissed: false, createdAt: today(8, 0), relatedModule: null, relatedEntityId: null },
];

// ============================================
// INITIAL EVENTS for audit history
// ============================================
const initialEvents = [
  { id: 'evt-init-1', type: 'USER_LOGGED_IN', timestamp: today(8, 0), payload: { displayName: 'Admin User', role: 'admin' }, source: 'auth', userId: 'u-admin', entityId: null },
  { id: 'evt-init-2', type: 'BLOOD_STOCK_CRITICAL', timestamp: today(9, 0), payload: { bloodGroup: 'O-', availableUnits: 2 }, source: 'blood-engine', userId: null, entityId: 'BI-008' },
  { id: 'evt-init-3', type: 'BLOOD_STOCK_CRITICAL', timestamp: today(9, 5), payload: { bloodGroup: 'AB-', availableUnits: 3 }, source: 'blood-engine', userId: null, entityId: 'BI-006' },
  { id: 'evt-init-4', type: 'CONSULTATION_STARTED', timestamp: today(10, 2), payload: { patientName: 'Sonia Gupta', doctorName: 'Dr. Sunita Reddy', department: 'Cardiology' }, source: 'flow-engine', userId: 'u-doc-4', entityId: 'APT-2208' },
  { id: 'evt-init-5', type: 'CONSULTATION_STARTED', timestamp: today(10, 7), payload: { patientName: 'Rekha Iyer', doctorName: 'Dr. Sanjay Verma', department: 'Pediatrics' }, source: 'flow-engine', userId: 'u-doc-11', entityId: 'APT-2220' },
  { id: 'evt-init-6', type: 'CONSULTATION_STARTED', timestamp: today(10, 8), payload: { patientName: 'Ravi Patel', doctorName: 'Dr. Priya Patel', department: 'General Medicine' }, source: 'flow-engine', userId: 'u-doc-2', entityId: 'APT-2203' },
  { id: 'evt-init-7', type: 'CONSULTATION_COMPLETED', timestamp: today(9, 12), payload: { patientName: 'Amit Kumar', doctorName: 'Dr. Aarav Sharma', department: 'General Medicine' }, source: 'flow-engine', userId: 'u-doc-1', entityId: 'APT-2201' },
  { id: 'evt-init-8', type: 'DISCHARGE_PLAN_CREATED', timestamp: today(12, 0), payload: { patientName: 'Amit Kumar', planId: 'DP-001' }, source: 'care-engine', userId: 'u-doc-1', entityId: 'DP-001' },
  { id: 'evt-init-9', type: 'MEDICATION_MISSED', timestamp: today(9, 15), payload: { patientName: 'Neha Sharma', medicationName: 'Metformin 500mg' }, source: 'care-engine', userId: null, entityId: 'REM-006' },
  { id: 'evt-init-10', type: 'CONSULTATION_STARTED', timestamp: today(10, 12), payload: { patientName: 'Anil Mishra', doctorName: 'Dr. Kavita Nair', department: 'Neurology' }, source: 'flow-engine', userId: 'u-doc-8', entityId: 'APT-2215' },
];

// ============================================
// MEDICATION TRACKING (for P-1001 adherence)
// ============================================
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
  },
  'P-1002': {
    totalDoses: 6,
    takenDoses: 3,
    missedDoses: 1,
    history: [
      { medication: 'Metformin 500mg', timeSlot: 'Morning', date: relDate(-1), taken: true, takenAt: relDate(-1, 8, 5) },
      { medication: 'Amlodipine 5mg', timeSlot: 'Morning', date: relDate(-1), taken: true, takenAt: relDate(-1, 8, 5) },
      { medication: 'Metformin 500mg', timeSlot: 'Evening', date: relDate(-1), taken: true, takenAt: relDate(-1, 19, 30) },
    ]
  }
};

// ============================================
// DEMO USERS
// ============================================
const demoUsers = [
  { id: 'u-admin', email: 'admin@hospitalflow.ai', displayName: 'Admin User', role: 'admin', department: null, phone: '+91 9876543210' },
  { id: 'u-doc-1', email: 'dr.sharma@hospitalflow.ai', displayName: 'Dr. Aarav Sharma', role: 'doctor', department: 'General Medicine', phone: '+91 9876543211', doctorId: 'D-0001' },
  { id: 'u-doc-2', email: 'dr.patel@hospitalflow.ai', displayName: 'Dr. Priya Patel', role: 'doctor', department: 'General Medicine', phone: '+91 9876543215', doctorId: 'D-0002' },
  { id: 'u-doc-3', email: 'dr.mehta@hospitalflow.ai', displayName: 'Dr. Rajesh Mehta', role: 'doctor', department: 'Cardiology', phone: '+91 9876543216', doctorId: 'D-0003' },
  { id: 'u-reception', email: 'reception@hospitalflow.ai', displayName: 'Priya Menon', role: 'reception', department: null, phone: '+91 9876543212' },
  { id: 'u-bloodbank', email: 'bloodbank@hospitalflow.ai', displayName: 'Rahul Deshmukh', role: 'blood_bank', department: null, phone: '+91 9876543213' },
  { id: 'u-pat-1', email: 'amit.kumar@email.com', displayName: 'Amit Kumar', role: 'patient', department: null, phone: '+91 9876543214', patientId: 'P-1001' }
];

// ============================================
// AMBULANCES FLEET (4 Hospital Ambulances)
// ============================================
const ambulances = [
  { ambulanceId: 'AMB-01', vehicleNumber: 'MH-31-AB-1024', driverName: 'Ramesh Kale', contact: '+91 98230 11221', status: 'AVAILABLE', currentLocation: 'Hospital Main Bay', assignedRequestId: null, estimatedArrival: null, lastUpdated: new Date().toISOString() },
  { ambulanceId: 'AMB-02', vehicleNumber: 'MH-31-CD-3045', driverName: 'Suresh Patil', contact: '+91 98230 33445', status: 'AVAILABLE', currentLocation: 'Emergency Standby', assignedRequestId: null, estimatedArrival: null, lastUpdated: new Date().toISOString() },
  { ambulanceId: 'AMB-03', vehicleNumber: 'MH-31-EF-5067', driverName: 'Ganesh Shinde', contact: '+91 98230 55667', status: 'AVAILABLE', currentLocation: 'Trauma Care Bay', assignedRequestId: null, estimatedArrival: null, lastUpdated: new Date().toISOString() },
  { ambulanceId: 'AMB-04', vehicleNumber: 'MH-31-GH-7089', driverName: 'Manoj Jadhav', contact: '+91 98230 77889', status: 'UNAVAILABLE', currentLocation: 'Vehicle Maintenance', assignedRequestId: null, estimatedArrival: null, lastUpdated: new Date().toISOString() }
];

const ambulanceRequests = [];
const emergencyCases = [];
const emergencyAlerts = [];
const careReentryRequests = [
  {
    id: 'RE-001',
    patientId: 'P-1004',
    patientName: 'Sunita Sharma',
    carePlanId: 'DP-002',
    reason: 'Mild recurrence of shortness of breath following discharge',
    symptoms: 'Chest tightness, fatigue',
    preferredDepartment: 'Cardiology',
    urgency: 'Urgent',
    status: 'Under Review',
    createdAt: new Date(Date.now() - 3600000).toISOString()
  }
];
const warningReports = [
  {
    id: 'WR-001',
    patientId: 'P-1001',
    patientName: 'Amit Kumar',
    carePlanId: 'DP-001',
    reportedCondition: 'High Fever',
    severity: 'Moderate',
    patientNote: 'Temperature recorded at 101.4 F this morning',
    status: 'Acknowledged',
    timestamp: new Date(Date.now() - 7200000).toISOString()
  }
];

// ============================================
// EXPORT COMPLETE DEMO STATE
// ============================================
export function generateDemoState() {
  return {
    currentUser: null,
    currentRole: null,
    isDemo: Config.IS_DEMO,
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
      totalToday: appointments.filter(a => {
        const d = new Date(a.scheduledTime);
        return d.toDateString() === new Date().toDateString();
      }).length,
      avgDuration: 10,
      completed: queueEntries.filter(q => q.status === 'Completed').length
    },
    dashboardAnalytics: {
      totalActivePatients: 0,
      avgOPDWait: 0,
      criticalBloodAlerts: 0,
      todaysDischarges: 0
    }
  };
}

export { demoUsers, initialEvents, externalInventory };
