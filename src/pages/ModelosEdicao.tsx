import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  ArrowLeft, Plus, LayoutTemplate, GripVertical, Clock, 
  UserCircle, ShieldAlert, CheckCircle2, Settings2,
  PlayCircle, Save, Loader2, Camera, Video, Mic,
  MonitorPlay, Image as ImageIcon, Trash2, X, Edit2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { modelosService, WorkflowModel, Stage } from '../services/modelosService';

// --- IMPORTS DO DND-KIT PARA O DRAG & DROP ---
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const IconMap: Record<string, any> = {
  PlayCircle, Camera, Video, Mic, MonitorPlay, ImageIcon, LayoutTemplate
};

const PRESET_COLORS = [
  { id: 'emerald', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20', icon: 'PlayCircle' },
  { id: 'cyan', color: 'text-cyan-400', bg: 'bg-cyan-400/10', border: 'border-cyan-400/20', icon: 'Camera' },
  { id: 'purple', color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20', icon: 'Video' },
  { id: 'amber', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20', icon: 'Mic' },
  { id: 'rose', color: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-400/20', icon: 'MonitorPlay' },
];

// COMPONENTE DA ETAPA ARRASTÁVEL
function SortableStageItem({ stage, index, onEdit, onRemove }: { stage: Stage; index: number; onEdit: (s: Stage) => void; onRemove: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn(
        "group flex items-stretch bg-[#151515] border rounded-2xl overflow-hidden transition-all",
        isDragging ? "border-[#ff5351] shadow-[0_0_30px_rgba(255,83,81,0.15)] scale-[1.02]" : "border-zinc-800 hover:border-[#ff5351]/30 hover:shadow-[0_0_20px_rgba(255,83,81,0.05)]"
      )}
    >
      <div 
        {...attributes} 
        {...listeners}
        className="w-12 bg-zinc-900/50 border-r border-zinc-800 flex items-center justify-center cursor-grab active:cursor-grabbing text-zinc-600 hover:text-[#ff5351] hover:bg-[#ff5351]/5 transition-colors"
      >
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
                Resp: <strong className="text-white">{stage.assignee}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {stage.requiresApproval && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Aprovação
            </span>
          )}
          {stage.isBlocked && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 text-[10px] font-black uppercase tracking-widest">
              <ShieldAlert className="w-3.5 h-3.5" />
              Bloqueia Avanço
            </span>
          )}
          
          <div className="w-px h-8 bg-zinc-800 mx-2 hidden lg:block" />

          <button 
            onPointerDown={(e) => e.stopPropagation()} 
            onClick={() => onEdit(stage)}
            className="p-2 text-zinc-600 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          
          <button 
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onRemove(stage.id)}
            className="p-2 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ModelosEdicao() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [modelData, setModelData] = useState<WorkflowModel | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [isEditModelOpen, setIsEditModelOpen] = useState(false);
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [editModelForm, setEditModelForm] = useState({ name: '', description: '', presetIndex: 0 });
  const [editingStage, setEditingStage] = useState<Stage | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const data = await modelosService.getModelo(id);
        if (data) {
          setModelData(data);
          setStages(data.stages?.sort((a, b) => a.order - b.order) || []);
          
          const presetIndex = PRESET_COLORS.findIndex(p => p.icon === data.iconName);
          setEditModelForm({
            name: data.name,
            description: data.description,
            presetIndex: presetIndex >= 0 ? presetIndex : 0
          });
        } else {
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setStages((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleUpdateModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !modelData) return;
    setSaving(true);
    try {
      const selectedPreset = PRESET_COLORS[editModelForm.presetIndex];
      const updatedData = {
        name: editModelForm.name,
        description: editModelForm.description,
        iconName: selectedPreset.icon,
        color: selectedPreset.color,
        bgColor: selectedPreset.bg,
        borderColor: selectedPreset.border
      };

      await modelosService.atualizarModelo(id, updatedData);
      setModelData({ ...modelData, ...updatedData });
      setIsEditModelOpen(false);
      toast.success('Modelo atualizado com sucesso!');
    } catch (error) {
      toast.error('Erro ao atualizar o modelo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteModel = async () => {
    if (window.confirm('Tem certeza que deseja excluir este modelo?')) {
      if (!id) return;
      try {
        await modelosService.deletarModelo(id);
        toast.success('Modelo excluído!');
        navigate('/modelos');
      } catch (error) {
        toast.error('Erro ao excluir.');
      }
    }
  };

  const openNewStageModal = () => {
    setEditingStage({
      id: `stage_${Date.now()}`,
      name: '',
      duration: '1 dia',
      assignee: 'Produção',
      requiresApproval: false,
      isBlocked: false,
      order: stages.length
    });
    setIsStageModalOpen(true);
  };

  const handleSaveStageForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStage || !editingStage.name.trim()) return;

    const exists = stages.some(s => s.id === editingStage.id);
    if (exists) {
      setStages(stages.map(s => s.id === editingStage.id ? editingStage : s));
    } else {
      setStages([...stages, editingStage]);
    }
    setIsStageModalOpen(false);
  };

  const handleRemoveStage = (stageId: string) => {
    if (window.confirm('Remover esta etapa do fluxo padrão?')) {
      setStages(stages.filter(s => s.id !== stageId));
    }
  };

  const handleSaveFlow = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const updatedStages = stages.map((s, index) => ({ ...s, order: index }));
      await modelosService.atualizarEtapas(id, updatedStages);
      setStages(updatedStages);
      toast.success('Fluxo salvo com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar as etapas.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !modelData) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
      </div>
    );
  }

  const Icon = IconMap[modelData.iconName] || LayoutTemplate;

  return (
    <div className="space-y-8 pb-16">
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
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase italic truncate max-w-2xl">
                {modelData.name}
              </h1>
            </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button 
            onClick={() => setIsEditModelOpen(true)}
            className="h-12 px-6 rounded-2xl border border-zinc-700 bg-[#101010] hover:bg-zinc-800 text-white font-black uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-2"
          >
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
              Adicione e reordene as tarefas. O fluxo será salvo na ordem exibida abaixo.
            </p>
          </div>
          <button 
            onClick={openNewStageModal}
            className="h-10 px-5 rounded-xl bg-white text-black hover:bg-zinc-200 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova Etapa
          </button>
        </div>

        <div className="p-8">
          {stages.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/20 py-16 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 mb-4 shadow-xl">
                  <LayoutTemplate className="w-7 h-7" />
                </div>
                <p className="text-white font-black uppercase text-lg mb-2">Processo Vazio</p>
                <p className="text-zinc-500 text-sm font-medium max-w-sm mb-6">
                  Adicione as etapas padrão que farão parte deste tipo de projeto.
                </p>
                <button onClick={openNewStageModal} className="text-[#ff5351] text-xs font-black uppercase tracking-widest hover:underline">
                  + Adicionar Primeira Etapa
                </button>
            </div>
          ) : (
            <div className="space-y-3">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={stages.map(s => s.id)} strategy={verticalListSortingStrategy}>
                  {stages.map((stage, index) => (
                    <SortableStageItem 
                      key={stage.id} 
                      stage={stage} 
                      index={index} 
                      onEdit={(s) => { setEditingStage({ ...s }); setIsStageModalOpen(true); }}
                      onRemove={handleRemoveStage}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          )}
        </div>
      </section>

      {/* MODAL EDIÇÃO DO MODELO */}
      {isEditModelOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsEditModelOpen(false)} />
          <div className="relative w-full max-w-lg bg-[#151515] rounded-[32px] border border-zinc-800 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
            <header className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/30">
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Editar Modelo</h3>
              <button onClick={() => setIsEditModelOpen(false)} className="p-2 text-zinc-500 hover:text-white transition-all"><X className="w-5 h-5" /></button>
            </header>
            <form onSubmit={handleUpdateModel}>
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Nome do Modelo</label>
                  <input required type="text" value={editModelForm.name} onChange={e => setEditModelForm({...editModelForm, name: e.target.value})} className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white focus:border-[#ff5351] outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Descrição</label>
                  <textarea rows={2} value={editModelForm.description} onChange={e => setEditModelForm({...editModelForm, description: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-white focus:border-[#ff5351] outline-none resize-none" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Cor Visual</label>
                  <div className="flex gap-3">
                    {PRESET_COLORS.map((preset, index) => (
                      <button key={preset.id} type="button" onClick={() => setEditModelForm({...editModelForm, presetIndex: index})} className={cn('w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all', editModelForm.presetIndex === index ? `border-[${preset.color.replace('text-', '')}] bg-zinc-800 scale-110 shadow-lg` : 'border-transparent bg-zinc-900 hover:bg-zinc-800')}>
                        <div className={cn('w-4 h-4 rounded-full bg-current', preset.color)} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <footer className="p-6 bg-zinc-900/50 border-t border-zinc-800 flex justify-between gap-3">
                <button type="button" onClick={handleDeleteModel} className="px-4 text-xs font-black uppercase tracking-widest text-red-500 hover:text-red-400 transition-all flex items-center gap-2">
                  <Trash2 className="w-4 h-4" /> Excluir
                </button>
                <div className="flex gap-3 flex-1 justify-end">
                  <button type="button" onClick={() => setIsEditModelOpen(false)} className="px-6 h-12 text-xs font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-all bg-zinc-900 rounded-xl border border-zinc-800">Cancelar</button>
                  <button type="submit" disabled={saving} className="px-6 h-12 bg-[#ff5351] text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-[#ff5351]/90 flex items-center gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
                  </button>
                </div>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE ETAPA */}
      {isStageModalOpen && editingStage && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsStageModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-[#151515] rounded-[32px] border border-zinc-800 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
            <header className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/30">
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">
                {stages.some(s => s.id === editingStage.id) ? 'Editar Etapa' : 'Nova Etapa'}
              </h3>
              <button onClick={() => setIsStageModalOpen(false)} className="p-2 text-zinc-500 hover:text-white transition-all">
                <X className="w-5 h-5" />
              </button>
            </header>
            <form onSubmit={handleSaveStageForm}>
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Nome da Etapa</label>
                  <input required autoFocus type="text" placeholder="Ex: Edição Inicial" value={editingStage.name} onChange={e => setEditingStage({...editingStage, name: e.target.value})} className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white focus:border-[#ff5351] outline-none" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Duração Média</label>
                    <input type="text" placeholder="Ex: 2 dias" value={editingStage.duration} onChange={e => setEditingStage({...editingStage, duration: e.target.value})} className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white focus:border-[#ff5351] outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Responsável Padrão</label>
                    <input type="text" placeholder="Ex: Produção" value={editingStage.assignee} onChange={e => setEditingStage({...editingStage, assignee: e.target.value})} className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white focus:border-[#ff5351] outline-none" />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 transition-colors">
                    <div className="relative flex items-center justify-center w-6 h-6">
                      <input type="checkbox" className="peer sr-only" checked={editingStage.requiresApproval} onChange={e => setEditingStage({...editingStage, requiresApproval: e.target.checked})} />
                      <div className="w-5 h-5 rounded border border-zinc-600 bg-zinc-800 peer-checked:bg-[#ff5351] peer-checked:border-[#ff5351] transition-colors" />
                      <CheckCircle2 className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-bold">Aprovação do Cliente Obrigatória</p>
                      <p className="text-zinc-500 text-xs mt-0.5">Fluxo trava até o cliente validar esta etapa.</p>
                    </div>
                  </label>
                </div>
                
                <div className="pt-0">
                  <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 transition-colors">
                    <div className="relative flex items-center justify-center w-6 h-6">
                      <input type="checkbox" className="peer sr-only" checked={editingStage.isBlocked} onChange={e => setEditingStage({...editingStage, isBlocked: e.target.checked})} />
                      <div className="w-5 h-5 rounded border border-zinc-600 bg-zinc-800 peer-checked:bg-zinc-500 peer-checked:border-zinc-500 transition-colors" />
                      <ShieldAlert className="absolute w-3 h-3 text-black opacity-0 peer-checked:opacity-100 transition-opacity" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-bold">Bloqueia Avanço Automatico</p>
                      <p className="text-zinc-500 text-xs mt-0.5">Esta etapa precisa estar 100% finalizada para abrir a próxima.</p>
                    </div>
                  </label>
                </div>

              </div>
              <footer className="p-6 bg-zinc-900/50 border-t border-zinc-800 flex gap-3">
                <button type="button" onClick={() => setIsStageModalOpen(false)} className="flex-1 h-12 text-xs font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-all bg-zinc-900 rounded-xl border border-zinc-800">Cancelar</button>
                <button type="submit" className="flex-1 h-12 bg-white text-black text-xs font-black uppercase tracking-widest rounded-xl hover:bg-zinc-200 flex items-center justify-center gap-2">Confirmar Etapa</button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
