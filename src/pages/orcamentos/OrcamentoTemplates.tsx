import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Plus, Loader2, Edit2, Trash2, Save, X, ChevronDown, ChevronUp, Package, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '../../lib/utils';

interface ItemTemplate {
  equipamentoId: string;
  nome: string;
  quantidade: number;
  valorDia: number;
  valorTotalDia: number;
  exibirNoPdf: boolean;
}

interface Template {
  id?: string;
  nome: string;
  tipo: string;
  descricao: string;
  observacoes: string;
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

  // Seleção de item
  const [equipSelecionado, setEquipSelecionado] = useState('');
  const [qtdSelecionada, setQtdSelecionada] = useState(1);
  const [previewValor, setPreviewValor] = useState('');

  const [form, setForm] = useState<Partial<Template>>({
    nome: '',
    tipo: 'Proposta Audiovisual',
    descricao: '',
    observacoes: '',
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

  // Agrupa equipamentos por categoria para o select
  const equipamentosPorCategoria = equipamentos.reduce((acc, eq) => {
    if (!acc[eq.categoria]) acc[eq.categoria] = [];
    acc[eq.categoria].push(eq);
    return acc;
  }, {} as Record<string, Equipamento[]>);

  const handleEquipChange = (value: string) => {
    setEquipSelecionado(value);
    if (!value) { setPreviewValor(''); return; }
    const eq = equipamentos.find(e => e.id === value);
    if (eq) {
      const subtotal = eq.valorDia * qtdSelecionada;
      setPreviewValor(`R$ ${eq.valorDia.toLocaleString('pt-BR')}/dia × ${qtdSelecionada} un. = R$ ${subtotal.toLocaleString('pt-BR')},00/dia`);
    }
  };

  const handleQtdChange = (qtd: number) => {
    setQtdSelecionada(qtd);
    if (!equipSelecionado) return;
    const eq = equipamentos.find(e => e.id === equipSelecionado);
    if (eq) {
      const subtotal = eq.valorDia * qtd;
      setPreviewValor(`R$ ${eq.valorDia.toLocaleString('pt-BR')}/dia × ${qtd} un. = R$ ${subtotal.toLocaleString('pt-BR')},00/dia`);
    }
  };

  const adicionarItem = () => {
    if (!equipSelecionado) { toast.error('Selecione um equipamento'); return; }
    const eq = equipamentos.find(e => e.id === equipSelecionado);
    if (!eq) return;
    const jaExiste = (form.itens || []).find(i => i.equipamentoId === eq.id);
    if (jaExiste) { toast('Item já adicionado!'); return; }
    const novoItem: ItemTemplate = {
      equipamentoId: eq.id,
      nome: eq.nome,
      quantidade: qtdSelecionada,
      valorDia: eq.valorDia,
      valorTotalDia: eq.valorDia * qtdSelecionada,
      exibirNoPdf: true,
    };
    setForm(prev => ({ ...prev, itens: [...(prev.itens || []), novoItem] }));
    setEquipSelecionado('');
    setQtdSelecionada(1);
    setPreviewValor('');
  };

  const removerItem = (index: number) => {
    setForm(prev => ({ ...prev, itens: (prev.itens || []).filter((_, i) => i !== index) }));
  };

  const totalDiaTemplate = (form.itens || []).reduce((acc, item) => acc + item.valorTotalDia, 0);

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
      resetForm();
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  const resetForm = () => {
    setForm({ nome: '', tipo: 'Proposta Audiovisual', descricao: '', observacoes: '', itens: [], condicaoPagamento: '50% entrada + 50% na entrega' });
    setEquipSelecionado('');
    setQtdSelecionada(1);
    setPreviewValor('');
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

  return (
    <div className="space-y-8 pb-20 text-left">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.4em] text-[#ff5351] font-black mb-2">Orçamentos</p>
          <h1 className="text-5xl font-black text-white uppercase italic tracking-tight">Templates</h1>
          <p className="text-zinc-500 text-sm mt-1">Modelos de orçamento reutilizáveis</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditando(null); resetForm(); }}
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
                placeholder="Ex: Transmissão ao Vivo — 2 Câmeras"
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
          </div>

          {/* Adicionar item */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Adicionar item ao template</p>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_auto] gap-3 items-end">
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-1">Equipamento / Serviço</label>
                <select value={equipSelecionado} onChange={e => handleEquipChange(e.target.value)}
                  className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-xl px-3 text-white text-sm focus:border-[#ff5351] outline-none appearance-none">
                  <option value="">Selecionar...</option>
                  {Object.entries(equipamentosPorCategoria).map(([categoria, eqs]) => (
                    <optgroup key={categoria} label={categoria}>
                      {eqs.map(eq => (
                        <option key={eq.id} value={eq.id}>
                          {eq.nome} — R$ {eq.valorDia.toLocaleString('pt-BR')}/dia
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-1">Quantidade</label>
                <input type="number" value={qtdSelecionada} min={1}
                  onChange={e => handleQtdChange(Number(e.target.value))}
                  className="w-full h-10 bg-zinc-800 border border-zinc-700 rounded-xl px-3 text-white text-sm focus:border-[#ff5351] outline-none" />
              </div>
              <button onClick={adicionarItem}
                className="h-10 px-5 bg-[#ff5351] text-white rounded-xl font-black uppercase text-[9px] tracking-widest hover:brightness-110 transition-all flex items-center gap-2 shrink-0">
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </button>
            </div>

            {previewValor && (
              <p className="text-xs text-zinc-400">{previewValor}</p>
            )}
          </div>

          {/* Lista de itens */}
          {(form.itens || []).length === 0 ? (
            <div className="text-center py-8 text-zinc-600 border border-dashed border-zinc-800 rounded-2xl">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-black uppercase">Nenhum item adicionado</p>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Estrutura do template</p>
                <span className="text-[10px] font-black text-zinc-500">
                  Referência/dia: <span className="text-emerald-400">R$ {totalDiaTemplate.toLocaleString('pt-BR')},00</span>
                </span>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                    <th className="px-5 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-600">Item</th>
                    <th className="px-5 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-600 text-center">Qtd</th>
                    <th className="px-5 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-600 text-right">Valor/dia</th>
                    <th className="px-5 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-600 text-right">Total/dia</th>
                    <th className="px-5 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-600 text-center">PDF</th>
                    <th className="px-5 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {(form.itens || []).map((item, i) => (
                    <tr key={i} className="hover:bg-zinc-800/30 transition-all">
                      <td className="px-5 py-3 text-white text-sm font-bold">{item.nome}</td>
                      <td className="px-5 py-3 text-zinc-400 text-sm text-center">{item.quantidade}</td>
                      <td className="px-5 py-3 text-zinc-400 text-sm text-right">
                        R$ {item.valorDia.toLocaleString('pt-BR')},00
                      </td>
                      <td className="px-5 py-3 text-emerald-400 font-black text-sm text-right">
                        R$ {item.valorTotalDia.toLocaleString('pt-BR')},00
                      </td>
                      <td className="px-5 py-3 text-center">
                        <input type="checkbox" checked={item.exibirNoPdf}
                          onChange={e => {
                            const novos = [...(form.itens || [])];
                            novos[i] = { ...novos[i], exibirNoPdf: e.target.checked };
                            setForm(prev => ({ ...prev, itens: novos }));
                          }}
                          className="w-3.5 h-3.5 cursor-pointer" />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => removerItem(i)} className="text-zinc-600 hover:text-red-400 transition-all">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Aviso sobre diárias */}
          <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-blue-400 text-xs font-black uppercase tracking-widest">
              Diárias, deslocamento, alimentação e margem de lucro são definidos na hora de montar o orçamento.
            </p>
          </div>

          {/* Observações gerais */}
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Observações gerais (aparece no PDF)</label>
            <textarea value={form.observacoes || ''} onChange={e => setForm({ ...form, observacoes: e.target.value })}
              rows={2} placeholder="Ex: Material entregue via Google Drive ou HD fornecida pelo cliente no dia do evento."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:border-[#ff5351] outline-none resize-none" />
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
                      R$ {(t.itens || []).reduce((acc, item) => acc + item.valorTotalDia, 0).toLocaleString('pt-BR')},00/dia
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
                  <button onClick={() => handleEditar(t)} className="p-1.5 text-zinc-500 hover:text-white transition-all">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => t.id && handleExcluir(t.id)} className="p-1.5 text-zinc-500 hover:text-red-400 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {expandido === t.id && t.itens && t.itens.length > 0 && (
                <div className="border-t border-zinc-800">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/50">
                        <th className="px-5 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-600">Item</th>
                        <th className="px-5 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-600 text-center">Qtd</th>
                        <th className="px-5 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-600 text-right">Valor/dia</th>
                        <th className="px-5 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-600 text-right">Total/dia</th>
                        <th className="px-5 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-600 text-center">PDF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {t.itens.map((item, i) => (
                        <tr key={i}>
                          <td className="px-5 py-2.5 text-white text-sm font-bold">{item.nome}</td>
                          <td className="px-5 py-2.5 text-zinc-400 text-sm text-center">{item.quantidade}</td>
                          <td className="px-5 py-2.5 text-zinc-400 text-sm text-right">R$ {item.valorDia.toLocaleString('pt-BR')},00</td>
                          <td className="px-5 py-2.5 text-emerald-400 font-black text-sm text-right">R$ {item.valorTotalDia.toLocaleString('pt-BR')},00</td>
                          <td className="px-5 py-2.5 text-center">
                            <span className={cn('text-[10px] font-black uppercase', item.exibirNoPdf ? 'text-emerald-400' : 'text-zinc-600')}>
                              {item.exibirNoPdf ? '✓ sim' : '— não'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {t.observacoes && (
                    <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-900/30">
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1">Observações</p>
                      <p className="text-zinc-400 text-xs">{t.observacoes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
