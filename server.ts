import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";
import { Resend } from "resend";
import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import admin from "firebase-admin";
import fs from "fs";
import axios from "axios";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const firebaseConfigPath = path.join(__dirname, "firebase-applet-config.json");
if (fs.existsSync(firebaseConfigPath)) {
  const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));
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
    endpoint,
    credentials: { accessKeyId, secretAccessKey }
  });
};

const PIX_KEY = (process.env.PIX_KEY || "boranovfilms@gmail.com").trim();
const PIX_KEY_TYPE = (process.env.PIX_KEY_TYPE || "email").trim();
const CREDIT_APPROVAL_EMAIL = (process.env.CREDIT_APPROVAL_EMAIL || PIX_KEY).trim();
const CREDIT_PRICE_PER_UNIT = parseMoney(process.env.CREDIT_PRICE_PER_UNIT || "0");

function getFirestore() {
  if (!admin.apps.length) {
    throw new Error("Firebase Admin não está configurado.");
  }
  return admin.firestore();
}

function getResendClient() {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function getFromEmail() {
  return (process.env.RESEND_FROM_EMAIL || "BoraSelect <onboarding@resend.dev>").trim();
}

async function sendEmail({
  to,
  subject,
  html
}: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  const resend = getResendClient();
  if (!resend) {
    return { success: false, skipped: true, reason: "RESEND_API_KEY faltando" };
  }

  const recipients = Array.isArray(to) ? to : [to];
  const { data, error } = await resend.emails.send({
    from: getFromEmail(),
    to: recipients,
    subject,
    html
  });

  if (error) {
    throw new Error((error as any).message || JSON.stringify(error));
  }

  return { success: true, data };
}

function parseMoney(value: any) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const normalized = value
    .replace(/R\$/gi, "")
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePositiveInteger(value: any) {
  const parsed = Math.floor(parseMoney(value));
  return parsed > 0 ? parsed : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value || 0);
}

function escapeHtml(value: any) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildBaseUrl(req: express.Request) {
  const envUrl = (process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (envUrl) return envUrl;

  const forwardedProto = String(req.headers["x-forwarded-proto"] || req.protocol || "http")
    .split(",")[0]
    .trim();

  const forwardedHost = String(req.headers["x-forwarded-host"] || req.get("host") || "localhost:3000")
    .split(",")[0]
    .trim();

  return `${forwardedProto}://${forwardedHost}`;
}

function serializeTimestamp(value: any) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

function serializeCreditRequest(doc: admin.firestore.QueryDocumentSnapshot | admin.firestore.DocumentSnapshot) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    ...data,
    createdAt: serializeTimestamp(data.createdAt),
    updatedAt: serializeTimestamp(data.updatedAt),
    reviewedAt: serializeTimestamp(data.reviewedAt),
    approvedAt: serializeTimestamp(data.approvedAt),
    rejectedAt: serializeTimestamp(data.rejectedAt)
  };
}

async function getCreditRequestByToken(token: string) {
  const db = getFirestore();
  const snapshot = await db
    .collection("creditRequests")
    .where("reviewToken", "==", token)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return {
    ref: doc.ref,
    data: serializeCreditRequest(doc)
  };
}

