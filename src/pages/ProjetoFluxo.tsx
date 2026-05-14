import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  ArrowLeft, Check, CheckCircle2, ChevronRight, Clock, 
  UserCircle, Save, Loader2, LayoutTemplate, PlayCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { modelosService, WorkflowModel } from '../services/modelosService';
import { projetoFluxoService, ProjectWorkflow, ProjectStage, ProjectStageStatus } from '../services/projetoFluxoService';

export default function ProjetoFluxo() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [projectData, setProjectData] = useState<any>(null);
  const [workflow, setWorkflow] = useState<ProjectWorkflow | null>(null);
  
  // Setup State
  const [availableModels, setAvailableModels] = useState<WorkflowModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<WorkflowModel | null>(null);
  const [setupStages, setSetupStages] = useState<ProjectStage[]>([]);
  const [isInitializing, setIsInitializing] = useState(false);

  // Execution State
  const [stageNotes, setStageNotes] = useState('');

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const projSnap = await getDoc(doc(db, 'projects', projectId));
      if (projSnap.exists()) setProjectData(projSnap.data());

      const existingWorkflow = await projetoFluxoService.getProjectWorkflow(projectId);
      
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
    
    // Fallback de segurança se as etapas vierem vazias ou mal formatadas
    const stages = model.stages || [];
    
    const initialStages: ProjectStage[] = stages.map(stage => ({
      id: crypto.randomUUID(),
      originalStageId: stage?.id || crypto.randomUUID(),
      name: stage?.name || 'Etapa sem nome',
      description: stage?.description || '',
      assignee: stage?.assignee || '', 
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
    
    const updatedStages = [...workflow.stages];
    const currentIndex = workflow.currentStageIndex;
    updatedStages[currentIndex].status = newStatus;
    
    if (newStatus === 'in_progress' && !updatedStages[currentIndex].startedAt) {
      updatedStages[currentIndex].startedAt = new Date().toISOString();
    }
    if (newStatus === 'completed') {
      updatedStages[currentIndex].completedAt = new Date().toISOString();
    }

    const newWorkflow = { ...workflow, stages: updatedStages };
    setWorkflow(newWorkflow);
    
    await projetoFluxoService.updateWorkflow(projectId, { stages: updatedStages });
    toast.success('Status atualizado');
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
    
    const nextIndex = workflow.currentStageIndex + 1;
    const updatedStages = [...workflow.stages];
    
    updatedStages[nextIndex].status = 'in_progress';
    updatedStages[nextIndex].startedAt = new Date().toISOString();

    const newWorkflow = { ...workflow, currentStageIndex: nextIndex, stages: updatedStages };
    setWorkflow(newWorkflow);
    setStageNotes(updatedStages[nextIndex].notes || '');
    
    await projetoFluxoService.updateWorkflow(projectId, { 
      currentStageIndex: nextIndex,
      stages: updatedStages 
    });
    toast.success('Avançou para a próxima etapa!');
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 pb-16">
        <header>
          <div className="flex items-center gap-4 mb-4">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5351] font-black">
              Setup de Projeto • {projectData?.title || 'Projeto'}
            </p>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase italic">
            Vincular Fluxo
          </h1>
          <p className="text-zinc-500 mt-3 text-lg">
            Escolha o modelo de serviço e personalize os responsáveis para este cliente.
          </p>
        </header>

        {!selectedModel ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableModels.length === 0 ? (
              <div className="col-span-2 p-8 text-center border border-zinc-800 rounded-3xl bg-[#141414]">
                <LayoutTemplate className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                <p className="text-zinc-400 font-medium">Nenhum modelo cadastrado.</p>
                <button onClick={() => navigate('/modelos')} className="mt-4 text-[#ff5351] text-sm font-black uppercase tracking-widest hover:underline">Ir para Modelos</button>
              </div>
            ) : (
              availableModels.map(model => (
                <button 
                  key={model.id} 
                  onClick={() => handleSelectModel(model)}
                  className="p-6 text-left border border-zinc-800 bg-[#141414] rounded-3xl hover:border-[#ff5351] hover:bg-zinc-900/50 transition-all group"
                >
                  <h3 className="text-xl font-black text-white uppercase group-hover:text-[#ff5351] transition-colors">{model.name}</h3>
                  <p className="text-zinc-500 mt-2 text-sm">{model.description || 'Sem descrição'}</p>
                  <div className="mt-6 flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-zinc-600">
                    <CheckCircle2 className="w-4 h-4" /> {(model.stages || []).length} etapas
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-4 py-4 border-b border-zinc-800">
              <button onClick={() => setSelectedModel(null)} className="text-zinc-500 hover:text-white"><ArrowLeft className="w-5 h-5"/></button>
              <h2 className="text-xl font-black text-white uppercase">Personalizar: {selectedModel.name}</h2>
            </div>
            
            <div className="space-y-4">
              {setupStages.map((stage, idx) => (
                <div key={stage.id} className="p-5 bg-[#141414] border border-zinc-800 rounded-3xl flex flex-col md:flex-row md:items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center text-zinc-500 font-black border border-zinc-800 shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-black uppercase text-sm truncate">{stage.name}</p>
                    <p className="text-zinc-500 text-xs mt-1 truncate">{stage.description || 'Sem descrição'}</p>
                  </div>
                  <div className="w-full md:w-64 space-y-2 shrink-0">
                    <label className="text-[10px] uppercase font-black text-[#ff5351] tracking-widest">Responsável (Neste Projeto)</label>
                    <input 
                      type="text" 
                      value={stage.assignee} 
                      onChange={(e) => updateSetupStage(idx, 'assignee', e.target.value)}
                      placeholder="Ex: João"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl h-12 px-4 text-sm text-white focus:border-[#ff5351] outline-none transition-colors"
                    />
                  </div>
                  <div className="w-full md:w-32 space-y-2 shrink-0">
                    <label className="text-[10px] uppercase font-black text-[#ff5351] tracking-widest">Prazo (Dias)</label>
                    <input 
                      type="number" 
                      min="0"
                      value={stage.durationDays} 
                      onChange={(e) => updateSetupStage(idx, 'durationDays', Number(e.target.value))}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl h-12 px-4 text-sm text-white focus:border-[#ff5351] outline-none transition-colors"
                    />
                  </div>
                </div>
              ))}

              {setupStages.length === 0 && (
                <div className="p-8 text-center border border-zinc-800 rounded-3xl bg-[#141414]">
                  <p className="text-zinc-500 font-medium">Este modelo não tem etapas cadastradas.</p>
                </div>
              )}
            </div>

            {setupStages.length > 0 && (
              <div className="pt-6">
                <button 
                  onClick={handleStartWorkflow} 
                  disabled={isInitializing}
                  className="w-full h-14 bg-[#ff5351] text-white rounded-2xl font-black uppercase tracking-widest hover:bg-[#ff4240] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isInitializing ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlayCircle className="w-5 h-5" />}
                  Salvar Pessoas e Iniciar Projeto
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
  
  const currentStage = workflow.stages?.[workflow.currentStageIndex];

  if (!currentStage) {
    return (
       <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
         <h2 className="text-white text-xl font-bold mb-2">Erro no Fluxo</h2>
         <p className="text-zinc-500">Etapa atual não encontrada.</p>
         <button onClick={() => navigate(-1)} className="mt-6 text-[#ff5351] font-bold">Voltar</button>
       </div>
    )
  }

  return (
    <div className="h-[calc(100vh-6rem)] -m-8 flex flex-col md:flex-row bg-[#0a0a0a]">
      <div className="w-full md:w-[320px] lg:w-[380px] border-r border-zinc-800 bg-[#111111] flex flex-col">
        <div className="p-6 border-b border-zinc-800">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#ff5351] font-black mb-1">
            Cockpit • {workflow.modelName}
          </p>
          <h2 className="text-xl font-black text-white uppercase truncate">
            {projectData?.title || 'Projeto'}
          </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <h3 className="text-[11px] uppercase tracking-widest font-black text-zinc-500 mb-6">Linha do Tempo</h3>
          
          <div className="space-y-2 relative">
            {workflow.stages.map((stage, idx) => {
              const isPast = idx < workflow.currentStageIndex;
              const isCurrent = idx === workflow.currentStageIndex;
              
              return (
                <div key={stage.id} className={cn("flex gap-4 relative p-3 rounded-2xl transition-all", isCurrent ? "bg-zinc-900/80 border border-zinc-800" : !isPast && "opacity-50")}>
                  {idx !== workflow.stages.length - 1 && (
                    <div className="absolute left-[27px] top-[40px] bottom-[-16px] w-[2px] bg-zinc-800 z-0" />
                  )}
                  
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 z-10 bg-[#111]", 
                    isPast ? "border-emerald-500 text-emerald-500" :
                    isCurrent ? "border-[#ff5351] text-[#ff5351] shadow-[0_0_15px_rgba(255,83,81,0.2)]" :
                    "border-zinc-700 text-zinc-700"
                  )}>
                    {isPast ? <Check className="w-4 h-4" /> : <span className="text-xs font-black">{idx + 1}</span>}
                  </div>
                  
                  <div className="pb-2">
                    <p className={cn("font-black uppercase text-sm", isCurrent ? "text-white" : "text-zinc-400")}>
                      {stage.name}
                    </p>
                    <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mt-1">
                      Resp: <span className={isCurrent ? "text-[#ff5351]" : ""}>{stage.assignee || 'Não definido'}</span>
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-12">
        {workflow.status === 'completed' ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto">
            <div className="w-24 h-24 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            </div>
            <h2 className="text-3xl font-black uppercase text-white tracking-tight mb-4">Projeto Finalizado</h2>
            <p className="text-zinc-400">Todas as etapas deste fluxo foram concluídas com sucesso.</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-8">
            <header className="pb-8 border-b border-zinc-800">
              <p className="text-[11px] uppercase tracking-widest font-black text-zinc-500 mb-3">Etapa Atual</p>
              <h2 className="text-4xl md:text-5xl font-black text-white uppercase italic tracking-tight">{currentStage.name}</h2>
              <p className="text-zinc-400 mt-4">{currentStage.description}</p>
              
              <div className="flex flex-wrap gap-4 mt-6">
                <span className="px-4 py-2 bg-[#1a1a1a] border border-zinc-800 rounded-full text-xs font-black text-zinc-300 uppercase tracking-widest flex items-center gap-2">
                  <UserCircle className="w-4 h-4 text-[#ff5351]"/> {currentStage.assignee || 'Não definido'}
                </span>
                <span className="px-4 py-2 bg-[#1a1a1a] border border-zinc-800 rounded-full text-xs font-black text-zinc-300 uppercase tracking-widest flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#ff5351]"/> Prazo: {currentStage.durationDays} dias
                </span>
              </div>
            </header>

            <div className="space-y-4">
              <h3 className="text-sm font-black uppercase text-zinc-500 tracking-widest">Controle de Status</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { id: 'pending', label: 'Pendente', color: 'border-zinc-700 text-zinc-500' },
                  { id: 'in_progress', label: 'Em Andamento', color: 'border-blue-500 text-blue-400' },
                  { id: 'waiting_approval', label: 'Aguard. Cliente', color: 'border-amber-500 text-amber-400' },
                  { id: 'completed', label: 'Concluído', color: 'border-emerald-500 text-emerald-400' }
                ].map(status => {
                  const isActive = currentStage.status === status.id;
                  return (
                    <button 
                      key={status.id}
                      onClick={() => handleUpdateStatus(status.id as ProjectStageStatus)}
                      className={cn(
                        "px-4 py-4 rounded-2xl border text-[11px] font-black uppercase tracking-widest text-center transition-all", 
                        isActive ? cn("bg-[#1a1a1a]", status.color) : "bg-[#111] border-zinc-800 text-zinc-600 hover:border-zinc-600"
                      )}
                    >
                      {status.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase text-zinc-500 tracking-widest">Anotações Internas (Log)</h3>
                <button 
                  onClick={handleSaveNotes} 
                  className="px-4 py-2 bg-[#1a1a1a] hover:bg-zinc-800 border border-zinc-800 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"
                >
                  <Save className="w-4 h-4 text-[#ff5351]" /> Salvar
                </button>
              </div>
              <textarea 
                value={stageNotes}
                onChange={(e) => setStageNotes(e.target.value)}
                placeholder="Ex: Link do drive, observações da gravação, feedback do cliente..."
                className="w-full h-40 bg-[#111] border border-zinc-800 rounded-3xl p-5 text-white placeholder:text-zinc-600 focus:border-[#ff5351] outline-none resize-none transition-all leading-relaxed"
              />
            </div>

            {currentStage.status === 'completed' && (
              <div className="pt-8 border-t border-zinc-800 flex justify-end animate-in fade-in slide-in-from-bottom-4">
                <button 
                  onClick={handleNextStage} 
                  className="h-14 px-8 bg-[#ff5351] text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-[#ff4240] transition-all flex items-center gap-3 shadow-[0_0_40px_rgba(255,83,81,0.2)]"
                >
                  Avançar para Próxima Etapa <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
