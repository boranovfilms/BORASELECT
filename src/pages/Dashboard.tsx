export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Library, CheckSquare, ArrowRight, Loader2, Shield, Clock, CheckCircle2, Wallet, Bell, Building
} from 'lucide-react';
import { cn } from '../lib/utils';
import { auth, db } from '../lib/firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('cliente');
  const [userData, setUserData] = useState<any>(null);
  
  // Métricas Admin
  const [adminMetrics, setAdminMetrics] = useState({
    activeClients: 0,
    pendingClients: 0,
    activeProjects: 0,
    completedProjects: 0,
    pendingTasks: 0,
    awaitingApproval: 0,
    totalCredits: 0
  });

  // Métricas Cliente
  const [clientMetrics, setClientMetrics] = useState({
    myProjects: 0,
    completed: 0,
    myTasks: 0
  });

  const [todayTasks, setTodayTasks] = useState<any[]>([]);

  useEffect(() => {
    loadUserAndInit();
  }, []);

  const loadUserAndInit = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      let role = 'cliente';
      const cleanEmail = user.email?.toLowerCase().trim();

      if (cleanEmail === 'admin@boraselect.com.br') {
        role = 'master';
      } else {
        const q = query(collection(db, 'clients'), where('email', '==', cleanEmail));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const data = snap.docs[0].data();
          role = data.role || 'cliente';
          setUserData(data);
        }
      }
      setUserRole(role);
      initListeners(role, cleanEmail || '');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const initListeners = (role: string, email: string) => {
    const isAdmin = ['master', 'admin', 'editor'].includes(role);
    const today = new Date().toISOString().split('T')[0];

    if (isAdmin) {
      // Listener para Clientes
      onSnapshot(collection(db, 'clients'), (snap) => {
        const docs = snap.docs.map(d => d.data());
        setAdminMetrics(prev => ({
          ...prev,
          activeClients: docs.filter(d => d.role === 'cliente' && d.status === 'confirmed').length,
          pendingClients: docs.filter(d => d.role === 'cliente' && d.status === 'pending').length
        }));
      });

      // Listener para Projetos
      onSnapshot(collection(db, 'projects'), (snap) => {
        const docs = snap.docs.map(d => d.data());
        setAdminMetrics(prev => ({
          ...prev,
          activeProjects: docs.filter(d => d.status !== 'concluido').length,
          completedProjects: docs.filter(d => d.status === 'concluido').length
        }));
      });

      // Listener para Tarefas
      onSnapshot(collection(db, 'tasks'), (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAdminMetrics(prev => ({
          ...prev,
          pendingTasks: docs.filter(d => d.status === 'pendente').length,
          awaitingApproval: docs.filter(d => d.aguardandoAprovacao === true).length
        }));
        setTodayTasks(docs.filter(d => d.dataLimite === today && d.status === 'pendente'));
      });
      
      // Listener para Créditos
      onSnapshot(collection(db, 'clients'), (snap) => {
        const docs = snap.docs.map(d => d.data());
        const total = docs.reduce((sum, d) => sum + (Number(d.creditsTotal) || 0), 0);
        setAdminMetrics(prev => ({ ...prev, totalCredits: total }));
      });

    } else {
      // MODO CLIENTE
      onSnapshot(query(collection(db, 'projects'), where('clientEmail', '==', email)), (snap) => {
        const docs = snap.docs.map(d => d.data());
        setClientMetrics(prev => ({
          ...prev,
          myProjects: docs.filter(d => d.status !== 'concluido').length,
          completed: docs.filter(d => d.status === 'concluido').length
        }));
      });

      onSnapshot(query(collection(db, 'tasks'), where('delegadoPara', '==', email)), (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setClientMetrics(prev => ({ ...prev, myTasks: docs.filter(d => d.status === 'pendente').length }));
        setTodayTasks(docs.filter(d => d.dataLimite === today && d.status === 'pendente'));
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

  const isAdminView = ['master', 'admin', 'editor'].includes(userRole);

  // --- LAYOUT ADMIN/MASTER ---
  if (isAdminView) {
    return (
      <div className="space-y-8 pb-20 animate-in fade-in duration-700">
        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#ff5351] mb-2">Visão Administrativa</p>
          <h1 className="text-5xl font-black text-white uppercase italic tracking-tighter">Dashboard</h1>
        </header>

        {adminMetrics.awaitingApproval > 0 && (
          <div className="bg-[#ff5351]/10 border border-[#ff5351]/20 rounded-3xl p-6 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#ff5351] flex items-center justify-center shadow-lg shadow-[#ff5351]/20">
                <Bell className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold uppercase italic">Atenção Master</h3>
                <p className="text-zinc-500 text-xs font-medium">Existem tarefas aguardando aprovação do cliente.</p>
              </div>
            </div>
            <div className="px-4 py-2 bg-[#ff5351] text-white text-xs font-black rounded-xl">{adminMetrics.awaitingApproval} PENDENTES</div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard label="Clientes Ativos" value={adminMetrics.activeClients} icon={Users} color="emerald" />
          <StatCard label="Clientes Inativos" value={adminMetrics.pendingClients} icon={UserPlus} color="amber" />
          <StatCard label="Projetos Ativos" value={adminMetrics.activeProjects} icon={Library} color="blue" />
          <StatCard label="Concluídos" value={adminMetrics.completedProjects} icon={CheckCircle2} color="indigo" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard label="Tarefas Pendentes" value={adminMetrics.pendingTasks} icon={CheckSquare} color="orange" />
          <StatCard label="Aguardando Aprovação" value={adminMetrics.awaitingApproval} icon={Clock} color="rose" />
          <StatCard label="Créditos em Conta" value={adminMetrics.totalCredits} icon={Wallet} color="cyan" />
        </div>

        <TodayTasks tasks={todayTasks} isAdmin={true} />
      </div>
    );
  }

  // --- LAYOUT CLIENTE ---
  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-[28px] bg-zinc-900 border border-zinc-800 p-2 flex items-center justify-center overflow-hidden shadow-2xl">
            {userData?.logoUrl ? <img src={userData.logoUrl} className="w-full h-full object-contain" /> : <Building className="w-8 h-8 text-zinc-700" />}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#ff5351] mb-1">Cockpit Boranov</p>
            <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter">{userData?.name || 'Cliente'}</h1>
            <div className="flex items-center gap-2 mt-2">
              <div className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[8px] font-black rounded-md uppercase">Conta Ativa</div>
            </div>
          </div>
        </div>
        <div className="bg-[#1a1a1a] border border-zinc-800 rounded-2xl px-6 py-4">
           <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1 text-center md:text-left">Seu Saldo</p>
           <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-[#ff5351]" />
              <span className="text-2xl font-black text-white italic">{userData?.creditsTotal || 0} CRÉDITOS</span>
           </div>
        </div>
      </header>

      <div className="bg-[linear-gradient(135deg,rgba(255,83,81,0.1),transparent)] border border-[#ff5351]/20 rounded-[40px] p-10 shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-black text-white uppercase italic leading-tight mb-2">Bem-vindo ao<br/>Cockpit Boranov</h2>
          <p className="text-zinc-400 text-sm max-w-sm">Acompanhe seus projetos em tempo real e aprove novos conteúdos com um clique.</p>
        </div>
        <Shield className="absolute -bottom-10 -right-10 w-48 h-48 text-[#ff5351]/5 rotate-12" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Meus Projetos" value={clientMetrics.myProjects} icon={Library} color="blue" />
        <StatCard label="Projetos Concluídos" value={clientMetrics.completed} icon={CheckCircle2} color="indigo" />
        <StatCard label="Minhas Tarefas" value={clientMetrics.myTasks} icon={CheckSquare} color="orange" />
      </div>

      <TodayTasks tasks={todayTasks} isAdmin={false} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button className="h-14 bg-white text-black rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-[#ff5351] hover:text-white transition-all shadow-xl flex items-center justify-center gap-3">Acessar Meus Projetos <ArrowRight className="w-4 h-4" /></button>
        <button className="h-14 bg-zinc-900 border border-zinc-800 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-zinc-800 transition-all flex items-center justify-center gap-3">Ver Todas as Tarefas</button>
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
    cyan: 'bg-cyan-400/10 text-cyan-400 border-cyan-400/10'
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

function TodayTasks({ tasks, isAdmin }: any) {
  const getPriorityBadge = (p: string) => {
    const colors: any = { alta: 'bg-red-500/10 text-red-400 border-red-500/20', media: 'bg-amber-500/10 text-amber-400 border-amber-500/20', baixa: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    return <span className={cn("px-2 py-0.5 border rounded text-[8px] font-black uppercase tracking-widest", colors[p])}>{p}</span>;
  };

  return (
    <section className="bg-[#1a1a1a] border border-zinc-800 rounded-[32px] overflow-hidden shadow-xl">
      <div className="p-8 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#ff5351]/10 rounded-lg"><Clock className="w-4 h-4 text-[#ff5351]" /></div>
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight italic">Tarefas do Dia</h2>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Atividades com prazo para hoje</p>
          </div>
        </div>
        <button className="px-4 py-2 border border-zinc-700 hover:border-[#ff5351] rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all flex items-center gap-2">Ver Todas <ArrowRight className="w-3 h-3" /></button>
      </div>

      <div className="p-4 space-y-2">
        {tasks.length === 0 ? (
          <div className="py-10 text-center text-zinc-600 italic text-sm font-medium">Nenhuma tarefa urgente para hoje.</div>
        ) : (
          tasks.map((task: any) => (
            <div key={task.id} className="flex items-center justify-between p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl hover:border-[#ff5351]/30 transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-1.5 h-1.5 rounded-full bg-[#ff5351] shadow-[0_0_8px_#ff5351]" />
                <div>
                  <p className="text-white text-sm font-bold uppercase group-hover:text-[#ff5351] transition-colors">{task.nome}</p>
                  <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest">{isAdmin ? task.responsavelTarefa : 'Equipe Boranov'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {getPriorityBadge(task.prioridade)}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
