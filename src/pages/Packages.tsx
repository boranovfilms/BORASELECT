import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Package, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

type ServicePackage = {
  id: string;
  name: string;
  price: string;
  included: string;
  additional: string;
  items: string[];
};

type ServiceType = {
  id: string;
  name: string;
  packageCount: number;
  createdAt: string;
  updatedAt: string;
  description: string;
  packages: ServicePackage[];
};

const mockServices: ServiceType[] = [
  {
    id: 'SRV-001',
    name: 'Vitrine Talk',
    packageCount: 3,
    createdAt: '10/05/2026',
    updatedAt: '12/05/2026',
    description: 'Serviço de podcast com pacotes comerciais para empresas.',
    packages: [
      {
        id: 'PKG-001',
        name: 'Start',
        price: 'R$ 1.550,00',
        included: '5 cortes',
        additional: 'Definir depois',
        items: [
          'Episódio de até 35 minutos',
          'Bate-papo para alinhar a pauta',
          '5 cortes para redes sociais',
          '1 post no Instagram',
          'Vídeo na íntegra para YouTube'
        ]
      },
      {
        id: 'PKG-002',
        name: 'Plus',
        price: 'R$ 1.880,00',
        included: '7 cortes',
        additional: 'Definir depois',
        items: [
          'Episódio de até 45 minutos',
          'Briefing sobre seu negócio',
          '7 cortes para redes sociais',
          '1 post no Instagram',
          '2 cortes no Instagram VT',
          'Vídeo na íntegra para YouTube'
        ]
      },
      {
        id: 'PKG-003',
        name: 'Premium',
        price: 'R$ 2.450,00',
        included: '15 cortes',
        additional: 'Definir depois',
        items: [
          'Episódio de 40 a 60 minutos',
          'Briefing detalhado com foco na empresa',
          '15 cortes para Reels e Shorts',
          '1 post no Instagram VT',
          'Vídeo na íntegra para YouTube',
          'Áudio pronto para Spotify',
          'Fotos profissionais durante a gravação'
        ]
      }
    ]
  },
  {
    id: 'SRV-002',
    name: 'Podcast Mensal 4h',
    packageCount: 2,
    createdAt: '08/05/2026',
    updatedAt: '11/05/2026',
    description: 'Serviço mensal com horas contratadas e entregas recorrentes.',
    packages: [
      {
        id: 'PKG-004',
        name: 'Base 4h',
        price: 'R$ 3.200,00',
        included: '12 cortes',
        additional: 'Hora extra à parte',
        items: [
          '4 horas mensais de gravação',
          'Cortes por episódio',
          'Organização mensal de pauta',
          'Entrega recorrente'
        ]
      },
      {
        id: 'PKG-005',
        name: 'Expansão 4h',
        price: 'R$ 4.100,00',
        included: '20 cortes',
        additional: 'Hora extra à parte',
        items: [
          '4 horas mensais de gravação',
          'Mais cortes por episódio',
          'Acompanhamento estratégico',
          'Entrega recorrente'
        ]
      }
    ]
  },
  {
    id: 'SRV-003',
    name: 'Podcast Avulso',
    packageCount: 1,
    createdAt: '02/05/2026',
    updatedAt: '09/05/2026',
    description: 'Modelo pontual para gravação avulsa.',
    packages: [
      {
        id: 'PKG-006',
        name: 'Avulso',
        price: 'R$ 950,00',
        included: '3 cortes',
        additional: 'Definir depois',
        items: [
          '1 gravação avulsa',
          '3 cortes para redes sociais',
          'Arquivo principal finalizado'
        ]
      }
    ]
  }
];

