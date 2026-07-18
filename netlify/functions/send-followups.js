// ============================================================
// Function: /.netlify/functions/send-followups
// Sends follow-up messages every 3 days
// Asks language choice first if not set
// ============================================================

const { 
  getPatientsDueForFollowUp, 
  recordFollowUp,
  updatePatientLanguage 
} = require("./lib/store");
const { sendWhatsAppMessage } = require("./lib/whatsapp");

exports.handler = async (event) => {
  // GET - Show status
  if (event.httpMethod === "GET") {
    return {
      statusCode: 200,
      body: JSON.stringify({
        status: "Online",
        schedule: "Every 3 days",
        endpoint: "POST to trigger manually"
      })
    };
  }

  // Only allow POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed. Use POST." };
  }

  // Verify admin key
  const adminKey = event.headers["x-admin-key"];
  if (adminKey !== process.env.ADMIN_SECRET) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  try {
    const patients = await getPatientsDueForFollowUp();
    let sentCount = 0;

    for (const patient of patients) {
      // ============================================================
      // STEP 1: If language not asked yet, ask for language
      // ============================================================
      if (!patient.languageAsked) {
        const message = `🏥 *${patient.pharmacyName || "Pharmacy"}* - Language Choice

Hello ${patient.name},

Please choose your preferred language:
1️⃣ English
2️⃣ Kiswahili

Reply with 1 or 2.

---
Habari ${patient.name},

Tafadhali chagua lugha unayopenda:
1️⃣ Kiingereza
2️⃣ Kiswahili

Jibu kwa 1 au 2.`;

        await sendWhatsAppMessage({
          phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
          accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
          to: patient.phone,
          text: message
        });
        
        sentCount++;
        await recordFollowUp(patient.patientId, "LANGUAGE_ASKED", "Language choice requested");
        continue;
      }

      // ============================================================
      // STEP 2: Send in English
      // ============================================================
      if (patient.language === "en") {
        const message = `🌿 *How are you today?*

Dear *${patient.name}*,

We hope you're feeling well. ${patient.pharmacyName || "Our pharmacy"} is checking on you.

We know illness can be tough, and we're sorry for what you're going through.

Please reply:
✅ *GOOD* - I feel good
⚠️ *BAD* - I don't feel well
🚨 *WORSE* - I feel much worse

If you have any questions, please let us know.

We care about you!
*${patient.pharmacyName || "Pharmacy"}*`;

        await sendWhatsAppMessage({
          phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
          accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
          to: patient.phone,
          text: message
        });
        
        sentCount++;
        await recordFollowUp(patient.patientId, "PENDING_EN", "Follow-up sent in English");
      }

      // ============================================================
      // STEP 3: Send in Kiswahili
      // ============================================================
      else if (patient.language === "sw") {
        const message = `🌿 *Habari za leo?*

Mpendwa *${patient.name}*,

Tunatumaini kuwa unajisikia vizuri. ${patient.pharmacyName || "Pharmacy yetu"} inakukumbusha.

Tunajua ugonjwa ni mgumu, na tunakwambia *pole*.

Tafadhali jibu:
✅ *NZURI* - Najisikia vizuri
⚠️ *MBAYA* - Sijisikii vizuri
🚨 *ZAIDI MBAYA* - Ninajisikia vibaya zaidi

Kama una maswali, tujulishe.

Tunakujali!
*${patient.pharmacyName || "Pharmacy yetu"}*`;

        await sendWhatsAppMessage({
          phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
          accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
          to: patient.phone,
          text: message
        });
        
        sentCount++;
        await recordFollowUp(patient.patientId, "PENDING_SW", "Follow-up sent in Swahili");
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        sent: sentCount,
        total: patients.length,
        message: `Sent ${sentCount} follow-up messages`
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// ============================================================
// AUTO-SCHEDULE: Runs every day at 9:00 AM UTC
// ============================================================
export const config = {
  schedule: "0 9 * * *"
};
