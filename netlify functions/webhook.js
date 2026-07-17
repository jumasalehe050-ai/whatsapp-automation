cat > netlify/functions/webhook.js << 'EOF'
const {
  getBusinessByPhoneNumberId,
  getHistory,
  saveHistory,
} = require("./lib/store");
const { sendWhatsAppMessage } = require("./lib/whatsapp");
const { getAIReply, containsEscalationKeyword } = require("./lib/ai");

exports.handler = async (event) => {
  if (event.httpMethod === "GET") {
    const params = event.queryStringParameters || {};
    if (
      params["hub.mode"] === "subscribe" &&
      params["hub.verify_token"] === process.env.WHATSAPP_VERIFY_TOKEN
    ) {
      return { statusCode: 200, body: params["hub.challenge"] };
    }
    return { statusCode: 403, body: "Verification failed" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const payload = JSON.parse(event.body);
    const value = payload.entry?.[0]?.changes?.[0]?.value;
    const incomingMessages = value?.messages;

    if (!incomingMessages || incomingMessages.length === 0) {
      return { statusCode: 200, body: "ok" };
    }

    const phoneNumberId = value.metadata?.phone_number_id;
    const business = await getBusinessByPhoneNumberId(phoneNumberId);

    if (!business) {
      console.error(`No business registered for phone_number_id ${phoneNumberId}`);
      return { statusCode: 200, body: "ok" };
    }

    for (const msg of incomingMessages) {
      if (msg.type !== "text") continue;

      const from = msg.from;
      const text = msg.text?.body?.trim();
      if (!text) continue;

      if (containsEscalationKeyword(text, business.escalateKeywords)) {
        console.log(`🚩 Escalation for ${business.businessId} from ${from}: ${text}`);
        continue;
      }

      const history = await getHistory(business.businessId, from);
      const reply = await getAIReply({ business, history, customerMessage: text });

      await sendWhatsAppMessage({
        phoneNumberId,
        accessToken: business.accessToken,
        to: from,
        text: reply,
      });

      await saveHistory(business.businessId, from, [
        ...history,
        { role: "user", content: text },
        { role: "assistant", content: reply },
      ]);
    }

    return { statusCode: 200, body: "ok" };
  } catch (err) {
    console.error("Webhook error:", err);
    return { statusCode: 200, body: "ok" };
  }
};
EOF
