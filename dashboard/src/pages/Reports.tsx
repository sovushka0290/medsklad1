import { useEffect, useState, useCallback, memo } from 'react';
import { api } from '../api';
import {
  ArrowDown, ArrowUp, RotateCcw, Trash2,
  Calendar, Download, ShieldCheck, History, AlertCircle,
  Package, DollarSign, Activity, AlertOctagon, FileText
} from 'lucide-react';
import Skeleton from '../components/Skeleton';

interface Transaction {
  id: number;
  type: 'INCOME' | 'OUTFLOW' | 'RETURN' | 'WRITE_OFF';
  quantity: number;
  reason: string | null;
  quantityBefore: number;
  quantityAfter: number;
  batchNumber: string | null;
  serialNumber: string | null;
  expirationDate: string | null;
  price: number | null;
  supplier: string | null;
  purpose: string | null;
  receiver: string | null;
  targetLocationId: number | null;
  createdAt: string;
  medication: { name: string; unit: string | null };
  location: { name: string };
  user: { name: string | null; role: string } | null;
}

interface AuditLog {
  id: number;
  userId: number | null;
  ipAddress: string | null;
  action: string;
  createdAt: string;
}

const TX_LABELS = {
  INCOME:    { label: 'Приёмка',   color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: ArrowDown },
  OUTFLOW:   { label: 'Выдача',    color: 'text-blue-700 bg-blue-50 border-blue-200',    icon: ArrowUp },
  RETURN:    { label: 'Возврат',   color: 'text-amber-700 bg-amber-50 border-amber-200',   icon: RotateCcw },
  WRITE_OFF: { label: 'Списание',  color: 'text-rose-700 bg-rose-50 border-rose-200',    icon: Trash2 },
};

