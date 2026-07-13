import { useEffect, useState, useCallback, memo, useMemo } from 'react';
import { api } from '../api';
import {
  Package, AlertTriangle, TrendingUp, DollarSign, Download, Calendar, Clock,
  Zap, TrendingDown, CheckCircle, Info, BarChart2, ShoppingCart, Trash2,
  ChevronUp, ChevronDown, Minus, Barcode, FileText, Plus, ClipboardList, AlertOctagon, Activity
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import Skeleton from '../components/Skeleton';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AIInsight {
  type: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  action?: string;
}

interface FinancialMonth {
  month: string;
  purchases: number;
  expenditures: number;
  balance: number;
}

interface CabinetEfficiency {
  cabinetId: number;
  cabinetName: string;
  proceduresCount: number;
  writeOffsValue: number;
  violationsCount: number;
  violationsPercentage: number;
}

interface CriticalItem {
  id: string;
  name: string;
  quantity: number;
  minQuantity: number;
  isExpiringSoon: boolean;
  daysUntilDepletion?: number;
  avgDailyConsumption?: number;
}

interface DashboardData {
  overview: {
    totalItemsInStock: number;
    totalInventoryValue: number;
    totalUniqueMedications: number;
    criticalItemsCount: number;
    expiringItemsCount: number;
  };
  criticalItems: CriticalItem[];
  expiringItems: any[];
  top10Consumed: any[];
  consumptionTrend: any[];
  aiInsights?: AIInsight[];
  financialAnalysis?: FinancialMonth[];
  cabinetEfficiency?: CabinetEfficiency[];
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const InsightIcon = ({ type }: { type: AIInsight['type'] }) => {
  const props = { className: 'w-4 h-4 shrink-0 mt-0.5' };
  if (type === 'critical') return <AlertTriangle {...props} className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />;
  if (type === 'warning')  return <Zap          {...props} className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />;
  if (type === 'success')  return <CheckCircle  {...props} className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />;
  return                          <Info         {...props} className="w-4 h-4 shrink-0 mt-0.5 text-cyan-500" />;
};

const insightBg: Record<AIInsight['type'], string> = {
  critical: 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200/60 dark:border-rose-800/40',
  warning:  'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200/60 dark:border-amber-800/40',
  success:  'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/60 dark:border-emerald-800/40',
  info:     'bg-cyan-50/70 dark:bg-cyan-950/30 border-cyan-200/60 dark:border-cyan-800/40',
};

const ViolationBadge = ({ pct }: { pct: number }) => {
  if (pct === 0) return <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3"/>OK</span>;
  if (pct <= 10) return <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1"><Minus className="w-3 h-3"/>{pct.toFixed(1)}%</span>;
  return <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1"><ChevronUp className="w-3 h-3"/>+{pct.toFixed(1)}%</span>;
};

const CustomFinancialTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-lg text-xs">
      <p className="font-bold text-slate-700 dark:text-slate-200 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-slate-500 dark:text-slate-400">{p.name}:</span>
          <span className="font-bold text-slate-800 dark:text-slate-100">{p.value?.toLocaleString('ru-RU')} ₸</span>
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const Dashboard = memo(function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [proceduresData, setProceduresData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'custom'>('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [chartPeriod, setChartPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [currentUser, setCurrentUser] = useState<{ id: number; email: string; role: string; name: string | null } | null>(null);
  const [expiringThreshold, setExpiringThreshold] = useState<'30' | '60' | '90' | 'all'>('all');
  const [cabinetSort, setCabinetSort] = useState<'violationsPercentage' | 'writeOffsValue' | 'proceduresCount'>('violationsPercentage');
  const [cabinetSortDir, setCabinetSortDir] = useState<'asc' | 'desc'>('desc');
  // Ф-26: сравнение периодов
  const [compareMode, setCompareMode] = useState(false);

  // Списки для ролевых интерфейсов
  const [locations, setLocations] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [allProcedures, setAllProcedures] = useState<any[]>([]);


  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try { setCurrentUser(JSON.parse(userStr)); } catch (e) { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        let query = `?filter=${dateFilter}`;
        if (dateFilter === 'custom' && customStart && customEnd) {
          query = `?startDate=${customStart}&endDate=${customEnd}`;
        } else if (dateFilter === 'custom') {
          setLoading(false);
          return;
        }

        const [dashRes, procRes, locRes, medRes, procListRes] = await Promise.all([
          api.get(`/dashboard/metrics${query}`),
          api.get('/procedures/compare'),
          api.get('/locations'),
          api.get('/medications?limit=150'),
          api.get('/procedures')
        ]);

        setData(dashRes.data);
        setLocations(locRes.data || []);
        setMedications(medRes.data?.data || medRes.data || []);
        setAllProcedures(procListRes.data?.data || procListRes.data || []);

        // Ф-26: если включено сравнение периодов — запрашиваем предыдущий период
        if (compareMode) {
          try {
            const prevQuery = `?filter=${chartPeriod}&shift=prev`;
            const prevRes = await api.get(`/dashboard/metrics${prevQuery}`);
            const prevData: any[] = prevRes.data?.consumptionTrend || [];
            // Нормализуем: помещаем предыдущие значения в текущий ряд по индексу
            const currentTrend: any[] = dashRes.data?.consumptionTrend || [];
            const merged = currentTrend.map((point: any, i: number) => ({
              ...point,
              prev: prevData[i]?.total ?? null,
            }));
            setData(prev => prev ? { ...prev, consumptionTrend: merged } : prev);
          } catch (e) {
            console.error('Failed to fetch previous trend metrics', e);
          }
        }

        const compareData = procRes.data?.data || [];
        const transformedProcData = compareData.map((p: any) => {
          const expected = p.usage.reduce((sum: number, u: any) => sum + u.expectedTotal, 0);
          const actual   = p.usage.reduce((sum: number, u: any) => sum + u.actualTotal, 0);
          return { name: p.cabinetName || p.procedureName, Норматив: expected, Факт: actual };
        });
        setProceduresData(transformedProcData);
      } catch (error) {
        console.error('Failed to fetch dashboard metrics', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dateFilter, customStart, customEnd, compareMode, chartPeriod]);

  const handleExport = useCallback(async (
    type: 'transactions' | 'inventory' | '1c' | 'cabinets' | 'inventory-act',
    format: 'xlsx' | 'pdf' | 'json'
  ) => {
    try {
      setExporting(true);
      const response = await api.get(`/export/${type}?format=${format}`, { responseType: 'blob' });
      const url  = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `${type}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      setShowExportModal(false);
    } catch (error) {
      console.error('Export failed', error);
      alert('Ошибка при экспорте данных');
    } finally {
      setExporting(false);
    }
  }, []);

  const sortedCabinets = useMemo(() => {
    const list = [...(data?.cabinetEfficiency || [])];
    list.sort((a, b) => {
      const diff = (a[cabinetSort] as number) - (b[cabinetSort] as number);
      return cabinetSortDir === 'desc' ? -diff : diff;
    });
    return list;
  }, [data?.cabinetEfficiency, cabinetSort, cabinetSortDir]);

  const toggleSort = (col: typeof cabinetSort) => {
    if (cabinetSort === col) {
      setCabinetSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setCabinetSort(col);
      setCabinetSortDir('desc');
    }
  };

  const SortIcon = ({ col }: { col: 'violationsPercentage' | 'writeOffsValue' | 'proceduresCount' }) => {
    if (cabinetSort !== col) return <ChevronDown className="w-3 h-3 text-slate-300" />;
    return cabinetSortDir === 'desc'
      ? <ChevronDown className="w-3 h-3 text-cyan-500" />
      : <ChevronUp   className="w-3 h-3 text-cyan-500" />;
  };

  // ─── Loading skeleton ───────────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="p-8 space-y-6 w-full max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-10 w-44" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Skeleton variant="rect" count={4} className="h-28" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
              <Skeleton className="h-6 w-36 mb-6" />
              <Skeleton variant="rect" className="h-64" />
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
              <Skeleton className="h-6 w-48 mb-6" />
              <Skeleton variant="rect" className="h-80" />
            </div>
          </div>
          <div className="space-y-8">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
              <Skeleton className="h-6 w-36 mb-6" />
              <Skeleton variant="text" count={6} className="h-12" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  if (currentUser?.role === 'NURSE') {
    return (
      <NurseWorkspace
        user={currentUser}
        locations={locations}
        medications={medications}
        procedures={allProcedures}
      />
    );
  }

  if (currentUser?.role === 'STOREKEEPER') {
    return (
      <StorekeeperWorkspace
        user={currentUser}
        locations={locations}
        medications={medications}
        criticalItems={data?.criticalItems || []}
      />
    );
  }

  if (currentUser?.role === 'HEAD_NURSE') {
    return (
      <HeadNurseWorkspace
        user={currentUser}
        locations={locations}
        medications={medications}
        cabinetEfficiency={data?.cabinetEfficiency || []}
        proceduresData={proceduresData}
      />
    );
  }

  return (
    <>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white transition-colors duration-300">Аналитика</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 transition-colors duration-300">Ключевые показатели и состояние склада</p>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center px-3 py-2 transition-colors duration-300">
            <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500 mr-2" />
            <select
              value={dateFilter}
              onChange={(e: any) => setDateFilter(e.target.value)}
              className="bg-transparent text-sm text-slate-700 dark:text-slate-300 outline-none cursor-pointer transition-colors duration-300"
            >
              <option value="today">Сегодня</option>
              <option value="week">За неделю</option>
              <option value="month">За месяц</option>
              <option value="custom">Произвольный диапазон</option>
            </select>
          </div>

          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
              <span className="text-slate-400">-</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" />
            </div>
          )}

          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-xl shadow-sm hover:bg-cyan-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Экспорт
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6 mb-8">
        <div className="glass-card rounded-2xl border-l-4 border-l-cyan-500 p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Всего товаров</h3>
            <div className="p-2.5 bg-cyan-50 dark:bg-cyan-900/30 rounded-xl">
              <Package className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-800 dark:text-white">{data?.overview?.totalItemsInStock || 0}</p>
        </div>

        {currentUser?.role !== 'STOREKEEPER' && (
          <div className="glass-card rounded-2xl border-l-4 border-l-emerald-500 p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Оценка склада</h3>
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl">
                <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-slate-800 dark:text-white">{data?.overview?.totalInventoryValue?.toLocaleString('ru-RU') || 0} ₸</p>
          </div>
        )}

        <div className="glass-card rounded-2xl border-l-4 border-l-purple-500 p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Уникальных позиций</h3>
            <div className="p-2.5 bg-purple-50 dark:bg-purple-900/30 rounded-xl">
              <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-800 dark:text-white">{data?.overview?.totalUniqueMedications || 0}</p>
        </div>

        <div className="glass-card rounded-2xl border-l-4 border-l-rose-500 p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-rose-500 dark:text-rose-400 uppercase tracking-widest">В дефиците</h3>
            <div className="p-2.5 bg-rose-100 dark:bg-rose-900/30 rounded-xl">
              <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-rose-600 dark:text-rose-400">{data?.overview?.criticalItemsCount || 0}</p>
        </div>

        <div className="glass-card rounded-2xl border-l-4 border-l-orange-500 p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-orange-500 dark:text-orange-400 uppercase tracking-widest">Срок &lt; 30 дней</h3>
            <div className="p-2.5 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
              <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-orange-600 dark:text-orange-400">{data?.overview?.expiringItemsCount || 0}</p>
        </div>
      </div>

      {/* ── AI Insights Panel (Ф-28) ── */}
      {data?.aiInsights && data.aiInsights.length > 0 && (
        <div className="glass-panel rounded-2xl p-6 mb-8 transition-colors duration-300">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-xl">
              <Zap className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">ИИ-рекомендации</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">Автоматический анализ состояния склада</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {data.aiInsights.map((insight, idx) => (
              <div key={idx} className={`rounded-xl border p-3.5 flex gap-3 ${insightBg[insight.type]}`}>
                <InsightIcon type={insight.type} />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{insight.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed line-clamp-3">{insight.message}</p>
                  {insight.action && (
                    <p className="text-[10px] font-semibold text-cyan-600 dark:text-cyan-400 mt-1.5">→ {insight.action}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">

        {/* Left column: Charts */}
        <div className="lg:col-span-2 space-y-8">

          {/* Consumption Trend (Ф-26) */}
          <div className="glass-panel rounded-2xl p-6 transition-colors duration-300">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Динамика расхода</h2>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Переключатель периодов */}
                <div className="flex bg-slate-100 dark:bg-slate-700/60 rounded-xl p-1 gap-1">
                  {(['today', 'week', 'month'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => { setChartPeriod(p); setDateFilter(p); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                        chartPeriod === p
                          ? 'bg-white dark:bg-slate-800 text-cyan-700 dark:text-cyan-400 shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                    >
                      {p === 'today' ? 'День' : p === 'week' ? 'Неделя' : 'Месяц'}
                    </button>
                  ))}
                </div>
                {/* Ф-26: Тоггл сравнения с предыдущим периодом */}
                <button
                  onClick={() => setCompareMode(m => !m)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200 ${
                    compareMode
                      ? 'bg-violet-100 dark:bg-violet-900/30 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-400'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-violet-300 dark:hover:border-violet-700'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${ compareMode ? 'bg-violet-500' : 'bg-slate-300 dark:bg-slate-600' }`} />
                  Сравнение периодов
                </button>
              </div>
            </div>
            {compareMode && (
              <div className="flex items-center gap-4 mb-4 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-6 h-0.5 bg-cyan-500 rounded" />
                  Текущий период
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-6 h-0 border-t-2 border-dashed border-slate-400" />
                  Предыдущий период
                </span>
              </div>
            )}
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.consumptionTrend || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorConsumption" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#0891B2" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#0891B2" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorPrev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#8B5CF6" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-100 dark:text-slate-700/50" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={val => new Date(val).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}
                    labelFormatter={label => new Date(label).toLocaleDateString('ru-RU')}
                    formatter={((value: any, name: any) => [
                      `${Number(value).toLocaleString('ru-RU')} шт.`,
                      name === 'total' ? 'Текущий' : 'Предыдущий'
                    ]) as any}
                  />
                  {/* Текущий период */}
                  <Area type="monotone" dataKey="total" name="total" stroke="#0891B2" strokeWidth={3} fillOpacity={1} fill="url(#colorConsumption)" dot={{ r: 4, fill: '#0891B2', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                  {/* Ф-26: Предыдущий период — пунктирная линия */}
                  {compareMode && (
                    <Area
                      type="monotone"
                      dataKey="prev"
                      name="prev"
                      stroke="#8B5CF6"
                      strokeWidth={2}
                      strokeDasharray="5 3"
                      fillOpacity={1}
                      fill="url(#colorPrev)"
                      dot={false}
                      activeDot={{ r: 5, fill: '#8B5CF6' }}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Financial Analysis: Purchases vs Write-offs (Ф-26) */}
          {currentUser?.role !== 'NURSE' && data?.financialAnalysis && data.financialAnalysis.length > 0 && (
            <div className="glass-panel rounded-2xl p-6 transition-colors duration-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl">
                  <BarChart2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white">Финансовый анализ (6 мес.)</h2>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Закупки vs Списания — Ф-26</p>
                </div>
              </div>

              {/* Summary row */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {(() => {
                  const fin = data.financialAnalysis!;
                  const totalPurchases     = fin.reduce((s, m) => s + m.purchases, 0);
                  const totalExpenditures  = fin.reduce((s, m) => s + m.expenditures, 0);
                  const totalBalance       = totalPurchases - totalExpenditures;
                  return (
                    <>
                      <div className="bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl p-3 border border-emerald-100 dark:border-emerald-900/30">
                        <div className="flex items-center gap-1.5 mb-1">
                          <ShoppingCart className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Закупки</p>
                        </div>
                        <p className="text-lg font-extrabold text-slate-800 dark:text-white">{totalPurchases.toLocaleString('ru-RU')} ₸</p>
                      </div>
                      <div className="bg-rose-50/60 dark:bg-rose-950/20 rounded-xl p-3 border border-rose-100 dark:border-rose-900/30">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                          <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Списания</p>
                        </div>
                        <p className="text-lg font-extrabold text-slate-800 dark:text-white">{totalExpenditures.toLocaleString('ru-RU')} ₸</p>
                      </div>
                      <div className={`${totalBalance >= 0 ? 'bg-cyan-50/60 dark:bg-cyan-950/20 border-cyan-100 dark:border-cyan-900/30' : 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30'} rounded-xl p-3 border`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          {totalBalance >= 0
                            ? <TrendingDown className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                            : <TrendingDown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          }
                          <p className={`text-[10px] font-bold uppercase tracking-wider ${totalBalance >= 0 ? 'text-cyan-600 dark:text-cyan-400' : 'text-amber-600 dark:text-amber-400'}`}>Баланс</p>
                        </div>
                        <p className="text-lg font-extrabold text-slate-800 dark:text-white">{totalBalance.toLocaleString('ru-RU')} ₸</p>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.financialAnalysis} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradBalance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#0891B2" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#0891B2" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-100 dark:text-slate-700/50" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}к`} />
                    <Tooltip content={<CustomFinancialTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                    <Bar dataKey="purchases"    name="Закупки"   fill="#10B981" radius={[4,4,0,0]} barSize={18} />
                    <Bar dataKey="expenditures" name="Списания"  fill="#F43F5E" radius={[4,4,0,0]} barSize={18} />
                    <Line type="monotone" dataKey="balance" name="Баланс" stroke="#0891B2" strokeWidth={2.5} dot={{ r: 4, fill: '#0891B2', strokeWidth: 2, stroke: '#fff' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Cabinet vs Norm chart (procedures compare) */}
          <div className="glass-panel rounded-2xl p-6 transition-colors duration-300">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Рейтинг кабинетов (Факт vs Норматив)</h2>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={proceduresData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-100 dark:text-slate-700/50" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(241,245,249,0.5)' }} contentStyle={{ borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }} />
                  <Legend iconType="circle" />
                  <Bar dataKey="Факт"    fill="#0891B2" radius={[6,6,0,0]} barSize={20} />
                  <Bar dataKey="Норматив" fill="#94A3B8" radius={[6,6,0,0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {proceduresData.some(p => p.Факт > p.Норматив) && (
              <div className="mt-6 border-t border-slate-100 dark:border-slate-700/50 pt-4">
                <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Выявлен перерасход:
                </h3>
                <div className="space-y-2">
                  {proceduresData.filter(p => p.Факт > p.Норматив).map((p, idx) => {
                    const diff    = p.Факт - p.Норматив;
                    const percent = p.Норматив > 0 ? Math.round((diff / p.Норматив) * 100) : 100;
                    return (
                      <div key={idx} className="flex justify-between items-center bg-rose-50/50 dark:bg-rose-950/20 px-4 py-2.5 rounded-xl border border-rose-100/50 dark:border-rose-900/30 text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{p.name}</span>
                        <span className="font-bold text-rose-600 dark:text-rose-400">+{diff} шт. (+{percent}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Cabinet Efficiency Table (Ф-27) */}
          {sortedCabinets.length > 0 && (
            <div className="glass-panel rounded-2xl p-6 transition-colors duration-300">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 bg-cyan-50 dark:bg-cyan-900/30 rounded-xl">
                  <BarChart2 className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white">Эффективность кабинетов</h2>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Нарушения и стоимость списаний — Ф-27</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700/60">
                      <th className="text-left py-2 px-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Кабинет</th>
                      <th
                        className="text-right py-2 px-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 select-none"
                        onClick={() => toggleSort('proceduresCount')}
                      >
                        <span className="flex items-center justify-end gap-1">Процедуры <SortIcon col="proceduresCount" /></span>
                      </th>
                      <th
                        className="text-right py-2 px-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 select-none"
                        onClick={() => toggleSort('writeOffsValue')}
                      >
                        <span className="flex items-center justify-end gap-1">Сумма списаний <SortIcon col="writeOffsValue" /></span>
                      </th>
                      <th
                        className="text-right py-2 px-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 select-none"
                        onClick={() => toggleSort('violationsPercentage')}
                      >
                        <span className="flex items-center justify-end gap-1">Нарушения <SortIcon col="violationsPercentage" /></span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCabinets.map((cab, idx) => (
                      <tr
                        key={cab.cabinetId}
                        className={`border-b border-slate-50 dark:border-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${idx === 0 && cabinetSort === 'violationsPercentage' && cabinetSortDir === 'desc' && cab.violationsPercentage > 20 ? 'bg-rose-50/30 dark:bg-rose-950/10' : ''}`}
                      >
                        <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-200">{cab.cabinetName}</td>
                        <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-400">{cab.proceduresCount}</td>
                        <td className="py-3 px-3 text-right font-medium text-slate-700 dark:text-slate-300">{cab.writeOffsValue.toLocaleString('ru-RU')} ₸</td>
                        <td className="py-3 px-3 text-right"><ViolationBadge pct={cab.violationsPercentage} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right column: lists */}
        <div className="space-y-6 h-full">

          {/* Top-10 Consumed */}
          <div className="glass-panel rounded-2xl p-6 flex flex-col min-h-[280px] transition-colors duration-300">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Топ-10 расходных</h2>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {data?.top10Consumed && data.top10Consumed.length > 0 ? (
                <div className="space-y-3">
                  {data.top10Consumed.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center p-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-600">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-xs font-bold text-slate-400 w-5 shrink-0">#{idx + 1}</span>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{item.medicationName}</p>
                      </div>
                      <span className="text-sm font-bold text-cyan-700 dark:text-cyan-400 whitespace-nowrap ml-2">{item.totalConsumed} шт.</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <p className="text-sm">Нет данных для Топ-10</p>
                </div>
              )}
            </div>
          </div>

          {/* Critical Items (with daysUntilDepletion — Ф-25) */}
          <div className="glass-panel rounded-2xl p-6 flex flex-col min-h-[260px] transition-colors duration-300">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Критичные остатки</h2>
              <span className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-xs font-bold px-2.5 py-1 rounded-full">{data?.criticalItems?.length || 0} позиций</span>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {data?.criticalItems && data.criticalItems.length > 0 ? (
                <div className="space-y-3">
                  {data.criticalItems.map((item: any, idx: number) => (
                    <div key={idx} className="flex flex-col p-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors border border-transparent hover:border-rose-100 dark:hover:border-slate-600">
                      <div className="flex justify-between items-start">
                        <div className="truncate pr-2 flex-1">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{item.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Остаток: <span className="font-bold text-rose-600">{item.quantity}</span> / мин: {item.minQuantity}</p>
                          {item.daysUntilDepletion !== undefined && item.daysUntilDepletion !== null && (
                            <p className="text-xs mt-0.5">
                              <span className={`font-bold ${item.daysUntilDepletion <= 3 ? 'text-rose-600' : item.daysUntilDepletion <= 7 ? 'text-amber-600' : 'text-slate-500 dark:text-slate-400'}`}>
                                Хватит на: ~{item.daysUntilDepletion} дн.
                              </span>
                              {item.avgDailyConsumption > 0 && (
                                <span className="text-slate-400 dark:text-slate-500"> ({item.avgDailyConsumption.toFixed(1)}/сут)</span>
                              )}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {item.isExpiringSoon && (
                            <span className="text-[10px] font-bold text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 px-1.5 py-0.5 rounded">СРОК!</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <Package className="h-10 w-10 mb-2 text-slate-300" />
                  <p className="text-sm">Нет проблемных позиций</p>
                </div>
              )}
            </div>
          </div>

          {/* Expiring Items — Ф-04 */}
          <div className="glass-panel rounded-2xl p-6 flex flex-col min-h-[260px] transition-colors duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" />
                Истекают сроки
              </h2>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/60 p-0.5 rounded-lg">
                {(['30', '60', '90', 'all'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setExpiringThreshold(t)}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all duration-200 ${
                      expiringThreshold === t
                        ? 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    {t === 'all' ? 'Все' : `<${t}д`}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {(() => {
                const filteredList = (data?.expiringItems || []).filter((item: any) => {
                  if (expiringThreshold === 'all') return true;
                  if (expiringThreshold === '30') return item.bucket === '30';
                  if (expiringThreshold === '60') return item.bucket === '30' || item.bucket === '60';
                  return true;
                });

                return filteredList.length > 0 ? (
                  <div className="space-y-2.5">
                    {filteredList.slice(0, 12).map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <div className="flex-1 min-w-0 pr-3">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{item.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{item.quantity} шт. • {new Date(item.expirationDate).toLocaleDateString('ru-RU')}</p>
                        </div>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                          item.bucket === '30'
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                            : item.bucket === '60'
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                        }`}>
                          {item.daysLeft}д
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <Clock className="h-10 w-10 mb-2 text-slate-300" />
                    <p className="text-sm">Нет подходящих позиций</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {expiringThreshold === 'all' ? 'В следующие 90 дней' : `В следующие ${expiringThreshold} дней`}
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* ── Export Modal ── */}
      {showExportModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-300">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-xl border border-slate-100 dark:border-slate-700 transition-colors duration-300">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">Экспорт данных</h3>
              <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors text-xl leading-none">&times;</button>
            </div>
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Отчёт по складу</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleExport('inventory', 'xlsx')} disabled={exporting} className="flex-1 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition disabled:opacity-60">Excel</button>
                    <button onClick={() => handleExport('inventory', 'pdf')}  disabled={exporting} className="flex-1 py-2 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-lg text-sm font-medium hover:bg-rose-100 dark:hover:bg-rose-900/50 transition disabled:opacity-60">PDF</button>
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Журнал операций</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleExport('transactions', 'xlsx')} disabled={exporting} className="flex-1 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition disabled:opacity-60">Excel</button>
                    <button onClick={() => handleExport('transactions', 'pdf')}  disabled={exporting} className="flex-1 py-2 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-lg text-sm font-medium hover:bg-rose-100 dark:hover:bg-rose-900/50 transition disabled:opacity-60">PDF</button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-100 dark:border-slate-700">
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Отчёт по кабинетам</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleExport('cabinets', 'xlsx')} disabled={exporting} className="flex-1 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition disabled:opacity-60">Excel</button>
                    <button onClick={() => handleExport('cabinets', 'pdf')}  disabled={exporting} className="flex-1 py-2 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-lg text-sm font-medium hover:bg-rose-100 dark:hover:bg-rose-900/50 transition disabled:opacity-60">PDF</button>
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Акт инвентаризации</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleExport('inventory-act', 'xlsx')} disabled={exporting} className="flex-1 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition disabled:opacity-60">Excel</button>
                    <button onClick={() => handleExport('inventory-act', 'pdf')}  disabled={exporting} className="flex-1 py-2 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-lg text-sm font-medium hover:bg-rose-100 dark:hover:bg-rose-900/50 transition disabled:opacity-60">PDF</button>
                  </div>
                </div>
              </div>
              <div className="space-y-3 pt-6 border-t border-slate-100 dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Интеграция с 1С</p>
                <button onClick={() => handleExport('1c', 'json')} disabled={exporting} className="w-full py-3 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-bold hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors disabled:opacity-60">
                  Выгрузить журнал в формате JSON
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ─── 3.6: Роль Медсестра кабинета (NURSE) ────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

const NurseWorkspace = memo(function NurseWorkspace({ locations, medications, procedures }: any) {
  const [selectedCabinet, setSelectedCabinet] = useState('');
  const [selectedMedication, setSelectedMedication] = useState('');
  const [selectedProcedure, setSelectedProcedure] = useState('');
  const [outflowQty, setOutflowQty] = useState('');
  const [procedureQty, setProcedureQty] = useState('');
  const [reqQty, setReqQty] = useState('');
  const [reqComment, setReqComment] = useState('');
  
  // Barcode / Scanner
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const [todayLogs, setTodayLogs] = useState<any[]>([]);
  const [replenishHistory, setReplenishHistory] = useState<any[]>([]);

  const cabinetLocations = useMemo(() => locations.filter((l: any) => l.type === 'CABINET'), [locations]);

  useEffect(() => {
    if (cabinetLocations.length > 0 && !selectedCabinet) {
      setSelectedCabinet(cabinetLocations[0].id.toString());
    }
  }, [cabinetLocations, selectedCabinet]);

  const loadData = useCallback(async () => {
    if (!selectedCabinet) return;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [logsRes, repRes] = await Promise.all([
        api.get(`/procedures/logs?locationId=${selectedCabinet}&from=${today.toISOString()}`),
        api.get(`/replenishment?locationId=${selectedCabinet}`),
      ]);
      setTodayLogs(logsRes.data?.data || logsRes.data?.logs || []);
      setReplenishHistory(repRes.data?.data || repRes.data || []);
    } catch {}
  }, [selectedCabinet]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBarcodeScan = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMsg('');
    if (!barcode.trim()) return;

    const found = medications.find((m: any) => m.barcodes?.includes(barcode.trim()));
    if (found) {
      setSelectedMedication(found.id.toString());
      setMsg(`Препарат распознан: ${found.name}`);
      setBarcode('');
    } else {
      setError('Штрихкод не зарегистрирован в системе');
    }
  };

  const handleOutflowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCabinet || !selectedMedication || !outflowQty) {
      setError('Заполните все поля списания');
      return;
    }
    setLoading(true);
    setError('');
    setMsg('');
    try {
      await api.post('/transactions', {
        type: 'OUTFLOW',
        medicationId: Number(selectedMedication),
        locationId: Number(selectedCabinet),
        quantity: Number(outflowQty),
        reason: 'Списание медсестрой в кабинете',
        allowOverdraft: true // Важно для Ф-18 оффлайн-совместимости
      });
      setMsg('Расход успешно зафиксирован!');
      setOutflowQty('');
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Ошибка записи расхода');
    } finally {
      setLoading(false);
    }
  };

  const handleProcedureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCabinet || !selectedProcedure || !procedureQty) {
      setError('Выберите процедуру и количество');
      return;
    }
    setLoading(true);
    setError('');
    setMsg('');
    try {
      await api.post('/procedures/log', {
        procedureId: Number(selectedProcedure),
        locationId: Number(selectedCabinet),
        quantity: Number(procedureQty)
      });
      setMsg('Процедура зафиксирована. МО списаны по нормативам!');
      setProcedureQty('');
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Ошибка фиксации процедуры');
    } finally {
      setLoading(false);
    }
  };

  const handleReplenishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCabinet || !selectedMedication || !reqQty) {
      setError('Заполните поля запроса');
      return;
    }
    setLoading(true);
    setError('');
    setMsg('');
    try {
      await api.post('/replenishment', {
        medicationId: Number(selectedMedication),
        locationId: Number(selectedCabinet),
        quantity: Number(reqQty),
        comment: reqComment || undefined
      });
      setMsg('Запрос на пополнение кабинета отправлен!');
      setReqQty('');
      setReqComment('');
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Ошибка отправки запроса');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-cyan-600 to-blue-600 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="bg-cyan-500/30 text-cyan-100 text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full border border-cyan-400/20">Медсестра Кабинета</span>
          <h1 className="text-2xl font-black mt-2">Кабинетный учет и списание</h1>
          <p className="text-cyan-100 text-xs mt-1">Минимум кнопок, максимум скорости фиксации расхода по ГОСТ</p>
        </div>
        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 shrink-0">
          <Activity className="w-5 h-5 text-cyan-200" />
          <div className="text-left">
            <label className="block text-[10px] font-bold text-cyan-200 uppercase">Активный кабинет</label>
            <select
              value={selectedCabinet}
              onChange={e => setSelectedCabinet(e.target.value)}
              className="bg-transparent text-sm font-bold text-white outline-none cursor-pointer pr-4"
            >
              {cabinetLocations.map((l: any) => (
                <option key={l.id} value={l.id} className="text-slate-800">{l.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-400 text-sm rounded-2xl px-4 py-3 flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {msg && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400 text-sm rounded-2xl px-4 py-3 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Panel 1: Outflow logging & barcode scan */}
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-cyan-50 dark:bg-cyan-950/30 rounded-xl">
              <Barcode className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            </div>
            <h2 className="text-base font-bold text-slate-800 dark:text-white">Использовано сегодня</h2>
          </div>

          {/* Barcode scanner box */}
          <form onSubmit={handleBarcodeScan} className="flex gap-2">
            <input
              type="text"
              placeholder="Штрихкод с упаковки..."
              value={barcode}
              onChange={e => setBarcode(e.target.value)}
              className="flex-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            />
            <button type="submit" className="px-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-semibold shrink-0">
              Сканировать
            </button>
          </form>

          {/* Manual Outflow log */}
          <form onSubmit={handleOutflowSubmit} className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Медикамент *</label>
              <select
                value={selectedMedication}
                onChange={e => setSelectedMedication(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2.5 focus:outline-none"
              >
                <option value="">Выберите препарат...</option>
                {medications.map((m: any) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.unit || 'шт.'})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Количество *</label>
              <input
                type="number"
                min={1}
                value={outflowQty}
                onChange={e => setOutflowQty(e.target.value)}
                placeholder="Списываемое количество"
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2.5 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-sm font-bold transition disabled:opacity-60"
            >
              Записать списание со стола
            </button>
          </form>
        </div>

        {/* Panel 2: Procedures entries (automatic deduction) */}
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-base font-bold text-slate-800 dark:text-white">Ввод процедур</h2>
          </div>

          <form onSubmit={handleProcedureSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Манипуляция / Процедура *</label>
              <select
                value={selectedProcedure}
                onChange={e => setSelectedProcedure(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2.5 focus:outline-none"
              >
                <option value="">Выберите манипуляцию...</option>
                {procedures.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name} {p.standard ? `(${p.standard})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Количество процедур *</label>
              <input
                type="number"
                min={1}
                value={procedureQty}
                onChange={e => setProcedureQty(e.target.value)}
                placeholder="Сколько раз проведено"
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2.5 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition disabled:opacity-60"
            >
              Зафиксировать сеансы
            </button>
          </form>

          {/* Standards note */}
          <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/40 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            При фиксации манипуляции система автоматически спишет со склада кабинета нормативный расход препаратов, регламентированный СанПиН и ГОСТ.
          </div>
        </div>

        {/* Panel 3: Replenishment request */}
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-purple-50 dark:bg-purple-950/30 rounded-xl">
              <ClipboardList className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <h2 className="text-base font-bold text-slate-800 dark:text-white">Запрос на пополнение</h2>
          </div>

          <form onSubmit={handleReplenishSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Требуемый препарат *</label>
              <select
                value={selectedMedication}
                onChange={e => setSelectedMedication(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2.5 focus:outline-none"
              >
                <option value="">Выберите препарат...</option>
                {medications.map((m: any) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Количество *</label>
              <input
                type="number"
                min={1}
                value={reqQty}
                onChange={e => setReqQty(e.target.value)}
                placeholder="Запрашиваемое количество"
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2.5 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Комментарий к заявке</label>
              <input
                type="text"
                value={reqComment}
                onChange={e => setReqComment(e.target.value)}
                placeholder="Причина (срочно, планово...)"
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold transition disabled:opacity-60"
            >
              Отправить заявку
            </button>
          </form>
        </div>
      </div>

      {/* History tables (Bottom row) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Today's logs journal */}
        <div className="glass-panel rounded-2xl p-6">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4">Журнал процедур за сегодня</h3>
          <div className="max-h-60 overflow-y-auto pr-1 custom-scrollbar text-xs">
            {todayLogs.length === 0 ? (
              <p className="text-slate-400 text-center py-6">Сегодня процедур ещё не фиксировалось</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {todayLogs.map((l: any) => (
                  <div key={l.id} className="py-2.5 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{l.procedure?.name}</p>
                      <p className="text-[10px] text-slate-400">{new Date(l.createdAt).toLocaleTimeString('ru-RU')}</p>
                    </div>
                    <span className="font-extrabold text-cyan-600">{l.quantity} сеансов</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Replenishments requests status */}
        <div className="glass-panel rounded-2xl p-6">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4">Статус заявок на пополнение</h3>
          <div className="max-h-60 overflow-y-auto pr-1 custom-scrollbar text-xs">
            {replenishHistory.length === 0 ? (
              <p className="text-slate-400 text-center py-6">Заявок не найдено</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {replenishHistory.slice(0, 10).map((r: any) => {
                  const statusColors: any = {
                    PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400',
                    FULFILLED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400',
                    REJECTED: 'bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-400',
                  };
                  return (
                    <div key={r.id} className="py-2.5 flex justify-between items-start gap-2">
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">{r.medication?.name}</p>
                        <p className="text-[10px] text-slate-400">Кол-во: {r.quantity} • {r.comment || 'без комм.'}</p>
                      </div>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${statusColors[r.status] || ''}`}>
                        {r.status === 'PENDING' ? 'Ожидает' : r.status === 'FULFILLED' ? 'Выдано' : 'Отклонено'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ─── 3.6: Роль Кладовщик (STOREKEEPER) ───────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

const StorekeeperWorkspace = memo(function StorekeeperWorkspace({ locations, medications, criticalItems }: any) {
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [scannedMed, setScannedMed] = useState<any>(null);
  
  const [txType, setTxType] = useState<'INCOME' | 'OUTFLOW' | null>(null);
  const [txForm, setTxForm] = useState({
     quantity: '',
     batchNumber: '',
     expirationDate: '',
     serialNumber: '',
     price: '',
     supplier: '',
     reason: '',
     locationId: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);

  const mainStorage = useMemo(() => locations.find((l: any) => l.type === 'MAIN_STORAGE'), [locations]);

  useEffect(() => {
    if (mainStorage && !txForm.locationId) {
      setTxForm(f => ({ ...f, locationId: mainStorage.id.toString() }));
    }
  }, [mainStorage, txForm.locationId]);

  const loadRecent = useCallback(async () => {
    try {
      const { data } = await api.get('/transactions?limit=15');
      setRecentTransactions(data.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMsg('');
    setScannedMed(null);
    if (!barcodeSearch.trim()) return;

    const found = medications.find((m: any) => m.barcodes?.includes(barcodeSearch.trim()));
    if (found) {
      setScannedMed(found);
      setMsg(`Препарат найден: ${found.name}`);
    } else {
      setError('Препарат с таким штрихкодом не зарегистрирован');
    }
  };

  const handleTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedMed || !txType || !txForm.quantity || !txForm.locationId) {
      setError('Заполните обязательные поля');
      return;
    }
    setLoading(true);
    setError('');
    setMsg('');
    try {
      await api.post('/transactions', {
        type: txType,
        medicationId: scannedMed.id,
        locationId: Number(txForm.locationId),
        quantity: Number(txForm.quantity),
        batchNumber: txForm.batchNumber || undefined,
        expirationDate: txForm.expirationDate || undefined,
        serialNumber: txForm.serialNumber || undefined,
        price: txForm.price ? Number(txForm.price) : undefined,
        supplier: txForm.supplier || undefined,
        reason: txForm.reason || `Операция ${txType === 'INCOME' ? 'приёмки' : 'выдачи'}`
      });
      setMsg('Транзакция склада успешно проведена!');
      setTxType(null);
      setScannedMed(null);
      setBarcodeSearch('');
      setTxForm(f => ({ ...f, quantity: '', batchNumber: '', expirationDate: '', serialNumber: '', price: '', supplier: '', reason: '' }));
      loadRecent();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Ошибка проведения транзакции');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-emerald-600 to-cyan-600 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="bg-emerald-500/30 text-emerald-100 text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full border border-emerald-400/20">Кладовщик склада</span>
          <h1 className="text-2xl font-black mt-2">Панель управления операциями склада</h1>
          <p className="text-emerald-100 text-xs mt-1">Оформление приёмки, выдачи, проведение инвентаризации в реальном времени</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/inventory"
            className="flex items-center gap-2 px-5 py-3 bg-white text-emerald-700 rounded-2xl text-sm font-extrabold shadow-md hover:bg-slate-50 transition-all"
          >
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            Инвентаризация
          </a>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-400 text-sm rounded-2xl px-4 py-3 flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {msg && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400 text-sm rounded-2xl px-4 py-3 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {/* Main body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Quick scanner and transaction creator */}
        <div className="lg:col-span-2 space-y-6">
          {/* Barcode scanner card */}
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Barcode className="w-5 h-5 text-emerald-500" />
              Сканирование на главном экране
            </h3>
            
            <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="Считайте штрихкод сканером или введите вручную..."
                value={barcodeSearch}
                onChange={e => setBarcodeSearch(e.target.value)}
                className="flex-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              <button type="submit" className="px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shrink-0">
                Поиск
              </button>
            </form>

            {scannedMed && (
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/50 rounded-2xl p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-extrabold text-slate-800 dark:text-slate-200">{scannedMed.name}</h4>
                    <p className="text-xs text-slate-500 mt-1">МНН: {scannedMed.mnn || 'нет'}</p>
                    <p className="text-xs text-slate-500">Группа: {scannedMed.group || 'нет'}</p>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-xs font-bold uppercase">{scannedMed.unit || 'шт.'}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => { setTxType('INCOME'); setError(''); }}
                    className="flex-1 py-2 bg-emerald-600 text-white hover:bg-emerald-700 font-bold rounded-xl text-xs transition"
                  >
                    Приёмка (+)
                  </button>
                  <button
                    onClick={() => { setTxType('OUTFLOW'); setError(''); }}
                    className="flex-1 py-2 bg-cyan-600 text-white hover:bg-cyan-700 font-bold rounded-xl text-xs transition"
                  >
                    Выдача (-)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick operation form modal/section */}
          {txType && scannedMed && (
            <form onSubmit={handleTxSubmit} className="glass-panel rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-700/60">
                <h4 className="font-bold text-slate-800 dark:text-white">
                  Оформление: {txType === 'INCOME' ? 'Приёмка' : 'Выдача'} ({scannedMed.name})
                </h4>
                <button type="button" onClick={() => setTxType(null)} className="text-slate-400 hover:text-slate-600">&times;</button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Количество *</label>
                  <input
                    type="number"
                    min={1}
                    value={txForm.quantity}
                    onChange={e => setTxForm(f => ({ ...f, quantity: e.target.value }))}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Локация проведения *</label>
                  <select
                    value={txForm.locationId}
                    onChange={e => setTxForm(f => ({ ...f, locationId: e.target.value }))}
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                    required
                  >
                    {locations.map((l: any) => (
                      <option key={l.id} value={l.id}>{l.name} ({l.type})</option>
                    ))}
                  </select>
                </div>
              </div>

              {txType === 'INCOME' && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Номер партии</label>
                    <input
                      type="text"
                      value={txForm.batchNumber}
                      onChange={e => setTxForm(f => ({ ...f, batchNumber: e.target.value }))}
                      placeholder="Пр: B-7023"
                      className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Срок годности</label>
                    <input
                      type="date"
                      value={txForm.expirationDate}
                      onChange={e => setTxForm(f => ({ ...f, expirationDate: e.target.value }))}
                      className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Поставщик</label>
                    <input
                      type="text"
                      value={txForm.supplier}
                      onChange={e => setTxForm(f => ({ ...f, supplier: e.target.value }))}
                      placeholder="СК-Фармация..."
                      className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Серийный номер (доп.)</label>
                    <input
                      type="text"
                      value={txForm.serialNumber}
                      onChange={e => setTxForm(f => ({ ...f, serialNumber: e.target.value }))}
                      className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Обоснование / Примечание</label>
                <input
                  type="text"
                  value={txForm.reason}
                  onChange={e => setTxForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Основание..."
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setTxType(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold rounded-xl"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl disabled:opacity-50"
                >
                  {loading ? 'Проведение...' : 'Провести по складу'}
                </button>
              </div>
            </form>
          )}

          {/* Last transactions log WITHOUT cabinet financial details */}
          <div className="glass-panel rounded-2xl p-6">
            <h3 className="text-base font-bold text-slate-800 dark:text-white mb-4">Журнал последних операций склада</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700/60 pb-2 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-2.5">Тип</th>
                    <th className="py-2.5">Медикамент</th>
                    <th className="py-2.5">Кол-во</th>
                    <th className="py-2.5">Локация</th>
                    <th className="py-2.5">Дата</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700/40 text-slate-600 dark:text-slate-300 font-medium">
                  {recentTransactions.map((tx: any) => {
                    const badge: any = {
                      INCOME: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20',
                      OUTFLOW: 'text-blue-600 bg-blue-50 dark:bg-blue-950/20',
                      RETURN: 'text-amber-600 bg-amber-50 dark:bg-amber-950/20',
                      WRITE_OFF: 'text-rose-600 bg-rose-50 dark:bg-rose-950/20',
                    };
                    return (
                      <tr key={tx.id}>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded font-extrabold ${badge[tx.type] || ''}`}>{tx.type}</span>
                        </td>
                        <td className="py-2 font-bold">{tx.medication?.name}</td>
                        <td className="py-2 font-extrabold">{tx.quantity}</td>
                        <td className="py-2">{tx.location?.name}</td>
                        <td className="py-2 text-slate-400">{new Date(tx.createdAt).toLocaleString('ru-RU')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column: critical stock limit */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col h-fit">
          <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            Список критических остатков
          </h3>

          <div className="space-y-3.5 divide-y divide-slate-50 dark:divide-slate-700/60 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
            {criticalItems.length === 0 ? (
              <p className="text-slate-400 text-center py-8">Критических остатков не обнаружено</p>
            ) : (
              criticalItems.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center py-2.5 first:pt-0">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Остаток: <span className="font-extrabold text-rose-600">{item.quantity} шт.</span> (Мин: {item.minQuantity})</p>
                  </div>
                  <button
                    onClick={() => {
                       setScannedMed(medications.find((m: any) => m.id === Number(item.id)) || item);
                       setTxType('INCOME');
                    }}
                    className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-[10px] font-bold shrink-0 hover:bg-emerald-100 transition-colors"
                  >
                    Пополнить
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ─── 3.6: Роль Главная медсестра (HEAD_NURSE) ────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

const HeadNurseWorkspace = memo(function HeadNurseWorkspace({ locations, medications, cabinetEfficiency, proceduresData }: any) {
  const [replenishRequests, setReplenishRequests] = useState<any[]>([]);
  const [discrepancies, setDiscrepancies] = useState<any[]>([]);
  
  const [txModal, setTxModal] = useState(false);
  const [txForm, setTxForm] = useState({
     medicationId: '',
     locationId: '',
     quantity: '',
     reason: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const cabinetLocations = useMemo(() => locations.filter((l: any) => l.type === 'CABINET'), [locations]);

  const loadAll = useCallback(async () => {
    try {
      const [repRes, histRes] = await Promise.all([
        api.get('/replenishment'),
        api.get('/inventory/history'),
      ]);
      setReplenishRequests(repRes.data?.data || repRes.data || []);
      // Filter finished sessions that had adjustments
      setDiscrepancies(histRes.data?.sessions || []);
    } catch {}
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleResolveRequest = async (id: number, status: 'FULFILLED' | 'REJECTED') => {
     try {
       await api.patch(`/replenishment/${id}/status`, { status });
       loadAll();
     } catch (err: any) {
       alert(err?.response?.data?.error || 'Не удалось изменить статус');
     }
  };

  const handleOutflowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txForm.medicationId || !txForm.locationId || !txForm.quantity) {
       setError('Заполните обязательные поля');
       return;
    }
    setLoading(true);
    setError('');
    setMsg('');
    try {
      await api.post('/transactions', {
        type: 'OUTFLOW',
        medicationId: Number(txForm.medicationId),
        locationId: Number(txForm.locationId),
        quantity: Number(txForm.quantity),
        reason: txForm.reason || 'Выдача главной медсестры в кабинет'
      });
      setMsg('Препарат успешно выдан кабинету!');
      setTxForm({ medicationId: '', locationId: '', quantity: '', reason: '' });
      setTxModal(false);
      loadAll();
    } catch (err: any) {
       setError(err?.response?.data?.error || 'Ошибка списания');
    } finally {
       setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="bg-blue-500/30 text-blue-100 text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full border border-blue-400/20">Главная медицинская сестра</span>
          <h1 className="text-2xl font-black mt-2">Контроль расхода МО по кабинетам</h1>
          <p className="text-blue-100 text-xs mt-1">Одобрение заявок на пополнение, сравнение Факт vs ГОСТ, логи несоответствий</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setTxModal(true)}
            className="flex items-center gap-2 px-5 py-3 bg-white text-blue-700 rounded-2xl text-sm font-extrabold shadow-md hover:bg-slate-50 transition-all"
          >
            <Plus className="w-4 h-4 text-blue-600" />
            Выдать кабинету
          </button>
        </div>
      </div>

      {msg && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400 text-sm rounded-2xl px-4 py-3">
          {msg}
        </div>
      )}

      {/* Main section grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Replenishment requests queue */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-2">
            <ClipboardList className="w-5 h-5 text-blue-500" />
            Журнал обращений за МО (запросы)
          </h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700/60 pb-2 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-2">Кабинет</th>
                  <th className="py-2">Препарат</th>
                  <th className="py-2 text-center">Кол-во</th>
                  <th className="py-2">Комментарий</th>
                  <th className="py-2 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/40 text-slate-600 dark:text-slate-300 font-medium">
                {replenishRequests.filter((r: any) => r.status === 'PENDING').length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400">Нет ожидающих запросов от медсестер</td>
                  </tr>
                ) : (
                  replenishRequests.filter((r: any) => r.status === 'PENDING').map((r: any) => (
                    <tr key={r.id}>
                      <td className="py-3 font-bold text-slate-800 dark:text-slate-200">{r.location?.name}</td>
                      <td className="py-3">{r.medication?.name}</td>
                      <td className="py-3 text-center font-extrabold text-cyan-600">{r.quantity}</td>
                      <td className="py-3 text-slate-400 italic max-w-[120px] truncate">{r.comment || 'нет'}</td>
                      <td className="py-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => handleResolveRequest(r.id, 'FULFILLED')}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold px-2 py-1 rounded"
                          >
                            Выдать
                          </button>
                          <button
                            onClick={() => handleResolveRequest(r.id, 'REJECTED')}
                            className="bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold px-2 py-1 rounded"
                          >
                            Отклонить
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Discrepancy inventory logs */}
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            Список несоответствий (Инвентаризация)
          </h3>
          <div className="space-y-3 divide-y divide-slate-50 dark:divide-slate-700/60 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
             {discrepancies.length === 0 ? (
               <p className="text-slate-400 text-xs text-center py-6">Несоответствий не зарегистрировано</p>
             ) : (
               discrepancies.map((s: any, idx: number) => (
                 <div key={idx} className="pt-2 first:pt-0 text-xs">
                   <div className="flex justify-between font-bold">
                     <span>Сессия #{s.id} ({s.location?.name})</span>
                     <span className="text-slate-400">{new Date(s.createdAt).toLocaleDateString('ru-RU')}</span>
                   </div>
                   <p className="text-slate-500 mt-0.5">Оператор: {s.user?.name || 'Система'}</p>
                   {s.items && s.items.length > 0 && (
                     <div className="mt-1.5 space-y-1">
                       {s.items.filter((i: any) => i.actualQuantity !== i.systemQuantity).map((i: any, subIdx: number) => (
                         <div key={subIdx} className="flex justify-between text-[11px] bg-rose-50/50 dark:bg-rose-950/20 px-2 py-1 rounded">
                           <span>{i.medication?.name}</span>
                           <span className="font-extrabold text-rose-600">Факт: {i.actualQuantity} (Сист: {i.systemQuantity})</span>
                         </div>
                       ))}
                     </div>
                   )}
                 </div>
               ))
             )}
          </div>
        </div>
      </div>

      {/* Middle row: Fact/Norm comparison and cabinet consumption summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Comparison chart */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4">Сравнение факт/норматив расхода (ГОСТ / СанПиН)</h3>
          <div className="h-64 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={proceduresData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-100 dark:text-slate-700/50" />
                <XAxis dataKey="name" tick={{ fill: '#64748B' }} />
                <YAxis tick={{ fill: '#64748B' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Норматив" fill="#0891B2" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Факт" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cabinet efficiency summary list */}
        <div className="glass-panel rounded-2xl p-6">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4">Сводка расхода по кабинетам</h3>
          <div className="space-y-3.5 max-h-64 overflow-y-auto pr-1 custom-scrollbar text-xs">
            {cabinetEfficiency.map((c: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{c.cabinetName}</p>
                  <p className="text-[10px] text-slate-400">Процедур: {c.proceduresCount} • Списано: {c.writeOffsValue} шт.</p>
                </div>
                <span className={`px-2 py-0.5 rounded font-extrabold text-[10px] ${c.violationsPercentage > 20 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                  Превышение: {c.violationsPercentage}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Outflow Modal */}
      {txModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-xl border border-slate-100 dark:border-slate-700">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Выдать препарат кабинету</h3>
              <button onClick={() => setTxModal(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            {error && (
              <div className="mx-6 mt-4 bg-rose-50 text-rose-700 text-xs rounded-xl p-3">{error}</div>
            )}
            <form onSubmit={handleOutflowSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Медикамент *</label>
                <select
                  value={txForm.medicationId}
                  onChange={e => setTxForm(f => ({ ...f, medicationId: e.target.value }))}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2.5 focus:outline-none"
                  required
                >
                  <option value="">Выберите препарат...</option>
                  {medications.map((m: any) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Кабинет получатель *</label>
                <select
                  value={txForm.locationId}
                  onChange={e => setTxForm(f => ({ ...f, locationId: e.target.value }))}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2.5 focus:outline-none"
                  required
                >
                  <option value="">Выберите кабинет...</option>
                  {cabinetLocations.map((l: any) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Количество *</label>
                <input
                  type="number"
                  min={1}
                  value={txForm.quantity}
                  onChange={e => setTxForm(f => ({ ...f, quantity: e.target.value }))}
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Примечание</label>
                <input
                  type="text"
                  value={txForm.reason}
                  onChange={e => setTxForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Обоснование выдачи..."
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setTxModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 text-xs font-bold rounded-xl"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl"
                >
                  Выдать со склада
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────

export default Dashboard;
