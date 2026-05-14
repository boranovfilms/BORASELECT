import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export type Stage = {
  id: string;
  name: string;
  duration: string;
  assignee: string;
  requiresApproval: boolean;
  isBlocked: boolean;
  order: number;
};

export type WorkflowModel = {
  id?: string;
  name: string;
  description: string;
  iconName: string; // Salvaremos o nome do ícone (ex: 'PlayCircle') como string
  color: string;
  bgColor: string;
  borderColor: string;
  stages: Stage[];
  activeProjects?: number;
  createdAt?: any;
  updatedAt?: any;
};

class ModelosService {
  private collectionName = 'workflowModels';

  // Buscar todos os modelos
  async getModelos(): Promise<WorkflowModel[]> {
    const q = query(collection(db, this.collectionName), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as WorkflowModel[];
  }

  // Buscar um modelo específico pelo ID
  async getModelo(id: string): Promise<WorkflowModel | null> {
    const docRef = doc(db, this.collectionName, id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as WorkflowModel;
    }
    return null;
  }

  // Criar um novo modelo
  async criarModelo(data: Omit<WorkflowModel, 'id' | 'createdAt' | 'updatedAt' | 'stages'>): Promise<string> {
    const docRef = await addDoc(collection(db, this.collectionName), {
      ...data,
      stages: [], // Começa sem etapas
      activeProjects: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    return docRef.id;
  }

  // Atualizar as informações básicas de um modelo
  async atualizarModelo(id: string, data: Partial<WorkflowModel>): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  }

  // Salvar/Atualizar todas as etapas (útil para o drag & drop)
  async atualizarEtapas(id: string, stages: Stage[]): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await updateDoc(docRef, {
      stages: stages,
      updatedAt: serverTimestamp()
    });
  }

  // Deletar um modelo
  async deletarModelo(id: string): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await deleteDoc(docRef);
  }
}

export const modelosService = new ModelosService();
