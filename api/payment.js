export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { uid, email, name } = req.body || {};
  if (!uid || !email) return res.status(400).json({ error: "Missing user info" });

  const APP_URL = process.env.APP_URL || "https://recipes.keyangle.tech";

  try {
    const response = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
      },
      body: JSON.stringify({
        tx_ref: `mamak_${uid}_${Date.now()}`,
        amount: "4.99",
        currency: "USD",
        payment_plan: 159041,
        redirect_url: `${APP_URL}?payment=success&uid=${uid}`,
        customer: {
          email,
          name: name || "Mama K User",
        },
        customizations: {
          title: "Mama K Recipes Pro",
          description: "Unlimited AI recipe searches, 12 recipes per search, saved collections",
          logo: `${APP_URL}/logo-orange.png`,
        },
      }),
    });

    const data = await response.json();

    if (data.status === "success") {
      return res.status(200).json({ paymentLink: data.data.link });
    }
    return res.status(500).json({ error: data.message || "Payment init failed" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
