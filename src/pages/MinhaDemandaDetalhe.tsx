import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Check, Upload, X, MessageSquare, Clock, User } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { collection, getDocs, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../lib/firebase';
import { notificacaoService } from '../services/notificacaoService';
import { cn } from '../lib/utils';

export default function MinhaDemandaDetalhe() {
  const { planId, postId } = useParams<{ planId: string; postId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [post, setPost] = useState<any>(null);
  const [userTask, setUserTask] = useState<any>(null);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [planNome, setPlanNome] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'video' | null>(null);
  const [driveLink, setDriveLink] = useState('');
  const [savingDrive, setSavingDrive] = useState(false);
  const [driveSalvo, setDriveSalvo] = useState(false);
  const [anotacao, setAnotacao] = useState('');
  const [showAnotacao, setShowAnotacao] = useState(false);
  const [userRole, setUserRole] = useState('cliente');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadData(); }, [postId]);

  // ============================================================
  // CARREGAR DADOS DO POST
  // Busca o post diretamente da coleção posts/
  // Detecta o role do usuário e a task correspondente
  // ============================================================
  const loadData = async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const email = auth.currentUser?.email?.toLowerCase().trim() || '';
      setUserEmail(email);

      // Detecta role do usuário
      let role = 'cliente';
      let name = auth.currentUser?.displayName || '';
      if (email === 'admin@boraselect.com.br') {
        role = 'master'; name = 'Admin';
      } else {
        const qBora = await getDocs(collection(db, 'boraselect'));
        const bora = qBora.docs.find(d => d.data().email?.toLowerCase() === email);
        if (bora) {
          role = bora.data().role || 'redator';
          name = bora.data().name || '';
        } else {
          const qCliente = await getDocs(collection(db, 'clientes'));
          const cliente = qCliente.docs.find(d => d.data().email?.toLowerCase() === email);
          if (cliente) {
            role = cliente.data().role || 'cliente';
            name = cliente.data().name || '';
          }
        }
      }
      setUserRole(role);
      setUserName(name);

      // Busca o post da coleção posts/
      const postDoc = await getDoc(doc(db, 'posts', postId));
      if (!postDoc.exists()) {
        toast.error('Post não encontrado');
        navigate(-1);
        return;
      }
      const postData = { id: postDoc.id, ...postDoc.data() };
      setPost(postData);
      setPlanNome((postData as any).planNome || '');

      // Detecta task do usuário baseado no role
      const isRedMaster = ['master', 'admin', 'redator'].includes(role);
      const tasks = (postData as any).tasks || [];
      let task = null;
      if (isRedMaster) {
        task = tasks.find((t: any) => t.arquivoUrl || t.status === 'arquivo_anexado') || tasks[0] || null;
      } else {
        task = tasks.find((t: any) => t.responsibleEmail?.toLowerCase() === email) || null;
      }
      setUserTask(task || null);

      // Preview do arquivo se existir
      const taskComArquivo = tasks.find((t: any) => t.arquivoUrl);
      if (taskComArquivo?.arquivoUrl) {
        setPreviewUrl(taskComArquivo.arquivoUrl);
        setPreviewType(taskComArquivo.arquivoTipo || 'image');
      }

      if (task?.driveDownloadUrl) setDriveSalvo(true);

      // Busca nome e email do cliente
      const clienteId = (postData as any).clientId;
      if (clienteId) {
        const clienteDoc = await getDoc(doc(db, 'clientes', clienteId));
        if (clienteDoc.exists()) {
          setClientName(clienteDoc.data().name || '');
          setClientEmail(clienteDoc.data().email?.toLowerCase() || '');
        }
      }

    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // REGISTRAR HISTÓRICO
  // Salva ação com nome, email, role, data e observação
  // ============================================================
  const registrarHistorico = async (acao: string, obs?: string) => {
    if (!postId || !post) return;
    const registro = {
      acao,
      quem: userName || userEmail,
      email: userEmail,
      role: userRole,
      obs: obs || null,
      data: new Date().toISOString()
    };
    const historico = post.historico || [];
    await updateDoc(doc(db, 'posts', postId), {
      historico: [...historico, registro],
      updatedAt: serverTimestamp()
    });
  };

  // ============================================================
  // ACEITAR DEMANDA (Editor)
  // Muda status da task para em_andamento
  // ============================================================
  const handleAceitar = async () => {
    if (!postId || !post || !userTask) return;
    setSaving(true);
    try {
      const updatedTasks = (post.tasks || []).map((t: any) =>
        t.id === userTask.id ? { ...t, status: 'em_andamento' } : t
      );
      await updateDoc(doc(db, 'posts', postId), {
        tasks: updatedTasks,
        updatedAt: serverTimestamp()
      });
      await registrarHistorico('Demanda aceita');
      toast.success('Demanda aceita! Mãos à obra!');
      await loadData();
    } catch (error) {
      toast.error('Erro ao aceitar demanda');
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // SELECIONAR ARQUIVO (Editor)
  // Detecta tipo e inicia upload correspondente
  // ============================================================
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) { toast.error('Envie apenas imagens ou vídeos'); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setPreviewType(isVideo ? 'video' : 'image');
    if (isVideo) uploadVideo(file);
    else uploadImage(file);
  };

  // ============================================================
  // UPLOAD DE VÍDEO — Cloudflare Stream
  // ============================================================
  const uploadVideo = async (file: File, isSubstituicao = false) => {
    setUploading(true);
    setUploadProgress(0);
    try {
      const response = await fetch('https://nameless-dust-4193.boranovfilms.workers.dev/api/upload', {
        method: 'GET', headers: { 'Accept': 'application/json' }
      });
      if (!response.ok) throw new Error('Erro ao obter URL de upload');
      const data = await response.json();
      if (!data.success || !data.result?.uploadURL) throw new Error('Worker não retornou URL');
      const { uid, uploadURL } = data.result;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('file', file);
        xhr.open('POST', uploadURL, true);
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) setUploadProgress(Math.round((event.loaded / event.total) * 100));
        };
        xhr.onload = async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const streamUrl = `https://customer-qm5on0nubla4rvdf.cloudflarestream.com/${uid}/watch`;
            const thumbnailUrl = `https://customer-qm5on0nubla4rvdf.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg`;
            await salvarArquivoNaTask(streamUrl, 'video', thumbnailUrl, isSubstituicao);
            setPreviewUrl(streamUrl);
            resolve();
          } else {
            reject(new Error(`Erro Cloudflare: ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Erro de conexão'));
        xhr.send(formData);
      });
      toast.success('Vídeo enviado com sucesso!');
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  // ============================================================
  // UPLOAD DE IMAGEM — Firebase Storage
  // ============================================================
  const uploadImage = async (file: File, isSubstituicao = false) => {
    setUploading(true);
    setUploadProgress(0);
    try {
      const path = `posts/${postId}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, file);
      await new Promise<void>((resolve, reject) => {
        uploadTask.on('state_changed',
          (snapshot) => setUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
          reject,
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            await salvarArquivoNaTask(url, 'image', undefined, isSubstituicao);
            setPreviewUrl(url);
            resolve();
          }
        );
      });
      toast.success('Imagem enviada com sucesso!');
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  // ============================================================
  // SALVAR ARQUIVO NA TASK
  // Atualiza status para arquivo_anexado e notifica redator
  // ============================================================
  const salvarArquivoNaTask = async (url: string, tipo: 'video' | 'image', thumbnailUrl?: string, isSubstituicao = false) => {
    if (!postId || !post || !userTask) return;
    const updatedTasks = (post.tasks || []).map((t: any) =>
      t.id === userTask.id ? {
        ...t,
        status: 'arquivo_anexado',
        arquivoUrl: url,
        arquivoTipo: tipo,
        thumbnailUrl: thumbnailUrl || null,
        arquivoAnterior: isSubstituicao ? t.arquivoUrl : null,
        arquivoEnviadoEm: new Date().toISOString()
      } : t
    );
    await updateDoc(doc(db, 'posts', postId), {
      tasks: updatedTasks,
      updatedAt: serverTimestamp()
    });

    const acao = isSubstituicao ? 'Arquivo substituído (anterior descartado)' : 'Arquivo enviado para revisão';
    await registrarHistorico(acao);

    // Notifica o redator
    await notificacaoService.criar({
      para: 'boranovfilms@gmail.com',
      tipo: 'arquivo_enviado',
      titulo: isSubstituicao ? 'Arquivo Substituído' : 'Arquivo Enviado para Revisão',
      descricao: `Post #${String(post.number).padStart(2, '0')} — ${post.headline?.slice(0, 50)}`,
      planId: post.planId,
      postId,
      visto: false,
      criadoEm: new Date().toISOString()
    });

    await loadData();
  };

  // ============================================================
  // SALVAR LINK DO DRIVE
  // Salva link para download em alta qualidade
  // ============================================================
  const handleSaveDriveLink = async () => {
    if (!postId || !post || !userTask || !driveLink) return;
    setSavingDrive(true);
    try {
      const updatedTasks = (post.tasks || []).map((t: any) =>
        t.id === userTask.id ? { ...t, driveLink, driveDownloadUrl: driveLink } : t
      );
      await updateDoc(doc(db, 'posts', postId), {
        tasks: updatedTasks,
        updatedAt: serverTimestamp()
      });
      await registrarHistorico('Link do Drive salvo');
      toast.success('Link do Drive salvo!');
      setDriveLink('');
      setDriveSalvo(true);
      await loadData();
    } catch (error) {
      toast.error('Erro ao salvar link');
    } finally {
      setSavingDrive(false);
    }
  };

  // ============================================================
  // APROVAR ARQUIVO
  // Redator aprova → vai para cliente (aguardando_aprovacao_cliente)
  // Cliente aprova → concluído
  // ============================================================
  const handleAprovar = async (taskId: string) => {
    if (!postId || !post) return;
    setSaving(true);
    try {
      const isRedMaster = ['master', 'admin', 'redator'].includes(userRole);
      const isClienteEquipeRole = ['cliente', 'equipe'].includes(userRole);

      let novoStatus = 'concluido';

      if (isRedMaster) {
        novoStatus = 'aguardando_aprovacao_cliente';
      }

      const updatedTasks = (post.tasks || []).map((t: any) =>
        t.id === taskId || t.status === 'arquivo_anexado' ? { ...t, status: novoStatus } : t
      );

      const todosConcluidos = updatedTasks.every((t: any) => t.status === 'concluido');

      await updateDoc(doc(db, 'posts', postId), {
        tasks: updatedTasks,
        status: todosConcluidos ? 'concluido' : post.status,
        updatedAt: serverTimestamp()
      });

      await registrarHistorico(
        isRedMaster
          ? 'Arquivo aprovado pelo redator — enviado para cliente'
          : 'Arquivo aprovado pelo cliente'
      );

      // Redator aprova → notifica cliente
      if (isRedMaster && clientEmail) {
        await notificacaoService.criar({
          para: clientEmail,
          tipo: 'arquivo_enviado',
          titulo: 'Conteúdo pronto para aprovação',
          descricao: `Post #${String(post.number).padStart(2, '0')} — ${post.headline?.slice(0, 50)} aguarda sua aprovação`,
          planId: post.planId,
          postId,
          visto: false,
          criadoEm: new Date().toISOString()
        });
      }

      toast.success(isRedMaster ? 'Aprovado! Cliente foi notificado.' : 'Arquivo aprovado!');
      await loadData();
    } catch (error) {
      toast.error('Erro ao aprovar');
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // PEDIR CORREÇÃO
  // Notifica o editor com a anotação do que precisa ser corrigido
  // ============================================================
  const handlePedirCorrecao = async (taskId: string, responsibleEmail: string) => {
    if (!postId || !post) return;
    if (!anotacao.trim()) { toast.error('Descreva o que precisa ser corrigido'); return; }
    setSaving(true);
    try {
      const updatedTasks = (post.tasks || []).map((t: any) =>
        t.id === taskId || t.status === 'arquivo_anexado' ? { ...t, status: 'fazer_correcao' } : t
      );
      await updateDoc(doc(db, 'posts', postId), {
        tasks: updatedTasks,
        updatedAt: serverTimestamp()
      });
      await registrarHistorico('Correção solicitada', anotacao);
      await notificacaoService.criar({
        para: responsibleEmail,
        tipo: 'tarefa_delegada',
        titulo: 'Correção Solicitada',
        descricao: `Post #${String(post.number).padStart(2, '0')} — ${anotacao.slice(0, 60)}`,
        planId: post.planId,
        postId,
        visto: false,
        criadoEm: new Date().toISOString()
      });
      setAnotacao('');
      setShowAnotacao(false);
      toast.success('Correção solicitada!');
      await loadData();
    } catch (error) {
      toast.error('Erro ao solicitar correção');
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // UTILITÁRIOS — estilos e badges
  // ============================================================
  const getTypeStyle = (type: string) => {
    const styles: any = {
      FEED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      REEL: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      STORIES: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      CARROSSEL: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      VIDEO: 'bg-red-500/10 text-red-400 border-red-500/20',
    };
    return styles[type] || 'bg-zinc-800 text-zinc-400 border-zinc-700';
  };

  const getDeptIcon = (dept: string) => {
    const icons: any = { video: '🎬', design: '🎨', redacao: '✍️', midia_social: '📱' };
    return icons[dept] || '•';
  };

  const getTaskStatusBadge = (status: string) => {
    const configs: any = {
      pendente: { label: '⏳ Pendente', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
      em_andamento: { label: '⚡ Em Andamento', class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
      arquivo_anexado: { label: '📎 Arquivo Enviado', class: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
      aguardando_aprovacao_cliente: { label: '👀 Aguard. Cliente', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
      concluido: { label: '✅ Aprovado', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
      fazer_correcao: { label: '🔄 Correção', class: 'bg-red-500/10 text-red-400 border-red-500/20' },
    };
    const config = configs[status] || configs.pendente;
    return <span className={cn('px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest', config.class)}>{config.label}</span>;
  };

  // ============================================================
  // VARIÁVEIS DE CONTROLE DE ROLE
  // ============================================================
  const isEditorDesigner = ['editor', 'designer', 'midia_social'].includes(userRole);
  const isRedatorMaster = ['master', 'admin', 'redator'].includes(userRole);
  const isClienteEquipe = ['cliente', 'equipe'].includes(userRole);
  const allTasks = post?.tasks || [];
  const historico = post?.historico || [];

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
    </div>
  );

  if (!post) return null;

  return (
    <div className="space-y-6 pb-8 text-left">
      {/* ========================================================
          HEADER — título e status da tarefa
      ======================================================== */}
      <header className="space-y-3">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div>
          <p className="text-[#ff5351] text-xs font-black uppercase tracking-[0.2em] mb-2">
            {isEditorDesigner ? 'Sua Tarefa' : isRedatorMaster ? 'Revisão de Arquivo' : 'Aprovação de Conteúdo'} • {clientName}
          </p>
          <h1 className="text-3xl font-black text-white uppercase italic tracking-tight">
            Post #{String(post.number).padStart(2, '0')} — {post.type}
          </h1>
          <p className="text-zinc-500 text-sm mt-1">{planNome}</p>
          <div className="flex items-center gap-2 mt-3">
            {userTask && (
              <span className="px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest bg-[#ff5351]/10 text-[#ff5351] border-[#ff5351]/20">
                {getDeptIcon(userTask.dept)} {userTask.deptLabel}
              </span>
            )}
            {userTask && getTaskStatusBadge(userTask.status)}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">

        {/* ========================================================
            COLUNA ESQUERDA — Conteúdo do post + Histórico
        ======================================================== */}
        <div className="space-y-6">
          <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-widest text-white">Conteúdo do Post</h2>
              <div className="flex items-center gap-3">
                <span className={cn('px-2 py-1 rounded-lg border text-[8px] font-black uppercase tracking-widest', getTypeStyle(post.type))}>
                  {post.type}
                </span>
                <span className="text-zinc-500 text-[10px] font-black uppercase">{post.publishDate}</span>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#ff5351] block mb-2">Headline</span>
                <p className="text-white font-black uppercase text-base leading-tight">{post.headline}</p>
              </div>
              {post.caption && (
                <>
                  <div className="h-px bg-zinc-800" />
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#ff5351] block mb-2">Legenda</span>
                    <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{post.caption}</p>
                  </div>
                </>
              )}
              {post.cta && (
                <>
                  <div className="h-px bg-zinc-800" />
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#ff5351] block mb-2">CTA</span>
                    <div className="bg-[#ff5351]/5 border border-[#ff5351]/15 rounded-xl p-3">
                      <p className="text-[#ff5351] text-sm font-bold">🎯 {post.cta}</p>
                    </div>
                  </div>
                </>
              )}
              {post.hashtags && (
                <>
                  <div className="h-px bg-zinc-800" />
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#ff5351] block mb-2">Hashtags</span>
                    <p className="text-zinc-500 text-xs italic">{post.hashtags}</p>
                  </div>
                </>
              )}
              {post.slides && post.slides.length > 0 && (
                <>
                  <div className="h-px bg-zinc-800" />
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#ff5351] block mb-3">Slides</span>
                    <div className="space-y-2">
                      {post.slides.map((slide: any, i: number) => (
                        <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                          <p className="text-white text-xs font-black uppercase mb-1">Slide {i + 1} — {slide.title}</p>
                          {slide.description && <p className="text-zinc-400 text-xs">{slide.description}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Histórico de ações */}
          {historico.length > 0 && (
            <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden">
              <div className="p-5 border-b border-zinc-800">
                <h2 className="text-xs font-black uppercase tracking-widest text-white">Histórico</h2>
              </div>
              <div className="p-6 space-y-3">
                {historico.map((h: any, i: number) => (
                  <div key={i} className="flex gap-3 p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-[#ff5351]/10 border border-[#ff5351]/20 flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5 text-[#ff5351]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white text-xs font-black uppercase">{h.quem}</span>
                        <span className="text-zinc-600 text-[9px]">•</span>
                        <span className="text-zinc-500 text-[9px] flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(h.data))}
                        </span>
                      </div>
                      <p className="text-zinc-400 text-xs font-bold uppercase">{h.acao}</p>
                      {h.obs && <p className="text-zinc-500 text-xs mt-1 italic">"{h.obs}"</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================
            COLUNA DIREITA — Arquivo, preview e botões de ação
        ======================================================== */}
        <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden flex flex-col">
          <div className="p-5 border-b border-zinc-800">
            <h2 className="text-xs font-black uppercase tracking-widest text-white">
              {isEditorDesigner ? 'Sua Tarefa' : 'Arquivo & Ações'}
            </h2>
          </div>
          <div className="p-6 flex flex-col flex-1 gap-4">

            {/* Info do departamento — visível para editor */}
            {isEditorDesigner && userTask && (
              <div className="flex items-center gap-4 p-4 bg-[#ff5351]/5 border border-[#ff5351]/10 rounded-2xl">
                <span className="text-3xl">{getDeptIcon(userTask.dept)}</span>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Departamento</p>
                  <p className="text-white font-black uppercase text-sm">{userTask.deptLabel}</p>
                </div>
              </div>
            )}

            {isEditorDesigner && userTask?.tags?.length > 0 && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {userTask.tags.map((tag: string) => (
                    <span key={tag} className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-[9px] font-black uppercase tracking-widest text-zinc-400">{tag}</span>
                  ))}
                </div>
              </div>
            )}

            {isEditorDesigner && userTask?.description && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Briefing</p>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                  <p className="text-zinc-300 text-sm leading-relaxed">{userTask.description}</p>
                </div>
              </div>
            )}

            {/* Preview do arquivo — visível para todos */}
            {previewUrl && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Preview</p>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                  {previewType === 'video' ? (
                    <div className="aspect-video">
                      <iframe
                        src={previewUrl.replace('/watch', '') + '/iframe'}
                        className="w-full h-full"
                        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <img src={previewUrl} alt="Preview" className="w-full object-cover max-h-48" />
                  )}
                </div>
              </div>
            )}

            {/* Download em alta qualidade — visível só para Redator/Master */}
            {isRedatorMaster && allTasks.some((t: any) => t.driveDownloadUrl) && (
              <button
                onClick={() => window.open(allTasks.find((t: any) => t.driveDownloadUrl)?.driveDownloadUrl, '_blank')}
                className="w-full h-10 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:brightness-110 transition-all"
              >
                ⬇️ Download Alta Qualidade
              </button>
            )}

            {/* Input de arquivo oculto */}
            <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileSelect} className="hidden" />

            {/* ====================================================
                BOTÕES DE AÇÃO — variam conforme o role e status
            ==================================================== */}
            <div className="mt-auto pt-4 border-t border-zinc-800 space-y-2">

              {/* EDITOR: Aceitar demanda */}
              {isEditorDesigner && userTask?.status === 'pendente' && (
                <button onClick={handleAceitar} disabled={saving}
                  className="w-full h-12 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Aceitar Demanda
                </button>
              )}

              {/* EDITOR: Enviar arquivo + Link Drive */}
              {isEditorDesigner && userTask?.status === 'em_andamento' && (
                <div className="space-y-3">
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                    className="w-full h-12 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploading ? `Enviando ${uploadProgress}%` : '📤 Enviar para Preview'}
                  </button>
                  <div className="space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Link do Drive (alta qualidade)</p>
                    <div className="flex gap-2">
                      <input type="text" value={driveLink} onChange={e => setDriveLink(e.target.value)}
                        placeholder="Cole o link do Google Drive..."
                        className="flex-1 h-10 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-white text-xs focus:border-[#ff5351] outline-none" />
                      <button onClick={handleSaveDriveLink} disabled={!driveLink || savingDrive}
                        className="h-10 px-4 bg-zinc-800 border border-zinc-700 text-white rounded-xl text-[10px] font-black uppercase hover:border-[#ff5351] transition-all disabled:opacity-50">
                        {savingDrive ? <Loader2 className="w-3 h-3 animate-spin" /> : driveSalvo ? '✓' : 'Salvar'}
                      </button>
                    </div>
                    {driveSalvo && (
                      <p className="text-emerald-400 text-[9px] font-black uppercase tracking-widest">✓ Link do Drive salvo</p>
                    )}
                  </div>
                </div>
              )}

              {/* EDITOR: Arquivo enviado aguardando revisão */}
              {isEditorDesigner && userTask?.status === 'arquivo_anexado' && (
                <>
                  <div className="w-full h-10 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2">
                    📎 Aguardando Revisão do Redator
                  </div>
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                    className="w-full h-10 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-xl font-black uppercase tracking-widest text-[10px] hover:text-white transition-all flex items-center justify-center gap-2">
                    <Upload className="w-3 h-3" /> Substituir Arquivo
                  </button>
                </>
              )}

              {/* EDITOR: Correção solicitada */}
              {isEditorDesigner && userTask?.status === 'fazer_correcao' && (
                <>
                  <div className="w-full h-10 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2">
                    🔄 Correção Solicitada
                  </div>
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                    className="w-full h-12 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    <Upload className="w-4 h-4" /> Enviar Novo Arquivo
                  </button>
                </>
              )}

              {/* EDITOR: Aguardando aprovação do cliente */}
              {isEditorDesigner && userTask?.status === 'aguardando_aprovacao_cliente' && (
                <div className="w-full h-10 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2">
                  👀 Aguardando Aprovação do Cliente
                </div>
              )}

              {/* EDITOR: Concluído */}
              {isEditorDesigner && userTask?.status === 'concluido' && (
                <div className="w-full h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" /> Aprovado ✅
                </div>
              )}

              {/* REDATOR/MASTER: Revisar arquivo — Aprovar ou Pedir Correção */}
              {isRedatorMaster && allTasks.some((t: any) => t.status === 'arquivo_anexado') && (
                <>
                  {!showAnotacao ? (
                    <div className="flex gap-2">
                      <button onClick={() => setShowAnotacao(true)}
                        className="flex-1 h-10 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-xl font-black uppercase tracking-widest text-[10px] hover:text-red-400 hover:border-red-500/20 transition-all flex items-center justify-center gap-2">
                        <X className="w-3 h-3" /> Correção
                      </button>
                      <button
                        onClick={() => {
                          const t = allTasks.find((t: any) => t.status === 'arquivo_anexado');
                          if (t) handleAprovar(t.id);
                        }}
                        disabled={saving}
                        className="flex-1 h-10 bg-emerald-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center justify-center gap-2">
                        <Check className="w-3 h-3" /> Aprovar
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <textarea value={anotacao} onChange={e => setAnotacao(e.target.value)} rows={3}
                        placeholder="Descreva o que precisa ser corrigido..."
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white text-xs focus:border-[#ff5351] outline-none resize-none" />
                      <div className="flex gap-2">
                        <button onClick={() => { setShowAnotacao(false); setAnotacao(''); }}
                          className="flex-1 h-10 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-xl font-black uppercase tracking-widest text-[10px]">
                          Cancelar
                        </button>
                        <button
                          onClick={() => {
                            const t = allTasks.find((t: any) => t.status === 'arquivo_anexado');
                            if (t) handlePedirCorrecao(t.id, t.responsibleEmail);
                          }}
                          disabled={saving || !anotacao.trim()}
                          className="flex-1 h-10 bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl font-black uppercase tracking-widest text-[10px] disabled:opacity-50">
                          Enviar
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* REDATOR/MASTER: Aguardando aprovação do cliente */}
              {isRedatorMaster && allTasks.some((t: any) => t.status === 'aguardando_aprovacao_cliente') && (
                <div className="w-full h-10 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2">
                  👀 Aguardando Aprovação do Cliente
                </div>
              )}

              {/* CLIENTE/EQUIPE: Aprovar ou Pedir Correção */}
              {isClienteEquipe && allTasks.some((t: any) => t.status === 'aguardando_aprovacao_cliente') && (
                <>
                  {!showAnotacao ? (
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          const t = allTasks.find((t: any) => t.status === 'aguardando_aprovacao_cliente');
                          if (t) handleAprovar(t.id);
                        }}
                        disabled={saving}
                        className="w-full h-10 bg-emerald-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center justify-center gap-2">
                        <Check className="w-3 h-3" /> Aprovar Conteúdo
                      </button>
                      <button onClick={() => setShowAnotacao(true)}
                        className="w-full h-10 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-xl font-black uppercase tracking-widest text-[10px] hover:text-red-400 hover:border-red-500/20 transition-all flex items-center justify-center gap-2">
                        <MessageSquare className="w-3 h-3" /> Pedir Correção
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <textarea value={anotacao} onChange={e => setAnotacao(e.target.value)} rows={3}
                        placeholder="O que precisa ser corrigido?"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white text-xs focus:border-[#ff5351] outline-none resize-none" />
                      <div className="flex gap-2">
                        <button onClick={() => { setShowAnotacao(false); setAnotacao(''); }}
                          className="flex-1 h-10 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-xl font-black uppercase tracking-widest text-[10px]">
                          Cancelar
                        </button>
                        <button
                          onClick={() => {
                            const t = allTasks.find((t: any) => t.status === 'aguardando_aprovacao_cliente');
                            if (t) handlePedirCorrecao(t.id, t.responsibleEmail);
                          }}
                          disabled={saving || !anotacao.trim()}
                          className="flex-1 h-10 bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl font-black uppercase tracking-widest text-[10px] disabled:opacity-50">
                          Enviar
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Botão de anotação extra para Redator/Master e Cliente/Equipe */}
              {(isRedatorMaster || isClienteEquipe) && !showAnotacao && (
                <button onClick={() => setShowAnotacao(true)}
                  className="w-full h-9 bg-zinc-900 border border-zinc-800 text-zinc-500 rounded-xl font-black uppercase tracking-widest text-[9px] hover:text-white transition-all flex items-center justify-center gap-2">
                  <MessageSquare className="w-3 h-3" /> Fazer Anotação
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
