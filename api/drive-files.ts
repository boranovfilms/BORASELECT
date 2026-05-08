import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { folderId, fileName } = req.query;

  if (!folderId) {
    return res.status(400).json({ error: 'folderId é obrigatório' });
  }

  const API_KEY = process.env.GOOGLE_DRIVE_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'GOOGLE_DRIVE_API_KEY não configurada' });
  }

  try {
    // Se fileName foi passado, buscar arquivo específico
    let query = `'${folderId}' in parents and trashed = false`;
    if (fileName) {
      query += ` and name = '${String(fileName).replace(/'/g, "\\'")}'`;
    }

    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&key=${API_KEY}&fields=files(id,name,mimeType,size)&pageSize=1000`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Erro ao acessar Drive' });
    }

    // Retornar arquivos com link de download direto
    const files = (data.files || []).map((file: any) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      downloadUrl: `https://drive.google.com/uc?export=download&id=${file.id}`
    }));

    return res.status(200).json({ success: true, files });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
