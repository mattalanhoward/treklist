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

async function unsubscribeFromKit(email) {
  if (!KIT_API_KEY) {
    console.warn('[Kit] KIT_API_KEY not set — skipping unsubscribe.');
    return;
  }

  try {
    // Step 1: look up subscriber ID by email
    const lookupRes = await fetch(
      `${KIT_API_BASE}/subscribers?email_address=${encodeURIComponent(email)}`,
      { headers: KIT_HEADERS() }
    );

    if (!lookupRes.ok) {
      const error = await lookupRes.json().catch(() => ({}));
      console.error('[Kit] Failed to look up subscriber:', error);
      return;
    }

    const { subscribers } = await lookupRes.json();
    const subscriber = subscribers?.[0];

    if (!subscriber) {
      console.log(`[Kit] No subscriber found for ${email} — nothing to untag.`);
      return;
    }

    // Step 2: remove TrekList tag
    const untagRes = await fetch(
      `${KIT_API_BASE}/tags/${KIT_TREKLIST_TAG_ID}/subscribers/${subscriber.id}`,
      { method: 'DELETE', headers: KIT_HEADERS() }
    );

    if (untagRes.status === 204 || untagRes.ok) {
      console.log(`[Kit] Removed TrekList tag: ${email} (id: ${subscriber.id})`);
    } else {
      const error = await untagRes.json().catch(() => ({}));
      console.error('[Kit] Failed to remove tag:', error);
    }
  } catch (err) {
    console.error('[Kit] Unsubscribe error:', err.message);
  }
}

module.exports = { subscribeToKit, unsubscribeFromKit };
