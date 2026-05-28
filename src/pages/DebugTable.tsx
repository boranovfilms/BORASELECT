import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { DataTable } from '../components/ui/DataTable';
import { Database, Search, RefreshCw, Loader2, Copy, Check, Video, Trash2, Key, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '../lib/utils';

interface CloudflareVideo {
  uid: string;
  thumbnail: string;
  meta: { name: string };
  duration: number;
  status: { state: string };
}

export default function DebugTable() {
  const [selectedCollection, setSelectedCollection] = useState('clients');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);

  // Estados do Cloudflare Stream
  const [cfToken, setCfToken] = useState('');
  const [cfVideos, setCfVideos] = useState<CloudflareVideo[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({ current: 0, total: 0 });

  const collections = [
    { id: 'clients', label: 'Usuários e Clientes' },
    { id: 'projects', label: 'Projetos' },
    { id: 'tasks', label: 'Tarefas' },
    { id: 'permissions', label: 'Matriz de Permissões' },
    { id: 'workflowModels', label: 'Modelos de Fluxo' },
    { id: 'creditRequests', label: 'Solicitações de Crédito' },
    { id: 'cloudflare', label: 'CLOUDFLARE STREAM' }
  ];

  useEffect(() => {
    if (selectedCollection !== 'cloudflare') {
      fetchData();
    }
  }, [selectedCollection]);

  const fetchData = async () => {
    setLoading(true);
    setCopied(false);
    try {
      const q = query(collection(db, selectedCollection), limit(100));
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (docs.length > 0) {
        const allKeys = new Set<string>();
        docs.forEach(doc => Object.keys(doc).forEach(key => allKeys.add(key)));
        
        const dynamicCols = Array.from(allKeys).map(key => ({
          header: key.toUpperCase(),
          accessor: (item: any) => {
            const val = item[key];
            if (val === undefined || val === null) return '-';
            if (typeof val === 'object') return JSON.stringify(val).substring(0, 30) + '...';
            return String(val);
          }
        }));
        setColumns(dynamicCols);
      } else {
        setColumns([]);
      }
      
      setData(docs);
    } catch (error) {
      toast.error('Erro ao buscar dados da coleção');
    } finally {
      setLoading(false);
    }
  };

  const fetchCloudflareVideos = async () => {
    if (!cfToken) return toast.error('Insira o API Token do Cloudflare');
    setLoading(true);
    try {
      const response = await fetch('https://api.cloudflare.com/client/v4/accounts/c1af34330acb010777256097e2133614/stream?limit=1000', {
        headers: { 'Authorization': `Bearer ${cfToken}` }
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.errors?.[0]?.message || 'Erro na API do Cloudflare');
      
      setCfVideos(result.result || []);
      setSelectedVideos(new Set());
      toast.success(`${result.result?.length || 0} vídeos carregados`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteSelectedVideos = async () => {
    if (selectedVideos.size === 0) return;\n    if (!window.confirm(`ATENÇÃO: Você está prestes a apagar ${selectedVideos.size} vídeos permanentemente do Cloudflare. Continuar?`)) return;

    setIsDeleting(true);
    setDeleteProgress({ current: 0, total: selectedVideos.size });
    const idsToDelete = Array.from(selectedVideos);
    let successCount = 0;

    for (let i = 0; i < idsToDelete.length; i++) {
      const videoId = idsToDelete[i];
      try {
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/c1af34330acb010777256097e2133614/stream/${videoId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${cfToken}` }
        });
        if (response.ok) successCount++;
      } catch (error) {}
      setDeleteProgress(prev => ({ ...prev, current: i + 1 }));
    }

    toast.success(`${successCount} vídeos removidos com sucesso`);
    setIsDeleting(false);
    fetchCloudflareVideos();
  };

  const toggleSelectAll = () => {
    if (selectedVideos.size === cfVideos.length) {
      setSelectedVideos(new Set());
    } else {
      setSelectedVideos(new Set(cfVideos.map(v => v.uid)));
    }
  };

  const toggleVideoSelection = (id: string) => {
    const newSet = new Set(selectedVideos);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedVideos(newSet);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const copyToClipboard = () => {
    if (data.length === 0) {
      toast.error('Não há dados para copiar');
      return;
    }
    try {
      const jsonString = JSON.stringify(data, null, 2);
      navigator.clipboard.writeText(jsonString);
      setCopied(true);
      toast.success('Dados copiados para a área de transferência!');
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      toast.error('Falha ao copiar dados');
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white uppercase italic flex items-center gap-3">
            <Database className="w-8 h-8 text-[#ff5351]" />
            Diagnóstico de Dados
          </h1>
          <p className="text-zinc-500 text-sm mt-2">Auditoria técnica e gestão de infraestrutura externa.</p>
        </div>
        
        <div className="flex gap-3">
          {selectedCollection !== 'cloudflare' && (
            <button 
              onClick={copyToClipboard}
              className={cn(
                "h-12 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-xl",
                copied ? "bg-emerald-500 text-white" : "bg-white text-black hover:bg-[#ff5351] hover:text-white"
              )}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiado!' : 'Copiar JSON para Auditoria'}
            </button>
          )}
          
          <button 
            onClick={selectedCollection === 'cloudflare' ? fetchCloudflareVideos : fetchData} 
            className="h-12 px-4 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all flex items-center gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Atualizar
          </button>
        </div>
      </header>

      <div className="bg-[#1a1a1a] border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex flex-wrap gap-2 pb-4 border-b border-zinc-800/50">
          {collections.map((col) => (
            <button
              key={col.id}
              onClick={() => setSelectedCollection(col.id)}
              className={cn(
                "px-4 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border",
                selectedCollection === col.id 
                ? 'bg-[#ff5351]/10 border-[#ff5351] text-[#ff5351]' 
                : 'bg-zinc-900 border-zinc-800 text-zinc-600 hover:text-zinc-300'
              )}
            >
              {col.label}
            </button>
          ))}
        </div>

        {selectedCollection === 'cloudflare' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest flex items-center gap-2">
                  <Key className="w-3 h-3 text-[#ff5351]" /> API Token do Cloudflare (Sessão)
                </label>
                <div className="flex gap-3">
                  <input 
                    type="password" 
                    value={cfToken}
                    onChange={e => setCfToken(e.target.value)}
                    placeholder="Cole seu token aqui..."
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-[#ff5351] outline-none"
                  />
                  <button 
                    onClick={fetchCloudflareVideos}
                    disabled={loading}
                    className="px-6 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Carregar Vídeos'}
                  </button>
                </div>
              </div>
              <div className="flex items-end justify-end gap-3">
                {selectedVideos.size > 0 && (
                  <button 
                    onClick={deleteSelectedVideos}
                    disabled={isDeleting}
                    className="h-12 px-6 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-red-500 hover:text-white transition-all flex items-center gap-2"
                  >
                    {isDeleting ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {deleteProgress.current}/{deleteProgress.total} APAGANDO...
                      </span>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Apagar {selectedVideos.size} selecionados
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {cfVideos.length > 0 ? (
              <DataTable 
                data={cfVideos.map(v => ({ id: v.uid, ...v }))}
                loading={loading}
                columns={[
                  { 
                    header: (
                      <button onClick={toggleSelectAll} className="w-5 h-5 rounded border-2 border-zinc-700 flex items-center justify-center">
                        {selectedVideos.size === cfVideos.length && <Check className="w-3 h-3 text-[#ff5351]" strokeWidth={4} />}
                      </button>
                    ) as any,
                    accessor: (video: any) => (
                      <button 
                        onClick={() => toggleVideoSelection(video.uid)}
                        className={cn(
                          "w-5 h-5 rounded border-2 transition-all flex items-center justify-center",
                          selectedVideos.has(video.uid) ? "bg-[#ff5351] border-[#ff5351]" : "border-zinc-700 bg-zinc-900"
                        )}
                      >
                        {selectedVideos.has(video.uid) && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                      </button>
                    ),
                    className: 'w-10'
                  },
                  {
                    header: 'Thumbnail',
                    accessor: (video: any) => (
                      <div className="w-16 h-10 rounded-lg bg-zinc-900 overflow-hidden border border-zinc-800">
                        <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
                      </div>
                    )
                  },
                  {
                    header: 'Nome do Vídeo',
                    accessor: (video: any) => <span className="font-bold text-white uppercase">{video.meta?.name || 'Sem nome'}</span>
                  },
                  {
                    header: 'Duração',
                    accessor: (video: any) => <span className="text-zinc-500 font-mono">{formatDuration(video.duration)}</span>
                  },
                  {
                    header: 'Status',
                    accessor: (video: any) => (
                      <span className={cn(
                        "px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest",
                        video.status?.state === 'ready' ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                      )}>
                        {video.status?.state || 'unknown'}
                      </span>
                    )
                  }
                ]}
              />
            ) : !loading && (
              <div className="py-20 text-center border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/30">
                <Video className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
                <p className="text-zinc-600 font-bold uppercase text-[10px] tracking-widest">Nenhum vídeo carregado do Cloudflare</p>
              </div>
            )}
          </div>
        ) : data.length > 0 ? (
          <DataTable 
            columns={columns} 
            data={data} 
            loading={loading}
            emptyMessage="Nenhum dado encontrado nesta coleção."
          />
        ) : (
          <div className="py-20 text-center border border-dashed border-zinc-800 rounded-3xl">
            <Search className="w-12 h-12 text-zinc-900 mx-auto mb-4" />
            <p className="text-zinc-600 font-bold uppercase text-[10px] tracking-widest">
              {loading ? 'Carregando banco de dados...' : 'Selecione uma coleção ou aguarde'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