function renderCreditRequestEmail({
  request,
  reviewUrl
}: {
  request: any;
  reviewUrl: string;
}) {
  const receiptBlock = request.receiptImageUrl
    ? `
      <div style="margin: 24px 0;">
        <a href="${request.receiptImageUrl}" target="_blank" style="display: inline-block; background-color: #181818; color: #ffffff; padding: 14px 20px; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 12px; border: 1px solid #2a2a2a;">
          Ver comprovante
        </a>
      </div>
    `
    : `<p style="margin: 16px 0 0 0; font-size: 14px; color: #9ca3af;">Nenhum comprovante enviado ainda.</p>`;

  return `
    <div style="background-color: #0a0a0a; padding: 40px 20px; font-family: Arial, sans-serif; color: #ffffff;">
      <div style="max-width: 680px; margin: 0 auto; background-color: #111111; padding: 40px; border-radius: 24px; border: 1px solid #222222;">
        <p style="margin: 0 0 10px 0; color: #ff5351; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.18em;">
          Nova solicitação de créditos
        </p>
        <h1 style="margin: 0 0 24px 0; font-size: 28px; line-height: 1.2; font-weight: 800; color: #ffffff;">
          Pedido de compra aguardando análise
        </h1>

        <div style="display: grid; gap: 12px; margin-bottom: 28px;">
          <div style="padding: 16px 18px; border-radius: 16px; background-color: #161616; border: 1px solid #252525;">
            <strong>Projeto:</strong> ${escapeHtml(request.projectTitle || "-")}
          </div>
          <div style="padding: 16px 18px; border-radius: 16px; background-color: #161616; border: 1px solid #252525;">
            <strong>Cliente:</strong> ${escapeHtml(request.clientName || "-")} ${request.clientEmail ? `(${escapeHtml(request.clientEmail)})` : ""}
          </div>
          <div style="padding: 16px 18px; border-radius: 16px; background-color: #161616; border: 1px solid #252525;">
            <strong>Créditos:</strong> ${escapeHtml(request.creditsRequested)}
          </div>
          <div style="padding: 16px 18px; border-radius: 16px; background-color: #161616; border: 1px solid #252525;">
            <strong>Valor:</strong> ${escapeHtml(formatCurrency(request.totalAmount))}
          </div>
          <div style="padding: 16px 18px; border-radius: 16px; background-color: #161616; border: 1px solid #252525;">
            <strong>Status:</strong> ${escapeHtml(request.status)}
          </div>
        </div>

        ${receiptBlock}

        <div style="margin-top: 32px;">
          <a href="${reviewUrl}" style="display: inline-block; background-color: #ff5351; color: #ffffff; padding: 18px 28px; font-size: 14px; font-weight: 800; text-decoration: none; border-radius: 14px; text-transform: uppercase; letter-spacing: 0.08em;">
            Analisar solicitação
          </a>
        </div>
      </div>
    </div>
  `;
}

