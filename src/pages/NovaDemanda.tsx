import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Calendar, Palette, Mail, PenLine, 
  Mic, Camera, Video, Music, Plus, Loader2, Settings
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cn } from '../lib/utils';

export default function NovaDemanda() {
  const { id: clientId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clientName, setClientName] = useState('');
  const [clientWorkflowModels, setClientWorkflowModels] = useState<Record<string, string | null>>({});

  useEffect(() => {
    async function loadClient() {
      if (!clientId) return;
      try {
        const docRef = doc(db, 'clientes', clientId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const cData = docSnap.data();
          setClientName(cData.name || '');
          setClientWorkflowModels(cData.workflowModels || {});
        }
      } catch (error) {
        console.error('Erro ao carregar cliente:', error);
      } finally {
        setLoading(false);
      }
    }
    loadClient();
  }, [clientId]);

  const hasFlow = (tipo: string) => !!clientWorkflowModels[tipo];

  const handleGear = (e: React.MouseEvent, tipo: string) => {
    e.stopPropagation();
    navigate(`/clients/${clientId}/configurar-fluxo/${tipo}`);
  };

  const handleAction = (route?: string, tipo?: string) => {
    if (!route) {
      toast('Em breve! 🚀');
      return;
    }
    if (tipo && !hasFlow(tipo)) {
      toast.error('Nenhum fluxo configurado. Clique na engrenagem para configurar.');
      return;
    }
    const tipoParam = tipo ? `?tipo=${tipo}` : '';
    navigate(`/clients/${clientId}/${route}${tipoParam}`);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#ff5351] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-20 text-left">
      <header className="space-y-4">
        <button 
          onClick={() => navigate(`/clients/${clientId}`)}
          className="flex items-center gap-2 text-[#ff5351] hover:opacity-80 transition-all text-xs font-black uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para o Cliente
        </button>
        <div>
          <p className="text-[#ff5351] text-xs font-black uppercase tracking-[0.2em] mb-2">
            {clientName.toUpperCase()} • NOVA DEMANDA
          </p>
          <h1 className="text-5xl font-black text-white uppercase italic tracking-tight leading-none">
            O que deseja criar?
          </h1>
          <p className="text-zinc-500 text-lg mt-4">
            Selecione o tipo de demanda para iniciar o fluxo.
          </p>
        </div>
      </header>

      <div className="space-y-16">
        {/* GRUPO 1 */}
        <section className="space-y-6">
          <h2 className="text-zinc-600 text-xs font-black uppercase tracking-[0.3em] flex items-center gap-4">
            CONTEÚDO E PLANEJAMENTO
            <div className="h-px bg-zinc-800 flex-1" />
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <DemandCard 
              icon={Calendar} 
              title="Planejamento de conteúdo" 
              desc="Planejamento mensal completo com posts e reels." 
              onClick={() => handleAction('novo-planejamento', 'planejamento')}
              hasFlow={hasFlow('planejamento')}
              onGear={(e) => handleGear(e, 'planejamento')}
            />
            <DemandCard 
              icon={Palette} 
              title="Criar arte" 
              desc="Post, story, banner ou peça avulsa." 
              onClick={() => handleAction()}
              hasFlow={hasFlow('arte')}
              onGear={(e) => handleGear(e, 'arte')}
            />
            <DemandCard 
              icon={Mail} 
              title="Criar e-mail" 
              desc="Campanha de e-mail marketing." 
              badge="NOVO"
              onClick={() => handleAction()}
              hasFlow={hasFlow('email_marketing')}
              onGear={(e) => handleGear(e, 'email_marketing')}
            />
            <DemandCard 
              icon={PenLine} 
              title="Assinatura de e-mail" 
              desc="Crie ou atualize a assinatura profissional." 
              onClick={() => handleAction()}
              hasFlow={hasFlow('assinatura_email')}
              onGear={(e) => handleGear(e, 'assinatura_email')}
            />
            <PlusCard />
          </div>
        </section>

        {/* GRUPO 2 */}
        <section className="space-y-6">
          <h2 className="text-zinc-600 text-xs font-black uppercase tracking-[0.3em] flex items-center gap-4">
            PRODUÇÃO AUDIOVISUAL
            <div className="h-px bg-zinc-800 flex-1" />
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <DemandCard 
              icon={Mic} 
              title="Podcast" 
              desc="Gravação e seleção de cortes." 
              onClick={() => handleAction('novo-projeto', 'podcast')}
              hasFlow={hasFlow('podcast')}
              onGear={(e) => handleGear(e, 'podcast')}
            />
            <DemandCard 
              icon={Camera} 
              title="Ensaio fotográfico" 
              desc="Agendamento e gestão do ensaio." 
              onClick={() => handleAction()}
              hasFlow={hasFlow('ensaio_fotografico')}
              onGear={(e) => handleGear(e, 'ensaio_fotografico')}
            />
            <DemandCard 
              icon={Video} 
              title="Vídeo institucional" 
              desc="Fluxo completo de produção." 
              onClick={() => handleAction()}
              hasFlow={hasFlow('video_institucional')}
              onGear={(e) => handleGear(e, 'video_institucional')}
            />
            <DemandCard 
              icon={Music} 
              title="Vídeo clipe" 
              desc="Produção completa de vídeo clipe." 
              onClick={() => handleAction()}
              hasFlow={hasFlow('video_clipe')}
              onGear={(e) => handleGear(e, 'video_clipe')}
            />
            <PlusCard />
          </div>
        </section>
      </div>
    </div>
  );
}

function DemandCard({ icon: Icon, title, desc, onClick, badge, hasFlow, onGear }: any) {
  return (
    <div className={cn(
      "group relative bg-[#1f1f1f] border border-zinc-800 rounded-3xl p-6 transition-all",
      hasFlow ? "hover:border-[#ff5351] cursor-pointer" : "opacity-60"
    )}>
      {badge && (
        <span className="absolute top-4 right-10 bg-[#ff5351] text-white text-[8px] font-black px-2 py-0.5 rounded-full tracking-widest">
          {badge}
        </span>
      )}
      <button
        onClick={onGear}
        className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center hover:border-[#ff5351] hover:bg-[#ff5351] transition-all z-10"
        title="Configurar fluxo"
      >
        <Settings className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white" />
      </button>
      <div onClick={onClick} className="h-full">
        <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
          <Icon className="w-6 h-6 text-[#ff5351]" />
        </div>
        <h3 className="text-white font-black uppercase text-sm leading-tight mb-2">{title}</h3>
        <p className="text-zinc-500 text-xs leading-relaxed font-medium mb-8">{desc}</p>
        <div className="absolute bottom-4 right-4 flex items-center gap-1.5">
          <div className={cn("w-1.5 h-1.5 rounded-full", hasFlow ? "bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" : "bg-zinc-700")} />
          <span className={cn("text-[8px] font-black uppercase tracking-widest", hasFlow ? "text-emerald-500" : "text-zinc-600")}>
            {hasFlow ? "Fluxo Configurado" : "Sem Fluxo"}
          </span>
        </div>
      </div>
    </div>
  );
}

function PlusCard() {
  return (
    <div className="p-6 border-2 border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center gap-3 opacity-40">
      <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center">
        <Plus className="w-5 h-5 text-zinc-600" />
      </div>
      <span className="text-zinc-600 text-[10px] font-black uppercase tracking-widest text-center">Sugerir Tipo</span>
    </div>
  );
}
