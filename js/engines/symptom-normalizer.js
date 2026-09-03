// ============================================
// HospitalFlow AI — Multilingual Symptom Normalization Engine
// ============================================

import i18n from '../i18n.js';

/** Canonical symptom concept labels */
export const SYMPTOM_LABELS = {
  FEVER: {
    en: 'Fever',
    hi: 'बुखार'
  },
  COUGH: {
    en: 'Cough',
    hi: 'खांसी'
  },
  HEADACHE: {
    en: 'Headache',
    hi: 'सिर दर्द'
  },
  ABDOMINAL_PAIN: {
    en: 'Abdominal Pain',
    hi: 'पेट दर्द'
  },
  BREATHING_DIFFICULTY: {
    en: 'Shortness of Breath',
    hi: 'सांस लेने में कठिनाई'
  },
  CHEST_PAIN: {
    en: 'Chest Pain',
    hi: 'सीने में दर्द'
  },
  VOMITING: {
    en: 'Vomiting / Nausea',
    hi: 'उल्टी / मतली'
  },
  DIZZINESS: {
    en: 'Dizziness',
    hi: 'चक्कर आना'
  },
  SKIN_RASH: {
    en: 'Skin Rash / Itching',
    hi: 'त्वचा पर चकत्ते / खुजली'
  },
  JOINT_PAIN: {
    en: 'Joint / Bone Pain',
    hi: 'जोड़ों / हड्डियों में दर्द'
  },
  SORE_THROAT: {
    en: 'Sore Throat',
    hi: 'गले में खराश'
  },
  INJURY: {
    en: 'Physical Injury / Sprain',
    hi: 'चोट / मोच'
  }
};

/** Department names in English and Hindi */
export const DEPARTMENT_LABELS = {
  'General Medicine': { en: 'General Medicine', hi: 'जनरल मेडिसिन' },
  'Cardiology': { en: 'Cardiology', hi: 'हृदय रोग विभाग (कार्डियोलॉजी)' },
  'Orthopedics': { en: 'Orthopedics', hi: 'हड्डी रोग विभाग (ऑर्थोपेडिक्स)' },
  'Neurology': { en: 'Neurology', hi: 'तंत्रिका रोग विभाग (न्यूरोलॉजी)' },
  'Dermatology': { en: 'Dermatology', hi: 'त्वचा रोग विभाग (डर्मेटोलॉजी)' },
  'Pediatrics': { en: 'Pediatrics', hi: 'बाल रोग विभाग (पीडियाट्रिक्स)' }
};

