import { collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export interface MediaItem {
  id?: string;
  externalId?: string;
  name?: string;
  url: string;
  thumbnailUrl: string;
  type: 'image' | 'video';
  isSelected: boolean;
  isDownloaded?: boolean;
  downloadedAt?: any;
  downloadCount?: number;
  projectId: string;
  uploadedAt: any;
}

export const mediaService = {
  getMedia: async (projectId: string) => {
    const q = query(
      collection(db, 'projects', projectId, 'media'),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MediaItem));
  },

  addMedia: async (projectId: string, data: Partial<MediaItem>) => {
    return await addDoc(collection(db, 'projects', projectId, 'media'), {
      ...data,
      projectId,
      uploadedAt: serverTimestamp(),
    });
  },

  deleteMedia: async (projectId: string, mediaId: string) => {
    const docRef = doc(db, 'projects', projectId, 'media', mediaId);
    return await deleteDoc(docRef);
  },

  updateMedia: async (projectId: string, mediaId: string, data: Partial<MediaItem>) => {
    const docRef = doc(db, 'projects', projectId, 'media', mediaId);
    return await updateDoc(docRef, data as any);
  },

  markAsDownloaded: async (projectId: string, mediaId: string) => {
    const docRef = doc(db, 'projects', projectId, 'media', mediaId);
    const snapshot = await getDocs(query(collection(db, 'projects', projectId, 'media')));
    const mediaDoc = snapshot.docs.find(d => d.id === mediaId);
    const currentCount = mediaDoc?.data()?.downloadCount || 0;
    
    return await updateDoc(docRef, {
      isDownloaded: true,
      downloadedAt: serverTimestamp(),
      downloadCount: currentCount + 1
    });
  }
};
