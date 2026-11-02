import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Upload, Plus, Pencil, Trash2, ArrowUp, ArrowDown, Bell, DatabaseBackup, RotateCcw, Sparkles, Monitor, Moon, Sun } from 'lucide-react';
import { useData } from '@/hooks/data';
import { useAction, useToast } from '@/hooks/ui';
import { Card, Field, LucideIcon, Modal, PageHeader, Segmented, Toggle, useConfirm } from '@/components/ui';
import { db } from '@/db/db';
import { clearAllData, createBackup, deleteCategory, exportAll, importBundle, restoreBackup, saveCategory, updateSettings, validateBundle, type ExportBundle } from '@/db/repo';
import { clearSampleData, loadSampleData } from '@/db/sample';
import { CATEGORY_ICONS, CATEGORY_PALETTE } from '@/db/defaults';
import type { Category, Settings, ThemePreset, WidgetId } from '@/db/types';
import { todayKey } from '@/lib/date';
import { cn } from '@/lib/cn';
import { SyncCard } from '@/sync/SyncCard';

const THEMES: { id: ThemePreset; name: string; desc: string; swatch: [string, string, string] }[] = [
  { id: 'obsidian', name: 'Obsidian', desc: 'Black and graphite', swatch: ['#0a0a0b', '#1a1a1d', '#8b7cf6'] },
  { id: 'midnight', name: 'Midnight', desc: 'Navy and electric blue', swatch: ['#080b16', '#141b30', '#4f8cff'] },
  { id: 'violet', name: 'Violet', desc: 'Dark purple and lavender', swatch: ['#0e0a16', '#1f182f', '#a78bfa'] },
  { id: 'minimal', name: 'Minimal', desc: 'White, grey and black', swatch: ['#fafafa', '#e5e5e5', '#171717'] },
  { id: 'emerald', name: 'Emerald', desc: 'Dark green and muted emerald', swatch: ['#070e0c', '#121f1b', '#34be82'] },
];

const WIDGET_LABEL: Record<WidgetId, string> = {
  today: "Today's performance", month: 'Monthly performance', 'habits-today': "Today's checklist", trends: 'Performance trends',
  categories: 'Category performance', heatmap: 'Consistency heatmap', goals: 'Goals in progress',
};

