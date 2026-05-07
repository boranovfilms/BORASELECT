import { collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export interface Project {
  id?: string;
  title: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  category: string;
  type?: string;
  status: 'Em Seleção' | 'Finalizado' | 'Aguardando Cliente';
  coverImage: string;
  deliveryDate?: any;
  progress: number;
  driveLink?: string;
  includedItems?: number;
  extraPrice?: number;
  allowHighRes?: boolean;
  watermarkUrl?: string;
  creditsUsed: number;
  creditsTotal: number;
  ownerId: string;
  clientStatus?: 'pending' | 'confirmed';
  createdAt: any;
  updatedAt: any;
}

export const projectService = {
  getProjects: async () => {
    if (!auth.currentUser) return [];
    const q = query(
      collection(db, 'projects'),
      where('ownerId', '==', auth.currentUser.uid)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id, 
        ...data,
        creditsUsed: data.creditsUsed || 0,
        creditsTotal: data.creditsTotal ?? data.includedItems ?? 15
      } as Project;
    });
  },

  getProjectsForClient: async () => {
    if (!auth.currentUser || !auth.currentUser.email) return [];
    const cleanEmail = auth.currentUser.email.toLowerCase().trim();
    console.log('Fetching projects for client email:', cleanEmail);
    const q = query(
      collection(db, 'projects'),
      where('clientEmail', '==', cleanEmail)
    );
    const snapshot = await getDocs(q);
    console.log('Projects found for client:', snapshot.size);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id, 
        ...data,
        creditsUsed: data.creditsUsed || 0,
        creditsTotal: data.creditsTotal ?? data.includedItems ?? 15
      } as Project;
    });
  },

  getProject: async (id: string) => {
    const docSnap = await getDocs(query(collection(db, 'projects'), where('__name__', '==', id)));
    if (!docSnap.empty) {
      const data = docSnap.docs[0].data();
      return { 
        id: docSnap.docs[0].id, 
        ...data,
        creditsUsed: data.creditsUsed || 0,
        creditsTotal: data.creditsTotal ?? data.includedItems ?? 15
      } as Project;
    }
    return null;
  },

  updateProject: async (id: string, data: Partial<Project>) => {
    const docRef = doc(db, 'projects', id);
    const updateData = { ...data };
    
    if (updateData.clientEmail) {
      updateData.clientEmail = updateData.clientEmail.toLowerCase().trim();
    }

    return await updateDoc(docRef, {
      ...updateData,
      updatedAt: serverTimestamp(),
    });
  },

  createProject: async (data: Partial<Project>) => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    
    // Normalize client email to lowercase to match login email
    const normalizedData = {
      ...data,
      clientEmail: data.clientEmail ? data.clientEmail.toLowerCase().trim() : '',
      ownerId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    return await addDoc(collection(db, 'projects'), normalizedData);
  },

  deleteProject: async (id: string) => {
    const docRef = doc(db, 'projects', id);
    return await deleteDoc(docRef);
  }
};
