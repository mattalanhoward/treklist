// server/src/services/anthropicService.js
const Anthropic = require("@anthropic-ai/sdk");

let client = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn("[Anthropic] ANTHROPIC_API_KEY not set");
      return null;
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

const DESCRIPTION_SYSTEM_PROMPT = `You are a concise product copywriter for an outdoor gear catalog.
Your output MUST be exactly 2-3 sentences and under 60 words total.
Summarize the product's key specs and purpose. Mention weight, capacity, or materials only if notable.
CRITICAL RULE: Any time you mention a weight, you MUST include both imperial AND metric units in parentheses — for example "1.89 lbs (857 g)" or "2 lbs 1 oz (936 g)". NEVER state a weight in only one unit system.
Do NOT copy phrases verbatim from the input.
Do NOT use marketing language or superlatives.
Write in a neutral, factual tone. Be brief.`;

async function rewriteDescription(title, brand, featuresBullets) {
  const anthropic = getClient();
  if (!anthropic) return null;

  if (!Array.isArray(featuresBullets) || !featuresBullets.length) return null;

  const userPrompt = [
    `Product: ${brand ? `${brand} ` : ""}${title || "Unknown Product"}`,
    "",
    "Feature bullets:",
    ...featuresBullets.slice(0, 8).map((b) => `- ${b}`),
  ].join("\n");

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      system: DESCRIPTION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = message.content[0]?.text?.trim();
    return text || null;
  } catch (err) {
    console.error("[Anthropic] Description rewrite failed:", err.message);
    return null;
  }
}

module.exports = { rewriteDescription, getClient };
