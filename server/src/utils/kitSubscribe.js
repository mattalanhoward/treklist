const KIT_API_KEY = process.env.KIT_API_KEY;
const KIT_API_BASE = 'https://api.kit.com/v4';
const KIT_TREKLIST_TAG_ID = 19523737;

const KIT_HEADERS = () => ({
  'Content-Type': 'application/json',
  'X-Kit-Api-Key': KIT_API_KEY,
});

async function subscribeToKit(email, firstName = '') {
  if (!KIT_API_KEY) {
    console.warn('[Kit] KIT_API_KEY not set — skipping subscription.');
    return;
  }

  try {
    // Step 1: create/update subscriber
    const subRes = await fetch(`${KIT_API_BASE}/subscribers`, {
      method: 'POST',
      headers: KIT_HEADERS(),
      body: JSON.stringify({
        email_address: email,
        first_name: firstName || '',
        state: 'active',
      }),
    });

    if (!subRes.ok) {
      const error = await subRes.json().catch(() => ({}));
      console.error('[Kit] Failed to create subscriber:', error);
      return;
    }

    const { subscriber } = await subRes.json();

    // Step 2: apply TrekList tag
    const tagRes = await fetch(`${KIT_API_BASE}/tags/${KIT_TREKLIST_TAG_ID}/subscribers`, {
      method: 'POST',
      headers: KIT_HEADERS(),
      body: JSON.stringify({ email_address: email }),
    });

    if (!tagRes.ok) {
      const error = await tagRes.json().catch(() => ({}));
      console.error('[Kit] Failed to apply tag:', error);
    } else {
      console.log(`[Kit] Subscribed and tagged: ${email} (id: ${subscriber?.id})`);
    }
  } catch (err) {
    console.error('[Kit] Subscription error:', err.message);
  }
}

module.exports = { subscribeToKit };