function renderCreditReviewPage({
  request,
  token,
  message
}: {
  request: any;
  token: string;
  message: string;
}) {
  const receiptPreview = request.receiptImageUrl
    ? `
      <div class="card">
        <h2>Comprovante</h2>
        <a class="secondary" href="${request.receiptImageUrl}" target="_blank">Abrir comprovante</a>
        <div class="receipt-box">
          <img src="${request.receiptImageUrl}" alt="Comprovante" />
        </div>
      </div>
    `
    : `
      <div class="card">
        <h2>Comprovante</h2>
        <p>Nenhum comprovante enviado.</p>
      </div>
    `;

  const isFinished = request.status === "Aprovado" || request.status === "Recusado";

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Análise de Créditos</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #0b0b0b;
            color: #ffffff;
            font-family: Arial, sans-serif;
            padding: 24px;
          }
          .container {
            max-width: 980px;
            margin: 0 auto;
          }
          .hero {
            background: #111111;
            border: 1px solid #262626;
            border-radius: 28px;
            padding: 28px;
            margin-bottom: 20px;
          }
          .eyebrow {
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.18em;
            color: #ff5351;
            text-transform: uppercase;
            margin-bottom: 12px;
          }
          h1 {
            margin: 0 0 12px 0;
            font-size: 30px;
            line-height: 1.1;
          }
          .status {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: #171717;
            border: 1px solid #2d2d2d;
            color: #ffffff;
            border-radius: 999px;
            padding: 10px 16px;
            font-size: 13px;
            font-weight: 700;
          }
          .message {
            margin-top: 16px;
            padding: 14px 16px;
            border-radius: 14px;
            background: #161616;
            border: 1px solid #2a2a2a;
            color: #ffffff;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
          }
          .card {
            background: #111111;
            border: 1px solid #262626;
            border-radius: 24px;
            padding: 24px;
          }
          .card h2 {
            margin: 0 0 18px 0;
            font-size: 18px;
          }
          .list {
            display: grid;
            gap: 12px;
          }
          .row {
            background: #161616;
            border: 1px solid #252525;
            border-radius: 16px;
            padding: 14px 16px;
          }
          .row span {
            display: block;
            font-size: 12px;
            color: #a1a1aa;
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            font-weight: 700;
          }
          .row strong {
            font-size: 15px;
            color: #ffffff;
          }
          .actions {
            display: grid;
            gap: 16px;
          }
          form {
            display: grid;
            gap: 12px;
          }
          textarea {
            width: 100%;
            min-height: 110px;
            resize: vertical;
            background: #161616;
            color: #ffffff;
            border: 1px solid #2a2a2a;
            border-radius: 16px;
            padding: 14px 16px;
            outline: none;
          }
          button, .secondary {
            width: 100%;
            border: 0;
            border-radius: 16px;
            padding: 16px 18px;
            font-size: 13px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            cursor: pointer;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
          .secondary {
            background: #181818;
            color: #ffffff;
            border: 1px solid #2a2a2a;
          }
          .analyze { background: #1d1d1d; color: #ffffff; border: 1px solid #303030; }
          .approve { background: #16a34a; color: #ffffff; }
          .reject { background: #dc2626; color: #ffffff; }
          .receipt-box {
            margin-top: 16px;
            background: #0c0c0c;
            border: 1px solid #232323;
            border-radius: 20px;
            padding: 12px;
          }
          .receipt-box img {
            width: 100%;
            height: auto;
            border-radius: 14px;
            display: block;
          }
          .locked {
            opacity: 0.65;
            pointer-events: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="hero">
            <div class="eyebrow">Solicitação manual de créditos</div>
            <h1>${escapeHtml(request.projectTitle || "Pedido de créditos")}</h1>
            <div class="status">Status atual: ${escapeHtml(request.status || "Aguardando pagamento")}</div>
            ${message ? `<div class="message">${escapeHtml(message)}</div>` : ""}
          </div>

          <div class="grid">
            <div class="card">
              <h2>Dados do pedido</h2>
              <div class="list">
                <div class="row">
                  <span>Cliente</span>
                  <strong>${escapeHtml(request.clientName || "-")}</strong>
                </div>
                <div class="row">
                  <span>E-mail</span>
                  <strong>${escapeHtml(request.clientEmail || "-")}</strong>
                </div>
                <div class="row">
                  <span>Projeto</span>
                  <strong>${escapeHtml(request.projectTitle || "-")}</strong>
                </div>
                <div class="row">
                  <span>Créditos solicitados</span>
                  <strong>${escapeHtml(request.creditsRequested || "-")}</strong>
                </div>
                <div class="row">
                  <span>Valor informado</span>
                  <strong>${escapeHtml(formatCurrency(request.totalAmount || 0))}</strong>
                </div>
                <div class="row">
                  <span>Chave Pix</span>
                  <strong>${escapeHtml(request.pixKey || PIX_KEY)}</strong>
                </div>
                <div class="row">
                  <span>ID da solicitação</span>
                  <strong>${escapeHtml(request.id || "-")}</strong>
                </div>
              </div>
            </div>

            ${receiptPreview}
          </div>

          <div class="card" style="margin-top: 20px;">
            <h2>Ações</h2>
            <div class="actions">
              <form action="/api-v2/credits/review/${token}/analyze" method="post" ${isFinished ? 'class="locked"' : ""}>
                <button class="analyze" type="submit">Marcar como em análise</button>
              </form>

              <form action="/api-v2/credits/review/${token}/approve" method="post" ${request.status === "Aprovado" ? 'class="locked"' : ""}>
                <textarea name="reviewerNote" placeholder="Observação opcional para aprovação"></textarea>
                <button class="approve" type="submit">Aprovar e adicionar créditos</button>
              </form>

              <form action="/api-v2/credits/review/${token}/reject" method="post" ${request.status === "Recusado" ? 'class="locked"' : ""}>
                <textarea name="reviewerNote" placeholder="Motivo opcional da recusa"></textarea>
                <button class="reject" type="submit">Recusar solicitação</button>
              </form>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.set("trust proxy", 1);
  app.use(express.json({ limit: "200mb" }));
  app.use(express.urlencoded({ extended: true, limit: "200mb" }));

  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api-v2/credits/config", (req, res) => {
    res.json({
      pixKey: PIX_KEY,
      pixKeyType: PIX_KEY_TYPE,
      approvalMode: "manual",
      unitPrice: CREDIT_PRICE_PER_UNIT > 0 ? CREDIT_PRICE_PER_UNIT : null
    });
  });

  app.get("/api-v2/credits/requests/:projectId", async (req, res) => {
    try {
      const { projectId } = req.params;
      const db = getFirestore();

      const snapshot = await db
        .collection("creditRequests")
        .where("projectId", "==", projectId)
        .get();

      const requests = snapshot.docs
        .map(doc => serializeCreditRequest(doc))
        .sort((a: any, b: any) => {
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateB - dateA;
        });

      res.json({ requests });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao buscar solicitações de crédito." });
    }
  });

  app.post("/api-v2/credits/request", async (req, res) => {
    try {
      const db = getFirestore();

      const projectId = String(req.body.projectId || "").trim();
      const receiptImageUrl = String(req.body.receiptImageUrl || "").trim();
      const receiptFileName = String(req.body.receiptFileName || "").trim();
      const clientNote = String(req.body.clientNote || "").trim();

      const creditsRequested = parsePositiveInteger(req.body.creditsRequested);
      const requestUnitPrice = parseMoney(req.body.unitPrice);
      const requestTotalAmount = parseMoney(req.body.totalAmount || req.body.amount);

      if (!projectId) {
        return res.status(400).json({ error: "projectId é obrigatório." });
      }

      if (!creditsRequested) {
        return res.status(400).json({ error: "Informe a quantidade de créditos." });
      }

      const projectRef = db.collection("projects").doc(projectId);
      const projectSnap = await projectRef.get();

      if (!projectSnap.exists) {
        return res.status(404).json({ error: "Projeto não encontrado." });
      }

      const projectData = projectSnap.data() || {};
      const clientName = String(req.body.clientName || projectData.clientName || "").trim();
      const clientEmail = String(req.body.clientEmail || projectData.clientEmail || "").trim().toLowerCase();
      const projectTitle = String(req.body.projectTitle || projectData.title || "").trim();

      const unitPrice = CREDIT_PRICE_PER_UNIT > 0 ? CREDIT_PRICE_PER_UNIT : requestUnitPrice;
      const totalAmount = unitPrice > 0 ? Number((unitPrice * creditsRequested).toFixed(2)) : requestTotalAmount;

      if (!totalAmount || totalAmount <= 0) {
        return res.status(400).json({ error: "Valor total inválido para a solicitação." });
      }

      const reviewToken = randomBytes(24).toString("hex");

      const payload = {
        projectId,
        projectTitle,
        clientName,
        clientEmail,
        creditsRequested,
        unitPrice: unitPrice > 0 ? unitPrice : null,
        totalAmount,
        pixKey: PIX_KEY,
        pixKeyType: PIX_KEY_TYPE,
        receiptImageUrl: receiptImageUrl || null,
        receiptFileName: receiptFileName || null,
        clientNote: clientNote || null,
        status: "Aguardando pagamento",
        reviewToken,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const requestRef = await db.collection("creditRequests").add(payload);
      const reviewUrl = `${buildBaseUrl(req)}/api-v2/credits/review/${reviewToken}`;

      let emailResult: any = { success: false, skipped: true };

      try {
        emailResult = await sendEmail({
          to: CREDIT_APPROVAL_EMAIL,
          subject: `Nova solicitação de créditos - ${projectTitle || projectId}`,
          html: renderCreditRequestEmail({
            request: {
              id: requestRef.id,
              ...payload
            },
            reviewUrl
          })
        });
      } catch (emailError: any) {
        emailResult = {
          success: false,
          error: emailError.message || "Erro ao enviar e-mail"
        };
      }

      res.json({
        success: true,
        requestId: requestRef.id,
        status: "Aguardando pagamento",
        pixKey: PIX_KEY,
        pixKeyType: PIX_KEY_TYPE,
        totalAmount,
        creditsRequested,
        reviewUrl,
        emailResult
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao criar solicitação de créditos." });
    }
  });

  app.get("/api-v2/credits/review/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const found = await getCreditRequestByToken(token);

      if (!found) {
        return res.status(404).send("Solicitação não encontrada.");
      }

      const message = String(req.query.message || "").trim();
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(
        renderCreditReviewPage({
          request: found.data,
          token,
          message
        })
      );
    } catch (error: any) {
      res.status(500).send(error.message || "Erro ao abrir análise da solicitação.");
    }
  });

  app.post("/api-v2/credits/review/:token/analyze", async (req, res) => {
    try {
      const { token } = req.params;
      const found = await getCreditRequestByToken(token);

      if (!found) {
        return res.redirect(`/api-v2/credits/review/${token}?message=${encodeURIComponent("Solicitação não encontrada.")}`);
      }

      if (found.data.status === "Aprovado" || found.data.status === "Recusado") {
        return res.redirect(`/api-v2/credits/review/${token}?message=${encodeURIComponent("Esta solicitação já foi finalizada.")}`);
      }

      await found.ref.update({
        status: "Em análise",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        reviewedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.redirect(`/api-v2/credits/review/${token}?message=${encodeURIComponent("Solicitação marcada como em análise.")}`);
    } catch (error: any) {
      res.redirect(`/api-v2/credits/review/${req.params.token}?message=${encodeURIComponent(error.message || "Erro ao atualizar solicitação.")}`);
    }
  });

  app.post("/api-v2/credits/review/:token/approve", async (req, res) => {
    try {
      const { token } = req.params;
      const reviewerNote = String(req.body.reviewerNote || "").trim();
      const found = await getCreditRequestByToken(token);

      if (!found) {
        return res.redirect(`/api-v2/credits/review/${token}?message=${encodeURIComponent("Solicitação não encontrada.")}`);
      }

      const db = getFirestore();

      await db.runTransaction(async transaction => {
        const requestSnap = await transaction.get(found.ref);
        if (!requestSnap.exists) {
          throw new Error("Solicitação não encontrada.");
        }

        const requestData = requestSnap.data() as any;

        if (requestData.status === "Aprovado") {
          throw new Error("Esta solicitação já foi aprovada.");
        }

        if (requestData.status === "Recusado") {
          throw new Error("Esta solicitação já foi recusada.");
        }

        const projectRef = db.collection("projects").doc(requestData.projectId);
        const projectSnap = await transaction.get(projectRef);

        if (!projectSnap.exists) {
          throw new Error("Projeto vinculado não encontrado.");
        }

        transaction.update(projectRef, {
          creditsTotal: admin.firestore.FieldValue.increment(Number(requestData.creditsRequested || 0)),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        transaction.update(found.ref, {
          status: "Aprovado",
          reviewerNote: reviewerNote || null,
          reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
          approvedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      res.redirect(`/api-v2/credits/review/${token}?message=${encodeURIComponent("Solicitação aprovada e créditos adicionados com sucesso.")}`);
    } catch (error: any) {
      res.redirect(`/api-v2/credits/review/${req.params.token}?message=${encodeURIComponent(error.message || "Erro ao aprovar solicitação.")}`);
    }
  });

  app.post("/api-v2/credits/review/:token/reject", async (req, res) => {
    try {
      const { token } = req.params;
      const reviewerNote = String(req.body.reviewerNote || "").trim();
      const found = await getCreditRequestByToken(token);

      if (!found) {
        return res.redirect(`/api-v2/credits/review/${token}?message=${encodeURIComponent("Solicitação não encontrada.")}`);
      }

      if (found.data.status === "Aprovado") {
        return res.redirect(`/api-v2/credits/review/${token}?message=${encodeURIComponent("Esta solicitação já foi aprovada.")}`);
      }

      await found.ref.update({
        status: "Recusado",
        reviewerNote: reviewerNote || null,
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
        rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.redirect(`/api-v2/credits/review/${token}?message=${encodeURIComponent("Solicitação recusada com sucesso.")}`);
    } catch (error: any) {
      res.redirect(`/api-v2/credits/review/${req.params.token}?message=${encodeURIComponent(error.message || "Erro ao recusar solicitação.")}`);
    }
  });

  app.post("/api-v2/send-invite", async (req, res) => {
    const { clientEmail: to, clientName, inviteLink, isRegistered } = req.body;

    if (!getResendClient()) {
      return res.status(500).json({ error: "Serviço de e-mail não configurado (RESEND_API_KEY faltando)." });
    }

    const buttonText = isRegistered ? "ACESSAR MEU MATERIAL" : "CRIAR ACESSO E VER MEU MATERIAL";
    const subject = isRegistered ? "📸 Seu material novo já está disponível" : "📸 Seu material já está pronto para seleção";

    try {
      const result = await sendEmail({
        to,
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
        `
      });

      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao enviar e-mail." });
    }
  });

  app.post("/api-v2/send-email", async (req, res) => {
    const { to, subject, body } = req.body;

    if (!getResendClient()) {
      return res.status(500).json({ error: "RESEND_API_KEY Missing" });
    }

    try {
      const result = await sendEmail({
        to,
        subject,
        html: body
      });

      res.json({ success: true, data: result });
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
      let cleanFileName = fileName
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9.\-_]/g, "_")
        .replace(/_{2,}/g, "_");

      const key = folderPrefix ? `${folderPrefix}/${cleanFileName}` : cleanFileName;
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: fileType,
        CacheControl: "max-age=31536000"
      });
      const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
      const publicUrl = (process.env.CLOUDFLARE_R2_PUBLIC_URL || "").trim().replace(/\/$/, "");

      if (!publicUrl) {
        console.warn("[R2] WARNING: CLOUDFLARE_R2_PUBLIC_URL is not set. Files will not be accessible via URL.");
      }

      const encodedKey = key.split("/").map(part => encodeURIComponent(part)).join("/");

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
    if (prefix.includes(".r2.dev/") || prefix.includes("cloudflarestorage.com/")) {
      try {
        const urlObj = new URL(prefix);
        let pathName = urlObj.pathname;
        const bucketName = (process.env.CLOUDFLARE_R2_BUCKET || "").trim();
        if (bucketName && pathName.startsWith(`/${bucketName}`)) {
          pathName = pathName.substring(bucketName.length + 1);
        }
        finalPrefix = pathName.split("/").filter(Boolean).join("/");
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
          const type = isImage ? "image" : isVideo ? "video" : "other";

          const encodedKey = obj.Key!.split("/").map(part => encodeURIComponent(part)).join("/");

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
      if (error.code === "auth/user-not-found") {
        return res.json({ success: true, message: "User not found in Auth." });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api-v2/media-proxy/:fileId", async (req, res) => {
    const { fileId } = req.params;
    const driveUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

    try {
      const response = await axios({
        method: "get",
        url: driveUrl,
        responseType: "stream",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        },
        maxRedirects: 5
      });

      const contentType = response.headers["content-type"];
      res.set("Content-Type", contentType);
      if (response.headers["content-length"]) {
        res.set("Content-Length", response.headers["content-length"]);
      }
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Cache-Control", "public, max-age=3600");

      response.data.pipe(res);
    } catch (error: any) {
      console.error("Proxy error:", error.message);
      res.status(500).json({ error: "Erro ao acessar arquivo do Drive", details: error.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Global Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(err.status || 500).json({
      error: err.message || "Erro interno no servidor",
      details: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
