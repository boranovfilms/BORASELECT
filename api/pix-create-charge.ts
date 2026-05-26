import https from 'https';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  const { valor, infoAdicional } = req.body;

  if (!valor) {
    return res.status(400).json({ error: 'O valor da cobrança é obrigatório.' });
  }

  try {
    // 1. Prepara os certificados
    let cert = process.env.SICREDI_CERTIFICATE || '';
    let key = process.env.SICREDI_PRIVATE_KEY || '';
    cert = cert.includes('\\n') ? cert.replace(/\\n/g, '\n') : cert;
    key = key.includes('\\n') ? key.replace(/\\n/g, '\n') : key;

    const httpsAgent = new https.Agent({ cert, key });

    // 2. Autenticação (Pega o Token)
    const clientId = process.env.SICREDI_CLIENT_ID?.trim();
    const clientSecret = process.env.SICREDI_CLIENT_SECRET?.trim();
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const baseUrl = (process.env.SICREDI_BASE_URL || 'https://api-pix.sicredi.com.br').trim();
    
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

    if (!tokenResponse.access_token) {
      throw new Error('Não foi possível obter o token de acesso do Sicredi.');
    }

    // 3. Cria a Cobrança PIX com o Sicredi (Padrão Banco Central)
    // Formatando o valor para string com 2 casas decimais (ex: "75.00")
    const valorFormatado = Number(valor).toFixed(2);
    
    const cobPayload = JSON.stringify({
      calendario: {
        expiracao: 3600 // QR Code expira em 1 hora
      },
      valor: {
        original: valorFormatado
      },
      chave: "boranovfilms@gmail.com", // Sua Chave PIX
      solicitacaoPagador: infoAdicional || "Créditos BORASELECT"
    });

    const cobResponse: any = await new Promise((resolve, reject) => {
      const reqCob = https.request(`${baseUrl}/api/v2/cob`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenResponse.access_token}`,
          'Content-Type': 'application/json',
        },
        agent: httpsAgent,
      }, (resCob) => {
        let data = '';
        resCob.on('data', (chunk) => data += chunk);
        resCob.on('end', () => {
          try {
            resolve({ status: resCob.statusCode, data: JSON.parse(data) });
          } catch (e) {
            resolve({ status: resCob.statusCode, data: data });
          }
        });
      });
      reqCob.on('error', reject);
      reqCob.write(cobPayload);
      reqCob.end();
    });

    if (cobResponse.status !== 201 && cobResponse.status !== 200) {
      console.error("Erro ao gerar PIX:", cobResponse.data);
      return res.status(400).json({ error: 'Erro ao gerar cobrança no banco', details: cobResponse.data });
    }

    // Retorna os dados da cobrança para o Front-end
    return res.status(200).json({
      success: true,
      txid: cobResponse.data.txid,
      pixCopiaECola: cobResponse.data.pixCopiaECola,
      // Usaremos a API do QuickChart para transformar a string copia e cola numa imagem QR Code no frontend
      qrCodeImage: `https://quickchart.io/qr?text=${encodeURIComponent(cobResponse.data.pixCopiaECola)}&size=300`
    });

  } catch (error: any) {
    console.error("Erro na rota de cobrança:", error);
    return res.status(500).json({ error: 'Falha interna ao gerar PIX', details: error.message });
  }
}
