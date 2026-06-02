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

export type StageType = 
  | 'upload_arquivos'
  | 'aprovacao_admin'
  | 'aprovacao_cliente'
  | 'aprovacao_equipe_cliente'
  | 'producao'
  | 'selecao'
  | 'revisao'
  | 'programar_postagem'
  | 'concluido';

export type Stage = {
  id: string;
  name: string;
  type: StageType;
  requiresApproval: boolean;
  order: number;
};

export type WorkflowModel = {
  id?: string;
  name: string;
  description: string;
  iconName: string;
  color: string;
  bgColor: string;
  borderColor: string;
  stages: Stage[];
  activeProjects?: number;
  createdAt?: any;
  updatedAt?: any;
};

export type DemandType = 
  | 'planejamento'
  | 'podcast' 
  | 'arte'
  | 'video_institucional'
  | 'video_clipe'
  | 'ensaio_fotografico'
  | 'email_marketing'
  | 'assinatura_email';

export const DEMAND_TYPE_LABELS: Record<DemandType, string> = {
  planejamento: 'Planejamento de Conteúdo',
  podcast: 'Podcast',
  arte: 'Criar Arte',
  video_institucional: 'Vídeo Institucional',
  video_clipe: 'Vídeo Clipe',
  ensaio_fotografico: 'Ensaio Fotográfico',
  email_marketing: 'Criar E-mail',
  assinatura_email: 'Assinatura de E-mail'
};

class ModelosService {
  private collectionName = 'workflowModels';

  async getModelos(): Promise<WorkflowModel[]> {
    const q = query(collection(db, this.collectionName), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as WorkflowModel[];
  }

  async getModelo(id: string): Promise<WorkflowModel | null> {
    const docRef = doc(db, this.collectionName, id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as WorkflowModel;
    }
    return null;
  }

  async criarModelo(data: Omit<WorkflowModel, 'id' | 'createdAt' | 'updatedAt' | 'stages'>): Promise<string> {
    const docRef = await addDoc(collection(db, this.collectionName), {
      ...data,
      stages: [],
      activeProjects: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    return docRef.id;
  }

  async atualizarModelo(id: string, data: Partial<WorkflowModel>): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  }

  async atualizarEtapas(id: string, stages: Stage[]): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await updateDoc(docRef, {
      stages: stages,
      updatedAt: serverTimestamp()
    });
  }

  async deletarModelo(id: string): Promise<void> {
    const docRef = doc(db, this.collectionName, id);
    await deleteDoc(docRef);
  }
}

export const modelosService = new ModelosService();