export function SettingsPage() {
  const { settings } = useData();
  const set = (p: Partial<Settings>) => updateSettings(p);

  return (
    <div>
      <PageHeader title="Settings" subtitle="Personalize Momentum and manage your data." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Profile">
          <Field label="Display name">
            <input className="input" defaultValue={settings.userName} maxLength={40} onBlur={(e) => set({ userName: e.target.value.trim() })} placeholder="Used in your greeting" />
          </Field>
        </Card>

        <Card title="Appearance">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm">Mode</span>
            <Segmented
              value={settings.mode}
              onChange={(m) => set({ mode: m })}
              options={[
                { value: 'dark', label: <span className="flex items-center gap-1"><Moon className="h-3 w-3" />Dark</span> },
                { value: 'light', label: <span className="flex items-center gap-1"><Sun className="h-3 w-3" />Light</span> },
                { value: 'system', label: <span className="flex items-center gap-1"><Monitor className="h-3 w-3" />System</span> },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {THEMES.map((t) => (
              <button key={t.id} onClick={() => set({ theme: t.id })} className={cn('rounded-xl border p-3 text-left transition', settings.theme === t.id ? 'border-accent ring-2 ring-accent/25' : 'border-line hover:border-subtle')}>
                <div className="mb-2 flex h-8 overflow-hidden rounded-md border border-line">
                  {t.swatch.map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}
                </div>
                <div className="text-sm font-medium">{t.name}</div>
                <div className="text-[11px] text-subtle">{t.desc}</div>
              </button>
            ))}
          </div>
        </Card>

        <CategoriesCard />

        <Card title="Targets & scoring" subtitle="Changes recalculate every score instantly, including history.">
          <div className="grid gap-4">
            <RangeRow label="Success threshold" hint="A day at or above this counts as successful (streaks, consistency)." value={settings.successThreshold} onChange={(v) => set({ successThreshold: v })} />
            <RangeRow label="Daily target" hint="Marked on today's progress bar." value={settings.dailyTarget} onChange={(v) => set({ dailyTarget: v })} />
            <RangeRow label="Weekly target" hint="Goal for your average weekly score." value={settings.weeklyTarget} onChange={(v) => set({ weeklyTarget: v })} />
            <ToggleRow label="Weighted scoring" hint="Score items by their weight (1-5) instead of counting them equally. The basic completion % is still shown alongside." checked={settings.useWeighted} onChange={(v) => set({ useWeighted: v })} />
            <ToggleRow label="Late completions count" hint="Finishing a one-time task after its due date still counts toward that day." checked={settings.lateCompletionCounts} onChange={(v) => set({ lateCompletionCounts: v })} />
          </div>
        </Card>

        <Card title="Calendar">
          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-4">
              <div><div className="text-sm">Week starts on</div><div className="text-xs text-subtle">Affects weekly scores, tracker and calendar.</div></div>
              <Segmented value={String(settings.weekStart) as '0' | '1'} onChange={(v) => set({ weekStart: Number(v) as 0 | 1 })} options={[{ value: '1', label: 'Monday' }, { value: '0', label: 'Sunday' }]} />
            </div>
            <ToggleRow label="Show scores on calendar days" checked={settings.calendarShowScores} onChange={(v) => set({ calendarShowScores: v })} />
          </div>
        </Card>

        <NotificationsCard />

        <Card title="Dashboard layout" subtitle="Order and visibility of Overview widgets. You can also drag them with Customize on the Overview.">
          <ul className="grid gap-1.5">
            {settings.widgets.map((w, i) => (
              <li key={w.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2">
                <span className={cn('flex-1 text-sm', !w.visible && 'text-subtle')}>{WIDGET_LABEL[w.id]}</span>
                <button className="icon-btn h-7 w-7" disabled={i === 0} onClick={() => set({ widgets: swap(settings.widgets, i, i - 1) })} aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button className="icon-btn h-7 w-7" disabled={i === settings.widgets.length - 1} onClick={() => set({ widgets: swap(settings.widgets, i, i + 1) })} aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                <Toggle checked={w.visible} onChange={(v) => set({ widgets: settings.widgets.map((x) => (x.id === w.id ? { ...x, visible: v } : x)) })} label={`Show ${WIDGET_LABEL[w.id]}`} />
              </li>
            ))}
          </ul>
        </Card>

        <SyncCard />
        <DataCard />
      </div>
    </div>
  );
}

function swap<T>(arr: T[], a: number, b: number): T[] {
  const x = [...arr];
  [x[a], x[b]] = [x[b], x[a]];
  return x;
}

function RangeRow({ label, hint, value, onChange }: { label: string; hint?: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="num font-semibold">{value}%</span>
      </div>
      <input type="range" min={10} max={100} step={5} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[rgb(var(--accent))]" aria-label={label} />
      {hint && <div className="text-xs text-subtle">{hint}</div>}
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div><div className="text-sm">{label}</div>{hint && <div className="text-xs text-subtle">{hint}</div>}</div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function CategoriesCard() {
  const { categories, habits, tasks } = useData();
  const [edit, setEdit] = useState<Partial<Category> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const run = useAction();
  const usage = (id: string) => habits.filter((h) => h.categoryId === id).length + tasks.filter((t) => t.categoryId === id).length;

  const submit = async () => {
    if (!edit) return;
    try {
      await saveCategory({ ...edit, name: edit.name ?? '', color: edit.color ?? CATEGORY_PALETTE[0], icon: edit.icon ?? 'Star' });
      setEdit(null);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <Card title="Categories" action={<button className="btn-outline py-1.5 text-xs" onClick={() => { setErr(null); setEdit({ name: '', color: CATEGORY_PALETTE[categories.length % CATEGORY_PALETTE.length], icon: 'Star' }); }}><Plus className="h-3.5 w-3.5" /> Add</button>}>
      <ul className="grid gap-1">
        {categories.map((c) => (
          <li key={c.id} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-elevated/60">
            <span className="grid h-7 w-7 place-items-center rounded-md" style={{ background: c.color + '22', color: c.color }}><LucideIcon name={c.icon} className="h-3.5 w-3.5" /></span>
            <span className="flex-1 text-sm">{c.name}</span>
            <span className="text-xs text-subtle">{usage(c.id)} items</span>
            <button className="icon-btn h-7 w-7" onClick={() => { setErr(null); setEdit(c); }} aria-label={`Edit ${c.name}`}><Pencil className="h-3.5 w-3.5" /></button>
            <button
              className="icon-btn h-7 w-7 hover:text-danger"
              disabled={categories.length <= 1}
              onClick={async () => {
                if (await confirm('Delete category?', `"${c.name}" will be removed. Its ${usage(c.id)} habits/tasks/goals move to another category — nothing is lost.`)) run(() => deleteCategory(c.id), 'Category deleted');
              }}
              aria-label={`Delete ${c.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit category' : 'New category'} footer={<><button className="btn-ghost" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={submit}>Save</button></>}>
        {edit && (
          <div className="grid gap-4">
            <Field label="Name"><input className="input" autoFocus maxLength={40} value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && submit()} /></Field>
            <Field label="Color">
              <div className="flex flex-wrap gap-2">
                {CATEGORY_PALETTE.map((col) => (
                  <button key={col} type="button" onClick={() => setEdit({ ...edit, color: col })} className={cn('h-7 w-7 rounded-full border-2', edit.color === col ? 'border-fg' : 'border-transparent')} style={{ background: col }} aria-label={col} />
                ))}
                <input type="color" value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value })} className="h-7 w-9 cursor-pointer rounded border border-line bg-transparent" aria-label="Custom color" />
              </div>
            </Field>
            <Field label="Icon">
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_ICONS.map((i) => (
                  <button key={i} type="button" onClick={() => setEdit({ ...edit, icon: i })} className={cn('grid h-8 w-8 place-items-center rounded-lg border', edit.icon === i ? 'border-accent bg-accent/15 text-fg' : 'border-line text-subtle hover:text-fg')} aria-label={i}>
                    <LucideIcon name={i} className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </Field>
            {err && <p className="text-xs text-danger">{err}</p>}
          </div>
        )}
      </Modal>
      {dialog}
    </Card>
  );
}

function NotificationsCard() {
  const { settings } = useData();
  const toast = useToast();
  const n = settings.notifications;
  const supported = typeof Notification !== 'undefined';
  const enable = async (on: boolean) => {
    if (on) {
      if (!supported) return toast('Notifications are not supported in this browser', 'err');
      const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (p !== 'granted') return toast('Notification permission was denied', 'err');
    }
    updateSettings({ notifications: { ...n, enabled: on, lastSent: on ? (n.time <= new Date().toTimeString().slice(0, 5) ? todayKey() : null) : n.lastSent } });
  };
  return (
    <Card title="Notifications" subtitle="A daily reminder with what's left, sent while Momentum is open in a tab.">
      <div className="grid gap-4">
        <ToggleRow label="Daily reminder" checked={n.enabled} onChange={enable} />
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm">Reminder time</span>
          <input type="time" className="input w-32" value={n.time} disabled={!n.enabled} onChange={(e) => e.target.value && updateSettings({ notifications: { ...n, time: e.target.value, lastSent: null } })} />
        </div>
        <button
          className="btn-outline justify-self-start py-1.5 text-xs"
          disabled={!n.enabled}
          onClick={() => supported && Notification.permission === 'granted' && new Notification('Momentum', { body: 'Reminders are working.' })}
        >
          <Bell className="h-3.5 w-3.5" /> Send test notification
        </button>
      </div>
    </Card>
  );
}

function DataCard() {
  const { settings } = useData();
  const run = useAction();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ExportBundle | null>(null);
  const { confirm, dialog } = useConfirm();
  const backups = useLiveQuery(() => db.backups.orderBy('createdAt').reverse().toArray(), []) ?? [];
  const counts = useLiveQuery(async () => ({ habits: await db.habits.count(), logs: await db.habitLogs.count(), tasks: await db.tasks.count(), goals: await db.goals.count() }), []);

  const doExport = async () => {
    const bundle = await exportAll();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `momentum-backup-${todayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Export downloaded');
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      if (f.size > 50 * 1024 * 1024) throw new Error('File is larger than 50 MB');
      setPending(validateBundle(JSON.parse(await f.text())));
    } catch (e) {
      toast(e instanceof SyntaxError ? 'That file is not valid JSON' : (e as Error).message, 'err');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const doImport = async (mode: 'replace' | 'merge') => {
    if (!pending) return;
    await run(async () => {
      await createBackup('Before import', true);
      await importBundle(pending, mode);
    }, mode === 'replace' ? 'Data replaced from file' : 'Data merged from file');
    setPending(null);
  };

  return (
    <Card className="lg:col-span-2" title="Data, backup & restore" subtitle={counts ? `Stored locally in IndexedDB · ${counts.habits} habits, ${counts.logs} check-ins, ${counts.tasks} tasks, ${counts.goals} goals` : 'Stored locally in IndexedDB'}>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid content-start gap-3">
          <div className="flex flex-wrap gap-2">
            <button className="btn-outline" onClick={doExport}><Download className="h-4 w-4" /> Export JSON</button>
            <button className="btn-outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Import JSON</button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <button className="btn-outline" onClick={() => run(() => createBackup('Manual backup'), 'Backup created')}><DatabaseBackup className="h-4 w-4" /> Back up now</button>
          </div>
          <p className="text-xs text-subtle">A snapshot is taken automatically once a day and before every import or restore. The last 10 automatic snapshots are kept; manual backups stay until you delete them.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {settings.hasSampleData ? (
              <button className="btn-outline text-xs" onClick={() => run(clearSampleData, 'Sample data cleared')}><Sparkles className="h-3.5 w-3.5" /> Clear sample data</button>
            ) : (
              <button className="btn-ghost text-xs" onClick={() => run(loadSampleData, 'Sample data loaded')}><Sparkles className="h-3.5 w-3.5" /> Load sample data</button>
            )}
            <button
              className="btn-danger text-xs"
              onClick={async () => {
                if (await confirm('Erase all data?', 'Every habit, check-in, task, goal and reflection will be deleted. A backup snapshot is created first so you can restore it below.', 'Erase everything'))
                  run(async () => { await createBackup('Before erase', true); await clearAllData(); }, 'All data erased');
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Erase all data
            </button>
          </div>
        </div>
        <div>
          <div className="label mb-2">Backups</div>
          {backups.length === 0 ? (
            <p className="text-sm text-subtle">No backups yet.</p>
          ) : (
            <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-xl border border-line">
              {backups.map((b) => (
                <li key={b.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{b.label}</div>
                    <div className="text-[11px] text-subtle">{new Date(b.createdAt).toLocaleString()} · {(b.data.length / 1024).toFixed(0)} KB</div>
                  </div>
                  <button
                    className="btn-ghost py-1 text-xs"
                    onClick={async () => {
                      if (await confirm('Restore this backup?', 'Your current data will be replaced by this snapshot. A snapshot of the current state is taken first.', 'Restore')) run(() => restoreBackup(b.id), 'Backup restored');
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Restore
                  </button>
                  <button className="icon-btn h-7 w-7 hover:text-danger" onClick={() => db.backups.delete(b.id)} aria-label="Delete backup"><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <Modal open={!!pending} onClose={() => setPending(null)} title="Import data" footer={<><button className="btn-ghost" onClick={() => setPending(null)}>Cancel</button><button className="btn-outline" onClick={() => doImport('merge')}>Merge</button><button className="btn-primary" onClick={() => doImport('replace')}>Replace all</button></>}>
        {pending && (
          <div className="grid gap-3 text-sm text-muted">
            <p>Exported {new Date(pending.exportedAt).toLocaleString()}. Contains {pending.data.habits?.length ?? 0} habits, {pending.data.habitLogs?.length ?? 0} check-ins, {pending.data.tasks?.length ?? 0} tasks and {pending.data.goals?.length ?? 0} goals.</p>
            <p><b className="text-fg">Merge</b> adds records and updates ones with the same ID — nothing is duplicated. <b className="text-fg">Replace all</b> swaps your current data for the file. Either way a backup is taken first.</p>
          </div>
        )}
      </Modal>
      {dialog}
    </Card>
  );
}
