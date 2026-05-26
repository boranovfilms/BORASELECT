import https from 'https';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  const envVar = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (envVar) {
    initializeApp({ credential: cert(JSON.parse(envVar)) });
  } else {
    initializeApp();
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

  const { txid, projectId, credits } = req.query; 
  if (!txid) return res.status(400).json({ error: 'TXID obrigatório' });

  try {
    let certStr = process.env.SICREDI_CERTIFICATE || '';
    let keyStr = process.env.SICREDI_PRIVATE_KEY || '';
    certStr = certStr.includes('\\n') ? certStr.replace(/\\n/g, '\n') : certStr;
    keyStr = keyStr.includes('\\n') ? keyStr.replace(/\\n/g, '\n') : keyStr;

    const httpsAgent = new https.Agent({ cert: certStr, key: keyStr });
    const clientId = process.env.SICREDI_CLIENT_ID?.trim();
    const clientSecret = process.env.SICREDI_CLIENT_SECRET?.trim();
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const baseUrl = (process.env.SICREDI_BASE_URL || 'https://api-pix.sicredi.com.br').trim();
    
    const tokenData: any = await new Promise((resolve, reject) => {
      const request = https.request(`${baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        agent: httpsAgent,
      }, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve(JSON.parse(data)));
      });
      request.on('error', reject);
      request.write('grant_type=client_credentials');
      request.end();
    });

    if (!tokenData.access_token) throw new Error('Falha no Token');

    const cobResponse: any = await new Promise((resolve, reject) => {
      const request = https.request(`${baseUrl}/api/v2/cob/${txid}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
        agent: httpsAgent,
      }, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve(JSON.parse(data)));
      });
      request.on('error', reject);
      request.end();
    });

    if (cobResponse.status === 'CONCLUIDA') {
      const db = getFirestore();
      
      const processedRef = db.collection('pix_processed').doc(txid as string);
      const docSnap = await processedRef.get();
      
      if (!docSnap.exists) {
        await processedRef.set({ 
          processedAt: new Date().toISOString(), 
          projectId, 
          credits: Number(credits) 
        });

        if (projectId && Number(credits) > 0) {
          const projectRef = db.collection('projects').doc(projectId as string);
          const projectDoc = await projectRef.get();
          if (projectDoc.exists) {
            const currentTotal = Number(projectDoc.data()?.creditsTotal || 0);
            await projectRef.update({ 
              creditsTotal: currentTotal + Number(credits),
              updatedAt: new Date().toISOString()
            });
          }
        }

        // CORREÇÃO: Atualiza o status na coleção correta (creditRequests) com o valor correto (Aprovado)
        const requestsRef = db.collection('creditRequests');
        const snapshot = await requestsRef
          .where('clientNote', '>=', `TXID do Banco: ${txid}`)
          .where('clientNote', '<=', `TXID do Banco: ${txid}\uf8ff`)
          .limit(1)
          .get();

        if (!snapshot.empty) {
          await snapshot.docs[0].ref.update({
            status: 'Aprovado',
            updatedAt: new Date().toISOString(),
            reviewedAt: new Date().toISOString(),
            approvedAt: new Date().toISOString(),
            adminNote: 'Aprovado via Verificação Automática PIX'
          });
        }
        
        return res.status(200).json({ paid: true, message: 'Créditos injetados no projeto!' });
      }
      return res.status(200).json({ paid: true, message: 'PIX já processado anteriormente.' });
    }

    return res.status(200).json({ paid: false, status: cobResponse.status });

  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
