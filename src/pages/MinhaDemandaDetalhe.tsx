import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Check, Upload } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { collection, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../lib/firebase';
import { contentPlanService } from '../services/contentPlanService';
import { cn } from '../lib/utils';

export default function MinhaDemandaDetalhe() {
  const { planId, postId } = useParams<{ planId: string; postId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [plan, setPlan] = useState<any>(null);
  const [post, setPost] = useState<any>(null);
  const [userTask, setUserTask] = useState<any>(null);
  const [clientName, setClientName] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'video' | null>(null);
  const [driveLink, setDriveLink] = useState('');
  const [savingDrive, setSavingDrive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadData(); }, [planId, postId]);

  const loadData = async () => {
    if (!planId || !postId) return;
    setLoading(true);
    try {
      const email = auth.currentUser?.email?.toLowerCase().trim() || '';
      const planData = await contentPlanService.getPlanById(planId);
      if (!planData) { toast.error('Planejamento não encontrado'); navigate(-1); return; }
      setPlan(planData);

      const postData = planData.posts?.find((p: any) => p.id === postId);
      if (!postData) { toast.error('Post não encontrado'); navigate(-1); return; }
      setPost(postData);

      const task = postData.tasks?.find((t: any) => t.responsibleEmail?.toLowerCase() === email);
      setUserTask(task || null);

      if (task?.arquivoUrl) {
        setPreviewUrl(task.arquivoUrl);
        setPreviewType(task.arquivoTipo || 'image');
      }

      const snap = await getDocs(collection(db, 'clientes'));
      const found = snap.docs.find(d => d.id === planData.clientId);
      if (found) setClientName(found.data().name || '');

    } catch (error) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleAceitar = async () => {
    if (!planId || !plan || !post || !userTask) return;
    setSaving(true);
    try {
      const updatedPosts = plan.posts.map((p: any) => {
        if (p.id !== post.id) return p;
        return {
          ...p,
          tasks: p.tasks.map((t: any) =>
            t.id === userTask.id ? { ...t, status: 'em_andamento' } : t
          )
        };
      });
      await updateDoc(doc(db, 'demandas', planId), { posts: updatedPosts, updatedAt: serverTimestamp() });
      toast.success('Demanda aceita! Mãos à obra!');
      await loadData();
    } catch (error) {
      toast.error('Erro ao aceitar demanda');
    } finally {
      setSaving(false);
    }
  };

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

  const uploadVideo = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    try {
      const response = await fetch('https://nameless-dust-4193.boranovfilms.workers.dev/api/upload', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
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
          if (event.lengthComputable) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        };
        xhr.onload = async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const streamUrl = `https://customer-qm5on0nubla4rvdf.cloudflarestream.com/${uid}/watch`;
            const thumbnailUrl = `https://customer-qm5on0nubla4rvdf.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg`;
            await salvarArquivoNaTask(streamUrl, 'video', thumbnailUrl);
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

  const uploadImage = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    try {
      const path = `demandas/${planId}/${postId}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, file);
      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            setUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
          },
          reject,
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            await salvarArquivoNaTask(url, 'image');
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

  const salvarArquivoNaTask = async (url: string, tipo: 'video' | 'image', thumbnailUrl?: string) => {
    if (!planId || !plan || !post || !userTask) return;
    const updatedPosts = plan.posts.map((p: any) => {
      if (p.id !== post.id) return p;
      return {
        ...p,
        tasks: p.tasks.map((t: any) =>
          t.id === userTask.id ? {
            ...t,
            status: 'arquivo_anexado',
            arquivoUrl: url,
            arquivoTipo: tipo,
            thumbnailUrl: thumbnailUrl || null,
            arquivoEnviadoEm: new Date().toISOString()
          } : t
        )
      };
    });
    await updateDoc(doc(db, 'demandas', planId), { posts: updatedPosts, updatedAt: serverTimestamp() });
    await loadData();
  };

  const handleSaveDriveLink = async () => {
    if (!planId || !plan || !post || !userTask || !driveLink) return;
    setSavingDrive(true);
    try {
      const match = driveLink.match(/[-\w]{25,}/);
      const fileId = match ? match[0] : null;
      const downloadUrl = fileId
        ? `https://drive.google.com/uc?export=download&id=${fileId}`
        : driveLink;

      const updatedPosts = plan.posts.map((p: any) => {
        if (p.id !== post.id) return p;
        return {
          ...p,
          tasks: p.tasks.map((t: any) =>
            t.id === userTask.id ? {
              ...t,
              driveLink: driveLink,
              driveDownloadUrl: downloadUrl,
            } : t
          )
        };
      });

      await updateDoc(doc(db, 'demandas', planId), { posts: updatedPosts, updatedAt: serverTimestamp() });
      toast.success('Link do Drive salvo!');
      setDriveLink('');
      await loadData();
    } catch (error) {
      toast.error('Erro ao salvar link');
    } finally {
      setSavingDrive(false);
    }
  };

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
      concluido: { label: '✅ Concluído', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
      fazer_correcao: { label: '🔄 Correção', class: 'bg-red-500/10 text-red-400 border-red-500/20' },
    };
    const config = configs[status] || configs.pendente;
    return <span className={cn('px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest', config.class)}>{config.label}</span>;
  };

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
    </div>
  );

  if (!post || !plan) return null;

  return (
    <div className="space-y-6 pb-8 text-left">
      <header className="space-y-3">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div>
          <p className="text-[#ff5351] text-xs font-black uppercase tracking-[0.2em] mb-2">
            Sua Tarefa • {clientName}
          </p>
          <h1 className="text-3xl font-black text-white uppercase italic tracking-tight">
            Post #{String(post.number).padStart(2, '0')} — {post.type}
          </h1>
          <p className="text-zinc-500 text-sm mt-1">{plan.name}</p>
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

        {/* COLUNA ESQUERDA */}
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

        {/* COLUNA DIREITA */}
        <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden flex flex-col">
          <div className="p-5 border-b border-zinc-800">
            <h2 className="text-xs font-black uppercase tracking-widest text-white">Sua Tarefa</h2>
          </div>
          <div className="p-6 flex flex-col flex-1 gap-5">
            {userTask && (
              <>
                <div className="flex items-center gap-4 p-4 bg-[#ff5351]/5 border border-[#ff5351]/10 rounded-2xl">
                  <span className="text-3xl">{getDeptIcon(userTask.dept)}</span>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Departamento</p>
                    <p className="text-white font-black uppercase text-sm">{userTask.deptLabel}</p>
                  </div>
                </div>

                {userTask.tags && userTask.tags.length > 0 && (
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Tags</p>
                    <div className="flex flex-wrap gap-2">
                      {userTask.tags.map((tag: string) => (
                        <span key={tag} className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-[9px] font-black uppercase tracking-widest text-zinc-400">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {userTask.description && (
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Briefing</p>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                      <p className="text-zinc-300 text-sm leading-relaxed">{userTask.description}</p>
                    </div>
                  </div>
                )}

                {/* Preview */}
                {previewUrl && (
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                      {uploading ? `Enviando... ${uploadProgress}%` : 'Arquivo Enviado'}
                    </p>
                    <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                      {previewType === 'video' ? (
                        <div className="relative aspect-video">
                          <iframe
                            src={previewUrl.replace('/watch', '') + '/iframe'}
                            className="w-full h-full"
                            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      ) : (
                        <img src={previewUrl} alt="Preview" className="w-full object-cover rounded-xl max-h-48" />
                      )}
                      {uploading && (
                        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
                          <Loader2 className="w-6 h-6 animate-spin text-[#ff5351]" />
                          <div className="w-32 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-[#ff5351] rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                          </div>
                          <span className="text-white text-xs font-black">{uploadProgress}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Input oculto */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* Botões */}
                <div className="mt-auto pt-4 border-t border-zinc-800 space-y-2">
                  {userTask.status === 'pendente' && (
                    <button
                      onClick={handleAceitar}
                      disabled={saving}
                      className="w-full h-12 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Aceitar Demanda
                    </button>
                  )}

                  {userTask.status === 'em_andamento' && (
                    <div className="space-y-3">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="w-full h-12 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {uploading ? `Enviando ${uploadProgress}%` : '📤 Enviar para Preview'}
                      </button>

                      <div className="space-y-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                          Link do Drive (download em alta qualidade)
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={driveLink}
                            onChange={e => setDriveLink(e.target.value)}
                            placeholder="Cole o link do Google Drive..."
                            className="flex-1 h-10 bg-zinc-900 border border-zinc-800 rounded-xl px-3 text-white text-xs focus:border-[#ff5351] outline-none"
                          />
                          <button
                            onClick={handleSaveDriveLink}
                            disabled={!driveLink || savingDrive}
                            className="h-10 px-4 bg-zinc-800 border border-zinc-700 text-white rounded-xl text-[10px] font-black uppercase hover:border-[#ff5351] transition-all disabled:opacity-50"
                          >
                            {savingDrive ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Salvar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {userTask.status === 'arquivo_anexado' && (
                    <>
                      <div className="w-full h-10 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2">
                        📎 Arquivo Enviado — Aguardando Revisão
                      </div>
                     {userTask.driveDownloadUrl && (
                       <button
                         onClick={() => window.open(userTask.driveDownloadUrl, '_blank')}
                         className="w-full h-10 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:brightness-110 transition-all"
                       >
                         ⬇️ Download Alta Qualidade
                       </button>
                     )}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="w-full h-10 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-xl font-black uppercase tracking-widest text-[10px] hover:text-white transition-all flex items-center justify-center gap-2"
                      >
                        <Upload className="w-3 h-3" /> Substituir Arquivo
                      </button>
                    </>
                  )}

                  {userTask.status === 'concluido' && (
                    <div className="w-full h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2">
                      <Check className="w-4 h-4" /> Concluído
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
