/**
 * Proxy Next.js API vers moonpay-service
 * GET /api/moonpay/kyc-status/:walletAddress
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { walletAddress } = req.body;

  if (!walletAddress) {
    return res.status(400).json({ error: 'Wallet address required' });
  }

  try {
    const moonpayServiceUrl = process.env.MOONPAY_SERVICE_URL || 'http://localhost:3010';
    
    const response = await fetch(`${moonpayServiceUrl}/api/kyc/status/${walletAddress}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error proxying to moonpay-service:', error);
    return res.status(500).json({
      error: 'Failed to check KYC status',
      message: error.message,
    });
  }
}
