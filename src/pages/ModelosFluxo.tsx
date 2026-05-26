import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { 
  Plus, 
  Search, 
  LayoutTemplate, 
  ArrowRight,
  Settings2,
  Loader2,
  PlayCircle,
  Camera,
  Video,
  Mic,
  MonitorPlay,
  Image as ImageIcon,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { modelosService, WorkflowModel } from '../services/modelosService';
import { DataTable } from '../components/ui/DataTable';

// Mapa de ícones para renderização dinâmica
const IconMap: Record<string, any> = {
  PlayCircle, Camera, Video, Mic, MonitorPlay, ImageIcon, LayoutTemplate
};

// Cores pré-definidas para os novos modelos
const PRESET_COLORS = [
  { id: 'emerald', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20', icon: 'PlayCircle' },
  { id: 'cyan', color: 'text-cyan-400', bg: 'bg-cyan-400/10', border: 'border-cyan-400/20', icon: 'Camera' },
  { id: 'purple', color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20', icon: 'Video' },
  { id: 'amber', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20', icon: 'Mic' },
  { id: 'rose', color: 'text-rose-400', bg: 'bg-rose-400/10', border: 'border-rose-400/20', icon: 'MonitorPlay' },
];

export default function ModelosFluxo() {
  const [models, setModels] = useState<WorkflowModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  // Estados do Modal de Novo Modelo
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newModelData, setNewModelData] = useState({
    name: '',
    description: '',
    presetIndex: 0
  });

  const loadModels = async () => {
    setLoading(true);
    try {
      const data = await modelosService.getModelos();
      setModels(data);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar os modelos de fluxo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  const handleCreateModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelData.name.trim()) {
      toast.error('O nome do modelo é obrigatório.');
      return;
    }

    setIsCreating(true);
    try {
      const selectedPreset = PRESET_COLORS[newModelData.presetIndex];
      const newId = await modelosService.criarModelo({
        name: newModelData.name,
        description: newModelData.description,
        iconName: selectedPreset.icon,
        color: selectedPreset.color,
        bgColor: selectedPreset.bg,
        borderColor: selectedPreset.border
      });
      toast.success('Modelo criado com sucesso!');
      setIsModalOpen(false);
      setNewModelData({ name: '', description: '', presetIndex: 0 });
      navigate(`/modelos/${newId}`);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao criar o modelo.');
    } finally {
      setIsCreating(false);
    }
  };

  const formatDateTime = (value: any) => {
    if (!value) return 'Sem data';
    const parsed = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Sem data';
    return format(parsed, 'dd/MM/yyyy');
  };

  const filteredModels = models.filter(model => 
    model.name.toLowerCase().includes(search.toLowerCase()) || 
    model.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-16 relative">
      <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.35em] text-[#ff5351] font-black mb-3">Setup de Produção</p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase italic">Modelos de Fluxo</h1>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
          <div className="relative w-full xl:w-[320px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar modelo..." className="w-full h-12 bg-zinc-900/90 border border-zinc-800 rounded-2xl pl-11 pr-4 text-white focus:border-[#ff5351] outline-none transition-all"/>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="h-12 px-6 rounded-2xl bg-[#ff5351] hover:bg-[#ff5351]/90 text-white font-black uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#ff5351]/20"><Plus className="w-4 h-4" />Novo Modelo</button>
        </div>
      </header>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black uppercase tracking-tight text-2xl">Biblioteca de Modelos</h2>
          <div className="text-[10px] uppercase tracking-widest font-black text-zinc-500">{filteredModels.length} modelos</div>
        </div>

        <DataTable 
          data={filteredModels}
          loading={loading}
          onRowClick={(model) => navigate(`/modelos/${model.id}`)}
          emptyMessage="Nenhum modelo criado ainda."
          columns={[
            {
              header: 'Nome do Modelo',
              accessor: (model) => {
                const Icon = IconMap[model.iconName] || LayoutTemplate;
                return (
                  <div className="flex items-start gap-4">
                    <div className={cn('w-10 h-10 rounded-xl border flex items-center justify-center shrink-0', model.bgColor, model.borderColor)}>
                      <Icon className={cn('w-5 h-5', model.color)} />
                    </div>
                    <div>
                      <p className="text-white font-black uppercase text-sm leading-tight">{model.name}</p>
                      <p className="text-zinc-500 text-xs mt-1 line-clamp-1">{model.description}</p>
                    </div>
                  </div>
                );
              }
            },
            {
              header: 'Etapas',
              align: 'center',
              accessor: (model) => <span className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 font-black text-xs">{model.stages?.length || 0}</span>
            },
            {
              header: 'Ativos',
              align: 'center',
              accessor: (model) => <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ff5351]/10 border border-[#ff5351]/20 text-[#ff5351] font-black text-xs">{model.activeProjects || 0}</span>
            },
            {
              header: 'Atualização',
              accessor: (model) => <span className="text-zinc-400 text-xs">{formatDateTime(model.updatedAt || model.createdAt)}</span>
            }
          ]}
          actions={(model) => (
            <button className="h-10 px-4 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-300 font-black text-[10px] uppercase tracking-widest group-hover:text-white group-hover:border-[#ff5351]/50 transition-all flex items-center gap-2">
              <Settings2 className="w-3.5 h-3.5" />
              Editar
              <ArrowRight className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </button>
          )}
        />
      </div>

      {/* MODAL DE NOVO MODELO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isCreating && setIsModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-[#151515] rounded-[32px] border border-zinc-800 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 duration-200">
            <header className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/30">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#ff5351]/10 rounded-xl border border-[#ff5351]/20"><LayoutTemplate className="w-5 h-5 text-[#ff5351]" /></div>
                <div><h3 className="text-xl font-black text-white uppercase tracking-tighter">Novo Modelo</h3><p className="text-zinc-500 text-xs font-medium mt-0.5">Defina a base do seu processo</p></div>
              </div>
              <button onClick={() => !isCreating && setIsModalOpen(false)} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white transition-all"><X className="w-5 h-5" /></button>
            </header>
            <form onSubmit={handleCreateModel}>
              <div className="p-6 space-y-6">
                <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Nome do Modelo (ex: Podcast, Ensaio)</label><input required autoFocus type="text" value={newModelData.name} onChange={e => setNewModelData({...newModelData, name: e.target.value})} placeholder="Digite o nome..." className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white focus:border-[#ff5351] outline-none transition-all placeholder:text-zinc-600"/></div>
                <div className="space-y-2"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Descrição curta (opcional)</label><textarea rows={2} value={newModelData.description} onChange={e => setNewModelData({...newModelData, description: e.target.value})} placeholder="Para que serve este processo?" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-white focus:border-[#ff5351] outline-none transition-all resize-none placeholder:text-zinc-600"/></div>
                <div className="space-y-3"><label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 ml-1">Cor Visual do Modelo</label><div className="flex gap-3">{PRESET_COLORS.map((preset, index) => (<button key={preset.id} type="button" onClick={() => setNewModelData({...newModelData, presetIndex: index})} className={cn('w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all', newModelData.presetIndex === index ? `border-[${preset.color.replace('text-', '')}] bg-zinc-800 scale-110 shadow-lg` : 'border-transparent bg-zinc-900 hover:bg-zinc-800')}><div className={cn('w-4 h-4 rounded-full bg-current', preset.color)} /></button>))}</div></div>
              </div>
              <footer className="p-6 bg-zinc-900/50 border-t border-zinc-800 flex gap-3"><button type="button" onClick={() => !isCreating && setIsModalOpen(false)} className="flex-1 h-12 text-xs font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-all bg-zinc-900 rounded-xl border border-zinc-800 hover:border-zinc-700">Cancelar</button><button type="submit" disabled={isCreating} className="flex-1 h-12 bg-[#ff5351] text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-[#ff5351]/90 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50">{isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Criar Modelo</button></footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
