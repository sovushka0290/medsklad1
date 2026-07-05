import { useEffect, useState, useCallback, memo } from 'react';
import { api } from '../api';
import { Package, AlertTriangle, TrendingUp, DollarSign, Download, Calendar } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const Dashboard = memo(function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [proceduresData, setProceduresData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'custom'>('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

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
          api.get('/procedures/compare') // FIX: was /procedures/comparison (wrong URL)
        ]);

        setData(dashRes.data);
        
        // Transform procedure comparison data for BarChart (grouped by Cabinet)
        const transformedProcData = procRes.data.map((p: any) => {
          const expected = p.usage.reduce((sum: number, u: any) => sum + u.expectedTotal, 0);
          const actual = p.usage.reduce((sum: number, u: any) => sum + u.actualTotal, 0);
          return {
            name: p.cabinetName || p.procedureName, // use cabinetName
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
      </div>
    );
  }


  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Аналитика</h1>
          <p className="text-slate-500 text-sm mt-1">Ключевые показатели и состояние склада</p>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative border border-slate-200 rounded-xl bg-white shadow-sm flex items-center px-3 py-2">
            <Calendar className="w-4 h-4 text-slate-400 mr-2" />
            <select 
              value={dateFilter} 
              onChange={(e: any) => setDateFilter(e.target.value)}
              className="bg-transparent text-sm text-slate-700 outline-none cursor-pointer"
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
        
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Всего товаров</h3>
            <div className="p-2 bg-blue-50 rounded-lg"><Package className="h-5 w-5 text-blue-600" /></div>
          </div>
          <p className="text-3xl font-bold text-slate-800">{data?.overview?.totalItemsInStock || 0}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Оценка склада</h3>
            <div className="p-2 bg-emerald-50 rounded-lg"><DollarSign className="h-5 w-5 text-emerald-600" /></div>
          </div>
          <p className="text-3xl font-bold text-slate-800">{data?.overview?.totalInventoryValue?.toLocaleString('ru-RU') || 0} ₸</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Уникальных позиций</h3>
            <div className="p-2 bg-purple-50 rounded-lg"><TrendingUp className="h-5 w-5 text-purple-600" /></div>
          </div>
          <p className="text-3xl font-bold text-slate-800">{data?.overview?.totalUniqueMedications || 0}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">В дефиците</h3>
            <div className="p-2 bg-rose-50 rounded-lg"><AlertTriangle className="h-5 w-5 text-rose-600" /></div>
          </div>
          <p className="text-3xl font-bold text-rose-600">{data?.overview?.criticalItemsCount || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Charts Section */}
        <div className="lg:col-span-2 space-y-8">
          
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-6">Динамика расхода</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.consumptionTrend || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => new Date(val).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
                    tick={{ fontSize: 12, fill: '#64748B' }} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis tick={{ fontSize: 12, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                    labelFormatter={(label) => new Date(label).toLocaleDateString('ru-RU')}
                  />
                  <Line type="monotone" dataKey="total" stroke="#0891B2" strokeWidth={3} dot={{ r: 4, fill: '#0891B2', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-6">Рейтинг кабинетов (Факт vs Норматив)</h2>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={proceduresData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend />
                  <Bar dataKey="Факт" fill="#0891B2" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Норматив" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
        </div>

        {/* Right Column: TOP-10 and Critical Items */}
        <div className="space-y-8 h-full">
          {/* Top 10 Consumed */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col h-1/2 min-h-[300px]">
            <h2 className="text-lg font-bold text-slate-800 mb-6">Топ-10 расходных</h2>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {data?.top10Consumed?.length > 0 ? (
                <div className="space-y-4">
                  {data.top10Consumed.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100">
                      <div className="truncate pr-4 flex-1">
                        <p className="text-sm font-semibold text-slate-800 truncate">{item.medicationName}</p>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <p className="text-sm font-bold text-slate-700">{item.totalConsumed}</p>
                      </div>
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
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col h-1/2 min-h-[300px]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-800">Критичные остатки</h2>
              <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2.5 py-1 rounded-full">Требуют внимания</span>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {data?.criticalItems?.length > 0 ? (
                <div className="space-y-4">
                  {data.criticalItems.map((item: any, idx: number) => (
                    <div key={idx} className="flex flex-col p-3 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100">
                      <div className="flex justify-between items-start">
                        <div className="truncate pr-4 flex-1">
                          <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">Остаток: {item.quantity}</p>
                        </div>
                        <div className="text-right whitespace-nowrap">
                          <p className="text-xs font-medium text-slate-400 mb-0.5">Норма</p>
                          <p className="text-sm font-bold text-slate-700">{item.minQuantity}</p>
                        </div>
                      </div>
                      {item.isExpiringSoon && (
                        <div className="mt-2 text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded w-max">
                          ИСТЕКАЕТ СРОК!
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <Package className="h-12 w-12 mb-3 text-slate-300" />
                  <p className="text-sm">Нет проблемных позиций</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal ? (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-xl border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">Экспорт данных</h3>
              <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-slate-600">×</button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Row 1 */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Отчет по складу</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleExport('inventory', 'xlsx')} disabled={exporting} className="flex-1 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition">Excel (XLSX)</button>
                    <button onClick={() => handleExport('inventory', 'pdf')} disabled={exporting} className="flex-1 py-2 bg-rose-50 text-rose-700 rounded-lg text-sm font-medium hover:bg-rose-100 transition">PDF Документ</button>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Журнал операций</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleExport('transactions', 'xlsx')} disabled={exporting} className="flex-1 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition">Excel (XLSX)</button>
                    <button onClick={() => handleExport('transactions', 'pdf')} disabled={exporting} className="flex-1 py-2 bg-rose-50 text-rose-700 rounded-lg text-sm font-medium hover:bg-rose-100 transition">PDF Документ</button>
                  </div>
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-100">
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Отчёт по кабинетам</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleExport('cabinets', 'xlsx')} disabled={exporting} className="flex-1 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition">Excel (XLSX)</button>
                    <button onClick={() => handleExport('cabinets', 'pdf')} disabled={exporting} className="flex-1 py-2 bg-rose-50 text-rose-700 rounded-lg text-sm font-medium hover:bg-rose-100 transition">PDF Документ</button>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Акт инвентаризации</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleExport('inventory-act', 'xlsx')} disabled={exporting} className="flex-1 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition">Excel (XLSX)</button>
                    <button onClick={() => handleExport('inventory-act', 'pdf')} disabled={exporting} className="flex-1 py-2 bg-rose-50 text-rose-700 rounded-lg text-sm font-medium hover:bg-rose-100 transition">PDF Документ</button>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-6 border-t border-slate-100">
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Интеграция с 1С</p>
                <button onClick={() => handleExport('1c', 'json')} disabled={exporting} className="w-full py-3 bg-amber-50 text-amber-700 rounded-lg text-sm font-bold hover:bg-amber-100 transition">
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
