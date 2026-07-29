import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Phone, Globe, Star, TrendingUp, UserPlus, Loader2, AlertCircle, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { collection, addDoc, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cn } from '../lib/utils';

const SEGMENTOS = [
  'Clínicas de estética', 'Clínicas de fisioterapia', 'Clínicas odontológicas',
  'Clínicas médicas', 'Psicólogos e terapeutas', 'Nutricionistas',
  'Clínicas de pilates e yoga', 'Clínicas veterinárias e pet shops',
  'Clínicas de acupuntura', 'Clínicas de dermatologia', 'Clínicas de oftalmologia',
  'Clínicas de ortopedia', 'Laboratórios de análises clínicas',
  'Clínicas de quiropraxia', 'Clínicas de fonoaudiologia',
  'Academias', 'Personal trainers', 'Escolas de artes marciais',
  'Escolas de natação e esportes', 'Crossfit e funcional', 'Estúdios de dança',
  'Campos e quadras esportivas', 'Lojas de artigos esportivos',
  'Salões de beleza', 'Barbearias', 'Clínicas de bronzeamento',
  'Spas e centros de relaxamento', 'Clínicas de micropigmentação',
  'Clínicas de depilação', 'Nail designers e manicures', 'Maquiadoras profissionais',
  'Restaurantes', 'Cafeterias e padarias', 'Delivery e dark kitchens',
  'Buffets e eventos gastronômicos', 'Pizzarias', 'Hamburguerias artesanais',
  'Sorveterias e açaís', 'Empórios e lojas de produtos naturais',
  'Escolas', 'Cursos e treinamentos', 'Faculdades e cursos técnicos',
  'Escolas de idiomas', 'Escolas de música', 'Escolas de teatro e artes',
  'Cursinhos pré-vestibular', 'Escolas de informática',
  'Escritórios de advocacia', 'Contabilidades', 'Consultorias financeiras',
  'Seguradoras e corretoras', 'Escritórios de cobrança',
  'Empresas de crédito e financiamento', 'Consultorias de RH',
  'Escritórios de contabilidade digital',
  'Imobiliárias', 'Construtoras', 'Arquitetos e designers de interiores',
  'Empresas de reformas e manutenção', 'Administradoras de condomínios',
  'Empresas de limpeza e conservação', 'Vidraçarias e esquadrias',
  'Marmorarias e granitos',
  'Concessionárias', 'Oficinas mecânicas', 'Lava-rápidos e estética automotiva',
  'Funilarias e pintura automotiva', 'Lojas de pneus e rodas',
  'Rastreamento e alarmes veiculares', 'Despachantes e documentação',
  'Lojas de roupas e calçados', 'Lojas de móveis e decoração',
  'Farmácias e drogarias', 'Supermercados e mercados', 'Óticas',
  'Joalherias e relojoarias', 'Lojas de eletrônicos', 'Livrarias e papelarias',
  'Hotéis e pousadas', 'Agências de viagem', 'Resorts e spas',
  'Parques e atrações turísticas', 'Hostels e albergues',
  'Locadoras de veículos', 'Guias turísticos', 'Restaurantes temáticos',
  'Cerimoniais e casamentos', 'Fotógrafos e videomakers', 'Produtoras de eventos',
  'DJs e bandas', 'Decoradores de festas', 'Locadoras de equipamentos para eventos',
  'Buffets infantis', 'Espaços para eventos',
  'Empresas de TI e software', 'Gráficas e impressão', 'Agências de publicidade',
  'Empresas de segurança e monitoramento', 'Empresas de logística e transporte',
  'Consultorias de marketing digital',
];

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
  const [segmentoSugestoes, setSegmentoSugestoes] = useState<string[]>([]);
  const [showSegmentoSugestoes, setShowSegmentoSugestoes] = useState(false);
  const [cidadeSugestoes, setCidadeSugestoes] = useState<any[]>([]);
  const [showCidadeSugestoes, setShowCidadeSugestoes] = useState(false);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number } | null>(null);
  const cidadeTimerRef = useRef<any>(null);

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

  const usarMinhaLocalizacao = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocalização não suportada pelo navegador');
      return;
    }
    setLoadingGeo(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&language=pt-BR&key=${import.meta.env.VITE_GOOGLE_PLACES_API_KEY}`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.results && data.results.length > 0) {
            const endereco = data.results[0].formatted_address;
            setCidade(endereco);
            setCoordenadas({ lat: latitude, lng: longitude });
            toast.success('Localização detectada!');
          }
        } catch (error) {
          toast.error('Erro ao converter localização');
        } finally {
          setLoadingGeo(false);
        }
      },
      () => {
        toast.error('Permissão de localização negada');
        setLoadingGeo(false);
      }
    );
  };

  const handleSegmentoChange = (value: string) => {
    setSegmento(value);
    if (value.length >= 2) {
      const filtrados = SEGMENTOS.filter(s =>
        s.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 8);
      setSegmentoSugestoes(filtrados);
      setShowSegmentoSugestoes(filtrados.length > 0);
    } else {
      setShowSegmentoSugestoes(false);
    }
  };

  const handleCidadeChange = async (value: string) => {
    setCidade(value);
    setCoordenadas(null);
    if (cidadeTimerRef.current) clearTimeout(cidadeTimerRef.current);
    if (value.length < 3) { setShowCidadeSugestoes(false); return; }
    cidadeTimerRef.current = setTimeout(async () => {
      try {
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(value)}&types=(cities)&language=pt-BR&components=country:br&key=${import.meta.env.VITE_GOOGLE_PLACES_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.predictions) {
          setCidadeSugestoes(data.predictions.slice(0, 6));
          setShowCidadeSugestoes(true);
        }
      } catch (error) {
        console.error('Erro autocomplete cidade:', error);
      }
    }, 400);
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
    setShowSegmentoSugestoes(false);
    setShowCidadeSugestoes(false);

    try {
      let lat, lng;

      if (coordenadas) {
        lat = coordenadas.lat;
        lng = coordenadas.lng;
      } else {
        const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cidade)}&key=${import.meta.env.VITE_GOOGLE_PLACES_API_KEY}`;
        const geoRes = await fetch(geoUrl);
        const geoData = await geoRes.json();
        if (!geoData.results || geoData.results.length === 0) {
          toast.error('Cidade não encontrada');
          setLoading(false);
          return;
        }
        lat = geoData.results[0].geometry.location.lat;
        lng = geoData.results[0].geometry.location.lng;
      }

      const placesRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
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
        toast('Nenhuma empresa encontrada.');
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
        return { ...leadParcial, score, classificacao: getClassificacao(score) };
      });

      resultados.sort((a, b) => b.score - a.score);
      setLeads(resultados);
      toast.success(`${resultados.length} empresas encontradas!`);

    } catch (error: any) {
      console.error(error);
      toast.error('Erro ao buscar empresas.');
    } finally {
      setLoading(false);
    }
  };

  const salvarLead = async (lead: Lead) => {
    try {
      const existente = salvos.find(s => s.placeId === lead.placeId);
      if (existente) { toast('Lead já salvo!'); return; }
      await addDoc(collection(db, 'prospects'), { ...lead, criadoEm: serverTimestamp() });
      toast.success('Lead salvo!');
      loadLeadsSalvos();
    } catch (error) {
      toast.error('Erro ao salvar lead');
    }
  };

  const converterEmCliente = async (lead: Lead) => {
    setConvertendo(lead.placeId);
    try {
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
          <button onClick={() => salvarLead(lead)}
            className="flex-1 h-8 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:text-white transition-all">
            Salvar Lead
          </button>
        )}
        <button onClick={() => converterEmCliente(lead)} disabled={convertendo === lead.placeId}
          className="flex-1 h-8 bg-[#ff5351] text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-1 disabled:opacity-50">
          {convertendo === lead.placeId ? <Loader2 className="w-3 h-3 animate-spin" /> : <><UserPlus className="w-3 h-3" /> Converter</>}
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

      <div className="bg-[#1f1f1f] border border-zinc-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Buscas utilizadas este mês</span>
          <span className={cn('text-xs font-black', pctBuscas >= 80 ? 'text-red-400' : pctBuscas >= 50 ? 'text-amber-400' : 'text-emerald-400')}>
            {buscasUsadas}/{LIMITE_MENSAL}
          </span>
        </div>
        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', pctBuscas >= 80 ? 'bg-red-500' : pctBuscas >= 50 ? 'bg-amber-500' : 'bg-emerald-500')}
            style={{ width: `${pctBuscas}%` }} />
        </div>
        {pctBuscas >= 80 && (
          <div className="flex items-center gap-2 mt-2">
            <AlertCircle className="w-3 h-3 text-red-400" />
            <span className="text-red-400 text-[10px] font-black uppercase">Atenção: limite próximo!</span>
          </div>
        )}
      </div>

      <div className="bg-[#1f1f1f] border border-zinc-800 rounded-[24px] overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="text-xs font-black uppercase tracking-widest text-white">Nova Busca</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div className="relative">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Segmento / Nicho</label>
              <input
                type="text"
                value={segmento}
                onChange={e => handleSegmentoChange(e.target.value)}
                onFocus={() => segmento.length >= 2 && setShowSegmentoSugestoes(true)}
                onBlur={() => setTimeout(() => setShowSegmentoSugestoes(false), 200)}
                placeholder="Ex: clínicas de estética..."
                className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none"
              />
              {segmento && (
                <button onClick={() => { setSegmento(''); setShowSegmentoSugestoes(false); }}
                  className="absolute right-3 top-[38px] text-zinc-500 hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              )}
              {showSegmentoSugestoes && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden z-50 shadow-xl">
                  {segmentoSugestoes.map(s => (
                    <button key={s} onMouseDown={() => { setSegmento(s); setShowSegmentoSugestoes(false); }}
                      className="w-full px-4 py-2.5 text-left text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all border-b border-zinc-800 last:border-0">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Cidade / Localização</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={cidade}
                    onChange={e => handleCidadeChange(e.target.value)}
                    onBlur={() => setTimeout(() => setShowCidadeSugestoes(false), 200)}
                    placeholder="Ex: São Paulo, SP"
                    className="w-full h-11 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:border-[#ff5351] outline-none"
                  />
                  {cidade && (
                    <button onClick={() => { setCidade(''); setShowCidadeSugestoes(false); setCoordenadas(null); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {showCidadeSugestoes && cidadeSugestoes.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden z-50 shadow-xl">
                      {cidadeSugestoes.map(s => (
                        <button key={s.place_id} onMouseDown={() => { setCidade(s.description); setShowCidadeSugestoes(false); }}
                          className="w-full px-4 py-2.5 text-left text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all border-b border-zinc-800 last:border-0 flex items-center gap-2">
                          <MapPin className="w-3 h-3 text-zinc-600 shrink-0" />
                          {s.description}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={usarMinhaLocalizacao}
                  disabled={loadingGeo}
                  title="Usar minha localização"
                  className="h-11 w-11 shrink-0 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-400 hover:text-[#ff5351] hover:border-[#ff5351] transition-all disabled:opacity-50">
                  {loadingGeo ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                </button>
              </div>
              {coordenadas && (
                <p className="text-emerald-400 text-[9px] font-black uppercase tracking-widest mt-1.5 flex items-center gap-1">
                  📍 Localização detectada com sucesso
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block mb-2">Raio de Busca</label>
            <div className="flex gap-2">
              {RAIOS.map(r => (
                <button key={r.value} onClick={() => setRaio(r.value)}
                  className={cn('flex-1 h-9 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all',
                    raio === r.value ? 'bg-[#ff5351] text-white border-[#ff5351]' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600')}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={buscarEmpresas} disabled={loading || buscasUsadas >= LIMITE_MENSAL}
            className="w-full h-12 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-xl shadow-[#ff5351]/20">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            {loading ? 'Buscando empresas...' : 'Buscar Empresas'}
          </button>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl w-fit">
        <button onClick={() => setAbaSelecionada('buscar')}
          className={cn('px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
            abaSelecionada === 'buscar' ? 'bg-[#ff5351] text-white' : 'text-zinc-500 hover:text-white')}>
          Resultados {leads.length > 0 && `(${leads.length})`}
        </button>
        <button onClick={() => setAbaSelecionada('salvos')}
          className={cn('px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
            abaSelecionada === 'salvos' ? 'bg-[#ff5351] text-white' : 'text-zinc-500 hover:text-white')}>
          Leads Salvos {salvos.length > 0 && `(${salvos.length})`}
        </button>
      </div>

      {abaSelecionada === 'buscar' && (
        <div>
          {leads.length === 0 && !loading && (
            <div className="text-center py-16 text-zinc-600">
              <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-black uppercase text-sm">Faça uma busca para encontrar leads</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {leads.map(lead => <LeadCard key={lead.placeId} lead={lead} />)}
          </div>
        </div>
      )}

      {abaSelecionada === 'salvos' && (
        <div>
          {salvos.length === 0 && (
            <div className="text-center py-16 text-zinc-600">
              <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-black uppercase text-sm">Nenhum lead salvo ainda</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {salvos.map(lead => <LeadCard key={lead.id} lead={lead} salvo />)}
          </div>
        </div>
      )}
    </div>
  );
}
