import { collection, query, where, getDocs, addDoc, serverTimestamp, getDoc, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export interface Client {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  logo?: string;
  ownerId?: string;
  createdAt?: any;
  updatedAt?: any;
  status?: 'pending' | 'confirmed';
  lastAccess?: any;
  type: 'empresa' | 'membro';
  companyId?: string; // preenchido quando type === 'membro'
  role?: string;      // 'cliente' para empresa, 'equipe' para membro
}

export const clientService = {

  // Busca todas as empresas clientes
  searchClients: async (nameQuery: string): Promise<Client[]> => {
    const q = query(
      collection(db, 'clientes'),
      where('type', '==', 'empresa')
    );
    const snapshot = await getDocs(q);
    const clients = snapshot.docs.map(docSnap => ({
      ...docSnap.data(),
      id: docSnap.id
    })) as Client[];

    if (!nameQuery) return clients;
    return clients.filter(c => c.name.toLowerCase().includes(nameQuery.toLowerCase()));
  },

  // Busca empresa pelo ID
  getClient: async (id: string): Promise<Client | null> => {
    const docRef = doc(db, 'clientes', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Client;
    }
    return null;
  },

  // Cria nova empresa cliente
  createClient: async (data: Partial<Client>) => {
    if (!auth.currentUser) throw new Error('Não autenticado');
    const cleanEmail = data.email ? data.email.toLowerCase().trim() : '';

    // Verifica se já existe empresa com esse email
    const existing = await getDocs(
      query(collection(db, 'clientes'), where('email', '==', cleanEmail), where('type', '==', 'empresa'))
    );
    const isConfirmed = !existing.empty;

    const clientsRef = collection(db, 'clientes');
    const newDocRef = doc(clientsRef);

    const payload = {
      ...data,
      id: newDocRef.id,
      email: cleanEmail,
      type: 'empresa',
      role: 'cliente',
      ownerId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: isConfirmed ? 'confirmed' : 'pending',
    };

    await setDoc(newDocRef, payload);
    return newDocRef;
  },

  // Atualiza empresa cliente
  updateClient: async (id: string, data: Partial<Client>) => {
    const docRef = doc(db, 'clientes', id);
    return await updateDoc(docRef, {
      ...data,
      ...(data.email && { email: data.email.toLowerCase().trim() }),
      updatedAt: serverTimestamp()
    });
  },

  // Atualiza último acesso do cliente
  updateLastAccess: async (email: string) => {
    const cleanEmail = email.toLowerCase().trim();
    const q = query(collection(db, 'clientes'), where('email', '==', cleanEmail));
    const snapshot = await getDocs(q);
    const updates = snapshot.docs.map(d =>
      updateDoc(d.ref, { lastAccess: serverTimestamp(), status: 'confirmed' })
    );
    await Promise.all(updates);
  },

  // Atualiza status do cliente por email
  updateClientStatusByEmail: async (email: string, status: 'pending' | 'confirmed') => {
    const cleanEmail = email.toLowerCase().trim();
    const q = query(collection(db, 'clientes'), where('email', '==', cleanEmail));
    const snapshot = await getDocs(q);
    const updates = snapshot.docs.map(d => updateDoc(d.ref, { status, updatedAt: serverTimestamp() }));
    await Promise.all(updates);
  },

  // Deleta empresa cliente
  deleteClient: async (id: string) => {
    await deleteDoc(doc(db, 'clientes', id));
  },

  // Deleta autenticação do cliente
  deleteClientAuth: async (email: string) => {
    try {
      const response = await fetch('/api-v2/auth/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao remover acesso');
      return data;
    } catch (error) {
      console.error('Erro ao deletar auth:', error);
      throw error;
    }
  },

  // Busca membros da equipe de uma empresa
  getClientTeamMembers: async (companyId: string): Promise<Client[]> => {
    const q = query(
      collection(db, 'clientes'),
      where('type', '==', 'membro'),
      where('companyId', '==', companyId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Client[];
  },

  // Cria membro da equipe do cliente
  createClientMember: async (data: Partial<Client>) => {
    if (!auth.currentUser) throw new Error('Não autenticado');
    const cleanEmail = data.email ? data.email.toLowerCase().trim() : '';

    const clientsRef = collection(db, 'clientes');
    const newDocRef = doc(clientsRef);

    const payload = {
      ...data,
      id: newDocRef.id,
      email: cleanEmail,
      type: 'membro',
      role: 'equipe',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: 'pending',
    };

    await setDoc(newDocRef, payload);
    return newDocRef;
  },

  // Verifica status global por email
  checkGlobalStatus: async (email: string): Promise<'pending' | 'confirmed'> => {
    const cleanEmail = email.toLowerCase().trim();
    const q = query(
      collection(db, 'clientes'),
      where('email', '==', cleanEmail),
      where('status', '==', 'confirmed')
    );
    const snap = await getDocs(q);
    return snap.empty ? 'pending' : 'confirmed';
  }
};
