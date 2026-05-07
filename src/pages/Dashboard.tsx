export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { Plus, Calendar, Image as ImageIcon, Link as LinkIcon, MoreVertical, LayoutGrid, CheckCircle2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { projectService, Project } from '../services/projectService';
import { auth } from '../lib/firebase';
import NewProjectModal from '../components/NewProjectModal';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

export default function Dashboard() {
  const [adminProjects, setAdminProjects] = useState<Project[]>([]);
  const [clientProjects, setClientProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    const currentUserEmail = auth.currentUser?.email;
    console.log('Loading projects for user:', currentUserEmail);
    
    try {
      // Separating calls to identify failures
      let adminData: Project[] = [];
      let clientData: Project[] = [];

      try {
        adminData = await projectService.getProjects();
        console.log('Admin projects fetch success:', adminData.length);
      } catch (adminErr) {
        console.error('Admin projects fetch failed:', adminErr);
        // We don't toast strictly here if they are just a client
      }

      try {
        clientData = await projectService.getProjectsForClient();
        console.log('Client projects fetch success:', clientData.length);
      } catch (clientErr) {
        console.error('Client projects fetch failed:', clientErr);
        if (currentUserEmail && currentUserEmail !== 'boranovfilms@gmail.com') {
          toast.error('Erro de permissão ao carregar seus projetos de cliente.');
        }
      }

      setAdminProjects(adminData);
      setClientProjects(clientData);
    } catch (error) {
      console.error('Unexpected error loading projects:', error);
      toast.error('Erro ao carregar projetos.');
    } finally {
      setLoading(false);
    }
  };

  const copyClientLink = (e: any, projectId: string) => {
    e.stopPropagation();
    const link = `${window.location.origin}/review/${projectId}`;
    navigator.clipboard.writeText(link);
    toast.success('Link da vitrine copiado!');
  };

  const handleDeleteProject = async (e: any, projectId: string) => {
    e.stopPropagation();
    if (window.confirm('Tem certeza que deseja excluir permanentemente este projeto? Esta ação não pode ser desfeita.')) {
      try {
        await projectService.deleteProject(projectId);
        toast.success('Projeto excluído com sucesso!');
        loadProjects();
      } catch (error) {
        toast.error('Erro ao excluir projeto.');
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Em Seleção': return 'text-[#ff5351] border-[#ff5351] bg-[#ff5351]/10';
      case 'Finalizado': return 'text-zinc-400 border-zinc-700 bg-zinc-800';
      case 'Aguardando Cliente': return 'text-cyan-400 border-cyan-800 bg-cyan-900/10';
      default: return 'text-zinc-500 border-zinc-700';
    }
  };

  const isAdminUser = auth.currentUser?.email === 'boranovfilms@gmail.com';
  const isOnlyClient = !isAdminUser;

  return (
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-bold tracking-tight text-white mb-4">
            {isOnlyClient ? 'Minhas Seleções' : 'Projetos'}
          </h1>
          <p className="text-zinc-500 text-lg">
            {isOnlyClient 
              ? 'Acesse os materiais compartilhados com você.' 
              : 'Gerencie e acompanhe o progresso das entregas.'}
          </p>
        </div>
        {!isOnlyClient && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-[#ff5351] text-white px-8 py-4 rounded-xl font-bold uppercase tracking-wider hover:opacity-90 transition-all shadow-lg shadow-[#ff5351]/20 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Novo Projeto
          </button>
        )}
      </header>

      <NewProjectModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadProjects}
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {[1,2,3].map(i => (
            <div key={i} className="aspect-[4/3] bg-zinc-900/50 rounded-2xl animate-pulse border border-zinc-800" />
          ))}
        </div>
      ) : (isAdminUser ? (adminProjects.length === 0 && clientProjects.length === 0) : (clientProjects.length === 0)) ? (
        <div className="flex flex-col items-center justify-center py-24 bg-zinc-900/20 rounded-3xl border-2 border-dashed border-zinc-800 animate-in fade-in zoom-in-95">
          <ImageIcon className="w-16 h-16 text-zinc-700 mb-6" />
          <p className="text-zinc-500 font-medium">
            {isOnlyClient 
              ? `Nenhuma seleção encontrada para ${auth.currentUser?.email}.` 
              : 'Nenhum projeto encontrado.'}
          </p>
          {isAdminUser && (
            <button onClick={() => setIsModalOpen(true)} className="mt-4 text-[#ff5351] font-bold hover:underline font-black uppercase tracking-widest text-xs">Criar primeiro projeto</button>
          )}
        </div>
      ) : (
        <div className="space-y-12">
          {/* Admin Projects Section */}
          {isAdminUser && adminProjects.length > 0 && (
            <div className="space-y-6">
              {clientProjects.length > 0 && (
                <h2 className="text-sm font-black uppercase tracking-[0.3em] text-zinc-600 border-b border-zinc-800 pb-4">Gerenciados por mim</h2>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {adminProjects.map((project) => (
                  <article 
                    key={project.id}
                    onClick={() => navigate(`/projects/${project.id}/config`)}
                    className="group relative bg-[#1f1f1f] rounded-2xl border border-zinc-800 overflow-hidden hover:border-zinc-700 transition-all cursor-pointer flex flex-col h-full"
                  >
                    {/* Badges & Actions */}
                    <div className="absolute top-4 right-4 z-20 flex gap-2">
                      <button 
                         onClick={(e) => handleDeleteProject(e, project.id!)}
                         className="p-2 bg-black/50 backdrop-blur-md border border-zinc-800 rounded-full text-zinc-400 hover:text-white hover:bg-red-500/50 hover:border-red-500/50 transition-all"
                         title="Excluir Projeto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={(e) => copyClientLink(e, project.id!)}
                        className="p-2 bg-black/50 backdrop-blur-md border border-zinc-800 rounded-full text-zinc-300 hover:text-[#ff5351] hover:border-[#ff5351]/50 transition-all"
                        title="Copiar Link da Vitrine"
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-3 py-1 bg-black/50 backdrop-blur-md border border-zinc-800 rounded-full text-[10px] uppercase font-black tracking-widest text-zinc-300">
                        {project.category}
                      </span>
                      <span className={cn(
                        "px-3 py-1 border rounded-full text-[10px] uppercase font-black tracking-widest",
                        getStatusColor(project.status)
                      )}>
                        {project.status}
                      </span>
                    </div>

                    {/* Cover Image */}
                    <div className="relative h-48 overflow-hidden bg-zinc-900">
                      <img 
                        src={project.coverImage} 
                        alt={project.title}
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1f1f1f] via-transparent to-transparent" />
                    </div>

                    {/* Content */}
                    <div className="p-6 flex flex-col flex-1">
                      <div className="mb-6">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h3 className="text-2xl font-bold text-white truncate">{project.title}</h3>
                          {project.clientStatus === 'confirmed' && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[10px] font-black tracking-tighter text-emerald-400 shrink-0">
                               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                               CLIENTE OK
                            </div>
                          )}
                        </div>
                        <p className="text-zinc-500 text-sm">Cliente: {project.clientName || project.clientEmail || 'SEM CLIENTE'}</p>
                      </div>

                      <div className="mt-auto space-y-4">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <div className="flex items-center gap-2 text-zinc-500">
                            <Calendar className="w-4 h-4" />
                            <span>{project.deliveryDate ? format(project.deliveryDate.toDate(), 'dd MMM') : 'Sem data'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[#ff5351]">
                            <ImageIcon className="w-4 h-4" />
                            <span>{project.progress}% Completo</span>
                          </div>
                        </div>

                        <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[#ff5351] transition-all duration-1000" 
                            style={{ width: `${project.progress}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* Client Projects Section */}
          {clientProjects.length > 0 && (
            <div className="space-y-6 pt-6">
              {!isOnlyClient && (
                <h2 className="text-sm font-black uppercase tracking-[0.3em] text-zinc-600 border-b border-zinc-800 pb-4">Compartilhados comigo</h2>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {clientProjects.map((project) => (
                  <article 
                    key={project.id}
                    onClick={() => navigate(`/review/${project.id}`)}
                    className="group relative bg-[#1f1f1f] rounded-2xl border border-zinc-800 overflow-hidden hover:border-[#ff5351]/50 transition-all cursor-pointer flex flex-col h-full ring-1 ring-inset ring-transparent hover:ring-[#ff5351]/20"
                  >
                    <div className="absolute top-4 right-4 z-20">
                      <span className="px-3 py-1 bg-[#ff5351] rounded-full text-[10px] uppercase font-black tracking-widest text-white shadow-lg shadow-[#ff5351]/20">
                        Pronto para Seleção
                      </span>
                    </div>

                    <div className="relative h-48 overflow-hidden bg-zinc-900 font-black">
                      <img 
                        src={project.coverImage} 
                        alt={project.title}
                        className="w-full h-full object-cover opacity-40 group-hover:opacity-60 group-hover:scale-105 transition-all duration-700 grayscale group-hover:grayscale-0"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1f1f1f] via-transparent to-transparent" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <div className="bg-white text-black px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest shadow-2xl">
                           Abrir Vitrine
                         </div>
                      </div>
                    </div>

                    <div className="p-6 flex flex-col flex-1">
                      <div className="mb-4">
                        <h3 className="text-2xl font-bold text-white truncate mb-1">{project.title}</h3>
                        <p className="text-zinc-500 text-xs font-black uppercase tracking-widest">Material Exclusivo</p>
                      </div>

                      <div className="mt-auto flex items-center justify-between">
                         <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold">
                           <LayoutGrid className="w-4 h-4" />
                           <span>Galeria de Seleção</span>
                         </div>
                         <div className="flex items-center gap-2 text-[#ff5351] text-xs font-bold">
                           <CheckCircle2 className="w-4 h-4" />
                           <span>{project.creditsUsed} / {project.creditsTotal} Créditos</span>
                         </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
