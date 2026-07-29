import React, { useState, useEffect } from 'react';
import { Search, MapPin, Phone, Globe, Star, TrendingUp, UserPlus, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cn } from '../lib/utils';

interface Lead {
  id?: string;
  placeId: string;
  nome: string;
  endereco: string;
  telefone: string;
  site: string;
  nota: number;
  totalAvaliacoes: number;
  tipo: string;
  score: number;
  classificacao: 'quente' | 'morno' | 'frio';
  status: 'novo' | 'contatado' | 'cliente';
  segmento: string;
  cidade: string;
  criadoEm?: any;
}

const calcularScore = (lead: Partial<Lead>): number => {
  let score = 0;
  if (lead.site) score += 20;
  if (lead.telefone) score += 15;
  if (lead.nota && lead.nota >= 4.5) score += 25;
  else if (lead.nota && lead.nota >= 4.0) score += 15;
  if (lead.totalAvaliacoes && lead.totalAvaliacoes >= 100) score += 30;
  else if (lead.totalAvaliacoes && lead.totalAvaliacoes >= 50) score += 20;
  else if (lead.totalAvaliacoes && lead.totalAvaliacoes >= 10) score += 10;
  return Math.min(score, 100);
};

const getClassificacao = (score: number): 'quente' | 'morno' | 'frio' => {
  if (score >= 80) return 'quente';
  if (score >= 50) return 'morno';
  return 'frio';
};

