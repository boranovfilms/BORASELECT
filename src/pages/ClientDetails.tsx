import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Plus, FileText, Calendar, Clock, ChevronRight, 
  User, Mail, BadgeCheck, AlertCircle, Loader2, X, Save, Trash2, GitBranch, ChevronDown
} from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { contentPlanService, ContentPlan } from '../services/contentPlanService';
import { modelosService, WorkflowModel } from '../services/modelosService';
import { DataTable } from '../components/ui/DataTable';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';

export default function ClientDetails() {
  const { id: clientId } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<any>(null);
  const [plans, setPlans] = useState<ContentPlan[]>([]);
  const [availableModels, setAvailableModels] = useState<WorkflowModel[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPlan, setNewPlan] = useState({ name: '', month: '', text: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (clientId) loadData();
  }, [clientId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const clientRef = doc(db, 'clients', clientId!);
      const [clientSnap, plansData, modelsData] = await Promise.all([
        getDoc(clientRef),
        contentPlanService.getPlansByClient(clientId!),
        modelosService.getModelos()
      ]);
      
      if (clientSnap.exists()) {
        setClient({ id: clientSnap.id, ...clientSnap.data() });
      } else {
        toast.error('Cliente não encontrado no banco de dados.');
      }

      setPlans(plansData);
      setAvailableModels(modelsData || []);

    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar dados do cliente.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateWorkflowModel = async (modelId: string) => {
    if (!clientId) return;
    try {
      const clientRef = doc(db, 'clients', clientId);
      await updateDoc(clientRef, {
        workflowModelId: modelId,
        updatedAt: new Date().toISOString()
      });
      setClient((prev: any) => ({ ...prev, workflowModelId: modelId }));
      toast.success('Modelo de fluxo vinculado!');
    } catch (error) {
      toast.error('Erro ao vincular modelo.');
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await contentPlanService.createPlan({
        clientId: clientId!,
        name: newPlan.name,
        monthReference: newPlan.month,
        currentText: newPlan.text
      });
      toast.success('Planejamento criado!');
      setIsModalOpen(false);
      setNewPlan({ name: '', month: '', text: '' });
      loadData();
    } catch (error) {
      toast.error('Erro ao criar planejamento.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async (e: React.MouseEvent, planId: string) => {
    e.stopPropagation();
    if (window.confirm('Deseja excluir este planejamento permanentemente?')) {
      try {
        setLoading(true);
        await contentPlanService.deletePlan(planId);
        toast.success('Planejamento excluído com sucesso');
        await loadData();
      } catch (error) {
        toast.error('Erro ao excluir planejamento.');
        setLoading(false);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    const configs: any = {
      rascunho: { label: 'Rascunho', class: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
      aguardando_cliente: { label: 'Aguard. Cliente', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
      aguardando_validacao_equipe: { label: 'Validação Equipe', class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
      aprovado: { label: 'Aprovado', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
      devolvido: { label: 'Devolvido', class: 'bg-red-500/10 text-red-400 border-red-500/20' },
    };
    const config = configs[status] || configs.rascunho;
    return <span className={cn("px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest", config.class)}>{config.label}</span>;
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" /></div>;
  if (!client) return <div className="p-8 text-center text-white"><p className="mb-4">Cliente não encontrado.</p><button onClick={() => navigate('/clients')} className="text-[#ff5351] font-bold underline">Voltar para a lista</button></div>;

  return (
    <div className="space-y-8 pb-20">
      <header>
        <button onClick={() => navigate('/clients')} className="mb-4 flex items-center gap-2 text-zinc-500 hover:text-white transition-all text-xs font-bold uppercase tracking-widest">
          <ArrowLeft className="w-4 h-4" /> Voltar para Gestão
        </button>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-3xl bg-[#ff5351]/10 border border-[#ff5351]/20 flex items-center justify-center">
              <User className="w-8 h-8 text-[#ff5351]" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white uppercase italic tracking-tight">{client.name}</h1>
              <div className="flex flex-wrap items-center gap-4 mt-2">
                <span className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium"><Mail className="w-3.5 h-3.5" /> {client.email}</span>
                <span className="text-zinc-800">•</span>
                
                {/* SELETOR DE MODELO DE FLUXO */}
                <div className="flex items-center gap-2">
                  <GitBranch className="w-3.5 h-3.5 text-zinc-500" />
                  <div className="relative">
                    <select 
                      value={client.workflowModelId || ''} 
                      onChange={(e) => handleUpdateWorkflowModel(e.target.value)}
                      className="bg-zinc-900 border border-zinc-800 rounded-lg pl-2 pr-8 py-1 text-[10px] font-black uppercase tracking-widest text-zinc-300 focus:border-[#ff5351] outline-none appearance-none cursor-pointer"
                    >
                      <option value="">Nenhum modelo vinculado</option>
                      {availableModels.map(model => (
                        <option key={model.id} value={model.id}>{model.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600 pointer-events-none" />
                  </div>
                </div>

                <span className="text-zinc-800">•</span>
                <span className={cn("text-[10px] font-black uppercase tracking-widest", client.status === 'confirmed' ? "text-emerald-500" : "text-amber-500")}>
                  {client.status === 'confirmed' ? '✓ Ativo' : '⏳ Pendente'}
                </span>
              </div>
            </div>
          </div>
          <button onClick={() => navigate(`/clients/${clientId}/novo-planejamento`)} className="h-12 px-6 bg-[#ff5351] text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center gap-2 shadow-xl shadow-[#ff5351]/20">
            <Plus className="w-4 h-4" /> Novo Planejamento
          </button>
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-black uppercase tracking-[0.3em] text-zinc-600 shrink-0">Planejamentos de Conteúdo</h2>
          <div className="h-px flex-1 bg-zinc-800/50" />
        </div>

        <DataTable 
          data={plans}
          onRowClick={(plan) => navigate(`/planejamento/${plan.id}`)}
          emptyMessage="Nenhum planejamento de conteúdo criado para este cliente."
          columns={[
            {
              header: 'Planejamento',
              accessor: (plan) => (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-900 rounded-lg border border-zinc-800"><FileText className="w-4 h-4 text-[#ff5351]" /></div>
                  <p className="text-white font-black uppercase text-sm">{plan.name}</p>
                </div>
              )
            },
            { header: 'Mês Referência', accessor: 'monthReference', className: 'text-zinc-400 font-bold' },
            { header: 'Status', accessor: (plan) => getStatusBadge(plan.status), align: 'center' },
            { 
              header: 'Última Atualização', 
              accessor: (plan) => {
                const date = plan.updatedAt?.toDate ? plan.updatedAt.toDate() : new Date(plan.updatedAt);
                return <span className="text-zinc-500 text-xs">{new Intl.DateTimeFormat('pt-BR').format(date)}</span>;
              }
            }
          ]}
          actions={(plan) => (
            <div className="flex items-center gap-2">
              <button 
                onClick={(e) => handleDeletePlan(e, plan.id!)}
                className="p-2 bg-zinc-800/50 border border-zinc-700 hover:bg-red-500/10 rounded-xl text-zinc-500 hover:text-red-500 transition-all"
                title="Excluir Planejamento"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button className="p-2 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 rounded-xl text-zinc-500 hover:text-white transition-all">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        />
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-3xl bg-[#151515] rounded-[32px] border border-zinc-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <header className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/30">
              <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">Novo Planejamento</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500"><X className="w-6 h-6" /></button>
            </header>
            <form onSubmit={handleCreatePlan}>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Nome da Campanha</label>
                    <input required type="text" value={newPlan.name} onChange={e => setNewPlan({...newPlan, name: e.target.value})} placeholder="Ex: Campanha de Inverno" className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white focus:border-[#ff5351] outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Mês de Referência</label>
                    <input required type="text" value={newPlan.month} onChange={e => setNewPlan({...newPlan, month: e.target.value})} placeholder="Ex: Junho 2026" className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white focus:border-[#ff5351] outline-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Texto do Planejamento</label>
                  <textarea required rows={10} value={newPlan.text} onChange={e => setNewPlan({...newPlan, text: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-sm text-white focus:border-[#ff5351] outline-none resize-none" placeholder="Cole aqui o texto completo da redatora..." />
                </div>
              </div>
              <footer className="p-6 bg-zinc-900/50 border-t border-zinc-800 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 h-12 text-xs font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-all bg-zinc-900 rounded-xl border border-zinc-800">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 h-12 bg-[#ff5351] text-white text-xs font-black uppercase tracking-widest rounded-xl hover:brightness-110 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar Planejamento
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
