import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

function getR2Client() {
  let endpoint = (process.env.CLOUDFLARE_R2_ENDPOINT || "").trim();
  const accessKeyId = (process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "").trim();
  const bucket = (process.env.CLOUDFLARE_R2_BUCKET || "").trim();

  if (!accessKeyId || !secretAccessKey || !endpoint) return null;

  if (bucket && endpoint.endsWith(`/${bucket}`)) {
    endpoint = endpoint.replace(`/${bucket}`, "");
  }

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey }
  });
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
    const s3 = getR2Client();
    const bucket = (process.env.CLOUDFLARE_R2_BUCKET || "").trim();
    const publicUrlBase = (process.env.CLOUDFLARE_R2_PUBLIC_URL || "").trim().replace(/\/$/, "");

    if (!s3 || !bucket || !publicUrlBase) {
      throw new Error('Configuração Cloudflare R2 incompleta no servidor');
    }

    // Remove cabeçalho data:image/...;base64,
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    
    const fileName = customPath || `clientes/${clientId}/logo`;
    
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: fileName,
      Body: buffer,
      ContentType: 'image/png'
    });

    await s3.send(command);

    // Gera a URL pública baseada no domínio configurado
    const fileUrl = `${publicUrlBase}/${fileName}`;

    return res.status(200).json({ url: fileUrl });
  } catch (error: any) {
    console.error('R2 Upload Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
