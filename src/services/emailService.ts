import { toast } from "react-hot-toast";

export const emailService = {
  sendInvite: async (clientEmail: string, clientName: string, inviteLink: string, isRegistered: boolean = false) => {
    try {
      const response = await fetch('/api-v2/send-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientEmail,
          clientName,
          inviteLink,
          isRegistered
        }),
      });

      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error('Non-JSON response received:', text);
        throw new Error(`Resposta inesperada do servidor (formato não-JSON).`);
      }

      if (!response.ok) {
        const errorMessage = typeof data.error === 'string' ? data.error : (data.error?.message || JSON.stringify(data.error));
        throw new Error(errorMessage || 'Erro ao enviar e-mail');
      }

      toast.success('E-mail de convite enviado!');
      return data;
    } catch (error: any) {
      console.error('Email service error:', error);
      toast.error('Erro ao enviar e-mail: ' + (error.message || 'Erro desconhecido'));
      throw error;
    }
  }
};
