/**
 * Proxy Next.js API vers moonpay-service
 * POST /api/moonpay/webhook
 */
export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const moonpayServiceUrl = process.env.MOONPAY_SERVICE_URL || 'http://localhost:3010';

    const rawBody = await readRawBody(req);
    const moonpaySignature = req.headers['moonpay-signature'];
    const xMoonpaySignature = req.headers['x-moonpay-signature'];
    const contentType = req.headers['content-type'] || 'application/json';

    const headers = {
      'Content-Type': contentType,
    };
    if (moonpaySignature) {
      headers['moonpay-signature'] = moonpaySignature;
    }
    if (xMoonpaySignature) {
      headers['x-moonpay-signature'] = xMoonpaySignature;
    }

    // Forward the raw request to moonpay-service
    const response = await fetch(`${moonpayServiceUrl}/api/webhook`, {
      method: 'POST',
      headers,
      body: rawBody,
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = { raw: text };
    }

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error proxying webhook to moonpay-service:', error);
    return res.status(500).json({
      error: 'Failed to process webhook',
      message: error.message,
    });
  }
}
