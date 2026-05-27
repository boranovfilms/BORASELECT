import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckSquare, Plus, Clock, User, Shield, X, Save, Loader2, Check, Edit, Trash2, MessageSquare, ChevronDown, UserPlus
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '../lib/utils';
import { taskService, Task, TaskHistory } from '../services/taskService';
import { teamService, TeamMember } from '../services/teamService';
import { clientService, Client } from '../services/clientService';
import { auth } from '../lib/firebase';
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

  useEffect(() => {
    loadInitialData();
  }, []);

  const playNotificationSound = () => {
    try {
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContext.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {
      console.warn('Som de notificação bloqueado pelo navegador');
    }
  };

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [allTasks, teamData, clientsData] = await Promise.all([
        taskService.getTasks(),
        teamService.getTeamMembers().catch(() => []),
        clientService.searchClients('').catch(() => [])
      ]);
      
      const userEmail = (auth.currentUser?.email || '').toLowerCase().trim();
      
      // Lista unificada para delegação
      const usersList = [
        ...teamData.map(m => ({ email: m.email, name: m.name })),
        ...clientsData.map(c => ({ email: c.email, name: c.name }))
      ];
      setAllUsers(usersList);

      const filterTasks = allTasks.filter(task => {
        const creatorEmail = (task.responsavelCriacaoEmail || '').toLowerCase().trim();
        const delegateEmail = (task.delegadoPara || '').toLowerCase().trim();
        
        // Regra de Delegação: Apenas criador e delegado veem
        if (task.delegadoPara) {
          return creatorEmail === userEmail || delegateEmail === userEmail;
        }

        // Regra de Acesso Particular
        if (task.tipoAcesso === 'particular') {
           return creatorEmail === userEmail;
        }
        return true; 
      });

      // Notificação sonora para novas tarefas delegadas
      const newDelegatedTasks = filterTasks.filter(t => 
        t.delegadoPara?.toLowerCase().trim() === userEmail && 
        !t.vistoPeloDelegado && 
        t.status === 'pendente'
      );

      if (newDelegatedTasks.length > 0) {
        playNotificationSound();
        // Marca como visto após notificar
        newDelegatedTasks.forEach(t => taskService.markAsSeen(t.id!));
      }

      setTasks(filterTasks);
    } catch (error) {
      toast.error('Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
    try {
      const allTasks = await taskService.getTasks();
      const userEmail = (auth.currentUser?.email || '').toLowerCase().trim();
      const filterTasks = allTasks.filter(task => {
        const creatorEmail = (task.responsavelCriacaoEmail || '').toLowerCase().trim();
        const delegateEmail = (task.delegadoPara || '').toLowerCase().trim();
        
        if (task.delegadoPara) {
          return creatorEmail === userEmail || delegateEmail === userEmail;
        }

        if (task.tipoAcesso === 'particular') {
           return creatorEmail === userEmail;
        }
        return true; 
      });
      setTasks(filterTasks);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.nome) return toast.error('O nome da tarefa é obrigatório.');
    
    setSaving(true);
    try {
      const currentUser = auth.currentUser;
      const responsavel = newTask.tipoAcesso === 'particular' 
        ? (currentUser?.displayName || 'Você') 
        : (newTask.equipeSelecionada || 'Todos');

      const delegadoObj = allUsers.find(u => u.email === newTask.delegadoPara);

      const taskData = {
        ...newTask,
        nome: newTask.nome?.toUpperCase(),
        responsavelTarefa: responsavel,
        delegadoNome: delegadoObj?.name || ''
      };

      if (editingTaskId) {
        await taskService.updateTask(editingTaskId, taskData, newComment);
        toast.success('Tarefa atualizada!');
      } else {
        await taskService.createTask({ ...taskData, descricao: newComment });
        toast.success('Tarefa criada!');
      }

      closeForm();
      await loadTasks(); 
    } catch (error) {
      toast.error('Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditTask = (task: Task) => {
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
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedTasks(newSet);
  };

  const handleCompleteSelectedTasks = async () => {
    if (selectedTasks.size === 0) return;
    setSaving(true);
    try {
      for (const id of selectedTasks) {
        await taskService.completeTask(id);
      }
      toast.success(`${selectedTasks.size} tarefa(s) finalizada(s)!`);
      setSelectedTasks(new Set()); 
      await loadTasks(); 
    } catch (error) {
      toast.error('Erro ao finalizar tarefas.');
    } finally {
      setSaving(false);
    }
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
        input[type=\"date\"]::-webkit-calendar-picker-indicator {
          filter: invert(0.5) sepia(1) saturate(5) hue-rotate(320deg);
          cursor: pointer;
        }
        input[type=\"date\"] {
          color-scheme: dark;
        }
      `}</style>

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase italic flex items-center gap-3">
            <CheckSquare className="w-8 h-8 text-[#ff5351]" /> Tarefas
          </h1>
          <p className="text-zinc-500 text-sm mt-2">Gestão de atividades e histórico de progresso.</p>
        </div>
        <button onClick={isAdding ? closeForm : () => setIsAdding(true)} className="h-12 px-6 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-[0.2em] text-[10px] hover:brightness-110 transition-all flex items-center gap-2">
          {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {isAdding ? 'Cancelar' : 'Nova Tarefa'}
        </button>
      </header>

      {isAdding && (
        <form onSubmit={handleSaveTask} className="space-y-6 mb-8 animate-in slide-in-from-top-4">
          <div className="bg-[#141414] border border-zinc-800 rounded-[32px] p-8 shadow-2xl">
            <div className="flex items-center gap-2 mb-8 border-b border-zinc-800 pb-4">
              <Edit className="w-4 h-4 text-[#ff5351]" />
              <h2 className="text-white font-black uppercase tracking-widest text-sm">{editingTaskId ? 'Editar Atividade' : 'Nova Atividade'}</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="space-y-2 lg:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Título da Tarefa</label>
                <input required type="text" value={newTask.nome} onChange={e => setNewTask({...newTask, nome: e.target.value.toUpperCase()})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-sm text-white focus:border-[#ff5351] outline-none uppercase" placeholder=\"O QUE PRECISA SER FEITO?\" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Prioridade</label>
                <select value={newTask.prioridade} onChange={e => setNewTask({...newTask, prioridade: e.target.value as any})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-sm text-white focus:border-[#ff5351] outline-none appearance-none cursor-pointer">
                  <option value="alta">ALTA</option><option value="media">MÉDIA</option><option value="baixa">BAIXA</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Data Limite</label>
                <input type="date" value={newTask.dataLimite} onChange={e => setNewTask({...newTask, dataLimite: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-sm text-white focus:border-[#ff5351] outline-none bg-[#1f1f1f]" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
               <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Visibilidade</label>
                <select value={newTask.tipoAcesso} onChange={e => {
                  const val = e.target.value as any;
                  setNewTask({...newTask, tipoAcesso: val, equipeSelecionada: val === 'equipe' ? 'Todos' : ''});
                }} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-sm text-white focus:border-[#ff5351] outline-none appearance-none cursor-pointer">
                  <option value="particular">PARTICULAR (SÓ EU VEJO)</option><option value="equipe">EQUIPE BORANOV</option>
                </select>
              </div>
              
              {newTask.tipoAcesso === 'equipe' && (
                <div className="space-y-2 animate-in fade-in">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Equipe Responsável</label>
                  <div className="relative">
                    <select 
                      value={newTask.equipeSelecionada} 
                      onChange={e => setNewTask({...newTask, equipeSelecionada: e.target.value})}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-sm text-white focus:border-[#ff5351] outline-none appearance-none cursor-pointer"
                    >
                      <option value="Todos">TODA A EQUIPE (TODOS)</option>
                      {allUsers.filter(u => u.email !== auth.currentUser?.email).map(user => (
                        <option key={user.email} value={user.name}>{user.name.toUpperCase()}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
                  </div>
                </div>
              )}

              <div className="space-y-2 relative">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1 flex items-center gap-2">
                  <UserPlus className=\"w-3 h-3 text-[#ff5351]\" /> Delegar Tarefa (Opcional)
                </label>
                <div className="relative">
                  <select 
                    value={newTask.delegadoPara} 
                    onChange={e => setNewTask({...newTask, delegadoPara: e.target.value})}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 text-sm text-white focus:border-[#ff5351] outline-none appearance-none cursor-pointer"
                  >
                    <option value=\"\">NÃO DELEGAR</option>
                    {allUsers.filter(u => u.email !== auth.currentUser?.email).map(user => (
                      <option key={user.email} value={user.email}>{user.name.toUpperCase()}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="space-y-2 mb-8">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#ff5351] ml-1 flex items-center gap-2">
                <MessageSquare className="w-3 h-3" /> Adicionar Atualização ao Histórico
              </label>
              <div className="relative">
                <textarea value={newComment} onChange={e => setNewComment(e.target.value.toUpperCase())} rows={3} className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-5 text-sm text-white focus:border-[#ff5351] outline-none resize-none placeholder:text-zinc-700 uppercase" placeholder=\"DIGITE AQUI O QUE FOI FEITO...\" />
                <div className=\"absolute bottom-4 right-4 text-[9px] text-zinc-600 font-bold uppercase tracking-widest\">PRESSIONE SALVAR PARA REGISTRAR</div>
              </div>
            </div>

            {editingTaskId && currentEditingTask?.historico && currentEditingTask.historico.length > 0 && (
              <div className="space-y-4 pt-6 border-t border-zinc-800">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1 italic">Linha do Tempo de Atualizações</label>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {[...currentEditingTask.historico].reverse().map((item, idx) => (
                    <div key={idx} className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-[#ff5351] uppercase tracking-widest">{item.autor || 'Usuário Desconhecido'}</span>
                        <span className="text-[9px] font-mono text-zinc-600 uppercase font-black">{formatFullDate(item.date)}</span>
                      </div>
                      <p className="text-zinc-300 text-sm leading-relaxed uppercase">{item.texto}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-8 border-t border-zinc-800 mt-8">
              <button type="submit" disabled={saving} className="h-14 px-10 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-[#ff5351] hover:text-white transition-all flex items-center gap-3 shadow-2xl">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingTaskId ? 'Salvar Planejamento' : 'Salvar Planejamento'}
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-zinc-800 mb-6 pb-4">
        <div className="flex gap-6">
          {['pendentes', 'executadas'].map((tab) => (
            <button 
              key={tab} 
              onClick={() => { setActiveTab(tab as any); setSelectedTasks(new Set()); }} 
              className={cn(\"text-[10px] uppercase font-black tracking-widest pb-2 border-b-2 transition-all\", activeTab === tab ? 'text-white border-[#ff5351]' : 'text-zinc-500 border-transparent')}
            >\n              {tab}\n            </button>\n          ))}\n        </div>\n\n        {activeTab === 'pendentes' && selectedTasks.size > 0 && (\n          <button \n            onClick={handleCompleteSelectedTasks}\n            disabled={saving}\n            className=\"px-6 py-2.5 bg-emerald-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-600 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 animate-in zoom-in-95\"\n          >\n            {saving ? <Loader2 className=\"w-4 h-4 animate-spin\" /> : <Check className=\"w-4 h-4\" />}\n            Finalizar Selecionadas ({selectedTasks.size})\n          </button>\n        )}\n      </div>\n\n      <DataTable \n        data={tasks.filter(t => (activeTab === 'pendentes' && t.status === 'pendente') || (activeTab === 'executadas' && t.status === 'executada'))}\n        loading={loading}\n        onRowClick={(task) => handleEditTask(task)}\n        columns={[\n          ...(activeTab === 'pendentes' ? [{\n            header: '',\n            accessor: (task: Task) => (\n              <div className=\"flex justify-center\" onClick={(e) => e.stopPropagation()}>\n                <button \n                  onClick={() => toggleTaskSelection(task.id!)}\n                  className={cn(\n                    \"w-5 h-5 rounded border-2 transition-all flex items-center justify-center\",\n                    selectedTasks.has(task.id!) ? \"bg-[#ff5351] border-[#ff5351]\" : \"border-zinc-700 bg-zinc-900 hover:border-zinc-500\"\n                  )}\n                >\n                  {selectedTasks.has(task.id!) && <Check className=\"w-3 h-3 text-white\" strokeWidth={4} />}\n                </button>\n              </div>\n            ),\n            className: 'w-10'\n          }] : []),\n          {\n            header: 'Atividade',\n            accessor: (task) => (\n              <div className=\"py-1\">\n                <div className=\"font-bold text-sm text-white mb-0.5 uppercase group-hover:text-[#ff5351] transition-colors\">{task.nome}</div>\n                <div className=\"flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase tracking-widest\">\n                  <MessageSquare className=\"w-3 h-3\" />\n                  {task.historico?.length || 0} registros no histórico\n                  {task.delegadoNome && <span className=\"text-[#ff5351] ml-2\">• Delegada para: {task.delegadoNome.toUpperCase()}</span>}\n                </div>\n              </div>\n            )\n          },\n          { header: 'Prioridade', accessor: (task) => getPriorityBadge(task.prioridade), align: 'center' },\n          { header: 'Acesso', accessor: (task) => <span className=\"text-[10px] font-black uppercase text-zinc-500 tracking-widest flex items-center gap-1.5\"><Shield className=\"w-3 h-3\" />{task.tipoAcesso}</span> },\n          { header: 'Responsável', accessor: (task) => <span className=\"text-zinc-300 text-xs font-bold uppercase\">{task.responsavelTarefa}</span> }\n        ]}\n        actions={(task) => (\n          <div className=\"flex items-center gap-2\">\n            <button onClick={(e) => { e.stopPropagation(); handleEditTask(task); }} className=\"p-2 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-all\"><Edit className=\"w-4 h-4\" /></button>\n            <button onClick={async (e) => { e.stopPropagation(); if (window.confirm('Excluir esta tarefa permanentemente?')) { await taskService.deleteTask(task.id!); loadTasks(); } }} className=\"p-2 bg-zinc-800/50 hover:bg-red-500/10 rounded-xl text-zinc-600 hover:text-red-500 transition-all\"><Trash2 className=\"w-4 h-4\" /></button>\n          </div>\n        )}\n      />\n    </div>\n  );\n}\n