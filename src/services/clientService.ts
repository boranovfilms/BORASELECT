import { collection, query, where, getDocs, addDoc, serverTimestamp, getDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export interface Client {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  ownerId: string;
  createdAt: any;
  status?: 'pending' | 'confirmed';
  lastAccess?: any;
  role?: string;
}

export const clientService = {
  searchClients: async (nameQuery: string) => {
    if (!auth.currentUser) return [];
    
    const q = query(collection(db, 'clients'));
    const snapshot = await getDocs(q);
    
    // CORREÇÃO: Garante que o ID do documento Firebase sempre seja o ID principal do objeto,
    // ignorando qualquer campo 'id' vazio que possa existir dentro do documento.
    const clients = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return { 
        ...data, 
        id: docSnap.id // O ID do documento é a fonte da verdade
      } as Client;
    });
    
    if (!nameQuery) return clients;
    return clients.filter(c => c.name.toLowerCase().includes(nameQuery.toLowerCase()));
  },

  checkGlobalStatus: async (email: string): Promise<'pending' | 'confirmed'> => {
    const cleanEmail = email.toLowerCase().trim();
    const [clientQuery, projectQuery] = await Promise.all([
      getDocs(query(collection(db, 'clients'), where('email', '==', cleanEmail), where('status', '==', 'confirmed'))),
      getDocs(query(collection(db, 'projects'), where('clientEmail', '==', cleanEmail), where('clientStatus', '==', 'confirmed')))
    ]);
    return (!clientQuery.empty || !projectQuery.empty) ? 'confirmed' : 'pending';
  },

  createClient: async (data: Partial<Client>) => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    const cleanEmail = data.email ? data.email.toLowerCase().trim() : '';
    
    const [clientQuery, projectQuery] = await Promise.all([
      getDocs(query(collection(db, 'clients'), where('email', '==', cleanEmail), where('status', '==', 'confirmed'))),
      getDocs(query(collection(db, 'projects'), where('clientEmail', '==', cleanEmail), where('clientStatus', '==', 'confirmed')))
    ]);

    const isConfirmed = !clientQuery.empty || !projectQuery.empty;
    const initialStatus = isConfirmed ? 'confirmed' : 'pending';

    // CORREÇÃO: Criamos a referência primeiro para obter o ID e salvamos ele dentro do documento
    const clientsRef = collection(db, 'clients');
    const newDocRef = doc(clientsRef); // Gera um novo ID único
    
    const payload = {
      ...data,
      id: newDocRef.id, // Grava o ID gerado dentro do documento
      email: cleanEmail,
      ownerId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      status: initialStatus,
      role: data.role || 'cliente'
    };

    await setDoc(newDocRef, payload);
    return newDocRef;
  },

  updateClient: async (id: string, data: Partial<Client>) => {
    const docRef = doc(db, 'clients', id);
    return await updateDoc(docRef, {
      ...data,
      ...(data.email && { email: data.email.toLowerCase().trim() }),
    });
  },

  updateClientStatusByEmail: async (email: string, status: 'pending' | 'confirmed') => {
    const cleanEmail = email.toLowerCase().trim();
    const qClients = query(collection(db, 'clients'), where('email', '==', cleanEmail));
    const snapshotClients = await getDocs(qClients);
    
    const clientUpdates = snapshotClients.docs.map(clientDoc => 
      updateDoc(clientDoc.ref, { status })
    );
    await Promise.all(clientUpdates);

    const qProjects = query(collection(db, 'projects'), where('clientEmail', '==', cleanEmail));
    const snapshotProjects = await getDocs(qProjects);
    const projectUpdates = snapshotProjects.docs.map(projectDoc =>
      updateDoc(projectDoc.ref, { 
        clientStatus: status,
        updatedAt: serverTimestamp() 
      })
    );
    await Promise.all(projectUpdates);
  },

  updateLastAccess: async (email: string) => {
    const cleanEmail = email.toLowerCase().trim();
    
    const qClients = query(collection(db, 'clients'), where('email', '==', cleanEmail));
    const snapshotClients = await getDocs(qClients);
    const clientUpdates = snapshotClients.docs.map(clientDoc => 
      updateDoc(clientDoc.ref, { 
        lastAccess: serverTimestamp(),
        status: 'confirmed'
      })
    );
    await Promise.all(clientUpdates);

    const qProjects = query(collection(db, 'projects'), where('clientEmail', '==', cleanEmail));
    const snapshotProjects = await getDocs(qProjects);
    const projectUpdates = snapshotProjects.docs.map(projectDoc =>
      updateDoc(projectDoc.ref, { 
        clientStatus: 'confirmed',

        updatedAt: serverTimestamp()
      })
    );
    await Promise.all(projectUpdates);
  },

  getClient: async (id: string) => {
    const docRef = doc(db, 'clients', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Client;
    }
    return null;
  },

  deleteClient: async (id: string) => {
    const { deleteDoc, getDoc, doc, collection, query, where, getDocs, updateDoc, serverTimestamp } = await import('firebase/firestore');
    const docRef = doc(db, 'clients', id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const email = docSnap.data().email;
      if (email) {
        try {
          const qProjects = query(collection(db, 'projects'), where('clientEmail', '==', email.toLowerCase().trim()));
          const snapshotProjects = await getDocs(qProjects);
          
          const projectUpdates = snapshotProjects.docs.map(projectDoc =>
            updateDoc(projectDoc.ref, { 
              clientStatus: 'pending',
              clientName: '', 
              clientEmail: '', 
              updatedAt: serverTimestamp() 
            })
          );
          await Promise.all(projectUpdates);
        } catch (err) {
          console.warn('Failed to clear project info during client deletion:', err);
        }
      }
    }
    
    await deleteDoc(docRef);
  },

  deleteClientAuth: async (email: string) => {
    try {
      const response = await fetch('/api-v2/auth/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao remover acesso do cliente');
      return data;
    } catch (error) {
      console.error('Failed to delete client auth:', error);
      throw error;
    }
  }
};
