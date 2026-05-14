import { useState } from 'react';
import { 
  Plus, 
  Search, 
  LayoutTemplate, 
  GripVertical, 
  Clock, 
  UserCircle, 
  ShieldAlert, 
  CheckCircle2, 
  Settings2,
  MoreVertical,
  PlayCircle,
  Camera
} from 'lucide-react';
import { cn } from '../lib/utils';

// --- DADOS FALSOS APENAS PARA VISUALIZAÇÃO ---
const MOCK_MODELS = [
  {
    id: '1',
    name: 'Podcast Premium',
    description: 'Fluxo completo de gravação, edição e aprovação de episódio.',
    icon: PlayCircle,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400/10',
    borderColor: 'border-emerald-400/20',
    stagesCount: 6,
    activeProjects: 12
  },
  {
    id: '2',
    name: 'Sessão de Fotos',
    description: 'Ensaio fotográfico corporativo com seleção pelo cliente.',
    icon: Camera,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-400/10',
    borderColor: 'border-cyan-400/20',
    stagesCount: 4,
    activeProjects: 5
  }
];

const MOCK_STAGES = [
  { id: 's1', name: 'Alinhamento & Roteiro', duration: '1 dia', assignee: 'Atendimento', requiresApproval: true, isBlocked: false },
  { id: 's2', name: 'Gravação em Estúdio', duration: '1 dia', assignee: 'Produção', requiresApproval: false, isBlocked: true },
  { id: 's3', name: 'Backup & Decupagem', duration: '1 dia', assignee: 'Edição', requiresApproval: false, isBlocked: true },
  { id: 's4', name: 'Edição Inicial', duration: '3 dias', assignee: 'Edição', requiresApproval: false, isBlocked: true },
  { id: 's5', name: 'Aprovação do Cliente', duration: 'Variável', assignee: 'Atendimento', requiresApproval: true, isBlocked: true },
  { id: 's6', name: 'Entrega Final', duration: '1 dia', assignee: 'Atendimento', requiresApproval: false, isBlocked: true },
];
// ---------------------------------------------

