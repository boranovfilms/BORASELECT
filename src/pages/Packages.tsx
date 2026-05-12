export default function Packages() {
  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase italic">
            Cadastro de Pacotes
          </h1>
          <p className="text-zinc-500 text-lg mt-2">
            Área visual para organizar pacotes e serviços.
          </p>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#1f1f1f] border border-zinc-800 rounded-3xl p-8 shadow-2xl">
          <div className="mb-6">
            <p className="text-zinc-500 text-xs uppercase tracking-[0.2em] font-black">Pacote 1</p>
            <h2 className="text-3xl font-black text-white mt-2">Start</h2>
            <p className="text-[#ff5351] text-4xl font-black mt-4">R$ 1.550,00</p>
          </div>

          <div className="space-y-3 text-sm text-zinc-300">
            <p>Episódio de até 35 minutos</p>
            <p>Bate-papo para alinhar a pauta</p>
            <p>5 cortes para redes sociais</p>
            <p>1 post no Instagram</p>
            <p>Vídeo na íntegra para YouTube</p>
          </div>
        </div>

        <div className="bg-[#1f1f1f] border border-[#ff5351]/30 rounded-3xl p-8 shadow-2xl shadow-[#ff5351]/10">
          <div className="mb-6">
            <p className="text-zinc-500 text-xs uppercase tracking-[0.2em] font-black">Pacote 2</p>
            <h2 className="text-3xl font-black text-white mt-2">Plus</h2>
            <p className="text-[#ff5351] text-4xl font-black mt-4">R$ 1.880,00</p>
          </div>

          <div className="space-y-3 text-sm text-zinc-300">
            <p>Episódio de até 45 minutos</p>
            <p>Briefing sobre seu negócio</p>
            <p>7 cortes para redes sociais</p>
            <p>1 post no Instagram</p>
            <p>2 cortes no Instagram VT</p>
            <p>Vídeo na íntegra para YouTube</p>
          </div>
        </div>

        <div className="bg-[#1f1f1f] border border-zinc-800 rounded-3xl p-8 shadow-2xl">
          <div className="mb-6">
            <p className="text-zinc-500 text-xs uppercase tracking-[0.2em] font-black">Pacote 3</p>
            <h2 className="text-3xl font-black text-white mt-2">Premium</h2>
            <p className="text-[#ff5351] text-4xl font-black mt-4">R$ 2.450,00</p>
          </div>

          <div className="space-y-3 text-sm text-zinc-300">
            <p>Episódio de 40 a 60 minutos</p>
            <p>Briefing detalhado com foco nos diferenciais</p>
            <p>15 cortes para Reels e Shorts</p>
            <p>1 post no Instagram VT</p>
            <p>Vídeo na íntegra para YouTube</p>
            <p>Áudio pronto para Spotify</p>
            <p>Fotos profissionais durante a gravação</p>
          </div>
        </div>
      </section>

      <section className="bg-[#1f1f1f] border border-zinc-800 rounded-3xl p-8 shadow-2xl">
        <h3 className="text-xl font-black text-white uppercase tracking-tight mb-6">
          Observações
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <p className="text-zinc-500 uppercase text-[10px] tracking-widest font-black mb-2">
              Tipo de Serviço
            </p>
            <p className="text-white font-bold">Podcast</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <p className="text-zinc-500 uppercase text-[10px] tracking-widest font-black mb-2">
              Valor adicional
            </p>
            <p className="text-white font-bold">Definir depois</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <p className="text-zinc-500 uppercase text-[10px] tracking-widest font-black mb-2">
              Status
            </p>
            <p className="text-white font-bold">Tela visual inicial</p>
          </div>
        </div>
      </section>
    </div>
  );
}
