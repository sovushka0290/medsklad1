import { useEffect, useState, useCallback, memo } from 'react';
import { api } from '../api';
import {
  Package, Search, Plus, ArrowDown, ArrowUp, RotateCcw, Trash2,
  AlertTriangle, ChevronDown, ChevronUp, X, Loader2, Filter,
  ClipboardList, Play, CheckCircle, RefreshCw, Barcode, ShieldAlert
} from 'lucide-react';

type TransactionType = 'INCOME' | 'OUTFLOW' | 'RETURN' | 'WRITE_OFF';

interface Batch {
  id: number;
  quantity: number;
  price: number | null;
  supplier: string | null;
  expirationDate: string | null;
  location: { id: number; name: string };
}

interface Medication {
  id: number;
  name: string;
  mnn: string | null;
  form: string | null;
  unit: string | null;
  group: string | null;
  minQuantity: number;
  barcodes: string[];
  batches: Batch[];
}

interface Location {
  id: number;
  name: string;
  type: string;
}

interface InventoryItem {
  id: number;
  medicationId: number;
  medication: { name: string; barcodes: string[]; unit: string | null };
  expectedQuantity: number;
  actualQuantity: number | null;
  difference: number | null;
}

interface InventorySession {
  id: number;
  locationId: number;
  location: Location;
  userId: number;
  user: { id: number; name: string | null };
  status: 'ACTIVE' | 'COMPLETED';
  items: InventoryItem[];
  _count?: { items: number };
  createdAt: string;
  completedAt: string | null;
}

const TX_LABELS: Record<TransactionType, { label: string; color: string; icon: React.ElementType }> = {
  INCOME:    { label: 'Приёмка',   color: 'emerald', icon: ArrowDown },
  OUTFLOW:   { label: 'Выдача',    color: 'blue',    icon: ArrowUp },
  RETURN:    { label: 'Возврат',   color: 'amber',   icon: RotateCcw },
  WRITE_OFF: { label: 'Списание',  color: 'rose',    icon: Trash2 },
};

function ExpiryBadge({ date }: { date: string | null }) {
  if (!date) return null;
  const d = new Date(date);
  const diff = Math.ceil((d.getTime() - Date.now()) / 86400000);
  if (diff < 0) return <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded">ПРОСРОЧЕНО</span>;
  if (diff <= 30) return <span className="text-[10px] font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">≤30 дней</span>;
  if (diff <= 60) return <span className="text-[10px] font-bold text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded">≤60 дней</span>;
  return null;
}

