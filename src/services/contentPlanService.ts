import { collection, query, where, getDocs, addDoc, updateDoc, doc, arrayUnion, serverTimestamp, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type ContentPlanStatus = 'rascunho' | 'aguardando_cliente' | 'aguardando_validacao_equipe' | 'aprovado' | 'devolvido';

export interface ContentPlanHistory {
  userId: string;
  userName: string;
  userEmail: string;
  date: string;
  textBefore: string;
  textAfter: string;
  action: 'edicao' | 'aprovacao' | 'rejeicao' | 'validacao';
}

export interface PostApproval {
  userId: string;
  userName: string;
  userEmail: string;
  action: 'aprovado' | 'reprovado' | 'editado';
  comment?: string;
  textBefore?: string;
  textAfter?: string;
  date: string;
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
  roteiro?: string;
  strategicFunction?: string;
  status: 'pendente' | 'aprovado' | 'reprovado' | 'em_revisao';
  approvals: PostApproval[];
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
  validations: string[]; // Emails dos membros que já validaram
  rejectionReason?: string;
  createdAt: any;
  updatedAt: any;
}

export function parsePostsFromText(text: string): ContentPost[] {
  const posts: ContentPost[] = [];
  
  // Detecta blocos que começam com CONTEÚDO N
  const blocks = text.split(/(?=📅\s*\*?\*?CONTEÚDO\s+\d+)/i);
  
  blocks.forEach((block, index) => {
    if (!block.trim()) return;
    
    // Extrai número e tipo e data
    const headerMatch = block.match(/CONTEÚDO\s+(\d+)\s*[—-]\s*([A-Z]+)\s*[|]\s*(\d{2}\/\d{2}\/\d{4})/i);
    if (!headerMatch) return;
    
    const number = parseInt(headerMatch[1]);
    const rawType = headerMatch[2].toUpperCase().trim();
    const publishDate = headerMatch[3];
    
    // Normaliza o tipo
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
    
    // Extrai headline
    const headlineMatch = block.match(/(?:Headline|Tema do Reel)\s*\n\s*(.+)/i);
    const headline = headlineMatch ? headlineMatch[1].trim().replace(/\*/g, '') : '';
    
    // Extrai legenda
    const captionMatch = block.match(/Legenda[:\s]*\n([\s\S]*?)(?=\n🎯|\n\*\*CTA|\nCTA|\n\*\*Hashtags|\nHashtags|$)/i);
    const caption = captionMatch ? captionMatch[1].trim().replace(/\*/g, '') : '';
    
    // Extrai CTA
    const ctaMatch = block.match(/CTA\s*\n\s*(.+)/i);
    const cta = ctaMatch ? ctaMatch[1].trim().replace(/\*/g, '') : '';
    
    // Extrai hashtags
    const hashtagsMatch = block.match(/Hashtags\s*\n\s*(.+)/i);
    const hashtags = hashtagsMatch ? hashtagsMatch[1].trim().replace(/\*/g, '') : '';
    
    // Extrai roteiro (para Reels)
    const roteiroMatch = block.match(/Roteiro[^:]*:\s*\n([\s\S]*?)(?=\n✍️|\nLegenda|$)/i);
    const roteiro = roteiroMatch ? roteiroMatch[1].trim().replace(/\*/g, '') : undefined;
    
    // Extrai função estratégica
    const funcaoMatch = block.match(/Função estratégica\s*\n\s*(.+)/i);
    const strategicFunction = funcaoMatch ? funcaoMatch[1].trim().replace(/\*/g, '') : undefined;
    
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
      status: 'pendente',
      approvals: []
    });
  });
  
  return posts.sort((a, b) => a.number - b.number);
}

export const contentPlanService = {
  // Criar novo planejamento
  async createPlan(data: Partial<ContentPlan>) {
    const docRef = await addDoc(collection(db, 'content_plans'), {
      clientId: data.clientId,
      name: data.name,
      monthReference: data.monthReference || '',
      currentText: data.currentText || '',
      posts: data.posts || [],
      status: data.status || 'rascunho',
      history: [],
      validations: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  },

  // Listar planejamentos de um cliente
  async getPlansByClient(clientId: string) {
    const q = query(collection(db, 'content_plans'), where('clientId', '==', clientId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContentPlan));
  },

  // Buscar planejamentos pelo email do cliente (Segurança)
  async getPlansByClientEmail(email: string) {
    const qClient = query(collection(db, 'clients'), where('email', '==', email.toLowerCase().trim()));
    const clientSnap = await getDocs(qClient);
    if (clientSnap.empty) return [];
    const clientId = clientSnap.docs[0].id;
    return this.getPlansByClient(clientId);
  },

  // Buscar um planejamento específico
  async getPlanById(planId: string) {
    const docRef = doc(db, 'content_plans', planId);
    const snap = await getDoc(docRef);
    return snap.exists() ? { id: snap.id, ...snap.data() } as ContentPlan : null;
  },

  // Atualizar status de um post individual
  async updatePostStatus(
    planId: string, 
    postId: string, 
    action: 'aprovado' | 'reprovado' | 'editado',
    currentUser: any,
    comment?: string,
    newCaption?: string
  ) {
    const planRef = doc(db, 'content_plans', planId);
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
        comment,
        textBefore: action === 'editado' ? post.caption : undefined,
        textAfter: action === 'editado' ? newCaption : undefined,
        date: new Date().toISOString()
      };
      
      return {
        ...post,
        caption: action === 'editado' && newCaption ? newCaption : post.caption,
        status: action === 'editado' ? 'em_revisao' : action,
        approvals: [...(post.approvals || []), approval]
      };
    });
    
    // Verifica se todos os posts foram aprovados
    const allApproved = updatedPosts.every(p => p.status === 'aprovado');
    
    await updateDoc(planRef, {
      posts: updatedPosts,
      status: allApproved ? 'aprovado' : planData.status,
      updatedAt: serverTimestamp()
    });
    
    return allApproved;
  },

  // Atualizar texto com registro de histórico automático
  async updatePlanText(planId: string, newText: string, currentUser: any) {
    const planRef = doc(db, 'content_plans', planId);
    const planSnap = await getDoc(planRef);
    if (!planSnap.exists()) throw new Error('Planejamento não encontrado');
    const planData = planSnap.data() as ContentPlan;
    const oldText = planData.currentText;

    if (oldText !== newText) {
      const posts = parsePostsFromText(newText);
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
        posts,
        history: arrayUnion(historyItem),
        updatedAt: serverTimestamp()
      });
    }
  },

  // Atualizar status e disparar fluxos
  async updateStatus(planId: string, newStatus: ContentPlanStatus, reason?: string) {
    const planRef = doc(db, 'content_plans', planId);
    await updateDoc(planRef, {
      status: newStatus,
      rejectionReason: reason || '',
      updatedAt: serverTimestamp()
    });
  },

  // Validar como membro da equipe
  async validateByMember(planId: string, userEmail: string) {
    const planRef = doc(db, 'content_plans', planId);
    const planSnap = await getDoc(planRef);
    const planData = planSnap.data() as ContentPlan;
    if (!planData.validations.includes(userEmail)) {
      await updateDoc(planRef, {
        validations: arrayUnion(userEmail),
        updatedAt: serverTimestamp()
      });
    }
  },

  // Excluir planejamento
  async deletePlan(id: string) {
    await deleteDoc(doc(db, 'content_plans', id));
  }
};
