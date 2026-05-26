export const dynamic = 'force-dynamic';
import React, { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail, auth } from '../lib/firebase';
import { Mail, Lock, ArrowRight, ShieldCheck, Zap, Image as ImageIcon, Eye, EyeOff, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('Acesso liberado!');
    } catch (err: any) {
      console.error("Firebase Code:", err.code);
      
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Senha incorreta para este usuário. Tente novamente ou use "Esqueci a senha".');
      } else if (err.code === 'auth/user-not-found') {
        setError('Usuário não encontrado. Acesse apenas se possuir um convite.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Muitas tentativas falhas. Tente redefinir sua senha ou aguarde alguns minutos.');
      } else {
        setError(`Erro (${err.code}): Verifique seus dados.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Digite seu e-mail acima primeiro para recuperar a senha.');
      return;
    }
    
    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, email);
      toast.success('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
      setError('');
    } catch (err: any) {
      setError('Erro ao enviar recuperação: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#131313] flex flex-col md:flex-row overflow-hidden font-sans">
      {/* Left Side: Branding & Marketing */}
      <div className="hidden md:flex md:w-1/2 bg-[#0e0e0e] relative items-center justify-center p-16 overflow-hidden border-r border-zinc-800">
        <div className="absolute inset-0 z-0 opacity-30">
          <img 
            src="https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?q=80&w=2071&auto=format&fit=crop" 
            className="w-full h-full object-cover grayscale"
            alt="Cinema Background"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#ff5351]/20 via-transparent to-transparent" />
        </div>

        <div className="relative z-10 max-w-lg space-y-12">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-[#ff5351] animate-pulse" />
              <span className="text-2xl font-black tracking-tighter uppercase text-white">BORA SELECT</span>
            </div>
            <h1 className="text-6xl font-bold tracking-tight text-white leading-tight">
              A Nova Era da <br /><span className="text-[#ff5351]">Experiência Visual.</span>
            </h1>
            <p className="text-zinc-400 text-xl leading-relaxed font-medium">
              Transformamos a entrega técnica em um momento épico. Galerias exclusivas, seleção cinematográfica e workflow de elite.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-10 pt-8">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-zinc-800/80 backdrop-blur-md rounded-2xl border border-zinc-700">
                <Zap className="w-6 h-6 text-[#ff5351]" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-1">Impacto Imediato</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">Desenvolvido para profissionais que não aceitam o comum. Impressione seus clientes antes mesmo do play.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-zinc-800/80 backdrop-blur-md rounded-2xl border border-zinc-700">
                <ShieldCheck className="w-6 h-6 text-[#ff5351]" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg mb-1">Acesso Seletivo</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">Plataforma privada. Controle total de quem acessa sua arte, com segurança de nível bancário.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side: Auth Form */}
      <div className="flex-1 flex items-center justify-center p-8 md:p-24 relative bg-[#131313]">
        {/* Mobile Logo Overlay */}
        <div className="md:hidden absolute top-8 left-8">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#ff5351]" />
            <span className="text-sm font-black tracking-tighter uppercase text-white">BORA SELECT</span>
          </div>
        </div>

        <div className="max-w-md w-full space-y-10">
          <div className="space-y-3">
            <h2 className="text-4xl font-bold text-white tracking-tight">
              Fazer Login.
            </h2>
            <p className="text-zinc-500 font-medium leading-relaxed">
              O BORA SELECT é um sistema exclusivo para convidados. Acesse seu projeto ou solicite o convite.
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-semibold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">E-mail de Acesso</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-[#ff5351] transition-colors" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-12 pr-4 py-4 text-white placeholder:text-zinc-700 focus:border-[#ff5351] focus:ring-1 focus:ring-[#ff5351] outline-none transition-all"
                  placeholder="exemplo@email.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Senha</label>
                <button 
                  type="button" 
                  onClick={handleForgotPassword}
                  className="text-[10px] font-black uppercase tracking-widest text-[#ff5351] hover:underline"
                >
                  Esqueci a senha
                </button>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-[#ff5351] transition-colors" />
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-12 pr-12 py-4 text-white placeholder:text-zinc-700 focus:border-[#ff5351] focus:ring-1 focus:ring-[#ff5351] outline-none transition-all"
                  placeholder="••••••••"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-[#ff5351] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:opacity-90 transition-all active:scale-[0.98] shadow-xl shadow-[#ff5351]/20 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Entrar no Sistema
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="pt-6 border-t border-zinc-800 text-center">
            <p className="text-zinc-500 text-sm font-medium">
              O BORA SELECT é restrito para convidados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
