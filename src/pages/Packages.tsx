import { Plus, Pencil, Trash2, ChevronRight } from 'lucide-react';

const mockServices = [
  {
    id: 'SRV-001',
    name: 'Vitrine Talk',
    packageCount: 3,
    createdAt: '10/05/2026',
    updatedAt: '12/05/2026',
  },
  {
    id: 'SRV-002',
    name: 'Podcast Mensal 4H',
    packageCount: 2,
    createdAt: '08/05/2026',
    updatedAt: '11/05/2026',
  },
  {
    id: 'SRV-003',
    name: 'Podcast Avulso',
    packageCount: 1,
    createdAt: '02/05/2026',
    updatedAt: '09/05/2026',
  },
  {
    id: 'SRV-004',
    name: 'Podcast Premium',
    packageCount: 4,
    createdAt: '01/05/2026',
    updatedAt: '10/05/2026',
  },
  {
    id: 'SRV-005',
    name: 'Podcast Empresarial',
    packageCount: 2,
    createdAt: '28/04/2026',
    updatedAt: '08/05/2026',
  }
];

export default function Packages() {
  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5351] font-black mb-3">
            Estrutura Comercial
          </p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase italic">
            Cadastro de Serviços
          </h1>
          <p className="text-zinc-500 text-base md:text-lg mt-3 max-w-3xl">
            Lista de serviços cadastrados. Ao clicar em um item, você poderá visualizar os pacotes e editar depois.
          </p>
        </div>

        <button className="h-11 px-5 rounded-xl bg-[#ff5351] text-white font-black uppercase tracking-widest text-xs hover:brightness-110 transition-all shadow-2xl shadow-[#ff5351]/20 flex items-center gap-2 self-start lg:self-auto">
          <Plus className="w-4 h-4" />
          Novo Serviço
        </button>
      </header>

      <section className="bg-[#141414] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden">
        <div className="px-5 md:px-6 py-5 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black mb-2">
              Lista
            </p>
            <h2 className="text-white font-black uppercase tracking-tight text-2xl">
              Tipos de Serviço
            </h2>
          </div>

          <div className="text-[10px] uppercase tracking-widest font-black text-zinc-500">
            {mockServices.length} serviços
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr className="border-b border-zinc-800 bg-black/20">
                <th className="text-left px-5 md:px-6 py-4 text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black">ID</th>
                <th className="text-left px-5 md:px-6 py-4 text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black">Nome</th>
                <th className="text-left px-5 md:px-6 py-4 text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black">Pacotes</th>
                <th className="text-left px-5 md:px-6 py-4 text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black">Criação</th>
                <th className="text-left px-5 md:px-6 py-4 text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black">Atualização</th>
                <th className="text-right px-5 md:px-6 py-4 text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black">Ações</th>
              </tr>
            </thead>

            <tbody>
              {mockServices.map((service, index) => (
                <tr
                  key={service.id}
                  className="border-b border-zinc-800/70 hover:bg-zinc-900/40 transition-all cursor-pointer"
                >
                  <td className="px-5 md:px-6 py-4 text-sm text-zinc-400 font-mono whitespace-nowrap">
                    {service.id}
                  </td>

                  <td className="px-5 md:px-6 py-4">
                    <p className="text-white font-black uppercase text-sm tracking-wide leading-tight">
                      {service.name}
                    </p>
                  </td>

                  <td className="px-5 md:px-6 py-4 text-white font-black text-sm">
                    {service.packageCount}
                  </td>

                  <td className="px-5 md:px-6 py-4 text-zinc-400 text-sm whitespace-nowrap">
                    {service.createdAt}
                  </td>

                  <td className="px-5 md:px-6 py-4 text-zinc-400 text-sm whitespace-nowrap">
                    {service.updatedAt}
                  </td>

                  <td className="px-5 md:px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="w-9 h-9 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all flex items-center justify-center"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        className="w-9 h-9 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-red-400 hover:border-red-500/40 transition-all flex items-center justify-center"
                        title="Apagar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <button
                        className="w-9 h-9 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-[#ff5351] hover:border-[#ff5351]/30 transition-all flex items-center justify-center"
                        title="Visualizar"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
