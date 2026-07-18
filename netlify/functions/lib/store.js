// ============================================================
// All persistent data lives in Netlify Blobs
// ============================================================

const { getStore } = require("@netlify/blobs");

function store() {
  return getStore("businesses");
}

// ============================================================
// BUSINESS FUNCTIONS (Original)
// ============================================================

async function saveBusiness(businessId, config) {
  const s = store();
  await s.setJSON(`business:${businessId}`, { ...config, businessId });
  await s.set(`phone-index:${config.phoneNumberId}`, businessId);
}

async function getBusiness(businessId) {
  const s = store();
  return s.get(`business:${businessId}`, { type: "json" });
}

async function getBusinessByPhoneNumberId(phoneNumberId) {
  const s = store();
  const businessId = await s.get(`phone-index:${phoneNumberId}`, { type: "text" });
  if (!businessId) return null;
  return getBusiness(businessId);
}

async function getHistory(businessId, customerPhone) {
  const s = store();
  const history = await s.get(`history:${businessId}:${customerPhone}`, { type: "json" });
  return history || [];
}

async function saveHistory(businessId, customerPhone, history) {
  const s = store();
  await s.setJSON(`history:${businessId}:${customerPhone}`, history.slice(-6));
}

// ============================================================
// PATIENT FOLLOW-UP FUNCTIONS (NEW)
// ============================================================

// Save a new patient
async function savePatient(patientId, data) {
  const s = store();
  await s.setJSON(`patient:${patientId}`, {
    ...data,
    createdAt: new Date().toISOString(),
    active: true,
    followUps: [],
    lastFollowUp: null,
    language: null,
    languageAsked: false
  });
}

// Get a single patient
async function getPatient(patientId) {
  const s = store();
  return s.get(`patient:${patientId}`, { type: "json" });
}

// Get all patients
async function getAllPatients() {
  const s = store();
  const list = await s.list();
  const patients = [];
  
  for (const key of list) {
    if (key.key && key.key.startsWith("patient:")) {
      const patient = await s.get(key.key, { type: "json" });
      if (patient) {
        patients.push(patient);
      }
    }
  }
  
  return patients;
}

// Get patients due for follow-up (3 days after last follow-up)
async function getPatientsDueForFollowUp() {
  const s = store();
  const list = await s.list();
  const patients = [];
  const now = new Date();
  
  for (const key of list) {
    if (key.key && key.key.startsWith("patient:")) {
      const patient = await s.get(key.key, { type: "json" });
      if (!patient || !patient.active) continue;
      
      const lastDate = patient.lastFollowUp || patient.createdAt;
      const daysSince = (now - new Date(lastDate)) / (1000 * 60 * 60 * 24);
      
      if (daysSince >= 3) {
        patients.push(patient);
      }
    }
  }
  
  return patients;
}

// Get patient by phone number
async function getPatientByPhone(phone) {
  const s = store();
  const list = await s.list();
  
  for (const key of list) {
    if (key.key && key.key.startsWith("patient:")) {
      const patient = await s.get(key.key, { type: "json" });
      if (patient && patient.phone === phone) {
        return patient;
      }
    }
  }
  return null;
}

// Record a follow-up response
async function recordFollowUp(patientId, response, notes) {
  const s = store();
  const patient = await getPatient(patientId);
  if (!patient) return;
  
  const followUp = {
    date: new Date().toISOString(),
    response: response,
    notes: notes || ""
  };
  
  patient.followUps = patient.followUps || [];
  patient.followUps.push(followUp);
  patient.lastFollowUp = new Date().toISOString();
  
  await s.setJSON(`patient:${patientId}`, patient);
  return followUp;
}

// Update patient's language preference
async function updatePatientLanguage(patientId, language) {
  const s = store();
  const patient = await getPatient(patientId);
  if (!patient) return;
  
  patient.language = language;
  patient.languageAsked = true;
  await s.setJSON(`patient:${patientId}`, patient);
}

// Update patient active status
async function updatePatientStatus(patientId, active) {
  const s = store();
  const patient = await getPatient(patientId);
  if (!patient) return;
  
  patient.active = active;
  await s.setJSON(`patient:${patientId}`, patient);
}

// ============================================================
// EXPORT ALL FUNCTIONS
// ============================================================

module.exports = {
  // Business functions
  saveBusiness,
  getBusiness,
  getBusinessByPhoneNumberId,
  getHistory,
  saveHistory,
  // Patient functions
  savePatient,
  getPatient,
  getAllPatients,
  getPatientsDueForFollowUp,
  getPatientByPhone,
  recordFollowUp,
  updatePatientLanguage,
  updatePatientStatus
};
