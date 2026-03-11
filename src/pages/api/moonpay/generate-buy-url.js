/**
 * Proxy Next.js API vers moonpay-service
 * POST /api/moonpay/generate-buy-url
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    walletAddress,
    currencyCode,
    baseCurrencyCode,
    baseCurrencyAmount,
    quoteCurrencyAmount,
    options,
  } = req.body;

  if (!walletAddress) {
    return res.status(400).json({ error: 'Wallet address required' });
  }

  try {
    const moonpayServiceUrl = process.env.MOONPAY_SERVICE_URL || 'http://localhost:3010';
    
    const response = await fetch(`${moonpayServiceUrl}/api/buy/generate-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress,
        currencyCode,
        baseCurrencyCode,
        baseCurrencyAmount,
        quoteCurrencyAmount,
        options,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error proxying to moonpay-service:', error);
    return res.status(500).json({
      error: 'Failed to generate Buy URL',
      message: error.message,
    });
  }
}
