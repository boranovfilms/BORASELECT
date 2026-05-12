import { FolderTree, Layers3, Package, Plus, ChevronRight, CircleDollarSign, BadgeCheck } from 'lucide-react';

export default function Packages() {
  return (
    <div className="space-y-10 pb-20">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5351] font-black mb-3">
            Estrutura Comercial
          </p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase italic">
            Cadastro de Pacotes
          </h1>
          <p className="text-zinc-500 text-base md:text-lg mt-3 max-w-3xl">
            Organize seus serviços por categoria, depois por serviço, e dentro de cada serviço controle os pacotes,
            valores, créditos e itens inclusos.
          </p>
        </div>

        <button className="h-12 px-6 rounded-xl bg-[#ff5351] text-white font-black uppercase tracking-widest text-xs hover:brightness-110 transition-all shadow-2xl shadow-[#ff5351]/20 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Novo Cadastro
        </button>
      </header>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-3 bg-[#1a1a1a] border border-zinc-800 rounded-3xl p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-[#ff5351]/10 flex items-center justify-center">
              <FolderTree className="w-5 h-5 text-[#ff5351]" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black">Nível 1</p>
              <h2 className="text-white font-black uppercase tracking-tight">Categorias</h2>
            </div>
          </div>

          <div className="space-y-3">
            <button className="w-full text-left rounded-2xl border border-[#ff5351]/30 bg-[#ff5351]/10 px-4 py-4 transition-all">
              <p className="text-white font-black uppercase text-sm tracking-wide">Podcast</p>
              <p className="text-zinc-400 text-xs mt-1">Serviços de gravação, cortes e distribuição</p>
            </button>

            <button className="w-full text-left rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-4 hover:border-zinc-700 transition-all">
              <p className="text-white font-black uppercase text-sm tracking-wide">Fotos</p>
              <p className="text-zinc-500 text-xs mt-1">Ensaios, eventos e coberturas</p>
            </button>

            <button className="w-full text-left rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-4 hover:border-zinc-700 transition-all">
              <p className="text-white font-black uppercase text-sm tracking-wide">Conteúdo</p>
              <p className="text-zinc-500 text-xs mt-1">Reels, shorts e produção recorrente</p>
            </button>

            <button className="w-full text-left rounded-2xl border border-dashed border-zinc-700 px-4 py-4 hover:border-[#ff5351]/40 transition-all text-zinc-500 hover:text-white">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-widest">Nova categoria</span>
              </div>
            </button>
          </div>
        </div>

        <div className="xl:col-span-3 bg-[#1a1a1a] border border-zinc-800 rounded-3xl p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-[#ff5351]/10 flex items-center justify-center">
              <Layers3 className="w-5 h-5 text-[#ff5351]" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black">Nível 2</p>
              <h2 className="text-white font-black uppercase tracking-tight">Serviços</h2>
            </div>
          </div>

          <div className="space-y-3">
            <button className="w-full text-left rounded-2xl border border-[#ff5351]/30 bg-[#ff5351]/10 px-4 py-4 transition-all">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-white font-black uppercase text-sm tracking-wide">Vitrine Talk</p>
                  <p className="text-zinc-400 text-xs mt-1">Serviço com 3 pacotes comerciais</p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#ff5351]" />
              </div>
            </button>

            <button className="w-full text-left rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-4 hover:border-zinc-700 transition-all">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-white font-black uppercase text-sm tracking-wide">Podcast Mensal 4h</p>
                  <p className="text-zinc-500 text-xs mt-1">Pacotes com horas mensais e cortes</p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500" />
              </div>
            </button>

            <button className="w-full text-left rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-4 hover:border-zinc-700 transition-all">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-white font-black uppercase text-sm tracking-wide">Podcast Avulso</p>
                  <p className="text-zinc-500 text-xs mt-1">Modelo rápido para contratação pontual</p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500" />
              </div>
            </button>

            <button className="w-full text-left rounded-2xl border border-dashed border-zinc-700 px-4 py-4 hover:border-[#ff5351]/40 transition-all text-zinc-500 hover:text-white">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-widest">Novo serviço</span>
              </div>
            </button>
          </div>
        </div>

        <div className="xl:col-span-3 bg-[#1a1a1a] border border-zinc-800 rounded-3xl p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-[#ff5351]/10 flex items-center justify-center">
              <Package className="w-5 h-5 text-[#ff5351]" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black">Nível 3</p>
              <h2 className="text-white font-black uppercase tracking-tight">Pacotes</h2>
            </div>
          </div>

          <div className="space-y-3">
            <button className="w-full text-left rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-4 hover:border-zinc-700 transition-all">
              <p className="text-white font-black uppercase text-sm tracking-wide">Start</p>
              <p className="text-zinc-500 text-xs mt-1">Entrada / pacote 1</p>
            </button>

            <button className="w-full text-left rounded-2xl border border-[#ff5351]/30 bg-[#ff5351]/10 px-4 py-4 transition-all">
              <p className="text-white font-black uppercase text-sm tracking-wide">Plus</p>
              <p className="text-zinc-400 text-xs mt-1">Pacote intermediário</p>
            </button>

            <button className="w-full text-left rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-4 hover:border-zinc-700 transition-all">
              <p className="text-white font-black uppercase text-sm tracking-wide">Premium</p>
              <p className="text-zinc-500 text-xs mt-1">Pacote completo</p>
            </button>

            <button className="w-full text-left rounded-2xl border border-dashed border-zinc-700 px-4 py-4 hover:border-[#ff5351]/40 transition-all text-zinc-500 hover:text-white">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-widest">Novo pacote</span>
              </div>
            </button>
          </div>
        </div>

        <div className="xl:col-span-3 bg-[#1a1a1a] border border-zinc-800 rounded-3xl p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-[#ff5351]/10 flex items-center justify-center">
              <BadgeCheck className="w-5 h-5 text-[#ff5351]" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black">Detalhes</p>
              <h2 className="text-white font-black uppercase tracking-tight">Pacote Selecionado</h2>
            </div>
          </div>

          <div className="rounded-3xl border border-[#ff5351]/20 bg-zinc-900/70 p-5 mb-5">
            <p className="text-zinc-500 text-[10px] uppercase tracking-[0.2em] font-black mb-2">Serviço atual</p>
            <h3 className="text-white text-2xl font-black uppercase tracking-tight">Vitrine Talk</h3>
            <p className="text-[#ff5351] text-sm font-bold mt-1">Pacote Plus</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Valor</p>
              <p className="text-white text-xl font-black">R$ 1.880,00</p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Seleções</p>
              <p className="text-white text-xl font-black">7 cortes</p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Adicional</p>
              <p className="text-white text-xl font-black">Definir</p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Tipo</p>
              <p className="text-white text-xl font-black">Podcast</p>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-center gap-2 mb-4">
              <CircleDollarSign className="w-4 h-4 text-[#ff5351]" />
              <p className="text-white text-sm font-black uppercase tracking-widest">Itens inclusos</p>
            </div>

            <div className="space-y-3 text-sm text-zinc-300">
              <p>• Episódio de até 45 minutos</p>
              <p>• Briefing sobre seu negócio</p>
              <p>• 7 cortes para redes sociais</p>
              <p>• 1 post no Instagram</p>
              <p>• 2 cortes para VT</p>
              <p>• Vídeo na íntegra para YouTube</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
