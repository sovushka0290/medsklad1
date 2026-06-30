import { useEffect, useState } from 'react';
import { api } from '../api';
import { Package, AlertTriangle, TrendingUp, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get('/dashboard/metrics');
        setData(response.data);
      } catch (error) {
        console.error('Failed to fetch dashboard metrics', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);



  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  const colors = ['#0891B2', '#0284C7', '#2563EB', '#4F46E5', '#7C3AED', '#9333EA', '#C026D3', '#DB2777', '#E11D48', '#EA580C'];

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Аналитика</h1>
          <p className="text-slate-500 text-sm mt-1">Ключевые показатели и состояние склада</p>
        </div>
      </div>
        
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Всего товаров</h3>
            <div className="p-2 bg-blue-50 rounded-lg"><Package className="h-5 w-5 text-blue-600" /></div>
          </div>
          <p className="text-3xl font-bold text-slate-800">{data?.overview.totalItemsInStock}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Оценка склада</h3>
            <div className="p-2 bg-emerald-50 rounded-lg"><DollarSign className="h-5 w-5 text-emerald-600" /></div>
          </div>
          <p className="text-3xl font-bold text-slate-800">{data?.overview.totalInventoryValue?.toLocaleString('ru-RU') || 0} ₸</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Уникальных позиций</h3>
            <div className="p-2 bg-purple-50 rounded-lg"><TrendingUp className="h-5 w-5 text-purple-600" /></div>
          </div>
          <p className="text-3xl font-bold text-slate-800">{data?.overview.totalUniqueMedications}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">В дефиците</h3>
            <div className="p-2 bg-rose-50 rounded-lg"><AlertTriangle className="h-5 w-5 text-rose-600" /></div>
          </div>
          <p className="text-3xl font-bold text-rose-600">{data?.overview.criticalItemsCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Chart Section */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-6">Топ-10 расходуемых препаратов</h2>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.top10Consumed} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="medicationName" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748B' }} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: '#F1F5F9' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                />
                <Bar dataKey="totalConsumed" radius={[6, 6, 0, 0]}>
                  {data?.top10Consumed.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Critical Items Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-800">Критичные остатки</h2>
            <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2.5 py-1 rounded-full">
              Требуют закупа
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {data?.criticalItems?.length > 0 ? (
              <div className="space-y-4">
                {data.criticalItems.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100">
                    <div className="truncate pr-4 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Остаток: {item.quantity}</p>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <p className="text-xs font-medium text-slate-400 mb-0.5">Норма</p>
                      <p className="text-sm font-bold text-slate-700">{item.minQuantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Package className="h-12 w-12 mb-3 text-slate-300" />
                <p className="text-sm">Нет дефицитных позиций</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
