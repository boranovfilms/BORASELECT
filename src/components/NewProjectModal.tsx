import React, { useEffect, useMemo, useState } from 'react';
import { Check, Search, Loader2, ChevronLeft, FolderOpen, GitBranch } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clientService, Client } from '../services/clientService';
import { categoryService, Category } from '../services/categoryService';
import { projectService } from '../services/projectService';
import { cn } from '../lib/utils';
import { emailService } from '../services/emailService';
import { settingsService, ServiceCatalog, ServicePackageConfig } from '../services/settingsService';
import { modelosService, WorkflowModel } from '../services/modelosService';
import { projetoFluxoService, ProjectStage } from '../services/projetoFluxoService';

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

  // Serviço e Pacote
  const [serviceCatalogs, setServiceCatalogs] = useState<ServiceCatalog[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState('');

  // C - Modelos de Fluxo
  const [workflowModels, setWorkflowModels] = useState<WorkflowModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [workflowStages, setWorkflowStages] = useState<ProjectStage[]>([]);

  // D - Finalização
  const [originalDriveLink, setOriginalDriveLink] = useState('');
  const [includedCredits, setIncludedCredits] = useState(15);
  const [sendInviteEmail, setSendInviteEmail] = useState(true);

  // --- PROGRESSIVE DISCLOSURE REGRAS ---
  const isStepBVisible = title.trim().length > 0;
  
  const hasClient = isCreatingClient ? (newClientName.length > 0 && newClientEmail.length > 0) : selectedClient !== null;
  const hasCategory = isCreatingCategory ? newCategoryName.length > 0 : selectedCategory !== '';
  const isServicesVisible = isStepBVisible && hasClient && hasCategory;
  
  const hasServiceAndPackage = selectedServiceId !== '' && selectedPackageId !== '';
  
  // O Fluxo e Finalização aparecem se o cara preencheu Serviço/Pacote OU se ele escolheu uma categoria que não tem Serviço cadastrado.
  const servicesAvailable = useMemo(() => {
    return serviceCatalogs.filter((s) => s.category === (isCreatingCategory ? newCategoryName : selectedCategory));
  }, [selectedCategory, newCategoryName, isCreatingCategory, serviceCatalogs]);
  
  const isFlowVisible = isServicesVisible && (hasServiceAndPackage || servicesAvailable.length === 0);
  
  const isFinalVisible = isFlowVisible && (selectedModelId !== '');

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      setError(null);
    }
  }, [isOpen]);

  const loadInitialData = async () => {
    setLoadingReferences(true);
    try {
      const [cls, cats, catalogs, models] = await Promise.all([
        clientService.searchClients(''),
        categoryService.getCategories(),
        settingsService.getServiceCatalogs(),
        modelosService.getModelos()
      ]);

      setClients(cls);
      setCategories(cats);
      setServiceCatalogs(catalogs.filter((service) => service.status === 'Ativo'));
      setWorkflowModels(models || []);
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

  const selectedService = useMemo(() => {
    return servicesAvailable.find((service) => service.id === selectedServiceId) || null;
  }, [servicesAvailable, selectedServiceId]);

  const packagesForSelectedService = useMemo(() => {
    if (!selectedService) return [];
    return (selectedService.packages || []).filter((pkg) => pkg.status === 'Ativo');
  }, [selectedService]);

  const selectedPackage = useMemo(() => {
    return packagesForSelectedService.find((pkg) => pkg.id === selectedPackageId) || null;
  }, [packagesForSelectedService, selectedPackageId]);

  const packageIncludedCredits = selectedPackage ? selectedPackage.includedSelections : includedCredits;
  const packageAdditionalItemPrice = selectedPackage ? selectedPackage.additionalItemPrice : 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const resetServicePackageSelection = () => {
    setSelectedServiceId('');
    setSelectedPackageId('');
    setIncludedCredits(15);
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    resetServicePackageSelection();
  };

  const handleModelSelect = (modelId: string) => {
    setSelectedModelId(modelId);
    
    if (modelId === 'none' || !modelId) {
      setWorkflowStages([]);
      return;
    }

    const model = workflowModels.find(m => m.id === modelId);
    if (model) {
      const stages = model.stages || [];
      const initialStages: ProjectStage[] = stages.map(stage => ({
        id: crypto.randomUUID(),
        originalStageId: stage?.id || crypto.randomUUID(),
        name: stage?.name || 'Etapa sem nome',
        description: stage?.description || '',
        assignee: stage?.assignee || '', 
        durationDays: Number(stage?.durationDays) || 0,
        requiresClientApproval: Boolean(stage?.requiresClientApproval),
        status: 'pending',
      }));
      setWorkflowStages(initialStages);
    }
  };

  const updateStageField = (index: number, field: keyof ProjectStage, value: any) => {
    const newStages = [...workflowStages];
    newStages[index] = { ...newStages[index], [field]: value };
    setWorkflowStages(newStages);
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
    setWorkflowStages([]);
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
        const clientRef = await clientService.createClient({ name: newClientName, email: newClientEmail.toLowerCase().trim() });
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

      if (!isCreatingCategory && servicesAvailable.length > 0) {
        if (!selectedService) throw new Error('Selecione o serviço referente a este projeto');
        if (!selectedPackage) throw new Error('Selecione o pacote referente a este projeto');
      }

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
      };

      const projectRef = await projectService.createProject(projectPayload);

      if (selectedModelId && selectedModelId !== 'none' && workflowStages.length > 0) {
        const selectedModel = workflowModels.find(m => m.id === selectedModelId);
        if (selectedModel) {
          const stagesToSave = [...workflowStages];
          stagesToSave[0].status = 'in_progress'; 
          stagesToSave[0].startedAt = new Date().toISOString();
          
          await projetoFluxoService.initializeWorkflow(projectRef.id, selectedModel, stagesToSave);
        }
      }

      if (sendInviteEmail && finalClientEmail) {
        const status = await clientService.checkGlobalStatus(finalClientEmail);
        const isRegistered = status === 'confirmed';
        const inviteLink = isRegistered ? `${window.location.origin}/login` : `${window.location.origin}/register?email=${encodeURIComponent(finalClientEmail)}`;
        try {
          await emailService.sendInvite(finalClientEmail, finalClientName, inviteLink, isRegistered);
        } catch (emailErr) {
          console.error('Failed to send auto-invite email:', emailErr);
        }
      }

      onSuccess();
      resetForm();
      onClose();
      
      if (selectedModelId && selectedModelId !== 'none') {
        navigate(`/projetos/${projectRef.id}/fluxo`);
      } else {
        navigate(`/projects/${projectRef.id}/config`);
      }

    } catch (err: any) {
      console.error('Project creation failed:', err);
      setError(err.message || 'Ocorreu um erro ao criar o projeto. Verifique suas permissões.');
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
            <p className="text-[#ff5351] font-bold text-lg">Criação de projeto</p>
          </div>
        </div>
      </header>

      <section className="bg-[#1f1f1f] border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl overflow-hidden">
        <form onSubmit={handleCreateProject} className="space-y-8">
          {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm font-semibold animate-in fade-in zoom-in-95">{error}</div>}

          {/* ==========================================
              PASSO A: TÍTULO DO PROJETO 
             ========================================== */}
          <div className="space-y-2 relative z-50">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Título do Projeto</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Casamento Luiza & Marcos"
              required
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-white focus:border-[#ff5351] outline-none transition-all shadow-lg"
            />
          </div>

          {/* ==========================================
              PASSO B: CLIENTE E CATEGORIA 
             ========================================== */}
          <div className={cn("space-y-8 transition-all duration-700 ease-in-out origin-top", isStepBVisible ? "opacity-100 scale-y-100 h-auto" : "opacity-0 scale-y-0 h-0 overflow-hidden")}>
            <div className="space-y-4 pt-4 border-t border-zinc-800">
              <div className="flex items-center justify-between ml-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Informações do Cliente</label>
                <button type="button" onClick={() => setIsCreatingClient(!isCreatingClient)} className="text-[10px] font-black uppercase tracking-widest text-[#ff5351] hover:underline">
                  {isCreatingClient ? 'Buscar Existente' : 'Novo Cliente'}
                </button>
              </div>

              {isCreatingClient ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                  <input type="text" placeholder="Nome do Cliente" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-white focus:border-[#ff5351] outline-none" required={isStepBVisible} />
                  <input type="email" placeholder="E-mail" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-white focus:border-[#ff5351] outline-none" required={isStepBVisible} />
                </div>
              ) : (
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-[#ff5351]" />
                  <select className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-12 pr-4 py-4 text-white focus:border-[#ff5351] outline-none appearance-none cursor-pointer" value={selectedClient?.id || ''} onChange={(e) => setSelectedClient(clients.find((item) => item.id === e.target.value) || null)} required={isStepBVisible && !isCreatingClient}>
                    <option value="">Selecione um cliente...</option>
                    {clients.map((client) => <option key={client.id} value={client.id}>{client.name} ({client.email})</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between ml-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Categoria do Serviço</label>
                <button type="button" onClick={() => { setIsCreatingCategory(!isCreatingCategory); resetServicePackageSelection(); }} className="text-[10px] font-black uppercase tracking-widest text-[#ff5351] hover:underline">
                  {isCreatingCategory ? 'Lista' : '+ Nova Categoria'}
                </button>
              </div>

              {isCreatingCategory ? (
                <input type="text" placeholder="Ex: Podcast, Institucional..." value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-white focus:border-[#ff5351] outline-none animate-in fade-in" required={isStepBVisible} />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allCategories.map((category) => (
                    <button key={category} type="button" onClick={() => handleCategorySelect(category)} className={cn('px-4 py-2 rounded-full border text-xs font-bold transition-all', selectedCategory === category ? 'bg-[#ff5351] border-[#ff5351] text-white' : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300')}>
                      {category}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ==========================================
              PASSO B.2: SERVIÇOS E PACOTES (Aparece após Categoria)
             ========================================== */}
          <div className={cn("transition-all duration-700 ease-in-out origin-top", isServicesVisible ? "opacity-100 scale-y-100 h-auto" : "opacity-0 scale-y-0 h-0 overflow-hidden")}>
            {!isCreatingCategory && servicesAvailable.length > 0 && (
              <div className="space-y-6 rounded-3xl border border-zinc-800 bg-zinc-900/40 p-5 md:p-6 mb-8 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Serviço cadastrado</label>
                    <select value={selectedServiceId} onChange={(e) => { setSelectedServiceId(e.target.value); setSelectedPackageId(''); }} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-white focus:border-[#ff5351] outline-none">
                      <option value="">Selecione o serviço...</option>
                      {servicesAvailable.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Pacote do serviço</label>
                    <select value={selectedPackageId} onChange={(e) => setSelectedPackageId(e.target.value)} disabled={!selectedService} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-white focus:border-[#ff5351] outline-none disabled:opacity-50">
                      <option value="">Selecione o pacote...</option>
                      {packagesForSelectedService.map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ==========================================
              PASSO C: MODELO DE FLUXO E RESPONSÁVEIS
             ========================================== */}
          <div className={cn("space-y-6 transition-all duration-700 ease-in-out origin-top", isFlowVisible ? "opacity-100 scale-y-100 h-auto" : "opacity-0 scale-y-0 h-0 overflow-hidden")}>
            <div className="space-y-4 pt-4 border-t border-zinc-800">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1 flex items-center gap-2">
                <GitBranch className="w-3 h-3" /> Setup de Processo (Cockpit)
              </label>
              <div className="relative group">
                <GitBranch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-[#ff5351]" />
                <select 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-12 pr-4 py-4 text-white focus:border-[#ff5351] outline-none appearance-none cursor-pointer" 
                  value={selectedModelId} 
                  onChange={(e) => handleModelSelect(e.target.value)} 
                  required={isFlowVisible}
                >
                  <option value="">Selecione um fluxo para este projeto...</option>
                  <option value="none">Nenhum (Apenas Vitrine de Seleção)</option>
                  {workflowModels.map((model) => (
                    <option key={model.id} value={model.id}>{model.name} ({(model.stages || []).length} etapas)</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedModelId && selectedModelId !== 'none' && workflowStages.length > 0 && (
              <div className="space-y-4 rounded-3xl border border-zinc-800 bg-[#141414] p-5 animate-in fade-in slide-in-from-top-4">
                <h4 className="text-white font-black uppercase tracking-tight text-sm mb-4">Personalizar Responsáveis</h4>
                <div className="space-y-3">
                  {workflowStages.map((stage, idx) => (
                    <div key={stage.id} className="flex flex-col md:flex-row md:items-center gap-3 bg-zinc-900 p-3 rounded-2xl border border-zinc-800">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-black uppercase text-xs truncate"><span className="text-[#ff5351] mr-1">{idx+1}.</span>{stage.name}</p>
                      </div>
                      <div className="w-full md:w-48 shrink-0">
                        <input type="text" value={stage.assignee} onChange={(e) => updateStageField(idx, 'assignee', e.target.value)} placeholder="Responsável" className="w-full bg-[#111] border border-zinc-800 rounded-xl h-10 px-3 text-xs text-white focus:border-[#ff5351] outline-none" />
                      </div>
                      <div className="w-full md:w-24 shrink-0 flex items-center gap-2">
                        <input type="number" min="0" value={stage.durationDays} onChange={(e) => updateStageField(idx, 'durationDays', Number(e.target.value))} placeholder="Dias" className="w-full bg-[#111] border border-zinc-800 rounded-xl h-10 px-3 text-xs text-white focus:border-[#ff5351] outline-none" />
                        <span className="text-[10px] text-zinc-500 uppercase font-black">Dias</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ==========================================
              PASSO D: FINALIZAÇÃO (Drive, E-mail e Botão)
             ========================================== */}
          <div className={cn("space-y-8 transition-all duration-700 ease-in-out origin-top", isFinalVisible ? "opacity-100 scale-y-100 h-auto" : "opacity-0 scale-y-0 h-0 overflow-hidden")}>
            <div className="space-y-2 pt-4 border-t border-zinc-800">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Link do Drive (Arquivos limpos)</label>
              <div className="relative">
                <FolderOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                <input type="text" value={originalDriveLink} onChange={(e) => setOriginalDriveLink(e.target.value)} placeholder="https://drive.google.com/drive/folders/..." className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-12 pr-4 py-4 text-white focus:border-[#ff5351] outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Mídias inclusas (Créditos)</label>
                <input type="number" value={packageIncludedCredits} onChange={(e) => setIncludedCredits(parseInt(e.target.value) || 0)} required disabled={!!selectedPackage} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-white focus:border-[#ff5351] outline-none disabled:opacity-60" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Valor extra (R$)</label>
                <input type="text" value={formatCurrency(packageAdditionalItemPrice)} readOnly className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-white opacity-80" />
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800 hover:border-zinc-700 cursor-pointer group" onClick={() => setSendInviteEmail(!sendInviteEmail)}>
              <div className={cn('w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all', sendInviteEmail ? 'bg-[#ff5351] border-[#ff5351]' : 'border-zinc-700 group-hover:border-zinc-600')}>
                {sendInviteEmail && <Check className="w-4 h-4 text-white" />}
              </div>
              <div>
                <div className="text-xs font-bold text-white uppercase tracking-widest">Enviar convite por e-mail</div>
                <div className="text-[10px] text-zinc-500 font-medium">O cliente receberá o link para acessar.</div>
              </div>
            </div>

            <footer className="pt-4 flex gap-4 border-t border-zinc-800">
              <button type="button" onClick={() => { resetForm(); onClose(); }} className="flex-1 py-4 rounded-xl border border-zinc-800 text-white font-bold hover:bg-zinc-800 transition-all">
                Cancelar
              </button>
              <button type="submit" disabled={loading} className="flex-[2] py-4 rounded-xl bg-[#ff5351] text-white font-bold hover:opacity-90 transition-all shadow-xl shadow-[#ff5351]/20 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Criar Projeto'}
              </button>
            </footer>
          </div>
        </form>
      </section>
    </div>
  );
}
