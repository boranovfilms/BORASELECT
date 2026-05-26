import https from 'https';

export default async function handler(req, res) {
  // Configuração de CORS para permitir que seu front-end chame esta API
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  try {
    // Força a substituição tanto de \n literais quanto garante as quebras originais
    let cert = process.env.SICREDI_CERTIFICATE || '';
    let key = process.env.SICREDI_PRIVATE_KEY || '';
    
    // Tratamento extra de segurança para formatação vinda da Vercel
    cert = cert.includes('\\n') ? cert.replace(/\\n/g, '\n') : cert;
    key = key.includes('\\n') ? key.replace(/\\n/g, '\n') : key;

    if (!cert || !key) {
      return res.status(500).json({ error: 'Certificados ausentes nas variáveis de ambiente da Vercel.' });
    }

    const httpsAgent = new https.Agent({
      cert: cert,
      key: key,
    });

    const clientId = process.env.SICREDI_CLIENT_ID?.trim();
    const clientSecret = process.env.SICREDI_CLIENT_SECRET?.trim();
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    // Pega a URL ou usa a padrão de Sandbox
    const baseUrl = (process.env.SICREDI_BASE_URL || 'https://api-pix-h.sicredi.com.br').trim();
    const tokenUrl = `${baseUrl}/oauth/token`;
    
    const tokenResponse = await new Promise((resolve, reject) => {
      const requestOptions = {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        agent: httpsAgent,
      };

      const request = https.request(tokenUrl, requestOptions, (response) => {
        let data = '';
        response.on('data', (chunk) => data += chunk);
        response.on('end', () => {
          try {
            resolve({ status: response.statusCode, data: JSON.parse(data) });
          } catch (e) {
            // Caso o banco retorne algo que não seja JSON (ex: HTML de erro de gateway)
            resolve({ status: response.statusCode, data: data });
          }
        });
      });

      request.on('error', (error) => {
        console.error("Erro na requisição HTTPS:", error.message);
        reject(error);
      });
      
      request.write('grant_type=client_credentials');
      request.end();
    });

    return res.status(200).json({ success: true, response: tokenResponse });

  } catch (error) {
    console.error("Erro no try/catch principal:", error);
    return res.status(500).json({ error: 'Falha ao autenticar com o Sicredi', details: error.message });
  }
}
