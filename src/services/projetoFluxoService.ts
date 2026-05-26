import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { WorkflowModel } from './modelosService';

export type ProjectStageStatus = 'pending' | 'in_progress' | 'waiting_approval' | 'completed';

export interface ProjectStage {
  id: string;
  originalStageId: string;
  name: string;
  description: string;
  assignee: string; // Responsável personalizado para este projeto
  durationDays: number; // Prazo personalizado para este projeto
  requiresClientApproval: boolean;
  status: ProjectStageStatus;
  startedAt?: string; // Usando string (ISO) para evitar bugs de array no Firestore
  completedAt?: string;
  notes?: string;
}

export interface ProjectWorkflow {
  id: string; // ID do projeto
  projectId: string;
  modelId: string;
  modelName: string;
  currentStageIndex: number;
  stages: ProjectStage[];
  status: 'active' | 'completed' | 'on_hold';
  startedAt: any;
  updatedAt: any;
}

export const projetoFluxoService = {
  getProjectWorkflow: async (projectId: string): Promise<ProjectWorkflow | null> => {
    const docRef = doc(db, 'projectWorkflows', projectId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as ProjectWorkflow;
    }
    return null;
  },

  initializeWorkflow: async (projectId: string, model: WorkflowModel, customizedStages: ProjectStage[]) => {
    const docRef = doc(db, 'projectWorkflows', projectId);
    const newWorkflow: Omit<ProjectWorkflow, 'id'> = {
      projectId,
      modelId: model.id,
      modelName: model.name,
      currentStageIndex: 0,
      stages: customizedStages,
      status: 'active',
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(docRef, newWorkflow);
    return { id: projectId, ...newWorkflow } as ProjectWorkflow;
  },

  updateWorkflow: async (projectId: string, updates: Partial<ProjectWorkflow>) => {
    const docRef = doc(db, 'projectWorkflows', projectId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  }
};
