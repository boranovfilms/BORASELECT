import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Save, Loader2, ChevronDown, ChevronUp, Users, 
  Check, Plus, X, GitBranch, User
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { modelosService, WorkflowModel, Stage, DEMAND_TYPE_LABELS, DemandType } from '../services/modelosService';
import { cn } from '../lib/utils';

export default function ConfigurarFluxo() {
  const { clientId, demandType } = useParams<{ clientId: string; demandType: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientName, setClientName] = useState('');
  const [availableModels, setAvailableModels] = useState<WorkflowModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<WorkflowModel | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [boranovMembers, setBoranovMembers] = useState<any[]>([]);
  const [workflowApprovers, setWorkflowApprovers] = useState<Record<string, string[]>>({});
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [showAddDropdown, setShowAddDropdown] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [clientId, demandType]);

  useEffect(() => {
    async function loadModel() {
      if (!selectedModelId) {
        setSelectedModel(null);
        return;
      }
      const model = await modelosService.getModelo(selectedModelId);
      setSelectedModel(model);
    }
    loadModel();
  }, [selectedModelId]);

  const loadData = async () => {
    if (!clientId || !demandType) return;
    setLoading(true);
    try {
      const [clientSnap, modelsData] = await Promise.all([
        getDoc(doc(db, 'clients', clientId)),
        modelosService.getModelos()
      ]);

      if (clientSnap.exists()) {
        const cData = clientSnap.data();
        setClientName(cData.name || '');
        const wfModels = cData.workflowModels || {};
        setSelectedModelId(wfModels[demandType] || '');
        setWorkflowApprovers(cData.workflowApprovers || {});
      }

      setAvailableModels(modelsData);

      // Buscar membros da equipe do cliente
      const teamQuery = query(
        collection(db, 'clients'), 
        where('clienteId', '==', clientId), 
        where('role', '==', 'equipe')
      );
      const teamSnap = await getDocs(teamQuery);
      setTeamMembers(teamSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Buscar membros da equipe Boranov (role !== 'cliente')
      try {
        const boranovQuery = query(
          collection(db, 'team'),
          where('role', '!=', 'cliente')
        );
        const boranovSnap = await getDocs(boranovQuery);
        setBoranovMembers(boranovSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.warn('Equipe Boranov não encontrada na coleção team:', e);
        // Fallback: buscar na coleção clients com role master
        try {
          const boranovQuery2 = query(
            collection(db, 'clients'),
            where('role', '==', 'master')
          );
          const boranovSnap2 = await getDocs(boranovQuery2);
          setBoranovMembers(boranovSnap2.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e2) {
          console.warn('Fallback também falhou:', e2);
          setBoranovMembers([]);
        }
      }

    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  };

  const toggleStage = (stageId: string) => {
    const next = new Set(expandedStages);
    if (next.has(stageId)) next.delete(stageId);
    else next.add(stageId);
    setExpandedStages(next);
  };

  const addApprover = (stageId: string, email: string) => {
    setWorkflowApprovers(prev => {
      const current = prev[stageId] || [];
      if (current.includes(email)) return prev;
      return { ...prev, [stageId]: [...current, email] };
    });
    setShowAddDropdown(null);
  };

  const removeApprover = (stageId: string, email: string) => {
    setWorkflowApprovers(prev => {
      const current = prev[stageId] || [];
      return { ...prev, [stageId]: current.filter(e => e !== email) };
    });
  };

  const handleSave = async () => {
    if (!clientId || !demandType) return;
    setSaving(true);
    try {
      const clientRef = doc(db, 'clients', clientId);
      const clientSnap = await getDoc(clientRef);
      const cData = clientSnap.data() || {};
      
      const currentWorkflowModels = cData.workflowModels || {};
      const updatedWorkflowModels = {
        ...currentWorkflowModels,
        [demandType]: selectedModelId || null
      };

      await updateDoc(clientRef, {
        workflowModels: updatedWorkflowModels,
        workflowApprovers: workflowApprovers,
        updatedAt: new Date().toISOString()
      });

      toast.success('Configuração salva!');
      navigate(-1);
    } catch (error) {
      toast.error('Erro ao salvar configuração.');
    } finally {
      setSaving(false);
    }
  };

  const allMembers = [...teamMembers, ...boranovMembers];
  const demandLabel = DEMAND_TYPE_LABELS[demandType as DemandType] || demandType;

  const getStageBadge = (stage: Stage) => {
    if (stage.requiresApproval || stage.type.includes('aprovacao')) {
      return <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20">Aprovação</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/20">Execução</span>;
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20 text-left">
      {/* HEADER */}
      <header className="space-y-4">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-[#ff5351] hover:opacity-80 transition-all text-xs font-black uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div>
          <p className="text-[#ff5351] text-xs font-black uppercase tracking-[0.2em] mb-2">
            CONFIGURAR FLUXO · {clientName.toUpperCase()}
          </p>
          <h1 className="text-5xl font-black text-white uppercase italic tracking-tight leading-none">
            {demandLabel}
          </h1>
        </div>
      </header>

      {/* SELETOR DE MODELO */}
      <section className="bg-[#1f1f1f] border border-zinc-800 rounded-[32px] p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-[#ff5351]/10 rounded-xl border border-[#ff5351]/20">
            <GitBranch className="w-5 h-5 text-[#ff5351]" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white uppercase italic leading-none">Modelo de Fluxo Vinculado</h3>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mt-2">Selecione o modelo de fluxo para este tipo de demanda.</p>
          </div>
        </div>

        <div className="relative">
          <select
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
            className="w-full h-14 bg-zinc-900 border border-zinc-800 rounded-2xl px-5 text-white focus:border-[#ff5351] outline-none appearance-none cursor-pointer font-bold uppercase text-sm"
          >
            <option value="">Nenhum modelo vinculado</option>
            {availableModels.map(model => (
              <option key={model.id} value={model.id}>{model.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        </div>
      </section>

      {/* ETAPAS DO FLUXO */}
      {selectedModel && selectedModel.stages && selectedModel.stages.length > 0 && (
        <section className="bg-[#1f1f1f] border border-zinc-800 rounded-[32px] p-8 shadow-xl space-y-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-[#ff5351]/10 rounded-xl border border-[#ff5351]/20">
              <Users className="w-5 h-5 text-[#ff5351]" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white uppercase italic leading-none">Etapas do Fluxo</h3>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mt-2">Configure os responsáveis e aprovadores de cada etapa.</p>
            </div>
          </div>

          {selectedModel.stages.sort((a, b) => a.order - b.order).map((stage) => {
            const isExpanded = expandedStages.has(stage.id);
            const stageApprovers = workflowApprovers[stage.id] || [];
            const availableForStage = allMembers.filter(m => !stageApprovers.includes(m.email));

            return (
              <div key={stage.id} className="border border-zinc-800 rounded-2xl overflow-hidden">
                {/* HEADER DA ETAPA */}
                <button
                  onClick={() => toggleStage(stage.id)}
                  className="w-full p-5 flex items-center justify-between bg-zinc-900/30 hover:bg-zinc-900/50 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-500">
                      {(stage.order || 0) + 1}
                    </div>
                    <div className="text-left">
                      <h4 className="text-white font-black uppercase text-sm">{stage.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{stage.type.replace(/_/g, ' ')}</span>
                        {getStageBadge(stage)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                      {stageApprovers.length} responsável{stageApprovers.length !== 1 ? 'es' : ''}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                  </div>
                </button>

                {/* BODY EXPANDIDO */}
                {isExpanded && (
                  <div className="p-5 bg-black/20 animate-in slide-in-from-top-2 duration-200">
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-3">
                      {stage.requiresApproval || stage.type.includes('aprovacao') ? 'Aprovadores' : 'Responsáveis'}
                    </label>

                    {/* LISTA DE RESPONSÁVEIS */}
                    <div className="space-y-2 mb-4">
                      {stageApprovers.map((email) => {
                        const member = allMembers.find(m => m.email === email);
                        return (
                          <div key={email} className="flex items-center justify-between p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                                {member?.photoUrl ? (
                                  <img src={member.photoUrl} className="w-full h-full object-cover" alt="" />
                                ) : (
                                  <User className="w-4 h-4 text-zinc-600" />
                                )}
                              </div>
                              <div>
                                <p className="text-white text-[10px] font-black uppercase">{member?.name || email}</p>
                                <p className="text-zinc-600 text-[8px] font-bold uppercase tracking-wider">{member?.jobTitle || member?.role || 'Membro'}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => removeApprover(stage.id, email)}
                              className="p-1.5 hover:bg-red-500/10 rounded-lg text-zinc-600 hover:text-red-400 transition-all"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* BOTÃO ADICIONAR */}
                    <div className="relative">
                      {showAddDropdown === stage.id ? (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
                          <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Selecionar membro</span>
                            <button 
                              onClick={() => setShowAddDropdown(null)}
                              className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-500"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {availableForStage.length === 0 ? (
                              <div className="p-4 text-center text-zinc-600 text-xs">Nenhum membro disponível</div>
                            ) : (
                              availableForStage.map((member) => (
                                <button
                                  key={member.id}
                                  onClick={() => addApprover(stage.id, member.email)}
                                  className="w-full p-3 flex items-center gap-3 hover:bg-zinc-800/50 transition-all text-left"
                                >
                                  <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                                    {member.photoUrl ? (
                                      <img src={member.photoUrl} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                      <User className="w-4 h-4 text-zinc-600" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-white text-[10px] font-black uppercase">{member.name}</p>
                                    <p className="text-zinc-600 text-[8px] font-bold uppercase tracking-wider">{member.jobTitle || member.role}</p>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowAddDropdown(stage.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white hover:border-[#ff5351] transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" /> Adicionar
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* BOTÃO SALVAR */}
      <footer className="flex justify-end pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-14 px-10 bg-[#ff5351] text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:brightness-110 transition-all flex items-center gap-3 shadow-xl shadow-[#ff5351]/20 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Salvar Configuração
        </button>
      </footer>
    </div>
  );
}
