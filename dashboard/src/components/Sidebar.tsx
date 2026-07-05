import { memo, useCallback, useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FileUp, LogOut, Package,
  FileSpreadsheet, Activity, ShieldAlert
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
    { name: 'Расход по кабинетам', path: '/procedures', icon: Activity, roles: ['ADMIN', 'HEAD_NURSE', 'NURSE', 'MANAGER'] },
    { name: 'Отчёты и логи', path: '/reports', icon: FileSpreadsheet, roles: ['ADMIN', 'HEAD_NURSE', 'MANAGER'] },
    { name: 'Импорт из 1С/Excel', path: '/import', icon: FileUp, roles: ['ADMIN', 'STOREKEEPER'] },
  ];

  // Filter items based on user role
  const navItems = allItems.filter(item => {
    if (!user) return false;
    return item.roles.includes(user.role);
  });

  return (
    <div className="w-64 bg-slate-900 min-h-screen flex flex-col text-white transition-all duration-300">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800">
        <div className="bg-cyan-500 p-2 rounded-lg">
          <Package className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-wider text-white">МедСклад</h1>
          <p className="text-xs text-slate-400">Веб-панель</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-cyan-600/20 text-cyan-400 shadow-[inset_4px_0_0_0_rgb(6,182,212)]'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      {user && (
        <div className="px-6 py-3 border-t border-slate-800/60 bg-slate-950/40 text-xs text-slate-400">
          <p className="font-semibold text-slate-300 truncate">{user.name || user.email}</p>
          <p className="text-[10px] uppercase tracking-wider text-cyan-500 font-bold mt-0.5">{user.role}</p>
        </div>
      )}

      <div className="p-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-3 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Выйти</span>
        </button>
      </div>
    </div>
  );
});

export default Sidebar;
