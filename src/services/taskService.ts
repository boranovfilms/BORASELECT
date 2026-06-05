import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export interface TaskHistory {
  texto: string;
  autor: string;
  date: string;
}

export interface Task {
  id?: string;
  nome: string;
  prioridade: 'alta' | 'media' | 'baixa';
  status: 'pendente' | 'executada';
  dataLimite?: string;
  dataCriacao: any;
  dataFinalizacao?: any;
  responsavelCriacao: string;
  responsavelCriacaoEmail: string;
  responsavelTarefa: string;
  tipoAcesso: 'particular' | 'equipe';
  equipeSelecionada?: string;
  delegadoPara?: string;
  delegadoNome?: string;
  vistoPeloDelegado?: boolean;
  descricao?: string;
  historico?: TaskHistory[];
  // Campos extras para notificações de planejamento
  planId?: string;
  tipo?: string;
}

// Busca o nome real do usuário logado em boraselect ou clientes
async function getCurrentUserName(): Promise<string> {
  const user = auth.currentUser;
  if (!user) return 'Usuário Desconhecido';

  try {
    // Busca primeiro na equipe Boranov
    const boranovSnap = await getDocs(
      query(collection(db, 'boraselect'), where('email', '==', user.email))
    );
    if (!boranovSnap.empty) {
      return boranovSnap.docs[0].data().name || user.displayName || user.email || 'Usuário';
    }

    // Depois nos clientes
    const clientesSnap = await getDocs(
      query(collection(db, 'clientes'), where('email', '==', user.email))
    );
    if (!clientesSnap.empty) {
      return clientesSnap.docs[0].data().name || user.displayName || user.email || 'Usuário';
    }

    return user.displayName || user.email || 'Usuário';
  } catch {
    return user.displayName || 'Usuário';
  }
}

export const taskService = {

  async getTasks() {
    const q = query(collection(db, 'tarefas'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Task));
  },

  async createTask(taskData: Partial<Task>) {
    const user = auth.currentUser;
    const realName = await getCurrentUserName();
    const now = new Date().toISOString();

    const newHistory: TaskHistory[] = taskData.descricao ? [{
      texto: taskData.descricao.toUpperCase(),
      autor: realName,
      date: now
    }] : [];

    const docRef = await addDoc(collection(db, 'tarefas'), {
      ...taskData,
      nome: taskData.nome?.toUpperCase(),
      status: 'pendente',
      dataCriacao: serverTimestamp(),
      responsavelCriacao: realName,
      responsavelCriacaoEmail: user?.email || '',
      historico: newHistory,
      vistoPeloDelegado: false,
      descricao: ''
    });
    return docRef.id;
  },

  async updateTask(id: string, data: Partial<Task>, newComment?: string) {
    const docRef = doc(db, 'tarefas', id);
    const updatePayload: any = {
      ...data,
      nome: data.nome?.toUpperCase()
    };
    if (newComment?.trim()) {
      const realName = await getCurrentUserName();
      updatePayload.historico = arrayUnion({
        texto: newComment.trim().toUpperCase(),
        autor: realName,
        date: new Date().toISOString()
      });
      updatePayload.descricao = '';
    }
    await updateDoc(docRef, updatePayload);
  },

  async markAsSeen(id: string) {
    const docRef = doc(db, 'tarefas', id);
    await updateDoc(docRef, { vistoPeloDelegado: true });
  },

  async completeTask(id: string) {
    const docRef = doc(db, 'tarefas', id);
    await updateDoc(docRef, {
      status: 'executada',
      dataFinalizacao: serverTimestamp()
    });
  },

  async deleteTask(id: string) {
    await deleteDoc(doc(db, 'tarefas', id));
  }
};
