import { memo, useCallback, useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FileUp, LogOut, Package,
  FileSpreadsheet, Activity, Users
} from 'lucide-react';

interface User {
  id: number;
  email: string;
  role: 'ADMIN' | 'HEAD_NURSE' | 'STOREKEEPER' | 'NURSE' | 'MANAGER';
  name: string | null;
}

const Sidebar = memo(function Sidebar() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to parse user data from localStorage', e);
    }
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  }, [navigate]);

  const allItems = [
    { name: 'Обзор', path: '/', icon: LayoutDashboard, roles: ['ADMIN', 'HEAD_NURSE', 'STOREKEEPER', 'MANAGER'] },
    { name: 'Склад', path: '/inventory', icon: Package, roles: ['ADMIN', 'HEAD_NURSE', 'STOREKEEPER', 'NURSE', 'MANAGER'] },
    { name: 'Расход по кабинетам', path: '/procedures', icon: Activity, roles: ['ADMIN', 'HEAD_NURSE', 'NURSE', 'MANAGER', 'STOREKEEPER'] },
    { name: 'Отчёты и логи', path: '/reports', icon: FileSpreadsheet, roles: ['ADMIN', 'HEAD_NURSE', 'MANAGER', 'STOREKEEPER'] },
    { name: 'Импорт из 1С/Excel', path: '/import', icon: FileUp, roles: ['ADMIN', 'STOREKEEPER'] },
    { name: 'Пользователи', path: '/users', icon: Users, roles: ['ADMIN'] },
  ];

  // Filter items based on user role
  const navItems = allItems.filter(item => {
    if (!user) return false;
    return item.roles.includes(user.role);
  });

  return (
    <div className="w-64 bg-slate-950 border-r border-slate-800/50 min-h-screen flex flex-col text-white transition-all duration-300">
      <div className="p-6 flex items-center gap-3 border-b border-slate-900">
        <div className="bg-gradient-to-tr from-cyan-500 to-blue-500 p-2.5 rounded-xl shadow-lg shadow-cyan-500/20">
          <Package className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-black tracking-wider bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">МедСклад</h1>
          <p className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest">Веб-панель</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1.5">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-400 border-l-4 border-cyan-500 shadow-[0_0_20px_-5px_rgba(6,182,212,0.2)] font-semibold'
                  : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200 hover:translate-x-1'
              }`
            }
          >
            <item.icon className="w-4.5 h-4.5" />
            <span className="text-sm font-medium">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      {user && (
        <div className="mx-4 my-2 p-4 rounded-2xl bg-slate-900/40 border border-slate-800/50 backdrop-blur-sm text-xs text-slate-400">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-slate-300 border border-slate-700/50 uppercase">
              {(user.name || user.email)[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-300 truncate">{user.name || user.email}</p>
              <p className="text-[9px] uppercase tracking-wider text-cyan-500 font-bold mt-0.5">{user.role}</p>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 border-t border-slate-900">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-3 text-slate-400 hover:text-rose-400 hover:bg-rose-500/5 rounded-xl transition-all duration-200"
        >
          <LogOut className="w-4.5 h-4.5" />
          <span className="text-sm font-medium">Выйти</span>
        </button>
      </div>
    </div>
  );
});

export default Sidebar;
