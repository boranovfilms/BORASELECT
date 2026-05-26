import { collection, query, where, getDocs, addDoc, updateDoc, doc, arrayUnion, serverTimestamp, getDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export type ContentPlanStatus = 'rascunho' | 'aguardando_cliente' | 'aguardando_validacao_equipe' | 'aprovado' | 'devolvido';

export interface ContentPlanHistory {
  userId: string;
  userName: string;
  userEmail: string;
  date: string;
  textBefore: string;
  textAfter: string;
  action: 'edicao' | 'aprovacao' | 'rejeicao' | 'validacao';
}

export interface ContentPlan {
  id?: string;
  clientId: string;
  name: string;
  monthReference: string;
  currentText: string;
  status: ContentPlanStatus;
  history: ContentPlanHistory[];
  validations: string[]; // Emails dos membros que já validaram
  rejectionReason?: string;
  createdAt: any;
  updatedAt: any;
}

export const contentPlanService = {
  // Criar novo planejamento
  async createPlan(data: Partial<ContentPlan>) {
    const docRef = await addDoc(collection(db, 'content_plans'), {
      ...data,
      status: 'rascunho',
      history: [],
      validations: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  },

  // Listar planejamentos de um cliente
  async getPlansByClient(clientId: string) {
    const q = query(collection(db, 'content_plans'), where('clientId', '==', clientId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContentPlan));
  },

  // Novo método para buscar planejamentos pelo email do cliente (Segurança)
  async getPlansByClientEmail(email: string) {
    const qClient = query(collection(db, 'clients'), where('email', '==', email.toLowerCase().trim()));
    const clientSnap = await getDocs(qClient);
    if (clientSnap.empty) return [];
    const clientId = clientSnap.docs[0].id;
    return this.getPlansByClient(clientId);
  },

  // Buscar um planejamento específico
  async getPlanById(planId: string) {
    const docRef = doc(db, 'content_plans', planId);
    const snap = await getDoc(docRef);
    return snap.exists() ? { id: snap.id, ...snap.data() } as ContentPlan : null;
  },

  // Atualizar texto com registro de histórico automático
  async updatePlanText(planId: string, newText: string, currentUser: any) {
    const planRef = doc(db, 'content_plans', planId);
    const planSnap = await getDoc(planRef);
    if (!planSnap.exists()) throw new Error('Planejamento não encontrado');
    const planData = planSnap.data() as ContentPlan;
    const oldText = planData.currentText;

    if (oldText !== newText) {
      const historyItem: ContentPlanHistory = {
        userId: currentUser.uid,
        userName: currentUser.displayName || 'Usuário',
        userEmail: currentUser.email || '',
        date: new Date().toISOString(),
        textBefore: oldText,
        textAfter: newText,
        action: 'edicao'
      };
      await updateDoc(planRef, {
        currentText: newText,
        history: arrayUnion(historyItem),
        updatedAt: serverTimestamp()
      });
    }
  },

  // Atualizar status e disparar fluxos
  async updateStatus(planId: string, newStatus: ContentPlanStatus, reason?: string) {
    const planRef = doc(db, 'content_plans', planId);
    await updateDoc(planRef, {
      status: newStatus,
      rejectionReason: reason || '',
      updatedAt: serverTimestamp()
    });
  },

  // Validar como membro da equipe
  async validateByMember(planId: string, userEmail: string) {
    const planRef = doc(db, 'content_plans', planId);
    const planSnap = await getDoc(planRef);
    const planData = planSnap.data() as ContentPlan;
    if (!planData.validations.includes(userEmail)) {
      await updateDoc(planRef, {
        validations: arrayUnion(userEmail),
        updatedAt: serverTimestamp()
      });
    }
  },

  // NOVO MÉTODO: Excluir planejamento
  async deletePlan(id: string) {
    await deleteDoc(doc(db, 'content_plans', id));
  }
};
