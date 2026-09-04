// ============================================
// HospitalFlow AI — Complete Internationalization (i18n)
// English & Hindi Full Portal Localizations
// ============================================

import eventBus, { EventTypes } from './events.js';
import Storage from './storage.js';

const translations = {
  en: {
    // Navigation
    'nav.home': 'Home',
    'nav.appointments': 'Appointments',
    'nav.queue': 'Live Queue',
    'nav.care': 'My Care',
    'nav.followup': 'Follow-Up',
    'nav.emergency_status': 'Emergency Help',
    'nav.profile': 'Profile',
    'nav.notifications': 'Notifications',
    'nav.logout': 'Sign Out',
    'nav.command_center': 'Command Center',
    'nav.flow_intelligence': 'Flow Intelligence',
    'nav.emergency_readiness': 'Emergency Readiness',
    'nav.care_continuity': 'Care Continuity',
    'nav.patients': 'Patients',
    'nav.doctors': 'Doctors',
    'nav.audit': 'Audit & Activity',
    'nav.demo_simulation': 'Live Demo Simulation',
    'nav.dashboard': 'Dashboard',
    'nav.my_patients': 'My Patients',
    'nav.blood_requests': 'Blood Requests',
    'nav.care_plans': 'Care Plans',

    // Language
    'lang.selector': 'Language',
    'lang.english': 'English',
    'lang.hindi': 'हिंदी',

    // Patient Dashboard
    'patient.welcome': 'Welcome back',
    'patient.portal_subtitle': "Here's your hospital journey today.",
    'patient.tagline': 'Your personal health journey & care coordinator',
    'patient.next_appointment': 'Next Appointment',
    'patient.no_upcoming_apt': 'No upcoming appointments',
    'patient.book_now': 'Book New Appointment',
    'patient.live_queue': 'Live Queue',
    'patient.not_in_queue': 'Not currently in queue',
    'patient.view_queue': 'Track Live Queue',
    'patient.care_overview': 'My Recovery & Care',
    'patient.no_active_care': 'No active discharge care plan',
    'patient.view_care': 'View Care Plan',
    'patient.recent_notifications': 'Recent Updates',
    'patient.all_notifications': 'View All Notifications',
    'patient.my_appointments': 'My Appointments',
    'patient.report_problem': 'Report a Problem',
    'patient.need_urgent_help': 'Need urgent help?',
    'patient.emergency_desc': 'Our emergency team can guide you immediately, or send a hospital ambulance to your location.',
    'patient.request_ambulance': 'Request Hospital Ambulance',
    'patient.emergency_assistance': 'Emergency Assistance',

    // Queue terms
    'queue.token': 'Token',
    'queue.position': 'Position',
    'queue.ahead': 'Patients Ahead',
    'queue.patients_ahead_text': 'patients are ahead of you',
    'queue.one_ahead_text': 'patient is ahead of you',
    'queue.you_are_next': 'You are next in line! Please stay near the consultation room.',
    'queue.currently_consulting': 'Consultation in progress with doctor.',
    'queue.predicted_wait': 'Estimated Wait',
    'queue.status': 'Status',
    'queue.status_waiting': 'Waiting',
    'queue.status_called': 'Called — Please proceed to doctor room',
    'queue.status_consulting': 'Consulting',
    'queue.status_completed': 'Completed',
    'queue.department': 'Department',
    'queue.doctor': 'Doctor',
    'queue.emergency_delay_alert': 'An emergency case has affected your queue. Updated estimated wait:',

    // Booking & Symptoms
    'booking.title': 'Symptom-Guided Booking',
    'booking.subtitle': 'Describe your symptoms in English, Hindi, or Hinglish',
    'booking.symptoms_label': 'Describe your symptoms',
    'booking.analyze': 'Analyze Symptoms',
    'booking.analyzing': 'Analyzing symptoms...',
    'booking.detected_symptoms': 'Detected Symptoms',
    'booking.confidence': 'Confidence',
    'booking.confidence_high': 'High Confidence',
    'booking.confidence_medium': 'Medium Confidence',
    'booking.confidence_low': 'Low Confidence',
    'booking.suggested_dept': 'Suggested Department',
    'booking.select_doctor': 'Select Doctor',
    'booking.select_date': 'Preferred Date',
    'booking.select_time': 'Time Slot',
    'booking.confirm': 'Confirm & Book Appointment',
    'booking.confirmed': 'Appointment Confirmed ✓',
    'booking.qr_prompt': 'Present this QR at hospital reception for express check-in.',
    'booking.checkin_now': 'Check-In Now',
    'booking.print_qr': 'Print QR',

    // Care & Discharge
    'care.discharge_plan': 'Discharge & Recovery Plan',
    'care.medications': 'Prescribed Medications',
    'care.diet_plan': 'Diet & Nutrition Plan',
    'care.warning_signs': 'Warning Signs to Watch',
    'care.follow_up': 'Scheduled Follow-Up',
    'care.adherence': 'Medication Adherence',
    'care.mark_taken': 'Mark Taken',
    'care.snooze': 'Snooze',
    'care.taken': 'Taken',
    'care.report_warning': 'Report Warning Condition',
    'care.request_reentry': 'Request Care Re-Entry',

    // Doctor Portal
    'doctor.dashboard': 'Doctor Dashboard',
    'doctor.todays_schedule': "Today's Schedule",
    'doctor.patients_waiting': 'Patients Waiting',
    'doctor.completed_today': 'Completed Today',
    'doctor.avg_consult': 'Avg Consult',
    'doctor.current_patient': 'Current In-Room Patient',
    'doctor.room_empty': 'No patient currently in consultation',
    'doctor.call_next': 'Call Next Patient',
    'doctor.start_consult': 'Start Consultation',
    'doctor.complete_consult': 'Complete Consultation',
    'doctor.author_care_plan': 'Author Care Plan',
    'doctor.request_blood': 'Request Emergency Blood',
    'doctor.emergency_active': 'Emergency Active',
    'doctor.next_in_queue': 'Next in Queue',

    // Admin Command Center & Flow
    'admin.command_center': 'Hospital Command Center',
    'admin.active_emergencies': 'Active Emergencies',
    'admin.avg_wait': 'Average Wait',
    'admin.active_patients': 'Active Patients',
    'admin.doctor_capacity': 'Doctor Capacity',
    'admin.live_patient_flow': 'Live Patient Flow',
    'admin.emergency_blood_status': 'Emergency & Blood Status',
    'admin.dept_capacity': 'Department Operational Capacity',
    'admin.flow_intelligence': 'Flow Intelligence',
    'admin.flow_recovery': 'Flow Recovery Intelligence',
    'admin.emergency_impact': 'Emergency Department Impact Analysis',
    'admin.what_if': 'What-If Hospital Flow Simulator',
    'admin.run_simulation': 'Run Flow Simulation',
    'admin.apply_response': 'Apply Recommended Response',
    'admin.reset_demo': 'Reset Demo State',
    'admin.live_operations': 'Live Operations Feed',
    'admin.executive_impact': 'Executive Impact Panel',

    // General terms
    'common.view_details': 'View Details',
    // Missed dose & recovery keys
    'care.recovery_workspace': 'Recovery & Care Continuity Workspace',
    'care.day_milestone': 'Day {day} of {total}',
    'care.todays_medicines': "Today's Medicines",
    'care.taken_count': 'Taken',
    'care.skipped_count': 'Missed / Skipped',
    'care.next_dose': 'Next Dose',
    'care.mark_taken_btn': 'Mark Taken',
    'care.skip_dose_btn': 'Skip Dose',
    'care.skip_modal_title': 'Record Reason for Skipping Dose',
    'care.skip_reason_forgot': 'Forgot / Missed Time',
    'care.skip_reason_unwell': 'Feeling Unwell / Nauseous',
    'care.skip_reason_unavailable': 'Medicine Not Available',
    'care.skip_reason_advised': 'Doctor / Pharmacist Advised',
    'care.skip_reason_other': 'Other Reason',
    'care.missed_advisory_title': 'Missed Dose Safety Advisory',
    'care.missed_advisory_text': 'You missed this dose. Do not automatically double your next dose. Follow your prescription instructions or contact your care team if you are unsure.',
    'care.view_instructions': 'View Instructions',
    'care.contact_care_team': 'Contact Care Team',
    'care.report_home_problem': 'Report a Problem from Home',
    'care.seven_day_adherence': '7-Day Medication Adherence History',

    // Emergency Two Modes
    'emergency.private_vehicle_title': 'I am Coming to the Hospital (Private Vehicle / Self Arrival)',
    'emergency.private_vehicle_desc': 'Notify our emergency trauma team ahead of time so the triage bay is ready upon your arrival.',
    'emergency.ambulance_title': 'Request Hospital Ambulance',
    'emergency.ambulance_desc': 'Dispatches an equipped hospital ambulance to your location with live transit tracking.',
    'emergency.prearrival_status': 'Pre-Arrival Status',
    'emergency.prep_bay_ready': 'Emergency Bay Ready',

    // General terms
    'common.view_details': 'View Details',
    'common.view_journey': 'View Journey',
    'common.close': 'Close',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.submit': 'Submit',
    'common.status': 'Status',
    'common.actions': 'Actions',
    'common.date': 'Date',
    'common.time': 'Time',
    'common.minutes': 'min',
    'common.available': 'Available',
    'common.consulting': 'Consulting',
    'common.waiting': 'Waiting',
    'common.critical': 'Critical',
    'common.normal': 'Normal'
  },

  hi: {
    // Navigation
    'nav.home': 'होम',
    'nav.appointments': 'अपॉइंटमेंट्स',
    'nav.queue': 'लाइव कतार',
    'nav.care': 'मेरी देखभाल',
    'nav.followup': 'फॉलो-अप',
    'nav.emergency_status': 'आपातकालीन मदद',
    'nav.profile': 'प्रोफ़ाइल',
    'nav.notifications': 'सूचनाएँ',
    'nav.logout': 'लॉग आउट',
    'nav.command_center': 'कमांड सेंटर',
    'nav.flow_intelligence': 'फ्लो इंटेलिजेंस',
    'nav.emergency_readiness': 'आपातकालीन तैयारी',
    'nav.care_continuity': 'देखभाल निरंतरता',
    'nav.patients': 'मरीज',
    'nav.doctors': 'चिकित्सक',
    'nav.audit': 'ऑडिट एवं गतिविधि',
    'nav.demo_simulation': 'लाइव डेमो सिमुलेशन',
    'nav.dashboard': 'डैशबोर्ड',
    'nav.my_patients': 'मेरे मरीज',
    'nav.blood_requests': 'रक्त अनुरोध',
    'nav.care_plans': 'देखभाल योजनाएँ',

    // Language
    'lang.selector': 'भाषा',
    'lang.english': 'English',
    'lang.hindi': 'हिंदी',

    // Patient Dashboard
    'patient.welcome': 'पुनः स्वागत है',
    'patient.portal_subtitle': 'आपकी आज की अस्पताल यात्रा',
    'patient.tagline': 'आपकी व्यक्तिगत स्वास्थ्य यात्रा एवं देखभाल समन्वयक',
    'patient.next_appointment': 'अगली अपॉइंटमेंट',
    'patient.no_upcoming_apt': 'कोई आगामी अपॉइंटमेंट नहीं है',
    'patient.book_now': 'नई अपॉइंटमेंट बुक करें',
    'patient.live_queue': 'लाइव कतार',
    'patient.not_in_queue': 'वर्तमान में कतार में नहीं हैं',
    'patient.view_queue': 'लाइव कतार देखें',
    'patient.care_overview': 'मेरी देखभाल एवं स्वास्थ्य लाभ',
    'patient.no_active_care': 'कोई सक्रिय देखभाल योजना नहीं है',
    'patient.view_care': 'देखभाल योजना देखें',
    'patient.recent_notifications': 'हालिया अपडेट',
    'patient.all_notifications': 'सभी सूचनाएँ देखें',
    'patient.my_appointments': 'मेरी अपॉइंटमेंट्स',
    'patient.report_problem': 'समस्या की रिपोर्ट करें',
    'patient.need_urgent_help': 'तत्काल सहायता चाहिए?',
    'patient.emergency_desc': 'हमारी आपातकालीन टीम तुरंत मार्गदर्शन कर सकती है, या आपके स्थान पर अस्पताल एम्बुलेंस भेज सकती है।',
    'patient.request_ambulance': 'अस्पताल एम्बुलेंस का अनुरोध करें',
    'patient.emergency_assistance': 'आपातकालीन सहायता',

    // Queue terms
    'queue.token': 'टोकन',
    'queue.position': 'कतार स्थिति',
    'queue.ahead': 'आपसे पहले मरीज',
    'queue.patients_ahead_text': 'मरीज आपसे पहले कतार में हैं',
    'queue.one_ahead_text': 'मरीज आपसे पहले कतार में है',
    'queue.you_are_next': 'आप अगली बारी में हैं! कृपया परामर्श कक्ष के पास रहें।',
    'queue.currently_consulting': 'डॉक्टर के साथ परामर्श चल रहा है।',
    'queue.predicted_wait': 'अनुमानित प्रतीक्षा समय',
    'queue.status': 'स्थिति',
    'queue.status_waiting': 'प्रतीक्षा में',
    'queue.status_called': 'बुलाया गया — कृपया डॉक्टर कक्ष में जाएँ',
    'queue.status_consulting': 'परामर्श जारी',
    'queue.status_completed': 'पूर्ण',
    'queue.department': 'विभाग',
    'queue.doctor': 'डॉक्टर',
    'queue.emergency_delay_alert': 'आपातकालीन मरीज आने से कतार प्रभावित हुई है। नया अनुमानित समय:',

    // Booking & Symptoms
    'booking.title': 'लक्षण-आधारित बुकिंग',
    'booking.subtitle': 'अपने लक्षण हिंदी, अंग्रेजी या हिंग्लिश में बताएं',
    'booking.symptoms_label': 'अपने लक्षण लिखें',
    'booking.analyze': 'लक्षणों का विश्लेषण करें',
    'booking.analyzing': 'विश्लेषण हो रहा है...',
    'booking.detected_symptoms': 'पहचाने गए लक्षण',
    'booking.confidence': 'सटीकता स्तर',
    'booking.confidence_high': 'उच्च सटीकता',
    'booking.confidence_medium': 'मध्यम सटीकता',
    'booking.confidence_low': 'सामान्य सटीकता',
    'booking.suggested_dept': 'सुझाया गया विभाग',
    'booking.select_doctor': 'डॉक्टर चुनें',
    'booking.select_date': 'पसंदीदा दिनांक',
    'booking.select_time': 'समय स्लॉट',
    'booking.confirm': 'पुष्टि करें और बुक करें',
    'booking.confirmed': 'अपॉइंटमेंट की पुष्टि हो गई ✓',
    'booking.qr_prompt': 'एक्सप्रेस चेक-इन के लिए यह क्यूआर कोड अस्पताल काउंटर पर दिखाएं।',
    'booking.checkin_now': 'अभी चेक-इन करें',
    'booking.print_qr': 'क्यूआर प्रिंट करें',

    // Care & Discharge
    'care.discharge_plan': 'डिस्चार्ज एवं स्वास्थ्य लाभ योजना',
    'care.medications': 'निर्धारित दवाइयाँ',
    'care.diet_plan': 'आहार एवं पोषण निर्देश',
    'care.warning_signs': 'सावधानी के लक्षण',
    'care.follow_up': 'अगली जांच (फॉलो-अप)',
    'care.adherence': 'दवा सेवन नियमितता',
    'care.mark_taken': 'दवा ली',
    'care.snooze': 'बाद में याद दिलाएं',
    'care.taken': 'ली गई',
    'care.report_warning': 'चेतावनी स्थिति की रिपोर्ट करें',
    'care.request_reentry': 'अस्पताल पुनः प्रवेश का अनुरोध',
    'care.recovery_workspace': 'स्वास्थ्य लाभ एवं देखभाल निरंतरता',
    'care.day_milestone': 'दिन {day} / {total}',
    'care.todays_medicines': 'आज की दवाइयाँ',
    'care.taken_count': 'ली गई',
    'care.skipped_count': 'छूटी / छोड़ी गई',
    'care.next_dose': 'अगली खुराक',
    'care.mark_taken_btn': 'दवा ली दर्ज करें',
    'care.skip_dose_btn': 'दवा छोड़ें',
    'care.skip_modal_title': 'दवा छोड़ने का कारण बताएं',
    'care.skip_reason_forgot': 'भूल गए / समय निकल गया',
    'care.skip_reason_unwell': 'तबियत ठीक नहीं लग रही / उल्टी',
    'care.skip_reason_unavailable': 'दवा उपलब्ध नहीं है',
    'care.skip_reason_advised': 'डॉक्टर या फार्मासिस्ट ने सलाह दी',
    'care.skip_reason_other': 'अन्य कारण',
    'care.missed_advisory_title': 'छूटी हुई खुराक सुरक्षा सलाह',
    'care.missed_advisory_text': 'आपकी यह खुराक छूट गई है। अगली खुराक को अपने आप दोगुना न करें। अपने पर्चे के निर्देशों का पालन करें या संदेह होने पर अपनी देखभाल टीम से संपर्क करें।',
    'care.view_instructions': 'निर्देश देखें',
    'care.contact_care_team': 'देखभाल टीम से संपर्क करें',
    'care.report_home_problem': 'घर से समस्या की रिपोर्ट करें',
    'care.seven_day_adherence': '7 दिवसीय दवा सेवन प्रगति',

    // Emergency Two Modes
    'emergency.private_vehicle_title': 'मैं अस्पताल आ रहा हूँ (निजी वाहन / स्वयं आगमन)',
    'emergency.private_vehicle_desc': 'हमारे आपातकालीन ट्रॉमा दल को पहले सूचित करें ताकि आपके पहुँचते ही ट्रॉमा बे तैयार रहे।',
    'emergency.ambulance_title': 'अस्पताल एम्बुलेंस का अनुरोध करें',
    'emergency.ambulance_desc': 'लाइव ट्रैकिंग के साथ आपके स्थान पर सुसज्जित अस्पताल एम्बुलेंस भेजता है।',
    'emergency.prearrival_status': 'आगमन पूर्व स्थिति',
    'emergency.prep_bay_ready': 'इमरजेंसी बे तैयार',

    // Doctor Portal
    'doctor.dashboard': 'डॉक्टर डैशबोर्ड',
    'doctor.todays_schedule': 'आज की कार्यसूची',
    'doctor.patients_waiting': 'प्रतीक्षारत मरीज',
    'doctor.completed_today': 'आज पूर्ण परामर्श',
    'doctor.avg_consult': 'औसत परामर्श समय',
    'doctor.current_patient': 'वर्तमान कक्ष मरीज',
    'doctor.room_empty': 'वर्तमान में कोई मरीज परामर्श में नहीं है',
    'doctor.call_next': 'अगले मरीज को बुलाएं',
    'doctor.start_consult': 'परामर्श शुरू करें',
    'doctor.complete_consult': 'परामर्श पूर्ण करें',
    'doctor.author_care_plan': 'देखभाल योजना तैयार करें',
    'doctor.request_blood': 'आपातकालीन रक्त का अनुरोध करें',
    'doctor.emergency_active': 'आपातकालीन सक्रिय',
    'doctor.next_in_queue': 'कतार में अगला मरीज',

    // Admin Command Center & Flow
    'admin.command_center': 'अस्पताल कमांड सेंटर',
    'admin.active_emergencies': 'सक्रिय आपातकाल',
    'admin.avg_wait': 'औसत प्रतीक्षा',
    'admin.active_patients': 'सक्रिय मरीज',
    'admin.doctor_capacity': 'चिकित्सक क्षमता',
    'admin.live_patient_flow': 'लाइव मरीज प्रवाह',
    'admin.emergency_blood_status': 'आपातकाल एवं रक्त स्थिति',
    'admin.dept_capacity': 'विभागीय परिचालन क्षमता',
    'admin.flow_intelligence': 'फ्लो इंटेलिजेंस',
    'admin.flow_recovery': 'फ्लो रिकवरी इंटेलिजेंस',
    'admin.emergency_impact': 'आपातकालीन विभाग प्रभाव विश्लेषण',
    'admin.what_if': 'व्हाट-इफ सिमुलेटर',
    'admin.run_simulation': 'सिमुलेशन चलाएं',
    'admin.apply_response': 'अनुशंसित प्रतिक्रिया लागू करें',
    'admin.reset_demo': 'डेमो रीसेट करें',
    'admin.live_operations': 'लाइव संचालन फ़ीड',
    'admin.executive_impact': 'कार्यकारी प्रभाव पैनल',

    // General terms
    'common.view_details': 'विवरण देखें',
    'common.view_journey': 'यात्रा देखें',
    'common.close': 'बंद करें',
    'common.save': 'सहेजें',
    'common.cancel': 'रद्द करें',
    'common.submit': 'जमा करें',
    'common.status': 'स्थिति',
    'common.actions': 'कार्रवाई',
    'common.date': 'दिनांक',
    'common.time': 'समय',
    'common.minutes': 'मिनट',
    'common.available': 'उपलब्ध',
    'common.consulting': 'परामर्श जारी',
    'common.waiting': 'प्रतीक्षा में',
    'common.critical': 'गंभीर',
    'common.normal': 'सामान्य'
  }
};

class I18n {
  constructor() {
    this.currentLanguage = Storage.loadLanguage() || 'en';
  }

  getLanguage() {
    return this.currentLanguage;
  }

  setLanguage(lang) {
    if (lang !== 'en' && lang !== 'hi') return;
    this.currentLanguage = lang;
    Storage.saveLanguage(lang);
    eventBus.emit(EventTypes.USER_LANGUAGE_CHANGED, { language: lang });
  }

  t(key, params = {}) {
    const dict = translations[this.currentLanguage] || translations.en;
    let text = dict[key] || translations.en[key] || key;

    // Parameter interpolation
    Object.keys(params).forEach(param => {
      text = text.replace(new RegExp(`{${param}}`, 'g'), params[param]);
    });

    return text;
  }
}

const i18n = new I18n();
export const t = (key, params) => i18n.t(key, params);
export default i18n;
