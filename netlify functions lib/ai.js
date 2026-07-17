cat > netlify/functions/lib/ai.js << 'EOF'
const Anthropic = require("@anthropic-ai/sdk");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function findInventoryMatches(message, inventory = []) {
  const words = message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  if (words.length === 0 || inventory.length === 0) return [];

  return inventory
    .map((item) => {
      const nameLower = (item.name || "").toLowerCase();
      let score = 0;
      if (words.some((w) => nameLower.includes(w))) score += 2;
      const nameWords = nameLower.split(/\s+/);
      words.forEach((w) => {
        if (nameWords.some((nw) => nw.includes(w) || w.includes(nw))) score += 1;
      });
      return { item, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((s) => s.item);
}

function formatInventory(matches) {
  if (matches.length === 0) {
    return "No matching products were found in the inventory list for this message.";
  }
  return matches
    .map((m) => {
      const inStock = Number(m.quantity) > 0;
      return `- ${m.name}: ${Number(m.price).toLocaleString()} — ${
        inStock ? `In stock (${m.quantity})` : "Out of stock"
      }`;
    })
    .join("\n");
}

function containsEscalationKeyword(text, keywords = []) {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

function buildSystemPrompt(business, inventoryContext) {
  const faqText = (business.faqs || []).map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n");
  const rulesText = (business.hardRules || []).map((r) => `- ${r}`).join("\n");

  return `You are the WhatsApp assistant for "${business.businessName}", replying to customers automatically on behalf of the owner, who may be offline or asleep.

ABOUT THE BUSINESS:
${business.aboutBusiness || ""}

FREQUENTLY ASKED QUESTIONS (use these as ground truth):
${faqText || "(none provided)"}

LIVE INVENTORY MATCHES for the customer's current message (the only
source of truth for stock/price - never guess or invent a number that
isn't listed here):
${inventoryContext}

TONE: ${business.tone || "Friendly, professional, short WhatsApp-style replies."}

HARD RULES (never break these):
${rulesText || "(none)"}
- Only answer availability/price questions using the LIVE INVENTORY MATCHES above. If nothing relevant is listed, say you're not certain and a team member will confirm.
- Never give medical, legal, or financial advice, even if asked directly - defer to a human for that.

Reply in the SAME language the customer used. Keep it short and natural, like a real person texting on WhatsApp - not a formal email. Do not mention that you are an AI unless directly asked.`;
}

async function getAIReply({ business, history, customerMessage }) {
  const matches = findInventoryMatches(customerMessage, business.inventory);
  const inventoryContext = formatInventory(matches);

  const messages = [...history, { role: "user", content: customerMessage }];

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    system: buildSystemPrompt(business, inventoryContext),
    messages,
  });

  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

module.exports = { getAIReply, containsEscalationKeyword };
EOF
