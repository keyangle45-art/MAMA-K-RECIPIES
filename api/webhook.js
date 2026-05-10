import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { credential } from "firebase-admin";

// Init Firebase Admin once
if (!getApps().length) {
  initializeApp({
    credential: credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const secret = process.env.FLUTTERWAVE_SECRET_HASH;
  const hash = req.headers["verif-hash"];

  // Verify webhook is from Flutterwave
  if (!hash || hash !== secret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const event = req.body;
  const eventType = event?.event;
  const data = event?.data;

  try {
    if (eventType === "subscription.activated" || eventType === "charge.completed") {
      // Payment succeeded — mark user as Pro
      const email = data?.customer?.email;
      if (email) {
        const snapshot = await db.collection("users").where("email", "==", email).limit(1).get();
        if (!snapshot.empty) {
          await snapshot.docs[0].ref.update({
            isPro: true,
            proSince: new Date(),
            subscriptionId: data?.id || null,
          });
        }
      }
    }

    if (eventType === "subscription.cancelled") {
      // Subscription cancelled — revoke Pro
      const email = data?.customer?.email;
      if (email) {
        const snapshot = await db.collection("users").where("email", "==", email).limit(1).get();
        if (!snapshot.empty) {
          await snapshot.docs[0].ref.update({ isPro: false });
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ error: err.message });
  }
}
