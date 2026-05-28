
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const { token, action, videoId } = req.body;
  if (!token) return res.status(400).json({ error: 'API Token é obrigatório' });

  const accountId = 'c1af34330acb010777256097e2133614';
  const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream`;

  try {
    if (action === 'list') {
      const response = await fetch(`${baseUrl}?limit=1000`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.errors?.[0]?.message || 'Erro no Cloudflare');
      return res.status(200).json(data);
    }

    if (action === 'delete') {
      if (!videoId) return res.status(400).json({ error: 'VideoID obrigatório para delete' });
      const response = await fetch(`${baseUrl}/${videoId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.errors?.[0]?.message || 'Erro no Cloudflare');
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: 'Ação inválida' });
  } catch (error: any) {
    console.error('Cloudflare Proxy Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
