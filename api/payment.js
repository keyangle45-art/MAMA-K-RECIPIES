export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { uid, email, name, plan } = req.body || {};
  if (!uid || !email) return res.status(400).json({ error: "Missing user info" });
  const APP_URL = process.env.APP_URL || "https://recipes.keyangle.tech";
  const wantsAnnual = plan === "annual";
  const annualPlanId = process.env.FLUTTERWAVE_ANNUAL_PLAN_ID;
  const useAnnual = wantsAnnual && !!annualPlanId;
  const amount = useAnnual ? "39.99" : "4.99";
  const paymentPlan = useAnnual ? Number(annualPlanId) : 159041;
  const billingLabel = useAnnual ? "Mama K Pro — Annual" : "Mama K Pro — Monthly";
  try {
    const response = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` },
      body: JSON.stringify({
        tx_ref: `mamak_${uid}_${Date.now()}`,
        amount, currency: "USD", payment_plan: paymentPlan,
        redirect_url: `${APP_URL}?payment=success&uid=${uid}&plan=${useAnnual?"annual":"monthly"}`,
        customer: { email, name: name || "Mama K User" },
        customizations: { title: billingLabel, description: "Unlimited AI food discovery, Recipe Tools, Meal Planner, Pantry Mode", logo: `${APP_URL}/logo-orange.png` },
      }),
    });
    const data = await response.json();
    if (data.status === "success") return res.status(200).json({ paymentLink: data.data.link, billedAs: useAnnual?"annual":"monthly", annualAvailable: !!annualPlanId });
    return res.status(500).json({ error: data.message || "Payment init failed" });
  } catch (err) { return res.status(500).json({ error: err.message }); }
}
