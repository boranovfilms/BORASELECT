import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { Resend } from 'resend';
import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import admin from 'firebase-admin';
import fs from 'fs';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Firebase Admin
const firebaseConfigPath = path.join(__dirname, 'firebase-applet-config.json');
if (fs.existsSync(firebaseConfigPath)) {
  const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: firebaseConfig.projectId
    });
  }
}

const getR2Client = () => {
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
    endpoint: endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '200mb' }));
  app.use(express.urlencoded({ extended: true, limit: '200mb' }));

  // Request logging middleware
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.post("/api-v2/send-invite", async (req, res) => {
    const { clientEmail: to, clientName, inviteLink, isRegistered } = req.body;

    const apiKey = (process.env.RESEND_API_KEY || "").trim();
    if (!apiKey) {
      return res.status(500).json({ error: "Serviço de e-mail não configurado (RESEND_API_KEY faltando)." });
    }

    const resend = new Resend(apiKey);
    let from = 'BoraSelect <onboarding@resend.dev>';
    const envFromEmail = (process.env.RESEND_FROM_EMAIL || "").trim();
    if (envFromEmail) {
      from = envFromEmail;
    }

    const buttonText = isRegistered ? "ACESSAR MEU MATERIAL" : "CRIAR ACESSO E VER MEU MATERIAL";
    const subject = isRegistered ? "📸 Seu material novo já está disponível" : "📸 Seu material já está pronto para seleção";

    try {
      const { data, error } = await resend.emails.send({
        from,
        to: [to],
        subject,
        html: `
          <div style="background-color: #0a0a0a; padding: 40px 20px; font-family: sans-serif; color: #ffffff;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #111111; padding: 48px; border-radius: 24px; border: 1px solid #222222;">
              <h1 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 700; color: #ffffff;">Olá, ${clientName}!</h1>
              <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">Separei com muito cuidado o seu material e agora chegou a melhor parte: você escolher o que mais gostou.</p>
              <div style="margin-bottom: 40px;">
                <a href="${inviteLink}" style="display: inline-block; background-color: #ff5351; color: #ffffff; padding: 18px 32px; font-size: 15px; font-weight: 800; text-decoration: none; border-radius: 12px; text-transform: uppercase;">
                  ${buttonText}
                </a>
              </div>
            </div>
          </div>
        `,
      });

      if (error) {
        return res.status(400).json({ error: (error as any).message || JSON.stringify(error) });
      }

      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao enviar e-mail." });
    }
  });

  app.post("/api-v2/send-email", async (req, res) => {
    const { to, subject, body } = req.body;

    const apiKey = (process.env.RESEND_API_KEY || "").trim();
    if (!apiKey) {
      return res.status(500).json({ error: "RESEND_API_KEY Missing" });
    }

    const resend = new Resend(apiKey);
    let from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

    try {
      const { data, error } = await resend.emails.send({
        from,
        to,
        subject,
        html: body,
      });

      if (error) {
        return res.status(400).json({ error });
      }

      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api-v2/media/upload-url", async (req, res) => {
    const { fileName, fileType, folderPrefix = "" } = req.body;
    const bucket = (process.env.CLOUDFLARE_R2_BUCKET || "").trim();
    const s3 = getR2Client();

    if (!s3 || !bucket) return res.status(400).json({ error: "Configuração R2 incompleta" });

    try {
      console.log(`[R2] Generating upload URL for: ${fileName} (${fileType}) in folder: ${folderPrefix}`);
      // Clean filename to remove special characters and spaces
      let cleanFileName = fileName
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^a-zA-Z0-9.\-_]/g, "_") // Replace everything else with underscore
        .replace(/_{2,}/g, "_"); // Remove consecutive underscores
      
      const key = folderPrefix ? `${folderPrefix}/${cleanFileName}` : cleanFileName;
      const command = new PutObjectCommand({ 
        Bucket: bucket, 
        Key: key, 
        ContentType: fileType,
        CacheControl: 'max-age=31536000'
      });
      const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
      const publicUrl = (process.env.CLOUDFLARE_R2_PUBLIC_URL || "").trim().replace(/\/$/, "");
      
      if (!publicUrl) {
        console.warn("[R2] WARNING: CLOUDFLARE_R2_PUBLIC_URL is not set. Files will not be accessible via URL.");
      }

      const encodedKey = key.split('/').map(part => encodeURIComponent(part)).join('/');

      res.json({ 
        uploadUrl: signedUrl,
        fileUrl: publicUrl ? `${publicUrl}/${encodedKey}` : undefined,
        key 
      });
    } catch (error: any) {
      res.status(500).json({ error: "Erro ao gerar URL de upload" });
    }
  });

  app.post("/api-v2/media/sync", async (req, res) => {
    const { folderPrefix = "", url } = req.body;
    const prefix = folderPrefix || url || "";
    
    let finalPrefix = prefix;
    if (prefix.includes('.r2.dev/') || prefix.includes('cloudflarestorage.com/')) {
      try {
        const urlObj = new URL(prefix);
        let pathName = urlObj.pathname;
        const bucketName = (process.env.CLOUDFLARE_R2_BUCKET || "").trim();
        if (bucketName && pathName.startsWith(`/${bucketName}`)) {
          pathName = pathName.substring(bucketName.length + 1);
        }
        finalPrefix = pathName.split('/').filter(Boolean).join('/');
      } catch (e) {}
    }

    const bucket = (process.env.CLOUDFLARE_R2_BUCKET || "").trim();
    const s3 = getR2Client();
    const publicUrl = (process.env.CLOUDFLARE_R2_PUBLIC_URL || "").trim().replace(/\/$/, "");

    if (!s3 || !bucket) return res.status(400).json({ error: "Configuração R2 incompleta" });

    try {
      const command = new ListObjectsV2Command({ Bucket: bucket, Prefix: finalPrefix });
      const response = await s3.send(command);
      
      const files = (response.Contents || [])
        .filter(obj => obj.Key && !obj.Key.endsWith("/"))
        .map(obj => {
          const name = obj.Key!.split("/").pop() || obj.Key!;
          const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
          const isVideo = /\.(mp4|mov|webm)$/i.test(name);
          const type = isImage ? "image" : (isVideo ? "video" : "other");
          
          const encodedKey = obj.Key!.split('/').map(part => encodeURIComponent(part)).join('/');
          
          return {
            id: obj.Key,
            name,
            type,
            url: publicUrl ? `${publicUrl}/${encodedKey}` : undefined,
            thumbnailUrl: publicUrl && isVideo ? `${publicUrl}/${encodedKey}` : undefined,
            size: obj.Size
          };
        })
        .filter(f => f.type !== "other");

      res.json({ files });
    } catch (error: any) {
      res.status(500).json({ error: "Erro ao sincronizar R2" });
    }
  });

  app.post("/api-v2/auth/delete-user", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    try {
      const user = await admin.auth().getUserByEmail(email);
      await admin.auth().deleteUser(user.uid);
      res.json({ success: true, message: `User ${email} deleted successfully.` });
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        return res.json({ success: true, message: "User not found in Auth." });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api-v2/media-proxy/:fileId", async (req, res) => {
    const { fileId } = req.params;
    // Tenta usar um dos endpoints de download direto do Drive
    // Nota: Para arquivos grandes, o Drive costuma pedir confirmação de vírus.
    const driveUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    
    try {
      const response = await axios({
        method: 'get',
        url: driveUrl,
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        maxRedirects: 5
      });

      // Se o Drive retornar um HTML (geralmanete o aviso de vírus para arquivos grandes),
      // o proxy vai falhar na reprodução direta, mas passamos os dados.
      const contentType = response.headers['content-type'];
      res.set('Content-Type', contentType);
      if (response.headers['content-length']) {
        res.set('Content-Length', response.headers['content-length']);
      }
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Cache-Control', 'public, max-age=3600');

      response.data.pipe(res);
    } catch (error: any) {
      console.error('Proxy error:', error.message);
      res.status(500).json({ error: "Erro ao acessar arquivo do Drive", details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global Error Handler - MUST BE LAST
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Global Server Error:', err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(err.status || 500).json({ 
      error: err.message || "Erro interno no servidor",
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
