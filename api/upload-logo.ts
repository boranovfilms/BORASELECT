import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

if (!getApps().length) {
  const envVar = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (envVar) {
    initializeApp({
      credential: cert(JSON.parse(envVar)),
      storageBucket: 'bora-select.firebasestorage.app'
    });
  } else {
    initializeApp({
      storageBucket: 'bora-select.firebasestorage.app'
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const { image, clientId, path: customPath } = req.body;
  if (!image || !clientId) return res.status(400).json({ error: 'Imagem e ClientID são obrigatórios' });

  try {
    const storage = getStorage();
    const bucket = storage.bucket();
    
    // Remove cabeçalho data:image/...;base64,
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    
    const fileName = customPath || `clientes/${clientId}/logo`;
    const file = bucket.file(fileName);

    await file.save(buffer, {
      metadata: { contentType: 'image/png' },
      public: true
    });

    // Gera a URL pública padrão do Firebase Storage
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    return res.status(200).json({ url: publicUrl });
  } catch (error: any) {
    console.error('Upload Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
