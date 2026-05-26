import https from 'https';

export default async function handler(req, res) {
  try {
    let cert = process.env.SICREDI_CERTIFICATE || '';
    let key = process.env.SICREDI_PRIVATE_KEY || '';
    cert = cert.includes('\\n') ? cert.replace(/\\n/g, '\n') : cert;
    key = key.includes('\\n') ? key.replace(/\\n/g, '\n') : key;

    const httpsAgent = new https.Agent({ cert, key });
    const clientId = process.env.SICREDI_CLIENT_ID?.trim();
    const clientSecret = process.env.SICREDI_CLIENT_SECRET?.trim();
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const baseUrl = (process.env.SICREDI_BASE_URL || 'https://api-pix.sicredi.com.br').trim();
    
    // 1. Pega o Token
    const tokenResponse: any = await new Promise((resolve, reject) => {
      const reqToken = https.request(`${baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        agent: httpsAgent,
      }, (resToken) => {
        let data = '';
        resToken.on('data', (chunk) => data += chunk);
        resToken.on('end', () => resolve(JSON.parse(data)));
      });
      reqToken.on('error', reject);
      reqToken.write('grant_type=client_credentials');
      reqToken.end();
    });

    if (!tokenResponse.access_token) throw new Error('Falha no Token');

    // 2. Manda o Sicredi cadastrar o Webhook
    const chavePix = "boranovfilms@gmail.com";
    const webhookUrl = "https://boraselect.vercel.app/api/pix-webhook";

    const configPayload = JSON.stringify({ webhookUrl: webhookUrl });

    const configResponse: any = await new Promise((resolve, reject) => {
      // Endpoint padrão BACEN para configurar webhook: PUT /api/v2/webhook/{chave}
      const reqConfig = https.request(`${baseUrl}/api/v2/webhook/${chavePix}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${tokenResponse.access_token}`,
          'Content-Type': 'application/json',
        },
        agent: httpsAgent,
      }, (resConfig) => {
        let data = '';
        resConfig.on('data', (chunk) => data += chunk);
        resConfig.on('end', () => {
          try { resolve({ status: resConfig.statusCode, data: data ? JSON.parse(data) : null }); } 
          catch (e) { resolve({ status: resConfig.statusCode, data: data }); }
        });
      });
      reqConfig.on('error', reject);
      reqConfig.write(configPayload);
      reqConfig.end();
    });

    return res.status(200).json({ success: true, bancoResponse: configResponse });

  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
