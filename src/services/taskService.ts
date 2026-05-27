import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export interface TaskHistory {
  texto: string;
  autor: string;
  data: string;
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
  delegadoPara?: string; // E-mail do usuário delegado
  delegadoNome?: string; // Nome do usuário delegado
  vistoPeloDelegado?: boolean; // Controle para notificação sonora
  descricao?: string;
  historico?: TaskHistory[];
}

// Função auxiliar para buscar o nome real do usuário logado
async function getCurrentUserName() {
  const user = auth.currentUser;
  if (!user) return 'Usuário Desconhecido';
  
  try {
    const q = query(collection(db, 'clients'), where('email', '==', user.email));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data().name || user.displayName || user.email || 'Usuário';
    }
    return user.displayName || user.email || 'Usuário';
  } catch (error) {
    return user.displayName || 'Usuário';
  }
}

export const taskService = {
  async getTasks() {
    const q = query(collection(db, 'tasks'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
  },

  async createTask(taskData: Partial<Task>) {
    const user = auth.currentUser;
    const realName = await getCurrentUserName();
    const now = new Date().toISOString();
    
    const newHistory: TaskHistory[] = taskData.descricao ? [{
      texto: taskData.descricao.toUpperCase(),
      autor: realName,
      data: now
    }] : [];

    const docRef = await addDoc(collection(db, 'tasks'), {
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
    const docRef = doc(db, 'tasks', id);
    const updatePayload: any = { 
      ...data,
      nome: data.nome?.toUpperCase()
    };

    if (newComment?.trim()) {
      const realName = await getCurrentUserName();
      updatePayload.historico = arrayUnion({
        texto: newComment.trim().toUpperCase(),
        autor: realName,
        data: new Date().toISOString()
      });
      updatePayload.descricao = '';
    }

    await updateDoc(docRef, updatePayload);
  },

  async markAsSeen(id: string) {
    const docRef = doc(db, 'tasks', id);
    await updateDoc(docRef, { vistoPeloDelegado: true });
  },

  async completeTask(id: string) {
    const docRef = doc(db, 'tasks', id);
    await updateDoc(docRef, {
      status: 'executada',
      dataFinalizacao: serverTimestamp()
    });
  },

  async deleteTask(id: string) {
    await deleteDoc(doc(db, 'tasks', id));
  }
};
