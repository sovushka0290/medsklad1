import { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { api } from '../api';
import {
  FileText, Plus, Activity, AlertTriangle, X, Loader2, ShieldAlert,
  TrendingUp, BarChart2, CheckCircle, Download, Filter, RefreshCw
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Skeleton from '../components/Skeleton';

interface ProcedureNorm {
  id: number;
  medicationId: number;
  expectedQuantity: number;
  tolerancePercent: number;
  medication: { name: string };
}

interface Procedure {
  id: number;
  name: string;
  description: string | null;
  standard: string | null;
  norms: ProcedureNorm[];
}

interface ComparisonUsage {
  medicationId: number;
  medicationName: string;
  normPerManipulation: number;
  expectedTotal: number;
  actualTotal: number;
  deviationAbs: number;
  deviationPct: number;
  isViolation: boolean;
  minAllowed: number;
  maxAllowed: number;
  tolerancePercent: number;
}

interface ProcedureComparison {
  locationId: number;
  cabinetName: string;
  procedureId: number;
  procedureName: string;
  procedureStandard: string | null;
  timesPerformed: number;
  usage: ComparisonUsage[];
}

interface Location {
  id: number;
  name: string;
}

interface UserInfo {
  id: number;
  name: string;
  role: string;
}

interface ProcedureLogItem {
  id: number;
  procedureId: number;
  locationId: number;
  userId: number;
  quantity: number;
  note: string | null;
  createdAt: string;
  procedure: { name: string; standard: string | null };
  location: { name: string };
  user: { name: string; role: string };
}

export default memo(function ProceduresPage() {
  const [activeTab, setActiveTab] = useState<'comparison' | 'templates' | 'journal'>('comparison');
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [comparison, setComparison] = useState<ProcedureComparison[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters for Comparison
  const [compFromDate, setCompFromDate] = useState('');
  const [compToDate, setCompToDate] = useState('');

  // New Procedure states
  const [showNewProc, setShowNewProc] = useState(false);
  const [newProcName, setNewProcName] = useState('');
  const [newProcDesc, setNewProcDesc] = useState('');
  const [newProcStandard, setNewProcStandard] = useState('');
  const [newProcNorms, setNewProcNorms] = useState<{ medicationId: number; name: string; expectedQuantity: number; tolerancePercent: number }[]>([]);
  const [savingProc, setSavingProc] = useState(false);
  const [newProcError, setNewProcError] = useState('');

  // Med search for norms
  const [medSearch, setMedSearch] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: number; name: string }[]>([]);

  // Log procedure states
  const [showLogProc, setShowLogProc] = useState(false);
  const [selectedProcId, setSelectedProcId] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [logQuantity, setLogQuantity] = useState(1);
  const [logNote, setLogNote] = useState('');
  const [loggingProc, setLoggingProc] = useState(false);
  const [logError, setLogError] = useState('');
  const [logSuccess, setLogSuccess] = useState(false);

  // Journal states
  const [journalLogs, setJournalLogs] = useState<ProcedureLogItem[]>([]);
  const [journalTotal, setJournalTotal] = useState(0);
  const [journalPage, setJournalPage] = useState(1);
  const [journalTotalPages, setJournalTotalPages] = useState(1);
  const [journalLoading, setJournalLoading] = useState(false);

  // Journal filters
  const [filterCabinet, setFilterCabinet] = useState('');
  const [filterProcedure, setFilterProcedure] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');

  // Drill-down / filter state for comparison
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [cabinetFilter, setCabinetFilter] = useState('');

  const fetchBaseData = useCallback(async () => {
    try {
      const [procRes, locRes, userRes] = await Promise.all([
        api.get('/procedures'),
        api.get('/locations'),
        api.get('/users').catch(() => ({ data: { data: [] } })), // fallback in case of errors
      ]);
      setProcedures(procRes.data?.data || []);
      setLocations(locRes.data || []);
      setUsers(userRes.data?.data || userRes.data || []);
    } catch (err) {
      console.error('Error fetching base data:', err);
    }
  }, []);

  const fetchComparisonData = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/procedures/comparison';
      const params = new URLSearchParams();
      if (compFromDate) params.append('from', compFromDate);
      if (compToDate) params.append('to', compToDate);
      
      const queryStr = params.toString();
      if (queryStr) url += `?${queryStr}`;

      const res = await api.get(url);
      setComparison(res.data?.data || []);
    } catch (err) {
      console.error('Error fetching comparison data:', err);
    } finally {
      setLoading(false);
    }
  }, [compFromDate, compToDate]);

  const fetchJournalData = useCallback(async () => {
    setJournalLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(journalPage));
      params.append('limit', '20');
      if (filterCabinet) params.append('locationId', filterCabinet);
      if (filterProcedure) params.append('procedureId', filterProcedure);
      if (filterUser) params.append('userId', filterUser);
      if (filterFromDate) params.append('from', filterFromDate);
      if (filterToDate) params.append('to', filterToDate);

      const res = await api.get(`/procedures/logs?${params.toString()}`);
      setJournalLogs(res.data?.data || []);
      setJournalTotal(res.data?.total || 0);
      setJournalTotalPages(res.data?.totalPages || 1);
    } catch (err) {
      console.error('Error fetching journal logs:', err);
    } finally {
      setJournalLoading(false);
    }
  }, [journalPage, filterCabinet, filterProcedure, filterUser, filterFromDate, filterToDate]);

  useEffect(() => {
    fetchBaseData();
  }, [fetchBaseData]);

  useEffect(() => {
    if (activeTab === 'comparison') {
      fetchComparisonData();
    } else if (activeTab === 'journal') {
      fetchJournalData();
    }
  }, [activeTab, fetchComparisonData, fetchJournalData]);

  // Debounced search for medications
  useEffect(() => {
    if (medSearch.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await api.get(`/medications/search?q=${encodeURIComponent(medSearch)}`);
        setSearchResults(res.data || []);
      } catch (err) {
        console.error(err);
      }
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [medSearch]);

  const addNorm = useCallback((med: { id: number; name: string }) => {
    if (newProcNorms.some(n => n.medicationId === med.id)) return;
    setNewProcNorms(prev => [...prev, { medicationId: med.id, name: med.name, expectedQuantity: 1, tolerancePercent: 10 }]);
    setMedSearch('');
    setSearchResults([]);
  }, [newProcNorms]);

  const removeNorm = useCallback((medId: number) => {
    setNewProcNorms(prev => prev.filter(n => n.medicationId !== medId));
  }, []);

  const handleCreateProcedure = useCallback(async () => {
    setNewProcError('');
    if (!newProcName.trim()) {
      setNewProcError('Введите название процедуры');
      return;
    }
    if (newProcNorms.length === 0) {
      setNewProcError('Добавьте хотя бы один расходный материал в нормативы');
      return;
    }
    setSavingProc(true);
    try {
      await api.post('/procedures', {
        name: newProcName.trim(),
        description: newProcDesc.trim() || undefined,
        standard: newProcStandard.trim() || undefined,
        norms: newProcNorms.map(n => ({
          medicationId: n.medicationId,
          expectedQuantity: Number(n.expectedQuantity),
          tolerancePercent: Number(n.tolerancePercent),
        })),
      });
      setShowNewProc(false);
      setNewProcName('');
      setNewProcDesc('');
      setNewProcStandard('');
      setNewProcNorms([]);
      await fetchBaseData();
      if (activeTab === 'comparison') fetchComparisonData();
    } catch (err: any) {
      setNewProcError(err.response?.data?.error || 'Ошибка при создании процедуры');
    } finally {
      setSavingProc(false);
    }
  }, [newProcName, newProcDesc, newProcStandard, newProcNorms, fetchBaseData, fetchComparisonData, activeTab]);

  const handleLogProcedure = useCallback(async () => {
    setLogError('');
    setLogSuccess(false);
    if (!selectedProcId) {
      setLogError('Выберите процедуру');
      return;
    }
    if (!selectedLocationId) {
      setLogError('Выберите кабинет');
      return;
    }
    if (logQuantity <= 0) {
      setLogError('Количество манипуляций должно быть больше нуля');
      return;
    }
    setLoggingProc(true);
    try {
      await api.post('/procedures/log', {
        procedureId: Number(selectedProcId),
        locationId: Number(selectedLocationId),
        quantity: Number(logQuantity),
        note: logNote.trim() || undefined,
      });
      setLogSuccess(true);
      setLogNote('');
      setLogQuantity(1);
      setTimeout(() => {
        setLogSuccess(false);
        setShowLogProc(false);
      }, 1500);

      // Refresh data
      if (activeTab === 'comparison') {
        fetchComparisonData();
      } else if (activeTab === 'journal') {
        fetchJournalData();
      }
    } catch (err: any) {
      setLogError(err.response?.data?.error || 'Недостаточно медикаментов в выбранном кабинете для списания по нормативу');
    } finally {
      setLoggingProc(false);
    }
  }, [selectedProcId, selectedLocationId, logQuantity, logNote, fetchComparisonData, fetchJournalData, activeTab]);

  const handleExportJournal = async (format: 'xlsx' | 'pdf') => {
    try {
      const params = new URLSearchParams();
      params.append('format', format);
      if (filterCabinet) params.append('locationId', filterCabinet);
      if (filterProcedure) params.append('procedureId', filterProcedure);
      if (filterUser) params.append('userId', filterUser);
      if (filterFromDate) params.append('from', filterFromDate);
      if (filterToDate) params.append('to', filterToDate);

      const endpoint = `/export/procedure-journal?${params.toString()}`;
      
      // Open in new tab or trigger download
      window.open(`${api.defaults.baseURL}${endpoint}`, '_blank');
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  // Recharts formatted data
  const barChartData = useMemo(() => {
    return comparison.map(item => {
      const totalExpected = item.usage.reduce((sum, u) => sum + u.expectedTotal, 0);
      const totalActual = item.usage.reduce((sum, u) => sum + u.actualTotal, 0);
      return {
        name: `${item.cabinetName} (${item.procedureName.substring(0, 15)}...)`,
        'Норматив (шт)': totalExpected,
        'Факт (шт)': totalActual,
      };
    });
  }, [comparison]);

  const totalViolations = useMemo(() => {
    return comparison.reduce((sum, item) => {
      return sum + item.usage.filter(u => u.isViolation).length;
    }, 0);
  }, [comparison]);

  const totalPerformed = useMemo(() => {
    return comparison.reduce((sum, item) => sum + item.timesPerformed, 0);
  }, [comparison]);

  const filteredComparison = useMemo(() => {
    if (!cabinetFilter) return comparison;
    return comparison.filter(c => String(c.locationId) === cabinetFilter);
  }, [comparison, cabinetFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-8 h-8 text-cyan-600 animate-pulse" /> Контроль расхода по нормативам
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Справочники СанПиН/ГОСТ, логирование процедур, автоматическое списание и аудит отклонений
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setLogError(''); setLogSuccess(false); setShowLogProc(true); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition-all font-semibold text-sm"
          >
            <Activity className="w-4 h-4" />
            Провести процедуру
          </button>
          <button
            onClick={() => setShowNewProc(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl shadow-md transition-all font-semibold text-sm"
          >
            <Plus className="w-4 h-4" />
            Создать шаблон
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('comparison')}
          className={`px-5 py-3 font-semibold text-sm border-b-2 transition-all ${
            activeTab === 'comparison'
              ? 'border-cyan-600 text-cyan-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Факт vs Норматив (ГОСТ)
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-5 py-3 font-semibold text-sm border-b-2 transition-all ${
            activeTab === 'templates'
              ? 'border-cyan-600 text-cyan-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Шаблоны процедур ({procedures.length})
        </button>
        <button
          onClick={() => setActiveTab('journal')}
          className={`px-5 py-3 font-semibold text-sm border-b-2 transition-all ${
            activeTab === 'journal'
              ? 'border-cyan-600 text-cyan-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Журнал выполнений ({journalTotal})
        </button>
      </div>

      {/* TAB 1: Comparison */}
      {activeTab === 'comparison' && (
        <div className="space-y-6">
          {/* Filters Row */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Период с</label>
              <input
                type="date"
                value={compFromDate}
                onChange={e => setCompFromDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Период по</label>
              <input
                type="date"
                value={compToDate}
                onChange={e => setCompToDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Фильтр кабинета</label>
              <select
                value={cabinetFilter}
                onChange={e => { setCabinetFilter(e.target.value); setExpandedIdx(null); }}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
              >
                <option value="">Все кабинеты</option>
                {locations.map(l => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchComparisonData}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all"
                title="Обновить"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Skeleton variant="rect" className="h-24 rounded-2xl" />
                <Skeleton variant="rect" className="h-24 rounded-2xl" />
              </div>
              <Skeleton variant="rect" className="h-64 rounded-2xl" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stats overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-slate-100 p-6 flex items-center gap-4 shadow-sm">
                  <div className="p-3.5 bg-rose-50 text-rose-600 rounded-2xl"><ShieldAlert className="w-7 h-7" /></div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Нарушено норм расхода</p>
                    <p className="text-3xl font-extrabold text-rose-600 mt-1">{totalViolations}</p>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 p-6 flex items-center gap-4 shadow-sm">
                  <div className="p-3.5 bg-cyan-50 text-cyan-600 rounded-2xl"><TrendingUp className="w-7 h-7" /></div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Всего манипуляций за период</p>
                    <p className="text-3xl font-extrabold text-cyan-600 mt-1">{totalPerformed} процедур</p>
                  </div>
                </div>
              </div>

              {/* Chart */}
              {barChartData.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-cyan-600" /> Сравнение Факт / Норматив по кабинетам
                  </h2>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: '#64748B' }} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                        <Legend />
                        <Bar dataKey="Факт (шт)" fill="#0891B2" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Норматив (шт)" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Detailed Comparisons Table */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h2 className="text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-cyan-600" /> Анализ отклонений по кабинетам
                </h2>
                {filteredComparison.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">За данный период процедур не зафиксировано</p>
                ) : (
                  <div className="space-y-3">
                    {filteredComparison.map((item, idx) => {
                      const isExpanded = expandedIdx === idx;
                      const hasViolation = item.usage.some(u => u.isViolation);
                      return (
                        <div
                          key={idx}
                          className={`border rounded-2xl overflow-hidden transition-all duration-200 ${
                            hasViolation ? 'border-rose-200 bg-rose-50/10' : 'border-slate-100 bg-slate-50/30'
                          }`}
                        >
                          <button
                            className="w-full text-left px-5 py-4 flex justify-between items-center hover:bg-slate-50 transition-colors"
                            onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${hasViolation ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                              <div className="min-w-0">
                                <p className="font-bold text-slate-800 text-sm md:text-base truncate">{item.cabinetName}</p>
                                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-slate-700">{item.procedureName}</span>
                                  {item.procedureStandard && (
                                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] uppercase font-mono">
                                      {item.procedureStandard}
                                    </span>
                                  )}
                                  <span>&bull; Выполнено: {item.timesPerformed} раз(а)</span>
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 ml-3">
                              {hasViolation ? (
                                <span className="px-3 py-1 text-xs font-extrabold text-rose-700 bg-rose-100 rounded-full flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5" /> Отклонение
                                </span>
                              ) : (
                                <span className="px-3 py-1 text-xs font-bold text-emerald-700 bg-emerald-100 rounded-full">
                                  В норме
                                </span>
                              )}
                              <span className={`text-slate-400 text-xs transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                ▼
                              </span>
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="px-5 pb-5 border-t border-slate-100 bg-white pt-4 space-y-3">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Расход материалов по СанПиН / ГОСТ:</p>
                              <div className="grid grid-cols-1 gap-3">
                                {item.usage.map((use, uIdx) => {
                                  const devClass = use.deviationPct > 0 
                                    ? 'text-rose-600' 
                                    : use.deviationPct < 0 
                                      ? 'text-amber-600' 
                                      : 'text-slate-600';
                                  
                                  return (
                                    <div
                                      key={uIdx}
                                      className={`rounded-xl p-4 border transition-all ${
                                        use.isViolation 
                                          ? 'bg-rose-50/20 border-rose-200' 
                                          : 'bg-slate-50/20 border-slate-100'
                                      } flex flex-col md:flex-row md:items-center justify-between gap-4`}
                                    >
                                      <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-slate-800 text-sm truncate">{use.medicationName}</p>
                                        <p className="text-xs text-slate-400 mt-1">
                                          Норма на процедуру: {use.normPerManipulation} шт. (допуск ±{use.tolerancePercent}%)
                                        </p>
                                      </div>
                                      <div className="flex flex-wrap gap-4 items-center justify-between md:justify-end">
                                        <div className="text-right">
                                          <p className="text-[10px] text-slate-400 font-bold uppercase">Расчётный норматив</p>
                                          <p className="font-bold text-slate-600 text-sm">{use.expectedTotal} шт.</p>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-[10px] text-slate-400 font-bold uppercase">Фактическое списание</p>
                                          <p className="font-extrabold text-slate-800 text-sm">{use.actualTotal} шт.</p>
                                        </div>
                                        <div className="text-right min-w-[90px]">
                                          <p className="text-[10px] text-slate-400 font-bold uppercase">Отклонение</p>
                                          <p className={`font-extrabold text-sm ${devClass}`}>
                                            {use.deviationAbs > 0 ? `+${use.deviationAbs}` : use.deviationAbs} шт. ({use.deviationPct > 0 ? `+${use.deviationPct}` : use.deviationPct}%)
                                          </p>
                                        </div>
                                        <div>
                                          {use.isViolation ? (
                                            <span className="px-3 py-1 text-xs font-bold text-rose-700 bg-rose-100 rounded-full flex items-center gap-1.5">
                                              <AlertTriangle className="w-3.5 h-3.5" /> Нарушение
                                            </span>
                                          ) : (
                                            <span className="px-3 py-1 text-xs font-bold text-emerald-700 bg-emerald-100 rounded-full flex items-center gap-1.5">
                                              <CheckCircle className="w-3.5 h-3.5" /> Норма
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Templates */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-600" /> Шаблоны медицинских процедур
              </h2>
            </div>
            {procedures.length === 0 ? (
              <p className="text-slate-400 text-center py-10">Процедуры еще не созданы.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {procedures.map(proc => (
                  <div key={proc.id} className="bg-slate-50/50 hover:bg-slate-50 transition-all border border-slate-100 rounded-2xl p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <h3 className="font-bold text-slate-800 text-base">{proc.name}</h3>
                        {proc.standard && (
                          <span className="shrink-0 bg-cyan-50 text-cyan-700 border border-cyan-100 px-2 py-0.5 rounded text-[10px] uppercase font-mono font-bold">
                            {proc.standard}
                          </span>
                        )}
                      </div>
                      {proc.description && (
                        <p className="text-xs text-slate-500 mb-4 line-clamp-2">{proc.description}</p>
                      )}
                    </div>
                    <div className="border-t border-slate-200/60 pt-3 mt-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Расходные нормативы:</p>
                      <div className="space-y-1.5">
                        {proc.norms.map(norm => (
                          <div key={norm.id} className="flex justify-between items-center text-xs">
                            <span className="text-slate-600 truncate max-w-[180px]">{norm.medication.name}</span>
                            <span className="font-semibold text-slate-800">
                              {norm.expectedQuantity} шт. (±{norm.tolerancePercent}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Journal */}
      {activeTab === 'journal' && (
        <div className="space-y-6">
          {/* Filters Box */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Filter className="w-4 h-4 text-cyan-600" /> Фильтрация журнала
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Кабинет</label>
                <select
                  value={filterCabinet}
                  onChange={e => { setFilterCabinet(e.target.value); setJournalPage(1); }}
                  className="w-full border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
                >
                  <option value="">Все кабинеты</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Процедура</label>
                <select
                  value={filterProcedure}
                  onChange={e => { setFilterProcedure(e.target.value); setJournalPage(1); }}
                  className="w-full border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
                >
                  <option value="">Все процедуры</option>
                  {procedures.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Сотрудник</label>
                <select
                  value={filterUser}
                  onChange={e => { setFilterUser(e.target.value); setJournalPage(1); }}
                  className="w-full border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
                >
                  <option value="">Все сотрудники</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Дата с</label>
                <input
                  type="date"
                  value={filterFromDate}
                  onChange={e => { setFilterFromDate(e.target.value); setJournalPage(1); }}
                  className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Дата по</label>
                <input
                  type="date"
                  value={filterToDate}
                  onChange={e => { setFilterToDate(e.target.value); setJournalPage(1); }}
                  className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>
            
            {/* Export buttons */}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 mt-2">
              <button
                onClick={() => handleExportJournal('xlsx')}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all"
              >
                <Download className="w-3.5 h-3.5" /> Экспорт Excel
              </button>
              <button
                onClick={() => handleExportJournal('pdf')}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold transition-all"
              >
                <Download className="w-3.5 h-3.5" /> Экспорт PDF
              </button>
            </div>
          </div>

          {/* Logs Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {journalLoading ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : journalLogs.length === 0 ? (
              <p className="text-slate-400 text-center py-12 text-sm">Записи журнала отсутствуют по заданным фильтрам</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-4 px-6">Дата</th>
                      <th className="py-4 px-6">Кабинет</th>
                      <th className="py-4 px-6">Медсестра</th>
                      <th className="py-4 px-6">Процедура</th>
                      <th className="py-4 px-6">Использовано по факту</th>
                      <th className="py-4 px-6">Норма по ГОСТ</th>
                      <th className="py-4 px-6">Отклонение (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                    {journalLogs.map(log => {
                      const norms = log.procedure?.norms || [];
                      const rowCount = norms.length || 1;

                      return norms.length === 0 ? (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-4 px-6 font-medium text-slate-500 whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString('ru-RU')}
                          </td>
                          <td className="py-4 px-6 font-semibold text-slate-600">
                            {log.location.name}
                          </td>
                          <td className="py-4 px-6">
                            <div className="font-bold text-slate-800">{log.user.name}</div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="font-bold text-slate-800">{log.procedure.name}</div>
                            {log.procedure.standard && (
                              <span className="inline-block mt-0.5 bg-cyan-50 text-cyan-700 px-1 py-0.5 rounded text-[9px] font-mono font-semibold">
                                {log.procedure.standard}
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-slate-400" colSpan={3}>
                            Нет расходных материалов в шаблоне
                          </td>
                        </tr>
                      ) : (
                        norms.map((norm, nIdx) => {
                          const qtyFact = norm.expectedQuantity * log.quantity;
                          const qtyNorm = norm.expectedQuantity * log.quantity;
                          const deviation = 0;

                          return (
                            <tr key={`${log.id}-${norm.id}`} className="hover:bg-slate-50/80 transition-colors border-b border-slate-100">
                              {nIdx === 0 && (
                                <>
                                  <td rowSpan={rowCount} className="py-4 px-6 font-medium text-slate-500 whitespace-nowrap align-top">
                                    {new Date(log.createdAt).toLocaleString('ru-RU')}
                                  </td>
                                  <td rowSpan={rowCount} className="py-4 px-6 font-semibold text-slate-600 align-top">
                                    {log.location.name}
                                  </td>
                                  <td rowSpan={rowCount} className="py-4 px-6 align-top">
                                    <div className="font-bold text-slate-800">{log.user.name}</div>
                                  </td>
                                  <td rowSpan={rowCount} className="py-4 px-6 align-top">
                                    <div className="font-bold text-slate-800">{log.procedure.name}</div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">({log.quantity} манипуляций)</div>
                                    {log.procedure.standard && (
                                      <span className="inline-block mt-0.5 bg-cyan-50 text-cyan-700 px-1 py-0.5 rounded text-[9px] font-mono font-semibold">
                                        {log.procedure.standard}
                                      </span>
                                    )}
                                  </td>
                                </>
                              )}
                              <td className="py-4 px-6">
                                <div className="font-bold text-slate-800">{norm.medication?.name}</div>
                                <div className="text-xs text-slate-500">{qtyFact} шт.</div>
                              </td>
                              <td className="py-4 px-6 font-semibold text-slate-600">
                                {qtyNorm} {norm.medication?.unit || 'шт.'}
                              </td>
                              <td className="py-4 px-6 font-bold text-emerald-600">
                                {deviation >= 0 ? `+${deviation}` : deviation}%
                              </td>
                            </tr>
                          );
                        })
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {journalTotalPages > 1 && (
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                <button
                  disabled={journalPage <= 1}
                  onClick={() => setJournalPage(p => p - 1)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  Назад
                </button>
                <span className="text-xs text-slate-500 font-semibold">
                  Страница {journalPage} из {journalTotalPages}
                </span>
                <button
                  disabled={journalPage >= journalTotalPages}
                  onClick={() => setJournalPage(p => p + 1)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  Вперед
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE PROCEDURE MODAL */}
      {showNewProc && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">Создать шаблон процедуры</h3>
              <button onClick={() => setShowNewProc(false)} className="text-slate-400 hover:text-slate-600"><X /></button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Название *</label>
                <input
                  type="text"
                  value={newProcName}
                  onChange={e => setNewProcName(e.target.value)}
                  placeholder="Например, Промывание слезных путей"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Стандарт (ГОСТ, СанПиН, КП)</label>
                <input
                  type="text"
                  value={newProcStandard}
                  onChange={e => setNewProcStandard(e.target.value)}
                  placeholder="Например, ГОСТ Р 52623.1-2008"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Описание / Регламент проведения</label>
                <textarea
                  value={newProcDesc}
                  onChange={e => setNewProcDesc(e.target.value)}
                  placeholder="Опишите краткую медицинскую инструкцию или клинический протокол..."
                  rows={2}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                />
              </div>

              {/* Norms config */}
              <div className="border-t border-slate-100 pt-4">
                <label className="block text-xs font-bold text-slate-800 mb-2 uppercase">Нормативы расхода медикаментов и МО</label>
                
                {/* Search input for medications */}
                <div className="relative mb-4">
                  <input
                    type="text"
                    value={medSearch}
                    onChange={e => setMedSearch(e.target.value)}
                    placeholder="Начните вводить название препарата или шприца..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl mt-1 shadow-lg z-50 max-h-48 overflow-y-auto">
                      {searchResults.map(med => (
                        <div
                          key={med.id}
                          onClick={() => addNorm(med)}
                          className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer text-sm font-semibold text-slate-800 border-b last:border-0 border-slate-100"
                        >
                          {med.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* List of configured norms */}
                <div className="space-y-2">
                  {newProcNorms.map((norm, index) => (
                    <div key={norm.medicationId} className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
                      <span className="font-bold text-slate-700 flex-1 truncate">{norm.name}</span>
                      <div className="flex gap-2 items-center">
                        <div className="w-20">
                          <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Кол-во (шт)</label>
                          <input
                            type="number"
                            min={1}
                            value={norm.expectedQuantity}
                            onChange={e => {
                              const updated = [...newProcNorms];
                              updated[index].expectedQuantity = Number(e.target.value);
                              setNewProcNorms(updated);
                            }}
                            className="w-full border border-slate-200 rounded-lg px-2 py-1 text-center font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          />
                        </div>
                        <div className="w-20">
                          <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Допуск (±%)</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={norm.tolerancePercent}
                            onChange={e => {
                              const updated = [...newProcNorms];
                              updated[index].tolerancePercent = Number(e.target.value);
                              setNewProcNorms(updated);
                            }}
                            className="w-full border border-slate-200 rounded-lg px-2 py-1 text-center font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          />
                        </div>
                        <button
                          onClick={() => removeNorm(norm.medicationId)}
                          className="p-1 text-slate-400 hover:text-rose-600 mt-4"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {newProcError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {newProcError}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-slate-100 flex gap-3">
              <button onClick={() => setShowNewProc(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors text-sm font-semibold">
                Отмена
              </button>
              <button onClick={handleCreateProcedure} disabled={savingProc}
                className="flex-1 px-4 py-2.5 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 transition-colors text-sm font-semibold flex items-center justify-center gap-2">
                {savingProc ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Создать шаблон
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOG PROCEDURE MODAL */}
      {showLogProc && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">Провести процедуру пациенту</h3>
              <button onClick={() => setShowLogProc(false)} className="text-slate-400 hover:text-slate-600"><X /></button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Кабинет / Локация *</label>
                <select
                  value={selectedLocationId}
                  onChange={e => setSelectedLocationId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white font-medium text-slate-700"
                >
                  <option value="">Выберите кабинет...</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Тип проводимой процедуры *</label>
                <select
                  value={selectedProcId}
                  onChange={e => setSelectedProcId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white font-medium text-slate-700"
                >
                  <option value="">Выберите процедуру...</option>
                  {procedures.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Манипуляций *</label>
                  <input
                    type="number"
                    min={1}
                    value={logQuantity}
                    onChange={e => setLogQuantity(Math.max(1, Number(e.target.value)))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 font-bold text-center"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Примечание</label>
                  <input
                    type="text"
                    value={logNote}
                    onChange={e => setLogNote(e.target.value)}
                    placeholder="ФИО пациента или детали"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                * Материалы будут автоматически списаны из выбранного кабинета в соответствии с установленным нормативом по FEFO (срокам годности).
              </p>

              {logSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" /> Процедура успешно зарегистрирована.
                </div>
              )}

              {logError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {logError}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-slate-100 flex gap-3">
              <button onClick={() => setShowLogProc(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors text-sm font-semibold">
                Отмена
              </button>
              <button onClick={handleLogProcedure} disabled={loggingProc}
                className="flex-1 px-4 py-2.5 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 transition-colors text-sm font-semibold flex items-center justify-center gap-2">
                {loggingProc ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Провести и списать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