export default function Packages() {
  const [selectedServiceId, setSelectedServiceId] = useState(mockServices[0].id);

  const selectedService = useMemo(
    () => mockServices.find(service => service.id === selectedServiceId) || mockServices[0],
    [selectedServiceId]
  );

  return (
    <div className="space-y-10 pb-20">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5351] font-black mb-3">
            Estrutura Comercial
          </p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase italic">
            Cadastro de Serviços
          </h1>
          <p className="text-zinc-500 text-base md:text-lg mt-3 max-w-3xl">
            Cadastre seus tipos de serviço e clique em uma linha para visualizar os pacotes vinculados.
          </p>
        </div>

        <button className="h-12 px-6 rounded-xl bg-[#ff5351] text-white font-black uppercase tracking-widest text-xs hover:brightness-110 transition-all shadow-2xl shadow-[#ff5351]/20 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Novo Serviço
        </button>
      </header>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 bg-[#1a1a1a] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black mb-2">
                Lista
              </p>
              <h2 className="text-white font-black uppercase tracking-tight text-xl">
                Tipos de serviço
              </h2>
            </div>
            <div className="text-[10px] uppercase tracking-widest font-black text-zinc-500">
              {mockServices.length} serviços
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/40">
                  <th className="text-left px-6 py-4 text-[10px] uppercase tracking-widest text-zinc-500 font-black">ID</th>
                  <th className="text-left px-6 py-4 text-[10px] uppercase tracking-widest text-zinc-500 font-black">Nome</th>
                  <th className="text-left px-6 py-4 text-[10px] uppercase tracking-widest text-zinc-500 font-black">Pacotes</th>
                  <th className="text-left px-6 py-4 text-[10px] uppercase tracking-widest text-zinc-500 font-black">Criação</th>
                  <th className="text-left px-6 py-4 text-[10px] uppercase tracking-widest text-zinc-500 font-black">Atualização</th>
                  <th className="text-right px-6 py-4 text-[10px] uppercase tracking-widest text-zinc-500 font-black">Ações</th>
                </tr>
              </thead>
              <tbody>
                {mockServices.map((service) => (
                  <tr
                    key={service.id}
                    onClick={() => setSelectedServiceId(service.id)}
                    className={cn(
                      'border-b border-zinc-800/80 cursor-pointer transition-all',
                      selectedServiceId === service.id
                        ? 'bg-[#ff5351]/10'
                        : 'hover:bg-zinc-900/70'
                    )}
                  >
                    <td className="px-6 py-5 text-sm font-mono text-zinc-400">{service.id}</td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-white font-black uppercase text-sm tracking-wide">
                            {service.name}
                          </p>
                          <p className="text-zinc-500 text-xs mt-1">
                            {service.description}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-white font-bold">{service.packageCount}</td>
                    <td className="px-6 py-5 text-zinc-400 text-sm">{service.createdAt}</td>
                    <td className="px-6 py-5 text-zinc-400 text-sm">{service.updatedAt}</td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="w-9 h-9 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all flex items-center justify-center"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="w-9 h-9 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-red-400 hover:border-red-500/40 transition-all flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="w-9 h-9 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-500 flex items-center justify-center">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="xl:col-span-5 bg-[#1a1a1a] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-zinc-800">
            <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black mb-2">
              Visualização
            </p>
            <h2 className="text-white font-black uppercase tracking-tight text-xl">
              {selectedService.name}
            </h2>
            <p className="text-zinc-500 text-sm mt-2">
              {selectedService.description}
            </p>
          </div>

          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">ID</p>
                <p className="text-white text-lg font-black">{selectedService.id}</p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Pacotes</p>
                <p className="text-white text-lg font-black">{selectedService.packageCount}</p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Criação</p>
                <p className="text-white text-lg font-black">{selectedService.createdAt}</p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
                <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Atualização</p>
                <p className="text-white text-lg font-black">{selectedService.updatedAt}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#ff5351]" />
                  <p className="text-white text-sm font-black uppercase tracking-widest">
                    Pacotes desse serviço
                  </p>
                </div>
                <button className="text-[#ff5351] text-[10px] font-black uppercase tracking-widest hover:underline">
                  Novo pacote
                </button>
              </div>

              <div className="space-y-4">
                {selectedService.packages.map((pkg) => (
                  <div key={pkg.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <p className="text-white font-black uppercase text-lg">{pkg.name}</p>
                        <p className="text-zinc-500 text-xs mt-1">{pkg.id}</p>
                      </div>
                      <p className="text-[#ff5351] font-black text-xl whitespace-nowrap">{pkg.price}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="rounded-xl border border-zinc-800 bg-[#141414] p-3">
                        <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-1">Seleções</p>
                        <p className="text-white font-black">{pkg.included}</p>
                      </div>
                      <div className="rounded-xl border border-zinc-800 bg-[#141414] p-3">
                        <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-1">Adicional</p>
                        <p className="text-white font-black">{pkg.additional}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black">Itens incluídos</p>
                      <div className="space-y-2">
                        {pkg.items.map((item, index) => (
                          <p key={index} className="text-sm text-zinc-300">
                            • {item}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-zinc-700 p-4 text-zinc-500 text-sm">
              Depois você pode me passar os campos exatos do cadastro de serviço, que eu transformo essa visualização em tela de cadastro real.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
