import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Plus, Loader2, FileText, Trash2, Eye, Settings, Package, ChevronRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '../../lib/utils';

interface Orcamento {
  id?: string;
  numero: string;
  cliente: string;
  tipo: string;
  totalCliente: number;
  status: 'rascunho' | 'enviado' | 'aprovado' | 'rejeitado';
  criadoEm?: any;
  updatedAt?: any;
}

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  rascunho: { label: 'Rascunho', class: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
  enviado: { label: 'Enviado', class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  aprovado: { label: 'Aprovado ✓', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  rejeitado: { label: 'Rejeitado', class: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

export default function Orcamentos() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'orcamentos'), snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Orcamento[];
      data.sort((a, b) => {
        const dateA = a.criadoEm?.toDate ? a.criadoEm.toDate() : new Date(a.criadoEm || 0);
        const dateB = b.criadoEm?.toDate ? b.criadoEm.toDate() : new Date(b.criadoEm || 0);
        return dateB.getTime() - dateA.getTime();
      });
      setOrcamentos(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleExcluir = async (id: string, numero: string) => {
    if (!confirm(`Excluir orçamento ${numero}?`)) return;
    try {
      await deleteDoc(doc(db, 'orcamentos', id));
      toast.success('Orçamento excluído!');
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  const totalAprovados = orcamentos.filter(o => o.status === 'aprovado').reduce((acc, o) => acc + (o.totalCliente || 0), 0);
  const totalEnviados = orcamentos.filter(o => o.status === 'enviado').length;
  const totalRascunhos = orcamentos.filter(o => o.status === 'rascunho').length;

  return (
    <div className="space-y-8 pb-20 text-left">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.4em] text-[#ff5351] font-black mb-2">Boranov</p>
          <h1 className="text-5xl font-black text-white uppercase italic tracking-tight">Orçamentos</h1>
          <p className="text-zinc-500 text-sm mt-1">Gerencie propostas e orçamentos</p>
        </div>
        <button
          onClick={() => navigate('/orcamentos/novo')}
          className="h-10 px-5 bg-[#ff5351] text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:brightness-110 transition-all flex items-center gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Novo Orçamento
        </button>
      </header>

      {/* Cards de acesso rápido */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => navigate('/orcamentos/templates')}
          className="bg-[#1f1f1f] border border-zinc-800 rounded-2xl p-5 flex items-center gap-4 hover:border-zinc-600 transition-all text-left">
          <div className="w-10 h-10 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex-1">
            <p className="text-white font-black uppercase text-sm">Templates</p>
            <p className="text-zinc-500 text-xs mt-0.5">Modelos de orçamento</p>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-600" />
        </button>

        <button
          onClick={() => navigate('/orcamentos/equipamentos')}
          className="bg-[#1f1f1f] border border-zinc-800 rounded-2xl p-5 flex items-center gap-4 hover:border-zinc-600 transition-all text-left">
          <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center shrink-0">
            <Settings className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1">
            <p className="text-white font-black uppercase text-sm">Equipamentos</p>
            <p className="text-zinc-500 text-xs mt-0.5">Tabela de custos internos</p>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-600" />
        </button>

        <div className="bg-[#1f1f1f] border border-zinc-800 rounded-2xl p-5">
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Total Aprovado</p>
          <p className="text-2xl font-black text-emerald-400">
            {totalAprovados.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          <div className="flex gap-3 mt-3">
            <span className="text-[9px] font-black uppercase text-zinc-500">
              {totalEnviados} enviados
            </span>
            <span className="text-zinc-700">•</span>
            <span className="text-[9px] font-black uppercase text-zinc-500">
              {totalRascunhos} rascunhos
            </span>
          </div>
        </div>
      </div>

      {/* Lista de orçamentos */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
        </div>
      ) : orcamentos.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-black uppercase text-sm">Nenhum orçamento criado ainda</p>
          <p className="text-xs mt-2">Clique em "Novo Orçamento" para começar</p>
        </div>
      ) : (
        <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h2 className="text-xs font-black uppercase tracking-widest text-white">
              {orcamentos.length} orçamentos
            </h2>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Número</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Cliente</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Tipo</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Valor</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Status</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Data</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {orcamentos.map(orc => (
                <tr key={orc.id} className="hover:bg-zinc-800/30 transition-all">
                  <td className="px-6 py-4">
                    <span className="text-[#ff5351] font-black text-sm">{orc.numero}</span>
                  </td>
                  <td className="px-6 py-4 text-white font-bold text-sm">{orc.cliente}</td>
                  <td className="px-6 py-4 text-zinc-400 text-xs">{orc.tipo}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-emerald-400 font-black text-sm">
                      {(orc.totalCliente || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn('px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest', STATUS_CONFIG[orc.status]?.class || STATUS_CONFIG.rascunho.class)}>
                      {STATUS_CONFIG[orc.status]?.label || 'Rascunho'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-zinc-500 text-xs">
                    {orc.criadoEm?.toDate
                      ? new Intl.DateTimeFormat('pt-BR').format(orc.criadoEm.toDate())
                      : '—'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => navigate(`/orcamentos/${orc.id}`)}
                        className="p-1.5 text-zinc-500 hover:text-white transition-all">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => orc.id && handleExcluir(orc.id, orc.numero)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