const RAIOS = [
  { label: '1 km', value: 1000 },
  { label: '2 km', value: 2000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
  { label: '25 km', value: 25000 },
  { label: '50 km', value: 50000 },
];

const LIMITE_MENSAL = 500;
const MES_KEY = `prospectar_count_${new Date().getFullYear()}_${new Date().getMonth()}`;

export default function Prospectar() {
  const [segmento, setSegmento] = useState('');
  const [cidade, setCidade] = useState('');
  const [raio, setRaio] = useState(10000);
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [salvos, setSalvos] = useState<Lead[]>([]);
  const [buscasUsadas, setBuscasUsadas] = useState(0);
  const [abaSelecionada, setAbaSelecionada] = useState<'buscar' | 'salvos'>('buscar');
  const [convertendo, setConvertendo] = useState<string | null>(null);

  useEffect(() => {
    const count = parseInt(localStorage.getItem(MES_KEY) || '0');
    setBuscasUsadas(count);
    loadLeadsSalvos();
  }, []);

  const loadLeadsSalvos = async () => {
    const snap = await getDocs(collection(db, 'prospects'));
    setSalvos(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Lead[]);
  };

  const incrementarContador = () => {
    const novoCount = buscasUsadas + 1;
    setBuscasUsadas(novoCount);
    localStorage.setItem(MES_KEY, String(novoCount));
  };

  const buscarEmpresas = async () => {
    if (!segmento.trim() || !cidade.trim()) {
      toast.error('Preencha o segmento e a cidade');
      return;
    }
    if (buscasUsadas >= LIMITE_MENSAL) {
      toast.error('Limite mensal de buscas atingido!');
      return;
    }

    setLoading(true);
    setLeads([]);

    try {
      // Primeiro geocodifica a cidade para obter lat/lng
      const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cidade)}&key=${import.meta.env.VITE_GOOGLE_PLACES_API_KEY}`;
const geoRes = await fetch(geoUrl);
const geoData = await geoRes.json();

console.log('GEO RESPONSE:', JSON.stringify(geoData));

if (!geoData.results || geoData.results.length === 0) {
  toast.error('Cidade não encontrada');
        setLoading(false);
        return;
      }

      const { lat, lng } = geoData.results[0].geometry.location;

      // Busca empresas via Places API (New)
      const placesUrl = `https://places.googleapis.com/v1/places:searchText`;
      const placesRes = await fetch(placesUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': import.meta.env.VITE_GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.primaryTypeDisplayName'
        },
        body: JSON.stringify({
          textQuery: `${segmento} em ${cidade}`,
          locationBias: {
            circle: {
              center: { latitude: lat, longitude: lng },
              radius: raio
            }
          },
          maxResultCount: 20,
          languageCode: 'pt-BR'
        })
      });

      const placesData = await placesRes.json();
      incrementarContador();

      if (!placesData.places || placesData.places.length === 0) {
        toast('Nenhuma empresa encontrada. Tente outro segmento ou cidade.');
        setLoading(false);
        return;
      }

      const resultados: Lead[] = placesData.places.map((place: any) => {
        const leadParcial = {
          placeId: place.id,
          nome: place.displayName?.text || 'Sem nome',
          endereco: place.formattedAddress || '',
          telefone: place.nationalPhoneNumber || '',
          site: place.websiteUri || '',
          nota: place.rating || 0,
          totalAvaliacoes: place.userRatingCount || 0,
          tipo: place.primaryTypeDisplayName?.text || '',
          segmento,
          cidade,
          status: 'novo' as const,
        };
        const score = calcularScore(leadParcial);
        return {
          ...leadParcial,
          score,
          classificacao: getClassificacao(score),
        };
      });

      // Ordena por score
      resultados.sort((a, b) => b.score - a.score);
      setLeads(resultados);
      toast.success(`${resultados.length} empresas encontradas!`);

    } catch (error: any) {
      console.error(error);
      toast.error('Erro ao buscar empresas. Verifique a API Key.');
    } finally {
      setLoading(false);
    }
  };

  const salvarLead = async (lead: Lead) => {
    try {
      // Verifica se já existe
      const existente = salvos.find(s => s.placeId === lead.placeId);
      if (existente) {
        toast('Lead já salvo!');
        return;
      }
      await addDoc(collection(db, 'prospects'), {
        ...lead,
        criadoEm: serverTimestamp()
      });
      toast.success('Lead salvo!');
      loadLeadsSalvos();
    } catch (error) {
      toast.error('Erro ao salvar lead');
    }
  };

  const converterEmCliente = async (lead: Lead) => {
    setConvertendo(lead.placeId);
    try {
      // Cria o cliente na coleção clientes
      await addDoc(collection(db, 'clientes'), {
        name: lead.nome,
        commercialName: lead.nome,
        email: '',
        phone: lead.telefone,
        website: lead.site,
        address: lead.endereco,
        role: 'cliente',
        status: 'confirmed',
        type: 'empresa',
        createdAt: serverTimestamp(),
        updatedAt: new Date().toISOString(),
        originLead: lead.placeId,
      });

      // Atualiza status no prospect se estiver salvo
      const existente = salvos.find(s => s.placeId === lead.placeId);
      if (existente?.id) {
        await updateDoc(doc(db, 'prospects', existente.id), { status: 'cliente' });
      }

      toast.success(`${lead.nome} convertido em cliente!`);
      loadLeadsSalvos();
    } catch (error) {
      toast.error('Erro ao converter em cliente');
    } finally {
      setConvertendo(null);
    }
  };

  const getClassificacaoConfig = (c: string) => {
    const configs: any = {
      quente: { label: '🔥 Lead Quente', class: 'bg-red-500/10 text-red-400 border-red-500/20' },
      morno: { label: '⚡ Lead Morno', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
      frio: { label: '❄️ Lead Frio', class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    };
    return configs[c] || configs.frio;
  };

  const pctBuscas = Math.round((buscasUsadas / LIMITE_MENSAL) * 100);

  const LeadCard = ({ lead, salvo = false }: { lead: Lead; salvo?: boolean }) => (
    <div className="bg-[#1f1f1f] border border-zinc-800 rounded-2xl p-5 space-y-4 hover:border-zinc-700 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-black uppercase text-sm line-clamp-1">{lead.nome}</h3>
          {lead.tipo && <p className="text-zinc-500 text-[10px] uppercase mt-0.5">{lead.tipo}</p>}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={cn('px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest', getClassificacaoConfig(lead.classificacao).class)}>
            {getClassificacaoConfig(lead.classificacao).label}
          </span>
          <span className="text-[10px] font-black text-[#ff5351]">{lead.score} pts</span>
        </div>
      </div>

      <div className="space-y-1.5">
        {lead.endereco && (
          <div className="flex items-start gap-2 text-zinc-400 text-xs">
            <MapPin className="w-3 h-3 shrink-0 mt-0.5 text-zinc-600" />
            <span className="line-clamp-1">{lead.endereco}</span>
          </div>
        )}
        {lead.telefone && (
          <div className="flex items-center gap-2 text-zinc-400 text-xs">
            <Phone className="w-3 h-3 shrink-0 text-zinc-600" />
            <span>{lead.telefone}</span>
          </div>
        )}
        {lead.site && (
          <div className="flex items-center gap-2 text-xs">
            <Globe className="w-3 h-3 shrink-0 text-zinc-600" />
            <a href={lead.site} target="_blank" rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 truncate transition-colors">
              {lead.site.replace('https://', '').replace('http://', '')}
            </a>
          </div>
        )}
        {lead.nota > 0 && (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Star className="w-3 h-3 shrink-0 text-amber-400" />
            <span><span className="text-amber-400 font-bold">{lead.nota.toFixed(1)}</span> ({lead.totalAvaliacoes} avaliações)</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        {!salvo && (
          <button
            onClick={() => salvarLead(lead)}
            className="flex-1 h-8 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:text-white transition-all"
          >
            Salvar Lead
          </button>
        )}
        <button
          onClick={() => converterEmCliente(lead)}
          disabled={convertendo === lead.placeId}
          className="flex-1 h-8 bg-[#ff5351] text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-1 disabled:opacity-50"
        >
          {convertendo === lead.placeId ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <><UserPlus className="w-3 h-3" /> Converter</>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 pb-20 text-left">
      <header>
        <p className="text-[11px] uppercase tracking-[0.4em] text-[#ff5351] font-black mb-2">Módulo de Crescimento</p>
        <h1 className="text-5xl font-black text-white uppercase italic tracking-tight">Prospectar</h1>
        <p className="text-zinc-500 text-sm mt-1">Encontre e qualifique novos clientes potenciais</p>
      </header>

      {/* Contador de buscas */}
      <div className="bg-[#1f1f1f] border border-zinc-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Buscas utilizadas este mês</span>
          <span className={cn('text-xs font-black', pctBuscas >= 80 ? 'text-red-400' : pctBuscas >= 50 ? 'text-amber-400' : 'text-emerald-400')}>
            {buscasUsadas}/{LIMITE_MENSAL}
          </span>
        </div>
        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', pctBuscas >= 80 ? 'bg-red-500' : pctBuscas >= 50 ? 'bg-amber-500' : 'bg-emerald-500')}
            style={{ width: `${pctBuscas}%` }}
          />
        </div>
        {pctBuscas >= 80 && (
          <div className="flex items-center gap-2 mt-2">
            <AlertCircle className="w-3 h-3 text-red-400" />
            <span className="text-red-400 text-[10px] font-black uppercase">Atenção: limite próximo!</span>
          </div>
        )}
      </div>

      {/* Formulário de busca */}
      <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="text-xs font-black uppercase tracking-widest text-white">Nova Busca</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Segmento / Nicho</label>
              <input
                type="text"
                value={segmento}
                onChange={e => setSegmento(e.target.value)}
                placeholder="Ex: clínicas de fisioterapia, academias..."
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none"
                onKeyDown={e => e.key === 'Enter' && buscarEmpresas()}
              />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Cidade</label>
              <input
                type="text"
                value={cidade}
                onChange={e => setCidade(e.target.value)}
                placeholder="Ex: São Paulo, SP"
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none"
                onKeyDown={e => e.key === 'Enter' && buscarEmpresas()}
              />
            </div>
          </div>

          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Raio de Busca</label>
            <div className="flex gap-2">
              {RAIOS.map(r => (
                <button
                  key={r.value}
                  onClick={() => setRaio(r.value)}
                  className={cn(
                    'flex-1 h-9 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all',
                    raio === r.value
                      ? 'bg-[#ff5351] text-white border-[#ff5351]'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600'
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={buscarEmpresas}
            disabled={loading || buscasUsadas >= LIMITE_MENSAL}
            className="w-full h-12 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-xl shadow-[#ff5351]/20"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            {loading ? 'Buscando empresas...' : 'Buscar Empresas'}
          </button>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl w-fit">
        <button
          onClick={() => setAbaSelecionada('buscar')}
          className={cn('px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
            abaSelecionada === 'buscar' ? 'bg-[#ff5351] text-white' : 'text-zinc-500 hover:text-white')}
        >
          Resultados {leads.length > 0 && `(${leads.length})`}
        </button>
        <button
          onClick={() => setAbaSelecionada('salvos')}
          className={cn('px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
            abaSelecionada === 'salvos' ? 'bg-[#ff5351] text-white' : 'text-zinc-500 hover:text-white')}
        >
          Leads Salvos {salvos.length > 0 && `(${salvos.length})`}
        </button>
      </div>

      {/* Resultados */}
      {abaSelecionada === 'buscar' && (
        <div>
          {leads.length === 0 && !loading && (
            <div className="text-center py-16 text-zinc-600">
              <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-black uppercase text-sm">Faça uma busca para encontrar leads</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {leads.map(lead => (
              <LeadCard key={lead.placeId} lead={lead} />
            ))}
          </div>
        </div>
      )}

      {/* Leads Salvos */}
      {abaSelecionada === 'salvos' && (
        <div>
          {salvos.length === 0 && (
            <div className="text-center py-16 text-zinc-600">
              <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-black uppercase text-sm">Nenhum lead salvo ainda</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {salvos.map(lead => (
              <LeadCard key={lead.id} lead={lead} salvo />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
