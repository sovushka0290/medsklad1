import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { ShieldCheck } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('manager@medsklad.kz');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden font-sans">
      {/* Decorative gradient blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-gradient-to-br from-cyan-500/20 to-blue-600/0 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-tl from-emerald-500/15 to-cyan-600/0 rounded-full blur-[120px]" />

      <div className="relative bg-slate-900/40 backdrop-blur-xl p-10 rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] w-full max-w-md border border-slate-800/60 transition-all duration-300 hover:border-slate-700/60">
        <div className="flex justify-center mb-8">
          <div className="bg-gradient-to-tr from-cyan-500 to-blue-600 p-4 rounded-2xl shadow-lg shadow-cyan-500/25">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
        </div>
        
        <h2 className="text-3xl font-extrabold text-center bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent mb-2">
          МедСклад
        </h2>
        <p className="text-slate-400 text-center text-sm mb-8 font-medium">
          Панель управления руководителем
        </p>
        
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl mb-6 text-sm text-center backdrop-blur-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 text-white placeholder-slate-500 transition-all duration-200"
              placeholder="name@company.com"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 text-white placeholder-slate-500 transition-all duration-200"
              placeholder="••••••••"
              required
            />
          </div>
          
          <button
            type="submit"
            className="w-full mt-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition-all active:scale-[0.98]"
          >
            Войти в систему
          </button>
        </form>
      </div>
    </div>
  );
}
