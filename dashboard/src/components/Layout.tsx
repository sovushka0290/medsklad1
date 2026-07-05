import { memo, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import { Moon, Sun } from 'lucide-react';

const Layout = memo(function Layout({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || 
           (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900 font-sans transition-colors duration-300">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Можно добавить верхний Header (AppBar) при желании */}
        <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 h-16 flex items-center justify-between px-8 shadow-sm transition-colors duration-300">
           <h2 className="text-slate-500 dark:text-slate-400 font-medium tracking-wide">Система управления складом</h2>
           <button 
             onClick={() => setIsDark(!isDark)}
             className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
           >
             {isDark ? <Sun size={20} /> : <Moon size={20} />}
           </button>
        </header>
        
        {/* Основной контент */}
        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
});

export default Layout;
