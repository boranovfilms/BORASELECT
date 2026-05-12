import { ChevronRight, CircleDollarSign, FolderKanban, Package2, Plus } from 'lucide-react';

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
            Selecione um serviço na lista para visualizar os pacotes, valores e itens incluídos.
          </p>
        </div>

        <button className="h-12 px-6 rounded-xl bg-[#ff5351] text-white font-black uppercase tracking-widest text-xs hover:brightness-110 transition-all shadow-2xl shadow-[#ff5351]/20 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Novo Serviço
        </button>
      </header>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-4 bg-[#1a1a1a] border border-zinc-800 rounded-3xl p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black mb-2">
                Lista de Serviços
              </p>
              <h2 className="text-white font-black uppercase tracking-tight text-xl">
                Serviços cadastrados
              </h2>
            </div>
          </div>

          <div className="space-y-3">
            <button className="w-full text-left rounded-2xl border border-[#ff5351]/30 bg-[#ff5351]/10 px-5 py-5 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-white font-black uppercase text-sm tracking-wide">Vitrine Talk</p>
                  <p className="text-zinc-400 text-xs mt-1">Categoria: Podcast</p>
                  <p className="text-zinc-500 text-xs mt-2">3 pacotes cadastrados</p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#ff5351] mt-1" />
              </div>
            </button>

            <button className="w-full text-left rounded-2xl border border-zinc-800 bg-zinc-900/70 px-5 py-5 hover:border-zinc-700 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-white font-black uppercase text-sm tracking-wide">Podcast Mensal 4h</p>
                  <p className="text-zinc-500 text-xs mt-1">Categoria: Podcast</p>
                  <p className="text-zinc-600 text-xs mt-2">2 pacotes cadastrados</p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500 mt-1" />
              </div>
            </button>

            <button className="w-full text-left rounded-2xl border border-zinc-800 bg-zinc-900/70 px-5 py-5 hover:border-zinc-700 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-white font-black uppercase text-sm tracking-wide">Podcast Avulso</p>
                  <p className="text-zinc-500 text-xs mt-1">Categoria: Podcast</p>
                  <p className="text-zinc-600 text-xs mt-2">1 pacote cadastrado</p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500 mt-1" />
              </div>
            </button>

            <button className="w-full text-left rounded-2xl border border-zinc-800 bg-zinc-900/70 px-5 py-5 hover:border-zinc-700 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-white font-black uppercase text-sm tracking-wide">Fotos Evento</p>
                  <p className="text-zinc-500 text-xs mt-1">Categoria: Fotos</p>
                  <p className="text-zinc-600 text-xs mt-2">4 pacotes cadastrados</p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500 mt-1" />
              </div>
            </button>

            <button className="w-full text-left rounded-2xl border border-dashed border-zinc-700 px-5 py-5 hover:border-[#ff5351]/40 transition-all text-zinc-500 hover:text-white">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-widest">Novo serviço</span>
              </div>
            </button>
          </div>
        </div>

        <div className="xl:col-span-8 space-y-6">
          <div className="bg-[#1a1a1a] border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black mb-2">
                  Serviço selecionado
                </p>
                <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight">
                  Vitrine Talk
                </h2>
                <p className="text-[#ff5351] text-sm font-bold mt-2 uppercase tracking-widest">
                  Categoria: Podcast
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button className="px-5 py-3 rounded-xl border border-zinc-700 text-zinc-300 font-black uppercase tracking-widest text-xs hover:bg-zinc-800 transition-all">
                  Editar Serviço
                </button>
                <button className="px-5 py-3 rounded-xl bg-[#ff5351] text-white font-black uppercase tracking-widest text-xs hover:brightness-110 transition-all">
                  Novo Pacote
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-[#1a1a1a] border border-zinc-800 rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center gap-3 mb-5">
                <Package2 className="w-5 h-5 text-[#ff5351]" />
                <div>
                  <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black">Pacote</p>
                  <h3 className="text-white text-2xl font-black uppercase">Start</h3>
                </div>
              </div>

              <p className="text-[#ff5351] text-3xl font-black mb-4">R$ 1.550,00</p>

              <div className="space-y-2 text-sm text-zinc-300">
                <p>• Episódio de até 35 minutos</p>
                <p>• 5 cortes para redes sociais</p>
                <p>• 1 post no Instagram</p>
                <p>• Vídeo na íntegra no YouTube</p>
              </div>
            </div>

            <div className="bg-[#1a1a1a] border border-[#ff5351]/30 rounded-3xl p-6 shadow-2xl shadow-[#ff5351]/10">
              <div className="flex items-center gap-3 mb-5">
                <Package2 className="w-5 h-5 text-[#ff5351]" />
                <div>
                  <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black">Pacote</p>
                  <h3 className="text-white text-2xl font-black uppercase">Plus</h3>
                </div>
              </div>

              <p className="text-[#ff5351] text-3xl font-black mb-4">R$ 1.880,00</p>

              <div className="space-y-2 text-sm text-zinc-300">
                <p>• Episódio de até 45 minutos</p>
                <p>• 7 cortes para redes sociais</p>
                <p>• 1 post no Instagram</p>
                <p>• 2 cortes em VT</p>
                <p>• Vídeo na íntegra no YouTube</p>
              </div>
            </div>

            <div className="bg-[#1a1a1a] border border-zinc-800 rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center gap-3 mb-5">
                <Package2 className="w-5 h-5 text-[#ff5351]" />
                <div>
                  <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black">Pacote</p>
                  <h3 className="text-white text-2xl font-black uppercase">Premium</h3>
                </div>
              </div>

              <p className="text-[#ff5351] text-3xl font-black mb-4">R$ 2.450,00</p>

              <div className="space-y-2 text-sm text-zinc-300">
                <p>• Episódio de 40 a 60 minutos</p>
                <p>• 15 cortes para Reels e Shorts</p>
                <p>• Áudio pronto para Spotify</p>
                <p>• Fotos profissionais na gravação</p>
              </div>
            </div>
          </div>

          <div className="bg-[#1a1a1a] border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <CircleDollarSign className="w-5 h-5 text-[#ff5351]" />
              <div>
                <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black">Resumo do controle</p>
                <h3 className="text-white text-xl font-black uppercase tracking-tight">Informações comerciais</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Categoria</p>
                <p className="text-white text-lg font-black">Podcast</p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Serviço</p>
                <p className="text-white text-lg font-black">Vitrine Talk</p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Pacotes</p>
                <p className="text-white text-lg font-black">3 ativos</p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Adicionais</p>
                <p className="text-white text-lg font-black">Definir depois</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-dashed border-zinc-700 p-5 text-zinc-500 text-sm">
              Aqui depois podemos colocar a lógica de créditos, quantidade de seleções, valor por item adicional e regras específicas de cada serviço.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