/** Comprehensive multilingual dictionary for symptom keyword matching */
const SYMPTOM_DICTIONARY = [
  {
    code: 'FEVER',
    keywords: [
      'fever', 'febrile', 'pyrexia', 'high temperature', 'chills', 'shivering',
      'बुखार', 'ताप', 'बुखार है', 'गरमी', 'ठंड लग रही',
      'bukhar', 'bukhaar', 'bukhar hai', 'tez bukhar', 'tap', 'thand lag rahi hai', 'feverish', 'body garam'
    ]
  },
  {
    code: 'COUGH',
    keywords: [
      'cough', 'coughing', 'dry cough', 'wet cough', 'phlegm', 'sputum',
      'खांसी', 'खाँसी', 'कफ', 'बलगम', 'खांसी आ रही',
      'khansi', 'khaasi', 'khasi', 'cough hai', 'sukhi khansi', 'balgam', 'kaf', 'khasi aa rahi'
    ]
  },
  {
    code: 'HEADACHE',
    keywords: [
      'headache', 'head pain', 'migraine', 'throbbing head',
      'सिर दर्द', 'सिर में दर्द', 'सरदर्द', 'माइग्रेन', 'माथा दर्द',
      'sir dard', 'sar dard', 'sir me dard', 'sar me dard', 'sir dukh raha', 'migraine', 'headache hai', 'matha dard'
    ]
  },
  {
    code: 'ABDOMINAL_PAIN',
    keywords: [
      'stomach pain', 'abdominal pain', 'belly ache', 'cramps', 'indigestion', 'gastric',
      'पेट दर्द', 'पेट में दर्द', 'पेट खराब', 'मरोड़', 'गैस',
      'pet dard', 'pet me dard', 'pet dukh raha', 'stomach pain', 'pet kharab', 'gas', 'marod', 'tummy ache'
    ]
  },
  {
    code: 'BREATHING_DIFFICULTY',
    keywords: [
      'shortness of breath', 'breathless', 'difficulty breathing', 'asthma', 'wheezing',
      'सांस लेने में दिक्कत', 'सांस फूलना', 'दम घुटना', 'सांस की तकलीफ',
      'saans lene me dikkat', 'saas lene me dikkat', 'saans phoolna', 'dam ghutna', 'breathlessness', 'saans me takleef'
    ],
    isEmergencyPotential: true
  },
  {
    code: 'CHEST_PAIN',
    keywords: [
      'chest pain', 'chest tightness', 'heart pain', 'pressure in chest', 'angina',
      'सीने में दर्द', 'छाती में दर्द', 'दिल में दर्द', 'सीने में जलन',
      'seene me dard', 'chhati me dard', 'chest pain', 'dil me dard', 'seene me jalan', 'chhati me jalan', 'heavy chest'
    ],
    isEmergencyPotential: true
  },
  {
    code: 'VOMITING',
    keywords: [
      'vomiting', 'nausea', 'throwing up', 'queasy', 'emesis',
      'उल्टी', 'मतली', 'जी मिचलाना', 'उल्टियां',
      'ulti', 'ultiyan', 'jee ghabrana', 'jee michlana', 'matli', 'vomit', 'vomiting hai'
    ]
  },
  {
    code: 'DIZZINESS',
    keywords: [
      'dizziness', 'vertigo', 'lightheaded', 'fainting', 'unsteady',
      'चक्कर आना', 'चक्कर', 'बेहोशी', 'सिर घूमना',
      'chakkar', 'chakkar aana', 'sir ghoom raha', 'behoshi', 'giddiness', 'dizzy'
    ]
  },
  {
    code: 'SKIN_RASH',
    keywords: [
      'rash', 'itching', 'skin allergy', 'hives', 'red spots', 'eczema',
      'खुजली', 'चकत्ते', 'त्वचा रोग', 'एलर्जी', 'दाने',
      'khujli', 'khujli ho rahi', 'rash', 'dane', 'skin allergy', 'chakatte', 'lal dane'
    ]
  },
  {
    code: 'JOINT_PAIN',
    keywords: [
      'joint pain', 'knee pain', 'back pain', 'bone pain', 'arthritis', 'shoulder pain',
      'जोड़ों में दर्द', 'घुटने में दर्द', 'कमर दर्द', 'हड्डी में दर्द',
      'jodon me dard', 'ghutne me dard', 'kamar dard', 'peeth dard', 'joint pain', 'haddi me dard', 'ghutna dard'
    ]
  },
  {
    code: 'SORE_THROAT',
    keywords: [
      'sore throat', 'throat pain', 'difficulty swallowing', 'tonsils',
      'गले में दर्द', 'गले में खराश', 'गला खराब', 'टॉन्सिल',
      'gale me dard', 'gale me kharash', 'gala kharab', 'sore throat', 'tonsil', 'nigalne me dard'
    ]
  },
  {
    code: 'INJURY',
    keywords: [
      'injury', 'wound', 'cut', 'sprain', 'fracture', 'bleeding', 'accident',
      'चोट', 'मोच', 'घाव', 'खून बहना', 'हड्डी टूटना', 'दुर्घटना',
      'chot', 'chot lag gayi', 'moch', 'ghao', 'fracture', 'khoon nikal raha', 'accident'
    ],
    isEmergencyPotential: true
  }
];

