import { useState } from 'react';
import { Plus, Pencil, Trash2, ChevronRight, ArrowLeft, Save, X, PackagePlus, Copy } from 'lucide-react';

type ServicePackage = {
  id: string;
  name: string;
  price: string;
  includedSelections: string;
  additionalPrice: string;
  description: string;
  items: string[];
};

type ServiceType = {
  id: string;
  name: string;
  category: string;
  selectionUnit: string;
  status: 'Ativo' | 'Inativo';
  description: string;
  internalNotes: string;
  packageCount: number;
  createdAt: string;
  updatedAt: string;
  packages: ServicePackage[];
};

const initialServices: ServiceType[] = [
  {
    id: 'SRV-001',
    name: 'Vitrine Talk',
    category: 'Podcast',
    selectionUnit: 'Cortes',
    status: 'Ativo',
    description: 'Serviço comercial para podcast com pacotes por nível de entrega.',
    internalNotes: '',
    packageCount: 3,
    createdAt: '10/05/2026',
    updatedAt: '12/05/2026',
    packages: [
      {
        id: 'PKG-001',
        name: 'Start',
        price: 'R$ 1.550,00',
        includedSelections: '5',
        additionalPrice: 'Definir depois',
        description: 'Pacote de entrada',
        items: [
          'Episódio de até 35 minutos',
          '5 cortes para redes sociais',
          '1 post no Instagram',
          'Vídeo na íntegra para YouTube'
        ]
      },
      {
        id: 'PKG-002',
        name: 'Plus',
        price: 'R$ 1.880,00',
        includedSelections: '7',
        additionalPrice: 'Definir depois',
        description: 'Pacote intermediário',
        items: [
          'Episódio de até 45 minutos',
          '7 cortes para redes sociais',
          '1 post no Instagram',
          '2 cortes em VT',
          'Vídeo na íntegra para YouTube'
        ]
      },
      {
        id: 'PKG-003',
        name: 'Premium',
        price: 'R$ 2.450,00',
        includedSelections: '15',
        additionalPrice: 'Definir depois',
        description: 'Pacote completo',
        items: [
          'Episódio de 40 a 60 minutos',
          '15 cortes para Reels e Shorts',
          'Vídeo na íntegra para YouTube',
          'Áudio pronto para Spotify'
        ]
      }
    ]
  },
  {
    id: 'SRV-002',
    name: 'Podcast Mensal 4H',
    category: 'Podcast',
    selectionUnit: 'Cortes',
    status: 'Ativo',
    description: 'Serviço mensal com horas contratadas e entregas recorrentes.',
    internalNotes: '',
    packageCount: 2,
    createdAt: '08/05/2026',
    updatedAt: '11/05/2026',
    packages: [
      {
        id: 'PKG-004',
        name: 'Base 4H',
        price: 'R$ 3.200,00',
        includedSelections: '12',
        additionalPrice: 'Hora extra à parte',
        description: 'Plano mensal base',
        items: [
          '4 horas mensais de gravação',
          '12 cortes por mês',
          'Organização recorrente'
        ]
      },
      {
        id: 'PKG-005',
        name: 'Expansão 4H',
        price: 'R$ 4.100,00',
        includedSelections: '20',
        additionalPrice: 'Hora extra à parte',
        description: 'Plano mensal ampliado',
        items: [
          '4 horas mensais de gravação',
          '20 cortes por mês',
          'Acompanhamento estratégico'
        ]
      }
    ]
  },
  {
    id: 'SRV-003',
    name: 'Podcast Avulso',
    category: 'Podcast',
    selectionUnit: 'Cortes',
    status: 'Ativo',
    description: 'Modelo pontual para gravação avulsa.',
    internalNotes: '',
    packageCount: 1,
    createdAt: '02/05/2026',
    updatedAt: '09/05/2026',
    packages: [
      {
        id: 'PKG-006',
        name: 'Avulso',
        price: 'R$ 950,00',
        includedSelections: '3',
        additionalPrice: 'Definir depois',
        description: 'Gravação pontual',
        items: [
          '1 gravação avulsa',
          '3 cortes para redes sociais',
          'Arquivo principal finalizado'
        ]
      }
    ]
  }
];

