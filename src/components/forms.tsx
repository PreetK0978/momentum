import { useEffect, useState } from 'react';
import { CategorySelect, Field, Modal, Segmented, Toggle, WeekdayPicker } from './ui';
import { useData } from '@/hooks/data';
import { useAction } from '@/hooks/ui';
import { saveHabit, saveTask, validateHabit, validateTask } from '@/db/repo';
import type { Habit, Priority, Task, TaskKind } from '@/db/types';
import { endOfMonth, endOfWeek, todayKey, weekday } from '@/lib/date';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function HabitForm({ open, onClose, habit }: { open: boolean; onClose: () => void; habit?: Habit | null }) {
  const { categories, settings } = useData();
  const run = useAction();
  const blank = (): Partial<Habit> => ({
    name: '', description: '', categoryId: categories[0]?.id ?? '', frequency: 'daily', weekdays: ALL_DAYS, intervalDays: 2,
    target: 1, unit: '', weight: 1, startDate: todayKey(), endDate: null, archived: false,
  });
  const [h, setH] = useState<Partial<Habit>>(blank);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setH(habit ? { ...habit } : blank());
      setErr(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, habit]);

  const set = (p: Partial<Habit>) => setH((x) => ({ ...x, ...p }));
  const submit = async () => {
    const e = validateHabit(h);
    setErr(e);
    if (e) return;
    if (await run(() => saveHabit(h), habit ? 'Habit updated' : 'Habit created')) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={habit ? 'Edit habit' : 'New habit'}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit}>{habit ? 'Save changes' : 'Create habit'}</button>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label="Name">
          <input className="input" autoFocus value={h.name ?? ''} maxLength={80} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Morning run" />
        </Field>
        <Field label="Description (optional)">
          <input className="input" value={h.description ?? ''} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <CategorySelect categories={categories} value={h.categoryId ?? ''} onChange={(v) => set({ categoryId: v })} />
          </Field>
          <Field label="Weight" hint="Used by the weighted score (1-5)">
            <input className="input" type="number" min={1} max={5} value={h.weight ?? 1} onChange={(e) => set({ weight: Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Frequency">
          <Segmented
            value={h.frequency ?? 'daily'}
            onChange={(v) => set({ frequency: v })}
            options={[
              { value: 'daily', label: 'Every day' },
              { value: 'weekdays', label: 'Specific days' },
              { value: 'interval', label: 'Every N days' },
            ]}
          />
        </Field>
        {h.frequency === 'weekdays' && <WeekdayPicker value={h.weekdays ?? []} onChange={(v) => set({ weekdays: v })} weekStart={settings.weekStart} />}
        {h.frequency === 'interval' && (
          <Field label="Repeat every (days)">
            <input className="input w-32" type="number" min={1} max={365} value={h.intervalDays ?? 2} onChange={(e) => set({ intervalDays: Number(e.target.value) })} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Daily target" hint="1 = simple checkbox">
            <input className="input" type="number" min={1} value={h.target ?? 1} onChange={(e) => set({ target: Number(e.target.value) })} />
          </Field>
          <Field label="Unit (optional)">
            <input className="input" value={h.unit ?? ''} onChange={(e) => set({ unit: e.target.value })} placeholder="pages, minutes, km" />
          </Field>
          <Field label="Start date">
            <input className="input" type="date" value={h.startDate ?? ''} onChange={(e) => set({ startDate: e.target.value })} />
          </Field>
          <Field label="End date (optional)">
            <input className="input" type="date" value={h.endDate ?? ''} onChange={(e) => set({ endDate: e.target.value || null })} />
          </Field>
        </div>
        {habit && (
          <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
            <div>
              <div className="text-sm">Archived</div>
              <div className="text-xs text-subtle">Archived habits stop counting from today; their history is kept.</div>
            </div>
            <Toggle checked={!!h.archived} onChange={(v) => set({ archived: v })} label="Archived" />
          </div>
        )}
        {err && <p className="text-xs text-danger">{err}</p>}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

const KINDS: { value: TaskKind | 'habit'; label: string }[] = [
  { value: 'one-time', label: 'One-time' },
  { value: 'recurring', label: 'Recurring' },
  { value: 'habit', label: 'Daily habit' },
  { value: 'weekly-goal', label: 'Weekly goal' },
  { value: 'monthly-objective', label: 'Monthly objective' },
];

export const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'critical', label: 'Critical', color: 'rgb(var(--danger))' },
  { value: 'high', label: 'High', color: 'rgb(var(--warning))' },
  { value: 'medium', label: 'Medium', color: 'rgb(var(--accent))' },
  { value: 'low', label: 'Low', color: 'rgb(var(--subtle))' },
];

export function TaskForm({ open, onClose, task, defaultDate }: { open: boolean; onClose: () => void; task?: Task | null; defaultDate?: string }) {
  const { categories, settings } = useData();
  const run = useAction();
  const [habitMode, setHabitMode] = useState(false);
  const blank = (): Partial<Task> => ({
    title: '', description: '', notes: '', categoryId: categories[0]?.id ?? '', priority: 'medium', kind: 'one-time',
    dueDate: defaultDate ?? todayKey(), recurrence: null, estMinutes: 30, weight: 1, color: null,
  });
  const [t, setT] = useState<Partial<Task>>(blank);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setT(task ? { ...task } : blank());
      setErr(null);
      setHabitMode(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task]);

  const set = (p: Partial<Task>) => setT((x) => ({ ...x, ...p }));
  const setKind = (k: TaskKind | 'habit') => {
    if (k === 'habit') return setHabitMode(true);
    const base = t.dueDate ?? todayKey();
    const patch: Partial<Task> = { kind: k };
    if (k === 'recurring' && !t.recurrence) patch.recurrence = { type: 'daily', weekdays: [weekday(base)], dayOfMonth: Number(base.slice(8)), until: null };
    if (k === 'weekly-goal') patch.dueDate = endOfWeek(base, settings.weekStart);
    if (k === 'monthly-objective') patch.dueDate = endOfMonth(base);
    set(patch);
  };

  const submit = async () => {
    const e = validateTask(t);
    setErr(e);
    if (e) return;
    if (await run(() => saveTask(t), task ? 'Task updated' : 'Task created')) onClose();
  };

  if (habitMode) return <HabitForm open={open} onClose={onClose} />;

  const r = t.recurrence;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? 'Edit task' : 'New task'}
      wide
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit}>{task ? 'Save changes' : 'Create'}</button>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {!task && (
          <div className="-mx-1 overflow-x-auto px-1">
            <Segmented value={t.kind ?? 'one-time'} onChange={setKind} options={KINDS} />
          </div>
        )}
        <Field label="Title">
          <input className="input" autoFocus value={t.title ?? ''} maxLength={120} onChange={(e) => set({ title: e.target.value })} placeholder="What needs to get done?" />
        </Field>
        <Field label="Description">
          <textarea className="input min-h-[64px] resize-y" value={t.description ?? ''} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Category">
            <CategorySelect categories={categories} value={t.categoryId ?? ''} onChange={(v) => set({ categoryId: v })} />
          </Field>
          <Field label="Priority">
            <select className="input" value={t.priority} onChange={(e) => set({ priority: e.target.value as Priority })}>
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>
          <Field label={t.kind === 'recurring' ? 'Starts on' : t.kind === 'weekly-goal' ? 'Week ending' : t.kind === 'monthly-objective' ? 'Month ending' : 'Due date'}>
            <input
              className="input"
              type="date"
              value={t.dueDate ?? ''}
              onChange={(e) => {
                const v = e.target.value || null;
                if (v && t.kind === 'weekly-goal') return set({ dueDate: endOfWeek(v, settings.weekStart) });
                if (v && t.kind === 'monthly-objective') return set({ dueDate: endOfMonth(v) });
                set({ dueDate: v });
              }}
            />
          </Field>
          <Field label="Est. minutes">
            <input className="input" type="number" min={0} max={1440} value={t.estMinutes ?? 0} onChange={(e) => set({ estMinutes: Number(e.target.value) })} />
          </Field>
        </div>
        {t.kind === 'one-time' && !t.dueDate && <p className="-mt-2 text-[11px] text-subtle">Tasks without a due date are kept in your inbox and never affect your score.</p>}
        {t.kind === 'recurring' && r && (
          <div className="grid gap-3 rounded-xl border border-line bg-bg/40 p-3">
            <Segmented
              value={r.type}
              onChange={(v) => set({ recurrence: { ...r, type: v } })}
              options={[
                { value: 'daily', label: 'Daily' },
                { value: 'weekdays', label: 'On weekdays' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
              ]}
            />
            {r.type === 'weekdays' && <WeekdayPicker value={r.weekdays} onChange={(v) => set({ recurrence: { ...r, weekdays: v } })} weekStart={settings.weekStart} />}
            {r.type === 'monthly' && (
              <Field label="Day of month" hint="Short months use their last day">
                <input className="input w-28" type="number" min={1} max={31} value={r.dayOfMonth} onChange={(e) => set({ recurrence: { ...r, dayOfMonth: Number(e.target.value) } })} />
              </Field>
            )}
            <Field label="Repeat until (optional)">
              <input className="input w-48" type="date" value={r.until ?? ''} onChange={(e) => set({ recurrence: { ...r, until: e.target.value || null } })} />
            </Field>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Weight" hint="For the weighted score (1-5)">
            <input className="input" type="number" min={1} max={5} value={t.weight ?? 1} onChange={(e) => set({ weight: Number(e.target.value) })} />
          </Field>
          <Field label="Color tag">
            <div className="flex h-[38px] items-center gap-2">
              {[null, '#3987e5', '#e0703f', '#1baf7a', '#d99a0b', '#e07aa0', '#9085e9'].map((c) => (
                <button
                  key={c ?? 'none'}
                  type="button"
                  onClick={() => set({ color: c })}
                  aria-label={c ? `Color ${c}` : 'No color'}
                  className={`h-6 w-6 rounded-full border-2 transition ${t.color === c ? 'border-fg' : 'border-transparent'}`}
                  style={{ background: c ?? 'rgb(var(--line))' }}
                />
              ))}
            </div>
          </Field>
        </div>
        <Field label="Notes">
          <textarea className="input min-h-[56px] resize-y" value={t.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
        {err && <p className="text-xs text-danger">{err}</p>}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
