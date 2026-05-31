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
    const headerMatch = block.match(/CONTEÚDO\s+(\d+)\s*[—-]\\s*([A-Z]+)\s*[|]\s*(\d{2}\/\d{2}\/\d{4})/i);
    if (!headerMatch) return;
    
    const number = parseInt(headerMatch[1]);
    const rawType = headerMatch[2].toUpperCase().trim();
    const publishDate = headerMatch[3];
    
    // Normaliza o tipo
    const typeMap: Record<string, ContentPost['type']> = {\n      'FEED': 'FEED',\n      'REEL': 'REEL',\n      'REELS': 'REEL',\n      'STORIES': 'STORIES',\n      'STORY': 'STORIES',\n      'CARROSSEL': 'CARROSSEL',\n      'VIDEO': 'VIDEO',\n      'VÍDEO': 'VIDEO',\n    };\n    const type = typeMap[rawType] || 'FEED';\n    \n    // Extrai headline\n    const headlineMatch = block.match(/(?:Headline|Tema do Reel)\\s*\\n\\s*(.+)/i);\n    const headline = headlineMatch ? headlineMatch[1].trim().replace(/\\*/g, '') : '';\n    \n    // Extrai legenda\n    const captionMatch = block.match(/Legenda[:\\s]*\\n([\\s\\S]*?)(?=\\n🎯|\\n\\*\\*CTA|\\nCTA|\\n\\*\\*Hashtags|\\nHashtags|$)/i);\n    const caption = captionMatch ? captionMatch[1].trim().replace(/\\*/g, '') : '';\n    \n    // Extrai CTA\n    const ctaMatch = block.match(/CTA\\s*\\n\\s*(.+)/i);\n    const cta = ctaMatch ? ctaMatch[1].trim().replace(/\\*/g, '') : '';\n    \n    // Extrai hashtags\n    const hashtagsMatch = block.match(/Hashtags\\s*\\n\\s*(.+)/i);\n    const hashtags = hashtagsMatch ? hashtagsMatch[1].trim().replace(/\\*/g, '') : '';\n    \n    // Extrai roteiro (para Reels)\n    const roteiroMatch = block.match(/Roteiro[^:]*:\\s*\\n([\\s\\S]*?)(?=\\n✍️|\\nLegenda|$)/i);\n    const roteiro = roteiroMatch ? roteiroMatch[1].trim().replace(/\\*/g, '') : null;\n    \n    // Extrai função estratégica\n    const funcaoMatch = block.match(/Função estratégica\\s*\\n\\s*(.+)/i);\n    const strategicFunction = funcaoMatch ? funcaoMatch[1].trim().replace(/\\*/g, '') : null;\n    \n    posts.push({\n      id: `post_${number}_${Date.now()}_${index}`,\n      number,\n      type,\n      publishDate,\n      headline,\n      caption,\n      cta,\n      hashtags,\n      roteiro,\n      strategicFunction,\n      status: 'pendente',\n      approvals: []\n    });\n  });\n  \n  return posts.sort((a, b) => a.number - b.number);\n}\n\nexport const contentPlanService = {\n  // Criar novo planejamento\n  async createPlan(data: Partial<ContentPlan>) {\n    const docRef = await addDoc(collection(db, 'content_plans'), {\n      clientId: data.clientId,\n      name: data.name,\n      monthReference: data.monthReference || '',\n      currentText: data.currentText || '',\n      posts: (data.posts || []).map(post => ({\n        ...post,\n        roteiro: post.roteiro ?? null,\n        strategicFunction: post.strategicFunction ?? null,\n        comment: (post as any).comment ?? null,\n      })),\n      status: data.status || 'rascunho',\n      history: [],\n      validations: [],\n      createdAt: serverTimestamp(),\n      updatedAt: serverTimestamp()\n    });\n    return docRef.id;\n  },\n\n  // Listar planejamentos de um cliente\n  async getPlansByClient(clientId: string) {\n    const q = query(collection(db, 'content_plans'), where('clientId', '==', clientId));\n    const snapshot = await getDocs(q);\n    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContentPlan));\n  },\n\n  // Buscar planejamentos pelo email do cliente (Segurança)\n  async getPlansByClientEmail(email: string) {\n    const qClient = query(collection(db, 'clients'), where('email', '==', email.toLowerCase().trim()));\n    const clientSnap = await getDocs(qClient);\n    if (clientSnap.empty) return [];\n    const clientId = clientSnap.docs[0].id;\n    return this.getPlansByClient(clientId);\n  },\n\n  // Buscar um planejamento específico\n  async getPlanById(planId: string) {\n    const docRef = doc(db, 'content_plans', planId);\n    const snap = await getDoc(docRef);\n    return snap.exists() ? { id: snap.id, ...snap.data() } as ContentPlan : null;\n  },\n\n  // Atualizar status de um post individual\n  async updatePostStatus(\n    planId: string, \n    postId: string, \n    action: 'aprovado' | 'reprovado' | 'editado',\n    currentUser: any,\n    comment?: string,\n    newCaption?: string\n  ) {\n    const planRef = doc(db, 'content_plans', planId);\n    const planSnap = await getDoc(planRef);\n    if (!planSnap.exists()) throw new Error('Planejamento não encontrado');\n    \n    const planData = planSnap.data() as ContentPlan;\n    const posts = planData.posts || [];\n    \n    const updatedPosts = posts.map(post => {\n      if (post.id !== postId) return post;\n      \n      const approval: PostApproval = {\n        userId: currentUser.uid,\n        userName: currentUser.displayName || currentUser.email,\n        userEmail: currentUser.email,\n        action,\n        comment,\n        textBefore: action === 'editado' ? post.caption : undefined,\n        textAfter: action === 'editado' ? newCaption : undefined,\n        date: new Date().toISOString()\n      };\n      \n      return {\n        ...post,\n        caption: action === 'editado' && newCaption ? newCaption : post.caption,\n        status: action === 'editado' ? 'em_revisao' : action,\n        approvals: [...(post.approvals || []), approval]\n      };\n    });\n    \n    // Verifica se todos os posts foram aprovados\n    const allApproved = updatedPosts.every(p => p.status === 'aprovado');\n    \n    await updateDoc(planRef, {\n      posts: updatedPosts,\n      status: allApproved ? 'aprovado' : planData.status,\n      updatedAt: serverTimestamp()\n    });\n    \n    return allApproved;\n  },\n\n  // Atualizar texto com registro de histórico automático\n  async updatePlanText(planId: string, newText: string, currentUser: any) {\n    const planRef = doc(db, 'content_plans', planId);\n    const planSnap = await getDoc(planRef);\n    if (!planSnap.exists()) throw new Error('Planejamento não encontrado');\n    const planData = planSnap.data() as ContentPlan;\n    const oldText = planData.currentText;\n\n    if (oldText !== newText) {\n      const posts = parsePostsFromText(newText);\n      const historyItem: ContentPlanHistory = {\n        userId: currentUser.uid,\n        userName: currentUser.displayName || 'Usuário',\n        userEmail: currentUser.email || '',\n        date: new Date().toISOString(),\n        textBefore: oldText,\n        textAfter: newText,\n        action: 'edicao'\n      };\n      await updateDoc(planRef, {\n        currentText: newText,\n        posts,\n        history: arrayUnion(historyItem),\n        updatedAt: serverTimestamp()\n      });\n    }\n  },\n\n  // Atualizar status e disparar fluxos\n  async updateStatus(planId: string, newStatus: ContentPlanStatus, reason?: string) {\n    const planRef = doc(db, 'content_plans', planId);\n    await updateDoc(planRef, {\n      status: newStatus,\n      rejectionReason: reason || '',\n      updatedAt: serverTimestamp()\n    });\n  },\n\n  // Validar como membro da equipe\n  async validateByMember(planId: string, userEmail: string) {\n    const planRef = doc(db, 'content_plans', planId);\n    const planSnap = await getDoc(planRef);\n    const planData = planSnap.data() as ContentPlan;\n    if (!planData.validations.includes(userEmail)) {\n      await updateDoc(planRef, {\n        validations: arrayUnion(userEmail),\n        updatedAt: serverTimestamp()\n      });\n    }\n  },\n\n  // Excluir planejamento\n  async deletePlan(id: string) {\n    await deleteDoc(doc(db, 'content_plans', id));\n  }\n};\n