export default memo(function InventoryPage() {
  const [activeTab, setActiveTab] = useState<'stock' | 'sessions'>('stock');
  const [meds, setMeds] = useState<Medication[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  // Inventory Session states
  const [activeSessions, setActiveSessions] = useState<InventorySession[]>([]);
  const [historySessions, setHistorySessions] = useState<InventorySession[]>([]);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [showStartSession, setShowStartSession] = useState(false);
  const [selectedLocId, setSelectedLocId] = useState('');
  const [startLoading, setStartLoading] = useState(false);
  const [startError, setStartError] = useState('');

  // Adjust modal states
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ sessionId: 0, barcode: '', quantityAdjustment: 1 });
  const [adjustError, setAdjustError] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);

  // New Medication modal
  const [showNewMed, setShowNewMed] = useState(false);
  const [newMed, setNewMed] = useState({ name: '', mnn: '', form: '', unit: '', group: '', minQuantity: 10, barcodes: '' });
  const [newMedError, setNewMedError] = useState('');
  const [savingMed, setSavingMed] = useState(false);

  // Transaction modal
  const [txModal, setTxModal] = useState<{ open: boolean; med: Medication | null; type: TransactionType }>({ open: false, med: null, type: 'INCOME' });
  const [txForm, setTxForm] = useState({ quantity: 1, locationId: '', price: '', supplier: '', expirationDate: '', serialNumber: '', reason: '' });
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [medRes, locRes] = await Promise.all([
        api.get('/medications?limit=100'),
        api.get('/locations'),
      ]);
      const data = medRes.data?.data ?? medRes.data ?? [];
      setMeds(Array.isArray(data) ? data : []);
      setLocations(Array.isArray(locRes.data) ? locRes.data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    setSessionLoading(true);
    try {
      const [activeRes, historyRes] = await Promise.all([
        api.get('/inventory/active'),
        api.get('/inventory/history'),
      ]);
      setActiveSessions(activeRes.data || []);
      setHistorySessions(historyRes.data || []);
    } catch (err) {
      console.error('Failed to fetch inventory sessions', err);
    } finally {
      setSessionLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'stock') {
      fetchData();
    } else {
      fetchSessions();
      fetchData(); // Need locations list for new sessions
    }
  }, [activeTab, fetchData, fetchSessions]);

  const groups = [...new Set(meds.map(m => m.group).filter(Boolean))] as string[];

  const filtered = meds.filter(med => {
    const totalStock = med.batches.reduce((s, b) => s + b.quantity, 0);
    if (showCriticalOnly && totalStock > med.minQuantity) return false;
    if (groupFilter && med.group !== groupFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return med.name.toLowerCase().includes(q) || med.barcodes.some(b => b.includes(q)) || med.mnn?.toLowerCase().includes(q);
    }
    return true;
  });

  const openTx = (med: Medication, type: TransactionType) => {
    setTxForm({ quantity: 1, locationId: locations[0]?.id?.toString() || '', price: '', supplier: '', expirationDate: '', serialNumber: '', reason: '' });
    setTxError('');
    setTxModal({ open: true, med, type });
  };

  const submitTx = async () => {
    if (!txModal.med) return;
    if (!txForm.locationId) { setTxError('Выберите локацию'); return; }
    setTxLoading(true);
    setTxError('');
    try {
      await api.post('/transactions', {
        type: txModal.type,
        quantity: Number(txForm.quantity),
        medicationId: txModal.med.id,
        locationId: Number(txForm.locationId),
        price: txForm.price ? Number(txForm.price) : undefined,
        supplier: txForm.supplier || undefined,
        expirationDate: txForm.expirationDate || undefined,
        serialNumber: txForm.serialNumber || undefined,
        reason: txForm.reason || undefined,
      });
      setTxModal({ open: false, med: null, type: 'INCOME' });
      await fetchData();
    } catch (err: any) {
      setTxError(err.response?.data?.error || 'Ошибка при создании операции');
    } finally {
      setTxLoading(false);
    }
  };

  const submitNewMed = async () => {
    setNewMedError('');
    if (!newMed.name.trim()) { setNewMedError('Введите название'); return; }
    if (!newMed.barcodes.trim()) { setNewMedError('Введите хотя бы один штрихкод'); return; }
    setSavingMed(true);
    try {
      const barcodes = newMed.barcodes.split(/[\n,;]+/).map(b => b.trim()).filter(Boolean);
      await api.post('/medications', {
        name: newMed.name.trim(),
        mnn: newMed.mnn.trim() || undefined,
        form: newMed.form.trim() || undefined,
        unit: newMed.unit.trim() || undefined,
        group: newMed.group.trim() || undefined,
        minQuantity: Number(newMed.minQuantity),
        barcodes,
      });
      setShowNewMed(false);
      setNewMed({ name: '', mnn: '', form: '', unit: '', group: '', minQuantity: 10, barcodes: '' });
      await fetchData();
    } catch (err: any) {
      setNewMedError(err.response?.data?.error || 'Ошибка при создании');
    } finally {
      setSavingMed(false);
    }
  };

  const handleStartSession = async () => {
    if (!selectedLocId) { setStartError('Выберите кабинет'); return; }
    setStartError('');
    setStartLoading(true);
    try {
      await api.post('/inventory/start', { locationId: Number(selectedLocId) });
      setShowStartSession(false);
      setSelectedLocId('');
      await fetchSessions();
    } catch (err: any) {
      setStartError(err.response?.data?.error || 'Не удалось начать инвентаризацию');
    } finally {
      setStartLoading(false);
    }
  };

  const handleCloseSession = async (id: number) => {
    if (!window.confirm('Вы уверены, что хотите завершить инвентаризацию? Все неучтенные остатки будут зафиксированы.')) return;
    try {
      await api.post(`/inventory/${id}/close`);
      await fetchSessions();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Ошибка завершения');
    }
  };

  const openAdjust = (sessionId: number) => {
    setAdjustForm({ sessionId, barcode: '', quantityAdjustment: 1 });
    setAdjustError('');
    setShowAdjust(true);
  };

  const submitAdjust = async () => {
    if (!adjustForm.barcode.trim()) { setAdjustError('Введите штрихкод'); return; }
    setAdjustLoading(true);
    setAdjustError('');
    try {
      await api.post(`/inventory/${adjustForm.sessionId}/adjust`, {
        barcode: adjustForm.barcode.trim(),
        quantityAdjustment: Number(adjustForm.quantityAdjustment),
      });
      setShowAdjust(false);
      await fetchSessions();
    } catch (err: any) {
      setAdjustError(err.response?.data?.error || err.message || 'Ошибка корректировки');
    } finally {
      setAdjustLoading(false);
    }
  };

  return (
    <>
      {/* Top Tabs */}
      <div className="flex border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('stock')}
          className={`px-5 py-3 font-semibold text-sm transition-all flex items-center gap-2 ${
            activeTab === 'stock'
              ? 'border-b-2 border-cyan-600 text-cyan-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Package className="w-4 h-4" />
          Остатки на складе
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`px-5 py-3 font-semibold text-sm transition-all flex items-center gap-2 ${
            activeTab === 'sessions'
              ? 'border-b-2 border-cyan-600 text-cyan-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Инвентаризация и сессии
        </button>
      </div>

      {activeTab === 'stock' ? (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Склад</h1>
              <p className="text-slate-500 text-sm mt-1">Остатки, партии, операции с медикаментами</p>
            </div>
            <button
              onClick={() => setShowNewMed(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-xl shadow-sm hover:bg-cyan-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Новый медикамент
            </button>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-6 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск по названию, МНН, штрихкоду..."
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={groupFilter}
                onChange={e => setGroupFilter(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="">Все группы</option>
                {groups.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showCriticalOnly}
                onChange={e => setShowCriticalOnly(e.target.checked)}
                className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
              />
              <span className="text-sm text-slate-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Критичные остатки
              </span>
            </label>

            <span className="ml-auto text-xs text-slate-400">{filtered.length} позиций</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Package className="w-16 h-16 mb-4 text-slate-200" />
              <p>Ничего не найдено</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(med => {
                const totalStock = med.batches.reduce((s, b) => s + b.quantity, 0);
                const isCritical = totalStock <= med.minQuantity;
                const isExp = med.batches.some(b => {
                  if (!b.expirationDate || b.quantity <= 0) return false;
                  return new Date(b.expirationDate).getTime() - Date.now() <= 30 * 86400000;
                });
                const isOpen = expanded === med.id;

                return (
                  <div key={med.id} className={`bg-white rounded-2xl shadow-sm border transition-all ${isCritical ? 'border-rose-200' : 'border-slate-100'}`}>
                    {/* Row header */}
                    <div
                      className="flex items-center px-6 py-4 cursor-pointer hover:bg-slate-50 rounded-2xl transition-colors"
                      onClick={() => setExpanded(isOpen ? null : med.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-800 truncate">{med.name}</p>
                          {med.form && <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{med.form}</span>}
                          {med.group && <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{med.group}</span>}
                          {isCritical && <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Критично</span>}
                          {isExp && <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">⏰ Срок!</span>}
                        </div>
                        {med.mnn && <p className="text-xs text-slate-400 mt-0.5">МНН: {med.mnn}</p>}
                        <p className="text-xs text-slate-400 mt-0.5">{med.barcodes.join(', ')}</p>
                      </div>

                      <div className="flex items-center gap-6 ml-4">
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Остаток</p>
                          <p className={`text-xl font-bold ${isCritical ? 'text-rose-600' : 'text-slate-800'}`}>
                            {totalStock} <span className="text-sm font-normal text-slate-400">{med.unit || 'шт.'}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Мин.</p>
                          <p className="text-sm font-medium text-slate-500">{med.minQuantity}</p>
                        </div>

                        {/* Quick action buttons */}
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                          {(['INCOME', 'OUTFLOW', 'RETURN', 'WRITE_OFF'] as TransactionType[]).map(type => {
                            const { icon: Icon, color } = TX_LABELS[type];
                            return (
                              <button
                                key={type}
                                onClick={() => openTx(med, type)}
                                title={TX_LABELS[type].label}
                                className={`p-2 rounded-lg text-${color}-600 bg-${color}-50 hover:bg-${color}-100 transition-colors`}
                              >
                                <Icon className="w-4 h-4" />
                              </button>
                            );
                          })}
                        </div>

                        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </div>

                    {/* Expanded: batch list */}
                    {isOpen && (
                      <div className="border-t border-slate-100 px-6 py-4">
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Партии</h4>
                        {med.batches.length === 0 ? (
                          <p className="text-sm text-slate-400">Нет партий</p>
                        ) : (
                          <div className="space-y-2">
                            {med.batches.map(b => (
                              <div key={b.id} className="flex items-center justify-between text-sm bg-slate-50 rounded-xl px-4 py-2">
                                <div className="flex items-center gap-3">
                                  <span className="font-medium text-slate-700">{b.location.name}</span>
                                  {b.supplier && <span className="text-slate-400">{b.supplier}</span>}
                                </div>
                                <div className="flex items-center gap-4">
                                  {b.expirationDate && (
                                    <div className="flex items-center gap-1.5">
                                      <ExpiryBadge date={b.expirationDate} />
                                      <span className="text-xs text-slate-400">до {new Date(b.expirationDate).toLocaleDateString('ru-RU')}</span>
                                    </div>
                                  )}
                                  {b.price != null && <span className="text-slate-400">{b.price} ₸</span>}
                                  <span className="font-bold text-slate-800">{b.quantity} {med.unit || 'шт.'}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Inventory Sessions Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Инвентаризация</h1>
              <p className="text-slate-500 text-sm mt-1">Создание и ведение проверок остатков по кабинетам</p>
            </div>
            <button
              onClick={() => setShowStartSession(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-xl shadow-sm hover:bg-cyan-700 transition-colors"
            >
              <Play className="w-4 h-4" />
              Начать проверку (сессию)
            </button>
          </div>

          {sessionLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
            </div>
          ) : (
            <div className="space-y-8">
              {/* Active Sessions */}
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
                  Активные проверки ({activeSessions.length})
                </h3>
                {activeSessions.length === 0 ? (
                  <div className="bg-slate-50 rounded-2xl p-6 text-center text-slate-500 border border-slate-100">
                    Нет активных проверок. Создайте новую проверку для пересчета остатков в кабинете.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeSessions.map(session => {
                      const isOpen = expandedSession === session.id;
                      return (
                        <div key={session.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                          <div
                            className="flex flex-wrap sm:flex-nowrap justify-between items-center p-6 cursor-pointer hover:bg-slate-50/50"
                            onClick={() => setExpandedSession(isOpen ? null : session.id)}
                          >
                            <div>
                              <h4 className="font-bold text-slate-800 text-lg">{session.location.name}</h4>
                              <p className="text-xs text-slate-400 mt-1">Открыл: {session.user.name || 'Сотрудник'} | Дата: {new Date(session.createdAt).toLocaleString('ru-RU')}</p>
                            </div>
                            <div className="flex items-center gap-4 mt-4 sm:mt-0" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => openAdjust(session.id)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                              >
                                <Barcode className="w-3.5 h-3.5" />
                                Корректировка
                              </button>
                              <button
                                onClick={() => handleCloseSession(session.id)}
                                className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                Завершить
                              </button>
                              {isOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                            </div>
                          </div>

                          {isOpen && (
                            <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/50">
                              <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Состояние проверки</h5>
                              {session.items && session.items.length > 0 ? (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm text-left">
                                    <thead>
                                      <tr className="text-xs text-slate-400 border-b border-slate-200">
                                        <th className="py-2">Медикамент</th>
                                        <th className="py-2 text-right">Должно быть</th>
                                        <th className="py-2 text-right">Фактически</th>
                                        <th className="py-2 text-right">Разница</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {session.items.map(item => {
                                        const diff = item.difference || 0;
                                        return (
                                          <tr key={item.id}>
                                            <td className="py-2.5 font-medium text-slate-800">{item.medication?.name || 'Неизвестный'}</td>
                                            <td className="py-2.5 text-right text-slate-500">{item.expectedQuantity}</td>
                                            <td className="py-2.5 text-right font-bold text-slate-800">{item.actualQuantity !== null ? item.actualQuantity : '-'}</td>
                                            <td className={`py-2.5 text-right font-bold ${diff < 0 ? 'text-rose-600' : diff > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                              {diff > 0 ? `+${diff}` : diff}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-sm text-slate-400">Нет товаров для сканирования. Отсканируйте первый штрихкод в мобильном приложении.</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* History Sessions */}
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-slate-400" />
                  Завершенные инвентаризации ({historySessions.length})
                </h3>
                {historySessions.length === 0 ? (
                  <div className="bg-slate-50 rounded-2xl p-6 text-center text-slate-400 border border-slate-100">
                    История пуста.
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-100">
                    {historySessions.map(session => (
                      <div key={session.id} className="p-5 flex justify-between items-center hover:bg-slate-50/30">
                        <div>
                          <h4 className="font-semibold text-slate-800">{session.location.name}</h4>
                          <p className="text-xs text-slate-400 mt-1">
                            Закрыта: {session.completedAt ? new Date(session.completedAt).toLocaleString('ru-RU') : ''} |
                            Товаров проверено: {session.items?.length || 0}
                          </p>
                        </div>
                        <span className="px-2.5 py-1 text-xs font-bold text-slate-500 bg-slate-100 rounded-full uppercase">Завершена</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Start Session Modal */}
      {showStartSession && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">Начать инвентаризацию</h3>
              <button onClick={() => setShowStartSession(false)} className="text-slate-400 hover:text-slate-600"><X /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Кабинет / Локация *</label>
                <select
                  value={selectedLocId}
                  onChange={e => setSelectedLocId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">Выберите...</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <p className="text-xs text-slate-400 mt-1.5">Сессия зафиксирует текущие книжные остатки склада в выбранном кабинете.</p>
              </div>

              {startError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {startError}
                </div>
              )}
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button onClick={() => setShowStartSession(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium">
                Отмена
              </button>
              <button onClick={handleStartSession} disabled={startLoading}
                className="flex-1 px-4 py-2.5 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 transition-colors text-sm font-medium flex items-center justify-center gap-2">
                {startLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Открыть сессию
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Modal */}
      {showAdjust && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">Ручная корректировка</h3>
              <button onClick={() => setShowAdjust(false)} className="text-slate-400 hover:text-slate-600"><X /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Штрихкод медикамента *</label>
                <input
                  type="text"
                  value={adjustForm.barcode}
                  onChange={e => setAdjustForm(f => ({ ...f, barcode: e.target.value }))}
                  placeholder="Например, 460123456789"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Изменение количества (+ или -) *</label>
                <input
                  type="number"
                  value={adjustForm.quantityAdjustment}
                  onChange={e => setAdjustForm(f => ({ ...f, quantityAdjustment: Number(e.target.value) }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <p className="text-xs text-slate-400 mt-1.5">Введите положительное число для добавления (излишек) или отрицательное для уменьшения (недостача).</p>
              </div>

              {adjustError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {adjustError}
                </div>
              )}
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button onClick={() => setShowAdjust(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium">
                Отмена
              </button>
              <button onClick={submitAdjust} disabled={adjustLoading}
                className="flex-1 px-4 py-2.5 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 transition-colors text-sm font-medium flex items-center justify-center gap-2">
                {adjustLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Применить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {txModal.open && txModal.med && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-slate-800">{TX_LABELS[txModal.type].label}</h3>
                <p className="text-sm text-slate-500 mt-0.5 truncate max-w-xs">{txModal.med.name}</p>
              </div>
              <button onClick={() => setTxModal({ open: false, med: null, type: 'INCOME' })} className="text-slate-400 hover:text-slate-600"><X /></button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Локация *</label>
                <select
                  value={txForm.locationId}
                  onChange={e => setTxForm(f => ({ ...f, locationId: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">Выберите...</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Количество *</label>
                <input
                  type="number" min={1}
                  value={txForm.quantity}
                  onChange={e => setTxForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {txModal.type === 'INCOME' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Цена (₸)</label>
                      <input type="number" value={txForm.price} onChange={e => setTxForm(f => ({ ...f, price: e.target.value }))}
                        placeholder="0.00" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Поставщик</label>
                      <input type="text" value={txForm.supplier} onChange={e => setTxForm(f => ({ ...f, supplier: e.target.value }))}
                        placeholder="ООО Фарма..." className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Срок годности</label>
                      <input type="date" value={txForm.expirationDate} onChange={e => setTxForm(f => ({ ...f, expirationDate: e.target.value }))}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Серийный №</label>
                      <input type="text" value={txForm.serialNumber} onChange={e => setTxForm(f => ({ ...f, serialNumber: e.target.value }))}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                    </div>
                  </div>
                </>
              )}

              {txModal.type === 'WRITE_OFF' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Причина списания *</label>
                  <textarea rows={3} value={txForm.reason} onChange={e => setTxForm(f => ({ ...f, reason: e.target.value }))}
                    placeholder="Истёк срок годности, повреждена упаковка..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none" />
                </div>
              )}

              {txError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {txError}
                </div>
              )}
            </div>

            <div className="p-6 pt-0 flex gap-3">
              <button onClick={() => setTxModal({ open: false, med: null, type: 'INCOME' })}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium">
                Отмена
              </button>
              <button onClick={submitTx} disabled={txLoading}
                className="flex-1 px-4 py-2.5 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60">
                {txLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {TX_LABELS[txModal.type].label}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Medication Modal */}
      {showNewMed && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">Новый медикамент</h3>
              <button onClick={() => setShowNewMed(false)} className="text-slate-400 hover:text-slate-600"><X /></button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Название *</label>
                <input type="text" value={newMed.name} onChange={e => setNewMed(m => ({ ...m, name: e.target.value }))}
                  placeholder="Лидокаин 2% р-р" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">МНН</label>
                  <input type="text" value={newMed.mnn} onChange={e => setNewMed(m => ({ ...m, mnn: e.target.value }))}
                    placeholder="Лидокаин" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Форма</label>
                  <input type="text" value={newMed.form} onChange={e => setNewMed(m => ({ ...m, form: e.target.value }))}
                    placeholder="Ампула, таблетка..." className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Единица</label>
                  <input type="text" value={newMed.unit} onChange={e => setNewMed(m => ({ ...m, unit: e.target.value }))}
                    placeholder="шт., мл, уп." className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Группа</label>
                  <input type="text" value={newMed.group} onChange={e => setNewMed(m => ({ ...m, group: e.target.value }))}
                    placeholder="Анестетики, Расходники..." className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Минимальный остаток</label>
                <input type="number" min={0} value={newMed.minQuantity} onChange={e => setNewMed(m => ({ ...m, minQuantity: Number(e.target.value) }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Штрихкоды * <span className="text-slate-400 font-normal">(через Enter или запятую)</span></label>
                <textarea rows={2} value={newMed.barcodes} onChange={e => setNewMed(m => ({ ...m, barcodes: e.target.value }))}
                  placeholder="460012345678&#10;460012345679" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none" />
              </div>

              {newMedError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {newMedError}
                </div>
              )}
            </div>

            <div className="p-6 pt-0 flex gap-3">
              <button onClick={() => setShowNewMed(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium">
                Отмена
              </button>
              <button onClick={submitNewMed} disabled={savingMed}
                className="flex-1 px-4 py-2.5 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60">
                {savingMed ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Создать
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
