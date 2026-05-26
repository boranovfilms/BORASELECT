export const dynamic = 'force-dynamic';
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, auth, db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Mail, Lock, ArrowRight, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { clientService } from '../services/clientService';

export default function Register() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      // Force logout to ensure a clean registration session
      auth.signOut();
      setEmail(emailParam);
      validateInviteDirectly(emailParam);
    } else {
      setChecking(false);
    }
  }, [searchParams]);

  const validateInviteDirectly = async (emailToValidate: string) => {
    try {
      const cleanEmail = emailToValidate.toLowerCase().trim();
      console.log('Validating invite for:', cleanEmail);
      const q = query(collection(db, 'clients'), where('email', '==', cleanEmail));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        setIsValidated(true);
      } else {
        console.warn('No invite found for:', cleanEmail);
        toast.error('Este e-mail não possui um convite válido.');
      }
    } catch (error: any) {
      console.error('Invite validation error:', error);
      if (error.code === 'permission-denied' || error.message?.includes('permission')) {
        toast.error('Erro de permissão ao validar seu convite. O administrador precisa ajustar as regras do banco.');
      } else {
        toast.error('Erro ao validar convite: ' + (error.message || 'Erro desconhecido'));
      }
    } finally {
      setChecking(false);
    }
  };

  const validateInvite = async () => {
    // This function is still here to avoid breaking other calls, 
    // but the main logic is moved to validateInviteDirectly
    if (!email) return;
    validateInviteDirectly(email);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      const cleanEmail = email.toLowerCase().trim();
      await createUserWithEmailAndPassword(auth, cleanEmail, password);
      
      // Mark all client records with this email as confirmed
      try {
        await clientService.updateClientStatusByEmail(cleanEmail, 'confirmed');
      } catch (statusErr) {
        console.warn('Post-registration status update failed (non-blocking):', statusErr);
      }
      
      toast.success('Conta criada com sucesso!');
      navigate('/');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        // If email is in use, it means they are already registered in Firebase Auth
        // We should ensure their status is updated in Firestore just in case there was a mismatch
        try {
          await clientService.updateClientStatusByEmail(email.toLowerCase().trim(), 'confirmed');
        } catch (statusErr) {
          console.warn('Silent failure updating status for existing user:', statusErr);
        }
        toast.error('Este e-mail já possui uma conta ativa. Por favor, faça login.');
        navigate('/login');
      } else {
        toast.error('Erro ao criar conta: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#131313] flex items-center justify-center font-sans">
        <div className="w-8 h-8 border-4 border-[#ff5351] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isValidated) {
    return (
      <div className="min-h-screen bg-[#131313] flex items-center justify-center p-8 font-sans">
        <div className="max-w-md w-full bg-[#1f1f1f] border border-zinc-800 rounded-3xl p-12 text-center space-y-6">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
            <ShieldCheck className="w-10 h-10 text-[#ff5351]" />
          </div>
          <h2 className="text-3xl font-bold text-white">Acesso Negado</h2>
          <p className="text-zinc-500">
            Este sistema é exclusivo para convidados. Se você foi convidado, use o link enviado pelo administrador.
          </p>
          <button 
            onClick={() => navigate('/login')}
            className="w-full py-4 text-zinc-400 hover:text-white font-bold transition-all"
          >
            Voltar para Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#131313] flex items-center justify-center p-8 font-sans">
      <div className="max-w-md w-full space-y-10">
        <div className="space-y-3 text-center">
          <div className="flex justify-center mb-6">
             <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ff5351]" />
                <span className="text-sm font-black tracking-tighter uppercase text-white">BORA SELECT</span>
             </div>
          </div>
          <h2 className="text-4xl font-bold text-white tracking-tight">Ativar Acesso.</h2>
          <p className="text-zinc-500 font-medium">Você foi convidado! Crie sua senha para acessar seus projetos.</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">E-mail Confirmado</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-700" />
              <input 
                type="email" 
                value={email}
                disabled
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-12 pr-4 py-4 text-zinc-500 outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Crie sua Senha</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-[#ff5351] transition-colors" />
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-12 pr-12 py-4 text-white focus:border-[#ff5351] outline-none transition-all placeholder:text-zinc-700"
                placeholder="Mínimo 6 caracteres"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Confirme a Senha</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-[#ff5351] transition-colors" />
              <input 
                type={showPassword ? "text" : "password"} 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-12 pr-12 py-4 text-white focus:border-[#ff5351] outline-none transition-all placeholder:text-zinc-700"
                placeholder="Repita a senha"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-[#ff5351] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:opacity-90 transition-all shadow-xl shadow-[#ff5351]/20 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Finalizar e Acessar
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
