import { collection, query, where, getDocs, addDoc, updateDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Notificacao {
  id?: string;
  para: string;
  tipo: 'planejamento' | 'producao' | 'aprovacao' | 'sistema' | 'planejamento_criado' | 'planejamento_enviado' | 'planejamento_aprovado_cliente' | 'planejamento_validado_equipe' | 'planejamento_revisado';
  titulo: string;
  descricao: string;
  planId?: string;
  postId?: string;
  visto: boolean;
  criadoEm: any;
}

export const notificacaoService = {
  async criar(data: Omit<Notificacao, 'id' | 'visto' | 'criadoEm'>) {
    try {
      const notificacao = {
        ...data,
        para: data.para?.toLowerCase(),
        visto: false,
        criadoEm: serverTimestamp()
      };
      
      console.log('Salvando notificação:', notificacao);
      
      const result = await addDoc(collection(db, 'notificacoes'), notificacao);
      
      console.log('Notificação salva com ID:', result.id);
      
      return result;
    } catch (error) {
      console.error('Erro ao criar notificação:', error);
      throw error;
    }
  },

  async marcarComoVisto(id: string) {
    await updateDoc(doc(db, 'notificacoes', id), { visto: true });
  },

  escutar(email: string, callback: (notifs: Notificacao[]) => void) {
    const q = query(
      collection(db, 'notificacoes'),
      where('para', '==', email.toLowerCase()),
      where('visto', '==', false)
    );
    return onSnapshot(q, (snap) => {
      const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Notificacao[];
      callback(notifs);
    });
  }
};
