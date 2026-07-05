import { useEffect, useState, useCallback, memo } from 'react';
import { api } from '../api';
import {
  FileSpreadsheet, ArrowDown, ArrowUp, RotateCcw, Trash2,
  Calendar, Download, Loader2, ShieldCheck, History, AlertTriangle, AlertCircle
} from 'lucide-react';

interface Transaction {
  id: number;
  type: 'INCOME' | 'OUTFLOW' | 'RETURN' | 'WRITE_OFF';
  quantity: number;
  reason: string | null;
  quantityBefore: number;
  quantityAfter: number;
  createdAt: string;
  medication: { name: string; unit: string | null };
  location: { name: string };
  user: { name: string | null; role: string } | null;
}

interface AuditLog {
  id: number;
  userId: number | null;
  ip: string | null;
  action: string;
  timestamp: string;
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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'transactions' | 'audit'>('transactions');
  const [exporting, setExporting] = useState(false);

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

  const loadData = useCallback(async () => {
    setLoading(true);
    checkUserRole();
    await fetchTransactions(txPage);
    if (isAdminOrHeadNurse) {
      await fetchAuditLogs(auditPage);
    }
    setLoading(false);
  }, [txPage, auditPage, isAdminOrHeadNurse, fetchTransactions, fetchAuditLogs, checkUserRole]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Lazy load tab logs
  useEffect(() => {
    if (activeTab === 'audit' && isAdminOrHeadNurse && auditLogs.length === 0) {
      fetchAuditLogs(auditPage);
    }
  }, [activeTab, isAdminOrHeadNurse, auditLogs.length, fetchAuditLogs, auditPage]);

  const handleExport = useCallback(async (type: string, format: string) => {
    setExporting(true);
    try {
      const res = await api.get(`/export/${type}?format=${format}`, { responseType: 'blob' });
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
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {txHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400">История пуста</td>
                  </tr>
                ) : (
                  txHistory.map(tx => {
                    const labelInfo = TX_LABELS[tx.type] || { label: tx.type, color: 'text-slate-700 bg-slate-50 border-slate-200', icon: History };
                    const Icon = labelInfo.icon;
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/55 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${labelInfo.color}`}>
                            <Icon className="w-3.5 h-3.5" />
                            {labelInfo.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-900">{tx.medication?.name}</td>
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
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">{log.ip || 'unknown'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-sans">
                        {new Date(log.timestamp).toLocaleString('ru-RU')}
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
