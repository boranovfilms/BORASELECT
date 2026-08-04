import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Plus, Loader2, Edit2, Trash2, Save, X, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '../../lib/utils';

interface Equipamento {
  id?: string;
  nome: string;
  categoria: string;
  valorDia: number;
  valorCompra?: number;
  ativo: boolean;
}

const CATEGORIAS = [
  'Câmeras', 'Lentes', 'Tripés e Estabilizadores',
  'Transmissão', 'Cabos e Conectores', 'Armazenamento',
  'Iluminação', 'Áudio', 'Equipe/Freelance', 'Outros'
];

const EQUIPAMENTOS_INICIAIS = [
  { nome: 'Câmera Sony Alpha A6500', categoria: 'Câmeras', valorDia: 290, ativo: true },
  { nome: 'Câmera Sony Alpha A7S2 Mirrorless', categoria: 'Câmeras', valorDia: 299, ativo: true },
  { nome: 'Câmera Sony Alpha A7M3 Full Frame', categoria: 'Câmeras', valorDia: 350, ativo: true },
  { nome: 'Câmera Alpha Sony A7 IV Mirrorless', categoria: 'Câmeras', valorDia: 350, ativo: true },
  { nome: 'Câmera Sony FX30', categoria: 'Câmeras', valorDia: 500, ativo: true },
  { nome: 'Câmera Sony A7S III Mirrorless', categoria: 'Câmeras', valorDia: 690, ativo: true },
  { nome: 'Câmera com Operador', categoria: 'Câmeras', valorDia: 800, ativo: true },
  { nome: 'Lente Sony FE 70-200mm F2.8 GM OSS II', categoria: 'Lentes', valorDia: 199, ativo: true },
  { nome: 'Lente Sony 24-70 GM FE 24-70mm F/2.8', categoria: 'Lentes', valorDia: 199, ativo: true },
  { nome: 'Lente Sony 18-105', categoria: 'Lentes', valorDia: 100, ativo: true },
  { nome: 'Lente Sony 28-70', categoria: 'Lentes', valorDia: 80, ativo: true },
  { nome: 'Lente Sigma 16MM 1.4 Sony', categoria: 'Lentes', valorDia: 150, ativo: true },
  { nome: 'Estabilizador Crane 2', categoria: 'Tripés e Estabilizadores', valorDia: 220, ativo: true },
  { nome: 'Tripé Manfrotto MVH502A', categoria: 'Tripés e Estabilizadores', valorDia: 150, valorCompra: 2499, ativo: true },
  { nome: 'Tripé Manfrotto MVK500190XV', categoria: 'Tripés e Estabilizadores', valorDia: 90, valorCompra: 2499, ativo: true },
  { nome: 'Travelling 5mts', categoria: 'Tripés e Estabilizadores', valorDia: 220, ativo: true },
  { nome: 'Grua 8 Metros', categoria: 'Tripés e Estabilizadores', valorDia: 2000, ativo: true },
  { nome: 'Mini Grua Pequena', categoria: 'Tripés e Estabilizadores', valorDia: 800, ativo: true },
  { nome: 'Sistema de Transmissão ATEM 1H', categoria: 'Transmissão', valorDia: 1500, ativo: true },
  { nome: 'Sistema de Transmissão ATEM Diária', categoria: 'Transmissão', valorDia: 2000, ativo: true },
  { nome: 'Transmissor Sem Fio 1H', categoria: 'Transmissão', valorDia: 350, ativo: true },
  { nome: 'Transmissor Sem Fio Diária', categoria: 'Transmissão', valorDia: 500, ativo: true },
  { nome: 'Intercom Hollyland C1 6 Fones', categoria: 'Transmissão', valorDia: 390, valorCompra: 14530, ativo: true },
  { nome: 'Intercom Hollyland Solidcom C1 Pro 4S', categoria: 'Transmissão', valorDia: 299, ativo: true },
  { nome: 'Cabo HDMI Fibra 50 Metros', categoria: 'Cabos e Conectores', valorDia: 100, ativo: true },
  { nome: 'Cabo HDMI Fibra 100 Metros', categoria: 'Cabos e Conectores', valorDia: 150, ativo: true },
  { nome: 'Cabo HDMI 20 Metros', categoria: 'Cabos e Conectores', valorDia: 80, ativo: true },
  { nome: 'Cabo HDMI 10 Metros', categoria: 'Cabos e Conectores', valorDia: 50, ativo: true },
  { nome: 'Split HDMI', categoria: 'Cabos e Conectores', valorDia: 30, ativo: true },
  { nome: 'Extensão de Energia', categoria: 'Cabos e Conectores', valorDia: 30, ativo: true },
  { nome: 'HD SSD 1T T7', categoria: 'Armazenamento', valorDia: 100, ativo: true },
  { nome: 'HD SSD 1T T9', categoria: 'Armazenamento', valorDia: 150, ativo: true },
  { nome: 'Kit Iluminação', categoria: 'Iluminação', valorDia: 300, ativo: true },
  { nome: 'Painel + Som + Iluminação', categoria: 'Iluminação', valorDia: 30000, ativo: true },
  { nome: 'Microfone com Fio', categoria: 'Áudio', valorDia: 100, ativo: true },
  { nome: 'Mesa de Som', categoria: 'Áudio', valorDia: 250, ativo: true },
  { nome: 'TV para Retorno', categoria: 'Áudio', valorDia: 150, ativo: true },
  { nome: 'Freelance Vídeo Meia Diária', categoria: 'Equipe/Freelance', valorDia: 500, ativo: true },
  { nome: 'Freelance Vídeo Diária Inteira', categoria: 'Equipe/Freelance', valorDia: 800, ativo: true },
  { nome: 'Freelance Foto Meia Diária', categoria: 'Equipe/Freelance', valorDia: 300, ativo: true },
  { nome: 'Freelance Foto Diária Inteira', categoria: 'Equipe/Freelance', valorDia: 600, ativo: true },
  { nome: 'Editor Express', categoria: 'Equipe/Freelance', valorDia: 1300, ativo: true },
  { nome: 'Editor Palestra', categoria: 'Equipe/Freelance', valorDia: 600, ativo: true },
  { nome: 'Hora Trabalho Ronaldo', categoria: 'Equipe/Freelance', valorDia: 150, ativo: true },
  { nome: 'Hora Trabalho Ronaldo Diária', categoria: 'Equipe/Freelance', valorDia: 1500, ativo: true },
  { nome: 'Hora Trabalho Maycon', categoria: 'Equipe/Freelance', valorDia: 250, ativo: true },
  { nome: 'Diária Extra da Equipe', categoria: 'Equipe/Freelance', valorDia: 260, ativo: true },
  { nome: 'Horas de Edição', categoria: 'Equipe/Freelance', valorDia: 60, ativo: true },
];

