import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, ChevronRight, ArrowLeft, Save, X, PackagePlus, Copy, Loader2, Mail } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  settingsService,
  ServiceCatalog,
  ServicePackageConfig,
  SelectionUnit,
  ServiceStatus,
} from '../services/settingsService';
import { DataTable } from '../components/ui/DataTable';
import { cn } from '../lib/utils';

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
  const [persistingPackage, setPersistingPackage] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);

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

  const clonePackages = (packages: ServicePackageConfig[]) => {
    return packages.map((pkg) => ({
      ...pkg,
      items: [...pkg.items],
    }));
  };

  const resetPackageDraft = () => {
    setEditingPackageId(null);
    setPackageDraft(emptyPackageDraft);
    setPackageItemInput('');
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
    resetPackageDraft();
  };

  const formatDate = (value: any) => {
    if (!value) return '--';
    if (typeof value === 'string' && value.includes('/')) return value;
    const date = typeof value?.toDate === 'function' ? value.toDate() : value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return new Intl.DateTimeFormat('pt-BR').format(date);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const formatEditableCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
  };

  const parseCurrencyToNumber = (value: string) => {
    if (!value) return 0;
    const normalized = value.replace(/\s/g, '').replace(/R\$/gi, '').replace(/\./g, '').replace(',', '.').trim();
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

  const generateServiceId = () => `SRV-${Date.now().toString().slice(-6)}`;
  const generatePackageId = () => `PKG-${Date.now().toString().slice(-6)}`;

  const buildPackageDraftFromExisting = (pkg: ServicePackageConfig): PackageDraft => {
    return {
      name: pkg.name,
      price: formatEditableCurrency(pkg.price),
      includedSelections: String(pkg.includedSelections),
      additionalItemPrice: formatEditableCurrency(pkg.additionalItemPrice),
      description: pkg.description,
      items: [...pkg.items],
    };
  };

  const openCreateForm = () => { resetForm(); setViewMode('form'); };
  const openServiceDetails = (service: ServiceCatalog) => { setSelectedServiceId(service.id); setSelectedPackageId(null); setViewMode('service-details'); };
  const openPackageDetails = (service: ServiceCatalog, pkg: ServicePackageConfig) => { setSelectedServiceId(service.id); setSelectedPackageId(pkg.id); setViewMode('package-details'); };

  const openEditForm = (service: ServiceCatalog) => {
    setEditingServiceId(service.id);
    setServiceName(service.name);
    setServiceCategory(service.category);
    setSelectionUnit(service.selectionUnit);
    setServiceStatus(service.status);
    setServiceDescription(service.description);
    setInternalNotes(service.internalNotes);
    setServicePackages(clonePackages(service.packages || []));
    resetPackageDraft();
    setViewMode('form');
  };

  const openEditPackageInForm = (service: ServiceCatalog, pkg: ServicePackageConfig) => {
    setEditingServiceId(service.id);
    setServiceName(service.name);
    setServiceCategory(service.category);
    setSelectionUnit(service.selectionUnit);
    setServiceStatus(service.status);
    setServiceDescription(service.description);
    setInternalNotes(service.internalNotes);
    setServicePackages(clonePackages(service.packages || []));
    setEditingPackageId(pkg.id);
    setPackageDraft(buildPackageDraftFromExisting(pkg));
    setPackageItemInput('');
    setViewMode('form');
  };

  const deleteService = async (serviceId: string) => {
    if (!window.confirm('Deseja apagar este serviço?')) return;
    try {
      await settingsService.deleteServiceCatalog(serviceId);
      await loadServices();
      if (selectedServiceId === serviceId) { setSelectedServiceId(null); setSelectedPackageId(null); setViewMode('list'); }
      toast.success('Serviço apagado com sucesso.');
    } catch (error) { toast.error('Erro ao apagar serviço.'); }
  };

  const addPackageItem = () => {
    const cleanItem = packageItemInput.trim();
    if (!cleanItem) return;
    setPackageDraft((prev) => ({ ...prev, items: [...prev.items, cleanItem] }));
    setPackageItemInput('');
  };

  const removePackageItem = (index: number) => {
    setPackageDraft((prev) => ({ ...prev, items: prev.items.filter((_, itemIndex) => itemIndex !== index) }));
  };

  const addPackageToService = () => {
    if (!packageDraft.name.trim() || !packageDraft.price.trim() || !packageDraft.includedSelections.trim() || !packageDraft.additionalItemPrice.trim()) {
      alert('Preencha todos os campos do pacote.');
      return;
    }

    const packagePayload: ServicePackageConfig = {
      id: editingPackageId || generatePackageId(),
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

    if (editingPackageId) {
      setServicePackages((prev) => prev.map((pkg) => pkg.id === editingPackageId ? { ...packagePayload, id: editingPackageId, createdAt: pkg.createdAt || new Date(), updatedAt: new Date() } : pkg));
      toast.success('Pacote atualizado na lista.');
    } else {
      setServicePackages((prev) => [...prev, packagePayload]);
      toast.success('Pacote adicionado na lista.');
    }
    resetPackageDraft();
  };

  const removeServicePackage = (packageId: string) => {
    setServicePackages((prev) => prev.filter((pkg) => pkg.id !== packageId));
    if (editingPackageId === packageId) resetPackageDraft();
  };

  const persistServicePackages = async (service: ServiceCatalog, nextPackages: ServicePackageConfig[], successMessage: string, afterSave?: () => void) => {
    setPersistingPackage(true);
    try {
      const now = new Date();
      const payload: ServiceCatalog = { ...service, packages: nextPackages.map((pkg) => ({ ...pkg, updatedAt: now, createdAt: pkg.createdAt || now })), updatedAt: now };
      await settingsService.upsertServiceCatalog(payload);
      await loadServices();
      setSelectedServiceId(service.id);
      if (afterSave) afterSave();
      toast.success(successMessage);
    } catch (error) { toast.error('Erro ao salvar alteração do pacote.'); } finally { setPersistingPackage(false); }
  };

  const deletePackagePersist = async (service: ServiceCatalog, packageId: string) => {
    if (!window.confirm('Deseja apagar este pacote?')) return;
    const nextPackages = service.packages.filter((pkg) => pkg.id !== packageId);
    await persistServicePackages(service, nextPackages, 'Pacote apagado com sucesso.', () => { setSelectedPackageId(null); setViewMode('service-details'); });
  };

  const duplicatePackagePersist = async (service: ServiceCatalog, pkg: ServicePackageConfig) => {
    const duplicated: ServicePackageConfig = { ...pkg, id: generatePackageId(), name: `${pkg.name} Cópia`, createdAt: new Date(), updatedAt: new Date(), items: [...pkg.items] };
    await persistServicePackages(service, [...service.packages, duplicated], 'Pacote duplicado com sucesso.');
  };

  const saveService = async () => {
    if (!serviceName.trim() || !serviceCategory.trim() || servicePackages.length === 0) {
      alert('Preencha nome, categoria e adicione ao menos 1 pacote.');
      return;
    }
    setSavingService(true);
    try {
      const existingService = services.find((service) => service.id === editingServiceId);
      const now = new Date();
      const payload: ServiceCatalog = { id: editingServiceId || generateServiceId(), name: serviceName.trim(), category: serviceCategory, selectionUnit, status: serviceStatus, description: serviceDescription.trim(), internalNotes: internalNotes.trim(), packages: servicePackages.map((pkg) => ({ ...pkg, updatedAt: now, createdAt: pkg.createdAt || now })), createdAt: existingService?.createdAt || now, updatedAt: now };
      await settingsService.upsertServiceCatalog(payload);
      await loadServices();
      setSelectedServiceId(payload.id);
      setSelectedPackageId(null);
      resetForm();
      setViewMode('list');
      toast.success(editingServiceId ? 'Serviço atualizado com sucesso.' : 'Serviço cadastrado com sucesso.');
    } catch (error) { toast.error('Erro ao salvar serviço.'); } finally { setSavingService(false); }
  };

  if (viewMode === 'package-details' && selectedService && selectedPackage) {
    return (
      <div className="space-y-8 pb-20">
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <button onClick={() => setViewMode('service-details')} className="mb-4 flex items-center gap-2 text-zinc-500 hover:text-white transition-all text-xs font-bold uppercase tracking-widest"><ArrowLeft className="w-4 h-4" />Voltar para pacotes</button>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5351] font-black mb-3">Detalhes do Pacote</p>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase italic">{selectedPackage.name}</h1>
            <p className="text-zinc-500 text-base md:text-lg mt-3 max-w-3xl">Serviço: {selectedService.name}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => openEditPackageInForm(selectedService, selectedPackage)} className="h-11 px-5 rounded-xl border border-zinc-700 text-zinc-200 font-black uppercase tracking-widest text-xs hover:bg-zinc-800 transition-all flex items-center gap-2"><Pencil className="w-4 h-4" />Editar pacote</button>
            <button onClick={() => duplicatePackagePersist(selectedService, selectedPackage)} disabled={persistingPackage} className="h-11 px-5 rounded-xl border border-zinc-700 text-zinc-200 font-black uppercase tracking-widest text-xs hover:bg-zinc-800 transition-all flex items-center gap-2 disabled:opacity-60"><Copy className="w-4 h-4" />Duplicar</button>
            <button onClick={() => deletePackagePersist(selectedService, selectedPackage.id)} disabled={persistingPackage} className="h-11 px-5 rounded-xl border border-red-500/30 text-red-400 font-black uppercase tracking-widest text-xs hover:bg-red-500/10 transition-all flex items-center gap-2 disabled:opacity-60"><Trash2 className="w-4 h-4" />Apagar</button>
          </div>
        </header>
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-zinc-800 bg-[#151515] p-5"><p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Valor do pacote</p><p className="text-white text-2xl font-black">{formatCurrency(selectedPackage.price)}</p></div>
          <div className="rounded-2xl border border-zinc-800 bg-[#151515] p-5"><p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Libera</p><p className="text-white text-2xl font-black">{selectedPackage.includedSelections}</p><p className="text-zinc-500 text-xs mt-1">{getSelectionUnitLabel(selectedService.selectionUnit).toLowerCase()}</p></div>
          <div className="rounded-2xl border border-zinc-800 bg-[#151515] p-5"><p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Valor por item adicional</p><p className="text-white text-xl font-black">{formatCurrency(selectedPackage.additionalItemPrice)}</p></div>
          <div className="rounded-2xl border border-zinc-800 bg-[#151515] p-5"><p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Itens</p><p className="text-white text-2xl font-black">{selectedPackage.items.length}</p></div>
        </section>
        <section className="bg-[#141414] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden">
          <div className="px-5 md:px-6 py-5 border-b border-zinc-800"><p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-black mb-2">Conteúdo do pacote</p><h2 className="text-white font-black uppercase tracking-tight text-2xl">Itens inclusos</h2>{selectedPackage.description && <p className="text-zinc-500 text-sm mt-2">{selectedPackage.description}</p>}</div>
          <div className="divide-y divide-zinc-800">
            {selectedPackage.items.map((item, index) => (<div key={index} className="px-5 md:px-6 py-4 flex items-center gap-4"><div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 text-xs font-black shrink-0">{String(index + 1).padStart(2, '0')}</div><p className="text-white text-sm font-medium">{item}</p></div>))}
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
            <button onClick={() => setViewMode('list')} className="mb-4 flex items-center gap-2 text-zinc-500 hover:text-white transition-all text-xs font-bold uppercase tracking-widest"><ArrowLeft className="w-4 h-4" />Voltar para lista</button>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5351] font-black mb-3">Serviço Selecionado</p>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase italic">{selectedService.name}</h1>
            <p className="text-zinc-500 text-base md:text-lg mt-3 max-w-3xl">Clique em um pacote para visualizar os detalhes.</p>
          </div>
          <div className="flex flex-wrap gap-3"><button onClick={() => openEditForm(selectedService)} className="h-11 px-5 rounded-xl border border-zinc-700 text-zinc-200 font-black uppercase tracking-widest text-xs hover:bg-zinc-800 transition-all flex items-center gap-2"><Pencil className="w-4 h-4" />Editar serviço</button></div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-zinc-800 bg-[#151515] p-4"><p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">ID</p><p className="text-white text-lg font-black">{selectedService.id}</p></div>
          <div className="rounded-2xl border border-zinc-800 bg-[#151515] p-4"><p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Categoria</p><p className="text-white text-lg font-black">{selectedService.category}</p></div>
          <div className="rounded-2xl border border-zinc-800 bg-[#151515] p-4"><p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Unidade</p><p className="text-white text-lg font-black">{getSelectionUnitLabel(selectedService.selectionUnit)}</p></div>
          <div className="rounded-2xl border border-zinc-800 bg-[#151515] p-4"><p className="text-zinc-500 text-[10px] uppercase tracking-widest font-black mb-2">Pacotes</p><p className="text-white text-lg font-black">{selectedService.packages.length}</p></div>
        </section>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-black uppercase tracking-tight text-2xl">Pacotes do serviço</h2>
          </div>
          <DataTable 
            data={selectedService.packages}
            onRowClick={(pkg) => openPackageDetails(selectedService, pkg)}
            columns={[
              { header: 'ID', accessor: 'id', className: 'font-mono text-zinc-400 w-[100px]' },
              { 
                header: 'Pacote', 
                accessor: (pkg) => (
                  <div>
                    <p className="text-white font-black uppercase text-sm">{pkg.name}</p>
                    {pkg.description && <p className="text-zinc-500 text-xs mt-0.5 line-clamp-1">{pkg.description}</p>}
                  </div>
                )
              },
              { header: 'Valor', accessor: (pkg) => formatCurrency(pkg.price), className: 'text-white font-black' },
              { header: 'Libera', accessor: (pkg) => `${pkg.includedSelections} ${getSelectionUnitLabel(selectedService.selectionUnit).toLowerCase()}` },
              { header: 'Adicional', accessor: (pkg) => formatCurrency(pkg.additionalItemPrice), className: 'text-zinc-400' }
            ]}
            actions={(pkg) => (
              <>
                <button onClick={(e) => { e.stopPropagation(); openEditPackageInForm(selectedService, pkg); }} className="p-2 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-all" title="Editar"><Pencil className="w-4 h-4" /></button>
                <button onClick={(e) => { e.stopPropagation(); deletePackagePersist(selectedService, pkg.id); }} disabled={persistingPackage} className="p-2 bg-zinc-800/50 hover:bg-red-500/10 rounded-xl text-zinc-600 hover:text-red-500 transition-all disabled:opacity-50"><Trash2 className="w-4 h-4" /></button>
                <button onClick={(e) => { e.stopPropagation(); openPackageDetails(selectedService, pkg); }} className="p-2 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 rounded-xl text-zinc-500 hover:text-[#ff5351] transition-all"><ChevronRight className="w-4 h-4" /></button>
              </>
            )}
          />
        </div>
      </div>
    );
  }

  if (viewMode === 'form') {
    return (
      <div className="space-y-8 pb-20">
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <button onClick={() => { resetForm(); setViewMode('list'); }} className="mb-4 flex items-center gap-2 text-zinc-500 hover:text-white transition-all text-xs font-bold uppercase tracking-widest"><ArrowLeft className="w-4 h-4" />Voltar para lista</button>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5351] font-black mb-3">{editingServiceId ? 'Edição' : 'Novo cadastro'}</p>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase italic">{editingServiceId ? 'Editar Serviço' : 'Cadastrar Serviço'}</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => { resetForm(); setViewMode('list'); }} className="h-11 px-5 rounded-xl border border-zinc-700 text-zinc-200 font-black uppercase tracking-widest text-xs hover:bg-zinc-800 transition-all flex items-center gap-2"><X className="w-4 h-4" />Cancelar</button>
            <button onClick={saveService} disabled={savingService} className="h-11 px-5 rounded-xl bg-[#ff5351] text-white font-black uppercase tracking-widest text-xs hover:brightness-110 transition-all shadow-2xl shadow-[#ff5351]/20 flex items-center gap-2 disabled:opacity-60"><Save className="w-4 h-4" />{savingService ? 'Salvando...' : 'Salvar Serviço'}</button>
          </div>
        </header>
        <section className="bg-[#141414] border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Nome do serviço</label><input type="text" value={serviceName} onChange={(e) => setServiceName(e.target.value)} placeholder="Ex: Vitrine Talk" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all"/></div>
            <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Categoria</label><select value={serviceCategory} onChange={(e) => setServiceCategory(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all">{categoryOptions.map((category) => (<option key={category}>{category}</option>))}</select></div>
            <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Unidade de seleção</label><select value={selectionUnit} onChange={(e) => setSelectionUnit(e.target.value as SelectionUnit)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all">{selectionUnitOptions.map((unit) => (<option key={unit.value} value={unit.value}>{unit.label}</option>))}</select></div>
            <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Status</label><select value={serviceStatus} onChange={(e) => setServiceStatus(e.target.value as ServiceStatus)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all"><option>Ativo</option><option>Inativo</option></select></div>
            <div className="md:col-span-2 space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Descrição do serviço</label><textarea value={serviceDescription} onChange={(e) => setServiceDescription(e.target.value)} placeholder="Descreva o objetivo desse serviço." rows={4} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all resize-none"/></div>
          </div>
        </section>
        <section className="bg-[#141414] border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-8">
           <div className="flex items-center justify-between gap-4"><div><p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5351] font-black mb-2">Pacotes do serviço</p><h2 className="text-2xl font-black text-white uppercase tracking-tight">Cadastro de pacotes</h2></div><div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-right"><p className="text-[10px] uppercase tracking-widest text-zinc-500 font-black">Pacotes adicionados</p><p className="text-white text-2xl font-black">{servicePackages.length}</p></div></div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Nome do pacote</label><input type="text" value={packageDraft.name} onChange={(e) => setPackageDraft((prev) => ({ ...prev, name: e.target.value }))} placeholder="Ex: Start" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all"/></div>
            <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Valor do pacote</label><input type="text" value={packageDraft.price} onChange={(e) => setPackageDraft((prev) => ({ ...prev, price: e.target.value }))} placeholder="Ex: 1550,00" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all"/></div>
            <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Quantidade liberada</label><input type="text" value={packageDraft.includedSelections} onChange={(e) => setPackageDraft((prev) => ({ ...prev, includedSelections: e.target.value }))} placeholder={`Ex: 7 ${getSelectionUnitLabel(selectionUnit).toLowerCase()}`} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all"/></div>
            <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Valor por item adicional</label><input type="text" value={packageDraft.additionalItemPrice} onChange={(e) => setPackageDraft((prev) => ({ ...prev, additionalItemPrice: e.target.value }))} placeholder="Ex: 120,00" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all"/></div>
            <div className="md:col-span-2 space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Descrição do pacote</label><textarea value={packageDraft.description} onChange={(e) => setPackageDraft((prev) => ({ ...prev, description: e.target.value }))} placeholder="Resumo curto do pacote." rows={3} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all resize-none"/></div>
          </div>
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Itens inclusos no pacote</label>
            <div className="flex flex-col md:flex-row gap-3"><input type="text" value={packageItemInput} onChange={(e) => setPackageItemInput(e.target.value)} placeholder="Ex: Vídeo na íntegra para YouTube" className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all"/><button type="button" onClick={addPackageItem} className="h-[56px] px-5 rounded-xl border border-zinc-700 text-zinc-200 font-black uppercase tracking-widest text-xs hover:bg-zinc-800 transition-all">Adicionar item</button></div>
            {packageDraft.items.length > 0 && (<div className="flex flex-wrap gap-3">{packageDraft.items.map((item, index) => (<div key={`${item}-${index}`} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2"><span className="text-sm text-zinc-200">{item}</span><button type="button" onClick={() => removePackageItem(index)} className="text-zinc-500 hover:text-red-400 transition-all"><X className="w-4 h-4" /></button></div>))}</div>)}
            <div className="flex flex-wrap gap-3"><button type="button" onClick={addPackageToService} className="h-11 px-5 rounded-xl bg-[#ff5351] text-white font-black uppercase tracking-widest text-xs hover:brightness-110 transition-all shadow-2xl shadow-[#ff5351]/20 flex items-center gap-2"><PackagePlus className="w-4 h-4" />{editingPackageId ? 'Atualizar pacote na lista' : 'Salvar pacote na lista'}</button>{editingPackageId && (<button type="button" onClick={resetPackageDraft} className="h-11 px-5 rounded-xl border border-zinc-700 text-zinc-200 font-black uppercase tracking-widest text-xs hover:bg-zinc-800 transition-all flex items-center gap-2"><X className="w-4 h-4" />Cancelar edição</button>)}</div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#ff5351] font-black mb-3">Estrutura Comercial</p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase italic">Cadastro de Serviços</h1>
        </div>
        <button onClick={openCreateForm} className="h-11 px-5 rounded-xl bg-[#ff5351] text-white font-black uppercase tracking-widest text-xs hover:brightness-110 transition-all shadow-2xl shadow-[#ff5351]/20 flex items-center gap-2"><Plus className="w-4 h-4" />Novo Serviço</button>
      </header>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black uppercase tracking-tight text-2xl">Tipos de Serviço</h2>
          <div className="text-[10px] uppercase tracking-widest font-black text-zinc-500">{services.length} serviços</div>
        </div>

        <DataTable 
          data={services}
          loading={loadingServices}
          onRowClick={(service) => openServiceDetails(service)}
          emptyMessage="Nenhum serviço cadastrado."
          columns={[
            { header: 'ID', accessor: 'id', className: 'font-mono text-zinc-400 w-[90px]' },
            { 
              header: 'Nome', 
              accessor: (service) => (
                <div>
                  <p className="text-white font-black uppercase text-sm">{service.name}</p>
                  <p className="text-zinc-500 text-xs mt-0.5">{service.category}</p>
                </div>
              )
            },
            { header: 'Pacotes', accessor: (service) => service.packages.length, align: 'center', className: 'text-white font-black w-[90px]' },
            { header: 'Criação', accessor: (service) => formatDate(service.createdAt), className: 'text-zinc-400 w-[120px]' },
            { header: 'Atualização', accessor: (service) => formatDate(service.updatedAt), className: 'text-zinc-400 w-[120px]' }
          ]}
          actions={(service) => (
            <>
              <button onClick={(e) => { e.stopPropagation(); openEditForm(service); }} className="p-2 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-all" title="Editar"><Pencil className="w-4 h-4" /></button>
              <button onClick={(e) => { e.stopPropagation(); deleteService(service.id); }} className="p-2 bg-zinc-800/50 hover:bg-red-500/10 rounded-xl text-zinc-600 hover:text-red-500 transition-all" title="Apagar"><Trash2 className="w-4 h-4" /></button>
              <button onClick={(e) => { e.stopPropagation(); openServiceDetails(service); }} className="p-2 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 rounded-xl text-zinc-500 hover:text-[#ff5351] transition-all"><ChevronRight className="w-4 h-4" /></button>
            </>
          )}
        />
      </div>
    </div>
  );
}
