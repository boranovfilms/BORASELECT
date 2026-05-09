import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { clientEmail: to, clientName, inviteLink, isRegistered } = req.body;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "RESEND_API_KEY não configurada" });
  }

  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);

  const from = 'Boraselect <contato@boranov.com.br>';

  const buttonText = isRegistered ? "ACESSAR MEU MATERIAL" : "CRIAR ACESSO E VER MEU MATERIAL";
  const subject = isRegistered ? "📸 Seu material novo já está disponível" : "📸 Seu material já está pronto para seleção";

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: [to],
      subject,
      html: `
        <div style="background-color: #0a0a0a; padding: 40px 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #ffffff;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #111111; padding: 48px; border-radius: 24px; border: 1px solid #222222;">
            <h1 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 700; color: #ffffff;">Olá, ${clientName}!</h1>
            <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">Separei com muito cuidado o seu material (fotos e vídeos) — e agora chegou a melhor parte: você escolher o que mais gostou.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteLink}" style="display: inline-block; background-color: #ff5351; color: #ffffff; padding: 18px 32px; font-size: 15px; font-weight: 800; text-decoration: none; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.5px;">${buttonText}</a>
            </div>
            <div style="border-top: 1px solid #222222; padding-top: 24px; color: #888888; font-size: 15px;">Abraço,<br><span style="color: #ffffff; font-weight: 600; font-size: 16px;">Ronaldo</span><br><span style="color: #ff5351; font-weight: 500;">Boranov Films</span></div>
          </div>
        </div>
      `,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Erro ao enviar e-mail" });
  }
}