export default memo(function ReportsPage() {
  const [txHistory, setTxHistory] = useState<Transaction[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'transactions' | 'audit'>('transactions');
  const [exporting, setExporting] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);

  // Date filter state
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'custom'>('week');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination for transactions
  const [txPage, setTxPage] = useState(1);
  const [txTotalPages, setTxTotalPages] = useState(1);

  // Pagination for audit
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);

  const [isAdminOrHeadNurse, setIsAdminOrHeadNurse] = useState(false);

  const checkUserRole = useCallback(() => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.role === 'ADMIN' || user.role === 'HEAD_NURSE') {
          setIsAdminOrHeadNurse(true);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchTransactions = useCallback(async (page: number) => {
    try {
      const res = await api.get(`/transactions?page=${page}&limit=15`);
      setTxHistory(res.data?.data || []);
      setTxTotalPages(res.data?.totalPages || 1);
    } catch (err) {
      console.error('Failed to fetch transactions', err);
    }
  }, []);

  const fetchAuditLogs = useCallback(async (page: number) => {
    try {
      const res = await api.get(`/users/audit-logs?page=${page}&limit=15`);
      setAuditLogs(res.data?.data || []);
      setAuditTotalPages(res.data?.pagination?.totalPages || 1);
    } catch (err) {
      console.error('Failed to fetch audit logs', err);
    }
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      let url = `/dashboard/metrics?filter=${dateFilter}`;
      if (dateFilter === 'custom') {
        if (!startDate || !endDate) return;
        url = `/dashboard/metrics?filter=custom&startDate=${startDate}&endDate=${endDate}`;
      }
      const res = await api.get(url);
      setMetrics(res.data);
    } catch (err) {
      console.error('Failed to fetch report metrics', err);
    }
  }, [dateFilter, startDate, endDate]);

  const loadData = useCallback(async () => {
    setLoading(true);
    checkUserRole();
    try {
      const locRes = await api.get('/locations');
      setLocations(locRes.data || []);
    } catch (e) {
      console.error('Failed to load locations in reports', e);
    }
    await Promise.all([
      fetchTransactions(txPage),
      fetchMetrics()
    ]);
    if (isAdminOrHeadNurse) {
      await fetchAuditLogs(auditPage);
    }
    setLoading(false);
  }, [txPage, auditPage, isAdminOrHeadNurse, fetchTransactions, fetchAuditLogs, fetchMetrics, checkUserRole]);

  useEffect(() => {
    loadData();
  }, [txPage, auditPage, dateFilter, startDate, endDate]);

  const handleExport = useCallback(async (type: string, format: string, extraParams: Record<string, any> = {}) => {
    setExporting(true);
    try {
      const query = new URLSearchParams({ format, ...extraParams }).toString();
      const res = await api.get(`/export/${type}?${query}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}_report.${format}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error(err);
      alert('Ошибка при экспорте отчета');
    } finally {
      setExporting(false);
    }
  }, []);

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Журналы и Отчеты</h1>
          <p className="text-slate-500 text-sm mt-1">Экспорт остатков, история складских операций, аудит безопасности</p>
        </div>
      </div>

      {/* Date Filter & Metrics Summary Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-cyan-600" />
            Статистика за период
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value as any)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="today">Сегодня</option>
              <option value="week">За неделю</option>
              <option value="month">За месяц</option>
              <option value="custom">Указать даты...</option>
            </select>
            {dateFilter === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <span className="text-slate-400">-</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            )}
          </div>
        </div>

        {metrics ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex items-center gap-4">
              <div className="p-3 bg-cyan-100 rounded-xl"><Package className="w-6 h-6 text-cyan-700" /></div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Всего запасов</p>
                <p className="text-xl font-bold text-slate-800">{metrics.overview?.totalItemsInStock || 0} шт.</p>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex items-center gap-4">
              <div className="p-3 bg-emerald-100 rounded-xl"><DollarSign className="w-6 h-6 text-emerald-700" /></div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Стоимость запасов</p>
                <p className="text-xl font-bold text-slate-800">{metrics.overview?.totalInventoryValue?.toLocaleString('ru-RU') || 0} ₸</p>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex items-center gap-4">
              <div className="p-3 bg-rose-100 rounded-xl"><AlertOctagon className="w-6 h-6 text-rose-700" /></div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Критичные остатки</p>
                <p className="text-xl font-bold text-rose-600">{metrics.overview?.criticalItemsCount || 0}</p>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-xl"><Activity className="w-6 h-6 text-purple-700" /></div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Уникальных позиций</p>
                <p className="text-xl font-bold text-slate-800">{metrics.overview?.totalUniqueMedications || 0}</p>
              </div>
            </div>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton variant="rect" count={4} className="h-20" />
          </div>
        ) : (
          <div className="text-center py-6 text-slate-400">Выберите диапазон дат для загрузки метрик</div>
        )}
      </div>

      {/* Quick Export Panel */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-8">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Download className="w-5 h-5 text-cyan-600" /> Быстрый экспорт отчётов
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-slate-100 rounded-xl p-4 bg-slate-50 flex flex-col justify-between">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Складской остаток</h3>
              <p className="text-xs text-slate-400 mt-1">Текущие запасы клиники</p>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => handleExport('inventory', 'xlsx')} disabled={exporting} className="flex-1 py-1.5 bg-cyan-600 text-white rounded-lg text-xs font-medium hover:bg-cyan-700 transition">Excel</button>
              <button onClick={() => handleExport('inventory', 'pdf')} disabled={exporting} className="flex-1 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 transition">PDF</button>
            </div>
          </div>

          <div className="border border-slate-100 rounded-xl p-4 bg-slate-50 flex flex-col justify-between">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Журнал операций</h3>
              <p className="text-xs text-slate-400 mt-1">Все приходы, списания и выдачи</p>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => handleExport('transactions', 'xlsx')} disabled={exporting} className="flex-1 py-1.5 bg-cyan-600 text-white rounded-lg text-xs font-medium hover:bg-cyan-700 transition">Excel</button>
              <button onClick={() => handleExport('transactions', 'pdf')} disabled={exporting} className="flex-1 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 transition">PDF</button>
            </div>
          </div>

          <div className="border border-slate-100 rounded-xl p-4 bg-slate-50 flex flex-col justify-between">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Расход по кабинетам</h3>
              <p className="text-xs text-slate-400 mt-1">Сводный отчёт по кабинетам</p>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => handleExport('cabinets', 'xlsx')} disabled={exporting} className="flex-1 py-1.5 bg-cyan-600 text-white rounded-lg text-xs font-medium hover:bg-cyan-700 transition">Excel</button>
              <button onClick={() => handleExport('cabinets', 'pdf')} disabled={exporting} className="flex-1 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 transition">PDF</button>
            </div>
          </div>

          <div className="border border-slate-100 rounded-xl p-4 bg-slate-50 flex flex-col justify-between">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Интеграция с 1С</h3>
              <p className="text-xs text-slate-400 mt-1">Выгрузка движений в формате 1С JSON</p>
            </div>
            <button onClick={() => handleExport('1c', 'json')} disabled={exporting} className="w-full mt-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium transition">
              Выгрузить 1С JSON
            </button>
          </div>

          <div className="border border-slate-100 rounded-xl p-4 bg-slate-50 flex flex-col justify-between">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Акт инвентаризации</h3>
              <p className="text-xs text-slate-400 mt-1">Акт в формате PDF</p>
            </div>
            <a
              href={`${api.defaults.baseURL || '/api'}/export/pdf?type=inventory-act`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full mt-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold text-center block transition-colors"
            >
              Скачать Акт инвентаризации (PDF)
            </a>
          </div>

          <div className="border border-slate-100 rounded-xl p-4 bg-slate-50 flex flex-col justify-between">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Отчет склада</h3>
              <p className="text-xs text-slate-400 mt-1">Сводный отчет в формате Excel</p>
            </div>
            <a
              href={`${api.defaults.baseURL || '/api'}/export/excel?type=inventory`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full mt-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold text-center block transition-colors"
            >
              Сводный отчет склада (Excel)
            </a>
          </div>

          <div className="border border-slate-100 rounded-xl p-4 bg-slate-50 flex flex-col justify-between">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Выгрузка 1С</h3>
              <p className="text-xs text-slate-400 mt-1">Журнал операций в формате JSON</p>
            </div>
            <a
              href={`${api.defaults.baseURL || '/api'}/export/1c`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full mt-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold text-center block transition-colors"
            >
              Выгрузка для 1С (JSON)
            </a>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 mb-6">
        <button
          onClick={() => setActiveTab('transactions')}
          className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm border-b-2 transition-all ${
            activeTab === 'transactions'
              ? 'border-cyan-600 text-cyan-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <History className="w-4 h-4" /> История складских операций
        </button>
        {isAdminOrHeadNurse && (
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm border-b-2 transition-all ${
              activeTab === 'audit'
                ? 'border-cyan-600 text-cyan-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <ShieldCheck className="w-4 h-4" /> Журнал аудита безопасности
          </button>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden p-6 space-y-4">
          <Skeleton variant="text" count={8} className="h-12" />
        </div>
      ) : activeTab === 'transactions' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Операция</th>
                  <th className="px-6 py-4">Препарат</th>
                  <th className="px-6 py-4">Количество</th>
                  <th className="px-6 py-4">Локация</th>
                  <th className="px-6 py-4">Исполнитель</th>
                  <th className="px-6 py-4">Дата</th>
                  <th className="px-6 py-4">Примечание</th>
                  <th className="px-6 py-4">Акт</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {txHistory.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-slate-400">История пуста</td>
                  </tr>
                ) : (
                  txHistory.map(tx => {
                    const labelInfo = TX_LABELS[tx.type] || { label: tx.type, color: 'text-slate-700 bg-slate-50 border-slate-200', icon: History };
                    const Icon = labelInfo.icon;
                    const targetLocName = tx.targetLocationId 
                      ? locations.find(l => l.id === tx.targetLocationId)?.name || ''
                      : '';
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/55 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${labelInfo.color}`}>
                            <Icon className="w-3.5 h-3.5" />
                            {labelInfo.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900">{tx.medication?.name}</div>
                          {tx.batchNumber || tx.serialNumber ? (
                            <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                              {tx.batchNumber && <span>Парт: {tx.batchNumber}</span>}
                              {tx.serialNumber && <span className="ml-2">Сер.№: {tx.serialNumber}</span>}
                            </div>
                          ) : null}
                          {tx.supplier || tx.price ? (
                            <div className="text-[11px] text-slate-400 font-medium">
                              {tx.supplier && <span>Пост: {tx.supplier}</span>}
                              {tx.price && <span className="ml-2">Цена: {tx.price} ₸</span>}
                            </div>
                          ) : null}
                          {tx.purpose || tx.receiver || targetLocName ? (
                            <div className="text-[11px] text-cyan-600 font-medium mt-0.5">
                              {tx.purpose && <span>Цель: {tx.purpose}</span>}
                              {tx.receiver && <span className="ml-2">Получатель: {tx.receiver}</span>}
                              {targetLocName && <span className="ml-2">{"→"} {targetLocName}</span>}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-bold">
                          {tx.type === 'INCOME' || tx.type === 'RETURN' ? '+' : '-'}{tx.quantity} {tx.medication?.unit || 'шт.'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">{tx.location?.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {tx.user?.name || 'Система'} <span className="text-[10px] text-slate-400">({tx.user?.role})</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                          {new Date(tx.createdAt).toLocaleString('ru-RU')}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate" title={tx.reason || ''}>
                          {tx.reason || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {tx.type === 'WRITE_OFF' ? (
                            <button
                              onClick={() => handleExport('write-off-act', 'pdf', { transactionId: tx.id })}
                              title="Скачать Акт списания (PDF)"
                              className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition-colors"
                            >
                              <FileText className="w-4.5 h-4.5" />
                            </button>
                          ) : '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {txTotalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center bg-slate-50">
              <button
                disabled={txPage === 1}
                onClick={() => setTxPage(p => Math.max(1, p - 1))}
                className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Назад
              </button>
              <span className="text-xs text-slate-500">Страница {txPage} из {txTotalPages}</span>
              <button
                disabled={txPage === txTotalPages}
                onClick={() => setTxPage(p => Math.min(txTotalPages, p + 1))}
                className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Вперед
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 bg-amber-50 border-b border-amber-100 flex gap-2 items-center text-amber-800 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Этот журнал содержит конфиденциальные записи системы безопасности. Доступ разрешен только руководящим ролям.</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">Пользователь ID</th>
                  <th className="px-6 py-4">Действие / Запрос</th>
                  <th className="px-6 py-4">IP Адрес</th>
                  <th className="px-6 py-4">Время события</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700 font-mono">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-slate-400 font-sans">Журнал безопасности пуст</td>
                  </tr>
                ) : (
                  auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/55 transition-colors">
                      <td className="px-6 py-4 text-xs text-slate-400">#{log.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.userId ? `User #${log.userId}` : <span className="text-slate-400">Гость</span>}
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-800 max-w-md truncate" title={log.action}>
                        {log.action}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">{log.ipAddress || 'unknown'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-sans">
                        {new Date(log.createdAt).toLocaleString('ru-RU')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {auditTotalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-100 flex justify-between items-center bg-slate-50">
              <button
                disabled={auditPage === 1}
                onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Назад
              </button>
              <span className="text-xs text-slate-500">Страница {auditPage} из {auditTotalPages}</span>
              <button
                disabled={auditPage === auditTotalPages}
                onClick={() => setAuditPage(p => Math.min(auditTotalPages, p + 1))}
                className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Вперед
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
});
