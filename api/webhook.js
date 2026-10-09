/**
 * Flutterwave webhook — subscription lifecycle events.
 * Uses the same bare Firestore REST pattern as the rest of this codebase
 * (no firebase-admin dependency, which was never in package.json and was
 * crashing this endpoint on every invocation).
 *
 * User is identified via uid embedded directly in tx_ref (set by
 * api/payment.js as `mamak_{uid}_{timestamp}`) rather than querying by
 * email, since email is never stored as a queryable field on the user doc.
 */

const PROJECT_ID = () => process.env.FIREBASE_PROJECT_ID || "mama-k-recipies";

function extractUid(txRef) {
  const match = (txRef || "").match(/^mamak_(.+)_\d+$/);
  return match ? match[1] : null;
}

async function patchUser(uid, fields) {
  const projectId = PROJECT_ID();
  const mask = Object.keys(fields).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}?${mask}`;
  const body = { fields: {} };
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === "boolean") body.fields[k] = { booleanValue: v };
    else if (typeof v === "number") body.fields[k] = { integerValue: String(v) };
    else if (v instanceof Date) body.fields[k] = { timestampValue: v.toISOString() };
    else if (v === null) body.fields[k] = { nullValue: null };
    else body.fields[k] = { stringValue: String(v) };
  }
  const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.ok;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const secret = process.env.FLUTTERWAVE_SECRET_HASH;
  const hash = req.headers["verif-hash"];
  if (!hash || hash !== secret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const event = req.body;
  const eventType = event?.event;
  const data = event?.data;

  try {
    const uid = extractUid(data?.tx_ref);

    if (!uid) {
      // Not a Mama K transaction (or malformed tx_ref) — acknowledge and skip.
      return res.status(200).json({ received: true, skipped: "no uid in tx_ref" });
    }

    if (eventType === "subscription.activated" || eventType === "charge.completed") {
      const nextBilling = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await patchUser(uid, {
        isPro: true,
        subscriptionStatus: "active",
        subscriptionEndDate: nextBilling,
        proSince: new Date(),
      });
    }

    if (eventType === "subscription.cancelled") {
      // Mirrors the in-app cancel flow: status flips to "cancelled" but Pro
      // access is retained until subscriptionEndDate — never revoked instantly.
      await patchUser(uid, { subscriptionStatus: "cancelled" });
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ error: err.message });
  }
}
