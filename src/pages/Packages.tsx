import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, ChevronRight, ArrowLeft, Save, X, PackagePlus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  settingsService,
  ServiceCatalog,
  ServicePackageConfig,
  SelectionUnit,
  ServiceStatus,
} from '../services/settingsService';

type PackageDraft = {
  name: string;
  price: string;
  includedSelections: string;
  additionalItemPrice: string;
  description: string;
  items: string[];
};

type ViewMode = 'list' | 'service-details' | 'package-details' | 'form';

const emptyPackageDraft: PackageDraft = {
  name: '',
  price: '',
  includedSelections: '',
  additionalItemPrice: '',
  description: '',
  items: [],
};

const categoryOptions = ['Podcast', 'Fotos', 'Conteúdo', 'Palestras', 'Eventos'];
const selectionUnitOptions: { value: SelectionUnit; label: string }[] = [
  { value: 'cortes', label: 'Cortes' },
  { value: 'videos', label: 'Vídeos' },
  { value: 'fotos', label: 'Fotos' },
  { value: 'arquivos', label: 'Arquivos' },
];

export default function Packages() {
  const [services, setServices] = useState<ServiceCatalog[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [savingService, setSavingService] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  const [serviceName, setServiceName] = useState('');
  const [serviceCategory, setServiceCategory] = useState('Podcast');
  const [selectionUnit, setSelectionUnit] = useState<SelectionUnit>('cortes');
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>('Ativo');
  const [serviceDescription, setServiceDescription] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  const [servicePackages, setServicePackages] = useState<ServicePackageConfig[]>([]);
  const [packageDraft, setPackageDraft] = useState<PackageDraft>(emptyPackageDraft);
  const [packageItemInput, setPackageItemInput] = useState('');

  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId) || null,
    [services, selectedServiceId]
  );

  const selectedPackage = useMemo(
    () => selectedService?.packages.find((pkg) => pkg.id === selectedPackageId) || null,
    [selectedService, selectedPackageId]
  );

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    setLoadingServices(true);
    try {
      const catalog = await settingsService.getServiceCatalogs();
      setServices(catalog);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar cadastro de serviços.');
    } finally {
      setLoadingServices(false);
    }
  };

  const resetForm = () => {
    setEditingServiceId(null);
    setServiceName('');
    setServiceCategory('Podcast');
    setSelectionUnit('cortes');
    setServiceStatus('Ativo');
    setServiceDescription('');
    setInternalNotes('');
    setServicePackages([]);
    setPackageDraft(emptyPackageDraft);
    setPackageItemInput('');
  };

  const formatDate = (value: any) => {
    if (!value) return '--';

    if (typeof value === 'string' && value.includes('/')) {
      return value;
    }

    const date =
      typeof value?.toDate === 'function'
        ? value.toDate()
        : value instanceof Date
          ? value
          : new Date(value);

    if (Number.isNaN(date.getTime())) return '--';

    return new Intl.DateTimeFormat('pt-BR').format(date);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  };

  const parseCurrencyToNumber = (value: string) => {
    if (!value) return 0;
    const normalized = value
      .replace(/\s/g, '')
      .replace(/R\$/gi, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .trim();

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const parseInteger = (value: string) => {
    const parsed = parseInt(value.replace(/\D/g, ''), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const getSelectionUnitLabel = (unit: SelectionUnit) => {
    const found = selectionUnitOptions.find((item) => item.value === unit);
    return found?.label || 'Itens';
  };

  const generateServiceId = () => {
    return `SRV-${Date.now().toString().slice(-6)}`;
  };

  const generatePackageId = () => {
    return `PKG-${Date.now().toString().slice(-6)}`;
  };

  const openCreateForm = () => {
    resetForm();
    setViewMode('form');
  };

  const openServiceDetails = (service: ServiceCatalog) => {
    setSelectedServiceId(service.id);
    setSelectedPackageId(null);
    setViewMode('service-details');
  };

  const openPackageDetails = (service: ServiceCatalog, pkg: ServicePackageConfig) => {
    setSelectedServiceId(service.id);
    setSelectedPackageId(pkg.id);
    setViewMode('package-details');
  };

  const openEditForm = (service: ServiceCatalog) => {
    setEditingServiceId(service.id);
    setServiceName(service.name);
    setServiceCategory(service.category);
    setSelectionUnit(service.selectionUnit);
    setServiceStatus(service.status);
    setServiceDescription(service.description);
    setInternalNotes(service.internalNotes);
    setServicePackages(service.packages || []);
    setPackageDraft(emptyPackageDraft);
    setPackageItemInput('');
    setViewMode('form');
  };

  const deleteService = async (serviceId: string) => {
    const confirmed = window.confirm('Deseja apagar este serviço?');
    if (!confirmed) return;

    try {
      await settingsService.deleteServiceCatalog(serviceId);
      await loadServices();

      if (selectedServiceId === serviceId) {
        setSelectedServiceId(null);
        setSelectedPackageId(null);
        setViewMode('list');
      }

      toast.success('Serviço apagado com sucesso.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao apagar serviço.');
    }
  };

  const addPackageItem = () => {
    const cleanItem = packageItemInput.trim();
    if (!cleanItem) return;

    setPackageDraft((prev) => ({
      ...prev,
      items: [...prev.items, cleanItem],
    }));
    setPackageItemInput('');
  };

  const removePackageItem = (index: number) => {
    setPackageDraft((prev) => ({
      ...prev,
      items: prev.items.filter((_, itemIndex) => itemIndex !== index),
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

    if (!packageDraft.additionalItemPrice.trim()) {
      alert('Preencha o valor por item adicional.');
      return;
    }

    const newPackage: ServicePackageConfig = {
      id: generatePackageId(),
      name: packageDraft.name.trim(),
      price: parseCurrencyToNumber(packageDraft.price),
      includedSelections: parseInteger(packageDraft.includedSelections),
      additionalItemPrice: parseCurrencyToNumber(packageDraft.additionalItemPrice),
      description: packageDraft.description.trim(),
      items: packageDraft.items,
      status: 'Ativo',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setServicePackages((prev) => [...prev, newPackage]);
    setPackageDraft(emptyPackageDraft);
    setPackageItemInput('');
  };

  const removeServicePackage = (packageId: string) => {
    setServicePackages((prev) => prev.filter((pkg) => pkg.id !== packageId));
  };

  const saveService = async () => {
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

    setSavingService(true);

    try {
      const existingService = services.find((service) => service.id === editingServiceId);
      const now = new Date();

      const payload: ServiceCatalog = {
        id: editingServiceId || generateServiceId(),
        name: serviceName.trim(),
        category: serviceCategory,
        selectionUnit,
        status: serviceStatus,
        description: serviceDescription.trim(),
        internalNotes: internalNotes.trim(),
        packages: servicePackages.map((pkg) => ({
          ...pkg,
          updatedAt: now,
          createdAt: pkg.createdAt || now,
        })),
        createdAt: existingService?.createdAt || now,
        updatedAt: now,
      };

      await settingsService.upsertServiceCatalog(payload);
      await loadServices();

      setSelectedServiceId(payload.id);
      setSelectedPackageId(null);
      resetForm();
      setViewMode('list');

      toast.success(editingServiceId ? 'Serviço atualizado com sucesso.' : 'Serviço cadastrado com sucesso.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar serviço.');
    } finally {
      setSavingService(false);
    }
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
        </header>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-zinc-800 bg-[#151515] p-5">
            <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Valor do pacote</p>
            <p className="text-white text-2xl font-black">{formatCurrency(selectedPackage.price)}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-[#151515] p-5">
            <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Libera</p>
            <p className="text-white text-2xl font-black">
              {selectedPackage.includedSelections}
            </p>
            <p className="text-zinc-500 text-xs mt-1">{getSelectionUnitLabel(selectedService.selectionUnit).toLowerCase()}</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-[#151515] p-5">
            <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Valor por item adicional</p>
            <p className="text-white text-xl font-black">
              {formatCurrency(selectedPackage.additionalItemPrice)}
            </p>
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
            Uso no projeto
          </p>
          <div className="space-y-2 text-sm text-zinc-300">
            <p>
              • Ao escolher este pacote no projeto, o sistema poderá carregar automaticamente a quantidade liberada.
            </p>
            <p>
              • Neste caso: <span className="text-white font-black">{selectedPackage.includedSelections} {getSelectionUnitLabel(selectedService.selectionUnit).toLowerCase()}</span>.
            </p>
            <p>
              • O valor por item adicional ficará em <span className="text-white font-black">{formatCurrency(selectedPackage.additionalItemPrice)}</span>.
            </p>
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
            <p className="text-white text-lg font-black">{getSelectionUnitLabel(selectedService.selectionUnit)}</p>
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
                  <th className="text-left px-4 md:px-6 py-4 text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black w-[190px]">
                    Valor por item adicional
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
                      {formatCurrency(pkg.price)}
                    </td>

                    <td className="px-4 md:px-6 py-4 text-zinc-300 text-sm align-top">
                      {pkg.includedSelections} {getSelectionUnitLabel(selectedService.selectionUnit).toLowerCase()}
                    </td>

                    <td className="px-4 md:px-6 py-4 text-zinc-400 text-sm align-top">
                      {formatCurrency(pkg.additionalItemPrice)}
                    </td>

                    <td className="px-4 md:px-6 py-4 align-top">
                      <div className="flex items-center justify-end gap-2">
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
              disabled={savingService}
              className="h-11 px-5 rounded-xl bg-[#ff5351] text-white font-black uppercase tracking-widest text-xs hover:brightness-110 transition-all shadow-2xl shadow-[#ff5351]/20 flex items-center gap-2 disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {savingService ? 'Salvando...' : 'Salvar Serviço'}
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
                {categoryOptions.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">
                Unidade de seleção
              </label>
              <select
                value={selectionUnit}
                onChange={(e) => setSelectionUnit(e.target.value as SelectionUnit)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all"
              >
                {selectionUnitOptions.map((unit) => (
                  <option key={unit.value} value={unit.value}>
                    {unit.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">
                Status
              </label>
              <select
                value={serviceStatus}
                onChange={(e) => setServiceStatus(e.target.value as ServiceStatus)}
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
                onChange={(e) => setPackageDraft((prev) => ({ ...prev, name: e.target.value }))}
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
                onChange={(e) => setPackageDraft((prev) => ({ ...prev, price: e.target.value }))}
                placeholder="Ex: 1550,00"
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
                onChange={(e) => setPackageDraft((prev) => ({ ...prev, includedSelections: e.target.value }))}
                placeholder={`Ex: 7 ${getSelectionUnitLabel(selectionUnit).toLowerCase()}`}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">
                Valor por item adicional
              </label>
              <input
                type="text"
                value={packageDraft.additionalItemPrice}
                onChange={(e) => setPackageDraft((prev) => ({ ...prev, additionalItemPrice: e.target.value }))}
                placeholder="Ex: 120,00"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all"
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">
                Descrição do pacote
              </label>
              <textarea
                value={packageDraft.description}
                onChange={(e) => setPackageDraft((prev) => ({ ...prev, description: e.target.value }))}
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
                          <p className="text-[#ff5351] text-2xl font-black">{formatCurrency(pkg.price)}</p>
                          <p className="text-zinc-500 text-xs mt-1">
                            {pkg.includedSelections} {getSelectionUnitLabel(selectionUnit).toLowerCase()}
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

        {loadingServices ? (
          <div className="p-8 text-zinc-500">Carregando serviços...</div>
        ) : services.length === 0 ? (
          <div className="p-10 flex flex-col items-center justify-center text-center">
            <p className="text-white font-black uppercase tracking-widest mb-3">Nenhum serviço cadastrado</p>
            <p className="text-zinc-500 text-sm mb-6">Cadastre seu primeiro serviço para começar.</p>
            <button
              onClick={openCreateForm}
              className="h-11 px-5 rounded-xl bg-[#ff5351] text-white font-black uppercase tracking-widest text-xs hover:brightness-110 transition-all shadow-2xl shadow-[#ff5351]/20 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Novo Serviço
            </button>
          </div>
        ) : (
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
                      {service.packages.length}
                    </td>

                    <td className="px-4 md:px-6 py-4 text-zinc-400 text-sm whitespace-nowrap align-top">
                      {formatDate(service.createdAt)}
                    </td>

                    <td className="px-4 md:px-6 py-4 text-zinc-400 text-sm whitespace-nowrap align-top">
                      {formatDate(service.updatedAt)}
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
        )}
      </section>
    </div>
  );
}
