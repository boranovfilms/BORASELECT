import { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Calendar, Image as ImageIcon, Link as LinkIcon, 
  LayoutGrid, CheckCircle2, Trash2, GitBranch, User, Filter, X, ChevronDown, Search, FileText, Clock, ChevronRight, Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { projectService, Project } from '../services/projectService';
import { clientService, Client } from '../services/clientService';
import { contentPlanService } from '../services/contentPlanService';
import { auth, db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import NewProjectModal from '../components/NewProjectModal';
import { DataTable } from '../components/ui/DataTable';

export default function Projetos() {
  const [adminProjects, setAdminProjects] = useState<Project[]>([]);
  const [unifiedItems, setUnifiedItems] = useState<any[]>([]); 
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClientEmail, setSelectedClientEmail] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [userRole, setUserRole] = useState<string>('cliente');
  
  const navigate = useNavigate();

  useEffect(() => {
    checkUserRoleAndLoad();
  }, []);

  const checkUserRoleAndLoad = async () => {
    setLoading(true);
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      const cleanEmail = currentUser.email?.toLowerCase().trim();
      
      // REGRA DE IDENTIFICAÇÃO DE ROLE IGUAL AO APP.TSX
      let role = 'cliente';
      if (cleanEmail === 'admin@boraselect.com.br') {
        role = 'master';
      } else {
        const q = query(collection(db, 'clientes'), where('email', '==', cleanEmail));
        const snap = await getDocs(q);
        if (!snap.empty) {
          role = snap.docs[0].data().role || 'cliente';
        }
      }
      setUserRole(role);

      const isInternal = ['master', 'admin', 'editor', 'designer', 'redator', 'midia_social'].includes(role);

      if (isInternal) {
        const [adminData, allClients] = await Promise.all([
          projectService.getProjects().catch(() => []),
          clientService.searchClients('').catch(() => [])
        ]);
        setAdminProjects(adminData);
        setClients(allClients);
      } else {
        const [clientProjects, clientPlans] = await Promise.all([
          projectService.getProjectsForClient().catch(() => []),
          contentPlanService.getPlansByClientEmail(currentUser.email!)
        ]);

        const unified = [
          ...clientProjects.map(p => ({
            id: p.id,
            name: p.title,
            type: p.category === 'Fotos' ? 'Fotos' : 'Podcast',
            status: p.status,
            updatedAt: p.updatedAt,
            raw: p,
            route: `/review/${p.id}`
          })),
          ...clientPlans
            .filter(p => p.status !== 'rascunho')
            .map(p => ({
              id: p.id,
              name: p.name,
              type: 'Planejamento',
              status: p.status,
              updatedAt: p.updatedAt,
              raw: p,
              route: `/planejamento/${p.id}`
            }))
        ];
        setUnifiedItems(unified);
      }

    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  };

  const copyClientLink = (e: any, projectId: string) => {
    e.stopPropagation();
    const link = `${window.location.origin}/review/${projectId}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
  };

  const handleDeleteProject = async (e: any, projectId: string) => {
    e.stopPropagation();
    if (window.confirm('Excluir este projeto?')) {
      try {
        await projectService.deleteProject(projectId);
        toast.success('Excluído!');
        checkUserRoleAndLoad();
      } catch (error) {
        toast.error('Erro ao excluir.');
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Em Seleção': return 'text-[#ff5351] border-[#ff5351] bg-[#ff5351]/10';
      case 'Finalizado': case 'concluido': return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
      case 'Aguardando Cliente': case 'aguardando_cliente': return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
      case 'aprovado': return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
      case 'em_revisao': return 'text-red-400 border-red-500/30 bg-red-500/10';
      case 'em_producao': return 'text-violet-400 border-violet-500/30 bg-violet-500/10';
      case 'devolvido': return 'text-red-400 border-red-500/30 bg-red-500/10';
      case 'aguardando_validacao_equipe': return 'text-violet-400 border-violet-500/30 bg-violet-500/10';
      case 'aprovado_equipe': return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
      case 'rascunho': return 'text-zinc-400 border-zinc-700 bg-zinc-800/50';
      default: return 'text-zinc-500 border-zinc-700 bg-zinc-800/50';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'aguardando_cliente': 'Aguardando sua aprovação',
      'aguardando_validacao_equipe': 'Aguardando Equipe',
      'aprovado': 'Aprovado',
      'aprovado_equipe': 'Aprovado ✓',
      'em_revisao': 'Em Revisão',
      'em_producao': 'Em Produção',
      'concluido': 'Concluído ✓',
      'devolvido': 'Em correção',
      'rascunho': 'Rascunho',
      'Em Seleção': 'Em Seleção',
      'Finalizado': 'Finalizado',
      'Aguardando Cliente': 'Aguardando Cliente'
    };
    return labels[status] || status.replace(/_/g, ' ');
  };

  const getTypeBadge = (type: string) => {
    const configs: any = {
      'Planejamento': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      'Podcast': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      'Fotos': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    };
    return <span className={cn("px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-widest", configs[type])}>{type}</span>;
  };

  const isInternal = ['master', 'admin', 'editor', 'designer', 'redator', 'midia_social'].includes(userRole);
  const isEquipe = userRole === 'equipe';
  const isCliente = userRole === 'cliente';

  const filteredAdminProjects = useMemo(() => {
    return adminProjects.filter(p => {
      const matchClient = !selectedClientEmail || p.clientEmail?.toLowerCase() === selectedClientEmail.toLowerCase();
      const matchSearch = !searchTerm || p.title?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchClient && matchSearch;
    });
  }, [adminProjects, selectedClientEmail, searchTerm]);

  const filteredClientItems = useMemo(() => {
    return unifiedItems.filter(item => {
      const matchType = selectedType === 'todos' || item.type === selectedType;
      const matchSearch = !searchTerm || item.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchType && matchSearch;
    });
  }, [unifiedItems, selectedType, searchTerm]);

  // Renderiza coluna de progresso para visão cliente
  const renderProgresso = (item: any) => {
    const status = item.status;
    
    if (status === 'em_producao') {
      const faseAtual = 'EDIÇÃO';
      const porcentagem = 65;
      return (
        <div className="text-left min-w-[120px]">
          <p className="text-[9px] font-black uppercase tracking-widest text-[#ff5351] mb-1">FASE ATUAL: {faseAtual}</p>
          <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-[#ff5351] rounded-full transition-all duration-500" style={{ width: `${porcentagem}%` }} />
          </div>
          <p className="text-[9px] font-black text-zinc-500 mt-1">{porcentagem}%</p>
        </div>
      );
    }
    
    if (status === 'concluido') {
      return (
        <div className="text-left min-w-[120px]">
          <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
          </div>
          <p className="text-[9px] font-black text-emerald-500 mt-1 uppercase tracking-widest">CONCLUÍDO</p>
        </div>
      );
    }
    
    if (status === 'aprovado' || status === 'aprovado_equipe') {
      return <span className="text-zinc-600 text-sm">—</span>;
    }
    
    return <span className="text-zinc-600 text-sm">—</span>;
  };

  // Badge de status para cliente
  const renderClienteStatusBadge = (status: string) => {
    const isPulsing = status === 'aguardando_cliente';
    return (
      <div className="flex items-center justify-center gap-2">
        {isPulsing && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
        )}
        <span className={cn("px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest", getStatusColor(status))}>
          {getStatusLabel(status)}
        </span>
      </div>
    );
  };

  // Badge de status para visão da equipe do cliente
  const renderEquipeStatusBadge = (status: string) => {
    if (status === 'aguardando_cliente' || status === 'rascunho') {
      return (
        <div className="flex items-center justify-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <span className="px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest text-amber-400 border-amber-500/30 bg-amber-500/10">
            ⚠ Aguardando aprovação do responsável
          </span>
        </div>
      );
    }
    
    if (status === 'devolvido') {
      return (
        <span className="px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest text-zinc-400 border-zinc-700 bg-zinc-800/50">
          🔄 Em correção pelo redator
        </span>
      );
    }
    
    if (status === 'aguardando_validacao_equipe') {
      return (
        <div className="flex items-center justify-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
          </span>
          <span className="px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest text-violet-400 border-violet-500/30 bg-violet-500/10">
            Aguardando sua validação
          </span>
        </div>
      );
    }
    
    if (status === 'aprovado_equipe' || status === 'em_producao' || status === 'concluido') {
      return renderClienteStatusBadge(status);
    }
    
    return renderClienteStatusBadge(status);
  };

  // Handler de clique na linha para visão da equipe
  const handleEquipeRowClick = (item: any) => {
    if (item.type !== 'Planejamento') return navigate(item.route);
    if (item.status === 'aguardando_validacao_equipe') return navigate(item.route);
    if (item.status === 'aprovado_equipe' || item.status === 'em_producao' || item.status === 'concluido') {
      return navigate(`/planejamento/${item.id}?modo=visualizar`);
    }
    return undefined;
  };

  // Handler de clique na linha para visão do cliente
  const handleClienteRowClick = (item: any) => {
    if (item.type !== 'Planejamento') return navigate(item.route);
    if (item.status === 'aguardando_cliente') return navigate(item.route);
    if (item.status === 'aprovado_equipe' || item.status === 'em_producao' || item.status === 'concluido') {
      return navigate(`/planejamento/${item.id}?modo=visualizar`);
    }
    return undefined;
  };

  if (isModalOpen) {
    return <NewProjectModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={checkUserRoleAndLoad} />;
  }

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-bold tracking-tight text-white mb-2 uppercase italic font-black">
            {isInternal ? 'Projeto Seleção' : 'Minhas Entregas'}
          </h1>
          <p className="text-zinc-500 text-lg">
            {isInternal ? 'Gerencie os projetos de seleção de podcast e fotos.' : 'Acompanhe seus materiais em um só lugar.'}
          </p>
        </div>
        {isInternal && (
          <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-[#ff5351] text-white px-8 py-3.5 rounded-xl font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-[#ff5351]/20 active:scale-95 text-xs">
            <Plus className="w-5 h-5" /> Novo Projeto
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-500">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Buscar por nome..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-zinc-800 rounded-2xl pl-12 pr-4 py-4 text-white focus:border-[#ff5351] outline-none shadow-xl text-sm transition-all"
          />
        </div>

        {isInternal ? (
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
              <User className={cn("w-4 h-4 transition-colors", selectedClientEmail ? "text-[#ff5351]" : "text-zinc-500")} />
            </div>
            <select 
              value={selectedClientEmail || ''} 
              onChange={e => setSelectedClientEmail(e.target.value || null)}
              className="w-full bg-[#1a1a1a] border border-zinc-800 rounded-2xl pl-12 pr-10 py-4 text-white focus:border-[#ff5351] outline-none appearance-none cursor-pointer text-sm shadow-xl"
            >
              <option value="">Todos os clientes</option>
              {clients.map(client => (
                <option key={client.id} value={client.email}>{client.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
          </div>
        ) : (
          <div className="flex bg-[#1a1a1a] border border-zinc-800 rounded-2xl p-1 shadow-xl">
            {['todos', 'Planejamento', 'Podcast', 'Fotos'].map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={cn(
                  "flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  selectedType === type ? "bg-[#ff5351] text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {type === 'todos' ? 'Tudo' : type}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-10">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((item) => <div key={item} className="aspect-[4/3] bg-zinc-900/50 rounded-2xl animate-pulse border border-zinc-800" />)}
          </div>
        ) : isInternal ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredAdminProjects.map((project) => (
              <article key={project.id} onClick={() => navigate(`/projects/${project.id}/config`)} className="group relative bg-[#1f1f1f] rounded-3xl border border-zinc-800 overflow-hidden hover:border-[#ff5351]/30 transition-all cursor-pointer flex flex-col h-full shadow-2xl">
                <div className="absolute top-4 right-4 z-20 flex gap-2">
                  <button onClick={(e) => handleDeleteProject(e, project.id!)} className="p-2 bg-black/60 backdrop-blur-md border border-zinc-800 rounded-xl text-zinc-400 hover:text-white hover:bg-red-500/50 transition-all shadow-lg"><Trash2 className="w-4 h-4" /></button>
                  <button onClick={(e) => copyClientLink(e, project.id!)} className="p-2 bg-black/60 backdrop-blur-md border border-zinc-800 rounded-xl text-zinc-300 hover:text-[#ff5351] transition-all shadow-lg"><LinkIcon className="w-4 h-4" /></button>
                  <button onClick={(e) => { e.stopPropagation(); navigate(`/projetos/${project.id}/fluxo`); }} className="px-3 py-1 bg-black/60 backdrop-blur-md border border-zinc-800 rounded-xl text-[10px] uppercase font-black tracking-widest text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center gap-1.5 shadow-lg"><GitBranch className="w-3.5 h-3.5" />Fluxo</button>
                </div>
                <div className="relative h-48 overflow-hidden bg-zinc-900">
                  <img src={project.coverImage} alt={project.title} className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-all duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1f1f1f] via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-6 flex flex-wrap gap-2">
                    <span className="px-2.5 py-1 bg-black/60 backdrop-blur-md border border-zinc-800 rounded-lg text-[9px] uppercase font-black tracking-widest text-zinc-300">{project.category}</span>
                    <span className={cn('px-2.5 py-1 border rounded-lg text-[9px] uppercase font-black tracking-widest', getStatusColor(project.status))}>{project.status}</span>
                  </div>
                </div>
                <div className="p-6 flex flex-col flex-1 text-left">
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-white truncate mb-2">{project.title}</h3>
                    <div className="flex items-center gap-2 text-zinc-500">
                      <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center"><User className="w-3 h-3 text-[#ff5351]" /></div>
                      <span className="text-[10px] font-black uppercase tracking-widest truncate">{project.clientName || project.clientEmail}</span>
                    </div>
                  </div>
                  <div className="mt-auto space-y-4 pt-4 border-t border-zinc-800/50">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                      <div className="flex items-center gap-2 text-zinc-500"><Calendar className="w-3.5 h-3.5 text-zinc-600" />{project.deliveryDate ? format(project.deliveryDate.toDate(), 'dd MMM') : '-'}</div>
                      <div className="flex items-center gap-2 text-[#ff5351]"><ImageIcon className="w-3.5 h-3.5 opacity-60" />{project.progress}%</div>
                    </div>
                    <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden shadow-inner"><div className="h-full bg-[#ff5351] transition-all duration-1000 shadow-[0_0_8px_rgba(255,83,81,0.4)]" style={{ width: `${project.progress}%` }} /></div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <DataTable 
            data={filteredClientItems}
            onRowClick={isEquipe ? handleEquipeRowClick : handleClienteRowClick}
            emptyMessage="Nenhuma entrega encontrada."
            columns={[
              {
                header: 'Nome do Item',
                accessor: (item) => (
                  <div className="flex items-center gap-3 py-1 text-left">
                    <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl">
                      {item.type === 'Planejamento' ? <FileText className="w-4 h-4 text-[#ff5351]" /> : <LayoutGrid className="w-4 h-4 text-[#ff5351]" />}
                    </div>
                    <span className="text-white font-black uppercase text-sm">{item.name}</span>
                  </div>
                )
              },
              { header: 'Tipo', accessor: (item) => getTypeBadge(item.type), align: 'center' },
              { header: 'Status', accessor: (item) => isEquipe ? renderEquipeStatusBadge(item.status) : renderClienteStatusBadge(item.status), align: 'center' },
              { 
                header: 'Progresso', 
                accessor: (item) => renderProgresso(item),
                align: 'center'
              },
              {
                header: 'Última Atualização',
                accessor: (item) => {
                  const date = item.updatedAt?.toDate ? item.updatedAt.toDate() : new Date(item.updatedAt);
                  return (
                    <div className="flex items-center gap-2 text-zinc-500 text-xs font-mono uppercase">
                      <Clock className="w-3.5 h-3.5" />
                      {new Intl.DateTimeFormat('pt-BR').format(date)}
                    </div>
                  );
                }
              }
            ]}
          />
        )}
      </div>
    </div>
  );
}
