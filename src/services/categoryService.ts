import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export interface Category {
  id?: string;
  name: string;
  ownerId: string;
}

export const categoryService = {
  getCategories: async () => {
    if (!auth.currentUser) return [];
    const q = query(
      collection(db, 'categories'),
      where('ownerId', '==', auth.currentUser.uid)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
  },

  createCategory: async (name: string) => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    return await addDoc(collection(db, 'categories'), {
      name,
      ownerId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
    });
  }
};
