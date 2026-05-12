import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type ServiceStatus = 'Ativo' | 'Inativo';
export type SelectionUnit = 'cortes' | 'videos' | 'fotos' | 'arquivos';

export interface ServicePackageConfig {
  id: string;
  name: string;
  price: number;
  includedSelections: number;
  additionalItemPrice: number;
  description: string;
  items: string[];
  status: ServiceStatus;
  createdAt?: any;
  updatedAt?: any;
}

export interface ServiceCatalog {
  id: string;
  name: string;
  category: string;
  selectionUnit: SelectionUnit;
  status: ServiceStatus;
  description: string;
  internalNotes: string;
  packages: ServicePackageConfig[];
  createdAt?: any;
  updatedAt?: any;
}

export interface GlobalSettings {
  watermarkUrl?: string;
  serviceCatalogs?: ServiceCatalog[];
  updatedAt?: any;
}

const SETTINGS_DOC_ID = 'global_settings';

const normalizePackage = (pkg: any): ServicePackageConfig => ({
  id: String(pkg?.id || ''),
  name: String(pkg?.name || ''),
  price: Number(pkg?.price || 0),
  includedSelections: Number(pkg?.includedSelections || 0),
  additionalItemPrice: Number(pkg?.additionalItemPrice || 0),
  description: String(pkg?.description || ''),
  items: Array.isArray(pkg?.items) ? pkg.items.map((item: any) => String(item)) : [],
  status: pkg?.status === 'Inativo' ? 'Inativo' : 'Ativo',
  createdAt: pkg?.createdAt || null,
  updatedAt: pkg?.updatedAt || null,
});

const normalizeServiceCatalog = (service: any): ServiceCatalog => ({
  id: String(service?.id || ''),
  name: String(service?.name || ''),
  category: String(service?.category || ''),
  selectionUnit: (service?.selectionUnit || 'cortes') as SelectionUnit,
  status: service?.status === 'Inativo' ? 'Inativo' : 'Ativo',
  description: String(service?.description || ''),
  internalNotes: String(service?.internalNotes || ''),
  packages: Array.isArray(service?.packages) ? service.packages.map(normalizePackage) : [],
  createdAt: service?.createdAt || null,
  updatedAt: service?.updatedAt || null,
});

export const settingsService = {
  getSettings: async (): Promise<GlobalSettings> => {
    try {
      const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return {
          watermarkUrl: '',
          serviceCatalogs: [],
        };
      }

      const data = docSnap.data();

      return {
        watermarkUrl: data?.watermarkUrl || '',
        serviceCatalogs: Array.isArray(data?.serviceCatalogs)
          ? data.serviceCatalogs.map(normalizeServiceCatalog)
          : [],
        updatedAt: data?.updatedAt || null,
      };
    } catch (error) {
      console.error('Error fetching global settings:', error);
      return {
        watermarkUrl: '',
        serviceCatalogs: [],
      };
    }
  },

  updateSettings: async (settings: Partial<GlobalSettings>): Promise<void> => {
    try {
      const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
      await setDoc(
        docRef,
        {
          ...settings,
          updatedAt: new Date(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error('Error updating global settings:', error);
      throw error;
    }
  },

  getServiceCatalogs: async (): Promise<ServiceCatalog[]> => {
    const settings = await settingsService.getSettings();
    return (settings.serviceCatalogs || []).sort((a, b) => a.name.localeCompare(b.name));
  },

  saveServiceCatalogs: async (serviceCatalogs: ServiceCatalog[]): Promise<void> => {
    await settingsService.updateSettings({
      serviceCatalogs: serviceCatalogs.map(normalizeServiceCatalog),
    });
  },

  upsertServiceCatalog: async (serviceCatalog: ServiceCatalog): Promise<void> => {
    const current = await settingsService.getServiceCatalogs();
    const exists = current.some((item) => item.id === serviceCatalog.id);

    const next = exists
      ? current.map((item) => (item.id === serviceCatalog.id ? normalizeServiceCatalog(serviceCatalog) : item))
      : [...current, normalizeServiceCatalog(serviceCatalog)];

    await settingsService.saveServiceCatalogs(next);
  },

  deleteServiceCatalog: async (serviceId: string): Promise<void> => {
    const current = await settingsService.getServiceCatalogs();
    const next = current.filter((item) => item.id !== serviceId);
    await settingsService.saveServiceCatalogs(next);
  },
};
