export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Library, CheckSquare, ArrowRight, Loader2, TrendingUp, Shield, ChevronRight, Clock, CheckCircle2, Wallet
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { projectService } from '../services/projectService';
import { clientService } from '../services/clientService';
import { teamService } from '../services/teamService';
import { taskService, Task } from '../services/taskService';
import { auth, db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { cn } from '../lib/utils';

export default function Dashboard() {
  const [metrics, setMetrics] = useState({
    clientsActive: 0,
    clientsPending: 0,
    team: 0,
    projectsActive: 0,
    projectsCompleted: 0,
    pendingTasks: 0,
    waitingApproval: 0,
    creditsOpen: 0
  });
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('cliente');
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      // 1. Identificar Role
      let role = 'cliente';
      if (currentUser.email === 'boranovfilms@gmail.com') {
        role = 'master';
      } else {
        const q = query(collection(db, 'clients'), where('email', '==', currentUser.email));
        const snap = await getDocs(q);
        if (!snap.empty) {
          role = snap.docs[0].data().role || 'cliente';
        }
      }
      setUserRole(role);

      const isInternal = role === 'master' || role === 'editor' || role === 'designer' || role === 'admin';

      // 2. Carregar Dados Reais
      const [allClients, allTeam, internalProjects, clientProjects, allTasks, allWorkflows, allCreditRequests] = await Promise.all([
        isInternal ? clientService.searchClients('').catch(() => []) : Promise.resolve([]),
        isInternal ? teamService.getTeamMembers().catch(() => []) : Promise.resolve([]),
        isInternal ? projectService.getProjects().catch(() => []) : Promise.resolve([]),
        projectService.getProjectsForClient().catch(() => []),
        taskService.getTasks().catch(() => []),
        isInternal ? getDocs(collection(db, 'workflows')).catch(() => ({ docs: [] })) : Promise.resolve({ docs: [] }),
        isInternal ? getDocs(collection(db, 'creditRequests')).catch(() => ({ docs: [] })) : Promise.resolve({ docs: [] })
      ]);

      const userEmail = (currentUser.email || '').toLowerCase().trim();
      const todayStr = new Date().toISOString().split('T')[0];

      // Processar Tarefas
      const myTasks = allTasks.filter(t => {
        const isPending = t.status === 'pendente';
        if (isInternal) return isPending;
        return isPending && (t.responsavelCriacaoEmail || '').toLowerCase().trim() === userEmail;
      });

      if (isInternal) {
        setTodayTasks(allTasks.filter(t => t.status === 'pendente' && t.dataLimite === todayStr));
      }

      // Processar Workflows para "Aguardando Aprovação" e "Concluídos"
      const workflows = allWorkflows.docs.map(d => d.data());
      const waitingApprovalCount = workflows.filter(w => 
        w.status !== 'completed' && 
        w.stages?.[w.currentStageIndex]?.status === 'waiting_approval'
      ).length;
      
      const completedProjectsCount = workflows.filter(w => w.status === 'completed').length;

      // Processar Créditos Abertos
      const creditRequests = allCreditRequests.docs.map(d => d.data());
      const totalCredits = creditRequests
        .filter(r => r.status === 'Aprovado')
        .reduce((sum, r) => sum + (Number(r.creditsRequested) || 0), 0);

      setMetrics({
        clientsActive: allClients.filter(c => c.status === 'confirmed').length,
        clientsPending: allClients.filter(c => c.status !== 'confirmed').length,
        team: allTeam.length,
        projectsActive: isInternal ? internalProjects.length - completedProjectsCount : clientProjects.length,
        projectsCompleted: isInternal ? completedProjectsCount : 0,
        pendingTasks: myTasks.length,
        waitingApproval: waitingApprovalCount,
        creditsOpen: totalCredits
      });

    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar métricas.');
    } finally {
      setLoading(false);
    }
  };

  const isInternal = userRole === 'master' || userRole === 'editor' || userRole === 'designer' || userRole === 'admin';

  const metricCards = isInternal ? [
    { label: 'Clientes Ativos', value: metrics.clientsActive, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-400/10', path: '/clients' },
    { label: 'Aguardando Senha', value: metrics.clientsPending, icon: UserPlus, color: 'text-amber-400', bg: 'bg-amber-400/10', path: '/clients' },
    { label: 'Projetos em Andamento', value: metrics.projectsActive, icon: Library, color: 'text-blue-400', bg: 'bg-blue-400/10', path: '/projetos' },
    { label: 'Projetos Concluídos', value: metrics.projectsCompleted, icon: CheckCircle2, color: 'text-indigo-400', bg: 'bg-indigo-400/10', path: '/projetos' },
    { label: 'Aguardando Cliente', value: metrics.waitingApproval, icon: Clock, color: 'text-[#ff5351]', bg: 'bg-[#ff5351]/10', path: '/projetos' },
    { label: 'Tarefas Pendentes', value: metrics.pendingTasks, icon: CheckSquare, color: 'text-orange-400', bg: 'bg-orange-400/10', path: '/tarefas' },
    { label: 'Créditos Disponíveis', value: metrics.creditsOpen, icon: Wallet, color: 'text-cyan-400', bg: 'bg-cyan-400/10', path: '/credits' },
    { label: 'Equipe Boranov', value: metrics.team, icon: Shield, color: 'text-zinc-400', bg: 'bg-zinc-400/10', path: '/equipe' },
  ] : [
    { label: 'Meus Projetos', value: metrics.projectsActive, icon: Library, color: 'text-[#ff5351]', bg: 'bg-[#ff5351]/10', path: '/projetos' },
    { label: 'Minhas Tarefas', value: metrics.pendingTasks, icon: CheckSquare, color: 'text-amber-400', bg: 'bg-amber-400/10', path: '/tarefas' },
  ];

  const getPriorityBadge = (p: string) => {
    const colors: any = { alta: 'bg-red-500/10 text-red-400 border-red-500/20', media: 'bg-amber-500/10 text-amber-400 border-amber-500/20', baixa: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    return <span className={cn("px-2 py-0.5 border rounded text-[8px] font-black uppercase tracking-widest", colors[p])}>{p}</span>;
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20">
      <header>
        <p className="text-[11px] uppercase tracking-[0.4em] text-[#ff5351] font-black mb-2">
          {isInternal ? 'Visão Geral' : 'Área do Cliente'}
        </p>
        <h1 className="text-5xl font-black tracking-tight text-white uppercase italic">Dashboard</h1>
      </header>

      {/* CARDS DE MÉTRICAS */}
      <div className={cn("grid grid-cols-1 gap-6", isInternal ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-2 max-w-4xl")}>
        {metricCards.map((card, idx) => (
          <div 
            key={idx}
            onClick={() => navigate(card.path)}
            className="group relative bg-[#1a1a1a] border border-zinc-800 rounded-[32px] p-6 cursor-pointer hover:border-[#ff5351]/40 transition-all shadow-xl"
          >
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-all group-hover:scale-110", card.bg)}>
              <card.icon className={cn("w-5 h-5", card.color)} />
            </div>
            <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest mb-1">{card.label}</p>
            <div className="flex items-end justify-between">
              <h3 className="text-3xl font-black text-white">{card.value}</h3>
              <ArrowRight className="w-4 h-4 text-zinc-800 group-hover:text-[#ff5351] transition-colors" />
            </div>
          </div>
        ))}
      </div>

      {/* TAREFAS DE HOJE (APENAS ADMIN) */}
      {isInternal && (
        <section className="bg-[#1a1a1a] border border-zinc-800 rounded-[32px] overflow-hidden shadow-xl">
          <div className="p-8 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-tight">Tarefas para Hoje</h2>
                <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Atividades com prazo para {new Date().toLocaleDateString('pt-BR')}</p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/tarefas')}
              className="px-4 py-2 border border-zinc-700 hover:border-[#ff5351] rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all flex items-center gap-2"
            >
              Ver Todas <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="p-4">
            {todayTasks.length === 0 ? (
              <div className="py-10 text-center">
                <CheckSquare className="w-8 h-8 text-zinc-800 mx-auto mb-3" />
                <p className="text-zinc-500 text-sm font-medium">Nenhuma tarefa pendente para hoje. Bom trabalho!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {todayTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl hover:border-zinc-700 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-2 rounded-full bg-[#ff5351] shadow-[0_0_8px_rgba(255,83,81,0.4)]" />
                      <div>
                        <p className="text-white text-sm font-bold">{task.nome}</p>
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-0.5">{task.responsavelTarefa}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {getPriorityBadge(task.prioridade)}
                      <div className="flex items-center gap-1.5 text-zinc-500 font-mono text-[10px]">
                        <Clock className="w-3 h-3" />
                        Hoje
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* BLOCO DE ATALHOS / AÇÃO RÁPIDA */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-[#1a1a1a] border border-zinc-800 rounded-[32px] p-8 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center gap-3 mb-6">
               <TrendingUp className="w-5 h-5 text-[#ff5351]" />
               <h2 className="text-xl font-black text-white uppercase tracking-tight">Atalhos de Gestão</h2>
            </div>
            <p className="text-zinc-500 text-sm mb-8 leading-relaxed">
              {isInternal 
                ? 'Gerencie as tarefas da produção e mantenha o cronograma dos clientes em dia.' 
                : 'Acompanhe suas solicitações e tarefas pendentes para agilizar sua entrega.'}
            </p>
          </div>
          <button 
            onClick={() => navigate('/tarefas')}
            className="w-full h-14 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-[#ff5351] hover:text-white transition-all flex items-center justify-center gap-3 shadow-2xl"
          >
            {isInternal ? 'Acessar Gestão de Tarefas' : 'Acessar Minhas Tarefas'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-[linear-gradient(135deg,rgba(255,83,81,0.1),transparent)] border border-[#ff5351]/20 rounded-[32px] p-8 relative overflow-hidden flex flex-col justify-center shadow-xl">
            <h3 className="text-2xl font-black text-white uppercase italic leading-tight mb-4">
              Bem-vindo ao Cockpit<br/>BoraSelect
            </h3>
            <p className="text-zinc-400 text-sm max-w-xs">
              {isInternal 
                ? 'Todas as métricas da sua produtora centralizadas.' 
                : 'Seu portal exclusivo para acompanhamento de projetos.'}
            </p>
            <Shield className="absolute -bottom-10 -right-10 w-48 h-48 text-[#ff5351]/5 rotate-12" />
        </div>
      </section>
    </div>
  );
}
