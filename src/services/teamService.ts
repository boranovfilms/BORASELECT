import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface TeamMember {
  id?: string;
  name: string;
  email: string;a
  phone?: string;
  jobTitle?: string;
  role: string; // 'master' | 'redator' | 'designer' | 'editor' | 'midia_social'
  status: 'pending' | 'confirmed';
  createdAt?: any;
  updatedAt?: any;
  photoUrl?: string;
}

export const teamService = {

  // Busca todos os membros da equipe Boranov
  async getTeamMembers(): Promise<TeamMember[]> {
    const snapshot = await getDocs(collection(db, 'boraselect'));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as TeamMember[];
  },

  // Busca membros da equipe de um cliente específico
  async getClientTeamMembers(companyId: string): Promise<TeamMember[]> {
    const q = query(
      collection(db, 'clientes'),
      where('type', '==', 'membro'),
      where('companyId', '==', companyId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as TeamMember[];
  },

  // Cria membro da equipe Boranov
  async createTeamMember(member: Omit<TeamMember, 'id' | 'createdAt'>): Promise<string> {
    const ref = collection(db, 'boraselect');
    const newDocRef = doc(ref);
    await setDoc(newDocRef, {
      ...member,
      id: newDocRef.id,
      email: member.email.toLowerCase().trim(),
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return newDocRef.id;
  },

  // Atualiza membro da equipe Boranov
  async updateTeamMember(id: string, data: Partial<TeamMember>): Promise<void> {
    const docRef = doc(db, 'boraselect', id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  },

  // Deleta membro da equipe Boranov
  async deleteTeamMember(id: string): Promise<void> {
    await deleteDoc(doc(db, 'boraselect', id));
  },

  // Deleta autenticação do membro
  async deleteTeamMemberAuth(email: string): Promise<any> {
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

  // Busca usuário por email em qualquer coleção (boraselect ou clientes)
  async getUserByEmail(email: string): Promise<{ role: string; companyId?: string } | null> {
    const cleanEmail = email.toLowerCase().trim();

    // Primeiro busca na equipe Boranov
    const boranovSnap = await getDocs(
      query(collection(db, 'boraselect'), where('email', '==', cleanEmail))
    );
    if (!boranovSnap.empty) {
      const data = boranovSnap.docs[0].data();
      return { role: data.role };
    }

    // Depois busca nos clientes
    const clientesSnap = await getDocs(
      query(collection(db, 'clientes'), where('email', '==', cleanEmail))
    );
    if (!clientesSnap.empty) {
      const data = clientesSnap.docs[0].data();
      return { role: data.role, companyId: data.companyId || data.id };
    }

    return null;
  }
};
