import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Loader2, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { contentPlanService } from '../services/contentPlanService';
import { notificacaoService } from '../services/notificacaoService';
import { ChevronDown } from 'lucide-react';

export default function NewContentPlan() {
  const { id: clientId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clientName, setClientName] = useState('');
  
  const [form, setForm] = useState({
    name: '',
    monthReference: '',
    text: ''
  });

  useEffect(() => {
    async function loadClient() {
      if (!clientId) return;
      try {
        const snap = await getDoc(doc(db, 'clientes', clientId));
        if (snap.exists()) setClientName(snap.data().name || '');
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    loadClient();
  }, [clientId]);

  const handleSave = async () => {
    if (!form.name || !form.monthReference || !form.text) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (!clientId) return;
    setSaving(true);
    try {
      const planId = await contentPlanService.createPlan({
        clientId,
        name: form.name,
        monthReference: form.monthReference,
        currentText: form.text,
        posts: [],
        status: 'rascunho'
      });

      // Notifica Master para aprovar
      await notificacaoService.criar({
        para: 'admin@boraselect.com.br',
        tipo: 'planejamento_criado',
        titulo: 'Novo Planejamento Aguardando Aprovação',
        descricao: `Planejamento "${form.name}" de ${clientName} aguarda sua aprovação`,
        planId,
        visto: false,
        criadoEm: new Date().toISOString()
      });

      toast.success('Planejamento salvo! Master foi notificado.');
      navigate(`/clients/${clientId}`);
    } catch (error: any) {
      toast.error(`Erro: ${error?.message || 'desconhecido'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20 text-left">
      <header className="space-y-4">
        <button
          onClick={() => navigate(`/clients/${clientId}`)}
          className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para o Cliente
        </button>
        <div>
          <p className="text-[#ff5351] text-xs font-black uppercase tracking-[0.2em] mb-2">
            NOVO PLANEJAMENTO • {clientName.toUpperCase()}
          </p>
          <h1 className="text-5xl font-black text-white uppercase italic tracking-tight leading-none">
            Criar Planejamento
          </h1>
        </div>
      </header>

      <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[32px] p-8 space-y-8">
        
        {/* Nome e Mês */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              Nome da Campanha
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({...form, name: e.target.value})}
              placeholder="Ex: Planejamento Junho — Canaplan"
              className="w-full h-14 bg-zinc-900 border border-zinc-800 rounded-2xl px-5 text-white focus:border-[#ff5351] outline-none font-bold uppercase"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              Mês de Referência
            </label>
            <div className="relative">
              <select
                value={form.monthReference}
                onChange={e => setForm({...form, monthReference: e.target.value})}
                className="w-full h-14 bg-zinc-900 border border-zinc-800 rounded-2xl px-5 text-white focus:border-[#ff5351] outline-none appearance-none font-bold uppercase"
              >
                <option value="">Selecione o mês</option>
                {['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map(m => (
                  <option key={m} value={`${m} 2026`}>{m} 2026</option>
                ))}
              </select>
              <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Texto do planejamento */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
            Texto do Planejamento
          </label>
          <p className="text-zinc-600 text-[10px] uppercase font-bold">
            Cole aqui o texto completo da redatora
          </p>
          <textarea
            rows={20}
            value={form.text}
            onChange={e => setForm({...form, text: e.target.value})}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-[24px] p-6 text-white focus:border-[#ff5351] outline-none resize-none leading-relaxed font-medium"
            placeholder="Conteúdo 1 — Feed | 09/06/2026&#10;Headline&#10;A produtividade continua sendo o objetivo...&#10;&#10;Legenda&#10;O setor sucroenergético..."
          />
        </div>

        {/* Botão salvar */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-14 px-10 bg-[#ff5351] text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:brightness-110 transition-all flex items-center gap-3 shadow-xl shadow-[#ff5351]/20 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Salvar e Enviar para Aprovação
          </button>
        </div>
      </div>

      {/* Info do fluxo */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">
          O que acontece depois de salvar:
        </p>
        <div className="space-y-2">
          {[
            { step: '1', label: 'Master recebe notificação para aprovar' },
            { step: '2', label: 'Master aprova → Cliente recebe para revisar' },
            { step: '3', label: 'Cliente aprova → Equipe valida (se houver)' },
            { step: '4', label: 'Sistema cria os posts automaticamente' },
            { step: '5', label: 'Redator delega para produção' },
          ].map(item => (
            <div key={item.step} className="flex items-center gap-3">
              <span className="w-5 h-5 rounded-full bg-[#ff5351]/10 border border-[#ff5351]/20 text-[#ff5351] text-[9px] font-black flex items-center justify-center">
                {item.step}
              </span>
              <span className="text-zinc-400 text-xs font-medium">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