export default function ModelosFluxo() {
  const [selectedModelId, setSelectedModelId] = useState<string>(MOCK_MODELS[0].id);
  const [search, setSearch] = useState('');

  const selectedModel = MOCK_MODELS.find(m => m.id === selectedModelId) || MOCK_MODELS[0];

  return (
    <div className="space-y-8 pb-16">
      <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.35em] text-[#ff5351] font-black mb-3">
            Setup de Produção
          </p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase italic">
            Modelos de Fluxo
          </h1>
          <p className="text-zinc-500 text-base md:text-lg mt-3 max-w-3xl">
            Crie o DNA dos seus serviços. Defina as etapas padrão, prazos e regras de aprovação para cada tipo de projeto.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
          <div className="relative w-full xl:w-[320px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar modelo..."
              className="w-full h-12 bg-zinc-900/90 border border-zinc-800 rounded-2xl pl-11 pr-4 text-white focus:border-[#ff5351] outline-none transition-all"
            />
          </div>

          <button className="h-12 px-6 rounded-2xl bg-[#ff5351] hover:bg-[#ff5351]/90 text-white font-black uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#ff5351]/20">
            <Plus className="w-4 h-4" />
            Novo Modelo
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-6 items-start">
        
        {/* COLUNA ESQUERDA: LISTA DE MODELOS */}
        <section className="space-y-4">
          {MOCK_MODELS.map((model) => {
            const isSelected = selectedModelId === model.id;
            const Icon = model.icon;
            
            return (
              <button
                key={model.id}
                onClick={() => setSelectedModelId(model.id)}
                className={cn(
                  'w-full text-left p-5 rounded-[28px] border transition-all relative overflow-hidden group',
                  isSelected 
                    ? 'bg-zinc-900/80 border-[#ff5351]/40 shadow-[0_0_30px_rgba(255,83,81,0.05)]' 
                    : 'bg-[#101010] border-zinc-800 hover:border-zinc-700 hover:bg-[#151515]'
                )}
              >
                {isSelected && (
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#ff5351]" />
                )}
                
                <div className="flex items-start gap-4">
                  <div className={cn('w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0', model.bgColor, model.borderColor)}>
                    <Icon className={cn('w-5 h-5', model.color)} />
                  </div>
                  
                  <div className="flex-1 min-w-0 pt-0.5">
                    <h3 className="text-white font-black uppercase text-lg truncate">{model.name}</h3>
                    <p className="text-zinc-500 text-sm mt-1 line-clamp-2 leading-relaxed">
                      {model.description}
                    </p>
                    
                    <div className="flex items-center gap-3 mt-4">
                      <span className="inline-flex items-center gap-1.5 text-zinc-400 text-xs font-bold">
                        <LayoutTemplate className="w-3.5 h-3.5" />
                        {model.stagesCount} etapas
                      </span>
                      <span className="text-zinc-700">•</span>
                      <span className="inline-flex items-center gap-1.5 text-[#ff5351] text-xs font-bold">
                        {model.activeProjects} projetos ativos
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </section>

        {/* COLUNA DIREITA: DETALHE E ETAPAS DO MODELO */}
        <section className="rounded-[32px] border border-zinc-800 bg-[#101010] overflow-hidden xl:sticky xl:top-24">
          {/* CABEÇALHO DO MODELO */}
          <div className="p-8 border-b border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-zinc-900/30">
            <div className="flex items-center gap-4">
               <div className={cn('w-14 h-14 rounded-2xl border flex items-center justify-center shrink-0', selectedModel.bgColor, selectedModel.borderColor)}>
                  <selectedModel.icon className={cn('w-6 h-6', selectedModel.color)} />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-[#ff5351] font-black mb-1">
                    Editando fluxo padrão
                  </p>
                  <h2 className="text-white text-3xl font-black uppercase tracking-tight">
                    {selectedModel.name}
                  </h2>
                </div>
            </div>
            
            <button className="h-10 px-4 rounded-xl border border-zinc-700 bg-zinc-800 text-white font-black uppercase tracking-widest text-[10px] hover:bg-zinc-700 transition-all flex items-center gap-2">
              <Settings2 className="w-3.5 h-3.5" />
              Configurações
            </button>
          </div>

          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white text-lg font-black uppercase tracking-widest">
                Etapas do Fluxo ({MOCK_STAGES.length})
              </h3>
              <button className="text-[#ff5351] hover:text-[#ff9e9d] text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" />
                Adicionar Etapa
              </button>
            </div>

            {/* LISTA DE ETAPAS (Simulação visual de Drag & Drop) */}
            <div className="space-y-3">
              {MOCK_STAGES.map((stage, index) => (
                <div 
                  key={stage.id}
                  className="group flex items-stretch bg-[#151515] border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-all"
                >
                  {/* Handle de arrastar */}
                  <div className="w-10 bg-zinc-900/50 border-r border-zinc-800 flex items-center justify-center cursor-grab text-zinc-600 group-hover:text-[#ff5351] transition-colors">
                    <GripVertical className="w-4 h-4" />
                  </div>

                  {/* Conteúdo da etapa */}
                  <div className="flex-1 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 font-black text-xs">
                        {index + 1}
                      </div>
                      <div>
                        <h4 className="text-white font-black uppercase text-sm">{stage.name}</h4>
                        <div className="flex items-center gap-3 mt-1.5 text-xs">
                          <span className="flex items-center gap-1.5 text-zinc-400">
                            <Clock className="w-3.5 h-3.5" />
                            {stage.duration}
                          </span>
                          <span className="text-zinc-700">•</span>
                          <span className="flex items-center gap-1.5 text-zinc-400">
                            <UserCircle className="w-3.5 h-3.5" />
                            {stage.assignee}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {stage.requiresApproval && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest">
                          <CheckCircle2 className="w-3 h-3" />
                          Requer Aprovação
                        </span>
                      )}
                      {stage.isBlocked && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                          <ShieldAlert className="w-3 h-3" />
                          Bloqueada
                        </span>
                      )}
                      
                      <button className="p-2 text-zinc-500 hover:text-white transition-colors ml-2">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-8 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/20 p-6 flex flex-col items-center justify-center text-center">
               <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 mb-3">
                 <LayoutTemplate className="w-5 h-5" />
               </div>
               <p className="text-zinc-400 text-sm font-medium">
                 Arraste os blocos pelas laterais esquerdas para reordenar o fluxo.<br/>
                 Novos projetos baseados neste modelo herdarão esta estrutura exata.
               </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
