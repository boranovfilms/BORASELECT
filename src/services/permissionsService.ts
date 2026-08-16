import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ALL_MODULES } from '../config/modules';

export type PermissionsMatrix = Record<string, Record<string, boolean>>;

const ROLES = [
  'master',
  'admin',
  'redator',
  'editor',
  'designer',
  'midia_social',
  'cliente',
  'equipe'
];

/**
 * Gera permissões padrão a partir da lista central de módulos.
 * Regra: master sempre tem acesso; todos os demais papéis nascem sem acesso.
 * Módulos com `roles` explícito no menu também respeitam essa regra base,
 * pois o AppLayout ainda aplica a restrição `roles` antes da matriz.
 */
const buildDefaultPermissions = (): PermissionsMatrix => {
  const perms: PermissionsMatrix = {};
  ALL_MODULES.forEach(mod => {
    const rolePerms: Record<string, boolean> = {};
    ROLES.forEach(role => {
      rolePerms[role] = role === 'master';
    });
    perms[mod.id] = rolePerms;
  });
  return perms;
};

export const permissionsService = {
  getPermissions: async (): Promise<PermissionsMatrix> => {
    const defaults = buildDefaultPermissions();

    try {
      const docRef = doc(db, 'settings', 'permissions');
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const dbPerms = docSnap.data() as PermissionsMatrix;

        // Preserva tudo o que já existe no Firestore. Apenas adiciona módulos
        // novos que estão no menu mas ainda não foram salvos no banco.
        Object.keys(defaults).forEach(key => {
          if (!dbPerms[key]) {
            dbPerms[key] = defaults[key];
          }
        });

        return dbPerms;
      }

      return defaults;
    } catch (error) {
      console.error('Erro ao buscar permissões:', error);
      return defaults;
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
