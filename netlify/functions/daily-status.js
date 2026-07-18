// ============================================================
// Netlify Function: /.netlify/functions/daily-status
// Sends daily WhatsApp Status updates for all your clients
// ============================================================

const { getBusiness } = require("./lib/store");

// ============================================================
// SEND STATUS UPDATE USING META'S MEDIA API
// ============================================================
async function sendWhatsAppStatus({ phoneNumberId, accessToken, mediaUrl, caption }) {
  // Step 1: Upload the media to Meta
  const uploadUrl = `https://graph.facebook.com/v20.0/${phoneNumberId}/media`;
  
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      type: "image",
      image: {
        link: mediaUrl,
        caption: caption
      }
    })
  });

  if (!uploadResponse.ok) {
    const error = await uploadResponse.text();
    throw new Error(`Media upload failed: ${error}`);
  }

  const uploadData = await uploadResponse.json();
  console.log("✅ Media uploaded:", uploadData);
  
  return uploadData;
}

// ============================================================
// GET DAILY STATUS CONTENT FOR A BUSINESS
// ============================================================
async function getDailyContent(businessId) {
  const business = await getBusiness(businessId);
  
  // Default content templates based on business type
  const templates = {
    "dresses": {
      imageUrl: "https://africa-wa.netlify.app/images/dresses/daily-1.jpg",
      text: `🔥 NEW ARRIVALS! 🔥\n\n${business.businessName || "Duka la Mavazi"}\n\nKitenge dresses just arrived!\nPrices from TZS 25,000\n\n📍 Order via WhatsApp\n📞 0772 353 008`
    },
    "pharmacy": {
      imageUrl: "https://africa-wa.netlify.app/images/pharmacy/daily-1.jpg",
      text: `💊 HEALTH UPDATE 💊\n\n${business.businessName || "Duka la Dawa"}\n\n✅ Paracetamol 500mg - TZS 500\n✅ Amoxicillin 250mg - TZS 2,500\n✅ Face masks - TZS 1,000\n\nOrder now for delivery! 🚀`
    },
    "restaurant": {
      imageUrl: "https://africa-wa.netlify.app/images/restaurant/daily-1.jpg",
      text: `🍛 TODAY'S SPECIAL 🍛\n\n${business.businessName || "Mgahawa"}\n\nPilau with beef - TZS 5,000\n\nOrder before 2 PM for lunch delivery!\n📞 0772 353 008`
    },
    "general": {
      imageUrl: "https://africa-wa.netlify.app/images/default-promo.jpg",
      text: `📢 SPECIAL OFFER!\n\n${business.businessName || "Our Business"}\n\nContact us today!\n📞 0772 353 008`
    }
  };

  // If custom text/image is provided, use that
  if (business.statusSchedule?.customText) {
    return {
      imageUrl: business.statusSchedule?.customImage || templates[business.businessType]?.imageUrl || templates.general.imageUrl,
      text: business.statusSchedule.customText
    };
  }

  // Otherwise use the template
  const template = templates[business.businessType] || templates.general;
  return template;
}

// ============================================================
// SEND STATUS FOR A SINGLE BUSINESS
// ============================================================
async function sendStatusUpdate(businessId) {
  try {
    const business = await getBusiness(businessId);
    
    if (!business) {
      return { error: `Business ${businessId} not found` };
    }
    
    // Check if status updates are enabled
    if (!business.statusSchedule || business.statusSchedule.enabled === false) {
      return { error: `Status updates disabled for ${business.businessName}` };
    }
    
    // Get today's content
    const content = await getDailyContent(businessId);
    
    // Send as WhatsApp Status
    const result = await sendWhatsAppStatus({
      phoneNumberId: business.phoneNumberId,
      accessToken: business.accessToken,
      mediaUrl: content.imageUrl,
      caption: content.text
    });
    
    console.log(`✅ Status sent for ${business.businessName}`);
    
    return { 
      success: true, 
      businessId: businessId,
      businessName: business.businessName,
      result: result
    };
    
  } catch (error) {
    console.error(`❌ Failed for ${businessId}:`, error.message);
    return { error: error.message };
  }
}

// ============================================================
// GET ALL BUSINESSES (You'll need to implement this)
// ============================================================
async function getAllBusinesses() {
  // Option 1: Hardcode your clients
  // return [
  //   { businessId: "client-1" },
  //   { businessId: "client-2" }
  // ];
  
  // Option 2: Use Netlify Blobs to store a list
  // For now, return empty array and use manual trigger
  return [];
}

// ============================================================
// MAIN HANDLER
// ============================================================
exports.handler = async (event) => {
  // ============================================================
  // GET - Show status information
  // ============================================================
  if (event.httpMethod === "GET") {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: "Online",
        version: "1.0.0",
        schedule: "Daily at 8:00 AM UTC",
        endpoints: {
          manual_trigger: "POST with { businessId: 'client-id' }",
          trigger_all: "POST with { triggerAll: true }",
          info: "GET to see this message"
        },
        status_schedule: {
          enabled: true,
          time: "08:00",
          format: "Image + Caption"
        }
      })
    };
  }

  // ============================================================
  // POST - Trigger status update
  // ============================================================
  if (event.httpMethod === "POST") {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: "Invalid JSON body" })
      };
    }

    // Manual trigger for a specific business
    if (body.businessId) {
      const result = await sendStatusUpdate(body.businessId);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result)
      };
    }

    // Trigger for all businesses (if implemented)
    if (body.triggerAll) {
      const allBusinesses = await getAllBusinesses();
      const results = [];
      for (const business of allBusinesses) {
        const result = await sendStatusUpdate(business.businessId);
        results.push(result);
      }
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          total: results.length,
          results: results
        })
      };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing businessId or triggerAll" })
    };
  }

  // ============================================================
  // Method not allowed
  // ============================================================
  return { 
    statusCode: 405, 
    body: JSON.stringify({ error: "Method not allowed. Use GET or POST." })
  };
};

// ============================================================
// SCHEDULED RUN - Every day at 8:00 AM UTC
// ============================================================
export const config = {
  schedule: "0 8 * * *" // 8:00 AM UTC daily
};
