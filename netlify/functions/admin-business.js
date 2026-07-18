// ============================================================
// Netlify Function: /.netlify/functions/admin-business
// Protected by ADMIN_SECRET - use this to add/update a business.
// This is how you onboard a new client without touching code.
//
// Example (add a business with status schedule):
//   curl -X POST https://africa-wa.netlify.app/.netlify/functions/admin-business \
//     -H "x-admin-key: YOUR_ADMIN_SECRET" \
//     -H "Content-Type: application/json" \
//     -d '{
//           "businessId": "kali-pharm",
//           "phoneNumberId": "1234567890",
//           "accessToken": "META_PERMANENT_TOKEN",
//           "businessName": "Kali Pharm",
//           "businessType": "pharmacy",
//           "aboutBusiness": "A pharmacy in Dar es Salaam...",
//           "faqs": [{"q": "What are your hours?", "a": "8am-8pm daily"}],
//           "hardRules": ["Never give medical advice"],
//           "escalateKeywords": ["refund", "complaint"],
//           "inventory": [{"name": "Paracetamol 500mg", "price": 500, "quantity": 120}],
//           "statusSchedule": {
//             "enabled": true,
//             "time": "08:00",
//             "template": "daily_promo"
//           }
//         }'
//
// Example (fetch a business config to check it):
//   curl "https://africa-wa.netlify.app/.netlify/functions/admin-business?businessId=kali-pharm" \
//     -H "x-admin-key: YOUR_ADMIN_SECRET"
// ============================================================

const { saveBusiness, getBusiness } = require("./lib/store");

// ============================================================
// MAIN HANDLER
// ============================================================
exports.handler = async (event) => {
  // Check admin key
  const adminKey = event.headers["x-admin-key"];
  if (!process.env.ADMIN_SECRET || adminKey !== process.env.ADMIN_SECRET) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  // ============================================================
  // POST - Add or Update a Business
  // ============================================================
  if (event.httpMethod === "POST") {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return { statusCode: 400, body: "Invalid JSON body" };
    }

    // Validate required fields
    const { businessId, phoneNumberId, accessToken } = body;
    if (!businessId || !phoneNumberId || !accessToken) {
      return {
        statusCode: 400,
        body: "businessId, phoneNumberId, and accessToken are required",
      };
    }

    // Build the business configuration
    const businessConfig = {
      // Basic Info
      businessName: body.businessName || businessId,
      businessType: body.businessType || "general", // dresses, pharmacy, restaurant, etc.
      phoneNumberId,
      accessToken,
      
      // Business Details
      aboutBusiness: body.aboutBusiness || "",
      tone: body.tone || "Friendly, professional, short WhatsApp-style replies.",
      
      // Communication Settings
      faqs: body.faqs || [],
      hardRules: body.hardRules || [],
      escalateKeywords: body.escalateKeywords || [],
      
      // Inventory
      inventory: body.inventory || [],
      
      // ============================================================
      // NEW: Status Schedule for Daily WhatsApp Status Updates
      // ============================================================
      statusSchedule: {
        enabled: body.statusSchedule?.enabled !== undefined ? body.statusSchedule.enabled : true,
        time: body.statusSchedule?.time || "08:00",
        template: body.statusSchedule?.template || "daily_promo",
        // Optional: Custom status content
        customText: body.statusSchedule?.customText || "",
        customImage: body.statusSchedule?.customImage || ""
      },
      
      // Optional: Business hours
      businessHours: body.businessHours || {
        open: "08:00",
        close: "20:00",
        days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
      },
      
      // Optional: Location
      location: body.location || {
        address: "",
        city: "",
        country: "Tanzania"
      },
      
      // Optional: Contact info
      contact: body.contact || {
        phone: "",
        email: "",
        website: ""
      },
      
      // Metadata
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "active" // active, paused, suspended
    };

    // Save to Netlify Blobs
    await saveBusiness(businessId, businessConfig);

    return { 
      statusCode: 200, 
      body: JSON.stringify({ 
        ok: true, 
        businessId,
        message: `Business ${businessId} saved successfully`,
        statusSchedule: businessConfig.statusSchedule
      }) 
    };
  }

  // ============================================================
  // GET - Fetch a Business Configuration
  // ============================================================
  if (event.httpMethod === "GET") {
    const businessId = event.queryStringParameters?.businessId;
    if (!businessId) {
      return { 
        statusCode: 400, 
        body: "businessId query param required" 
      };
    }

    const business = await getBusiness(businessId);
    if (!business) {
      return { 
        statusCode: 404, 
        body: "Business not found" 
      };
    }

    // Don't expose the access token in a GET response
    const { accessToken, ...safe } = business;
    return { 
      statusCode: 200, 
      body: JSON.stringify(safe) 
    };
  }

  // ============================================================
  // DELETE - Remove a Business (Optional)
  // ============================================================
  if (event.httpMethod === "DELETE") {
    const businessId = event.queryStringParameters?.businessId;
    if (!businessId) {
      return { 
        statusCode: 400, 
        body: "businessId query param required" 
      };
    }

    // Note: Implement deleteBusiness in store.js if needed
    // await deleteBusiness(businessId);
    
    return { 
      statusCode: 200, 
      body: JSON.stringify({ 
        ok: true, 
        message: `Business ${businessId} deleted` 
      }) 
    };
  }

  // ============================================================
  // PUT - Update Specific Fields (Optional)
  // ============================================================
  if (event.httpMethod === "PUT") {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return { statusCode: 400, body: "Invalid JSON body" };
    }

    const { businessId, updates } = body;
    if (!businessId || !updates) {
      return { 
        statusCode: 400, 
        body: "businessId and updates are required" 
      };
    }

    const existing = await getBusiness(businessId);
    if (!existing) {
      return { 
        statusCode: 404, 
        body: "Business not found" 
      };
    }

    // Merge updates with existing config
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await saveBusiness(businessId, updated);

    return { 
      statusCode: 200, 
      body: JSON.stringify({ 
        ok: true, 
        businessId,
        message: `Business ${businessId} updated successfully`
      }) 
    };
  }

  return { statusCode: 405, body: "Method not allowed" };
};
