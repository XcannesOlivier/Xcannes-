/**
 * Proxy Next.js API vers moonpay-service
 * GET /api/moonpay/transactions?walletAddress=...
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { walletAddress, limit, status, type } = req.query;

  if (!walletAddress) {
    return res.status(400).json({ error: 'Wallet address required' });
  }

  try {
    const moonpayServiceUrl = process.env.MOONPAY_SERVICE_URL || 'http://localhost:3010';
    
    const queryParams = new URLSearchParams({
      ...(limit && { limit }),
      ...(status && { status }),
      ...(type && { type }),
    });

    const response = await fetch(
      `${moonpayServiceUrl}/api/transactions/${walletAddress}?${queryParams.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error proxying to moonpay-service:', error);
    return res.status(500).json({
      error: 'Failed to fetch transactions',
      message: error.message,
    });
  }
}
