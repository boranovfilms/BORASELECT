import React, { useEffect, useMemo, useState } from 'react';
import { Check, Search, Loader2, ChevronLeft, FolderOpen, GitMerge } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clientService, Client } from '../services/clientService';
import { categoryService, Category } from '../services/categoryService';
import { projectService } from '../services/projectService';
import { cn } from '../lib/utils';
import { emailService } from '../services/emailService';
import { settingsService, ServiceCatalog } from '../services/settingsService';
import { modelosService, WorkflowModel } from '../services/modelosService';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const baseCategories = ['Casamento', 'Ensaio', 'Evento', 'Podcast', 'Vídeo Clipe'];

export default function NewProjectModal({ isOpen, onClose, onSuccess }: NewProjectModalProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loadingReferences, setLoadingReferences] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // A - Título
  const [title, setTitle] = useState('');
  
  // B - Cliente e Categoria
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [serviceCatalogs, setServiceCatalogs] = useState<ServiceCatalog[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState('');

  // C - Fluxo
  const [models, setModels] = useState<WorkflowModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState('');

  // E - Finalização
  const [includedCredits, setIncludedCredits] = useState(15);
  const [originalDriveLink, setOriginalDriveLink] = useState('');
  const [sendInviteEmail, setSendInviteEmail] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      setError(null);
    }
  }, [isOpen]);

  const loadInitialData = async () => {
    setLoadingReferences(true);
    try {
      const [cls, cats, catalogs, fetchedModels] = await Promise.all([
        clientService.searchClients(''),
        categoryService.getCategories(),
        settingsService.getServiceCatalogs(),
        modelosService.getModels().catch(() => []) // Evita erro se modelos ainda não existirem
      ]);

      setClients(cls);
      setCategories(cats);
      setServiceCatalogs(catalogs.filter((service) => service.status === 'Ativo'));
      setModels(fetchedModels);
    } catch (loadError) {
      console.error('Error loading initial data:', loadError);
    } finally {
      setLoadingReferences(false);
    }
  };

  const allCategories = useMemo(() => {
    const dynamicCategories = categories.map((category) => category.name);
    const serviceCategories = serviceCatalogs.map((service) => service.category);
    return Array.from(new Set([...baseCategories, ...dynamicCategories, ...serviceCategories]));
  }, [categories, serviceCatalogs]);

  const servicesForSelectedCategory = useMemo(() => {
    if (!selectedCategory || isCreatingCategory) return [];
    return serviceCatalogs.filter((service) => service.category === selectedCategory);
  }, [selectedCategory, isCreatingCategory, serviceCatalogs]);

  const selectedService = useMemo(() => {
    return servicesForSelectedCategory.find((service) => service.id === selectedServiceId) || null;
  }, [servicesForSelectedCategory, selectedServiceId]);

  const packagesForSelectedService = useMemo(() => {
    if (!selectedService) return [];
    return (selectedService.packages || []).filter((pkg) => pkg.status === 'Ativo');
  }, [selectedService]);

  const selectedPackage = useMemo(() => {
    return packagesForSelectedService.find((pkg) => pkg.id === selectedPackageId) || null;
  }, [packagesForSelectedService, selectedPackageId]);

  const packageIncludedCredits = selectedPackage ? selectedPackage.includedSelections : includedCredits;
  const packageAdditionalItemPrice = selectedPackage ? selectedPackage.additionalItemPrice : 0;

  // Lógica de Cascata (Progressive Disclosure)
  const isStepBVisible = title.trim().length > 0;
  
  const isClientFilled = isCreatingClient 
    ? (newClientName.trim().length > 0 && newClientEmail.trim().length > 0)
    : !!selectedClient;
    
  const isCategoryFilled = isCreatingCategory 
    ? newCategoryName.trim().length > 0
    : !!selectedCategory;
    
  const isServiceFilled = selectedCategory && !isCreatingCategory 
    ? (servicesForSelectedCategory.length > 0 ? (!!selectedServiceId && !!selectedPackageId) : true) 
    : true;

  const isStepCVisible = isStepBVisible && isClientFilled && isCategoryFilled && isServiceFilled;
  
  const isStepEVisible = isStepCVisible && !!selectedModelId;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const resetServicePackageSelection = () => {
    setSelectedServiceId('');
    setSelectedPackageId('');
    setIncludedCredits(15);
  };

  const resetForm = () => {
    setTitle('');
    setSelectedClient(null);
    setSelectedCategory('');
    setNewClientName('');
    setNewClientEmail('');
    setNewCategoryName('');
    setIsCreatingClient(false);
    setIsCreatingCategory(false);
    setIncludedCredits(15);
    setSendInviteEmail(true);
    setOriginalDriveLink('');
    setSelectedServiceId('');
    setSelectedPackageId('');
    setSelectedModelId('');
    setError(null);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let finalClientId = selectedClient?.id;
      let finalClientName = selectedClient?.name || '';
      let finalClientEmail = selectedClient?.email || '';

      if (isCreatingClient) {
        if (!newClientName || !newClientEmail) throw new Error('Nome e e-mail do cliente são obrigatórios');
        const clientRef = await clientService.createClient({
          name: newClientName,
          email: newClientEmail.toLowerCase().trim()
        });
        finalClientId = clientRef.id;
        finalClientName = newClientName;
        finalClientEmail = newClientEmail.toLowerCase().trim();
      }

      if (!finalClientId) throw new Error('Selecione ou cadastre um cliente para o projeto');

      let finalCategory = selectedCategory;
      if (isCreatingCategory && newCategoryName) {
        await categoryService.createCategory(newCategoryName);
        finalCategory = newCategoryName;
      }
      if (!finalCategory) finalCategory = 'Geral';

      if (!isCreatingCategory && servicesForSelectedCategory.length > 0) {
        if (!selectedService) throw new Error('Selecione o serviço referente a este projeto');
        if (!selectedPackage) throw new Error('Selecione o pacote referente a este projeto');
      }

      if (!selectedModelId) throw new Error('Selecione o modelo de fluxo do projeto');

      const clientStatus = await clientService.checkGlobalStatus(finalClientEmail);

      const projectPayload: any = {
        title,
        clientId: finalClientId,
        clientName: finalClientName,
        clientEmail: finalClientEmail,
        category: finalCategory,
        type: selectedService?.name || finalCategory,
        status: 'Em Seleção',
        clientStatus: clientStatus as 'pending' | 'confirmed',
        coverImage: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?q=80&w=2070&auto=format&fit=crop',
        progress: 0,
        creditsUsed: 0,
        creditsTotal: packageIncludedCredits,
        includedItems: packageIncludedCredits,
        extraPrice: packageAdditionalItemPrice,
        originalDriveLink: originalDriveLink.trim(),
        serviceCatalogId: selectedService?.id || '',
        serviceCatalogName: selectedService?.name || '',
        packageId: selectedPackage?.id || '',
        packageName: selectedPackage?.name || '',
        selectionUnit: selectedService?.selectionUnit || '',
        workflowModelId: selectedModelId, // <-- FLUXO VINCULADO!
      };

      const projectRef = await projectService.createProject(projectPayload);

      if (sendInviteEmail && finalClientEmail) {
        const isRegistered = clientStatus === 'confirmed';
        const inviteLink = isRegistered
          ? `${window.location.origin}/login`
          : `${window.location.origin}/register?email=${encodeURIComponent(finalClientEmail)}`;
        try {
          await emailService.sendInvite(finalClientEmail, finalClientName, inviteLink, isRegistered);
        } catch (emailErr) {
          console.warn('Failed to send auto-invite:', emailErr);
        }
      }

      // Redireciona para o cockpit caso tenha fluxo selecionado, ou para config
      onSuccess();
      resetForm();
      onClose();
      navigate(`/projetos/${projectRef.id}/fluxo`); 
    } catch (err: any) {
      setError(err.message || 'Erro ao criar o projeto.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="space-y-12 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <button onClick={() => { resetForm(); onClose(); }} className="mb-4 flex items-center gap-2 text-zinc-500 hover:text-white transition-all text-xs font-bold uppercase tracking-widest">
            <ChevronLeft className="w-4 h-4" /> Voltar
          </button>
          <div className="flex flex-col gap-1">
            <h1 className="text-4xl font-black tracking-tight text-white uppercase italic">Novo Projeto</h1>
            <p className="text-[#ff5351] font-bold text-lg">Criação em etapas</p>
          </div>
        </div>
      </header>

      <section className="bg-[#1f1f1f] border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl overflow-hidden">
        <form onSubmit={handleCreateProject} className="space-y-8">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm font-semibold">
              {error}
            </div>
          )}

          {/* PASSO A: TÍTULO */}
          <div className="space-y-2 relative z-50">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">1. Título do Projeto</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Casamento Luiza & Marcos"
              required
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-white focus:border-[#ff5351] outline-none transition-all"
            />
          </div>

          {/* PASSO B: CLIENTE E CATEGORIA */}
          {isStepBVisible && (
            <div className="space-y-8 animate-in slide-in-from-top-4 fade-in duration-500 relative z-40">
              <div className="h-px w-full bg-zinc-800/50 my-2"></div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#ff5351]">2. Informações do Cliente</label>
                  <button type="button" onClick={() => setIsCreatingClient(!isCreatingClient)} className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white">
                    {isCreatingClient ? 'Buscar Existente' : 'Novo Cliente'}
                  </button>
                </div>

                {isCreatingClient ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" placeholder="Nome do Cliente" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-white focus:border-[#ff5351] outline-none" required />
                    <input type="email" placeholder="E-mail" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-white focus:border-[#ff5351] outline-none" required />
                  </div>
                ) : (
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-[#ff5351]" />
                    <select className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-12 pr-4 py-4 text-white focus:border-[#ff5351] outline-none appearance-none cursor-pointer" value={selectedClient?.id || ''} onChange={(e) => setSelectedClient(clients.find((item) => item.id === e.target.value) || null)}>
                      <option value="">Selecione um cliente...</option>
                      {clients.map((client) => <option key={client.id} value={client.id}>{client.name} ({client.email})</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#ff5351]">3. Categoria do Serviço</label>
                  <button type="button" onClick={() => { setIsCreatingCategory(!isCreatingCategory); resetServicePackageSelection(); }} className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white">
                    {isCreatingCategory ? 'Lista' : '+ Nova Categoria'}
                  </button>
                </div>

                {isCreatingCategory ? (
                  <input type="text" placeholder="Ex: Podcast..." value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-white focus:border-[#ff5351] outline-none" required />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {allCategories.map((category) => (
                      <button key={category} type="button" onClick={() => { setSelectedCategory(category); resetServicePackageSelection(); }} className={cn('px-4 py-2 rounded-full border text-xs font-bold transition-all', selectedCategory === category ? 'bg-[#ff5351] border-[#ff5351] text-white' : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300')}>
                        {category}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* SERVIÇO E PACOTE - Abre imediatamente após escolher a categoria */}
              {!isCreatingCategory && selectedCategory && (
                <div className="space-y-6 rounded-3xl border border-zinc-800 bg-zinc-900/40 p-5 md:p-6 animate-in slide-in-from-top-4 fade-in duration-300">
                  {loadingReferences ? (
                    <div className="flex items-center gap-3 text-zinc-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Carregando serviços...</div>
                  ) : servicesForSelectedCategory.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Serviço</label>
                        <select value={selectedServiceId} onChange={(e) => { setSelectedServiceId(e.target.value); setSelectedPackageId(''); }} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-white focus:border-[#ff5351] outline-none transition-all">
                          <option value="">Selecione o serviço...</option>
                          {servicesForSelectedCategory.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Pacote</label>
                        <select value={selectedPackageId} onChange={(e) => setSelectedPackageId(e.target.value)} disabled={!selectedService} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-white focus:border-[#ff5351] outline-none transition-all disabled:opacity-50">
                          <option value="">Selecione o pacote...</option>
                          {packagesForSelectedService.map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.name}</option>)}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-500">
                      Nenhum pacote ativo para esta categoria. Você pode prosseguir.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* PASSO C: FLUXO */}
          {isStepCVisible && (
            <div className="space-y-4 animate-in slide-in-from-top-4 fade-in duration-500 relative z-30">
              <div className="h-px w-full bg-zinc-800/50 my-2"></div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[#ff5351] ml-1 flex items-center gap-2">
                <GitMerge className="w-4 h-4" /> 4. Modelo de Fluxo
              </label>
              
              {models.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {models.map(model => (
                    <div 
                      key={model.id}
                      onClick={() => setSelectedModelId(model.id)}
                      className={cn(
                        "p-4 rounded-2xl border cursor-pointer transition-all hover:-translate-y-1",
                        selectedModelId === model.id 
                          ? "bg-[#ff5351]/10 border-[#ff5351]" 
                          : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-600"
                      )}
                    >
                      <h4 className="text-white font-bold text-sm mb-1">{model.name}</h4>
                      <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">{model.stages?.length || 0} Etapas</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-zinc-700 p-4 text-sm text-zinc-500">
                  Nenhum modelo de fluxo cadastrado. <button type="button" onClick={() => setSelectedModelId('default')} className="text-[#ff5351] font-bold">Usar fluxo básico</button>
                </div>
              )}
            </div>
          )}

          {/* PASSO E: FINALIZAÇÃO */}
          {isStepEVisible && (
            <div className="space-y-8 animate-in slide-in-from-top-4 fade-in duration-500 relative z-20">
              <div className="h-px w-full bg-zinc-800/50 my-2"></div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#ff5351] ml-1">5. Link do Drive e Mídias</label>
                <div className="relative">
                  <FolderOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                  <input type="text" value={originalDriveLink} onChange={(e) => setOriginalDriveLink(e.target.value)} placeholder="https://drive.google.com/drive/folders/..." className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-12 pr-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Mídias inclusas (Créditos)</label>
                  <input type="number" value={packageIncludedCredits} onChange={(e) => setIncludedCredits(parseInt(e.target.value) || 0)} disabled={!!selectedPackage} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-white focus:border-[#ff5351] outline-none disabled:opacity-60" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Valor por item adicional</label>
                  <input type="text" value={formatCurrency(packageAdditionalItemPrice)} readOnly className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-white opacity-80" />
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800 cursor-pointer group" onClick={() => setSendInviteEmail(!sendInviteEmail)}>
                <div className={cn('w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all', sendInviteEmail ? 'bg-[#ff5351] border-[#ff5351]' : 'border-zinc-700')}>
                  {sendInviteEmail && <Check className="w-4 h-4 text-white" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-white uppercase tracking-widest">Enviar convite por e-mail</div>
                  <div className="text-[10px] text-zinc-500 font-medium">O cliente receberá o link para criar senha.</div>
                </div>
              </div>

              <footer className="pt-4 flex gap-4">
                <button type="button" onClick={() => { resetForm(); onClose(); }} className="flex-1 py-4 rounded-xl border border-zinc-800 text-white font-bold hover:bg-zinc-800 transition-all">Cancelar</button>
                <button type="submit" disabled={loading} className="flex-[2] py-4 rounded-xl bg-[#ff5351] text-white font-bold hover:opacity-90 transition-all shadow-xl shadow-[#ff5351]/20 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Criar Projeto e Ir para o Cockpit'}
                </button>
              </footer>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
