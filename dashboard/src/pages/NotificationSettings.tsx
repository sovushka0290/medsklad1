import { useState, useEffect, memo } from 'react';
import {
  Bell, Mail, AlertTriangle, Clock, TrendingDown,
  Save, Send, CheckCircle, Sliders
} from 'lucide-react';
import { api } from '../api';

interface Settings {
  criticalStockEnabled: boolean;
  deviationEnabled:     boolean;
  expiringEnabled:      boolean;
  deviationThreshold:   number;
  emailEnabled:         boolean;
  inAppEnabled:         boolean;
  notifyEmail:          string | null;
}

const DEFAULT_SETTINGS: Settings = {
  criticalStockEnabled: true,
  deviationEnabled:     true,
  expiringEnabled:      true,
  deviationThreshold:   20,
  emailEnabled:         false,
  inAppEnabled:         true,
  notifyEmail:          null,
};

// ─── Toggle Switch ─────────────────────────────────────────────────────────

function Toggle({
  enabled, onChange, disabled = false
}: { enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-40 ${
        enabled ? 'bg-cyan-600' : 'bg-slate-300 dark:bg-slate-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ─── Setting Row ───────────────────────────────────────────────────────────

function SettingRow({
  icon: Icon, iconColor, label, description, enabled, onChange
}: {
  icon: any; iconColor: string; label: string; description: string;
  enabled: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-slate-100 dark:border-slate-700/60 last:border-0">
      <div className="flex items-start gap-3 flex-1">
        <div className={`p-2 rounded-xl bg-slate-50 dark:bg-slate-700/60 shrink-0`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{label}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>
      <Toggle enabled={enabled} onChange={onChange} />
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

const NotificationSettings = memo(function NotificationSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [testing,  setTesting]  = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [testMsg,  setTestMsg]  = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/notifications/settings');
        const s = data.data;
        setSettings({
          criticalStockEnabled: s.criticalStockEnabled,
          deviationEnabled:     s.deviationEnabled,
          expiringEnabled:      s.expiringEnabled,
          deviationThreshold:   s.deviationThreshold,
          emailEnabled:         s.emailEnabled,
          inAppEnabled:         s.inAppEnabled,
          notifyEmail:          s.notifyEmail || '',
        });
      } catch {
        setError('Не удалось загрузить настройки');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.put('/notifications/settings', {
        ...settings,
        notifyEmail: settings.notifyEmail || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Ошибка сохранения настроек');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setTesting(true);
    setTestMsg(null);
    try {
      const { data } = await api.post('/notifications/test', {
        email: settings.notifyEmail || undefined,
      });
      setTestMsg(`✓ Отправлено на ${data.sentTo}`);
    } catch (e: any) {
      setTestMsg(`✗ ${e?.response?.data?.error || 'Ошибка отправки'}`);
    } finally {
      setTesting(false);
    }
  };

  const patch = (key: keyof Settings, value: any) =>
    setSettings(prev => ({ ...prev, [key]: value }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-cyan-50 dark:bg-cyan-900/30 rounded-2xl">
          <Bell className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">Настройки уведомлений</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Ф-30 — Управление оповещениями для руководителя</p>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-400 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Каналы доставки */}
      <div className="glass-panel rounded-2xl p-6">
        <h2 className="text-base font-bold text-slate-800 dark:text-white mb-1 flex items-center gap-2">
          <Bell className="w-4 h-4 text-slate-500" />
          Каналы доставки
        </h2>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Выберите, куда получать уведомления</p>

        <SettingRow
          icon={Bell}
          iconColor="text-cyan-600 dark:text-cyan-400"
          label="В приложении"
          description="Иконка с бейджем в шапке и список уведомлений"
          enabled={settings.inAppEnabled}
          onChange={v => patch('inAppEnabled', v)}
        />
        <SettingRow
          icon={Mail}
          iconColor="text-violet-600 dark:text-violet-400"
          label="Email-уведомления"
          description="Письма на указанный адрес при срабатывании триггеров"
          enabled={settings.emailEnabled}
          onChange={v => patch('emailEnabled', v)}
        />

        {settings.emailEnabled && (
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Email для уведомлений
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={settings.notifyEmail || ''}
                onChange={e => patch('notifyEmail', e.target.value)}
                placeholder="Оставьте пустым для использования email входа"
                className="flex-1 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              />
              <button
                onClick={handleTestEmail}
                disabled={testing}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded-xl text-sm font-medium hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors disabled:opacity-60 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                {testing ? 'Отправка...' : 'Тест'}
              </button>
            </div>
            {testMsg && (
              <p className={`text-xs font-medium ${testMsg.startsWith('✓') ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {testMsg}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Триггеры */}
      <div className="glass-panel rounded-2xl p-6">
        <h2 className="text-base font-bold text-slate-800 dark:text-white mb-1 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-slate-500" />
          Триггеры уведомлений
        </h2>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Дедупликация: одно уведомление за 24 часа для одной позиции</p>

        <SettingRow
          icon={AlertTriangle}
          iconColor="text-rose-600 dark:text-rose-400"
          label="Критические остатки"
          description="Когда количество препарата падает ниже минимального порога"
          enabled={settings.criticalStockEnabled}
          onChange={v => patch('criticalStockEnabled', v)}
        />
        <SettingRow
          icon={Clock}
          iconColor="text-orange-600 dark:text-orange-400"
          label="Истекающие сроки"
          description="Препараты с датой истечения менее 30 дней"
          enabled={settings.expiringEnabled}
          onChange={v => patch('expiringEnabled', v)}
        />
        <SettingRow
          icon={TrendingDown}
          iconColor="text-amber-600 dark:text-amber-400"
          label="Перерасход по кабинетам"
          description="Когда фактический расход превышает норматив на заданный порог"
          enabled={settings.deviationEnabled}
          onChange={v => patch('deviationEnabled', v)}
        />

        {settings.deviationEnabled && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/60">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Порог срабатывания перерасхода
              </label>
              <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400">
                {settings.deviationThreshold}%
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={settings.deviationThreshold}
              onChange={e => patch('deviationThreshold', Number(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-full appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>5%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-60"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : saved ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Сохранение...' : saved ? 'Сохранено!' : 'Сохранить'}
        </button>
        {saved && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
            <CheckCircle className="w-4 h-4" />
            Настройки обновлены
          </p>
        )}
      </div>
    </div>
  );
});

export default NotificationSettings;
