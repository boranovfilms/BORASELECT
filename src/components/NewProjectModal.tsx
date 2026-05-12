import React, { useState, useEffect } from 'react';
import { Check, Search, Loader2, ChevronLeft, Link as LinkIcon, FolderOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clientService, Client } from '../services/clientService';
import { categoryService, Category } from '../services/categoryService';
import { projectService } from '../services/projectService';
import { cn } from '../lib/utils';
import { emailService } from '../services/emailService';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function NewProjectModal({ isOpen, onClose, onSuccess }: NewProjectModalProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [sendInviteEmail, setSendInviteEmail] = useState(true);

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [includedCredits, setIncludedCredits] = useState(15);

  const [driveLink, setDriveLink] = useState('');
  const [originalDriveLink, setOriginalDriveLink] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      setError(null);
    }
  }, [isOpen]);

  const loadInitialData = async () => {
    try {
      const [cls, cats] = await Promise.all([
        clientService.searchClients(''),
        categoryService.getCategories()
      ]);
      setClients(cls);
      setCategories(cats);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const resetForm = () => {
    setTitle('');
    setSelectedClient(null);
    setSelectedCategory('');
    setNewClientName('');
    setNewClientEmail('');
    setNewCategoryName('');
    setIsCreatingClient(false);
    setIsCreatingCategory(false);
    setIncludedCredits(15);
    setSendInviteEmail(true);
    setDriveLink('');
    setOriginalDriveLink('');
    setError(null);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let finalClientId = selectedClient?.id;
      let finalClientName = selectedClient?.name || '';
      let finalClientEmail = selectedClient?.email || '';

      if (isCreatingClient) {
        if (!newClientName || !newClientEmail) {
          throw new Error('Nome e e-mail do cliente são obrigatórios');
        }

        const clientRef = await clientService.createClient({
          name: newClientName,
          email: newClientEmail.toLowerCase().trim()
        });

        finalClientId = clientRef.id;
        finalClientName = newClientName;
        finalClientEmail = newClientEmail.toLowerCase().trim();
      }

      if (!finalClientId) {
        throw new Error('Selecione ou cadastre um cliente para o projeto');
      }

      let finalCategory = selectedCategory;
      if (isCreatingCategory && newCategoryName) {
        await categoryService.createCategory(newCategoryName);
        finalCategory = newCategoryName;
      }

      if (!finalCategory) {
        finalCategory = 'Geral';
      }

      const clientStatus = await clientService.checkGlobalStatus(finalClientEmail);

      const projectRef = await projectService.createProject({
        title,
        clientId: finalClientId,
        clientName: finalClientName,
        clientEmail: finalClientEmail,
        category: finalCategory,
        status: 'Em Seleção',
        clientStatus: clientStatus as 'pending' | 'confirmed',
        coverImage: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?q=80&w=2070&auto=format&fit=crop',
        progress: 0,
        creditsUsed: 0,
        creditsTotal: includedCredits,
        includedItems: includedCredits,
        driveLink: driveLink.trim(),
        originalDriveLink: originalDriveLink.trim()
      });

      if (sendInviteEmail && finalClientEmail) {
        const status = await clientService.checkGlobalStatus(finalClientEmail);
        const isRegistered = status === 'confirmed';

        const inviteLink = isRegistered
          ? `${window.location.origin}/login`
          : `${window.location.origin}/register?email=${encodeURIComponent(finalClientEmail)}`;

        try {
          await emailService.sendInvite(finalClientEmail, finalClientName, inviteLink, isRegistered);
        } catch (emailErr) {
          console.error('Failed to send auto-invite email:', emailErr);
        }
      }

      onSuccess();
      resetForm();
      onClose();
      navigate(`/projects/${projectRef.id}/config`);
    } catch (err: any) {
      console.error('Project creation failed:', err);
      setError(err.message || 'Ocorreu um erro ao criar o projeto. Verifique suas permissões.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="space-y-12 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <button
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="mb-4 flex items-center gap-2 text-zinc-500 hover:text-white transition-all text-xs font-bold uppercase tracking-widest"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </button>
          <div className="flex flex-col gap-1">
            <h1 className="text-4xl font-black tracking-tight text-white uppercase italic">Novo Projeto</h1>
            <p className="text-[#ff5351] font-bold text-lg">Criação de projeto</p>
          </div>
        </div>
      </header>

      <section className="bg-[#1f1f1f] border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl">
        <form onSubmit={handleCreateProject} className="space-y-8">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm font-semibold animate-in fade-in zoom-in-95">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Título do Projeto</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Casamento Luiza & Marcos"
              required
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-white focus:border-[#ff5351] outline-none transition-all"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between ml-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Informações do Cliente</label>
              <button
                type="button"
                onClick={() => setIsCreatingClient(!isCreatingClient)}
                className="text-[10px] font-black uppercase tracking-widest text-[#ff5351] hover:underline flex items-center gap-1"
              >
                {isCreatingClient ? 'Buscar Existente' : 'Novo Cliente'}
              </button>
            </div>

            {isCreatingClient ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                <input
                  type="text"
                  placeholder="Nome do Cliente"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-white focus:border-[#ff5351] outline-none"
                  required
                />
                <input
                  type="email"
                  placeholder="E-mail"
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-white focus:border-[#ff5351] outline-none"
                  required
                />
              </div>
            ) : (
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-[#ff5351]" />
                <select
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-12 pr-4 py-4 text-white focus:border-[#ff5351] outline-none appearance-none cursor-pointer"
                  value={selectedClient?.id || ''}
                  onChange={(e) => {
                    const client = clients.find(c => c.id === e.target.value);
                    setSelectedClient(client || null);
                  }}
                  required
                >
                  <option value="">Selecione um cliente...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Search className="w-4 h-4 text-zinc-600" />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between ml-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Categoria do Serviço</label>
              <button
                type="button"
                onClick={() => setIsCreatingCategory(!isCreatingCategory)}
                className="text-[10px] font-black uppercase tracking-widest text-[#ff5351] hover:underline"
              >
                {isCreatingCategory ? 'Lista' : '+ Nova Categoria'}
              </button>
            </div>

            {isCreatingCategory ? (
              <div className="flex gap-2 animate-in fade-in slide-in-from-top-2">
                <input
                  type="text"
                  placeholder="Ex: Podcast, Institucional..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-white focus:border-[#ff5351] outline-none"
                  required
                />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {['Casamento', 'Ensaio', 'Evento', 'Podcast', 'Vídeo Clipe'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      'px-4 py-2 rounded-full border text-xs font-bold transition-all',
                      selectedCategory === cat
                        ? 'bg-[#ff5351] border-[#ff5351] text-white'
                        : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                    )}
                  >
                    {cat}
                  </button>
                ))}
                {categories
                  .filter(c => !['Casamento', 'Ensaio', 'Evento', 'Podcast', 'Vídeo Clipe'].includes(c.name))
                  .map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.name)}
                      className={cn(
                        'px-4 py-2 rounded-full border text-xs font-bold transition-all',
                        selectedCategory === cat.name
                          ? 'bg-[#ff5351] border-[#ff5351] text-white'
                          : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                      )}
                    >
                      {cat.name}
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Link do Drive do Catálogo</label>
            <div className="relative">
              <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
              <input
                type="text"
                value={driveLink}
                onChange={(e) => setDriveLink(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-12 pr-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Link da Pasta do Drive (Originais)</label>
            <div className="relative">
              <FolderOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
              <input
                type="text"
                value={originalDriveLink}
                onChange={(e) => setOriginalDriveLink(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-12 pr-4 py-4 text-white focus:border-[#ff5351] outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Mídias Inclusas (Créditos)</label>
            <input
              type="number"
              value={includedCredits}
              onChange={(e) => setIncludedCredits(parseInt(e.target.value))}
              placeholder="Ex: 15"
              required
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-white focus:border-[#ff5351] outline-none transition-all"
            />
          </div>

          <div
            className="flex items-center gap-3 p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer group"
            onClick={() => setSendInviteEmail(!sendInviteEmail)}
          >
            <div
              className={cn(
                'w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all',
                sendInviteEmail ? 'bg-[#ff5351] border-[#ff5351]' : 'border-zinc-700 group-hover:border-zinc-600'
              )}
            >
              {sendInviteEmail && <Check className="w-4 h-4 text-white" />}
            </div>
            <div>
              <div className="text-xs font-bold text-white uppercase tracking-widest">Enviar convite por e-mail</div>
              <div className="text-[10px] text-zinc-500 font-medium">O cliente receberá o link para criar sua senha e acessar.</div>
            </div>
          </div>

          <footer className="pt-4 flex gap-4">
            <button
              type="button"
              onClick={() => {
                resetForm();
                onClose();
              }}
              className="flex-1 py-4 rounded-xl border border-zinc-800 text-white font-bold hover:bg-zinc-800 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] py-4 rounded-xl bg-[#ff5351] text-white font-bold hover:opacity-90 transition-all shadow-xl shadow-[#ff5351]/20 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Criar Projeto'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
