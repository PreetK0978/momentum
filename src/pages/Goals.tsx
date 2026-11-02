import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Link2, Minus, CheckCircle2, Target, CalendarClock } from 'lucide-react';
import { useData } from '@/hooks/data';
import { useAction } from '@/hooks/ui';
import { Card, CategorySelect, Empty, Field, Modal, PageHeader, ProgressRing, Segmented, useConfirm } from '@/components/ui';
import { deleteGoal, saveGoal, setGoalProgress, validateGoal } from '@/db/repo';
import type { Goal, GoalPeriod } from '@/db/types';
import { diffDays, endOfMonth, endOfQuarter, endOfWeek, endOfYear, fmtDate, startOfMonth, startOfQuarter, startOfWeek, startOfYear } from '@/lib/date';
import { goalPct, goalProgress } from '@/lib/goals';
import { cn } from '@/lib/cn';

const PERIODS: { value: GoalPeriod; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

export function Goals() {
  const { goals, engine, today } = useData();
  const [filter, setFilter] = useState<'all' | GoalPeriod>('all');
  const [status, setStatus] = useState<'active' | 'completed' | 'all'>('active');
  const [form, setForm] = useState<{ open: boolean; goal: Goal | null }>({ open: false, goal: null });
  const { confirm, dialog } = useConfirm();
  const run = useAction();

  const isDone = (g: Goal) => g.completed || goalProgress(g, engine) >= g.target;
  const list = goals
    .filter((g) => (filter === 'all' || g.period === filter) && (status === 'all' || (status === 'completed') === isDone(g)))
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  const active = goals.filter((g) => !isDone(g));
  const avg = active.length ? active.reduce((a, g) => a + goalPct(g, engine), 0) / active.length : null;
  const dueSoon = active.filter((g) => diffDays(g.deadline, today) <= 7 && g.deadline >= today).length;

  return (
    <div>
      <PageHeader
        title="Goals"
        subtitle="Measurable objectives with clear targets."
        actions={<button className="btn-primary" onClick={() => setForm({ open: true, goal: null })}><Plus className="h-4 w-4" /> New goal</button>}
      />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="card px-4 py-3.5"><div className="label">Active</div><div className="num mt-1 text-2xl font-semibold">{active.length}</div></div>
        <div className="card px-4 py-3.5"><div className="label">Avg. progress</div><div className="num mt-1 text-2xl font-semibold">{avg === null ? '—' : `${Math.round(avg)}%`}</div></div>
        <div className="card px-4 py-3.5"><div className="label">Due in 7 days</div><div className="num mt-1 text-2xl font-semibold">{dueSoon}</div></div>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="overflow-x-auto"><Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, ...PERIODS]} /></div>
        <Segmented value={status} onChange={setStatus} options={[{ value: 'active', label: 'Active' }, { value: 'completed', label: 'Completed' }, { value: 'all', label: 'All' }]} />
      </div>
      {list.length === 0 ? (
        <Card>
          <Empty icon={<Target className="h-5 w-5" />} title={status === 'completed' ? 'No completed goals yet' : 'No goals here'} body="Try “Complete 20 gym sessions”, “Study 60 hours” or “Read 2 books”." action={<button className="btn-primary" onClick={() => setForm({ open: true, goal: null })}><Plus className="h-4 w-4" /> New goal</button>} />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              onEdit={() => setForm({ open: true, goal: g })}
              onDelete={async () => {
                if (await confirm('Delete goal?', `"${g.name}" will be permanently removed.`)) run(() => deleteGoal(g.id), 'Goal deleted');
              }}
            />
          ))}
        </div>
      )}
      <GoalForm open={form.open} goal={form.goal} onClose={() => setForm({ open: false, goal: null })} />
      {dialog}
    </div>
  );
}

