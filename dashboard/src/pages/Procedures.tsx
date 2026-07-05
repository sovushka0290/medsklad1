import { useEffect, useState, useCallback, memo } from 'react';
import { api } from '../api';
import {
  Activity, Plus, FileText, CheckCircle, AlertTriangle, AlertCircle,
  TrendingUp, BarChart2, ShieldAlert, X, ChevronRight, Loader2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

interface MedicationNorm {
  id: number;
  medication: { id: number; name: string };
  expectedQuantity: number;
  tolerancePercent: number;
}

interface Procedure {
  id: number;
  name: string;
  description: string | null;
  norms: MedicationNorm[];
}

interface Location {
  id: number;
  name: string;
  type: string;
}

interface ComparisonItem {
  locationId: number;
  cabinetName: string;
  procedureId: number;
  procedureName: string;
  timesPerformed: number;
  usage: {
    medicationId: number;
    medicationName: string;
    expectedTotal: number;
    actualTotal: number;
    isViolation: boolean;
    minAllowed: number;
    maxAllowed: number;
    tolerancePercent: number;
  }[];
}

export default memo(function ProceduresPage() {
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [comparison, setComparison] = useState<ComparisonItem[]>([]);
  const [loading, setLoading] = useState(true);

  // New Procedure Form
  const [showNewProc, setShowNewProc] = useState(false);
  const [newProcName, setNewProcName] = useState('');
  const [newProcDesc, setNewProcDesc] = useState('');
  const [newProcNorms, setNewProcNorms] = useState<{ medicationId: number; name: string; expectedQuantity: number; tolerancePercent: number }[]>([]);
  const [medSearch, setMedSearch] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: number; name: string }[]>([]);
  const [newProcError, setNewProcError] = useState('');
  const [savingProc, setSavingProc] = useState(false);

  // Log Procedure Form
  const [showLogProc, setShowLogProc] = useState(false);
  const [selectedProcId, setSelectedProcId] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [logError, setLogError] = useState('');
  const [loggingProc, setLoggingProc] = useState(false);
  const [logSuccess, setLogSuccess] = useState(false);

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
      console.error('Failed to fetch procedures data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Search medications for new norm
  useEffect(() => {
    if (medSearch.length < 2) {
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

  const addNorm = (med: { id: number; name: string }) => {
    if (newProcNorms.some(n => n.medicationId === med.id)) return;
    setNewProcNorms([...newProcNorms, { medicationId: med.id, name: med.name, expectedQuantity: 1, tolerancePercent: 10 }]);
    setMedSearch('');
    setSearchResults([]);
  };

  const removeNorm = (medId: number) => {
    setNewProcNorms(newProcNorms.filter(n => n.medicationId !== medId));
  };

  const handleCreateProcedure = async () => {
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
  };

  const handleLogProcedure = async () => {
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
      // Auto hide success message
      setTimeout(() => setLogSuccess(false), 3000);
      await fetchData();
    } catch (err: any) {
      setLogError(err.response?.data?.error || 'Недостаточно медикаментов в выбранном кабинете для списания по нормативу');
    } finally {
      setLoggingProc(false);
    }
  };

  // Transformed comparison data for Recharts bar chart
  const barChartData = comparison.map(item => {
    const totalExpected = item.usage.reduce((sum, u) => sum + u.expectedTotal, 0);
    const totalActual = item.usage.reduce((sum, u) => sum + u.actualTotal, 0);
    return {
      name: `${item.cabinetName} (${item.procedureName})`,
      Норматив: totalExpected,
      Факт: totalActual,
    };
  });

  const totalViolations = comparison.reduce((sum, item) => {
    return sum + item.usage.filter(u => u.isViolation).length;
  }, 0);

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
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
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
                  <p className="text-2xl font-bold text-cyan-600">
                    {comparison.reduce((sum, item) => sum + item.timesPerformed, 0)}
                  </p>
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

            {/* Detailed Comparisons / Deviations */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" /> Контроль расхода по кабинетам
              </h2>
              <div className="space-y-4">
                {comparison.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">Пока нет зарегистрированных списаний</p>
                ) : (
                  comparison.map((item, idx) => (
                    <div key={idx} className="border border-slate-100 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 px-4 py-3 flex justify-between items-center border-b border-slate-100 flex-wrap gap-2">
                        <div>
                          <span className="font-semibold text-slate-800 text-sm">{item.cabinetName}</span>
                          <span className="text-slate-400 text-xs mx-2">|</span>
                          <span className="text-xs text-slate-600 font-medium bg-white px-2 py-0.5 rounded border border-slate-200">{item.procedureName}</span>
                        </div>
                        <span className="text-xs text-slate-500">Проведено: <b>{item.timesPerformed} раз(а)</b></span>
                      </div>
                      <div className="p-4 space-y-3">
                        {item.usage.map((use, uIdx) => (
                          <div key={uIdx} className="flex justify-between items-center text-sm flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-slate-700 font-medium">{use.medicationName}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-xs text-slate-500">Норма: {use.expectedTotal}</span>
                              <span className={`font-semibold px-2 py-0.5 rounded text-xs ${
                                use.isViolation
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}>
                                Факт: {use.actualTotal} {use.isViolation ? '⚠️ Перерасход/Недорасход' : '✅ Ок'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Procedure Modal */}
      {showNewProc && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">Создать процедуру</h3>
              <button onClick={() => setShowNewProc(false)} className="text-slate-400 hover:text-slate-600"><X /></button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Название процедуры *</label>
                <input
                  type="text"
                  value={newProcName}
                  onChange={e => setNewProcName(e.target.value)}
                  placeholder="Пломбирование зуба"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Описание / Примечание</label>
                <input
                  type="text"
                  value={newProcDesc}
                  onChange={e => setNewProcDesc(e.target.value)}
                  placeholder="Стандартное пломбирование светоотверждаемым композитом"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* Norms List */}
              <div className="pt-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Состав норматива</label>
                
                {/* Medication Search */}
                <div className="relative mb-3">
                  <input
                    type="text"
                    value={medSearch}
                    onChange={e => setMedSearch(e.target.value)}
                    placeholder="Поиск препарата для добавления..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl mt-1 shadow-lg max-h-48 overflow-y-auto z-10">
                      {searchResults.map(m => (
                        <div
                          key={m.id}
                          onClick={() => addNorm(m)}
                          className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700 flex justify-between"
                        >
                          <span>{m.name}</span>
                          <span className="text-xs text-cyan-600 font-medium">Добавить</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {newProcNorms.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Препараты еще не добавлены</p>
                  ) : (
                    newProcNorms.map(norm => (
                      <div key={norm.medicationId} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="text-sm font-medium text-slate-700 flex-1 truncate">{norm.name}</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0.1}
                            step={0.1}
                            value={norm.expectedQuantity}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setNewProcNorms(newProcNorms.map(n => n.medicationId === norm.medicationId ? { ...n, expectedQuantity: val } : n));
                            }}
                            className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-xs text-center"
                          />
                          <span className="text-xs text-slate-400">шт.</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">Погрешность:</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={norm.tolerancePercent}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setNewProcNorms(newProcNorms.map(n => n.medicationId === norm.medicationId ? { ...n, tolerancePercent: val } : n));
                            }}
                            className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-xs text-center"
                          />
                          <span className="text-xs text-slate-400">%</span>
                        </div>
                        <button
                          onClick={() => removeNorm(norm.medicationId)}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {newProcError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {newProcError}
                </div>
              )}
            </div>

            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => setShowNewProc(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium"
              >
                Отмена
              </button>
              <button
                onClick={handleCreateProcedure}
                disabled={savingProc}
                className="flex-1 px-4 py-2.5 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                {savingProc ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Procedure (Perform) Modal */}
      {showLogProc && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">Провести процедуру</h3>
              <button onClick={() => setShowLogProc(false)} className="text-slate-400 hover:text-slate-600"><X /></button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Процедура *</label>
                <select
                  value={selectedProcId}
                  onChange={e => setSelectedProcId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">Выберите процедуру...</option>
                  {procedures.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Кабинет лечения (Локация) *</label>
                <select
                  value={selectedLocationId}
                  onChange={e => setSelectedLocationId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">Выберите кабинет...</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>

              {logError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {logError}
                </div>
              )}

              {logSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" /> Списание на процедуру успешно проведено!
                </div>
              )}
            </div>

            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => setShowLogProc(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium"
              >
                Отмена
              </button>
              <button
                onClick={handleLogProcedure}
                disabled={loggingProc}
                className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                {loggingProc ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Списать по нормативу
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
