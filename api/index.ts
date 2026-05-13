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

function initializeFirebaseAdmin() {
  if (admin.apps.length) return;

  const serviceAccountJson = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();

  if (serviceAccountJson) {
    const parsed = JSON.parse(serviceAccountJson);

    admin.initializeApp({
      credential: admin.credential.cert(parsed),
      projectId: parsed.project_id
    });

    return;
  }

  const firebaseConfigPath = path.join(__dirname, "..", "firebase-applet-config.json");
  if (fs.existsSync(firebaseConfigPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));

    admin.initializeApp({
      projectId: firebaseConfig.projectId
    });

    return;
  }

  throw new Error("Firebase Admin não configurado. Defina FIREBASE_SERVICE_ACCOUNT_JSON no Vercel.");
}

initializeFirebaseAdmin();

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

function sendJson(res: any, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function sendHtml(res: any, status: number, html: string) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(html);
}

function redirect(res: any, location: string) {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.end();
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

function buildBaseUrl(req: any) {
  const envUrl = (process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (envUrl) return envUrl;

  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000").split(",")[0].trim();

  return `${proto}://${host}`;
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
    createdAt: serializeTimestamp((data as any).createdAt),
    updatedAt: serializeTimestamp((data as any).updatedAt),
    reviewedAt: serializeTimestamp((data as any).reviewedAt),
    approvedAt: serializeTimestamp((data as any).approvedAt),
    rejectedAt: serializeTimestamp((data as any).rejectedAt)
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

function getRoute(req: any) {
  const url = new URL(req.url || "/", "http://localhost");
  let route = String(url.searchParams.get("route") || url.pathname || "/").trim();

  if (route.startsWith("/api-v2/")) {
    route = route.slice("/api-v2".length);
  }

  if (route.startsWith("/api/")) {
    route = route.slice("/api".length);
  }

  if (route.startsWith("/index")) {
    route = route.slice("/index".length);
  }

  if (!route.startsWith("/")) {
    route = `/${route}`;
  }

  return route || "/";
}

async function readRawBody(req: any) {
  return await new Promise<string>((resolve, reject) => {
    let data = "";

    req.on("data", (chunk: Buffer | string) => {
      data += chunk.toString();
    });

    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function parseBody(req: any) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string" && req.body.length > 0) {
    const contentType = String(req.headers["content-type"] || "");
    if (contentType.includes("application/json")) {
      return JSON.parse(req.body);
    }
    if (contentType.includes("application/x-www-form-urlencoded")) {
      return Object.fromEntries(new URLSearchParams(req.body));
    }
    return {};
  }

  const raw = await readRawBody(req);
  if (!raw) return {};

  const contentType = String(req.headers["content-type"] || "");
  if (contentType.includes("application/json")) {
    return JSON.parse(raw);
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw));
  }

  return {};
}

export default async function handler(req: any, res: any) {
  const method = String(req.method || "GET").toUpperCase();
  const route = getRoute(req);

  try {
    if (method === "GET" && route === "/health") {
      return sendJson(res, 200, { status: "ok", timestamp: new Date().toISOString() });
    }

    if (method === "GET" && route === "/credits/config") {
      return sendJson(res, 200, {
        pixKey: PIX_KEY,
        pixKeyType: PIX_KEY_TYPE,
        approvalMode: "manual",
        unitPrice: CREDIT_PRICE_PER_UNIT > 0 ? CREDIT_PRICE_PER_UNIT : null
      });
    }

    const creditRequestsMatch = route.match(/^\/credits\/requests\/([^/]+)$/);
    if (method === "GET" && creditRequestsMatch) {
      const projectId = decodeURIComponent(creditRequestsMatch[1]);
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

      return sendJson(res, 200, { requests });
    }

    if (method === "POST" && route === "/credits/request") {
      const body = await parseBody(req);
      const db = getFirestore();

      const projectId = String(body.projectId || "").trim();
      const receiptImageUrl = String(body.receiptImageUrl || "").trim();
      const receiptFileName = String(body.receiptFileName || "").trim();
      const clientNote = String(body.clientNote || "").trim();

      const creditsRequested = parsePositiveInteger(body.creditsRequested);
      const requestUnitPrice = parseMoney(body.unitPrice);
      const requestTotalAmount = parseMoney(body.totalAmount || body.amount);

      if (!projectId) {
        return sendJson(res, 400, { error: "projectId é obrigatório." });
      }

      if (!creditsRequested) {
        return sendJson(res, 400, { error: "Informe a quantidade de créditos." });
      }

      const projectRef = db.collection("projects").doc(projectId);
      const projectSnap = await projectRef.get();

      if (!projectSnap.exists) {
        return sendJson(res, 404, { error: "Projeto não encontrado." });
      }

      const projectData = projectSnap.data() || {};
      const clientName = String(body.clientName || (projectData as any).clientName || "").trim();
      const clientEmail = String(body.clientEmail || (projectData as any).clientEmail || "").trim().toLowerCase();
      const projectTitle = String(body.projectTitle || (projectData as any).title || "").trim();

      const unitPrice = CREDIT_PRICE_PER_UNIT > 0 ? CREDIT_PRICE_PER_UNIT : requestUnitPrice;
      const totalAmount = unitPrice > 0 ? Number((unitPrice * creditsRequested).toFixed(2)) : requestTotalAmount;

      if (!totalAmount || totalAmount <= 0) {
        return sendJson(res, 400, { error: "Valor total inválido para a solicitação." });
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

      return sendJson(res, 200, {
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
    }

    const reviewViewMatch = route.match(/^\/credits\/review\/([^/]+)$/);
    if (method === "GET" && reviewViewMatch) {
      const token = decodeURIComponent(reviewViewMatch[1]);
      const found = await getCreditRequestByToken(token);

      if (!found) {
        return sendHtml(res, 404, "Solicitação não encontrada.");
      }

      const url = new URL(req.url || "/", "http://localhost");
      const message = String(url.searchParams.get("message") || "").trim();

      return sendHtml(
        res,
        200,
        renderCreditReviewPage({
          request: found.data,
          token,
          message
        })
      );
    }

    const reviewActionMatch = route.match(/^\/credits\/review\/([^/]+)\/(analyze|approve|reject)$/);
    if (method === "POST" && reviewActionMatch) {
      const token = decodeURIComponent(reviewActionMatch[1]);
      const action = reviewActionMatch[2];
      const body = await parseBody(req);
      const found = await getCreditRequestByToken(token);

      if (!found) {
        return redirect(res, `/api-v2/credits/review/${token}?message=${encodeURIComponent("Solicitação não encontrada.")}`);
      }

      if (action === "analyze") {
        if (found.data.status === "Aprovado" || found.data.status === "Recusado") {
          return redirect(res, `/api-v2/credits/review/${token}?message=${encodeURIComponent("Esta solicitação já foi finalizada.")}`);
        }

        await found.ref.update({
          status: "Em análise",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          reviewedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return redirect(res, `/api-v2/credits/review/${token}?message=${encodeURIComponent("Solicitação marcada como em análise.")}`);
      }

      if (action === "approve") {
        const reviewerNote = String(body.reviewerNote || "").trim();
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

        return redirect(res, `/api-v2/credits/review/${token}?message=${encodeURIComponent("Solicitação aprovada e créditos adicionados com sucesso.")}`);
      }

      if (action === "reject") {
        const reviewerNote = String(body.reviewerNote || "").trim();

        if (found.data.status === "Aprovado") {
          return redirect(res, `/api-v2/credits/review/${token}?message=${encodeURIComponent("Esta solicitação já foi aprovada.")}`);
        }

        await found.ref.update({
          status: "Recusado",
          reviewerNote: reviewerNote || null,
          reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
          rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return redirect(res, `/api-v2/credits/review/${token}?message=${encodeURIComponent("Solicitação recusada com sucesso.")}`);
      }
    }

    if (method === "POST" && route === "/send-invite") {
      const body = await parseBody(req);
      const to = body.clientEmail;
      const clientName = body.clientName;
      const inviteLink = body.inviteLink;
      const isRegistered = body.isRegistered;

      if (!getResendClient()) {
        return sendJson(res, 500, { error: "Serviço de e-mail não configurado (RESEND_API_KEY faltando)." });
      }

      const buttonText = isRegistered ? "ACESSAR MEU MATERIAL" : "CRIAR ACESSO E VER MEU MATERIAL";
      const subject = isRegistered ? "📸 Seu material novo já está disponível" : "📸 Seu material já está pronto para seleção";

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

      return sendJson(res, 200, { success: true, data: result });
    }

    if (method === "POST" && route === "/send-email") {
      const body = await parseBody(req);

      if (!getResendClient()) {
        return sendJson(res, 500, { error: "RESEND_API_KEY Missing" });
      }

      const result = await sendEmail({
        to: body.to,
        subject: body.subject,
        html: body.body
      });

      return sendJson(res, 200, { success: true, data: result });
    }

    if (method === "POST" && route === "/media/upload-url") {
      const body = await parseBody(req);
      const fileName = String(body.fileName || "").trim();
      const fileType = String(body.fileType || "").trim();
      const folderPrefix = String(body.folderPrefix || "").trim();
      const bucket = (process.env.CLOUDFLARE_R2_BUCKET || "").trim();
      const publicUrl = (process.env.CLOUDFLARE_R2_PUBLIC_URL || "").trim().replace(/\/$/, "");
      const s3 = getR2Client();

      if (!fileName) {
        return sendJson(res, 400, { error: "fileName é obrigatório" });
      }

      if (!fileType) {
        return sendJson(res, 400, { error: "fileType é obrigatório" });
      }

      if (!s3 || !bucket) {
        return sendJson(res, 400, { error: "Configuração R2 incompleta" });
      }

      if (!publicUrl) {
        return sendJson(res, 400, { error: "CLOUDFLARE_R2_PUBLIC_URL não configurado" });
      }

      const cleanFileName = fileName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
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
      const encodedKey = key.split("/").map(part => encodeURIComponent(part)).join("/");

      return sendJson(res, 200, {
        success: true,
        uploadUrl: signedUrl,
        fileUrl: `${publicUrl}/${encodedKey}`,
        key
      });
    }

    if (method === "POST" && route === "/media/sync") {
      const body = await parseBody(req);
      const prefix = body.folderPrefix || body.url || "";
      let finalPrefix = String(prefix || "");

      if (finalPrefix.includes(".r2.dev/") || finalPrefix.includes("cloudflarestorage.com/")) {
        try {
          const urlObj = new URL(finalPrefix);
          let pathName = urlObj.pathname;
          const bucketName = (process.env.CLOUDFLARE_R2_BUCKET || "").trim();
          if (bucketName && pathName.startsWith(`/${bucketName}`)) {
            pathName = pathName.substring(bucketName.length + 1);
          }
          finalPrefix = pathName.split("/").filter(Boolean).join("/");
        } catch (error) {}
      }

      const bucket = (process.env.CLOUDFLARE_R2_BUCKET || "").trim();
      const s3 = getR2Client();
      const publicUrl = (process.env.CLOUDFLARE_R2_PUBLIC_URL || "").trim().replace(/\/$/, "");

      if (!s3 || !bucket) {
        return sendJson(res, 400, { error: "Configuração R2 incompleta" });
      }

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
        .filter(file => file.type !== "other");

      return sendJson(res, 200, { files });
    }

    if (method === "POST" && route === "/auth/delete-user") {
      const body = await parseBody(req);
      const email = String(body.email || "").trim();

      if (!email) {
        return sendJson(res, 400, { error: "Email is required" });
      }

      try {
        const user = await admin.auth().getUserByEmail(email);
        await admin.auth().deleteUser(user.uid);
        return sendJson(res, 200, { success: true, message: `User ${email} deleted successfully.` });
      } catch (error: any) {
        if (error.code === "auth/user-not-found") {
          return sendJson(res, 200, { success: true, message: "User not found in Auth." });
        }
        return sendJson(res, 500, { error: error.message });
      }
    }

    const mediaProxyMatch = route.match(/^\/media-proxy\/([^/]+)$/);
    if (method === "GET" && mediaProxyMatch) {
      const fileId = decodeURIComponent(mediaProxyMatch[1]);
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
        if (contentType) {
          res.setHeader("Content-Type", contentType);
        }
        if (response.headers["content-length"]) {
          res.setHeader("Content-Length", response.headers["content-length"]);
        }
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Cache-Control", "public, max-age=3600");

        return response.data.pipe(res);
      } catch (error: any) {
        return sendJson(res, 500, { error: "Erro ao acessar arquivo do Drive", details: error.message });
      }
    }

    return sendJson(res, 404, { error: "Rota não encontrada", route, method });
  } catch (error: any) {
    console.error("API Error:", error);
    return sendJson(res, 500, {
      error: error.message || "Erro interno no servidor"
    });
  }
}