const emptyPackageDraft = {
  name: '',
  price: '',
  includedSelections: '',
  additionalPrice: '',
  description: '',
  items: [] as string[]
};

type ViewMode = 'list' | 'service-details' | 'package-details' | 'form';

export default function Packages() {
  const [services, setServices] = useState<ServiceType[]>(initialServices);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<ServicePackage | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  const [serviceName, setServiceName] = useState('');
  const [serviceCategory, setServiceCategory] = useState('Podcast');
  const [selectionUnit, setSelectionUnit] = useState('Cortes');
  const [serviceStatus, setServiceStatus] = useState<'Ativo' | 'Inativo'>('Ativo');
  const [serviceDescription, setServiceDescription] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  const [servicePackages, setServicePackages] = useState<ServicePackage[]>([]);
  const [packageDraft, setPackageDraft] = useState(emptyPackageDraft);
  const [packageItemInput, setPackageItemInput] = useState('');

  const resetForm = () => {
    setEditingServiceId(null);
    setServiceName('');
    setServiceCategory('Podcast');
    setSelectionUnit('Cortes');
    setServiceStatus('Ativo');
    setServiceDescription('');
    setInternalNotes('');
    setServicePackages([]);
    setPackageDraft(emptyPackageDraft);
    setPackageItemInput('');
  };

  const formatToday = () => {
    return new Date().toLocaleDateString('pt-BR');
  };

  const generateServiceId = () => {
    const nextNumber = services.length + 1;
    return `SRV-${String(nextNumber).padStart(3, '0')}`;
  };

  const generatePackageId = () => {
    const totalPackages = services.reduce((acc, service) => acc + service.packages.length, 0) + servicePackages.length + 1;
    return `PKG-${String(totalPackages).padStart(3, '0')}`;
  };

  const openCreateForm = () => {
    resetForm();
    setViewMode('form');
  };

  const openServiceDetails = (service: ServiceType) => {
    setSelectedService(service);
    setSelectedPackage(null);
    setViewMode('service-details');
  };

  const openPackageDetails = (service: ServiceType, pkg: ServicePackage) => {
    setSelectedService(service);
    setSelectedPackage(pkg);
    setViewMode('package-details');
  };

  const openEditForm = (service: ServiceType) => {
    setEditingServiceId(service.id);
    setServiceName(service.name);
    setServiceCategory(service.category);
    setSelectionUnit(service.selectionUnit);
    setServiceStatus(service.status);
    setServiceDescription(service.description);
    setInternalNotes(service.internalNotes);
    setServicePackages(service.packages);
    setPackageDraft(emptyPackageDraft);
    setPackageItemInput('');
    setViewMode('form');
  };

  const deleteService = (serviceId: string) => {
    const confirmed = window.confirm('Deseja apagar este serviço?');
    if (!confirmed) return;

    setServices(prev => prev.filter(service => service.id !== serviceId));

    if (selectedService?.id === serviceId) {
      setSelectedService(null);
      setSelectedPackage(null);
      setViewMode('list');
    }
  };

  const addPackageItem = () => {
    const cleanItem = packageItemInput.trim();
    if (!cleanItem) return;

    setPackageDraft(prev => ({
      ...prev,
      items: [...prev.items, cleanItem]
    }));
    setPackageItemInput('');
  };

  const removePackageItem = (index: number) => {
    setPackageDraft(prev => ({
      ...prev,
      items: prev.items.filter((_, itemIndex) => itemIndex !== index)
    }));
  };

  const addPackageToService = () => {
    if (!packageDraft.name.trim()) {
      alert('Preencha o nome do pacote.');
      return;
    }

    if (!packageDraft.price.trim()) {
      alert('Preencha o valor do pacote.');
      return;
    }

    if (!packageDraft.includedSelections.trim()) {
      alert('Preencha a quantidade liberada no pacote.');
      return;
    }

    const newPackage: ServicePackage = {
      id: generatePackageId(),
      name: packageDraft.name.trim(),
      price: packageDraft.price.trim(),
      includedSelections: packageDraft.includedSelections.trim(),
      additionalPrice: packageDraft.additionalPrice.trim() || 'Definir depois',
      description: packageDraft.description.trim(),
      items: packageDraft.items
    };

    setServicePackages(prev => [...prev, newPackage]);
    setPackageDraft(emptyPackageDraft);
    setPackageItemInput('');
  };

  const removeServicePackage = (packageId: string) => {
    setServicePackages(prev => prev.filter(pkg => pkg.id !== packageId));
  };

  const saveService = () => {
    if (!serviceName.trim()) {
      alert('Preencha o nome do serviço.');
      return;
    }

    if (!serviceCategory.trim()) {
      alert('Preencha a categoria do serviço.');
      return;
    }

    if (servicePackages.length === 0) {
      alert('Adicione pelo menos 1 pacote ao serviço.');
      return;
    }

    const today = formatToday();

    if (editingServiceId) {
      const updatedServices = services.map(service => {
        if (service.id !== editingServiceId) return service;

        return {
          ...service,
          name: serviceName.trim(),
          category: serviceCategory,
          selectionUnit,
          status: serviceStatus,
          description: serviceDescription.trim(),
          internalNotes: internalNotes.trim(),
          packageCount: servicePackages.length,
          updatedAt: today,
          packages: servicePackages
        };
      });

      setServices(updatedServices);

      const updatedSelectedService = updatedServices.find(service => service.id === editingServiceId) || null;
      setSelectedService(updatedSelectedService);
    } else {
      const newService: ServiceType = {
        id: generateServiceId(),
        name: serviceName.trim(),
        category: serviceCategory,
        selectionUnit,
        status: serviceStatus,
        description: serviceDescription.trim(),
        internalNotes: internalNotes.trim(),
        packageCount: servicePackages.length,
        createdAt: today,
        updatedAt: today,
        packages: servicePackages
      };

      setServices(prev => [newService, ...prev]);
      setSelectedService(newService);
    }

    resetForm();
    setViewMode('list');
  };

  if (viewMode === 'package-details' && selectedService && selectedPackage) {
    return (
      <div className="space-y-8 pb-20">
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <button
              onClick={() => setViewMode('service-details')}
              className="mb-4 flex items-center gap-2 text-zinc-500 hover:text-white transition-all text-xs font-bold uppercase tracking-widest"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar para pacotes
            </button>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5351] font-black mb-3">
              Detalhes do Pacote
            </p>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase italic">
              {selectedPackage.name}
            </h1>
            <p className="text-zinc-500 text-base md:text-lg mt-3 max-w-3xl">
              Serviço: {selectedService.name}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="h-11 px-5 rounded-xl border border-zinc-700 text-zinc-200 font-black uppercase tracking-widest text-xs hover:bg-zinc-800 transition-all flex items-center gap-2">
              <Pencil className="w-4 h-4" />
              Editar pacote
            </button>
            <button className="h-11 px-5 rounded-xl border border-zinc-700 text-zinc-200 font-black uppercase tracking-widest text-xs hover:bg-zinc-800 transition-all flex items-center gap-2">
              <Copy className="w-4 h-4" />
              Duplicar
            </button>
            <button className="h-11 px-5 rounded-xl border border-red-500/30 text-red-400 font-black uppercase tracking-widest text-xs hover:bg-red-500/10 transition-all flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Apagar
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-zinc-800 bg-[#151515] p-5">
            <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Valor</p>
            <p className="text-white text-2xl font-black">{selectedPackage.price}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-[#151515] p-5">
            <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Libera</p>
            <p className="text-white text-2xl font-black">
              {selectedPackage.includedSelections}
            </p>
            <p className="text-zinc-500 text-xs mt-1">{selectedService.selectionUnit.toLowerCase()}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-[#151515] p-5">
            <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Adicional</p>
            <p className="text-white text-xl font-black">{selectedPackage.additionalPrice}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-[#151515] p-5">
            <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Itens</p>
            <p className="text-white text-2xl font-black">{selectedPackage.items.length}</p>
          </div>
        </section>

        <section className="bg-[#141414] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden">
          <div className="px-5 md:px-6 py-5 border-b border-zinc-800">
            <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black mb-2">
              Conteúdo do pacote
            </p>
            <h2 className="text-white font-black uppercase tracking-tight text-2xl">
              Itens inclusos
            </h2>
            {selectedPackage.description && (
              <p className="text-zinc-500 text-sm mt-2">{selectedPackage.description}</p>
            )}
          </div>

          <div className="divide-y divide-zinc-800">
            {selectedPackage.items.map((item, index) => (
              <div key={index} className="px-5 md:px-6 py-4 flex items-center gap-4">
                <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 text-xs font-black shrink-0">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <p className="text-white text-sm font-medium">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[#141414] border border-zinc-800 rounded-3xl p-5 md:p-6 shadow-2xl">
          <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black mb-3">
            Aplicação futura
          </p>
          <div className="space-y-2 text-sm text-zinc-300">
            <p>• Ao escolher este pacote no projeto, o sistema poderá carregar automaticamente a quantidade liberada.</p>
            <p>• Neste caso: <span className="text-white font-black">{selectedPackage.includedSelections} {selectedService.selectionUnit.toLowerCase()}</span>.</p>
            <p>• O valor do adicional ficará em <span className="text-white font-black">{selectedPackage.additionalPrice}</span>.</p>
          </div>
        </section>
      </div>
    );
  }

  if (viewMode === 'service-details' && selectedService) {
    return (
      <div className="space-y-8 pb-20">
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <button
              onClick={() => setViewMode('list')}
              className="mb-4 flex items-center gap-2 text-zinc-500 hover:text-white transition-all text-xs font-bold uppercase tracking-widest"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar para lista
            </button>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5351] font-black mb-3">
              Serviço Selecionado
            </p>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase italic">
              {selectedService.name}
            </h1>
            <p className="text-zinc-500 text-base md:text-lg mt-3 max-w-3xl">
              Clique em um pacote para visualizar os detalhes.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => openEditForm(selectedService)}
              className="h-11 px-5 rounded-xl border border-zinc-700 text-zinc-200 font-black uppercase tracking-widest text-xs hover:bg-zinc-800 transition-all flex items-center gap-2"
            >
              <Pencil className="w-4 h-4" />
              Editar serviço
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-zinc-800 bg-[#151515] p-4">
            <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">ID</p>
            <p className="text-white text-lg font-black">{selectedService.id}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-[#151515] p-4">
            <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Categoria</p>
            <p className="text-white text-lg font-black">{selectedService.category}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-[#151515] p-4">
            <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Unidade</p>
            <p className="text-white text-lg font-black">{selectedService.selectionUnit}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-[#151515] p-4">
            <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Pacotes</p>
            <p className="text-white text-lg font-black">{selectedService.packages.length}</p>
          </div>
        </section>

        <section className="bg-[#141414] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden">
          <div className="px-5 md:px-6 py-5 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black mb-2">
                Lista
              </p>
              <h2 className="text-white font-black uppercase tracking-tight text-2xl">
                Pacotes do serviço
              </h2>
            </div>

            <div className="text-[10px] uppercase tracking-widest font-black text-zinc-500">
              {selectedService.packages.length} pacotes
            </div>
          </div>

          <div className="overflow-hidden">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-zinc-800 bg-black/20">
                  <th className="text-left px-4 md:px-6 py-4 text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black w-[100px]">
                    ID
                  </th>
                  <th className="text-left px-4 md:px-6 py-4 text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black">
                    Pacote
                  </th>
                  <th className="text-left px-4 md:px-6 py-4 text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black w-[150px]">
                    Valor
                  </th>
                  <th className="text-left px-4 md:px-6 py-4 text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black w-[130px]">
                    Libera
                  </th>
                  <th className="text-left px-4 md:px-6 py-4 text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black w-[180px]">
                    Adicional
                  </th>
                  <th className="text-right px-4 md:px-6 py-4 text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black w-[120px]">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody>
                {selectedService.packages.map((pkg) => (
                  <tr
                    key={pkg.id}
                    onClick={() => openPackageDetails(selectedService, pkg)}
                    className="border-b border-zinc-800/70 hover:bg-zinc-900/40 transition-all cursor-pointer"
                  >
                    <td className="px-4 md:px-6 py-4 text-sm text-zinc-400 font-mono align-top">
                      {pkg.id}
                    </td>

                    <td className="px-4 md:px-6 py-4 align-top">
                      <p className="text-white font-black uppercase text-sm tracking-wide leading-tight">
                        {pkg.name}
                      </p>
                      {pkg.description && (
                        <p className="text-zinc-500 text-xs mt-1">
                          {pkg.description}
                        </p>
                      )}
                    </td>

                    <td className="px-4 md:px-6 py-4 text-white font-black text-sm align-top whitespace-nowrap">
                      {pkg.price}
                    </td>

                    <td className="px-4 md:px-6 py-4 text-zinc-300 text-sm align-top">
                      {pkg.includedSelections} {selectedService.selectionUnit.toLowerCase()}
                    </td>

                    <td className="px-4 md:px-6 py-4 text-zinc-400 text-sm align-top">
                      {pkg.additionalPrice}
                    </td>

                    <td className="px-4 md:px-6 py-4 align-top">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="w-9 h-9 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all flex items-center justify-center"
                          title="Editar pacote"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="w-9 h-9 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-red-400 hover:border-red-500/40 transition-all flex items-center justify-center"
                          title="Apagar pacote"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openPackageDetails(selectedService, pkg);
                          }}
                          className="w-9 h-9 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-[#ff5351] hover:border-[#ff5351]/30 transition-all flex items-center justify-center"
                          title="Visualizar pacote"
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

  if (viewMode === 'form') {
    return (
      <div className="space-y-8 pb-20">
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <button
              onClick={() => {
                resetForm();
                setViewMode('list');
              }}
              className="mb-4 flex items-center gap-2 text-zinc-500 hover:text-white transition-all text-xs font-bold uppercase tracking-widest"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar para lista
            </button>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5351] font-black mb-3">
              {editingServiceId ? 'Edição' : 'Novo cadastro'}
            </p>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase italic">
              {editingServiceId ? 'Editar Serviço' : 'Cadastrar Serviço'}
            </h1>
            <p className="text-zinc-500 text-base md:text-lg mt-3 max-w-3xl">
              Cadastre o serviço e depois adicione os pacotes que serão usados na criação dos projetos.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                resetForm();
                setViewMode('list');
              }}
              className="h-11 px-5 rounded-xl border border-zinc-700 text-zinc-200 font-black uppercase tracking-widest text-xs hover:bg-zinc-800 transition-all flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>

            <button
              onClick={saveService}
              className="h-11 px-5 rounded-xl bg-[#ff5351] text-white font-black uppercase tracking-widest text-xs hover:brightness-110 transition-all shadow-2xl shadow-[#ff5351]/20 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Salvar Serviço
            </button>
          </div>
        </header>

        <section className="bg-[#141414] border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">
                Nome do serviço
              </label>
              <input
                type="text"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="Ex: Vitrine Talk"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">
                Categoria
              </label>
              <select
                value={serviceCategory}
                onChange={(e) => setServiceCategory(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all"
              >
                <option>Podcast</option>
                <option>Fotos</option>
                <option>Conteúdo</option>
                <option>Palestras</option>
                <option>Eventos</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">
                Unidade de seleção
              </label>
              <select
                value={selectionUnit}
                onChange={(e) => setSelectionUnit(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all"
              >
                <option>Cortes</option>
                <option>Vídeos</option>
                <option>Fotos</option>
                <option>Arquivos</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">
                Status
              </label>
              <select
                value={serviceStatus}
                onChange={(e) => setServiceStatus(e.target.value as 'Ativo' | 'Inativo')}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all"
              >
                <option>Ativo</option>
                <option>Inativo</option>
              </select>
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">
                Descrição do serviço
              </label>
              <textarea
                value={serviceDescription}
                onChange={(e) => setServiceDescription(e.target.value)}
                placeholder="Descreva o objetivo desse serviço."
                rows={4}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all resize-none"
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">
                Observação interna
              </label>
              <textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Informações internas para organização."
                rows={3}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all resize-none"
              />
            </div>
          </div>
        </section>

        <section className="bg-[#141414] border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5351] font-black mb-2">
                Pacotes do serviço
              </p>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                Cadastro de pacotes
              </h2>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-right">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-black">Pacotes adicionados</p>
              <p className="text-white text-2xl font-black">{servicePackages.length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">
                Nome do pacote
              </label>
              <input
                type="text"
                value={packageDraft.name}
                onChange={(e) => setPackageDraft(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Start"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">
                Valor do pacote
              </label>
              <input
                type="text"
                value={packageDraft.price}
                onChange={(e) => setPackageDraft(prev => ({ ...prev, price: e.target.value }))}
                placeholder="Ex: R$ 1.550,00"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">
                Quantidade liberada
              </label>
              <input
                type="text"
                value={packageDraft.includedSelections}
                onChange={(e) => setPackageDraft(prev => ({ ...prev, includedSelections: e.target.value }))}
                placeholder={`Ex: 7 ${selectionUnit.toLowerCase()}`}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">
                Valor por adicional
              </label>
              <input
                type="text"
                value={packageDraft.additionalPrice}
                onChange={(e) => setPackageDraft(prev => ({ ...prev, additionalPrice: e.target.value }))}
                placeholder="Ex: R$ 120,00 por corte"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all"
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">
                Descrição do pacote
              </label>
              <textarea
                value={packageDraft.description}
                onChange={(e) => setPackageDraft(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Resumo curto do pacote."
                rows={3}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all resize-none"
              />
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">
              Itens inclusos no pacote
            </label>

            <div className="flex flex-col md:flex-row gap-3">
              <input
                type="text"
                value={packageItemInput}
                onChange={(e) => setPackageItemInput(e.target.value)}
                placeholder="Ex: Vídeo na íntegra para YouTube"
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all"
              />
              <button
                type="button"
                onClick={addPackageItem}
                className="h-[56px] px-5 rounded-xl border border-zinc-700 text-zinc-200 font-black uppercase tracking-widest text-xs hover:bg-zinc-800 transition-all"
              >
                Adicionar item
              </button>
            </div>

            {packageDraft.items.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {packageDraft.items.map((item, index) => (
                  <div
                    key={`${item}-${index}`}
                    className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2"
                  >
                    <span className="text-sm text-zinc-200">{item}</span>
                    <button
                      type="button"
                      onClick={() => removePackageItem(index)}
                      className="text-zinc-500 hover:text-red-400 transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={addPackageToService}
              className="h-11 px-5 rounded-xl bg-[#ff5351] text-white font-black uppercase tracking-widest text-xs hover:brightness-110 transition-all shadow-2xl shadow-[#ff5351]/20 flex items-center gap-2"
            >
              <PackagePlus className="w-4 h-4" />
              Salvar pacote na lista
            </button>
          </div>

          {servicePackages.length > 0 && (
            <div className="space-y-4">
              <div className="pt-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  Pacotes já adicionados ao serviço
                </p>
              </div>

              <div className="space-y-4">
                {servicePackages.map((pkg) => (
                  <div key={pkg.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div>
                        <p className="text-white font-black uppercase text-lg">{pkg.name}</p>
                        <p className="text-zinc-500 text-xs mt-1">{pkg.id}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-left lg:text-right">
                          <p className="text-[#ff5351] text-2xl font-black">{pkg.price}</p>
                          <p className="text-zinc-500 text-xs mt-1">
                            {pkg.includedSelections} {selectionUnit.toLowerCase()}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeServicePackage(pkg.id)}
                          className="w-10 h-10 rounded-xl border border-zinc-800 bg-[#141414] text-zinc-400 hover:text-red-400 hover:border-red-500/40 transition-all flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {pkg.description && (
                      <p className="text-zinc-400 text-sm mt-4">{pkg.description}</p>
                    )}

                    {pkg.items.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {pkg.items.map((item, index) => (
                          <p key={index} className="text-sm text-zinc-300">
                            • {item}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    );
  }

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
            Clique em uma linha para visualizar os pacotes desse serviço ou crie um novo cadastro.
          </p>
        </div>

        <button
          onClick={openCreateForm}
          className="h-11 px-5 rounded-xl bg-[#ff5351] text-white font-black uppercase tracking-widest text-xs hover:brightness-110 transition-all shadow-2xl shadow-[#ff5351]/20 flex items-center gap-2 self-start lg:self-auto"
        >
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
            {services.length} serviços
          </div>
        </div>

        <div className="overflow-hidden">
          <table className="w-full table-fixed">
            <thead>
              <tr className="border-b border-zinc-800 bg-black/20">
                <th className="text-left px-4 md:px-6 py-4 text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black w-[90px]">
                  ID
                </th>
                <th className="text-left px-4 md:px-6 py-4 text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black">
                  Nome
                </th>
                <th className="text-left px-4 md:px-6 py-4 text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black w-[90px]">
                  Pacotes
                </th>
                <th className="text-left px-4 md:px-6 py-4 text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black w-[120px]">
                  Criação
                </th>
                <th className="text-left px-4 md:px-6 py-4 text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black w-[120px]">
                  Atualização
                </th>
                <th className="text-right px-4 md:px-6 py-4 text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black w-[150px]">
                  Ações
                </th>
              </tr>
            </thead>

            <tbody>
              {services.map((service) => (
                <tr
                  key={service.id}
                  onClick={() => openServiceDetails(service)}
                  className="border-b border-zinc-800/70 hover:bg-zinc-900/40 transition-all cursor-pointer"
                >
                  <td className="px-4 md:px-6 py-4 text-sm text-zinc-400 font-mono align-top">
                    {service.id}
                  </td>

                  <td className="px-4 md:px-6 py-4 align-top">
                    <p className="text-white font-black uppercase text-sm tracking-wide leading-tight">
                      {service.name}
                    </p>
                    <p className="text-zinc-500 text-xs mt-1">
                      {service.category}
                    </p>
                  </td>

                  <td className="px-4 md:px-6 py-4 text-white font-black text-sm align-top">
                    {service.packageCount}
                  </td>

                  <td className="px-4 md:px-6 py-4 text-zinc-400 text-sm whitespace-nowrap align-top">
                    {service.createdAt}
                  </td>

                  <td className="px-4 md:px-6 py-4 text-zinc-400 text-sm whitespace-nowrap align-top">
                    {service.updatedAt}
                  </td>

                  <td className="px-4 md:px-6 py-4 align-top">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditForm(service);
                        }}
                        className="w-9 h-9 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all flex items-center justify-center"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteService(service.id);
                        }}
                        className="w-9 h-9 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-red-400 hover:border-red-500/40 transition-all flex items-center justify-center"
                        title="Apagar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openServiceDetails(service);
                        }}
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