const SymptomNormalizer = {
  /**
   * Analyze raw symptom text and return normalized structured output
   * Independent of UI language — only standardizes medical concepts
   */
  normalize(rawText) {
    if (!rawText || !rawText.trim()) {
      return {
        originalText: '',
        detectedLanguage: 'en',
        normalizedSymptoms: [],
        confidence: 'low',
        isEmergency: false,
        suggestedDepartment: 'General Medicine',
        recommendationReason: 'Default consultation'
      };
    }

    const clean = rawText.toLowerCase().trim();
    const detectedLanguage = this._detectLanguage(clean);
    const matchedCodes = new Set();
    let isEmergency = false;

    // Check emergency critical trigger phrases
    const emergencyTriggers = [
      'severe chest pain', 'heart attack', 'unconscious', 'major bleeding', 'severe breathing difficulty',
      'बहुत तेज सीने में दर्द', 'बेहोश', 'बहुत ज्यादा खून', 'अटैक',
      'bahut tez seene me dard', 'behoshi', 'khoon beh raha', 'heart attack', 'attack', 'saans nahi aa rahi'
    ];

    if (emergencyTriggers.some(trigger => clean.includes(trigger))) {
      isEmergency = true;
    }

    // Match keywords against dictionary
    SYMPTOM_DICTIONARY.forEach(symptom => {
      for (const kw of symptom.keywords) {
        // Word boundary or substring matching
        if (clean.includes(kw.toLowerCase())) {
          matchedCodes.add(symptom.code);
          if (symptom.isEmergencyPotential && (clean.includes('severe') || clean.includes('tez') || clean.includes('bahut') || clean.includes('बहुत'))) {
            isEmergency = true;
          }
          break;
        }
      }
    });

    const normalizedSymptoms = Array.from(matchedCodes);

    // Calculate confidence level
    let confidence = 'low';
    if (normalizedSymptoms.length >= 2 || isEmergency) {
      confidence = 'high';
    } else if (normalizedSymptoms.length === 1) {
      confidence = 'medium';
    }

    // Determine suggested department & reason
    const routing = this._routeDepartment(normalizedSymptoms, isEmergency);

    return {
      originalText: rawText,
      detectedLanguage,
      normalizedSymptoms,
      confidence,
      isEmergency,
      suggestedDepartment: routing.department,
      recommendationReason: routing.reason
    };
  },

  /**
   * Get localized labels for an array of symptom codes according to UI language
   */
  getLocalizedLabels(symptomCodes, lang = null) {
    const currentLang = lang || i18n.getLanguage();
    return symptomCodes.map(code => {
      const labelObj = SYMPTOM_LABELS[code];
      return {
        code,
        label: labelObj ? (labelObj[currentLang] || labelObj.en) : code
      };
    });
  },

  /**
   * Get localized department label
   */
  getLocalizedDepartment(department, lang = null) {
    const currentLang = lang || i18n.getLanguage();
    const labelObj = DEPARTMENT_LABELS[department];
    return labelObj ? (labelObj[currentLang] || labelObj.en) : department;
  },

  // ---- Private Helpers ----

  _detectLanguage(text) {
    // Check for Devanagari Unicode range (0900-097F)
    if (/[\u0900-\u097F]/.test(text)) {
      return 'hi-Deva';
    }
    // Check for common Roman Hindi markers
    const romanHindiMarkers = ['mujhe', 'hai', 'dard', 'bukhar', 'khansi', 'me', 'ho', 'raha', 'rahi', 'pet', 'seene', 'bahut'];
    const words = text.split(/\s+/);
    const hasRomanHindi = words.some(w => romanHindiMarkers.includes(w));
    return hasRomanHindi ? 'hi-Latn' : 'en';
  },

  _routeDepartment(codes, isEmergency) {
    if (isEmergency || codes.includes('CHEST_PAIN') || codes.includes('BREATHING_DIFFICULTY')) {
      return {
        department: 'Cardiology',
        reason: 'Symptoms indicate potential cardiac / respiratory condition requiring prioritized evaluation.'
      };
    }
    if (codes.includes('JOINT_PAIN') || codes.includes('INJURY')) {
      return {
        department: 'Orthopedics',
        reason: 'Musculoskeletal and joint symptoms route to Orthopedics specialist.'
      };
    }
    if (codes.includes('SKIN_RASH')) {
      return {
        department: 'Dermatology',
        reason: 'Dermatological and skin allergy symptoms route to Dermatology specialist.'
      };
    }
    if (codes.includes('HEADACHE') || codes.includes('DIZZINESS')) {
      return {
        department: 'Neurology',
        reason: 'Neurological symptoms route to Clinical Neurology specialist.'
      };
    }
    return {
      department: 'General Medicine',
      reason: 'General primary care and internal medicine consultation.'
    };
  }
};

export default SymptomNormalizer;
