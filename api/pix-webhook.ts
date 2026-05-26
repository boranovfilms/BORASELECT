import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export default async function handler(req: any, res: any) {
  // O Sicredi manda um POST quando o PIX é pago
  if (req.method !== 'POST') {
    return res.status(200).send('Webhook PIX Sicredi (Ativo)');
  }

  try {
    const payload = req.body;
    console.log('Webhook Recebido do Sicredi:', JSON.stringify(payload));

    if (payload && payload.pix && Array.isArray(payload.pix)) {
      
      if (!getApps().length) {
        const envVar = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
        if (!envVar) throw new Error("Variável de ambiente do Firebase não encontrada.");
        initializeApp({ credential: cert(JSON.parse(envVar)) });
      }
      
      const db = getFirestore();

      for (const transacao of payload.pix) {
        const txid = transacao.txid;
        const valorPago = Number(transacao.valor); 

        console.log(`Processando pagamento PIX: txid=${txid}, valor=${valorPago}`);

        // 1. Procura a solicitação pela coleção CORRETA (creditRequests)
        const requestsRef = db.collection('creditRequests');
        const snapshot = await requestsRef
          .where('clientNote', '>=', `TXID do Banco: ${txid}`)
          .where('clientNote', '<=', `TXID do Banco: ${txid}\uf8ff`)
          .limit(1)
          .get();

        if (snapshot.empty) {
          console.log(`Nenhuma solicitação encontrada para o TXID: ${txid}`);
          continue; 
        }

        const requestDoc = snapshot.docs[0];
        const requestData = requestDoc.data();
        const projectId = requestData.projectId;
        const creditosComprados = Number(requestData.creditsRequested) || 0;
        const statusAtual = requestData.status;

        // 2. Verifica se o status permite aprovação
        if (['pending', 'Aguardando pagamento', 'Em análise'].includes(statusAtual)) {
          
          // Atualiza para 'Aprovado' (valor exato esperado pelo Frontend)
          await requestDoc.ref.update({
            status: 'Aprovado',
            updatedAt: new Date().toISOString(),
            reviewedAt: new Date().toISOString(),
            approvedAt: new Date().toISOString(),
            adminNote: 'Aprovado automaticamente pelo Webhook PIX Sicredi'
          });

          // 3. Adiciona os créditos no projeto do cliente
          if (projectId && creditosComprados > 0) {
            const projectRef = db.collection('projects').doc(projectId);
            const projectDoc = await projectRef.get();
            
            if (projectDoc.exists) {
              const currentTotal = Number(projectDoc.data()?.creditsTotal || 0);
              await projectRef.update({
                creditsTotal: currentTotal + creditosComprados,
                updatedAt: new Date().toISOString()
              });
              console.log(`✅ Sucesso: ${creditosComprados} créditos adicionados ao projeto ${projectId}`);
            }
          }
        } else {
          console.log(`TXID ${txid} ignorado pois o status já era '${statusAtual}'.`);
        }
      }
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Erro no Webhook PIX:', error);
    return res.status(500).json({ error: 'Erro interno no webhook' });
  }
}
