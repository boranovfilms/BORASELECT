import { collection, query, where, getDocs, addDoc, updateDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Notificacao {
  id?: string;
  para: string;
  tipo: 'planejamento' | 'producao' | 'aprovacao' | 'sistema';
  titulo: string;
  descricao: string;
  planId?: string;
  postId?: string;
  visto: boolean;
  criadoEm: any;
}

export const notificacaoService = {
  async criar(data: Omit<Notificacao, 'id' | 'visto' | 'criadoEm'>) {
    return await addDoc(collection(db, 'notificacoes'), {
      ...data,
      visto: false,
      criadoEm: serverTimestamp()
    });
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
