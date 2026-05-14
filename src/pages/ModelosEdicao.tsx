import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  ArrowLeft,
  Plus, 
  LayoutTemplate, 
  GripVertical, 
  Clock, 
  UserCircle, 
  ShieldAlert, 
  CheckCircle2, 
  Settings2,
  MoreVertical,
  PlayCircle,
  Save,
  Loader2,
  Camera,
  Video,
  Mic,
  MonitorPlay,
  Image as ImageIcon,
  Trash2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { modelosService, WorkflowModel, Stage } from '../services/modelosService';

// Mapa de ícones
const IconMap: Record<string, any> = {
  PlayCircle, Camera, Video, Mic, MonitorPlay, ImageIcon, LayoutTemplate
};

export default function ModelosEdicao() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [modelData, setModelData] = useState<WorkflowModel | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Carregar dados do banco
  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const data = await modelosService.getModelo(id);
        if (data) {
          setModelData(data);
          // Ordena as etapas pela propriedade 'order'
          setStages(data.stages?.sort((a, b) => a.order - b.order) || []);
        } else {
          toast.error('Modelo não encontrado.');
          navigate('/modelos');
        }
      } catch (error) {
        toast.error('Erro ao carregar o modelo.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, navigate]);

  // Função simples para simular adicionar uma nova etapa temporariamente (antes de salvar)
  const handleAddStage = () => {
    const newStage: Stage = {
      id: `temp_${Date.now()}`,
      name: 'Nova Etapa',
      duration: '1 dia',
      assignee: 'Responsável',
      requiresApproval: false,
      isBlocked: false,
      order: stages.length
    };
    setStages([...stages, newStage]);
  };

  // Remove etapa da lista na tela
  const handleRemoveStage = (stageId: string) => {
    setStages(stages.filter(s => s.id !== stageId));
  };

  // Salvar no Banco
  const handleSaveFlow = async () => {
    if (!id) return;
    setSaving(true);
    try {
      // Atualiza a ordem antes de salvar
      const updatedStages = stages.map((s, index) => ({ ...s, order: index }));
      await modelosService.atualizarEtapas(id, updatedStages);
      setStages(updatedStages); // Atualiza na tela com a nova ordem oficial
      toast.success('Fluxo salvo com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar as etapas.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
      </div>
    );
  }

  if (!modelData) return null;

  const Icon = IconMap[modelData.iconName] || LayoutTemplate;

  return (
    <div className="space-y-8 pb-16">
      
      {/* Botão voltar */}
      <button 
        onClick={() => navigate('/modelos')}
        className="group flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Voltar para a Lista
      </button>

      <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
        <div className="flex items-center gap-5">
           <div className={cn('w-16 h-16 rounded-3xl border flex items-center justify-center shrink-0', modelData.bgColor, modelData.borderColor)}>
              <Icon className={cn('w-7 h-7', modelData.color)} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-[#ff5351] font-black mb-1">
                Editando estrutura do fluxo
              </p>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase italic">
                {modelData.name}
              </h1>
            </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button className="h-12 px-6 rounded-2xl border border-zinc-700 bg-[#101010] hover:bg-zinc-800 text-white font-black uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-2">
            <Settings2 className="w-4 h-4" />
            Configurações
          </button>
          <button 
            onClick={handleSaveFlow}
            disabled={saving}
            className="h-12 px-6 rounded-2xl bg-[#ff5351] hover:bg-[#ff5351]/90 text-white font-black uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#ff5351]/20 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Fluxo
          </button>
        </div>
      </header>

      <section className="rounded-[32px] border border-zinc-800 bg-[#101010] overflow-hidden">
        
        <div className="p-8 border-b border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-white text-xl font-black uppercase tracking-widest">
              Etapas do Processo
            </h3>
            <p className="text-zinc-500 text-sm mt-1">
              Adicione e salve. O Drag & Drop visual virá no próximo passo.
            </p>
          </div>
          <button 
            onClick={handleAddStage}
            className="h-10 px-5 rounded-xl bg-white text-black hover:bg-zinc-200 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova Etapa
          </button>
        </div>

        <div className="p-8">
          <div className="space-y-3">
            {stages.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/20 py-16 flex flex-col items-center justify-center text-center">
                 <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 mb-4 shadow-xl">
                   <LayoutTemplate className="w-7 h-7" />
                 </div>
                 <p className="text-white font-black uppercase text-lg mb-2">Processo Vazio</p>
                 <p className="text-zinc-500 text-sm font-medium max-w-sm mb-6">
                   Adicione as etapas padrão que farão parte deste tipo de projeto.
                 </p>
                 <button 
                   onClick={handleAddStage}
                   className="text-[#ff5351] text-xs font-black uppercase tracking-widest hover:underline"
                 >
                   + Adicionar Primeira Etapa
                 </button>
              </div>
            ) : (
              stages.map((stage, index) => (
                <div 
                  key={stage.id}
                  className="group flex items-stretch bg-[#151515] border border-zinc-800 rounded-2xl overflow-hidden hover:border-[#ff5351]/30 transition-all hover:shadow-[0_0_20px_rgba(255,83,81,0.05)]"
                >
                  <div className="w-12 bg-zinc-900/50 border-r border-zinc-800 flex items-center justify-center cursor-grab text-zinc-600 group-hover:text-[#ff5351] group-hover:bg-[#ff5351]/5 transition-colors">
                    <GripVertical className="w-5 h-5" />
                  </div>

                  <div className="flex-1 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                      <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 font-black text-sm shadow-inner group-hover:border-[#ff5351]/30 group-hover:text-white transition-all">
                        {index + 1}
                      </div>
                      <div>
                        <h4 className="text-white font-black uppercase text-base">{stage.name}</h4>
                        <div className="flex items-center gap-4 mt-2 text-xs">
                          <span className="flex items-center gap-1.5 text-zinc-400 font-medium">
                            <Clock className="w-4 h-4 text-zinc-500" />
                            Duração: <strong className="text-white">{stage.duration}</strong>
                          </span>
                          <span className="text-zinc-700">•</span>
                          <span className="flex items-center gap-1.5 text-zinc-400 font-medium">
                            <UserCircle className="w-4 h-4 text-zinc-500" />
                            Responsável padrão: <strong className="text-white">{stage.assignee}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {stage.requiresApproval && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Aprovação de Cliente
                        </span>
                      )}
                      
                      <div className="w-px h-8 bg-zinc-800 mx-2 hidden lg:block" />

                      <button 
                        onClick={() => handleRemoveStage(stage.id)}
                        className="p-2 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
        </div>
      </section>
    </div>
  );
}
