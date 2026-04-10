/**
 * Proxy Next.js API vers moonpay-service
 * POST /api/moonpay/buy-quote
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const moonpayServiceUrl =
      process.env.MOONPAY_SERVICE_URL || "http://localhost:3010";

    const response = await fetch(`${moonpayServiceUrl}/api/buy/quote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body || {}),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    return res.status(200).json(data);
  } catch (error) {
    console.error("Error proxying buy quote to moonpay-service:", error);
    return res.status(500).json({
      error: "Failed to fetch buy quote",
      message: error.message,
    });
  }
}

