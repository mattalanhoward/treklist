// server/src/services/openaiService.js
const OpenAI = require("openai");

let client = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn("[OpenAI] OPENAI_API_KEY not set — description rewrite disabled");
      return null;
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

const SYSTEM_PROMPT = `You are a concise product copywriter for an outdoor gear catalog.
Your output MUST be exactly 2-3 sentences and under 60 words total.
Summarize the product's key specs and purpose. Mention weight, capacity, or materials only if notable.
CRITICAL RULE: Any time you mention a weight, you MUST include both imperial AND metric units in parentheses — for example "1.89 lbs (857 g)" or "2 lbs 1 oz (936 g)". NEVER state a weight in only one unit system.
Do NOT copy phrases verbatim from the input.
Do NOT use marketing language or superlatives.
Write in a neutral, factual tone. Be brief.`;

async function rewriteDescription(title, brand, featuresBullets) {
  const openai = getClient();
  if (!openai) return null;

  if (!Array.isArray(featuresBullets) || !featuresBullets.length) return null;

  const userPrompt = [
    `Product: ${brand ? `${brand} ` : ""}${title || "Unknown Product"}`,
    "",
    "Feature bullets:",
    ...featuresBullets.slice(0, 8).map((b) => `- ${b}`),
  ].join("\n");

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 100,
      temperature: 0.7,
    });

    const text = response.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (err) {
    console.error("[OpenAI] Description rewrite failed:", err.message);
    return null;
  }
}

module.exports = { rewriteDescription };
