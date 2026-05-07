import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface GlobalSettings {
  watermarkUrl?: string;
  updatedAt?: any;
}

const SETTINGS_DOC_ID = 'global_settings';

export const settingsService = {
  getSettings: async (): Promise<GlobalSettings | null> => {
    try {
      const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as GlobalSettings;
      }
      return null;
    } catch (error) {
      console.error('Error fetching global settings:', error);
      return null;
    }
  },

  updateSettings: async (settings: Partial<GlobalSettings>): Promise<void> => {
    try {
      const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
      await setDoc(docRef, {
        ...settings,
        updatedAt: new Date()
      }, { merge: true });
    } catch (error) {
      console.error('Error updating global settings:', error);
      throw error;
    }
  }
};
