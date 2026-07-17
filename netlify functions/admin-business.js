cat > netlify/functions/admin-business.js << 'EOF'
const { saveBusiness, getBusiness } = require("./lib/store");

exports.handler = async (event) => {
  const adminKey = event.headers["x-admin-key"];
  if (!process.env.ADMIN_SECRET || adminKey !== process.env.ADMIN_SECRET) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  if (event.httpMethod === "POST") {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return { statusCode: 400, body: "Invalid JSON body" };
    }

    const { businessId, phoneNumberId, accessToken } = body;
    if (!businessId || !phoneNumberId || !accessToken) {
      return {
        statusCode: 400,
        body: "businessId, phoneNumberId, and accessToken are required",
      };
    }

    await saveBusiness(businessId, {
      businessName: body.businessName || businessId,
      phoneNumberId,
      accessToken,
      aboutBusiness: body.aboutBusiness || "",
      tone: body.tone || "Friendly, professional, short WhatsApp-style replies.",
      faqs: body.faqs || [],
      hardRules: body.hardRules || [],
      escalateKeywords: body.escalateKeywords || [],
      inventory: body.inventory || [],
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true, businessId }) };
  }

  if (event.httpMethod === "GET") {
    const businessId = event.queryStringParameters?.businessId;
    if (!businessId) return { statusCode: 400, body: "businessId query param required" };

    const business = await getBusiness(businessId);
    if (!business) return { statusCode: 404, body: "Business not found" };

    const { accessToken, ...safe } = business;
    return { statusCode: 200, body: JSON.stringify(safe) };
  }

  return { statusCode: 405, body: "Method not allowed" };
};
EOF
