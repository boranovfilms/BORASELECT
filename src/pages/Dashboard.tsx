import { useState, useEffect } from 'react';
import { 
  Users, Library, CheckSquare, ArrowRight, Loader2, 
  Clock, CheckCircle2, Wallet, Bell, FileText, Zap
} from 'lucide-react';
import { cn } from '../lib/utils';
import { auth, db } from '../lib/firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('cliente');
  const [userData, setUserData] = useState<any>(null);
  const [userClientId, setUserClientId] = useState<string | null>(null);
  const navigate = useNavigate();
  
  const [adminMetrics, setAdminMetrics] = useState({
    activeClients: 0,
    activeProjects: 0,
    completedProjects: 0,
    pendingTasks: 0,
    awaitingApproval: 0,
    totalCredits: 0
  });

  const [editorMetrics, setEditorMetrics] = useState({
    demandasPendentes: 0,
    demandasEmAndamento: 0,
    demandasConcluidas: 0,
  });

  const [clientMetrics, setClientMetrics] = useState({
    totalPosts: 0,
    postsPendentes: 0,
    postsAprovados: 0,
  });

  const [todayTasks, setTodayTasks] = useState<any[]>([]);

  useEffect(() => {
    loadUserAndInit();
  }, []);

  const loadUserAndInit = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const cleanEmail = user.email?.toLowerCase().trim() || '';

    try {
      let role = 'cliente';
      let clientId: string | null = null;

      if (cleanEmail === 'admin@boraselect.com.br') {
        role = 'master';
      } else {
        const qBora = query(collection(db, 'boraselect'), where('email', '==', cleanEmail));
        const snapBora = await getDocs(qBora);
        if (!snapBora.empty) {
          const data = snapBora.docs[0].data();
          role = data.role || 'redator';
          setUserData(data);
        } else {
          const qCliente = query(collection(db, 'clientes'), where('email', '==', cleanEmail));
          const snapCliente = await getDocs(qCliente);
          if (!snapCliente.empty) {
            const data = snapCliente.docs[0].data();
            role = data.role || 'cliente';
            clientId = data.companyId || snapCliente.docs[0].id;
            setUserData(data);
          }
        }
      }

      setUserRole(role);
      setUserClientId(clientId);
      initListeners(role, cleanEmail, clientId);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const initListeners = (role: string, email: string, clientId: string | null) => {
    const today = new Date().toISOString().split('T')[0];
    const isMasterOrRedator = ['master', 'admin', 'redator'].includes(role);
    const isEditorDesigner = ['editor', 'designer', 'midia_social'].includes(role);
    const isClienteOrEquipe = ['cliente', 'equipe'].includes(role);

    // MASTER / REDATOR
    if (isMasterOrRedator) {
      onSnapshot(query(collection(db, 'clientes'), where('role', '==', 'cliente')), (snap) => {
        setAdminMetrics(prev => ({
          ...prev,
          activeClients: snap.docs.filter(d => d.data().status === 'confirmed').length,
        }));
      });

      onSnapshot(collection(db, 'demandas'), (snap) => {
        const docs = snap.docs.map(d => d.data());
        setAdminMetrics(prev => ({
          ...prev,
          activeProjects: docs.filter(d => d.status !== 'concluido').length,
          completedProjects: docs.filter(d => d.status === 'concluido').length,
          awaitingApproval: docs.filter(d => 
            ['aguardando_cliente', 'aguardando_validacao_equipe'].includes(d.status)
          ).length,
        }));
      });

      onSnapshot(collection(db, 'tarefas'), (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAdminMetrics(prev => ({
          ...prev,
          pendingTasks: docs.filter(d => d.status === 'pendente').length,
        }));
        setTodayTasks(docs.filter((d: any) => d.dataLimite === today && d.status === 'pendente'));
      });

      onSnapshot(query(collection(db, 'clientes'), where('role', '==', 'cliente')), (snap) => {
        const total = snap.docs.reduce((sum, d) => sum + (Number(d.data().creditsTotal) || 0), 0);
        setAdminMetrics(prev => ({ ...prev, totalCredits: total }));
      });
    }

    // EDITOR / DESIGNER
    if (isEditorDesigner) {
      onSnapshot(collection(db, 'demandas'), (snap) => {
        let pendentes = 0, emAndamento = 0, concluidas = 0;
        snap.docs.forEach(d => {
          const posts = d.data().posts || [];
          posts.forEach((post: any) => {
            const tasks = post.tasks || [];
            tasks.forEach((task: any) => {
              if (task.responsibleEmail?.toLowerCase() === email) {
                if (task.status === 'pendente') pendentes++;
                if (task.status === 'em_andamento') emAndamento++;
                if (task.status === 'concluido') concluidas++;
              }
            });
          });
        });
        setEditorMetrics({ demandasPendentes: pendentes, demandasEmAndamento: emAndamento, demandasConcluidas: concluidas });
      });

      onSnapshot(query(collection(db, 'tarefas'), where('delegadoPara', '==', email)), (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setTodayTasks(docs.filter((d: any) => d.dataLimite === today && d.status === 'pendente'));
      });
    }

    // CLIENTE / EQUIPE
    if (isClienteOrEquipe && clientId) {
      onSnapshot(query(collection(db, 'demandas'), where('clientId', '==', clientId)), (snap) => {
        let totalPosts = 0, postsPendentes = 0, postsAprovados = 0;
        snap.docs.forEach(d => {
          const posts = d.data().posts || [];
          totalPosts += posts.length;
          postsPendentes += posts.filter((p: any) => p.status === 'pendente').length;
          postsAprovados += posts.filter((p: any) => 
            ['aprovado', 'validado_equipe'].includes(p.status)
          ).length;
        });
        setClientMetrics({ totalPosts, postsPendentes, postsAprovados });
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff5351]" />
      </div>
    );
  }

  const isMasterOrRedator = ['master', 'admin', 'redator'].includes(userRole);
  const isEditorDesigner = ['editor', 'designer', 'midia_social'].includes(userRole);
  const isClienteOrEquipe = ['cliente', 'equipe'].includes(userRole);

  // MASTER / REDATOR
  if (isMasterOrRedator) {
    return (
      <div className="space-y-8 pb-20 animate-in fade-in duration-700">
        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#ff5351] mb-2">Visão Geral</p>
          <h1 className="text-5xl font-black text-white uppercase italic tracking-tighter">Dashboard</h1>
        </header>

        {adminMetrics.awaitingApproval > 0 && (
          <div className="bg-[#ff5351]/10 border border-[#ff5351]/20 rounded-3xl p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#ff5351] flex items-center justify-center">
                <Bell className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold uppercase italic">Atenção!</h3>
                <p className="text-zinc-500 text-xs font-medium">Existem demandas aguardando aprovação.</p>
              </div>
            </div>
            <div className="px-4 py-2 bg-[#ff5351] text-white text-xs font-black rounded-xl">
              {adminMetrics.awaitingApproval} PENDENTES
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard label="Clientes Ativos" value={adminMetrics.activeClients} icon={Users} color="emerald" />
          <StatCard label="Demandas Ativas" value={adminMetrics.activeProjects} icon={FileText} color="blue" />
          <StatCard label="Concluídas" value={adminMetrics.completedProjects} icon={CheckCircle2} color="indigo" />
          <StatCard label="Créditos em Conta" value={adminMetrics.totalCredits} icon={Wallet} color="cyan" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StatCard label="Tarefas Pendentes" value={adminMetrics.pendingTasks} icon={CheckSquare} color="orange" />
          <StatCard label="Aguardando Aprovação" value={adminMetrics.awaitingApproval} icon={Clock} color="rose" />
        </div>

        <TodayTasks tasks={todayTasks} navigate={navigate} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button 
            onClick={() => navigate('/minhas-demandas')} 
            className="h-14 bg-[#ff5351] text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:brightness-110 transition-all shadow-xl flex items-center justify-center gap-3"
          >
            <FileText className="w-4 h-4" /> Minhas Demandas
          </button>
          <button 
            onClick={() => navigate('/tarefas')} 
            className="h-14 bg-zinc-900 border border-zinc-800 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-zinc-800 transition-all flex items-center justify-center gap-3"
          >
            <CheckSquare className="w-4 h-4" /> Tarefas Diárias
          </button>
        </div>
      </div>
    );
  }

  // EDITOR / DESIGNER
  if (isEditorDesigner) {
    return (
      <div className="space-y-8 pb-20 animate-in fade-in duration-700">
        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#ff5351] mb-2">Seu Painel</p>
          <h1 className="text-5xl font-black text-white uppercase italic tracking-tighter">
            Olá, {userData?.name?.split(' ')[0] || 'Editor'}
          </h1>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard label="Demandas Pendentes" value={editorMetrics.demandasPendentes} icon={Clock} color="amber" />
          <StatCard label="Em Andamento" value={editorMetrics.demandasEmAndamento} icon={Zap} color="blue" />
          <StatCard label="Concluídas" value={editorMetrics.demandasConcluidas} icon={CheckCircle2} color="emerald" />
        </div>

        <TodayTasks tasks={todayTasks} navigate={navigate} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button 
            onClick={() => navigate('/minhas-demandas')} 
            className="h-14 bg-[#ff5351] text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:brightness-110 transition-all shadow-xl flex items-center justify-center gap-3"
          >
            <FileText className="w-4 h-4" /> Minhas Demandas
          </button>
          <button 
            onClick={() => navigate('/tarefas')} 
            className="h-14 bg-zinc-900 border border-zinc-800 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-zinc-800 transition-all flex items-center justify-center gap-3"
          >
            <CheckSquare className="w-4 h-4" /> Tarefas Diárias
          </button>
        </div>
      </div>
    );
  }

  // CLIENTE / EQUIPE
  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#ff5351] mb-2">Cockpit Boranov</p>
        <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter">
          {userData?.name || 'Bem-vindo'}
        </h1>
      </header>

      <div className="bg-[linear-gradient(135deg,rgba(255,83,81,0.1),transparent)] border border-[#ff5351]/20 rounded-[40px] p-10 shadow-2xl">
        <h2 className="text-3xl font-black text-white uppercase italic leading-tight mb-2">
          Acompanhe seu<br/>conteúdo em tempo real
        </h2>
        <p className="text-zinc-400 text-sm max-w-sm">
          Visualize o status de cada post e aprove conteúdos com um clique.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Total de Posts" value={clientMetrics.totalPosts} icon={FileText} color="blue" />
        <StatCard label="Aguardando Aprovação" value={clientMetrics.postsPendentes} icon={Clock} color="amber" />
        <StatCard label="Aprovados" value={clientMetrics.postsAprovados} icon={CheckCircle2} color="emerald" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button 
          onClick={() => navigate('/minhas-demandas')} 
          className="h-14 bg-[#ff5351] text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:brightness-110 transition-all shadow-xl flex items-center justify-center gap-3"
        >
          <FileText className="w-4 h-4" /> Ver Meus Conteúdos
        </button>
        <button 
          onClick={() => navigate('/projetos')} 
          className="h-14 bg-zinc-900 border border-zinc-800 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-zinc-800 transition-all flex items-center justify-center gap-3"
        >
          <Library className="w-4 h-4" /> Projetos de Seleção
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
  const colors: any = {
    emerald: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/10',
    amber: 'bg-amber-400/10 text-amber-400 border-amber-400/10',
    blue: 'bg-blue-400/10 text-blue-400 border-blue-400/10',
    indigo: 'bg-indigo-400/10 text-indigo-400 border-indigo-400/10',
    orange: 'bg-orange-400/10 text-orange-400 border-orange-400/10',
    rose: 'bg-rose-400/10 text-rose-400 border-rose-400/10',
    cyan: 'bg-cyan-400/10 text-cyan-400 border-cyan-400/10',
  };

  return (
    <div className="bg-[#1a1a1a] border border-zinc-800 rounded-[32px] p-6 shadow-xl group hover:border-[#ff5351]/30 transition-all">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform", colors[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.15em] mb-1">{label}</p>
      <h3 className="text-3xl font-black text-white italic">{value}</h3>
    </div>
  );
}

function TodayTasks({ tasks, navigate }: any) {
  const getPriorityBadge = (p: string) => {
    const colors: any = { 
      alta: 'bg-red-500/10 text-red-400 border-red-500/20', 
      media: 'bg-amber-500/10 text-amber-400 border-amber-500/20', 
      baixa: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
    };
    return <span className={cn("px-2 py-0.5 border rounded text-[8px] font-black uppercase tracking-widest", colors[p])}>{p}</span>;
  };

  return (
    <section className="bg-[#1a1a1a] border border-zinc-800 rounded-[32px] overflow-hidden shadow-xl">
      <div className="p-8 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#ff5351]/10 rounded-lg">
            <Clock className="w-4 h-4 text-[#ff5351]" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight italic">Tarefas Diárias</h2>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Atividades com prazo para hoje</p>
          </div>
        </div>
        <button 
          onClick={() => navigate('/tarefas')} 
          className="px-4 py-2 border border-zinc-700 hover:border-[#ff5351] rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all flex items-center gap-2"
        >
          Ver Todas <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="p-4 space-y-2">
        {tasks.length === 0 ? (
          <div className="py-10 text-center text-zinc-600 italic text-sm font-medium">
            Nenhuma tarefa urgente para hoje.
          </div>
        ) : (
          tasks.map((task: any) => (
            <div 
              key={task.id} 
              onClick={() => navigate('/tarefas')}
              className="flex items-center justify-between p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl hover:border-[#ff5351]/30 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-1.5 h-1.5 rounded-full bg-[#ff5351]" />
                <p className="text-white text-sm font-bold uppercase">{task.nome}</p>
              </div>
              {getPriorityBadge(task.prioridade)}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
