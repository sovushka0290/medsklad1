import { memo } from 'react';
import type { ReactNode } from 'react';
import Sidebar from './Sidebar';

const Layout = memo(function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Можно добавить верхний Header (AppBar) при желании */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center px-8 shadow-sm">
           <h2 className="text-slate-500 font-medium tracking-wide">Система управления складом</h2>
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
