import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  LayoutTemplate, 
  PlayCircle,
  Camera,
  ArrowRight,
  Settings2
} from 'lucide-react';
import { cn } from '../lib/utils';

// --- DADOS FALSOS ---
export const MOCK_MODELS = [
  {
    id: '1',
    name: 'Podcast Premium',
    description: 'Fluxo completo de gravação, edição e aprovação de episódio.',
    icon: PlayCircle,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400/10',
    borderColor: 'border-emerald-400/20',
    stagesCount: 6,
    activeProjects: 12,
    updatedAt: '12/05/2026'
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
    activeProjects: 5,
    updatedAt: '10/05/2026'
  }
];
// --------------------

export default function ModelosFluxo() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const filteredModels = MOCK_MODELS.filter(model => 
    model.name.toLowerCase().includes(search.toLowerCase()) || 
    model.description.toLowerCase().includes(search.toLowerCase())
  );

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
            Crie o DNA dos seus serviços. Defina as etapas padrão, prazos e regras para cada tipo de projeto.
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

      <section className="rounded-[32px] border border-zinc-800 bg-[#101010] overflow-hidden">
        <div className="px-6 py-5 border-b border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-white text-xl font-black uppercase">Biblioteca de Modelos</p>
            <p className="text-zinc-500 text-sm mt-1">
              Gerencie os templates de processos operacionais da sua produtora.
            </p>
          </div>
          <div className="text-xs uppercase tracking-[0.25em] font-black text-zinc-500">
            {filteredModels.length} modelo(s)
          </div>
        </div>

        <div className="hidden xl:grid xl:grid-cols-[1.5fr_120px_160px_140px_100px] gap-4 px-6 py-4 border-b border-zinc-800/80 text-[10px] uppercase tracking-[0.25em] font-black text-zinc-500">
          <span>Nome do Modelo</span>
          <span className="text-center">Etapas</span>
          <span className="text-center">Projetos Ativos</span>
          <span>Atualizado em</span>
          <span className="text-right">Ação</span>
        </div>

        {filteredModels.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <LayoutTemplate className="w-12 h-12 text-zinc-700 mb-4" />
            <p className="text-zinc-400 font-medium text-lg">Nenhum modelo encontrado.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/70">
            {filteredModels.map((model) => (
              <div
                key={model.id}
                onClick={() => navigate(`/modelos/${model.id}`)}
                className="group relative px-6 py-5 transition-all cursor-pointer hover:bg-[linear-gradient(90deg,rgba(255,83,81,0.08),rgba(255,83,81,0.02),transparent)]"
              >
                <div className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-[#ff5351] opacity-0 group-hover:opacity-100 transition-all" />

                <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_120px_160px_140px_100px] gap-4 items-center">
                  
                  {/* Coluna 1: Info Principal */}
                  <div className="min-w-0 flex items-start gap-4">
                    <div className={cn('w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0', model.bgColor, model.borderColor)}>
                      <model.icon className={cn('w-5 h-5', model.color)} />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-white font-black uppercase text-base truncate">{model.name}</p>
                      <p className="text-zinc-500 text-sm mt-1 truncate">{model.description}</p>
                    </div>
                  </div>

                  {/* Coluna 2: Qtd Etapas */}
                  <div className="hidden xl:flex flex-col items-center">
                    <span className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 font-black text-sm">
                      {model.stagesCount}
                    </span>
                  </div>

                  {/* Coluna 3: Projetos Ativos */}
                  <div className="hidden xl:flex flex-col items-center">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ff5351]/10 border border-[#ff5351]/20 text-[#ff5351] font-black text-sm">
                      {model.activeProjects}
                    </span>
                  </div>

                  {/* Coluna 4: Atualização */}
                  <div className="hidden xl:block">
                    <p className="text-white text-sm font-bold">{model.updatedAt}</p>
                  </div>

                  {/* Coluna 5: Ação */}
                  <div className="flex justify-end xl:block">
                    <button className="h-10 w-full xl:w-auto px-4 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-300 font-black text-[10px] uppercase tracking-widest group-hover:text-white group-hover:border-[#ff5351]/50 transition-all flex items-center justify-center xl:justify-end gap-2">
                      <Settings2 className="w-3.5 h-3.5" />
                      Editar
                      <ArrowRight className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </button>
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
