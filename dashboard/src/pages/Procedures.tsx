import { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { api } from '../api';
import {
  FileText, Plus, Activity, AlertTriangle, X, Loader2, ShieldAlert,
  TrendingUp, BarChart2, CheckCircle
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
  norms: ProcedureNorm[];
}

interface ComparisonUsage {
  medicationId: number;
  medicationName: string;
  expectedTotal: number;
  actualTotal: number;
  minAllowed: number;
  maxAllowed: number;
  tolerancePercent: number;
  isViolation: boolean;
}

interface ProcedureComparison {
  locationId: number;
  cabinetName: string;
  procedureId: number;
  procedureName: string;
  timesPerformed: number;
  usage: ComparisonUsage[];
}

interface Location {
  id: number;
  name: string;
}

export default memo(function ProceduresPage() {
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [comparison, setComparison] = useState<ProcedureComparison[]>([]);
  const [loading, setLoading] = useState(true);

  // New Procedure states
  const [showNewProc, setShowNewProc] = useState(false);
  const [newProcName, setNewProcName] = useState('');
  const [newProcDesc, setNewProcDesc] = useState('');
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
  const [loggingProc, setLoggingProc] = useState(false);
  const [logError, setLogError] = useState('');
  const [logSuccess, setLogSuccess] = useState(false);

  // Drill-down / filter state
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [cabinetFilter, setCabinetFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [procRes, locRes, compRes] = await Promise.all([
        api.get('/procedures'),
        api.get('/locations'),
        api.get('/procedures/compare'),
      ]);
      setProcedures(procRes.data?.data || []);
      setLocations(locRes.data || []);
      setComparison(compRes.data?.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
        norms: newProcNorms.map(n => ({
          medicationId: n.medicationId,
          expectedQuantity: Number(n.expectedQuantity),
          tolerancePercent: Number(n.tolerancePercent),
        })),
      });
      setShowNewProc(false);
      setNewProcName('');
      setNewProcDesc('');
      setNewProcNorms([]);
      await fetchData();
    } catch (err: any) {
      setNewProcError(err.response?.data?.error || 'Ошибка при создании процедуры');
    } finally {
      setSavingProc(false);
    }
  }, [newProcName, newProcDesc, newProcNorms, fetchData]);

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
    setLoggingProc(true);
    try {
      await api.post('/procedures/log', {
        procedureId: Number(selectedProcId),
        locationId: Number(selectedLocationId),
      });
      setLogSuccess(true);
      setSelectedProcId('');
      setSelectedLocationId('');
      setTimeout(() => setLogSuccess(false), 3000);
      await fetchData();
    } catch (err: any) {
      setLogError(err.response?.data?.error || 'Недостаточно медикаментов в выбранном кабинете для списания по нормативу');
    } finally {
      setLoggingProc(false);
    }
  }, [selectedProcId, selectedLocationId, fetchData]);

  // Transformed comparison data for Recharts bar chart
  const barChartData = useMemo(() => {
    return comparison.map(item => {
      const totalExpected = item.usage.reduce((sum, u) => sum + u.expectedTotal, 0);
      const totalActual = item.usage.reduce((sum, u) => sum + u.actualTotal, 0);
      return {
        name: `${item.cabinetName} (${item.procedureName})`,
        Норматив: totalExpected,
        Факт: totalActual,
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
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Расход по кабинетам</h1>
          <p className="text-slate-500 text-sm mt-1">Нормативы процедур, списание при лечении, контроль превышений</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setLogError(''); setLogSuccess(false); setShowLogProc(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl shadow-sm hover:bg-emerald-700 transition-colors"
          >
            <Activity className="w-4 h-4" />
            Провести процедуру
          </button>
          <button
            onClick={() => setShowNewProc(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-xl shadow-sm hover:bg-cyan-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Создать процедуру
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl p-6 border border-slate-100">
              <Skeleton className="h-6 w-36 mb-4" />
              <Skeleton variant="rect" count={3} className="h-28" />
            </div>
          </div>
          <div className="lg:col-span-2 space-y-8">
            <div className="grid grid-cols-2 gap-4">
              <Skeleton variant="rect" className="h-20" />
              <Skeleton variant="rect" className="h-20" />
            </div>
            <div className="bg-white rounded-2xl p-6 border border-slate-100">
              <Skeleton className="h-6 w-48 mb-6" />
              <Skeleton variant="rect" className="h-64" />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* List of Procedures */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-600" /> Шаблоны процедур
              </h2>
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                {procedures.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">Процедуры не созданы</p>
                ) : (
                  procedures.map(proc => (
                    <div key={proc.id} className="border border-slate-100 rounded-xl p-4 hover:bg-slate-50 transition-colors">
                      <h3 className="font-semibold text-slate-800">{proc.name}</h3>
                      {proc.description && <p className="text-xs text-slate-500 mt-1">{proc.description}</p>}
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Расход по нормативу:</p>
                        <div className="space-y-1">
                          {proc.norms.map(norm => (
                            <div key={norm.id} className="flex justify-between items-center text-xs">
                              <span className="text-slate-600 truncate max-w-[150px]">{norm.medication.name}</span>
                              <span className="font-medium text-slate-800">
                                {norm.expectedQuantity} шт. (±{norm.tolerancePercent}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Comparison and Charts */}
          <div className="lg:col-span-2 space-y-8">
            {/* Visual Overview card */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex items-center gap-4">
                <div className="p-3 bg-red-50 rounded-xl"><ShieldAlert className="w-6 h-6 text-rose-600" /></div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Выявлено отклонений</p>
                  <p className="text-2xl font-bold text-rose-600">{totalViolations}</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex items-center gap-4">
                <div className="p-3 bg-cyan-50 rounded-xl"><TrendingUp className="w-6 h-6 text-cyan-600" /></div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Проведено процедур</p>
                  <p className="text-2xl font-bold text-cyan-600">{totalPerformed}</p>
                </div>
              </div>
            </div>

            {/* Recharts Comparison Chart */}
            {barChartData.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-cyan-600" /> Расход по кабинетам (Штуки)
                </h2>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: '#64748B' }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Legend />
                      <Bar dataKey="Факт" fill="#0891B2" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Норматив" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Detailed Comparisons List — Ф-23/24 drill-down */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-cyan-600" /> Детальный журнал по кабинетам
                </h2>
                <div className="flex items-center gap-3">
                  <select
                    value={cabinetFilter}
                    onChange={e => { setCabinetFilter(e.target.value); setExpandedIdx(null); }}
                    className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
                  >
                    <option value="">Все кабинеты</option>
                    {locations.map(l => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
                  </select>
                </div>
              </div>
              {filteredComparison.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">Нет данных о проведённых процедурах</p>
              ) : (
                <div className="space-y-3">
                  {filteredComparison.map((item, idx) => {
                    const isExpanded = expandedIdx === idx;
                    const hasViolation = item.usage.some(u => u.isViolation);
                    return (
                      <div key={idx} className={`border rounded-2xl overflow-hidden transition-all duration-200 ${
                        hasViolation ? 'border-rose-200 bg-rose-50/30' : 'border-slate-100 bg-slate-50/50'
                      }`}>
                        {/* Header row — clickable for drill-down */}
                        <button
                          className="w-full text-left px-5 py-4 flex justify-between items-center hover:bg-white/60 transition-colors"
                          onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${hasViolation ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 truncate">{item.cabinetName}</p>
                              <p className="text-xs text-slate-500 mt-0.5 truncate">
                                {item.procedureName} &bull; {item.timesPerformed} раз(а)
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-3">
                            {hasViolation ? (
                              <span className="px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-rose-100 rounded-full flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> {item.usage.filter(u => u.isViolation).length} откл.
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 rounded-full">
                                В норме
                              </span>
                            )}
                            <span className={`text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                              ▼
                            </span>
                          </div>
                        </button>

                        {/* Expanded detail — Ф-24 drill-down: кабинет → процедура → МО */}
                        {isExpanded && (
                          <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-3">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Расход по препаратам:</p>
                            {item.usage.map((use, uIdx) => (
                              <div key={uIdx} className={`rounded-xl p-4 border flex items-center justify-between flex-wrap gap-4 text-sm ${
                                use.isViolation ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-100'
                              }`}>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-slate-800 truncate">{use.medicationName}</p>
                                  <p className="text-xs text-slate-400 mt-1">Допуск: ±{use.tolerancePercent}% ({use.minAllowed}–{use.maxAllowed} шт.)</p>
                                </div>
                                <div className="flex gap-6 items-center">
                                  <div className="text-right">
                                    <p className="text-xs text-slate-400">Норма</p>
                                    <p className="font-bold text-slate-600">{use.expectedTotal} шт.</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs text-slate-400">Факт</p>
                                    <p className={`font-bold ${use.isViolation ? 'text-rose-700' : 'text-slate-800'}`}>{use.actualTotal} шт.</p>
                                  </div>
                                  {use.isViolation ? (
                                    <span className="px-3 py-1 text-xs font-bold text-rose-700 bg-rose-100 rounded-full flex items-center gap-1">
                                      <AlertTriangle className="w-3.5 h-3.5" /> Превышение!
                                    </span>
                                  ) : (
                                    <span className="px-3 py-1 text-xs font-bold text-emerald-700 bg-emerald-100 rounded-full flex items-center gap-1">
                                      <CheckCircle className="w-3.5 h-3.5" /> В норме
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Procedure Modal */}
      {showNewProc && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">Создать шаблон процедуры</h3>
              <button onClick={() => setShowNewProc(false)} className="text-slate-400 hover:text-slate-600"><X /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Название *</label>
                <input
                  type="text"
                  value={newProcName}
                  onChange={e => setNewProcName(e.target.value)}
                  placeholder="Например, Пломбирование световой пломбой"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Описание</label>
                <textarea
                  value={newProcDesc}
                  onChange={e => setNewProcDesc(e.target.value)}
                  placeholder="Краткое описание этапов процедуры..."
                  rows={2}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                />
              </div>

              {/* Norms config */}
              <div className="border-t border-slate-100 pt-4">
                <label className="block text-sm font-bold text-slate-800 mb-2">Нормативы расхода препаратов</label>
                
                {/* Search input for medications */}
                <div className="relative mb-4">
                  <input
                    type="text"
                    value={medSearch}
                    onChange={e => setMedSearch(e.target.value)}
                    placeholder="Начните вводить название препарата..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl mt-1 shadow-lg z-50 max-h-48 overflow-y-auto">
                      {searchResults.map(med => (
                        <div
                          key={med.id}
                          onClick={() => addNorm(med)}
                          className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm font-medium text-slate-800"
                        >
                          {med.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* List of configured norms */}
                <div className="space-y-3">
                  {newProcNorms.map((norm, index) => (
                    <div key={norm.medicationId} className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center justify-between gap-3 text-xs">
                      <span className="font-semibold text-slate-800 flex-1 truncate">{norm.name}</span>
                      <div className="flex gap-2 items-center">
                        <div className="w-20">
                          <label className="block text-[10px] text-slate-400 mb-0.5">Кол-во (шт)</label>
                          <input
                            type="number"
                            min={1}
                            value={norm.expectedQuantity}
                            onChange={e => {
                              const updated = [...newProcNorms];
                              updated[index].expectedQuantity = Number(e.target.value);
                              setNewProcNorms(updated);
                            }}
                            className="w-full border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          />
                        </div>
                        <div className="w-20">
                          <label className="block text-[10px] text-slate-400 mb-0.5">Допуск (±%)</label>
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
                            className="w-full border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-cyan-500"
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
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {newProcError}
                </div>
              )}
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button onClick={() => setShowNewProc(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium">
                Отмена
              </button>
              <button onClick={handleCreateProcedure} disabled={savingProc}
                className="flex-1 px-4 py-2.5 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 transition-colors text-sm font-medium flex items-center justify-center gap-2">
                {savingProc ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Procedure Modal */}
      {showLogProc && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">Провести процедуру пациенту</h3>
              <button onClick={() => setShowLogProc(false)} className="text-slate-400 hover:text-slate-600"><X /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Кабинет / Локация *</label>
                <select
                  value={selectedLocationId}
                  onChange={e => setSelectedLocationId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">Выберите...</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Тип проводимой процедуры *</label>
                <select
                  value={selectedProcId}
                  onChange={e => setSelectedProcId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">Выберите...</option>
                  {procedures.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <p className="text-xs text-slate-400 mt-1.5">Расходные материалы будут автоматически списаны из выбранного кабинета в соответствии с нормативом.</p>
              </div>

              {logSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" /> Процедура успешно проведена, лекарства списаны.
                </div>
              )}

              {logError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {logError}
                </div>
              )}
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button onClick={() => setShowLogProc(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium">
                Отмена
              </button>
              <button onClick={handleLogProcedure} disabled={loggingProc}
                className="flex-1 px-4 py-2.5 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 transition-colors text-sm font-medium flex items-center justify-center gap-2">
                {loggingProc ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Провести и списать
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
