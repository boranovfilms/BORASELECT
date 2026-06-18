import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type PermissionsMatrix = Record<string, Record<string, boolean>>;

// Estas são as permissões padrão caso não exista nada salvo no banco aindaa
const DEFAULT_PERMISSIONS: PermissionsMatrix = {
  dashboard: { master: true, editor: true, designer: true, cliente: true, equipe: true },
  projetos: { master: true, editor: true, designer: true, cliente: true, equipe: true },
  clientes: { master: true, editor: false, designer: false, cliente: false, equipe: false },
  pacotes: { master: true, editor: false, designer: false, cliente: false, equipe: false },
  modelos: { master: true, editor: true, designer: true, cliente: false, equipe: false },
  creditos: { master: true, editor: false, designer: false, cliente: false, equipe: false },
  configuracoes: { master: true, editor: false, designer: false, cliente: false, equipe: false },
  painel_master: { master: true, editor: false, designer: false, cliente: false, equipe: false },
  tarefas: { master: true, editor: true, designer: true, cliente: false, equipe: false },
  minhas_demandas: {
    master: true,
    admin: true,
    redator: true,
    editor: true,
    designer: true,
    midia_social: true,
    cliente: true,
    equipe: true,
  },
};

export const permissionsService = {
  getPermissions: async (): Promise<PermissionsMatrix> => {
    try {
      const docRef = doc(db, 'settings', 'permissions');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const dbPerms = docSnap.data() as PermissionsMatrix;
        
        // Injeta automaticamente módulos do DEFAULT_PERMISSIONS que não estão no banco
        Object.keys(DEFAULT_PERMISSIONS).forEach(key => {
          if (!dbPerms[key]) {
            dbPerms[key] = DEFAULT_PERMISSIONS[key];
          }
        });
        
        return dbPerms;
      }
      return DEFAULT_PERMISSIONS;
    } catch (error) {
      console.error('Erro ao buscar permissões:', error);
      return DEFAULT_PERMISSIONS;
    }
  },

  savePermissions: async (permissions: PermissionsMatrix): Promise<void> => {
    try {
      const docRef = doc(db, 'settings', 'permissions');
      await setDoc(docRef, permissions);
    } catch (error) {
      console.error('Erro ao salvar permissões:', error);
      throw error;
    }
  }
};
