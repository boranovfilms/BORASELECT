import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  ArrowLeft, Check, CheckCircle2, ChevronRight, Clock, 
  UserCircle, Save, Loader2, LayoutTemplate, PlayCircle,
  CloudUpload, Image as ImageIcon, ExternalLink, RefreshCw, Trash2, Lock, Play, RotateCcw, X, FolderOpen, GitBranch, Info, Link as LinkIcon, ChevronDown
} from 'lucide-react';
import { cn } from '../lib/utils';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { modelosService, WorkflowModel } from '../services/modelosService';
import { projetoFluxoService, ProjectWorkflow, ProjectStage, ProjectStageStatus } from '../services/projetoFluxoService';
import { projectService, Project } from '../services/projectService';
import { mediaService, MediaItem } from '../services/mediaService';
import { settingsService } from '../services/settingsService';
import { teamService, TeamMember } from '../services/teamService';

interface UploadProgress {
  id: string;
  file: File;
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
}

// Formatador de Data/Hora
const formatStageDate = (isoString?: string) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

export default function ProjetoFluxo() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [projectData, setProjectData] = useState<any>(null);
  const [workflow, setWorkflow] = useState<ProjectWorkflow | null>(null);
  
  const [availableModels, setAvailableModels] = useState<WorkflowModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<WorkflowModel | null>(null);
  const [setupStages, setSetupStages] = useState<ProjectStage[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isInitializing, setIsInitializing] = useState(false);
  const [stageNotes, setStageNotes] = useState('');

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [fetchingDrive, setFetchingDrive] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const activeRequests = useRef<Record<string, XMLHttpRequest>>({});

  const [mediaLink, setMediaLink] = useState('');
  const [originalDriveLink, setOriginalDriveLink] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [includedItems, setIncludedItems] = useState(15);
  const [extraPrice, setExtraPrice] = useState('45,00');
  const [allowHighRes, setAllowHighRes] = useState(true);
  const [uploads, setUploads] = useState<Record<string, UploadProgress>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [projData, mediaData, existingWorkflow, teamData] = await Promise.all([
        projectService.getProject(projectId),
        mediaService.getMedia(projectId),
        projetoFluxoService.getProjectWorkflow(projectId),
        teamService.getTeamMembers().catch(() => [])
      ]);

      if (projData) {
        setProjectData(projData);
        setMediaLink(projData.driveLink || '');
        setOriginalDriveLink(projData.originalDriveLink || '');
        setClientEmail(projData.clientEmail || '');
        setIncludedItems(projData.includedItems || 15);
        setExtraPrice(projData.extraPrice?.toString().replace('.', ',') || '45,00');
        setAllowHighRes(projData.allowHighRes ?? true);
      }
      setMedia(mediaData);
      setTeamMembers(teamData);

      if (existingWorkflow) {
        setWorkflow(existingWorkflow);
        setStageNotes(existingWorkflow.stages?.[existingWorkflow.currentStageIndex]?.notes || '');
      } else {
        const models = await modelosService.getModelos();
        setAvailableModels(models || []);
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar dados do projeto');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectModel = (model: WorkflowModel) => {
    setSelectedModel(model);
    const stages = model.stages || [];
    const initialStages: ProjectStage[] = stages.map(stage => ({
      id: crypto.randomUUID(),
      originalStageId: stage?.id || crypto.randomUUID(),
      name: stage?.name || 'Etapa sem nome',
      type: stage?.type || 'producao',
      description: stage?.description || '',
      assignee: stage?.assignee || (teamMembers.length > 0 ? teamMembers[0].name : 'Cliente'), 
      durationDays: Number(stage?.durationDays) || 0,
      requiresClientApproval: Boolean(stage?.requiresClientApproval),
      status: 'pending',
    }));
    setSetupStages(initialStages);
  };

  const updateSetupStage = (index: number, field: keyof ProjectStage, value: any) => {
    const newStages = [...setupStages];
    newStages[index] = { ...newStages[index], [field]: value };
    setSetupStages(newStages);
  };

  const handleStartWorkflow = async () => {
    if (!projectId || !selectedModel) return;
    setIsInitializing(true);
    try {
      const stagesToSave = [...setupStages];
      if (stagesToSave.length > 0) {
        stagesToSave[0].status = 'in_progress';
        stagesToSave[0].startedAt = new Date().toISOString();
      }

      const newWorkflow = await projetoFluxoService.initializeWorkflow(projectId, selectedModel, stagesToSave);
      setWorkflow(newWorkflow);
      toast.success('Fluxo iniciado com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao iniciar fluxo');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleUpdateStatus = async (newStatus: ProjectStageStatus) => {
    if (!workflow || !projectId) return;

    const currentStage = workflow.stages[workflow.currentStageIndex];
    const isUploadStage = (currentStage as any).type === 'upload_arquivos' || 
      (!(currentStage as any).type && currentStage.name.toUpperCase().includes('SUBIR CORTES'));

    if (isUploadStage && newStatus === 'completed' && media.length === 0) {
      toast.error('Carregue pelo menos um arquivo antes de concluir a etapa.');
      return;
    }

    const updatedStages = [...workflow.stages];
    const currentIndex = workflow.currentStageIndex;
    updatedStages[currentIndex].status = newStatus;
    
    // Mapear qual campo de data atualizar
    const dateFieldMap: Record<string, string> = {
      pending: 'pendingAt',
      in_progress: 'startedAt',
      waiting_approval: 'waitingApprovalAt',
      completed: 'completedAt'
    };
    const fieldName = dateFieldMap[newStatus];
    if (fieldName) {
      (updatedStages[currentIndex] as any)[fieldName] = new Date().toISOString();
    }

    const newWorkflow = { ...workflow, stages: updatedStages };
    setWorkflow(newWorkflow);
    await projetoFluxoService.updateWorkflow(projectId, { stages: updatedStages });
    toast.success('Status atualizado e data registrada');
  };

  const handleSaveNotes = async () => {
    if (!workflow || !projectId) return;
    const updatedStages = [...workflow.stages];
    updatedStages[workflow.currentStageIndex].notes = stageNotes;

    setWorkflow({ ...workflow, stages: updatedStages });
    await projetoFluxoService.updateWorkflow(projectId, { stages: updatedStages });
    toast.success('Anotações salvas!');
  };

  const handleNextStage = async () => {
    if (!workflow || !projectId) return;
    if (workflow.currentStageIndex >= workflow.stages.length - 1) {
      await projetoFluxoService.updateWorkflow(projectId, { status: 'completed' });
      setWorkflow({ ...workflow, status: 'completed' });
      toast.success('Projeto finalizado com sucesso!');
      return;
    }
    
    const currentIndex = workflow.currentStageIndex;
    const nextIndex = currentIndex + 1;
    const updatedStages = [...workflow.stages];
    
    const currentStage = updatedStages[currentIndex];
    const nextStage = updatedStages[nextIndex];

    const isCurrentUpload = (currentStage as any).type === 'upload_arquivos' || 
      (!(currentStage as any).type && currentStage.name.toUpperCase().includes('SUBIR CORTES'));
      
    const isNextSelecao = (nextStage as any).type === 'selecao' || 
      (!(nextStage as any).type && nextStage.name.toUpperCase().includes('SELEÇÃO'));

    // REGRA 1: Ao finalizar etapa de Upload, o proximo passo (Seleção) fica como Pendente
    if (isCurrentUpload && isNextSelecao) {
      updatedStages[nextIndex].status = 'pending';
      (updatedStages[nextIndex] as any).pendingAt = new Date().toISOString();
    } else {
      updatedStages[nextIndex].status = 'in_progress';
      (updatedStages[nextIndex] as any).startedAt = new Date().toISOString();
    }

    const newWorkflow = { ...workflow, currentStageIndex: nextIndex, stages: updatedStages };
    setWorkflow(newWorkflow);
    setStageNotes(updatedStages[nextIndex].notes || '');
    await projetoFluxoService.updateWorkflow(projectId, { currentStageIndex: nextIndex, stages: updatedStages });
    toast.success('Avançou para a próxima etapa!');
  };

  const handleSaveMediaConfig = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      await projectService.updateProject(projectId, { driveLink: mediaLink, originalDriveLink, clientEmail, creditsTotal: includedItems, includedItems, extraPrice: parseFloat(extraPrice.replace(',', '.')), allowHighRes });
      await loadData();
      toast.success('Configurações do cliente salvas!');
    } catch (error) { toast.error('Erro ao salvar configurações.'); } finally { setSaving(false); }
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files || !projectId) return;
    const newUploads: Record<string, UploadProgress> = {};
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) continue;
      const uploadId = `${Date.now()}-${file.name}-${Math.random().toString(36).substr(2, 9)}`;
      newUploads[uploadId] = { id: uploadId, file, fileName: file.name, progress: 0, status: 'pending' };
    }
    setUploads(prev => ({ ...prev, ...newUploads }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startUpload = async (uploadId: string) => {
    const upload = uploads[uploadId];
    if (!upload || !projectId) return;
    setUploads(prev => ({ ...prev, [uploadId]: { ...prev[uploadId], status: 'uploading', progress: 0 } }));

    try {
      const workerUrl = `https://nameless-dust-4193.boranovfilms.workers.dev/api/upload`;
      const response = await fetch(workerUrl, { method: 'GET', headers: { 'Accept': 'application/json' } });
      if (!response.ok) throw new Error(`Worker Error`);
      const data = await response.json();
      if (!data.success || !data.result?.uploadURL) throw new Error('Worker sem URL');
      const { uid, uploadURL } = data.result;
      const xhr = new XMLHttpRequest();
      activeRequests.current[uploadId] = xhr;
      const formData = new FormData(); formData.append('file', upload.file);
      xhr.open('POST', uploadURL, true);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploads(prev => ({ ...prev, [uploadId]: { ...prev[uploadId], progress: Math.round((e.loaded / e.total) * 100) } })); };
      xhr.onload = async () => {
        delete activeRequests.current[uploadId];
        if (xhr.status >= 200 && xhr.status < 300) {
          const streamUrl = `https://customer-qm5on0nubla4rvdf.cloudflarestream.com/${uid}/watch`;
          const thumbnailUrl = `https://customer-qm5on0nubla4rvdf.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg`;
          await mediaService.addMedia(projectId, { externalId: uid, name: upload.file.name, url: streamUrl, thumbnailUrl, type: 'video', isSelected: false });
          setUploads(prev => ({ ...prev, [uploadId]: { ...prev[uploadId], status: 'completed', progress: 100 } }));
          setTimeout(async () => { const md = await mediaService.getMedia(projectId); setMedia(md); }, 1000);
        } else { toast.error(`Erro Cloudflare`); setUploads(prev => ({ ...prev, [uploadId]: { ...prev[uploadId], status: 'error' } })); }
      };
      xhr.onerror = () => { delete activeRequests.current[uploadId]; setUploads(prev => ({ ...prev, [uploadId]: { ...prev[uploadId], status: 'error' } })); };
      xhr.send(formData);
    } catch (e: any) { setUploads(prev => ({ ...prev, [uploadId]: { ...prev[uploadId], status: 'error' } })); }
  };

  const startAllUploads = () => { Object.keys(uploads).forEach(id => { if (uploads[id].status === 'pending' || uploads[id].status === 'error') startUpload(id); }); };
  const cancelUpload = (uploadId: string) => { if (activeRequests.current[uploadId]) { activeRequests.current[uploadId].abort(); delete activeRequests.current[uploadId]; } setUploads(prev => { const n = { ...prev }; delete n[uploadId]; return n; }); };
  const retryUpload = (id: string) => startUpload(id);
  const clearCompletedUploads = () => { setUploads(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (n[k].status === 'completed') delete n[k]; }); return n; }); };
  const clearAllUploads = () => { Object.keys(activeRequests.current).forEach(id => activeRequests.current[id].abort()); activeRequests.current = {}; setUploads({}); };

  const handleSyncMedia = async () => {
    if (!mediaLink) { toast.error('Insira o link fonte.'); return; }
    setFetchingDrive(true);
    try {
      const response = await fetch('/api-v2/media/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: mediaLink }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (data.files && data.files.length > 0) {
        let added = 0; const existingIds = new Set(media.map(m => m.externalId).filter(Boolean));
        for (const file of data.files) {
          const fileId = file.id || file.uid;
          if (!existingIds.has(fileId)) { await mediaService.addMedia(projectId!, { externalId: fileId, name: file.name, url: file.url, thumbnailUrl: file.thumbnailUrl || file.url, type: file.type, isSelected: false }); added++; }
        }
        if (added > 0) { toast.success(`${added} arquivos novos!`); await loadData(); } else { toast.success('Atualizado.'); }
      } else { toast.error('Nenhum arquivo.'); }
    } catch (e: any) { toast.error('Falha: ' + e.message); } finally { setFetchingDrive(false); }
  };

  const handleClearMedia = async () => {
    if (!window.confirm('Apagar TODO o catálogo?')) return;
    setLoading(true);
    try {
      for (const item of media) if (item.id) await mediaService.deleteMedia(projectId!, item.id);
      setMedia([]); await projectService.updateProject(projectId!, { creditsUsed: 0 }); toast.success('Catálogo limpo.');
    } catch (e) { toast.error('Erro ao limpar.'); } finally { setLoading(false); }
  };

  const getThumbnailUrl = (item: MediaItem) => {
    if (!item.url) return item.thumbnailUrl || '';
    if (item.externalId && item.url.includes('cloudflarestream.com')) return `https://customer-qm5on0nubla4rvdf.cloudflarestream.com/${item.externalId}/thumbnails/thumbnail.jpg`;
    if (item.url.includes('drive.google.com') || (item.url.length > 20 && !item.url.includes('/') && !item.url.includes('.'))) {
      const match = item.url.match(/(?:id=|\/d\/|\/file\/d\/)([a-zA-Z0-9_-]+)/);
      return `https://drive.google.com/thumbnail?id=${match ? match[1] : item.url}&sz=w1000`;
    }
    return item.url;
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" /></div>;

  const currentStage = workflow?.stages[workflow.currentStageIndex];
  const isUploadStage = currentStage && ((currentStage as any).type === 'upload_arquivos' || 
    (!(currentStage as any).type && currentStage.name.toUpperCase().includes('SUBIR CORTES')));

  if (!workflow) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 pb-16">
        <header>
          <div className="flex items-center gap-4 mb-4">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"><ArrowLeft className="w-5 h-5" /></button>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5351] font-black">Setup de Projeto • {projectData?.title || 'Projeto'}</p>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase italic">Vincular Fluxo</h1>
        </header>

        {!selectedModel ? (\n          <div className=\"grid grid-cols-1 md:grid-cols-2 gap-4\">\n            {availableModels.length === 0 ? (\n              <div className=\"col-span-2 p-8 text-center border border-zinc-800 rounded-3xl bg-[#141414]\"><LayoutTemplate className=\"w-12 h-12 text-zinc-700 mx-auto mb-4\" /><p className=\"text-zinc-400 font-medium\">Nenhum modelo cadastrado.</p><button onClick={() => navigate('/modelos')} className=\"mt-4 text-[#ff5351] text-sm font-black uppercase tracking-widest hover:underline\">Ir para Modelos</button></div>\n            ) : (\n              availableModels.map(model => (\n                <button key={model.id} onClick={() => handleSelectModel(model)} className=\"p-6 text-left border border-zinc-800 bg-[#141414] rounded-3xl hover:border-[#ff5351] hover:bg-zinc-900/50 transition-all group\">\n                  <h3 className=\"text-xl font-black text-white uppercase group-hover:text-[#ff5351] transition-colors\">{model.name}</h3><p className=\"text-zinc-500 mt-2 text-sm\">{model.description || 'Sem descrição'}</p><div className=\"mt-6 flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-zinc-600\"><CheckCircle2 className=\"w-4 h-4\" /> {(model.stages || []).length} etapas</div>\n                </button>\n              ))\n            )}\n          </div>\n        ) : (\n          <div className=\"space-y-6\">\n            <div className=\"flex items-center gap-4 py-4 border-b border-zinc-800\"><button onClick={() => setSelectedModel(null)} className=\"text-zinc-500 hover:text-white\"><ArrowLeft className=\"w-5 h-5\"/></button><h2 className=\"text-xl font-black text-white uppercase\">Personalizar: {selectedModel.name}</h2></div>\n            <div className=\"space-y-4\">\n              {setupStages.map((stage, idx) => (\n                <div key={stage.id} className=\"p-5 bg-[#141414] border border-zinc-800 rounded-3xl flex flex-col md:flex-row md:items-center gap-4\">\n                  <div className=\"w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center text-zinc-500 font-black border border-zinc-800 shrink-0\">{idx + 1}</div>\n                  <div className=\"flex-1 min-w-0\"><p className=\"text-white font-black uppercase text-sm truncate\">{stage.name}</p><p className=\"text-zinc-500 text-xs mt-1 truncate\">{stage.description || 'Sem descrição'}</p></div>\n                  \n                  <div className=\"w-full md:w-64 space-y-2 shrink-0\">\n                    <label className=\"text-[10px] uppercase font-black text-[#ff5351] tracking-widest ml-1\">Responsável (Neste Projeto)</label>\n                    <div className=\"relative\">\n                      <select \n                        value={stage.assignee}\n                        onChange={(e) => updateSetupStage(idx, 'assignee', e.target.value)}\n                        className=\"w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs font-bold text-white focus:border-[#ff5351] outline-none appearance-none cursor-pointer\"\n                      >\n                        {teamMembers.map(m => (\n                          <option key={m.id} value={m.name}>{m.name}</option>\n                        ))}\n                      </select>\n                      <ChevronDown className=\"absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none\" />\n                    </div>\n                  </div>\n                </div>\n              ))}\n            </div>\n            <div className=\"flex justify-end pt-4\">\n              <button \n                onClick={handleStartWorkflow}\n                disabled={isInitializing}\n                className=\"px-10 h-14 bg-[#ff5351] text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:brightness-110 transition-all flex items-center gap-3 shadow-xl shadow-[#ff5351]/20\"\n              >\n                {isInitializing ? <Loader2 className=\"w-5 h-5 animate-spin\" /> : <Save className=\"w-5 h-5\" />}\n                Vincular e Iniciar Fluxo\n              </button>\n            </div>\n          </div>\n        )}\n      </div>\n    );\n  }\n\n  return (\n    <div className=\"space-y-8 pb-16\">\n      <header className=\"flex flex-col md:flex-row md:items-start justify-between gap-8\">\n        <div className=\"flex-1 min-w-0\">\n          <div className=\"flex items-center gap-3 mb-3\">\n            <button onClick={() => navigate(-1)} className=\"p-2 hover:bg-zinc-800 rounded-xl transition-all text-zinc-500 hover:text-white\">\n               <ArrowLeft className=\"w-5 h-5\" />\n            </button>\n            <span className=\"px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] font-black uppercase text-[#ff5351] tracking-[0.2em]\">\n              {workflow.modelName}\n            </span>\n          </div>\n          <h1 className=\"text-4xl md:text-5xl font-black text-white uppercase italic tracking-tighter truncate\">\n            {projectData?.title || 'Projeto'}\n          </h1>\n        </div>\n\n        <div className=\"flex flex-col items-end gap-2\">\n          <div className=\"text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-1\">Progresso do Fluxo</div>\n          <div className=\"flex items-center gap-2\">\n            {workflow.stages.map((s, idx) => (\n              <div \n                key={s.id} \n                className={cn(\n                  \"w-8 h-1.5 rounded-full transition-all\",\n                  idx <= workflow.currentStageIndex ? \"bg-[#ff5351]\" : \"bg-zinc-800\"\n                )}\n              />\n            ))}\n          </div>\n          <div className=\"text-[10px] font-bold text-zinc-400 mt-1 uppercase\">\n             Etapa {workflow.currentStageIndex + 1} de {workflow.stages.length}\n          </div>\n        </div>\n      </header>\n\n      <div className=\"grid grid-cols-1 lg:grid-cols-12 gap-8\">\n        <div className=\"lg:col-span-4\">\n          <div className=\"bg-[#1a1a1a] border border-zinc-800 rounded-[32px] p-2 sticky top-8\">\n            <div className=\"space-y-1\">\n              {workflow.stages.map((stage, idx) => {\n                const isActive = idx === workflow.currentStageIndex;\n                const isPast = idx < workflow.currentStageIndex;\n                \n                return (\n                  <div \n                    key={stage.id}\n                    className={cn(\n                      \"flex items-center gap-4 p-4 rounded-3xl transition-all\",\n                      isActive ? \"bg-[#ff5351] shadow-xl shadow-[#ff5351]/20 scale-[1.02]\" : \"hover:bg-zinc-800/50\"\n                    )}\n                  >\n                    <div className={cn(\n                      \"w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 font-black text-sm\",\n                      isActive ? \"bg-white text-[#ff5351]\" : isPast ? \"bg-emerald-500/10 text-emerald-500\" : \"bg-zinc-900 text-zinc-600\"\n                    )}>\n                      {isPast ? <Check className=\"w-5 h-5\" /> : idx + 1}\n                    </div>\n                    <div className=\"flex-1 min-w-0\">\n                      <p className={cn(\n                        \"text-xs font-black uppercase tracking-tight truncate\",\n                        isActive ? \"text-white\" : isPast ? \"text-zinc-300\" : \"text-zinc-600\"\n                      )}>{stage.name}</p>\n                      <p className={cn(\n                        \"text-[9px] font-bold uppercase tracking-widest mt-0.5\",\n                        isActive ? \"text-white/70\" : \"text-zinc-500\"\n                      )}>\n                        {stage.status === 'completed' ? 'Finalizada' : stage.status === 'in_progress' ? 'Em andamento' : stage.status === 'waiting_approval' ? 'Aguard. Cliente' : 'Pendente'}\n                      </p>\n                    </div>\n                  </div>\n                )\n              })}\n            </div>\n          </div>\n        </div>\n\n        <div className=\"lg:col-span-8 space-y-8\">\n          <section className=\"bg-[#1a1a1a] border border-zinc-800 rounded-[40px] p-10 shadow-2xl relative overflow-hidden\">\n            <div className=\"absolute top-0 right-0 p-10 opacity-5\">\n               <LayoutTemplate className=\"w-32 h-32 text-white\" />\n            </div>\n\n            <header className=\"mb-10 relative z-10\">\n              <p className=\"text-[10px] font-black uppercase text-[#ff5351] tracking-[0.3em] mb-3\">Detalhes da Etapa Atual</p>\n              <h2 className=\"text-4xl md:text-5xl font-black text-white uppercase italic tracking-tight\">{currentStage.name}</h2>\n              <div className=\"flex flex-wrap gap-4 mt-6\">\n                <span className=\"px-4 py-2 bg-[#1a1a1a] border border-zinc-800 rounded-full text-xs font-black text-zinc-300 uppercase tracking-widest flex items-center gap-2\"><UserCircle className=\"w-4 h-4 text-[#ff5351]\"/> {currentStage.assignee || 'Não definido'}</span>\n                <span className=\"px-4 py-2 bg-[#1a1a1a] border border-zinc-800 rounded-full text-xs font-black text-zinc-300 uppercase tracking-widest flex items-center gap-2\"><Clock className=\"w-4 h-4 text-[#ff5351]\"/> Prazo: {currentStage.durationDays} dias</span>\n              </div>\n            </header>\n\n            <div className=\"space-y-4\">\n              <h3 className=\"text-sm font-black uppercase text-zinc-500 tracking-widest\">Controle de Status</h3>\n              <div className=\"grid grid-cols-2 md:grid-cols-4 gap-3\">\n                {[\n                  { id: 'pending', label: 'Pendente', color: 'border-zinc-700 text-zinc-500', dateField: 'pendingAt' },\n                  { id: 'in_progress', label: 'Em Andamento', color: 'border-blue-500 text-blue-400', dateField: 'startedAt' },\n                  { id: 'waiting_approval', label: 'Aguard. Cliente', color: 'border-amber-500 text-amber-400', dateField: 'waitingApprovalAt' },\n                  { id: 'completed', label: 'Concluído', color: 'border-emerald-500 text-emerald-400', dateField: 'completedAt' }\n                ].map(status => {\n                  const isActive = currentStage.status === status.id;\n                  const stageDate = (currentStage as any)[status.dateField];\n                  \n                  return (\n                    <button key={status.id} onClick={() => handleUpdateStatus(status.id as ProjectStageStatus)} className={cn(\"px-2 py-3 rounded-2xl border flex flex-col items-center justify-center transition-all\", isActive ? cn(\"bg-[#1a1a1a]\", status.color) : \"bg-[#111] border-zinc-800 text-zinc-600 hover:border-zinc-600\")}>\n                      <span className=\"text-[11px] font-black uppercase tracking-widest text-center\">{status.label}</span>\n                      {stageDate && (\n                         <span className={cn(\"text-[9px] font-mono mt-1 opacity-80\", isActive ? \"text-current\" : \"text-zinc-500\")}>\n                            {formatStageDate(stageDate)}\n                         </span>\n                      )}\n                    </button>\n                  )\n                })}\n              </div>\n\n              {isUploadStage && currentStage.status !== 'completed' && media.length === 0 && (\n                <p className=\"text-[#ff5351] text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 animate-in fade-in mt-3 ml-1\">\n                  <Info className=\"w-3 h-3\" />\n                  Carregue pelo menos um arquivo para poder concluir a etapa\n                </p>\n              )}\n            </div>\n\n            {isUploadStage ? (\n              <div className=\"space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 border-t border-zinc-800\">\n                <div className=\"flex items-center justify-between mb-4\">\n                  <h3 className=\"text-2xl font-black uppercase text-white tracking-tight\">Upload e Configuração de Cliente</h3>\n                  <button onClick={handleSaveMediaConfig} disabled={saving} className=\"px-6 py-3 rounded-xl bg-[#ff5351] text-white font-black uppercase tracking-widest hover:brightness-110 transition-all text-xs shadow-lg shadow-[#ff5351]/20 flex items-center gap-2\">\n                    {saving ? <Loader2 className=\"w-4 h-4 animate-spin\" /> : <Save className=\"w-4 h-4\" />} Salvar Regras\n                  </button>\n                </div>\n\n                <div className=\"grid grid-cols-1 lg:grid-cols-12 gap-8\">\n                  <div className=\"lg:col-span-12 space-y-8\">\n                    <div className=\"bg-[#1a1a1a] border border-zinc-800 rounded-3xl p-6\">\n                      <div className=\"flex justify-between items-center border-b border-zinc-800 pb-4 mb-6\">\n                        <h4 className=\"text-lg font-bold text-white uppercase\">Upload de Mídia</h4>\n                      </div>\n                      \n                      <input type=\"file\" multiple className=\"hidden\" ref={fileInputRef} onChange={(e) => handleFileUpload(e.target.files)} accept=\"image/*,video/*\" />\n                      \n                      <div onClick={() => fileInputRef.current?.click()} onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleFileUpload(e.dataTransfer.files); }} className=\"group py-6 flex flex-col items-center justify-center bg-zinc-900/50 rounded-2xl border-2 border-dashed border-zinc-800 hover:border-[#ff5351]/50 cursor-pointer transition-all\">\n                        <CloudUpload className=\"w-6 h-6 text-zinc-600 mb-2 group-hover:text-[#ff5351]\" />\n                        <p className=\"text-zinc-400 text-[11px] font-bold uppercase tracking-widest\">Arraste arquivos ou clique aqui para buscar</p>\n                      </div>\n\n                      {Object.keys(uploads).length > 0 && (\n                        <div className=\"mt-6 space-y-4 pt-6 border-t border-zinc-800\">\n                          <div className=\"flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4\">\n                            <div className=\"flex items-center gap-3\">\n                              <h5 className=\"text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2\">\n                                <Loader2 className={cn(\"w-3 h-3\", Object.values(uploads).some(u => u.status === 'uploading') && \"animate-spin\")} />\n                                Fila de Arquivos ({Object.keys(uploads).length})\n                              </h5>\n                              \n                              <div className=\"flex items-center gap-2\">\n                                {Object.values(uploads).some(u => u.status === 'completed') && (\n                                  <button onClick={clearCompletedUploads} className=\"text-[10px] uppercase font-black tracking-widest text-emerald-500 hover:text-emerald-400 transition-all border border-emerald-500/30 px-2 py-1 rounded\">Limpar Concluídos</button>\n                                )}\n                                <button onClick={clearAllUploads} className=\"text-[10px] uppercase font-black tracking-widest text-zinc-600 hover:text-red-500 transition-all\">Limpar Fila</button>\n                              </div>\n                            </div>\n\n                            {Object.values(uploads).some(u => u.status === 'pending' || u.status === 'error') && (\n                              <button onClick={startAllUploads} className=\"px-4 py-2 bg-[#ff5351] text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-xl shadow-[#ff5351]/20\">\n                                <Play className=\"w-3 h-3 fill-current\" /> Enviar Todos da Fila\n                              </button>\n                            )}\n                          </div>\n\n                          <div className=\"grid grid-cols-1 md:grid-cols-2 gap-4\">\n                            {Object.entries(uploads).map(([id, upload]) => (\n                              <div key={id} className=\"group/item bg-black/40 rounded-2xl p-4 border border-zinc-800/50 hover:border-[#ff5351]/30 transition-all\">\n                                <div className=\"flex items-center justify-between gap-4 mb-3\">\n                                  <div className=\"flex items-center gap-3 overflow-hidden\">\n                                    <div className={cn(\"w-8 h-8 rounded-lg flex items-center justify-center shrink-0\", upload.status === 'completed' ? \"bg-emerald-500/10 text-emerald-500\" : upload.status === 'error' ? \"bg-red-500/10 text-red-500\" : upload.status === 'uploading' ? \"bg-[#ff5351]/10 text-[#ff5351]\" : \"bg-zinc-800 text-zinc-500\")}>\n                                      {upload.status === 'completed' ? <CheckCircle2 className=\"w-4 h-4\" /> : upload.status === 'error' ? <Info className=\"w-4 h-4\" /> : upload.status === 'uploading' ? <Loader2 className=\"w-4 h-4 animate-spin\" /> : <Clock className=\"w-4 h-4\" />}\n                                    </div>\n                                    <div className=\"overflow-hidden\">\n                                      <p className=\"text-[10px] font-black uppercase tracking-tight text-white truncate\">{upload.fileName}</p>\n                                      <p className=\"text-[8px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5\">{upload.status === 'pending' ? 'Pendente' : upload.status === 'uploading' ? 'Enviando...' : upload.status === 'completed' ? 'Concluído' : 'Erro no envio'}</p>\n                                    </div>\n                                  </div>\n                                  <div className=\"flex items-center gap-1\">\n                                    {upload.status === 'pending' && <button onClick={() => startUpload(id)} className=\"p-1.5 text-zinc-400 hover:text-[#ff5351] hover:bg-[#ff5351]/10 rounded-lg transition-all\" title=\"Iniciar\"><Play className=\"w-3.5 h-3.5 fill-current\" /></button>}\n                                    {upload.status === 'error' && <button onClick={() => retryUpload(id)} className=\"p-1.5 text-zinc-400 hover:text-[#ff5351] hover:bg-[#ff5351]/10 rounded-lg transition-all\" title=\"Tentar novamente\"><RotateCcw className=\"w-3.5 h-3.5\" /></button>}\n                                    <button onClick={() => cancelUpload(id)} className=\"p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all\" title=\"Cancelar\"><X className=\"w-3.5 h-3.5\" /></button>\n                                  </div>\n                                </div>\n                                <div className=\"flex items-center gap-3\">\n                                  <div className=\"flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden\">\n                                    <div className={cn(\"h-full transition-all duration-300 rounded-full\", upload.status === 'completed' ? \"bg-emerald-500\" : upload.status === 'error' ? \"bg-red-500\" : \"bg-[#ff5351]\")} style={{ width: `${upload.progress}%` }} />\n                                  </div>\n                                  <span className=\"text-[8px] font-mono font-bold text-zinc-600 w-6\">{upload.progress}%</span>\n                                </div>\n                              </div>\n                            ))}\n                          </div>\n                        </div>\n                      )}\n                      \n                      <div className=\"mt-6 pt-6 border-t border-zinc-800\">\n                        <button onClick={() => setMediaLink(mediaLink ? '' : ' ')} className=\"text-[10px] uppercase font-black tracking-widest text-zinc-600 hover:text-zinc-400 flex items-center gap-2 transition-all\">\n                          <RefreshCw className=\"w-3 h-3\" /> {mediaLink ? \"Ocultar sincronização manual\" : \"Mostrar sincronização por link (Legacy)\"}\n                        </button>\n                        {mediaLink && (\n                          <div className=\"mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300\">\n                            <div className=\"relative group\">\n                              <LinkIcon className=\"absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-[#ff5351]\" />\n                              <input type=\"text\" value={mediaLink.trim()} onChange={(e) => setMediaLink(e.target.value)} placeholder=\"Link do R2 ou Drive...\" className=\"w-full bg-zinc-900/50 border border-zinc-800 rounded-xl pl-12 pr-12 py-3 text-xs text-white focus:border-[#ff5351] outline-none\" />\n                              <div className=\"absolute right-3 top-1/2 -translate-y-1/2\"><button onClick={handleSyncMedia} disabled={fetchingDrive || !mediaLink.trim()} className=\"p-1.5 bg-zinc-800 text-white rounded hover:bg-[#ff5351] transition-all disabled:opacity-50\"><RefreshCw className={cn(\"w-3 h-3\", fetchingDrive && \"animate-spin\")} /></button></div>\n                            </div>\n                          </div>\n                        )}\n                      </div>\n                    </div>\n\n                    <div className=\"bg-[#1a1a1a] border border-zinc-800 rounded-3xl p-6\">\n                      <h4 className=\"text-lg font-bold text-white uppercase mb-6 border-b border-zinc-800 pb-4\">Regras e Cliente</h4>\n                      <div className=\"grid grid-cols-1 md:grid-cols-2 gap-6\">\n                        <div className=\"space-y-4\">\n                          <div><label className=\"text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1 block\">E-mail do Cliente</label><input type=\"email\" value={clientEmail} onChange={e => setClientEmail(e.target.value)} className=\"w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm\" /></div>\n                          <div><label className=\"text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1 block\">Link Drive (Arquivos Limpos)</label><input type=\"text\" value={originalDriveLink} onChange={e => setOriginalDriveLink(e.target.value)} className=\"w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm\" /></div>\n                        </div>\n                        <div className=\"space-y-4\">\n                           <div className=\"flex gap-4\">\n                             <div className=\"flex-1\"><label className=\"text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1 block\">Qtd Inclusa</label><input type=\"number\" value={includedItems} onChange={e => setIncludedItems(parseInt(e.target.value))} className=\"w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm\" /></div>\n                             <div className=\"flex-1\"><label className=\"text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1 block\">Preço Extra (R$)</label><input type=\"text\" value={extraPrice} onChange={e => setExtraPrice(e.target.value)} className=\"w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm\" /></div>\n                           </div>\n                           <div className=\"pt-2 flex items-center justify-between bg-black/20 p-4 rounded-xl border border-zinc-800\">\n                             <div><p className=\"text-sm text-white font-bold\">Download Alta Res.</p><p className=\"text-[10px] text-zinc-500 uppercase\">Liberar arquivo original</p></div>\n                             <div onClick={() => setAllowHighRes(!allowHighRes)} className={cn(\"w-12 h-7 rounded-full cursor-pointer p-1 transition-all\", allowHighRes ? \"bg-[#ff5351]\" : \"bg-zinc-800\")}><div className={cn(\"w-5 h-5 bg-white rounded-full transition-all\", allowHighRes ? \"translate-x-5\" : \"translate-x-0\")} /></div>\n                           </div>\n                        </div>\n                      </div>\n                    </div>\n\n                    <div className=\"bg-[#1a1a1a] border border-zinc-800 rounded-3xl p-6\">\n                      <div className=\"flex justify-between items-center mb-6\">\n                        <h4 className=\"text-lg font-bold text-white uppercase\">Mídias ({media.length})</h4>\n                        {media.length > 0 && <button onClick={handleClearMedia} className=\"text-[10px] text-zinc-500 hover:text-red-500 uppercase font-bold flex items-center gap-1\"><Trash2 className=\"w-3 h-3\"/> Limpar Catálogo</button>}\n                      </div>\n                      \n                      {media.length === 0 ? (\n                         <div className=\"py-12 text-center text-zinc-600 text-sm border-2 border-dashed border-zinc-800 rounded-2xl\"><ImageIcon className=\"w-8 h-8 mx-auto mb-2 opacity-50\"/> Sem mídias carregadas</div>\n                      ) : (\n                         <div className=\"grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3\">\n                           {media.map((item, idx) => (\n                             <div key={item.id || idx} className=\"aspect-[9/16] bg-zinc-900 rounded-xl overflow-hidden relative border border-zinc-800\">\n                               <img src={getThumbnailUrl(item)} className=\"w-full h-full object-cover\" alt=\"\" />\n                               {item.type === 'video' && <div className=\"absolute inset-0 flex items-center justify-center\"><Play className=\"w-6 h-6 text-white bg-[#ff5351]/80 rounded-full p-1.5\" /></div>}\n                               {item.isSelected && <div className=\"absolute top-2 right-2 w-5 h-5 bg-[#ff5351] rounded-full flex items-center justify-center\"><Check className=\"w-3 h-3 text-white\" /></div>}\n                             </div>\n                           ))}\n                         </div>\n                      )}\n                    </div>\n\n                  </div>\n                </div>\n              </div>\n            ) : (\n              <div className=\"space-y-4 pt-4\">\n                <div className=\"flex items-center justify-between\">\n                  <h3 className=\"text-sm font-black uppercase text-zinc-500 tracking-widest\">Anotações Internas (Log)</h3>\n                  <button onClick={handleSaveNotes} className=\"px-4 py-2 bg-[#1a1a1a] hover:bg-zinc-800 border border-zinc-800 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2\"><Save className=\"w-4 h-4 text-[#ff5351]\" /> Salvar</button>\n                </div>\n                <textarea value={stageNotes} onChange={(e) => setStageNotes(e.target.value)} placeholder=\"Ex: Link do drive, observações da gravação...\" className=\"w-full h-40 bg-[#111] border border-zinc-800 rounded-3xl p-5 text-white placeholder:text-zinc-600 focus:border-[#ff5351] outline-none resize-none transition-all leading-relaxed\" />\n              </div>\n            )}\n\n            {currentStage.status === 'completed' && (\n              <div className=\"pt-8 border-t border-zinc-800 flex justify-end animate-in fade-in slide-in-from-bottom-4\">\n                <button onClick={handleNextStage} className=\"h-14 px-8 bg-[#ff5351] text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-[#ff4240] transition-all flex items-center gap-3 shadow-[0_0_40px_rgba(255,83,81,0.2)]\">\n                  Avançar para Próxima Etapa <ChevronRight className=\"w-5 h-5\" />\n                </button>\n              </div>\n            )}\n          </div>\n        )}\n      </div>\n    </div>\n  );\n}\n