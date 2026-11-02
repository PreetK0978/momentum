import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sprout } from 'lucide-react';
import { Shell } from './components/Shell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TaskForm } from './components/forms';
import { Modal, Field } from './components/ui';
import { useData } from './hooks/data';
import { useAction, useMediaQuery, useRoute } from './hooks/ui';
import { autoBackupIfDue, updateSettings } from './db/repo';
import { useSyncScheduler } from './sync/useSync';
import { Overview } from './pages/Overview';
import { Planner } from './pages/Planner';
import { Tracker } from './pages/Tracker';
import { CalendarPage } from './pages/Calendar';
import { Analytics } from './pages/Analytics';
import { Goals } from './pages/Goals';
import { Reports } from './pages/Reports';
import { SettingsPage } from './pages/Settings';
import { todayKey } from './lib/date';

function useApplyTheme() {
  const { settings } = useData();
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  useEffect(() => {
    const mode = settings.mode === 'system' ? (systemDark ? 'dark' : 'light') : settings.mode;
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.dataset.mode = mode;
  }, [settings.theme, settings.mode, systemDark]);
}

/** Fires a browser notification at the chosen time while the app is open. */
function useReminder() {
  const { settings, engine } = useData();
  useEffect(() => {
    const n = settings.notifications;
    if (!n.enabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const check = () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const today = todayKey();
      if (hhmm >= n.time && n.lastSent !== today) {
        const d = engine.day(today);
        const left = d.planned - d.done;
        new Notification('Momentum', { body: left > 0 ? `${left} planned item${left === 1 ? '' : 's'} left today. You're at ${Math.round(d.pct ?? 0)}%.` : 'Everything planned for today is done. Well done.' });
        updateSettings({ notifications: { ...n, lastSent: today } });
      }
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [settings.notifications, engine]);
}

function Onboarding() {
  const { settings, ready } = useData();
  const run = useAction();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const open = ready && !settings.onboarded;
  // Everything starts at zero; sample data can still be loaded from Settings.
  const finish = async () => {
    setBusy(true);
    await run(() => updateSettings({ onboarded: true, userName: name.trim().slice(0, 40) }), 'Welcome to Momentum');
    setBusy(false);
  };
  return (
    <Modal
      open={open}
      onClose={finish}
      title="Welcome to Momentum"
      footer={
        <button disabled={busy} className="btn-primary" onClick={finish}>
          <Sprout className="h-4 w-4" /> Get started
        </button>
      }
    >
      <form className="grid gap-5" onSubmit={(e) => { e.preventDefault(); finish(); }}>
        <p className="text-sm leading-relaxed text-muted">
          Momentum measures your consistency, visualizes your progress and helps you improve every month. Your data never leaves this device — export a backup from Settings any time.
        </p>
        <Field label="What should we call you?">
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" maxLength={40} />
        </Field>
      </form>
    </Modal>
  );
}

export default function App() {
  const { ready } = useData();
  const { route, param } = useRoute();
  const [quickAdd, setQuickAdd] = useState(false);
  useApplyTheme();
  useReminder();
  useSyncScheduler();

  useEffect(() => {
    if (ready) autoBackupIfDue();
  }, [ready]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setQuickAdd(true);
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  if (!ready)
    return (
      <div className="grid h-full place-items-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" />
      </div>
    );

  const page = {
    overview: <Overview />,
    planner: <Planner />,
    tracker: <Tracker />,
    calendar: <CalendarPage initialDate={param} />,
    analytics: <Analytics />,
    goals: <Goals />,
    reports: <Reports initialMonth={param} />,
    settings: <SettingsPage />,
  }[route];

  return (
    <Shell route={route} onQuickAdd={() => setQuickAdd(true)}>
      {/* enter-only transition: navigation never waits on an exit animation */}
      <motion.div key={route} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        <ErrorBoundary resetKey={route}>{page}</ErrorBoundary>
      </motion.div>
      <TaskForm open={quickAdd} onClose={() => setQuickAdd(false)} />
      <Onboarding />
    </Shell>
  );
}