export default function OrcamentoEquipamentos() {
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Equipamento | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [busca, setBusca] = useState('');
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('Todas');
  const [form, setForm] = useState<Partial<Equipamento>>({
    nome: '', categoria: 'Câmeras', valorDia: 0, ativo: true
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'orcamentoEquipamentos'), snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Equipamento[];
      data.sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome));
      setEquipamentos(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const importarDaPlanilha = async () => {
    if (equipamentos.length > 0) {
      toast('Já existem equipamentos cadastrados!');
      return;
    }
    setImportando(true);
    try {
      for (const eq of EQUIPAMENTOS_INICIAIS) {
        await addDoc(collection(db, 'orcamentoEquipamentos'), {
          ...eq,
          criadoEm: serverTimestamp()
        });
      }
      toast.success(`${EQUIPAMENTOS_INICIAIS.length} equipamentos importados!`);
    } catch {
      toast.error('Erro ao importar equipamentos');
    } finally {
      setImportando(false);
    }
  };

  const handleSalvar = async () => {
    if (!form.nome?.trim()) { toast.error('Nome é obrigatório'); return; }
    if (!form.valorDia || form.valorDia <= 0) { toast.error('Valor/dia é obrigatório'); return; }
    setSalvando(true);
    try {
      if (editando?.id) {
        await updateDoc(doc(db, 'orcamentoEquipamentos', editando.id), { ...form, updatedAt: serverTimestamp() });
        toast.success('Equipamento atualizado!');
      } else {
        await addDoc(collection(db, 'orcamentoEquipamentos'), { ...form, criadoEm: serverTimestamp() });
        toast.success('Equipamento cadastrado!');
      }
      setShowForm(false);
      setEditando(null);
      setForm({ nome: '', categoria: 'Câmeras', valorDia: 0, ativo: true });
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  const handleEditar = (eq: Equipamento) => {
    setEditando(eq);
    setForm({ ...eq });
    setShowForm(true);
  };

  const handleExcluir = async (id: string) => {
    if (!confirm('Excluir este equipamento?')) return;
    try {
      await deleteDoc(doc(db, 'orcamentoEquipamentos', id));
      toast.success('Equipamento excluído!');
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  const equipamentosFiltrados = equipamentos.filter(eq => {
    const matchBusca = eq.nome.toLowerCase().includes(busca.toLowerCase());
    const matchCategoria = categoriaSelecionada === 'Todas' || eq.categoria === categoriaSelecionada;
    return matchBusca && matchCategoria;
  });

  const categorias = ['Todas', ...CATEGORIAS];

  return (
    <div className="space-y-8 pb-20 text-left">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.4em] text-[#ff5351] font-black mb-2">Orçamentos</p>
          <h1 className="text-5xl font-black text-white uppercase italic tracking-tight">Equipamentos</h1>
          <p className="text-zinc-500 text-sm mt-1">Tabela de custos internos</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {equipamentos.length === 0 && (
            <button onClick={importarDaPlanilha} disabled={importando}
              className="h-10 px-4 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-xl font-black uppercase text-[9px] tracking-widest hover:text-white transition-all flex items-center gap-2 disabled:opacity-50">
              {importando ? <Loader2 className="w-3 h-3 animate-spin" /> : '📥'} Importar Planilha
            </button>
          )}
          <button onClick={() => { setShowForm(true); setEditando(null); setForm({ nome: '', categoria: 'Câmeras', valorDia: 0, ativo: true }); }}
            className="h-10 px-5 bg-[#ff5351] text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:brightness-110 transition-all flex items-center gap-2">
            <Plus className="w-4 h-4" /> Novo Item
          </button>
        </div>
      </header>

      {/* Form */}
      {showForm && (
        <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-widest text-white">
              {editando ? 'Editar Item' : 'Novo Item'}
            </h2>
            <button onClick={() => { setShowForm(false); setEditando(null); }} className="text-zinc-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Nome *</label>
              <input type="text" value={form.nome || ''} onChange={e => setForm({ ...form, nome: e.target.value })}
                placeholder="Nome do equipamento ou serviço..."
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Categoria *</label>
              <select value={form.categoria || ''} onChange={e => setForm({ ...form, categoria: e.target.value })}
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none appearance-none">
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Valor / Dia (R$) *</label>
              <input type="number" value={form.valorDia || ''} onChange={e => setForm({ ...form, valorDia: Number(e.target.value) })}
                placeholder="0,00"
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Valor de Compra (R$)</label>
              <input type="number" value={form.valorCompra || ''} onChange={e => setForm({ ...form, valorCompra: Number(e.target.value) })}
                placeholder="Opcional"
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => { setShowForm(false); setEditando(null); }}
              className="h-10 px-6 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-xl font-black uppercase text-[9px] tracking-widest hover:text-white transition-all">
              Cancelar
            </button>
            <button onClick={handleSalvar} disabled={salvando}
              className="h-10 px-6 bg-[#ff5351] text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50">
              {salvando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Salvar
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar equipamento..."
            className="w-full h-10 bg-[#1f1f1f] border border-zinc-800 rounded-xl pl-9 pr-4 text-white text-sm focus:border-[#ff5351] outline-none" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categorias.map(cat => (
            <button key={cat} onClick={() => setCategoriaSelecionada(cat)}
              className={cn('px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all',
                categoriaSelecionada === cat ? 'bg-[#ff5351] text-white border-[#ff5351]' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-white')}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
        </div>
      ) : equipamentosFiltrados.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <p className="font-black uppercase text-sm">
            {equipamentos.length === 0 ? 'Nenhum equipamento cadastrado' : 'Nenhum resultado encontrado'}
          </p>
          {equipamentos.length === 0 && (
            <p className="text-xs mt-2">Clique em "Importar Planilha" para importar os itens da sua planilha</p>
          )}
        </div>
      ) : (
        <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-widest text-white">
              {equipamentosFiltrados.length} itens
            </h2>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Nome</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Categoria</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Valor/Dia</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Valor Compra</th>
                <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {equipamentosFiltrados.map(eq => (
                <tr key={eq.id} className="hover:bg-zinc-800/30 transition-all">
                  <td className="px-6 py-3 text-white text-sm font-bold">{eq.nome}</td>
                  <td className="px-6 py-3">
                    <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 text-[9px] font-black uppercase tracking-widest">
                      {eq.categoria}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <span className="text-emerald-400 font-black text-sm">
                      {eq.valorDia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right text-zinc-500 text-sm">
                    {eq.valorCompra ? eq.valorCompra.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleEditar(eq)}
                        className="p-1.5 text-zinc-500 hover:text-white transition-all">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => eq.id && handleExcluir(eq.id)}
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
