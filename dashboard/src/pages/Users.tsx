import { useEffect, useState, memo, useCallback } from 'react';
import { api } from '../api';
import { Users, UserPlus, Shield, Edit2, ToggleLeft, ToggleRight, X, Check, Loader2, Search, Mail, Eye, EyeOff } from 'lucide-react';
import Skeleton from '../components/Skeleton';

type Role = 'ADMIN' | 'HEAD_NURSE' | 'STOREKEEPER' | 'NURSE' | 'MANAGER';

interface UserRecord {
  id: number;
  email: string;
  name: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

const ROLE_LABELS: Record<Role, { label: string; color: string; bg: string }> = {
  ADMIN:       { label: 'Администратор', color: 'text-rose-700',    bg: 'bg-rose-50 border-rose-200' },
  HEAD_NURSE:  { label: 'Ст. медсестра', color: 'text-purple-700',  bg: 'bg-purple-50 border-purple-200' },
  STOREKEEPER: { label: 'Кладовщик',     color: 'text-cyan-700',    bg: 'bg-cyan-50 border-cyan-200' },
  NURSE:       { label: 'Медсестра',     color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  MANAGER:     { label: 'Менеджер',      color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200' },
};

const ALL_ROLES: Role[] = ['ADMIN', 'HEAD_NURSE', 'STOREKEEPER', 'NURSE', 'MANAGER'];

export default memo(function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL');

  // Create user modal
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<Role>('NURSE');
  const [newPassword, setNewPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Edit modal
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [editRole, setEditRole] = useState<Role>('NURSE');
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [togglingId, setTogglingId] = useState<number | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data.data || res.data || []);
    } catch (e) {
      console.error('Failed to load users', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filteredUsers = users.filter(u => {
    const matchSearch = !search.trim() ||
      (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const handleToggleActive = async (user: UserRecord) => {
    setTogglingId(user.id);
    try {
      await api.patch(`/users/${user.id}`, { isActive: !user.isActive });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isActive: !u.isActive } : u));
    } catch (e: any) {
      alert('Ошибка: ' + (e.response?.data?.error || e.message));
    } finally {
      setTogglingId(null);
    }
  };

  const handleCreate = async () => {
    setCreateError('');
    if (!newEmail.trim() || !newPassword.trim()) {
      setCreateError('Email и пароль обязательны');
      return;
    }
    if (newPassword.length < 6) {
      setCreateError('Пароль должен быть не менее 6 символов');
      return;
    }
    setCreating(true);
    try {
      const res = await api.post('/users', { email: newEmail, name: newName, role: newRole, password: newPassword });
      setUsers(prev => [res.data.data || res.data, ...prev]);
      setShowCreate(false);
      setNewEmail(''); setNewName(''); setNewRole('NURSE'); setNewPassword('');
    } catch (e: any) {
      setCreateError(e.response?.data?.error || 'Ошибка при создании пользователя');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (user: UserRecord) => {
    setEditUser(user);
    setEditRole(user.role);
    setEditName(user.name || '');
    setSaveError('');
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    setSaveError('');
    try {
      await api.patch(`/users/${editUser.id}`, { role: editRole, name: editName });
      setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, role: editRole, name: editName } : u));
      setEditUser(null);
    } catch (e: any) {
      setSaveError(e.response?.data?.error || 'Ошибка при сохранении');
    } finally {
      setSaving(false);
    }
  };

  const activeCount  = users.filter(u => u.isActive).length;
  const totalCount   = users.length;
  const roleGroups   = ALL_ROLES.reduce((acc, r) => ({ ...acc, [r]: users.filter(u => u.role === r).length }), {} as Record<Role, number>);

  if (loading) {
    return (
      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} variant="rect" className="h-24" />)}
        </div>
        <Skeleton variant="rect" className="h-72" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-cyan-500" />
            Управление пользователями
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Всего {totalCount} пользователей · {activeCount} активных
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          Создать пользователя
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {ALL_ROLES.map(role => {
          const meta = ROLE_LABELS[role];
          return (
            <div
              key={role}
              onClick={() => setRoleFilter(prev => prev === role ? 'ALL' : role)}
              className={`cursor-pointer p-4 rounded-2xl border-2 transition-all ${
                roleFilter === role
                  ? `${meta.bg} border-current`
                  : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-slate-300'
              }`}
            >
              <p className={`text-2xl font-black ${meta.color}`}>{roleGroups[role]}</p>
              <p className={`text-xs font-semibold mt-1 ${roleFilter === role ? meta.color : 'text-slate-500'}`}>
                {meta.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Search + filter */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по имени или email..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-cyan-400"
          />
        </div>
        {(search || roleFilter !== 'ALL') && (
          <button
            onClick={() => { setSearch(''); setRoleFilter('ALL'); }}
            className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50"
          >
            <X className="w-3 h-3" /> Сбросить
          </button>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
                <th className="text-left px-5 py-3.5 text-xs font-bold uppercase text-slate-500 tracking-wider">Пользователь</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold uppercase text-slate-500 tracking-wider">Роль</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold uppercase text-slate-500 tracking-wider">Статус</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold uppercase text-slate-500 tracking-wider">Создан</th>
                <th className="text-right px-5 py-3.5 text-xs font-bold uppercase text-slate-500 tracking-wider">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Пользователи не найдены
                  </td>
                </tr>
              ) : filteredUsers.map(user => {
                const roleMeta = ROLE_LABELS[user.role];
                return (
                  <tr key={user.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center font-bold text-white text-sm shrink-0">
                          {(user.name || user.email)[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{user.name || '—'}</p>
                          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3" />{user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${roleMeta.bg} ${roleMeta.color}`}>
                        <Shield className="w-3 h-3" />
                        {roleMeta.label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {user.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                          <Check className="w-3 h-3" /> Активен
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                          Заблокирован
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-400 text-xs">
                      {new Date(user.createdAt).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => openEdit(user)}
                          title="Редактировать"
                          className="p-2 rounded-lg text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(user)}
                          disabled={togglingId === user.id}
                          title={user.isActive ? 'Заблокировать' : 'Активировать'}
                          className={`p-2 rounded-lg transition-colors ${
                            user.isActive
                              ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {togglingId === user.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : user.isActive
                              ? <ToggleRight className="w-4 h-4" />
                              : <ToggleLeft className="w-4 h-4" />
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-xl border border-slate-100 dark:border-slate-700">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-cyan-500" /> Новый пользователь
              </h3>
              <button onClick={() => { setShowCreate(false); setCreateError(''); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Email *</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  className="mt-1.5 w-full px-4 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-cyan-400"
                  placeholder="user@clinic.kz"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Имя</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="mt-1.5 w-full px-4 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-cyan-400"
                  placeholder="Иванова Анна Петровна"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Роль</label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as Role)}
                  className="mt-1.5 w-full px-4 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-cyan-400"
                >
                  {ALL_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r].label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Пароль *</label>
                <div className="relative mt-1.5">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2.5 pr-10 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-cyan-400"
                    placeholder="Мин. 6 символов"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {createError && (
                <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">{createError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowCreate(false); setCreateError(''); }}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Создать
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-xl border border-slate-100 dark:border-slate-700">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-cyan-500" /> Редактировать
              </h3>
              <button onClick={() => setEditUser(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Имя</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="mt-1.5 w-full px-4 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Роль</label>
                <select
                  value={editRole}
                  onChange={e => setEditRole(e.target.value as Role)}
                  className="mt-1.5 w-full px-4 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-cyan-400"
                >
                  {ALL_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r].label}</option>)}
                </select>
              </div>

              {saveError && (
                <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">{saveError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditUser(null)}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
