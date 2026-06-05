import { collection, query, where, getDocs, addDoc, updateDoc, doc, arrayUnion, serverTimestamp, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type ContentPlanStatus = 'rascunho' | 'aguardando_cliente' | 'aguardando_validacao_equipe' | 'aprovado' | 'aprovado_equipe' | 'devolvido';

export interface ContentPlanHistory {
  userId: string;
  userName: string;
  userEmail: string;
  date: string;
  textBefore: string;
  textAfter: string;
  action: 'edicao' | 'aprovacao' | 'rejeicao' | 'validacao' | 'editado_equipe';
}

export interface PostApproval {
  userId: string;
  userName: string;
  userEmail: string;
  action: 'aprovado' | 'reprovado' | 'editado' | 'editado_equipe' | 'validado_equipe' | 'editado_redator' | 'descartado';
  comment: string | null;
  textBefore: string | null;
  textAfter: string | null;
  date: string;
}

export interface SlideData {
  title: string;
  description: string;
}

export interface ContentPost {
  id: string;
  number: number;
  type: 'FEED' | 'REEL' | 'STORIES' | 'CARROSSEL' | 'VIDEO';
  publishDate: string;
  headline: string;
  caption: string;
  cta: string;
  hashtags: string;
  roteiro: string | null;
  strategicFunction: string | null;
  status: 'pendente' | 'aprovado' | 'reprovado' | 'em_revisao' | 'descartado' | 'validado_equipe';
  approvals: PostApproval[];
  tasks?: MicroTask[];
  fase?: string;
  slides?: SlideData[] | null;
}

export type TaskDept = 'video' | 'design' | 'redacao' | 'midia_social';

export interface MicroTask {
  id: string;
  dept: TaskDept;
  deptLabel: string;
  responsibleEmail: string;
  responsibleName: string;
  tags: string[];
  description: string;
  status: 'pendente' | 'em_andamento' | 'concluido';
  dependsOn: TaskDept | null;
  createdAt: string;
}

export interface ContentPlan {
  id?: string;
  clientId: string;
  name: string;
  monthReference: string;
  currentText: string;
  posts: ContentPost[];
  status: ContentPlanStatus;
  history: ContentPlanHistory[];
  validations: string[];
  rejectionReason?: string;
  createdAt: any;
  updatedAt: any;
}

export function parsePostsFromText(text: string): ContentPost[] {
  const posts: ContentPost[] = [];
  const blocks = text.split(/(?=(?:📅\s*)?\*?\*?Conteúdo\s+\d+\s*[-—])/i);

  blocks.forEach((block, index) => {
    if (!block.trim()) return;
    const headerMatch = block.match(/Conteúdo\s+(\d+)\s*[-—]\s*(\w+)\s*[|]\s*(\d{2}\/\d{2}\/\d{4})/i);
    if (!headerMatch) return;

    const number = parseInt(headerMatch[1]);
    const rawType = headerMatch[2].toUpperCase().trim();
    const publishDate = headerMatch[3];

    const typeMap: Record<string, ContentPost['type']> = {
      'FEED': 'FEED',
      'REEL': 'REEL',
      'REELS': 'REEL',
      'STORIES': 'STORIES',
      'STORY': 'STORIES',
      'CARROSSEL': 'CARROSSEL',
      'VIDEO': 'VIDEO',
      'VÍDEO': 'VIDEO',
    };
    const type = typeMap[rawType] || 'FEED';

    const headlineMatch = block.match(/(?:Headline|Tema do Reel)[:\s]*\n([\s\S]*?)(?=\n(?:Slide|Legenda|CTA|Hashtags|Conteúdo|\d+[-—])|$)/i);
    const headline = headlineMatch ? headlineMatch[1].trim().replace(/\*/g, '').replace(/\n/g, ' ') : '';

    const captionMatch = block.match(/Legenda[:\s]*\n([\s\S]*?)(?=\n🎯|\n\*\*CTA|\nCTA|\n\*\*Hashtags|\nHashtags|$)/i);
    const caption = captionMatch ? captionMatch[1].trim().replace(/\*/g, '') : '';

    const ctaMatch = block.match(/CTA\s*\n\s*(.+)/i);
    const cta = ctaMatch ? ctaMatch[1].trim().replace(/\*/g, '') : '';

    const hashtagsMatch = block.match(/Hashtags\s*\n\s*(.+)/i);
    const hashtags = hashtagsMatch ? hashtagsMatch[1].trim().replace(/\*/g, '') : '';

    const roteiroMatch = block.match(/Roteiro[^:]*:\s*\n([\s\S]*?)(?=\n✍️|\nLegenda|$)/i);
    const roteiro = roteiroMatch ? roteiroMatch[1].trim().replace(/\*/g, '') : null;

    const funcaoMatch = block.match(/Função estratégica\s*\n\s*(.+)/i);
    const strategicFunction = funcaoMatch ? funcaoMatch[1].trim().replace(/\*/g, '') : null;

    let slides: SlideData[] | undefined = undefined;
    if (type === 'CARROSSEL') {
      slides = [];
      const slideRegex = /Slide\s+(\d+)[-:]\s*(.+?)(?:\n([\s\S]*?))?(?=\nSlide\s+\d+|\nLegenda|\nHashtags|$)/gi;
      let match;
      while ((match = slideRegex.exec(block)) !== null) {
        const slideTitle = match[2]?.trim().replace(/\*/g, '') || '';
        const slideDesc = match[3]?.trim().replace(/\*/g, '') || '';
        slides.push({ title: slideTitle, description: slideDesc });
      }
      if (slides.length === 0) slides = undefined;
    }

    posts.push({
      id: `post_${number}_${Date.now()}_${index}`,
      number,
      type,
      publishDate,
      headline,
      caption,
      cta,
      hashtags,
      roteiro,
      strategicFunction,
      slides: type === 'CARROSSEL' ? slides : null,
      status: 'pendente',
      approvals: []
    });
  });

  return posts.sort((a, b) => a.number - b.number);
}

export const contentPlanService = {

  async createPlan(data: Partial<ContentPlan>) {
    const docRef = await addDoc(collection(db, 'demandas'), {
      clientId: data.clientId,
      name: data.name,
      monthReference: data.monthReference || '',
      currentText: data.currentText || '',
      posts: (data.posts || []).map(post => ({
        id: post.id,
        number: post.number,
        type: post.type,
        publishDate: post.publishDate,
        headline: post.headline,
        caption: post.caption,
        cta: post.cta,
        hashtags: post.hashtags,
        roteiro: post.roteiro || null,
        strategicFunction: post.strategicFunction || null,
        slides: post.slides || null,
        status: post.status,
        approvals: post.approvals || []
      })),
      status: data.status || 'rascunho',
      history: [],
      validations: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  },

  async getPlansByClient(clientId: string) {
    const q = query(collection(db, 'demandas'), where('clientId', '==', clientId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ContentPlan));
  },

  async getPlansByClientEmail(email: string) {
    const qClient = query(
      collection(db, 'clientes'),
      where('email', '==', email.toLowerCase().trim()),
      where('type', '==', 'empresa')
    );
    const clientSnap = await getDocs(qClient);
    if (clientSnap.empty) return [];
    const clientId = clientSnap.docs[0].id;
    return this.getPlansByClient(clientId);
  },

  async getPlanById(planId: string) {
    const docRef = doc(db, 'demandas', planId);
    const snap = await getDoc(docRef);
    return snap.exists() ? { id: snap.id, ...snap.data() } as ContentPlan : null;
  },

  async updatePostStatus(
    planId: string,
    postId: string,
    action: 'aprovado' | 'reprovado' | 'editado' | 'descartado',
    currentUser: any,
    comment?: string,
    newCaption?: string
  ) {
    const planRef = doc(db, 'demandas', planId);
    const planSnap = await getDoc(planRef);
    if (!planSnap.exists()) throw new Error('Planejamento não encontrado');

    const planData = planSnap.data() as ContentPlan;
    const posts = planData.posts || [];

    const updatedPosts = posts.map(post => {
      if (post.id !== postId) return post;
      const approval: PostApproval = {
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email,
        userEmail: currentUser.email,
        action,
        comment: comment || null,
        textBefore: action === 'editado' ? post.caption : null,
        textAfter: action === 'editado' ? (newCaption || null) : null,
        date: new Date().toISOString()
      };
      return {
        ...post,
        caption: action === 'editado' && newCaption ? newCaption : post.caption,
        status: action === 'editado' ? 'em_revisao' : action,
        approvals: [...(post.approvals || []), approval]
      };
    });

    const allApproved = updatedPosts.every(p => p.status === 'aprovado');
    await updateDoc(planRef, {
      posts: updatedPosts,
      status: allApproved ? 'aprovado' : planData.status,
      updatedAt: serverTimestamp()
    });
    return allApproved;
  },

  async updatePostByEquipe(planId: string, postId: string, newCaption: string, currentUser: any) {
    const planRef = doc(db, 'demandas', planId);
    const planSnap = await getDoc(planRef);
    if (!planSnap.exists()) throw new Error('Planejamento não encontrado');

    const planData = planSnap.data() as ContentPlan;
    const updatedPosts = planData.posts.map(post => {
      if (post.id !== postId) return post;
      const approval: PostApproval = {
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email,
        userEmail: currentUser.email,
        action: 'editado_equipe',
        comment: null,
        textBefore: post.caption,
        textAfter: newCaption,
        date: new Date().toISOString()
      };
      return { ...post, caption: newCaption, status: 'validado_equipe', approvals: [...(post.approvals || []), approval] };
    });

    await updateDoc(planRef, { posts: updatedPosts, updatedAt: serverTimestamp() });
  },

  async validatePostByEquipe(planId: string, postId: string, currentUser: any) {
    const planRef = doc(db, 'demandas', planId);
    const planSnap = await getDoc(planRef);
    if (!planSnap.exists()) throw new Error('Planejamento não encontrado');

    const planData = planSnap.data() as ContentPlan;
    const updatedPosts = planData.posts.map(post => {
      if (post.id !== postId) return post;
      const approval: PostApproval = {
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email,
        userEmail: currentUser.email,
        action: 'validado_equipe',
        comment: null,
        textBefore: null,
        textAfter: null,
        date: new Date().toISOString()
      };
      return { ...post, status: 'validado_equipe', approvals: [...(post.approvals || []), approval] };
    });

    await updateDoc(planRef, { posts: updatedPosts, updatedAt: serverTimestamp() });
  },

  async updatePlanText(planId: string, newText: string, currentUser: any) {
    const planRef = doc(db, 'demandas', planId);
    const planSnap = await getDoc(planRef);
    if (!planSnap.exists()) throw new Error('Planejamento não encontrado');
    const planData = planSnap.data() as ContentPlan;
    const oldText = planData.currentText;
    if (oldText !== newText) {
      const newPosts = parsePostsFromText(newText);
      const historyItem: ContentPlanHistory = {
        userId: currentUser.uid,
        userName: currentUser.displayName || 'Usuário',
        userEmail: currentUser.email || '',
        date: new Date().toISOString(),
        textBefore: oldText,
        textAfter: newText,
        action: 'edicao'
      };
      await updateDoc(planRef, {
        currentText: newText,
        posts: newPosts,
        history: arrayUnion(historyItem),
        updatedAt: serverTimestamp()
      });
    }
  },

  async updateStatus(planId: string, newStatus: ContentPlanStatus, reason?: string) {
    const planRef = doc(db, 'demandas', planId);
    await updateDoc(planRef, {
      status: newStatus,
      rejectionReason: reason || '',
      updatedAt: serverTimestamp()
    });
  },

  async deletePlan(id: string) {
    await deleteDoc(doc(db, 'demandas', id));
  },

  async delegatePost(planId: string, postId: string, tasks: MicroTask[]): Promise<void> {
    const planRef = doc(db, 'demandas', planId);
    const planSnap = await getDoc(planRef);
    if (!planSnap.exists()) throw new Error('Planejamento não encontrado');

    const planData = planSnap.data() as ContentPlan;
    const updatedPosts = planData.posts.map(post => {
      if (post.id !== postId) return post;
      return { ...post, tasks, status: 'em_revisao' as const, fase: 'producao' };
    });

    await updateDoc(planRef, { posts: updatedPosts, updatedAt: serverTimestamp() });
  }
};