function GoalCard({ goal: g, onEdit, onDelete }: { goal: Goal; onEdit: () => void; onDelete: () => void }) {
  const { engine, catMap, today, habits } = useData();
  const cat = catMap.get(g.categoryId);
  const cur = goalProgress(g, engine);
  const pct = goalPct(g, engine);
  const done = g.completed || cur >= g.target;
  const daysLeft = diffDays(g.deadline, today);
  const totalDays = Math.max(1, diffDays(g.deadline, g.startDate) + 1);
  const expected = Math.min(100, Math.max(0, ((totalDays - Math.max(0, daysLeft)) / totalDays) * 100));
  const pace = done ? 'Completed' : daysLeft < 0 ? 'Past deadline' : pct >= expected - 5 ? 'On pace' : 'Behind pace';
  const linked = g.linkedHabitId ? habits.find((h) => h.id === g.linkedHabitId) : null;
  const run = useAction();

  return (
    <div className="card group flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] text-subtle">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: cat?.color }} />
            {cat?.name} · {PERIODS.find((p) => p.value === g.period)?.label}
          </div>
          <h3 className="mt-1 text-[15px] font-semibold leading-snug">{g.name}</h3>
          {g.description && <p className="mt-1 line-clamp-2 text-xs text-muted">{g.description}</p>}
        </div>
        <div className="flex shrink-0 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
          <button className="icon-btn h-7 w-7" onClick={onEdit} aria-label="Edit goal"><Pencil className="h-3.5 w-3.5" /></button>
          <button className="icon-btn h-7 w-7 hover:text-danger" onClick={onDelete} aria-label="Delete goal"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <ProgressRing value={pct} size={84} stroke={7} color={done ? 'rgb(var(--success))' : cat?.color}>
          {done ? <CheckCircle2 className="h-6 w-6 text-success" /> : <span className="num text-base font-semibold">{Math.round(pct)}%</span>}
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <div className="num text-xl font-semibold">
            {cur}
            <span className="text-sm font-normal text-subtle"> / {g.target} {g.unit}</span>
          </div>
          <div className={cn('mt-0.5 text-xs font-medium', done ? 'text-success' : pace === 'On pace' ? 'text-accent' : 'text-warning')}>{pace}</div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-subtle">
            <CalendarClock className="h-3 w-3" />
            {fmtDate(g.deadline, { month: 'short', day: 'numeric', year: 'numeric' })}
            {!done && daysLeft >= 0 && ` · ${daysLeft}d left`}
          </div>
        </div>
      </div>
      <div className="relative h-1.5 rounded-full bg-line/70">
        <div className="absolute inset-y-0 left-0 rounded-full transition-all" style={{ width: `${pct}%`, background: done ? 'rgb(var(--success))' : cat?.color }} />
        {!done && <span className="absolute -top-1 h-3.5 w-0.5 rounded bg-fg/50" style={{ left: `${expected}%` }} title="Where you'd be on a steady pace" />}
      </div>
      {linked ? (
        <div className="flex items-center gap-1.5 text-[11px] text-subtle"><Link2 className="h-3 w-3" />Auto-tracked from “{linked.name}”</div>
      ) : (
        <div className="flex items-center gap-2">
          <button className="icon-btn h-8 w-8 border border-line" onClick={() => run(() => setGoalProgress(g, g.current - 1))} aria-label="Decrease progress"><Minus className="h-3.5 w-3.5" /></button>
          <button className="btn-outline flex-1 py-1.5 text-xs" onClick={() => run(() => setGoalProgress(g, g.current + 1))}><Plus className="h-3.5 w-3.5" /> Log 1 {g.unit || 'unit'}</button>
          {!done && <button className="btn-ghost py-1.5 text-xs" onClick={() => run(() => setGoalProgress(g, g.target), 'Goal completed')}>Complete</button>}
        </div>
      )}
    </div>
  );
}

function periodBounds(p: GoalPeriod, today: string, weekStart: number) {
  switch (p) {
    case 'daily': return { start: today, end: today };
    case 'weekly': return { start: startOfWeek(today, weekStart), end: endOfWeek(today, weekStart) };
    case 'monthly': return { start: startOfMonth(today), end: endOfMonth(today) };
    case 'quarterly': return { start: startOfQuarter(today), end: endOfQuarter(today) };
    case 'yearly': return { start: startOfYear(today), end: endOfYear(today) };
  }
}

function GoalForm({ open, onClose, goal }: { open: boolean; onClose: () => void; goal: Goal | null }) {
  const { categories, habits, today, settings } = useData();
  const run = useAction();
  const blank = (): Partial<Goal> => {
    const b = periodBounds('monthly', today, settings.weekStart);
    return { name: '', description: '', categoryId: categories[0]?.id, period: 'monthly', startDate: b.start, deadline: b.end, target: 10, current: 0, unit: '', linkedHabitId: null };
  };
  const [g, setG] = useState<Partial<Goal>>(blank);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (open) { setG(goal ? { ...goal } : blank()); setErr(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, goal]);
  const set = (p: Partial<Goal>) => setG((x) => ({ ...x, ...p }));
  const submit = async () => {
    const e = validateGoal(g);
    setErr(e);
    if (e) return;
    if (await run(() => saveGoal({ ...g, completed: (g.current ?? 0) >= (g.target ?? 1) }), goal ? 'Goal updated' : 'Goal created')) onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={goal ? 'Edit goal' : 'New goal'} footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={submit}>{goal ? 'Save' : 'Create goal'}</button></>}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label="Goal"><input className="input" autoFocus value={g.name ?? ''} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Complete 20 gym sessions" /></Field>
        <Field label="Description"><textarea className="input min-h-[56px]" value={g.description ?? ''} onChange={(e) => set({ description: e.target.value })} /></Field>
        <Field label="Timeframe">
          <div className="overflow-x-auto">
            <Segmented value={g.period ?? 'monthly'} onChange={(p) => { const b = periodBounds(p, today, settings.weekStart); set({ period: p, startDate: b.start, deadline: b.end }); }} options={PERIODS} />
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category"><CategorySelect categories={categories} value={g.categoryId ?? ''} onChange={(v) => set({ categoryId: v })} /></Field>
          <Field label="Unit"><input className="input" value={g.unit ?? ''} onChange={(e) => set({ unit: e.target.value })} placeholder="sessions, hours, books" /></Field>
          <Field label="Start date"><input className="input" type="date" value={g.startDate ?? ''} onChange={(e) => set({ startDate: e.target.value })} /></Field>
          <Field label="Deadline"><input className="input" type="date" value={g.deadline ?? ''} onChange={(e) => set({ deadline: e.target.value })} /></Field>
          <Field label="Target value"><input className="input" type="number" min={1} value={g.target ?? 1} onChange={(e) => set({ target: Number(e.target.value) })} /></Field>
          <Field label="Current progress"><input className="input" type="number" min={0} disabled={!!g.linkedHabitId} value={g.current ?? 0} onChange={(e) => set({ current: Number(e.target.value) })} /></Field>
        </div>
        <Field label="Track automatically from a habit (optional)" hint="Each completed day of the habit between start and deadline counts as 1.">
          <select className="input" value={g.linkedHabitId ?? ''} onChange={(e) => set({ linkedHabitId: e.target.value || null })}>
            <option value="">Manual progress</option>
            {habits.filter((h) => !h.archived).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </Field>
        {err && <p className="text-xs text-danger">{err}</p>}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
