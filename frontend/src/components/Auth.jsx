import React, { useState, useEffect, useMemo } from 'react';
import { User, Lock, ShieldCheck, Cpu, ArrowRight, Eye, EyeOff, CheckCircle2, Mail, Calculator, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Auth({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  
  // Captcha Matemático
  const [mathChallenge, setMathChallenge] = useState({ n1: 0, n2: 0 });
  const [mathInput, setMathInput] = useState('');
  
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });

  // Gera novo desafio matemático ao carregar ou errar
  const generateMath = () => {
    setMathChallenge({ 
      n1: Math.floor(Math.random() * 10) + 1, 
      n2: Math.floor(Math.random() * 10) + 1 
    });
    setMathInput('');
  };

  useEffect(() => { generateMath(); }, [isLogin]);

  // Filtro de Usuário (Sem espaços ou caracteres especiais)
  const handleUsernameChange = (e) => {
    const val = e.target.value;
    // Permite apenas Letras, Números e Underline (_)
    const sanitized = val.replace(/[^a-zA-Z0-9_]/g, ''); 
    setFormData({ ...formData, username: sanitized });
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  // Cálculo de Força da Senha
  const passwordStrength = useMemo(() => {
    const pwd = formData.password;
    let score = 0;
    if (pwd.length >= 8) score += 25;
    if (/[A-Z]/.test(pwd)) score += 25;
    if (/[0-9]/.test(pwd)) score += 25;
    if (/[!@#$%^&*]/.test(pwd)) score += 25;
    return score;
  }, [formData.password]);

  const getStrengthColor = () => {
    if (passwordStrength <= 25) return 'bg-rose-600';
    if (passwordStrength <= 50) return 'bg-orange-500';
    if (passwordStrength <= 75) return 'bg-yellow-400';
    return 'bg-emerald-500'; // 100
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validação Captcha Matemático
    if (parseInt(mathInput) !== mathChallenge.n1 + mathChallenge.n2) {
        toast.error("Erro na verificação matemática! Tente novamente.");
        generateMath();
        return;
    }

    if (!isLogin && passwordStrength < 100) {
        toast.error("A senha precisa cumprir todos os requisitos.");
        return;
    }
    
    setLoading(true);
    const endpoint = isLogin ? '/auth/login' : '/auth/register';
    
    try {
      const res = await fetch(`http://127.0.0.1:5000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      
      if (!data.success) throw new Error(data.message);
      
      if (isLogin) {
        toast.success(`Bem-vindo, ${data.username}!`);
        localStorage.setItem('sniper_token', data.token);
        onLoginSuccess(data.token);
      } else {
        toast.success("Conta criada! Faça login.");
        setIsLogin(true);
        generateMath(); // Reseta para o login
        setFormData({ username: '', email: '', password: '' });
      }
    } catch (err) {
      toast.error(err.message || "Erro de conexão");
      generateMath(); // Reseta captcha para evitar spam
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans relative overflow-hidden">
      
      {/* --- BACKGROUND ANIMADO PREMIUM --- */}
      <style>{`
        .bg-grid { background-size: 40px 40px; background-image: linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px); }
        @keyframes float { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-20px) scale(1.05); } }
        @keyframes pulse-glow { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }
        .animate-float-slow { animation: float 8s ease-in-out infinite; }
        .animate-float-fast { animation: float 6s ease-in-out infinite reverse; }
      `}</style>
      
      <div className="absolute inset-0 bg-grid z-0"></div>
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/10 rounded-full blur-[120px] animate-float-slow"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[100px] animate-float-fast"></div>

      {/* CARD PRINCIPAL */}
      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-8 z-10 relative group hover:border-slate-700 transition-all">
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-800/50 rounded-2xl mb-4 shadow-lg shadow-emerald-900/20 border border-slate-700 backdrop-blur-sm group-hover:scale-110 transition-transform duration-500">
            <Cpu className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">SniperBot <span className="text-emerald-500">Pro</span></h1>
          <p className="text-slate-500 text-xs font-mono uppercase tracking-widest mt-2">Acesso Seguro v6.3</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Campo Usuário (Filtrado) */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-500 pl-1">Usuário</label>
            <div className="relative group/input">
              <User className="absolute left-3 top-3 w-5 h-5 text-slate-500 group-focus-within/input:text-emerald-500 transition-colors" />
              <input 
                type="text" 
                name="username" 
                placeholder="Seu_Usuario" 
                required 
                value={formData.username} 
                onChange={handleUsernameChange} 
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-slate-200 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all placeholder:text-slate-700" 
              />
            </div>
          </div>

          {/* Campo Email (Novo) - Só aparece no Registro */}
          {!isLogin && (
            <div className="space-y-1 animate-in slide-in-from-top-2 fade-in duration-300">
               <label className="text-[10px] uppercase font-bold text-slate-500 pl-1">Email</label>
               <div className="relative group/input">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-500 group-focus-within/input:text-emerald-500 transition-colors" />
                <input 
                    type="email" 
                    name="email" 
                    placeholder="email@exemplo.com" 
                    required 
                    value={formData.email} 
                    onChange={handleChange} 
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-slate-200 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all placeholder:text-slate-700" 
                />
               </div>
            </div>
          )}
          
          {/* Campo Senha */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-500 pl-1">Senha</label>
            <div className="relative group/input">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-500 group-focus-within/input:text-emerald-500 transition-colors" />
              <input 
                type={showPwd ? "text" : "password"} 
                name="password" 
                placeholder="••••••••" 
                required 
                value={formData.password} 
                onChange={handleChange} 
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl py-3 pl-10 pr-10 text-slate-200 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all placeholder:text-slate-700" 
              />
              <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-3 text-slate-500 hover:text-white transition-colors">
                {showPwd ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
              </button>
            </div>
          </div>

          {/* Barra de Força da Senha (Dinâmica) - Só no Registro */}
          {!isLogin && (
            <div className="space-y-2 bg-slate-950/50 p-3 rounded-lg border border-slate-800 animate-in fade-in zoom-in duration-300">
               {/* Barra Visual */}
               <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ease-out ${getStrengthColor()}`} 
                    style={{ width: `${Math.max(5, passwordStrength)}%` }}
                  ></div>
               </div>
               
               {/* Checklist */}
               <ul className="grid grid-cols-2 gap-1 pl-1 text-[10px] text-slate-500 font-mono mt-2">
                <li className={`flex items-center gap-1.5 ${formData.password.length >= 8 ? "text-emerald-400 font-bold" : ""}`}>
                    {formData.password.length >= 8 ? <CheckCircle2 className="w-3 h-3"/> : <div className="w-3 h-3 rounded-full border border-slate-600"/>} Min. 8 chars
                </li>
                <li className={`flex items-center gap-1.5 ${/[A-Z]/.test(formData.password) ? "text-emerald-400 font-bold" : ""}`}>
                    {/[A-Z]/.test(formData.password) ? <CheckCircle2 className="w-3 h-3"/> : <div className="w-3 h-3 rounded-full border border-slate-600"/>} Maiúscula
                </li>
                <li className={`flex items-center gap-1.5 ${/[0-9]/.test(formData.password) ? "text-emerald-400 font-bold" : ""}`}>
                    {/[0-9]/.test(formData.password) ? <CheckCircle2 className="w-3 h-3"/> : <div className="w-3 h-3 rounded-full border border-slate-600"/>} Número
                </li>
                <li className={`flex items-center gap-1.5 ${/[!@#$%^&*]/.test(formData.password) ? "text-emerald-400 font-bold" : ""}`}>
                    {/[!@#$%^&*]/.test(formData.password) ? <CheckCircle2 className="w-3 h-3"/> : <div className="w-3 h-3 rounded-full border border-slate-600"/>} Símbolo
                </li>
              </ul>
            </div>
          )}

          {/* Captcha Matemático (Substitui checkbox) */}
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 group focus-within:border-slate-600 transition-colors">
             <div className="flex items-center gap-2">
                 <div className="p-2 bg-slate-800 rounded-lg text-slate-400">
                    <Calculator className="w-4 h-4" />
                 </div>
                 <div className="flex flex-col">
                     <span className="text-[10px] text-slate-500 font-bold uppercase">Não sou Robô</span>
                     <span className="text-sm font-mono text-white font-bold tracking-wider">Quanto é {mathChallenge.n1} + {mathChallenge.n2} ?</span>
                 </div>
             </div>
             <input 
                type="number" 
                value={mathInput}
                onChange={(e) => setMathInput(e.target.value)}
                className="w-16 bg-slate-900 border border-slate-700 rounded-lg py-2 text-center text-emerald-400 font-bold outline-none focus:border-emerald-500 transition-colors"
                placeholder="?"
             />
          </div>

          <button disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2 group">
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : (
              <>
                {isLogin ? "ACESSAR PAINEL" : "REGISTRAR CONTA"}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button onClick={() => { setIsLogin(!isLogin); setFormData({username:'', email:'', password:''}); generateMath(); }} className="text-xs text-slate-500 hover:text-emerald-400 transition-colors">
            {isLogin ? "Não tem acesso? Crie sua conta segura" : "Já possui conta? Fazer Login"}
          </button>
        </div>

        {/* Footer */}
        <div className="absolute bottom-4 left-0 w-full text-center opacity-30 flex justify-center items-center gap-2">
           <ShieldCheck className="w-3 h-3 text-slate-500"/>
           <p className="text-[10px] text-slate-500 font-mono">256-BIT ENCRYPTION • SECURE SSL</p>
        </div>
      </div>
    </div>
  );
}