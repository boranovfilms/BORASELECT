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
  originalDriveLink?: string;
  includedItems?: number;
  extraPrice?: number;
  allowHighRes?: boolean;
  watermarkUrl?: string;
  creditsUsed: number;
  creditsTotal: number;
  ownerId: string;
  clientStatus?: 'pending' | 'confirmed';
  serviceCatalogId?: string;
  serviceCatalogName?: string;
  packageId?: string;
  packageName?: string;
  selectionUnit?: string;
  createdAt: any;
  updatedAt: any;
}

const normalizeProject = (projectId: string, data: any): Project => {
  return {
    id: projectId,
    ...data,
    creditsUsed: data?.creditsUsed || 0,
    creditsTotal: data?.creditsTotal ?? data?.includedItems ?? 15,
    extraPrice: typeof data?.extraPrice === 'number' ? data.extraPrice : Number(data?.extraPrice || 0),
    serviceCatalogId: data?.serviceCatalogId || '',
    serviceCatalogName: data?.serviceCatalogName || '',
    packageId: data?.packageId || '',
    packageName: data?.packageName || '',
    selectionUnit: data?.selectionUnit || '',
  } as Project;
};

export const projectService = {
  getProjects: async () => {
    if (!auth.currentUser) return [];

    const q = query(
      collection(db, 'projects'),
      where('ownerId', '==', auth.currentUser.uid)
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((projectDoc) => normalizeProject(projectDoc.id, projectDoc.data()));
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

    return snapshot.docs.map((projectDoc) => normalizeProject(projectDoc.id, projectDoc.data()));
  },

  getProject: async (id: string) => {
    const docSnap = await getDocs(
      query(collection(db, 'projects'), where('__name__', '==', id))
    );

    if (!docSnap.empty) {
      const projectDoc = docSnap.docs[0];
      return normalizeProject(projectDoc.id, projectDoc.data());
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

    const normalizedData = {
      ...data,
      clientEmail: data.clientEmail ? data.clientEmail.toLowerCase().trim() : '',
      extraPrice: typeof data.extraPrice === 'number' ? data.extraPrice : Number(data.extraPrice || 0),
      creditsUsed: typeof data.creditsUsed === 'number' ? data.creditsUsed : 0,
      creditsTotal: typeof data.creditsTotal === 'number' ? data.creditsTotal : (data.includedItems ?? 15),
      includedItems: typeof data.includedItems === 'number' ? data.includedItems : (data.creditsTotal ?? 15),
      serviceCatalogId: data.serviceCatalogId || '',
      serviceCatalogName: data.serviceCatalogName || '',
      packageId: data.packageId || '',
      packageName: data.packageName || '',
      selectionUnit: data.selectionUnit || '',
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
