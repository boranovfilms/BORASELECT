import { create } from 'zustand';

interface ProjectStore {
  currentProjectName: string | null;
  currentProjectEmail: string | null;
  setProjectInfo: (name: string | null, email: string | null) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  currentProjectName: null,
  currentProjectEmail: null,
  setProjectInfo: (name, email) => set({ currentProjectName: name, currentProjectEmail: email }),
}));
