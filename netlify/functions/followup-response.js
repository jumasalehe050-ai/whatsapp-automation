// ============================================================
// Function: /.netlify/functions/followup-response
// Handles patient replies (language choice, GOOD/BAD/WORSE, NZURI/MBAYA/ZAIDI)
// ============================================================

const { 
  getPatientByPhone, 
  recordFollowUp, 
  updatePatientLanguage 
} = require("./lib/store");
const { sendWhatsAppMessage } = require("./lib/whatsapp");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { from, body } = JSON.parse(event.body);
    const response = body.trim().toUpperCase();
    
    const patient = await getPatientByPhone(from);
    if (!patient) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Patient not found" })
      };
    }

    // ============================================================
    // STEP 1: Handle LANGUAGE CHOICE
    // ============================================================
    if (!patient.languageAsked) {
      let language = null;
      let replyMessage = "";
      
      if (response === "1" || response.includes("ENGLISH") || response === "EN") {
        language = "en";
        await updatePatientLanguage(patient.patientId, "en");
        replyMessage = `✅ Great! We'll send you messages in English from now on.

We'll check on you again in 3 days. Stay healthy!

*${patient.pharmacyName || "Pharmacy"}*`;
      }
      else if (response === "2" || response.includes("KISWAHILI") || response === "SW") {
        language = "sw";
        await updatePatientLanguage(patient.patientId, "sw");
        replyMessage = `✅ Sawa! Tutakutumia ujumbe kwa Kiswahili.

Tutakuwasiliana tena baada ya siku 3. Kuwa mzima!

*${patient.pharmacyName || "Pharmacy yetu"}*`;
      }
      else {
        replyMessage = `❌ Tafadhali chagua / Please choose:
1 = English / Kiingereza
2 = Kiswahili`;
      }

      await sendWhatsAppMessage({
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
        accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
        to: patient.phone,
        text: replyMessage
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, language: language })
      };
    }

    // ============================================================
    // STEP 2: Handle ENGLISH responses
    // ============================================================
    if (patient.language === "en") {
      let replyMessage = "";
      let alertMessage = "";
      
      if (response.includes("GOOD")) {
        replyMessage = `🎉 *Great to hear, ${patient.name}!*

We're happy you're feeling well. Keep taking your medication and we'll check in again in 3 days.

We care about you!
*${patient.pharmacyName || "Pharmacy"}*`;
        await recordFollowUp(patient.patientId, "GOOD", "Patient feeling good");
      }
      else if (response.includes("BAD") && !response.includes("WORSE")) {
        replyMessage = `😔 *Sorry to hear that, ${patient.name}.*

You can:
1️⃣ Visit us at ${patient.pharmacyName || "our pharmacy"} for advice
2️⃣ We'll call you soon

Please let us know if you need anything.

*${patient.pharmacyName || "Pharmacy"}*`;
        await recordFollowUp(patient.patientId, "BAD", "Patient feeling bad");
        
        // Send alert to pharmacy
        alertMessage = `🚨 PATIENT ALERT 🚨

Patient: ${patient.name}
Phone: ${patient.phone}
Medication: ${patient.medication || "Not specified"}
Status: BAD

ACTION REQUIRED: Call patient immediately!`;
        
        await sendWhatsAppMessage({
          phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
          accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
          to: process.env.PHARMACY_PHONE_NUMBER || "255772353008",
          text: alertMessage
        });
      }
      else if (response.includes("WORSE")) {
        replyMessage = `🚨 *We're very sorry, ${patient.name}!*

Please take immediate action:
1️⃣ We'll call you in 5 minutes
2️⃣ Visit us at ${patient.pharmacyName || "our pharmacy"} now
3️⃣ If serious, go to the nearest hospital

*${patient.pharmacyName || "Pharmacy"}*`;
        await recordFollowUp(patient.patientId, "WORSE", "EMERGENCY: Patient feeling worse");
        
        // Send urgent alert
        alertMessage = `🚨🚨 URGENT PATIENT ALERT 🚨🚨

Patient: ${patient.name}
Phone: ${patient.phone}
Medication: ${patient.medication || "Not specified"}
Status: WORSE

URGENT ACTION REQUIRED: Call patient immediately!`;
        
        await sendWhatsAppMessage({
          phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
          accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
          to: process.env.PHARMACY_PHONE_NUMBER || "255772353008",
          text: alertMessage
        });
      }
      else if (response.includes("?")) {
        replyMessage = `📞 *Your questions matter, ${patient.name}.*

Please:
1️⃣ Call us directly at ${process.env.PHARMACY_PHONE_NUMBER || "our number"}
2️⃣ Or we'll call you soon

*${patient.pharmacyName || "Pharmacy"}*`;
        await recordFollowUp(patient.patientId, "QUESTION", "Patient asked a question");
      }
      else {
        replyMessage = `😊 *We didn't understand, ${patient.name}.*

Please reply with:
✅ GOOD
⚠️ BAD
🚨 WORSE

*${patient.pharmacyName || "Pharmacy"}*`;
      }

      await sendWhatsAppMessage({
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
        accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
        to: patient.phone,
        text: replyMessage
      });
    }

    // ============================================================
    // STEP 3: Handle KISWAHILI responses
    // ============================================================
    else if (patient.language === "sw") {
      let replyMessage = "";
      let alertMessage = "";
      
      if (response.includes("NZURI")) {
        replyMessage = `🎉 *Hongera sana ${patient.name}!*

Inafurahisha kusikia unajisikia vizuri. Endelea kutumia dawa yako na tutakuwasiliana tena baada ya siku 3.

Tunakujali!
*${patient.pharmacyName || "Pharmacy yetu"}*`;
        await recordFollowUp(patient.patientId, "NZURI", "Patient feeling good");
      }
      else if (response.includes("MBAYA") && !response.includes("ZAIDI")) {
        replyMessage = `😔 *Pole sana ${patient.name}.*

Unaweza:
1️⃣ Kurudi pharmacy ${patient.pharmacyName || "yetu"} kwa ushauri
2️⃣ Tutakupigia simu hivi karibuni

Tunakujali!
*${patient.pharmacyName || "Pharmacy yetu"}*`;
        await recordFollowUp(patient.patientId, "MBAYA", "Patient feeling bad");
        
        // Send alert in Swahili
        alertMessage = `🚨 TAARIFA YA MGONJWA 🚨

Mgonjwa: ${patient.name}
Simu: ${patient.phone}
Dawa: ${patient.medication || "Haijabainishwa"}
Hali: MBAYA

HATUA: Mpigie simu mgonjwa mara moja!`;
        
        await sendWhatsAppMessage({
          phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
          accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
          to: process.env.PHARMACY_PHONE_NUMBER || "255772353008",
          text: alertMessage
        });
      }
      else if (response.includes("ZAIDI") || response.includes("VIBYA")) {
        replyMessage = `🚨 *Pole sana ${patient.name}!*

Tafadhali chukua hatua:
1️⃣ Tutakupigia simu ndani ya dakika 5
2️⃣ Rudi pharmacy ${patient.pharmacyName || "yetu"} sasa hivi
3️⃣ Kama mbaya, nenda hospitali karibu nawe

Tunakujali!
*${patient.pharmacyName || "Pharmacy yetu"}*`;
        await recordFollowUp(patient.patientId, "ZAIDI_MBAYA", "EMERGENCY: Patient feeling worse");
        
        // Send urgent alert in Swahili
        alertMessage = `🚨🚨 TAARIFA YA DHARURA 🚨🚨

Mgonjwa: ${patient.name}
Simu: ${patient.phone}
Dawa: ${patient.medication || "Haijabainishwa"}
Hali: ZAIDI MBAYA

HATUA ZA DHARURA: Mpigie simu mgonjwa mara moja!`;
        
        await sendWhatsAppMessage({
          phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
          accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
          to: process.env.PHARMACY_PHONE_NUMBER || "255772353008",
          text: alertMessage
        });
      }
      else if (response.includes("?")) {
        replyMessage = `📞 *Maswali yako ni muhimu, ${patient.name}.*

Tafadhali:
1️⃣ Tupigie simu ${process.env.PHARMACY_PHONE_NUMBER || "namba yetu"}
2️⃣ Au tutakupigia simu

*${patient.pharmacyName || "Pharmacy yetu"}*`;
        await recordFollowUp(patient.patientId, "SWALI", "Patient asked a question");
      }
      else {
        replyMessage = `😊 *Hatukuelewa, ${patient.name}.*

Tafadhali jibu:
✅ NZURI
⚠️ MBAYA
🚨 ZAIDI MBAYA

*${patient.pharmacyName || "Pharmacy yetu"}*`;
      }

      await sendWhatsAppMessage({
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
        accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
        to: patient.phone,
        text: replyMessage
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
