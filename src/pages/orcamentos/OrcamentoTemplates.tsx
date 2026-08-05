import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Plus, Loader2, Edit2, Trash2, Save, X, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '../../lib/utils';

interface ItemTemplate {
  equipamentoId: string;
  nome: string;
  quantidade: number;
  diarias: number;
  valorUnitario: number;
  valorTotal: number;
  exibirNoPdf: boolean;
  descricaoPersonalizada?: string;
}

interface Template {
  id?: string;
  nome: string;
  tipo: string;
  descricao: string;
  itens: ItemTemplate[];
  condicaoPagamento: string;
  criadoEm?: any;
}

interface Equipamento {
  id: string;
  nome: string;
  categoria: string;
  valorDia: number;
}

const TIPOS = [
  'Proposta Audiovisual',
  'Gravação em Estúdio',
  'Transmissão ao Vivo',
  'Orçamento para Redes',
  'Vídeo Institucional',
  'Ensaio Fotográfico',
  'Podcast',
  'Cobertura de Evento',
  'Outro',
];

const CONDICOES_PAGAMENTO = [
  '50% entrada + 50% na entrega',
  '100% antecipado',
  '30% entrada + 70% na entrega',
  'Dia 10 de cada mês',
  'À combinar',
];

export default function OrcamentoTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Template | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [buscaEquip, setBuscaEquip] = useState('');
  const [showEquipamentos, setShowEquipamentos] = useState(false);

  const [form, setForm] = useState<Partial<Template>>({
    nome: '',
    tipo: 'Proposta Audiovisual',
    descricao: '',
    itens: [],
    condicaoPagamento: '50% entrada + 50% na entrega',
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'orcamentoTemplates'), snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Template[];
      data.sort((a, b) => a.nome.localeCompare(b.nome));
      setTemplates(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    getDocs(collection(db, 'orcamentoEquipamentos')).then(snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Equipamento[];
      data.sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome));
      setEquipamentos(data);
    });
  }, []);

  const adicionarItem = (eq: Equipamento) => {
    const jaExiste = (form.itens || []).find(i => i.equipamentoId === eq.id);
    if (jaExiste) { toast('Item já adicionado!'); return; }
    const novoItem: ItemTemplate = {
      equipamentoId: eq.id,
      nome: eq.nome,
      quantidade: 1,
      diarias: 1,
      valorUnitario: eq.valorDia,
      valorTotal: eq.valorDia,
      exibirNoPdf: true,
      descricaoPersonalizada: '',
    };
    setForm(prev => ({ ...prev, itens: [...(prev.itens || []), novoItem] }));
    setShowEquipamentos(false);
    setBuscaEquip('');
  };

  const atualizarItem = (index: number, campo: string, valor: any) => {
    const novosItens = [...(form.itens || [])];
    novosItens[index] = { ...novosItens[index], [campo]: valor };
    // Recalcula valor total
    if (campo === 'quantidade' || campo === 'diarias' || campo === 'valorUnitario') {
      const item = novosItens[index];
      novosItens[index].valorTotal = item.quantidade * item.diarias * item.valorUnitario;
    }
    setForm(prev => ({ ...prev, itens: novosItens }));
  };

  const removerItem = (index: number) => {
    const novosItens = (form.itens || []).filter((_, i) => i !== index);
    setForm(prev => ({ ...prev, itens: novosItens }));
  };

  const totalTemplate = (form.itens || []).reduce((acc, item) => acc + item.valorTotal, 0);

  const handleSalvar = async () => {
    if (!form.nome?.trim()) { toast.error('Nome é obrigatório'); return; }
    if (!form.tipo) { toast.error('Tipo é obrigatório'); return; }
    setSalvando(true);
    try {
      if (editando?.id) {
        await updateDoc(doc(db, 'orcamentoTemplates', editando.id), { ...form, updatedAt: serverTimestamp() });
        toast.success('Template atualizado!');
      } else {
        await addDoc(collection(db, 'orcamentoTemplates'), { ...form, criadoEm: serverTimestamp() });
        toast.success('Template criado!');
      }
      setShowForm(false);
      setEditando(null);
      setForm({ nome: '', tipo: 'Proposta Audiovisual', descricao: '', itens: [], condicaoPagamento: '50% entrada + 50% na entrega' });
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  const handleEditar = (t: Template) => {
    setEditando(t);
    setForm({ ...t });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExcluir = async (id: string) => {
    if (!confirm('Excluir este template?')) return;
    try {
      await deleteDoc(doc(db, 'orcamentoTemplates', id));
      toast.success('Template excluído!');
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  const equipamentosFiltrados = equipamentos.filter(eq =>
    eq.nome.toLowerCase().includes(buscaEquip.toLowerCase()) ||
    eq.categoria.toLowerCase().includes(buscaEquip.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-20 text-left">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.4em] text-[#ff5351] font-black mb-2">Orçamentos</p>
          <h1 className="text-5xl font-black text-white uppercase italic tracking-tight">Templates</h1>
          <p className="text-zinc-500 text-sm mt-1">Modelos de orçamento reutilizáveis</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditando(null); setForm({ nome: '', tipo: 'Proposta Audiovisual', descricao: '', itens: [], condicaoPagamento: '50% entrada + 50% na entrega' }); }}
          className="h-10 px-5 bg-[#ff5351] text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:brightness-110 transition-all flex items-center gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Novo Template
        </button>
      </header>

      {/* Formulário */}
      {showForm && (
        <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-widest text-white">
              {editando ? 'Editar Template' : 'Novo Template'}
            </h2>
            <button onClick={() => { setShowForm(false); setEditando(null); }} className="text-zinc-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Dados gerais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Nome do Template *</label>
              <input type="text" value={form.nome || ''} onChange={e => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Transmissão ao Vivo - Padrão"
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none" />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Tipo *</label>
              <select value={form.tipo || ''} onChange={e => setForm({ ...form, tipo: e.target.value })}
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none appearance-none">
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Condição de Pagamento</label>
              <select value={form.condicaoPagamento || ''} onChange={e => setForm({ ...form, condicaoPagamento: e.target.value })}
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none appearance-none">
                {CONDICOES_PAGAMENTO.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Descrição</label>
              <textarea value={form.descricao || ''} onChange={e => setForm({ ...form, descricao: e.target.value })}
                rows={2} placeholder="Descrição do template..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:border-[#ff5351] outline-none resize-none" />
            </div>
          </div>

          {/* Itens */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Itens do Template</label>
              <button onClick={() => setShowEquipamentos(!showEquipamentos)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-lg text-[9px] font-black uppercase tracking-widest hover:text-white transition-all">
                <Plus className="w-3 h-3" /> Adicionar Item
              </button>
            </div>

            {/* Busca de equipamentos */}
            {showEquipamentos && (
              <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4 mb-4 space-y-3">
                <input type="text" value={buscaEquip} onChange={e => setBuscaEquip(e.target.value)}
                  placeholder="Buscar equipamento ou serviço..."
                  className="w-full h-9 bg-zinc-800 border border-zinc-700 rounded-xl px-3 text-white text-xs focus:border-[#ff5351] outline-none" />
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {equipamentosFiltrados.map(eq => (
                    <button key={eq.id} onClick={() => adicionarItem(eq)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all text-left">
                      <div>
                        <p className="text-white text-xs font-bold">{eq.nome}</p>
                        <p className="text-zinc-500 text-[10px]">{eq.categoria}</p>
                      </div>
                      <span className="text-emerald-400 text-xs font-black shrink-0 ml-2">
                        {eq.valorDia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/dia
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Lista de itens adicionados */}
            {(form.itens || []).length === 0 ? (
              <div className="text-center py-8 text-zinc-600 border border-dashed border-zinc-800 rounded-2xl">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs font-black uppercase">Nenhum item adicionado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(form.itens || []).map((item, i) => (
                  <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-white text-sm font-black uppercase">{item.nome}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={item.exibirNoPdf}
                              onChange={e => atualizarItem(i, 'exibirNoPdf', e.target.checked)}
                              className="w-3 h-3" />
                            <span className="text-zinc-500 text-[9px] font-black uppercase">Exibir no PDF</span>
                          </label>
                        </div>
                      </div>
                      <button onClick={() => removerItem(i)} className="text-zinc-600 hover:text-red-400 transition-all shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-1">Qtd</label>
                        <input type="number" value={item.quantidade} min={1}
                          onChange={e => atualizarItem(i, 'quantidade', Number(e.target.value))}
                          className="w-full h-8 bg-zinc-800 border border-zinc-700 rounded-lg px-2 text-white text-xs focus:border-[#ff5351] outline-none" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-1">Diárias</label>
                        <input type="number" value={item.diarias} min={1}
                          onChange={e => atualizarItem(i, 'diarias', Number(e.target.value))}
                          className="w-full h-8 bg-zinc-800 border border-zinc-700 rounded-lg px-2 text-white text-xs focus:border-[#ff5351] outline-none" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-1">Valor/Dia</label>
                        <input type="number" value={item.valorUnitario}
                          onChange={e => atualizarItem(i, 'valorUnitario', Number(e.target.value))}
                          className="w-full h-8 bg-zinc-800 border border-zinc-700 rounded-lg px-2 text-white text-xs focus:border-[#ff5351] outline-none" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-1">Total</label>
                        <div className="h-8 bg-zinc-800 border border-zinc-700 rounded-lg px-2 flex items-center">
                          <span className="text-emerald-400 text-xs font-black">
                            {item.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-1">Descrição no PDF (opcional)</label>
                      <input type="text" value={item.descricaoPersonalizada || ''}
                        onChange={e => atualizarItem(i, 'descricaoPersonalizada', e.target.value)}
                        placeholder="Descrição que aparecerá no PDF..."
                        className="w-full h-8 bg-zinc-800 border border-zinc-700 rounded-lg px-2 text-white text-xs focus:border-[#ff5351] outline-none" />
                    </div>
                  </div>
                ))}

                {/* Total */}
                <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-2xl">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total do Template</span>
                  <span className="text-emerald-400 font-black text-lg">
                    {totalTemplate.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => { setShowForm(false); setEditando(null); }}
              className="h-10 px-6 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-xl font-black uppercase text-[9px] tracking-widest hover:text-white transition-all">
              Cancelar
            </button>
            <button onClick={handleSalvar} disabled={salvando}
              className="h-10 px-6 bg-[#ff5351] text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50">
              {salvando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Salvar Template
            </button>
          </div>
        </div>
      )}

      {/* Lista de templates */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-black uppercase text-sm">Nenhum template criado ainda</p>
          <p className="text-xs mt-2">Crie templates para agilizar a criação de orçamentos</p>
        </div>
      ) : (
        <div className="space-y-4">
          {templates.map(t => (
            <div key={t.id} className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden">
              <div className="p-5 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-white font-black uppercase text-sm">{t.nome}</h3>
                    <span className="px-2 py-0.5 rounded bg-[#ff5351]/10 border border-[#ff5351]/20 text-[#ff5351] text-[9px] font-black uppercase tracking-widest shrink-0">
                      {t.tipo}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-zinc-500 text-xs">{t.itens?.length || 0} itens</span>
                    <span className="text-zinc-700">•</span>
                    <span className="text-emerald-400 text-xs font-black">
                      {(t.itens || []).reduce((acc, item) => acc + item.valorTotal, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                    <span className="text-zinc-700">•</span>
                    <span className="text-zinc-500 text-xs">{t.condicaoPagamento}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setExpandido(expandido === t.id ? null : t.id!)}
                    className="p-1.5 text-zinc-500 hover:text-white transition-all">
                    {expandido === t.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button onClick={() => handleEditar(t)}
                    className="p-1.5 text-zinc-500 hover:text-white transition-all">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => t.id && handleExcluir(t.id)}
                    className="p-1.5 text-zinc-500 hover:text-red-400 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Itens expandidos */}
              {expandido === t.id && t.itens && t.itens.length > 0 && (
                <div className="border-t border-zinc-800 px-5 py-4">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800">
                        <th className="pb-2 text-[9px] font-black uppercase tracking-widest text-zinc-600">Item</th>
                        <th className="pb-2 text-[9px] font-black uppercase tracking-widest text-zinc-600 text-center">Qtd</th>
                        <th className="pb-2 text-[9px] font-black uppercase tracking-widest text-zinc-600 text-center">Diárias</th>
                        <th className="pb-2 text-[9px] font-black uppercase tracking-widest text-zinc-600 text-right">Valor/Dia</th>
                        <th className="pb-2 text-[9px] font-black uppercase tracking-widest text-zinc-600 text-right">Total</th>
                        <th className="pb-2 text-[9px] font-black uppercase tracking-widest text-zinc-600 text-center">PDF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {t.itens.map((item, i) => (
                        <tr key={i}>
                          <td className="py-2 text-white text-xs font-bold">{item.nome}</td>
                          <td className="py-2 text-zinc-400 text-xs text-center">{item.quantidade}</td>
                          <td className="py-2 text-zinc-400 text-xs text-center">{item.diarias}</td>
                          <td className="py-2 text-zinc-400 text-xs text-right">
                            {item.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                          <td className="py-2 text-emerald-400 text-xs font-black text-right">
                            {item.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                          <td className="py-2 text-center">
                            <span className={cn('text-[9px] font-black uppercase', item.exibirNoPdf ? 'text-emerald-400' : 'text-zinc-600')}>
                              {item.exibirNoPdf ? '✓' : '—'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
