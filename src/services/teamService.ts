import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface TeamMember {
  id?: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  clienteId?: string;
  status: 'pending' | 'confirmed';
  createdAt?: any;
}

export const teamService = {
  async getTeamMembers() {
    const snapshot = await getDocs(collection(db, 'clients'));
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as TeamMember))
      .filter(m => m.role && !['cliente', 'equipe', 'master'].includes(m.role));
  },

  async getClientTeamMembers(clienteId: string) {
    const q = query(
      collection(db, 'clients'),
      where('role', '==', 'equipe'),
      where('clienteId', '==', clienteId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as TeamMember[];
  },

  async createTeamMember(member: Omit<TeamMember, 'id' | 'createdAt'>) {
    const docRef = await addDoc(collection(db, 'clients'), {
      ...member,
      status: 'pending',
      createdAt: new Date()
    });
    return docRef.id;
  },

  // NOVO MÉTODO: Atualiza um membro existente sem duplicar
  async updateTeamMember(id: string, data: Partial<TeamMember>) {
    const docRef = doc(db, 'clients', id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date()
    });
  },

  async deleteTeamMemberAuth(email: string) {
    try {
      const response = await fetch('/api-v2/auth/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error('Falha ao excluir usuário do Auth');
      return await response.json();
    } catch (error) {
      console.error('Erro no deleteAuth:', error);
      throw error;
    }
  },

  async deleteTeamMember(id: string) {
    await deleteDoc(doc(db, 'clients', id));
  }
};
