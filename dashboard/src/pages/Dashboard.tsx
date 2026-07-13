import { useEffect, useState, useCallback, memo } from 'react';
import { api } from '../api';
import { Package, AlertTriangle, TrendingUp, DollarSign, Download, Calendar, Clock } from 'lucide-react';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import Skeleton from '../components/Skeleton';

const Dashboard = memo(function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [proceduresData, setProceduresData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'custom'>('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [chartPeriod, setChartPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [currentUser, setCurrentUser] = useState<{ name: string; role: string } | null>(null);
  const [expiringThreshold, setExpiringThreshold] = useState<'30' | '60' | '90' | 'all'>('all');

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        setCurrentUser(JSON.parse(userStr));
      } catch (e) {
        console.error('Failed to parse user from localStorage', e);
      }
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

        const [dashRes, procRes] = await Promise.all([
          api.get(`/dashboard/metrics${query}`),
          api.get('/procedures/compare')
        ]);

        setData(dashRes.data);
        
        // Transform procedure comparison data for BarChart (grouped by Cabinet)
        const compareData = procRes.data?.data || [];
        const transformedProcData = compareData.map((p: any) => {
          const expected = p.usage.reduce((sum: number, u: any) => sum + u.expectedTotal, 0);
          const actual = p.usage.reduce((sum: number, u: any) => sum + u.actualTotal, 0);
          return {
            name: p.cabinetName || p.procedureName,
            Норматив: expected,
            Факт: actual,
          };
        });
        setProceduresData(transformedProcData);

      } catch (error) {
        console.error('Failed to fetch dashboard metrics', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dateFilter, customStart, customEnd]);

  const handleExport = useCallback(async (type: 'transactions' | 'inventory' | '1c' | 'cabinets' | 'inventory-act', format: 'xlsx' | 'pdf' | 'json') => {
    try {
      setExporting(true);
      const response = await api.get(`/export/${type}?format=${format}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
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
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
              <Skeleton className="h-6 w-36 mb-6" />
              <Skeleton variant="text" count={6} className="h-12" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
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
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white" />
              <span className="text-slate-400">-</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white" />
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
        
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6 mb-8">
        <div className="glass-card rounded-2xl border-l-4 border-l-cyan-500 p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors duration-300">Всего товаров</h3>
            <div className="p-2.5 bg-cyan-50 dark:bg-cyan-900/30 rounded-xl transition-colors duration-300">
              <Package className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-800 dark:text-white transition-colors duration-300">{data?.overview?.totalItemsInStock || 0}</p>
        </div>

        {currentUser?.role !== 'STOREKEEPER' && (
          <div className="glass-card rounded-2xl border-l-4 border-l-emerald-500 p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors duration-300">Оценка склада</h3>
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl transition-colors duration-300">
                <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-slate-800 dark:text-white transition-colors duration-300">{data?.overview?.totalInventoryValue?.toLocaleString('ru-RU') || 0} ₸</p>
          </div>
        )}

        <div className="glass-card rounded-2xl border-l-4 border-l-purple-500 p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors duration-300">Уникальных позиций</h3>
            <div className="p-2.5 bg-purple-50 dark:bg-purple-900/30 rounded-xl transition-colors duration-300">
              <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-800 dark:text-white transition-colors duration-300">{data?.overview?.totalUniqueMedications || 0}</p>
        </div>

        <div className="glass-card rounded-2xl border-l-4 border-l-rose-500 p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-rose-500 dark:text-rose-400 uppercase tracking-widest transition-colors duration-300">В дефиците</h3>
            <div className="p-2.5 bg-rose-100 dark:bg-rose-900/30 rounded-xl transition-colors duration-300">
              <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 transition-colors duration-300">{data?.overview?.criticalItemsCount || 0}</p>
        </div>

        <div className="glass-card rounded-2xl border-l-4 border-l-orange-500 p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-orange-500 dark:text-orange-400 uppercase tracking-widest transition-colors duration-300">Срок &lt; 30 дней</h3>
            <div className="p-2.5 bg-orange-100 dark:bg-orange-900/30 rounded-xl transition-colors duration-300">
              <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-orange-600 dark:text-orange-400 transition-colors duration-300">{data?.overview?.expiringItemsCount || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Charts Section */}
        <div className="lg:col-span-2 space-y-8">
          
          <div className="glass-panel rounded-2xl p-6 transition-colors duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Динамика расхода</h2>
              <div className="flex bg-slate-100 dark:bg-slate-700/60 rounded-xl p-1 gap-1">
                {(['today', 'week', 'month'] as const).map((p) => (
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
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.consumptionTrend || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorConsumption" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0891B2" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#0891B2" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-100 dark:text-slate-700/50" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => new Date(val).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
                    tick={{ fontSize: 11, fill: '#64748B' }} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }} 
                    labelFormatter={(label) => new Date(label).toLocaleDateString('ru-RU')}
                  />
                  <Area type="monotone" dataKey="total" stroke="#0891B2" strokeWidth={3} fillOpacity={1} fill="url(#colorConsumption)" dot={{ r: 4, fill: '#0891B2', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6 transition-colors duration-300">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Рейтинг кабинетов (Факт vs Норматив)</h2>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={proceduresData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-100 dark:text-slate-700/50" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }} contentStyle={{ borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }} />
                  <Legend iconType="circle" />
                  <Bar dataKey="Факт" fill="#0891B2" radius={[6, 6, 0, 0]} barSize={20} />
                  <Bar dataKey="Норматив" fill="#94A3B8" radius={[6, 6, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {proceduresData.some(p => p.Факт > p.Норматив) && (
              <div className="mt-6 border-t border-slate-100 dark:border-slate-700/50 pt-4">
                <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Выявлен перерасход (превышение нормативов):
                </h3>
                <div className="space-y-2">
                  {proceduresData.filter(p => p.Факт > p.Норматив).map((p, idx) => {
                    const diff = p.Факт - p.Норматив;
                    const percent = p.Норматив > 0 ? Math.round((diff / p.Норматив) * 100) : 100;
                    return (
                      <div key={idx} className="flex justify-between items-center bg-rose-50/50 dark:bg-rose-950/20 px-4 py-2.5 rounded-xl border border-rose-100/50 dark:border-rose-900/30 text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{p.name}</span>
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          +{diff} шт. (+{percent}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          
        </div>

        {/* Right Column: TOP-10 / Critical / Expiring */}
        <div className="space-y-6 h-full">
          {/* Top 10 Consumed */}
          <div className="glass-panel rounded-2xl p-6 flex flex-col min-h-[280px] transition-colors duration-300">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Топ-10 расходных</h2>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {data?.top10Consumed?.length > 0 ? (
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

          {/* Critical Items Table */}
          <div className="glass-panel rounded-2xl p-6 flex flex-col min-h-[260px] transition-colors duration-300">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Критичные остатки</h2>
              <span className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-xs font-bold px-2.5 py-1 rounded-full">{data?.criticalItems?.length || 0} позиций</span>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {data?.criticalItems?.length > 0 ? (
                <div className="space-y-3">
                  {data.criticalItems.map((item: any, idx: number) => (
                    <div key={idx} className="flex flex-col p-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors border border-transparent hover:border-rose-100 dark:hover:border-slate-600">
                      <div className="flex justify-between items-start">
                        <div className="truncate pr-3 flex-1">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{item.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Остаток: <span className="font-bold text-rose-600">{item.quantity}</span> / норма: {item.minQuantity}</p>
                        </div>
                        {item.isExpiringSoon && (
                          <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded shrink-0">
                            СРОК!
                          </span>
                        )}
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
          {/* Expiring Items — Ф-04 */}
          <div className="glass-panel rounded-2xl p-6 flex flex-col min-h-[260px] transition-colors duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" />
                Истекают сроки
              </h2>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/60 p-0.5 rounded-lg">
                {(['30', '60', '90', 'all'] as const).map((t) => (
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
                const filteredList = data?.expiringItems?.filter((item: any) => {
                  if (expiringThreshold === 'all') return true;
                  if (expiringThreshold === '30') return item.bucket === '30';
                  if (expiringThreshold === '60') return item.bucket === '30' || item.bucket === '60';
                  if (expiringThreshold === '90') return true;
                  return true;
                }) || [];

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
                            ? 'bg-orange-100 text-orange-700'
                            : item.bucket === '60'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-slate-100 text-slate-600'
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
                      {expiringThreshold === 'all'
                        ? 'В следующие 90 дней'
                        : `В следующие ${expiringThreshold} дней`}
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal ? (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-300">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-xl border border-slate-100 dark:border-slate-700 transition-colors duration-300">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">Экспорт данных</h3>
              <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">×</button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Row 1 */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Отчет по складу</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleExport('inventory', 'xlsx')} disabled={exporting} className="flex-1 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition">Excel (XLSX)</button>
                    <button onClick={() => handleExport('inventory', 'pdf')} disabled={exporting} className="flex-1 py-2 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-lg text-sm font-medium hover:bg-rose-100 dark:hover:bg-rose-900/50 transition">PDF Документ</button>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Журнал операций</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleExport('transactions', 'xlsx')} disabled={exporting} className="flex-1 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition">Excel (XLSX)</button>
                    <button onClick={() => handleExport('transactions', 'pdf')} disabled={exporting} className="flex-1 py-2 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-lg text-sm font-medium hover:bg-rose-100 dark:hover:bg-rose-900/50 transition">PDF Документ</button>
                  </div>
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-100 dark:border-slate-700">
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Отчёт по кабинетам</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleExport('cabinets', 'xlsx')} disabled={exporting} className="flex-1 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition">Excel (XLSX)</button>
                    <button onClick={() => handleExport('cabinets', 'pdf')} disabled={exporting} className="flex-1 py-2 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-lg text-sm font-medium hover:bg-rose-100 dark:hover:bg-rose-900/50 transition">PDF Документ</button>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Акт инвентаризации</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleExport('inventory-act', 'xlsx')} disabled={exporting} className="flex-1 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition">Excel (XLSX)</button>
                    <button onClick={() => handleExport('inventory-act', 'pdf')} disabled={exporting} className="flex-1 py-2 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-lg text-sm font-medium hover:bg-rose-100 dark:hover:bg-rose-900/50 transition">PDF Документ</button>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-6 border-t border-slate-100 dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Интеграция с 1С</p>
                <button onClick={() => handleExport('1c', 'json')} disabled={exporting} className="w-full py-3 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-bold hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors">
                  Выгрузить журнал в формате JSON
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
});

export default Dashboard;
