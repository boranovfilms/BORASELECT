import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Calendar, Palette, Mail, PenLine, 
  Mic, Camera, Video, Music, Plus, Loader2 
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

  useEffect(() => {
    async function loadClient() {
      if (!clientId) return;
      try {
        const docRef = doc(db, 'clients', clientId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setClientName(docSnap.data().name || '');
        }
      } catch (error) {
        console.error('Erro ao carregar cliente:', error);
      } finally {
        setLoading(false);
      }
    }
    loadClient();
  }, [clientId]);

  const handleAction = (route?: string, tipo?: string) => {
    if (!route) {
      toast.success('Em breve! 🚀');
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
            />
            <DemandCard 
              icon={Palette} 
              title="Criar arte" 
              desc="Post, story, banner ou peça avulsa." 
              onClick={() => handleAction()}
            />
            <DemandCard 
              icon={Mail} 
              title="Criar e-mail" 
              desc="Campanha de e-mail marketing." 
              badge="NOVO"
              onClick={() => handleAction()}
            />
            <DemandCard 
              icon={PenLine} 
              title="Assinatura de e-mail" 
              desc="Crie ou atualize a assinatura profissional." 
              onClick={() => handleAction()}
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
            />
            <DemandCard 
              icon={Camera} 
              title="Ensaio fotográfico" 
              desc="Agendamento e gestão do ensaio." 
              onClick={() => handleAction()}
            />
            <DemandCard 
              icon={Video} 
              title="Vídeo institucional" 
              desc="Fluxo completo de produção." 
              onClick={() => handleAction()}
            />
            <DemandCard 
              icon={Music} 
              title="Vídeo clipe" 
              desc="Produção completa de vídeo clipe." 
              onClick={() => handleAction()}
            />
            <PlusCard />
          </div>
        </section>
      </div>
    </div>
  );
}

function DemandCard({ icon: Icon, title, desc, onClick, badge }: any) {
  return (
    <button
      onClick={onClick}
      className="group p-6 bg-[#1f1f1f] border border-zinc-800 rounded-3xl hover:border-[#ff5351] transition-all text-left relative overflow-hidden"
    >
      {badge && (
        <span className="absolute top-4 right-4 bg-[#ff5351] text-white text-[8px] font-black px-2 py-0.5 rounded-full tracking-widest">
          {badge}
        </span>
      )}
      <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
        <Icon className="w-6 h-6 text-[#ff5351]" />
      </div>
      <h3 className="text-white font-black uppercase text-sm leading-tight mb-2">
        {title}
      </h3>
      <p className="text-zinc-500 text-xs leading-relaxed font-medium">
        {desc}
      </p>
    </button>
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
