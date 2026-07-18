// ============================================================
// Function: /.netlify/functions/manage-patient
// Add, view, update patients
// ============================================================

const { 
  savePatient, 
  getPatient, 
  getAllPatients, 
  updatePatientStatus 
} = require("./lib/store");

exports.handler = async (event) => {
  // Protect with admin key
  const adminKey = event.headers["x-admin-key"];
  if (adminKey !== process.env.ADMIN_SECRET) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  // ============================================================
  // GET - List all patients or get one
  // ============================================================
  if (event.httpMethod === "GET") {
    const patientId = event.queryStringParameters?.patientId;
    
    if (patientId) {
      const patient = await getPatient(patientId);
      if (!patient) {
        return { statusCode: 404, body: "Patient not found" };
      }
      return { statusCode: 200, body: JSON.stringify(patient) };
    }
    
    const patients = await getAllPatients();
    return { statusCode: 200, body: JSON.stringify(patients) };
  }

  // ============================================================
  // POST - Add a new patient
  // ============================================================
  if (event.httpMethod === "POST") {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return { statusCode: 400, body: "Invalid JSON" };
    }
    
    const { patientId, name, phone, medication, pharmacyName } = body;
    
    if (!patientId || !name || !phone || !medication) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: "patientId, name, phone, and medication are required" 
        })
      };
    }

    await savePatient(patientId, {
      name,
      phone,
      medication,
      pharmacyName: pharmacyName || "Pharmacy yetu",
      pharmacyId: body.pharmacyId || "default"
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        patientId, 
        message: `Patient ${name} added successfully. First follow-up in 3 days.`
      })
    };
  }

  // ============================================================
  // PUT - Update patient status (active/inactive)
  // ============================================================
  if (event.httpMethod === "PUT") {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return { statusCode: 400, body: "Invalid JSON" };
    }
    
    const { patientId, active } = body;
    
    if (!patientId) {
      return { statusCode: 400, body: JSON.stringify({ error: "patientId required" }) };
    }
    
    await updatePatientStatus(patientId, active);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        patientId, 
        active, 
        message: `Patient ${active ? 'activated' : 'paused'}` 
      })
    };
  }

  return { statusCode: 405, body: "Method not allowed" };
};
