import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { DataTable } from '../components/ui/DataTable';
import { Database, Search, RefreshCw, Loader2, Copy, Check, Video, Trash2, Key } from 'lucide-react';
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
    { id: 'content_plans', label: 'PLANEJAMENTOS' },
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
        // Para a coleção de planejamentos, vamos fixar as colunas solicitadas para melhor visualização
        if (selectedCollection === 'content_plans') {
          setColumns([
            { header: 'ID', accessor: 'id' },
            { header: 'CLIENT ID', accessor: 'clientId' },
            { header: 'CAMPANHA', accessor: 'name' },
            { header: 'MÊS REF', accessor: 'monthReference' },
            { header: 'STATUS', accessor: 'status' },
            { 
              header: 'POSTS', 
              accessor: (item: any) => (item.posts?.length || 0).toString() 
            },
            { 
              header: 'CRIADO EM', 
              accessor: (item: any) => {
                const date = item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
                return isNaN(date.getTime()) ? '-' : date.toLocaleString('pt-BR');
              } 
            }
          ]);
        } else {
          // Lógica dinâmica para as outras coleções
          const allKeys = new Set<string>();
          docs.forEach(doc => Object.keys(doc).forEach(key => allKeys.add(key)));
          
          const dynamicCols = Array.from(allKeys).map(key => ({
            header: key.toUpperCase(),
            accessor: (item: any) => {
              const val = item[key];
              if (val === undefined || val === null) return '-';
              if (typeof val === 'object') {
                try {
                  return JSON.stringify(val).substring(0, 30) + '...';
                } catch (e) {
                  return '[Object]';
                }
              }
              return String(val);
            }
          }));
          setColumns(dynamicCols);
        }
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
      const response = await fetch('/api/cloudflare-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: cfToken, action: 'list' })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Erro na API do Cloudflare');
      
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
    if (selectedVideos.size === 0) return;
    
    const confirmMsg = `ATENÇÃO: Você está prestes a apagar ${selectedVideos.size} vídeos permanentemente do Cloudflare. Continuar?`;
    if (!window.confirm(confirmMsg)) return;

    setIsDeleting(true);
    setDeleteProgress({ current: 0, total: selectedVideos.size });
    const idsToDelete = Array.from(selectedVideos);
    let successCount = 0;

    for (let i = 0; i < idsToDelete.length; i++) {
      const videoId = idsToDelete[i];
      try {
        const response = await fetch('/api/cloudflare-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: cfToken, action: 'delete', videoId })\n        });\n        if (response.ok) successCount++;\n      } catch (error) {}\n      setDeleteProgress(prev => ({ ...prev, current: i + 1 }));\n    }\n\n    toast.success(`${successCount} vídeos removidos com sucesso`);\n    setIsDeleting(false);\n    fetchCloudflareVideos();\n  };\n\n  const toggleSelectAll = () => {\n    if (selectedVideos.size === cfVideos.length) {\n      setSelectedVideos(new Set());\n    } else {\n      setSelectedVideos(new Set(cfVideos.map(v => v.uid)));\n    }\n  };\n\n  const toggleVideoSelection = (id: string) => {\n    const newSet = new Set(selectedVideos);\n    if (newSet.has(id)) newSet.delete(id);\n    else newSet.add(id);\n    setSelectedVideos(newSet);\n  };\n\n  const formatDuration = (seconds: number) => {\n    const mins = Math.floor(seconds / 60);\n    const secs = Math.floor(seconds % 60);\n    return `${mins}:${secs.toString().padStart(2, '0')}`;\n  };\n\n  const copyToClipboard = () => {\n    if (data.length === 0) {\n      toast.error('Não há dados para copiar');\n      return;\n    }\n    try {\n      const jsonString = JSON.stringify(data, null, 2);\n      navigator.clipboard.writeText(jsonString);\n      setCopied(true);\n      toast.success('Dados copiados para a área de transferência!');\n      setTimeout(() => setCopied(false), 3000);\n    } catch (err) {\n      toast.error('Falha ao copiar dados');\n    }\n  };\n\n  return (\n    <div className=\"space-y-8 pb-20 text-left\">\n      <header className=\"flex flex-col md:flex-row md:items-end justify-between gap-6\">\n        <div>\n          <h1 className=\"text-4xl font-black text-white uppercase italic flex items-center gap-3\">\n            <Database className=\"w-8 h-8 text-[#ff5351]\" />\n            Diagnóstico de Dados\n          </h1>\n          <p className=\"text-zinc-500 text-sm mt-2\">Auditoria técnica e gestão de infraestrutura externa.</p>\n        </div>\n        \n        <div className=\"flex gap-3\">\n          {selectedCollection !== 'cloudflare' && (\n            <button \n              onClick={copyToClipboard}\n              className={cn(\n                \"h-12 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-xl\",\n                copied ? \"bg-emerald-500 text-white\" : \"bg-white text-black hover:bg-[#ff5351] hover:text-white\"\n              )}\n            >\n              {copied ? <Check className=\"w-4 h-4\" /> : <Copy className=\"w-4 h-4\" />}\n              {copied ? 'Copiado!' : 'Copiar JSON para Auditoria'}\n            </button>\n          )}\n          \n          <button \n            onClick={selectedCollection === 'cloudflare' ? fetchCloudflareVideos : fetchData} \n            className=\"h-12 px-4 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all flex items-center gap-2\"\n          >\n            <RefreshCw className={cn(\"w-4 h-4\", loading && \"animate-spin\")} />\n            Atualizar\n          </button>\n        </div>\n      </header>\n\n      <div className=\"bg-[#1a1a1a] border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6\">\n        <div className=\"flex flex-wrap gap-2 pb-4 border-b border-zinc-800/50\">\n          {collections.map((col) => (\n            <button\n              key={col.id}\n              onClick={() => setSelectedCollection(col.id)}\n              className={cn(\n                \"px-4 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border\",\n                selectedCollection === col.id \n                ? 'bg-[#ff5351]/10 border-[#ff5351] text-[#ff5351]' \n                : 'bg-zinc-900 border border-zinc-800 text-zinc-600 hover:text-zinc-300'\n              )}\n            >\n              {col.label}\n            </button>\n          ))}\n        </div>\n\n        {selectedCollection === 'cloudflare' ? (\n          <div className=\"space-y-6\">\n            <div className=\"grid grid-cols-1 md:grid-cols-2 gap-4\">\n              <div className=\"space-y-2\">\n                <label className=\"text-[10px] font-black uppercase text-zinc-500 tracking-widest flex items-center gap-2\">\n                  <Key className=\"w-3 h-3 text-[#ff5351]\" /> API Token do Cloudflare (Sessão)\n                </label>\n                <div className=\"flex gap-3\">\n                  <input \n                    type=\"password\" \n                    value={cfToken}\n                    onChange={e => setCfToken(e.target.value)}\n                    placeholder=\"Cole seu token aqui...\"\n                    className=\"flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-[#ff5351] outline-none\"\n                  />\n                  <button \n                    onClick={fetchCloudflareVideos}\n                    disabled={loading}\n                    className=\"px-6 bg-[#ff5351] text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:brightness-110 disabled:opacity-50\"\n                  >\n                    {loading ? <Loader2 className=\"w-4 h-4 animate-spin\" /> : 'Carregar Vídeos'}\n                  </button>\n                </div>\n              </div>\n              <div className=\"flex items-end justify-end gap-3\">\n                {selectedVideos.size > 0 && (\n                  <button \n                    onClick={deleteSelectedVideos}\n                    disabled={isDeleting}\n                    className=\"h-12 px-6 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-red-500 hover:text-white transition-all flex items-center gap-2\"\n                  >\n                    {isDeleting ? (\n                      <span className=\"flex items-center gap-2\">\n                        <Loader2 className=\"w-4 h-4 animate-spin\" />\n                        {deleteProgress.current}/{deleteProgress.total} APAGANDO...\n                      </span>\n                    ) : (\n                      <>\n                        <Trash2 className=\"w-4 h-4\" />\n                        Apagar {selectedVideos.size} selecionados\n                      </>\n                    )}\n                  </button>\n                )}\n              </div>\n            </div>\n\n            {cfVideos.length > 0 ? (\n              <DataTable \n                data={cfVideos.map(v => ({ id: v.uid, ...v }))}\n                loading={loading}\n                columns={[\n                  { \n                    header: (\n                      <button onClick={toggleSelectAll} className=\"w-5 h-5 rounded border-2 border-zinc-700 flex items-center justify-center\">\n                        {selectedVideos.size === cfVideos.length && <Check className=\"w-3 h-3 text-[#ff5351]\" strokeWidth={4} />}\n                      </button>\n                    ) as any,\n                    accessor: (video: any) => (\n                      <button \n                        onClick={() => toggleVideoSelection(video.uid)}\n                        className={cn(\n                          \"w-5 h-5 rounded border-2 transition-all flex items-center justify-center\",\n                          selectedVideos.has(video.uid) ? \"bg-[#ff5351] border-[#ff5351]\" : \"border-zinc-700 bg-zinc-900\"\n                        )}\n                      >\n                        {selectedVideos.has(video.uid) && <Check className=\"w-3 h-3 text-white\" strokeWidth={4} />}\n                      </button>\n                    ),\n                    className: 'w-10'\n                  },\n                  {\n                    header: 'Thumbnail',\n                    accessor: (video: any) => (\n                      <div className=\"w-16 h-10 rounded-lg bg-zinc-900 overflow-hidden border border-zinc-800\">\n                        <img src={video.thumbnail} alt=\"\" className=\"w-full h-full object-cover\" />\n                      </div>\n                    )\n                  },\n                  {\n                    header: 'Nome do Vídeo',\n                    accessor: (video: any) => <span className=\"font-bold text-white uppercase\">{video.meta?.name || 'Sem nome'}</span>\n                  },\n                  {\n                    header: 'Duração',\n                    accessor: (video: any) => <span className=\"text-zinc-500 font-mono\">{formatDuration(video.duration)}</span>\n                  },\n                  {\n                    header: 'Status',\n                    accessor: (video: any) => (\n                      <span className={cn(\n                        \"px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest\",\n                        video.status?.state === 'ready' ? \"bg-emerald-500/10 text-emerald-500\" : \"bg-amber-500/10 text-amber-500\"\n                      )}>\n                        {video.status?.state || 'unknown'}\n                      </span>\n                    )\n                  }\n                ]}\n              />\n            ) : !loading && (\n              <div className=\"py-20 text-center border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/30\">\n                <Video className=\"w-12 h-12 text-zinc-800 mx-auto mb-4\" />\n                <p className=\"text-zinc-600 font-bold uppercase text-[10px] tracking-widest\">Nenhum vídeo carregado do Cloudflare</p>\n              </div>\n            )}\n          </div>\n        ) : data.length > 0 ? (\n          <DataTable \n            columns={columns} \n            data={data} \n            loading={loading}\n            emptyMessage=\"Nenhum dado encontrado nesta coleção.\"\n          />\n        ) : (\n          <div className=\"py-20 text-center border border-dashed border-zinc-800 rounded-3xl\">\n            <Search className=\"w-12 h-12 text-zinc-900 mx-auto mb-4\" />\n            <p className=\"text-zinc-600 font-black uppercase text-[10px] tracking-widest\">\n              {loading ? 'Carregando banco de dados...' : 'Selecione uma coleção ou aguarde'}\n            </p>\n          </div>\n        )}\n      </div>\n    </div>\n  );\n}\n