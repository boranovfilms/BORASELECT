import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckSquare, Plus, Clock, User, Shield, X, Save, Loader2, Check, Edit, Trash2, MessageSquare, ChevronDown, UserPlus
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '../lib/utils';
import { taskService, Task, TaskHistory } from '../services/taskService';
import { teamService, TeamMember } from '../services/teamService';
import { clientService, Client } from '../services/clientService';
import { auth, db } from '../lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { DataTable } from '../components/ui/DataTable';

export default function Tarefas() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allUsers, setAllUsers] = useState<{email: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pendentes' | 'executadas'>('pendentes');
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');

  const audioContext = useRef<AudioContext | null>(null);

  const [newTask, setNewTask] = useState<Partial<Task>>({
    nome: '',
    prioridade: 'media',
    dataLimite: '',
    tipoAcesso: 'particular',
    descricao: '',
    equipeSelecionada: 'Todos',
    delegadoPara: ''
  });

  const playNotificationSound = () => {
    try {
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContext.current;
      if (ctx.state === 'suspended') ctx.resume();
      
      [523, 659, 784].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
        g.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.15);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.3);
        o.start(ctx.currentTime + i * 0.15);
        o.stop(ctx.currentTime + i * 0.15 + 0.3);
      });
    } catch (e) {
      console.warn('Som de notificação bloqueado');
    }
  };

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const [teamData, clientsData] = await Promise.all([
          teamService.getTeamMembers().catch(() => []),
          clientService.searchClients('').catch(() => [])
        ]);
        const uniqueUsersMap = new Map<string, string>();
        teamData.forEach(m => uniqueUsersMap.set(m.email.toLowerCase().trim(), m.name));
        clientsData.forEach(c => uniqueUsersMap.set(c.email.toLowerCase().trim(), c.name));
        setAllUsers(Array.from(uniqueUsersMap.entries()).map(([email, name]) => ({ email, name })));
      } catch (error) {
        console.error('Erro ao carregar usuários:', error);
      }
    };
    loadUsers();

    const q = query(collection(db, 'tasks'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userEmail = (auth.currentUser?.email || '').toLowerCase().trim();
      const allTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));

      const filtered = allTasks.filter(task => {
        const creatorEmail = (task.responsavelCriacaoEmail || '').toLowerCase().trim();
        const delegateEmail = (task.delegadoPara || '').toLowerCase().trim();
        if (task.delegadoPara) return creatorEmail === userEmail || delegateEmail === userEmail;
        if (task.tipoAcesso === 'particular') return creatorEmail === userEmail;
        return true; 
      });

      const newDelegatedTasks = filtered.filter(t => 
        t.delegadoPara?.toLowerCase().trim() === userEmail && !t.vistoPeloDelegado && t.status === 'pendente'
      );

      if (newDelegatedTasks.length > 0) {
        const sessionKey = `notified_tasks_${userEmail}`;
        const notifiedTasks = JSON.parse(sessionStorage.getItem(sessionKey) || '[]');
        let played = false;
        newDelegatedTasks.forEach(t => {
          if (!notifiedTasks.includes(t.id)) {
            if (!played) {
              playNotificationSound();
              played = true;
            }
            notifiedTasks.push(t.id);
          }
        });
        sessionStorage.setItem(sessionKey, JSON.stringify(notifiedTasks));
      }
      setTasks(filtered);
      setLoading(false);
    }, (error) => {
      console.error('Erro no Snapshot:', error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.nome) return toast.error('O nome da tarefa é obrigatório.');
    setSaving(true);
    try {
      const currentUser = auth.currentUser;
      const responsavel = newTask.tipoAcesso === 'particular' ? (currentUser?.displayName || 'Você') : (newTask.equipeSelecionada || 'Todos');
      const delegadoObj = allUsers.find(u => u.email === newTask.delegadoPara);
      const taskData = { ...newTask, nome: newTask.nome?.toUpperCase(), responsavelTarefa: responsavel, delegadoNome: delegadoObj?.name || '' };
      if (editingTaskId) {
        await taskService.updateTask(editingTaskId, taskData, newComment);
        toast.success('Tarefa atualizada!');
      } else {
        await taskService.createTask({ ...taskData, descricao: newComment });
        toast.success('Tarefa criada!');
      }
      closeForm();
    } catch (error) { toast.error('Erro ao salvar.'); } finally { setSaving(false); }
  };

  const handleEditTask = async (task: Task) => {
    const userEmail = (auth.currentUser?.email || '').toLowerCase().trim();
    if (!task.vistoPeloDelegado && task.delegadoPara?.toLowerCase().trim() === userEmail) {
      try {
        await taskService.markAsSeen(task.id!);
      } catch (error) {
        console.warn('Erro ao marcar tarefa como vista:', error);
      }
    }

    setNewTask({ 
      nome: task.nome, 
      prioridade: task.prioridade, 
      dataLimite: task.dataLimite || '', 
      tipoAcesso: task.tipoAcesso, 
      equipeSelecionada: task.equipeSelecionada || 'Todos', 
      delegadoPara: task.delegadoPara || '' 
    });
    setEditingTaskId(task.id!);
    setNewComment('');
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const closeForm = () => {
    setIsAdding(false);
    setEditingTaskId(null);
    setNewComment('');
    setNewTask({ nome: '', prioridade: 'media', dataLimite: '', tipoAcesso: 'particular', descricao: '', equipeSelecionada: 'Todos', delegadoPara: '' });
  };

  const toggleTaskSelection = (id: string) => {
    const newSet = new Set(selectedTasks);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedTasks(newSet);
  };

  const handleCompleteSelectedTasks = async () => {
    if (selectedTasks.size === 0) return;
    setSaving(true);
    try {
      for (const id of selectedTasks) await taskService.completeTask(id);
      toast.success(`${selectedTasks.size} tarefa(s) finalizada(s)!`);
      setSelectedTasks(new Set()); 
    } catch (error) { toast.error('Erro ao finalizar tarefas.'); } finally { setSaving(false); }
  };

  const getPriorityBadge = (p: string) => {
    const colors: any = { alta: 'bg-red-500/10 text-red-400 border-red-500/20', media: 'bg-amber-500/10 text-amber-400 border-amber-500/20', baixa: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    return <span className={cn("px-2 py-1 border rounded-md text-[9px] font-black uppercase tracking-widest", colors[p])}>{p}</span>;
  };

  const formatFullDate = (dateStr: string) => {
    if (!dateStr) return 'Data não disponível';
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} às ${hours}:${minutes}`;
  };

  const currentEditingTask = tasks.find(t => t.id === editingTaskId);

  return (
    <div className="animate-in fade-in duration-700 pb-20">
      <style>{`
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.5) sepia(1) saturate(5) hue-rotate(320deg); cursor: pointer; }
        input[type="date"] { color-scheme: dark; }
        @keyframes pulse-badge {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
        .animate-pulse-badge {
          animation: pulse-badge 1.5s infinite ease-in-out;
        }
      `}</style>
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase italic flex items-center gap-3"><CheckSquare className="w-8 h-8 text-[#ff5351]" /> Tarefas</h1>
          <p className="text-zinc-500 text-sm mt-2">Gestão de atividades e histórico de progresso.</p>
        </div>
        <button onClick={isAdding ? closeForm : () => setIsAdding(true)} className="h-12 px-6 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-[0.2em] text-[10px] hover:brightness-110 transition-all flex items-center gap-2">
          {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {isAdding ? 'Cancelar' : 'Nova Tarefa'}
        </button>
      </header>
      {isAdding && (
        <form onSubmit={handleSaveTask} className="space-y-6 mb-8 animate-in slide-in-from-top-4">
          <div className="bg-[#141414] border border-zinc-800 rounded-[32px] p-8 shadow-2xl">
            <div className="flex items-center gap-2 mb-8 border-b border-zinc-800 pb-4">
              <Edit className="w-4 h-4 text-[#ff5351]" /><h2 className="text-white font-black uppercase tracking-widest text-sm">{editingTaskId ? 'Editar Atividade' : 'Nova Atividade'}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="space-y-2 lg:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Título da Tarefa</label>
                <input required type="text" value={newTask.nome} onChange={e => setNewTask({...newTask, nome: e.target.value.toUpperCase()})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-sm text-white focus:border-[#ff5351] outline-none uppercase" placeholder="O QUE PRECISA SER FEITO?" />
              </div>
              <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Prioridade</label><select value={newTask.prioridade} onChange={e => setNewTask({...newTask, prioridade: e.target.value as any})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-sm text-white focus:border-[#ff5351] outline-none appearance-none cursor-pointer"><option value="alta">ALTA</option><option value="media">MÉDIA</option><option value="baixa">BAIXA</option></select></div>
              <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Data Limite</label><input type="date" value={newTask.dataLimite} onChange={e => setNewTask({...newTask, dataLimite: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-sm text-white focus:border-[#ff5351] outline-none bg-[#1f1f1f]" /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
               <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Visibilidade</label><select value={newTask.tipoAcesso} onChange={e => { const val = e.target.value as any; setNewTask({...newTask, tipoAcesso: val, equipeSelecionada: val === 'equipe' ? 'Todos' : ''}); }} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-sm text-white focus:border-[#ff5351] outline-none appearance-none cursor-pointer"><option value="particular">PARTICULAR (SÓ EU VEJO)</option><option value="equipe">EQUIPE BORANOV</option></select></div>
              {newTask.tipoAcesso === 'equipe' && (
                <div className="space-y-2 animate-in fade-in"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Equipe Responsável</label><div className="relative"><select value={newTask.equipeSelecionada} onChange={e => setNewTask({...newTask, equipeSelecionada: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-sm text-white focus:border-[#ff5351] outline-none appearance-none cursor-pointer"><option value="Todos">TODA A EQUIPE (TODOS)</option>{allUsers.filter(u => u.email !== auth.currentUser?.email).map(user => (<option key={user.email} value={user.name}>{user.name.toUpperCase()}</option>))}</select><ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" /></div></div>
              )}
              <div className="space-y-2 relative"><label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1 flex items-center gap-2"><UserPlus className="w-3 h-3 text-[#ff5351]" /> Delegar Tarefa (Opcional)</label><div className="relative"><select value={newTask.delegadoPara} onChange={e => setNewTask({...newTask, delegadoPara: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-sm text-white focus:border-[#ff5351] outline-none appearance-none cursor-pointer"><option value="">NÃO DELEGAR</option>{allUsers.filter(u => u.email !== auth.currentUser?.email).map(user => (<option key={user.email} value={user.email}>{user.name.toUpperCase()}</option>))}</select><ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" /></div></div>
            </div>
            <div className="space-y-2 mb-8"><label className="text-[10px] font-black uppercase tracking-widest text-[#ff5351] ml-1 flex items-center gap-2"><MessageSquare className="w-3 h-3" /> Adicionar Atualização ao Histórico</label><div className="relative"><textarea value={newComment} onChange={e => setNewComment(e.target.value.toUpperCase())} rows={3} className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-5 text-sm text-white focus:border-[#ff5351] outline-none resize-none placeholder:text-zinc-700 uppercase" placeholder="DIGITE AQUI O QUE FOI FEITO..." /><div className="absolute bottom-4 right-4 text-[9px] text-zinc-600 font-bold uppercase tracking-widest">PRESSIONE SALVAR PARA REGISTRAR</div></div></div>
            {editingTaskId && currentEditingTask?.historico && currentEditingTask.historico.length > 0 && (
              <div className="space-y-4 pt-6 border-t border-zinc-800">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1 italic">Linha do Tempo de Atualizações</label>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {[...currentEditingTask.historico].reverse().map((item, idx) => (
                    <div key={idx} className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-4"><div className="flex items-center justify-between mb-2"><span className="text-[10px] font-black text-[#ff5351] uppercase tracking-widest">{item.autor || 'Usuário Desconhecido'}</span><span className="text-[9px] font-mono text-zinc-600 uppercase font-black">{formatFullDate(item.date)}</span></div><p className="text-zinc-300 text-sm leading-relaxed uppercase">{item.texto}</p></div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end pt-8 border-t border-zinc-800 mt-8"><button type="submit" disabled={saving} className="h-14 px-10 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-[#ff5351] hover:text-white transition-all flex items-center gap-3 shadow-2xl">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{editingTaskId ? 'Salvar Planejamento' : 'Salvar Planejamento'}</button></div>
          </div>
        </form>
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-zinc-800 mb-6 pb-4">
        <div className="flex gap-6">{['pendentes', 'executadas'].map((tab) => (<button key={tab} onClick={() => { setActiveTab(tab as any); setSelectedTasks(new Set()); }} className={cn("text-[10px] uppercase font-black tracking-widest pb-2 border-b-2 transition-all", activeTab === tab ? 'text-white border-[#ff5351]' : 'text-zinc-500 border-transparent')}>{tab}</button>))}</div>
        {activeTab === 'pendentes' && selectedTasks.size > 0 && (<button onClick={handleCompleteSelectedTasks} disabled={saving} className="px-6 py-2.5 bg-emerald-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-600 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 animate-in zoom-in-95">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Finalizar Selecionadas ({selectedTasks.size})</button>)}
      </div>
      <DataTable 
        data={tasks.filter(t => (activeTab === 'pendentes' && t.status === 'pendente') || (activeTab === 'executadas' && t.status === 'executada'))}
        loading={loading}
        onRowClick={(task) => handleEditTask(task)}
        columns={[
          ...(activeTab === 'pendentes' ? [{ 
            header: '', 
            accessor: (task: Task) => (
              <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                <button 
                  onClick={() => toggleTaskSelection(task.id!)} 
                  className={cn(
                    "w-5 h-5 rounded border-2 transition-all flex items-center justify-center shrink-0", 
                    selectedTasks.has(task.id!) ? "bg-[#ff5351] border-[#ff5351]" : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
                  )}
                >
                  {selectedTasks.has(task.id!) && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                </button>
              </div>
            ),
            className: 'w-10' 
          }] : []),
          { 
            header: 'Atividade', 
            accessor: (task) => {
              const isNew = !task.vistoPeloDelegado && task.delegadoPara?.toLowerCase().trim() === auth.currentUser?.email?.toLowerCase().trim();
              return (
                <div className="py-1 px-3 -ml-6 transition-all">
                  <div className="flex items-center gap-2 mb-0.5">
                    {isNew && <span className="px-1.5 py-0.5 bg-[#ff5351] text-white text-[7px] font-black rounded animate-pulse-badge shrink-0">NOVA</span>}
                    <div className="font-bold text-sm text-white uppercase group-hover:text-[#ff5351] transition-colors truncate">{task.nome}</div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                    <MessageSquare className="w-3 h-3" />
                    {task.historico?.length || 0} registros no histórico
                  </div>
                </div>
              );
            }
          },
          { header: 'Prioridade', accessor: (task) => getPriorityBadge(task.prioridade), align: 'center' },
          { header: 'Acesso', accessor: (task) => <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest flex items-center gap-1.5"><Shield className="w-3 h-3" />{task.tipoAcesso}</span> },
          { header: 'Responsável', accessor: (task) => <span className="text-zinc-300 text-xs font-bold uppercase">{task.responsavelTarefa}</span> }
        ]}
        actions={(task) => (
          <div className="flex items-center gap-2">
            <button onClick={(e) => { e.stopPropagation(); handleEditTask(task); }} className="p-2 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-all"><Edit className="w-4 h-4" /></button>
            <button onClick={async (e) => { e.stopPropagation(); if (window.confirm('Excluir esta tarefa permanentemente?')) { await taskService.deleteTask(task.id!); } }} className="p-2 bg-zinc-800/50 hover:bg-red-500/10 rounded-xl text-zinc-600 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button>
          </div>
        )}
      />
    </div>
  );
}
