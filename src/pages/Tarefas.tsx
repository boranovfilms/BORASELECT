import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Plus, Trash2, Check, Clock, Flag, Filter, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';

interface Tarefa {
  id?: string;
  nome: string;
  descricao?: string;
  prioridade: 'alta' | 'media' | 'baixa';
  status: 'pendente' | 'concluida';
  dataLimite?: string;
  criadoPor: string;
  criadoEm?: any;
}

export default function Tarefas() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filtro, setFiltro] = useState<'todas' | 'pendente' | 'concluida'>('todas');
  const [filtroPrioridade, setFiltroPrioridade] = useState<'todas' | 'alta' | 'media' | 'baixa'>('todas');

  const [form, setForm] = useState<Partial<Tarefa>>({
    nome: '',
    descricao: '',
    prioridade: 'media',
    status: 'pendente',
    dataLimite: '',
  });

  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    const email = user.email?.toLowerCase().trim() || '';

    const q = query(
      collection(db, 'tarefas'),
      where('criadoPor', '==', email)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Tarefa[];
      data.sort((a, b) => {
        const prioOrder = { alta: 0, media: 1, baixa: 2 };
        return prioOrder[a.prioridade] - prioOrder[b.prioridade];
      });
      setTarefas(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSubmit = async () => {
    if (!form.nome?.trim()) { toast.error('Nome da tarefa é obrigatório'); return; }
    if (!user) return;

    try {
      await addDoc(collection(db, 'tarefas'), {
        ...form,
        criadoPor: user.email?.toLowerCase().trim(),
        criadoEm: serverTimestamp(),
        status: 'pendente',
      });
      toast.success('Tarefa criada!');
      setForm({ nome: '', descricao: '', prioridade: 'media', status: 'pendente', dataLimite: '' });
      setShowForm(false);
    } catch (error) {
      toast.error('Erro ao criar tarefa');
    }
  };

  const toggleStatus = async (tarefa: Tarefa) => {
    if (!tarefa.id) return;
    try {
      await updateDoc(doc(db, 'tarefas', tarefa.id), {
        status: tarefa.status === 'pendente' ? 'concluida' : 'pendente'
      });
    } catch (error) {
      toast.error('Erro ao atualizar tarefa');
    }
  };

  const deleteTarefa = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'tarefas', id));
      toast.success('Tarefa removida');
    } catch (error) {
      toast.error('Erro ao remover tarefa');
    }
  };

  const getPriorityBadge = (p: string) => {
    const colors: any = {
      alta: 'bg-red-500/10 text-red-400 border-red-500/20',
      media: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      baixa: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    };
    return <span className={cn('px-2 py-1 border rounded-md text-[9px] font-black uppercase tracking-widest', colors[p])}>{p}</span>;
  };

  const tarefasFiltradas = tarefas.filter(t => {
    if (filtro !== 'todas' && t.status !== filtro) return false;
    if (filtroPrioridade !== 'todas' && t.prioridade !== filtroPrioridade) return false;
    return true;
  });

  const pendentes = tarefas.filter(t => t.status === 'pendente').length;
  const concluidas = tarefas.filter(t => t.status === 'concluida').length;

  return (
    <div className="space-y-8 pb-20 text-left">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#ff5351] mb-2">Organização Pessoal</p>
          <h1 className="text-5xl font-black text-white uppercase italic tracking-tight">Tarefas Diárias</h1>
          <div className="flex items-center gap-4 mt-3">
            <span className="text-zinc-500 text-xs font-bold">{pendentes} pendentes</span>
            <span className="text-zinc-700">•</span>
            <span className="text-zinc-500 text-xs font-bold">{concluidas} concluídas</span>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 h-10 px-5 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all shadow-lg shadow-[#ff5351]/20 shrink-0"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancelar' : 'Nova Tarefa'}
        </button>
      </header>

      {showForm && (
        <div className="bg-[#1f1f1f] border border-zinc-800 rounded-3xl p-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <h2 className="text-sm font-black uppercase tracking-widest text-white">Nova Tarefa</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Nome *</label>
              <input
                type="text"
                value={form.nome || ''}
                onChange={e => setForm({ ...form, nome: e.target.value })}
                placeholder="Nome da tarefa..."
                className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-2xl px-4 text-white text-sm focus:border-[#ff5351] outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Descrição</label>
              <textarea
                value={form.descricao || ''}
                onChange={e => setForm({ ...form, descricao: e.target.value })}
                placeholder="Detalhes da tarefa..."
                rows={2}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-white text-sm focus:border-[#ff5351] outline-none resize-none"
              />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Prioridade</label>
              <select
                value={form.prioridade}
                onChange={e => setForm({ ...form, prioridade: e.target.value as any })}
                className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-2xl px-4 text-white text-sm focus:border-[#ff5351] outline-none appearance-none"
              >
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-1">Data Limite</label>
              <input
                type="date"
                value={form.dataLimite || ''}
                onChange={e => setForm({ ...form, dataLimite: e.target.value })}
                className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-2xl px-4 text-white text-sm focus:border-[#ff5351] outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              className="h-10 px-8 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all"
            >
              Criar Tarefa
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
          {(['todas', 'pendente', 'concluida'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
                filtro === f ? 'bg-[#ff5351] text-white' : 'text-zinc-500 hover:text-white'
              )}
            >
              {f === 'todas' ? 'Todas' : f === 'pendente' ? 'Pendentes' : 'Concluídas'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
          {(['todas', 'alta', 'media', 'baixa'] as const).map(p => (
            <button
              key={p}
              onClick={() => setFiltroPrioridade(p)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
                filtroPrioridade === p ? 'bg-[#ff5351] text-white' : 'text-zinc-500 hover:text-white'
              )}
            >
              {p === 'todas' ? 'Todas' : p}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de tarefas */}
      <div className="bg-[#1f1f1f] border border-zinc-800 rounded-3xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-zinc-500 italic">Carregando...</div>
        ) : tarefasFiltradas.length === 0 ? (
          <div className="py-16 text-center">
            <Flag className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500 font-bold uppercase text-sm">Nenhuma tarefa encontrada</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {tarefasFiltradas.map(tarefa => (
              <div
                key={tarefa.id}
                className={cn(
                  'flex items-start gap-4 p-5 hover:bg-zinc-800/20 transition-all group',
                  tarefa.status === 'concluida' && 'opacity-60'
                )}
              >
                <button
                  onClick={() => toggleStatus(tarefa)}
                  className={cn(
                    'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0 mt-0.5',
                    tarefa.status === 'concluida'
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'border-zinc-600 hover:border-[#ff5351]'
                  )}
                >
                  {tarefa.status === 'concluida' && <Check className="w-3 h-3 text-white" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={cn(
                      'text-sm font-bold uppercase',
                      tarefa.status === 'concluida' ? 'line-through text-zinc-500' : 'text-white'
                    )}>
                      {tarefa.nome}
                    </p>
                    {getPriorityBadge(tarefa.prioridade)}
                  </div>
                  {tarefa.descricao && (
                    <p className="text-zinc-500 text-xs mt-1">{tarefa.descricao}</p>
                  )}
                  {tarefa.dataLimite && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <Clock className="w-3 h-3 text-zinc-600" />
                      <span className="text-zinc-600 text-[10px] font-bold">
                        {new Date(tarefa.dataLimite + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => tarefa.id && deleteTarefa(tarefa.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-zinc-600 hover:text-red-400 transition-all shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
