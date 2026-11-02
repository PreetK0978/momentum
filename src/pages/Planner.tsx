import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion';
import { Plus, Search, GripVertical, Pencil, Trash2, Clock, Repeat, CalendarDays, AlertTriangle, ChevronDown, Inbox, CheckCheck, Sun, Flag } from 'lucide-react';
import { useData } from '@/hooks/data';
import { useAction } from '@/hooks/ui';
import { Card, CategoryBadge, Empty, PageHeader, ProgressBar, Segmented, useConfirm } from '@/components/ui';
import { Check } from '@/components/Check';
import { HabitForm, PRIORITIES, TaskForm } from '@/components/forms';
import { deleteTask, reorderTasks, setHabitValue, toggleHabit, toggleTask } from '@/db/repo';
import type { Priority, Task } from '@/db/types';
import { addDays, fmtDate, rangeKeys, type DateKey } from '@/lib/date';
import { describeRecurrence, habitCountsOn, taskOccursOn, taskVisibleOn } from '@/lib/schedule';
import { fmtPct } from '@/lib/scoring';
import { cn } from '@/lib/cn';

type View = 'today' | 'upcoming' | 'completed' | 'overdue';
type Sort = 'manual' | 'priority' | 'due' | 'duration' | 'title';
const PRIO_RANK: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const KIND_LABEL = { 'one-time': 'Task', recurring: 'Recurring', 'weekly-goal': 'Weekly goal', 'monthly-objective': 'Monthly objective' };

export function Planner() {
  const { tasks, habits, engine, today, categories, catMap } = useData();
  const [view, setView] = useState<View>('today');
  const [sort, setSort] = useState<Sort>('manual');
  const [cat, setCat] = useState('all');
  const [prio, setPrio] = useState<'all' | Priority>('all');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Task | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [habitForm, setHabitForm] = useState(false);
  const { confirm, dialog } = useConfirm();
  const run = useAction();

  const filter = (t: Task) =>
    (cat === 'all' || t.categoryId === cat) &&
    (prio === 'all' || t.priority === prio) &&
    (!q || (t.title + ' ' + t.description + ' ' + t.notes).toLowerCase().includes(q.toLowerCase()));

  const sorter = (a: Task, b: Task) => {
    switch (sort) {
      case 'priority': return PRIO_RANK[a.priority] - PRIO_RANK[b.priority] || a.order - b.order;
      case 'due': return (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.order - b.order;
      case 'duration': return b.estMinutes - a.estMinutes;
      case 'title': return a.title.localeCompare(b.title);
      default: return a.order - b.order;
    }
  };

  const overdue = tasks.filter((t) => t.kind !== 'recurring' && !t.completedOn && t.dueDate && t.dueDate < today);
  const counts = {
    today: tasks.filter((t) => taskVisibleOn(t, today, engine.data.settings.weekStart)).length,
    overdue: overdue.length,
  };

  const onDelete = async (t: Task) => {
    if (await confirm('Delete task?', `"${t.title}" and its completion history will be permanently removed.`)) run(() => deleteTask(t.id), 'Task deleted');
  };
  const onEdit = (t: Task) => { setEditing(t); setFormOpen(true); };

  const rowProps = { onEdit, onDelete, draggable: sort === 'manual' };

  return (
    <div>
      <PageHeader
        title="Daily Planner"
        subtitle={fmtDate(today, { weekday: 'long', month: 'long', day: 'numeric' })}
        actions={
          <>
            <button className="btn-outline" onClick={() => setHabitForm(true)}><Repeat className="h-4 w-4" /> New habit</button>
            <button className="btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" /> New task</button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="overflow-x-auto">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'today', label: <span className="flex items-center gap-1.5"><Sun className="h-3.5 w-3.5" />Today <Count n={counts.today} /></span> },
              { value: 'upcoming', label: <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />Upcoming</span> },
              { value: 'completed', label: <span className="flex items-center gap-1.5"><CheckCheck className="h-3.5 w-3.5" />Completed</span> },
              { value: 'overdue', label: <span className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" />Overdue <Count n={counts.overdue} danger /></span> },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
            <input className="input w-44 py-1.5 pl-8 text-xs" placeholder="Search tasks" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input w-auto py-1.5 text-xs" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filter by category">
            <option value="all">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input w-auto py-1.5 text-xs" value={prio} onChange={(e) => setPrio(e.target.value as 'all' | Priority)} aria-label="Filter by priority">
            <option value="all">All priorities</option>
            {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select className="input w-auto py-1.5 text-xs" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
            <option value="manual">Manual order</option>
            <option value="priority">Priority</option>
            <option value="due">Due date</option>
            <option value="duration">Duration</option>
            <option value="title">Title</option>
          </select>
        </div>
      </div>

      {view === 'today' && <TodayView filter={filter} sorter={sorter} rowProps={rowProps} />}

      {view === 'upcoming' && (
        <div className="grid gap-4">
          {rangeKeys(addDays(today, 1), addDays(today, 14)).map((d) => {
            const list = tasks.filter((t) => taskVisibleOn(t, d, engine.data.settings.weekStart) && (t.kind === 'recurring' || (!t.completedOn && t.dueDate === d)) && filter(t)).sort(sorter);
            const hs = habits.filter((h) => habitCountsOn(h, d)).length;
            if (!list.length) return null;
            return (
              <Card key={d} title={fmtDate(d, { weekday: 'long', month: 'short', day: 'numeric' })} subtitle={`${list.length} task${list.length === 1 ? '' : 's'} · ${hs} habit${hs === 1 ? '' : 's'} scheduled`}>
                <TaskList tasks={list} date={d} {...rowProps} />
              </Card>
            );
          })}
          <InboxCard tasks={tasks.filter((t) => !t.dueDate && !t.completedOn && filter(t)).sort(sorter)} rowProps={rowProps} />
          {!tasks.some((t) => t.dueDate && t.dueDate > today) && !tasks.some((t) => !t.dueDate) && <Card><Empty icon={<CalendarDays className="h-5 w-5" />} title="Nothing upcoming" body="Tasks due in the next 14 days will appear here." /></Card>}
        </div>
      )}

      {view === 'overdue' && (
        <Card title="Overdue" subtitle="Unfinished tasks past their due date. Completing them now won't change past scores unless late completion is enabled in Settings.">
          {overdue.filter(filter).length ? <TaskList tasks={overdue.filter(filter).sort(sorter)} date={today} showDue {...rowProps} /> : <Empty icon={<CheckCheck className="h-5 w-5" />} title="Nothing overdue" body="You're on top of everything." />}
        </Card>
      )}

      {view === 'completed' && <CompletedView filter={filter} catMap={catMap} />}

      <TaskForm open={formOpen} onClose={() => setFormOpen(false)} task={editing} />
      <HabitForm open={habitForm} onClose={() => setHabitForm(false)} />
      {dialog}
    </div>
  );
}

function Count({ n, danger }: { n: number; danger?: boolean }) {
  if (!n) return null;
  return <span className={cn('num rounded px-1 text-[10px]', danger ? 'bg-danger/15 text-danger' : 'bg-line text-muted')}>{n}</span>;
}

interface RowProps { onEdit: (t: Task) => void; onDelete: (t: Task) => void; draggable: boolean }

function TodayView({ filter, sorter, rowProps }: { filter: (t: Task) => boolean; sorter: (a: Task, b: Task) => number; rowProps: RowProps }) {
  const { tasks, habits, engine, today, catMap, settings } = useData();
  const list = tasks.filter((t) => taskVisibleOn(t, today, settings.weekStart) && filter(t)).sort(sorter);
  const todaysHabits = habits.filter((h) => habitCountsOn(h, today));
  const day = engine.day(today);
  const minutes = list.filter((t) => !engine.isTaskDone(t, today) || t.kind !== 'recurring').reduce((a, t) => a + (engine.isTaskDone(t, today) ? 0 : t.estMinutes), 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="grid content-start gap-4">
        <Card title="Tasks" subtitle={`${list.length} for today · ${Math.floor(minutes / 60)}h ${minutes % 60}m remaining`}>
          {list.length ? <TaskList tasks={list} date={today} {...rowProps} /> : <Empty icon={<Inbox className="h-5 w-5" />} title="No tasks for today" body="Press N anywhere to add one." />}
        </Card>
      </div>
      <div className="grid content-start gap-4">
        <Card title="Today's score" subtitle="Habits + tasks scheduled today">
          <div className="num text-3xl font-semibold">{fmtPct(day.score)}</div>
          <ProgressBar className="mt-3" value={day.score} />
          <p className="mt-2 text-xs text-subtle">{day.done} of {day.planned} planned items complete</p>
        </Card>
        <Card title="Habits today" subtitle={`${todaysHabits.filter((h) => engine.habitValue(h.id, today) >= h.target).length} of ${todaysHabits.length} done`}>
          {todaysHabits.length ? (
            <ul className="-mx-2">
              {todaysHabits.map((h) => {
                const v = engine.habitValue(h.id, today);
                const done = v >= h.target;
                return (
                  <li key={h.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-elevated/60">
                    <Check checked={done} onChange={() => toggleHabit(h, today)} label={`Toggle ${h.name}`} partial={h.target > 1 ? v / h.target : 0} />
                    <div className="min-w-0 flex-1">
                      <div className={cn('truncate text-sm', done && 'text-subtle line-through')}>{h.name}</div>
                      <CategoryBadge category={catMap.get(h.categoryId)} />
                    </div>
                    {h.target > 1 && (
                      <div className="flex items-center text-xs text-muted">
                        <button className="icon-btn h-6 w-6" onClick={() => setHabitValue(h.id, today, Math.max(0, v - 1))} aria-label="Decrease">−</button>
                        <span className="num min-w-[44px] text-center">{v}/{h.target}</span>
                        <button className="icon-btn h-6 w-6" onClick={() => setHabitValue(h.id, today, v + 1)} aria-label="Increase">+</button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty title="No habits scheduled today" />
          )}
        </Card>
      </div>
    </div>
  );
}

function InboxCard({ tasks, rowProps }: { tasks: Task[]; rowProps: RowProps }) {
  const { today } = useData();
  if (!tasks.length) return null;
  return (
    <Card title="No due date" subtitle="Unscheduled tasks never affect your score">
      <TaskList tasks={tasks} date={today} {...rowProps} />
    </Card>
  );
}

function TaskList({ tasks, date, onEdit, onDelete, draggable, showDue }: { tasks: Task[]; date: DateKey; showDue?: boolean } & RowProps) {
  const { tasks: all } = useData();
  const [ids, setIds] = useState(tasks.map((t) => t.id));
  const key = tasks.map((t) => t.id).join(',');
  useEffect(() => setIds(tasks.map((t) => t.id)), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const persist = () => {
    // write the new relative order back into the global ordering
    const full = [...all].sort((a, b) => a.order - b.order).map((t) => t.id);
    const subset = new Set(ids);
    const slots = full.map((id, i) => (subset.has(id) ? i : -1)).filter((i) => i >= 0);
    slots.forEach((slot, i) => (full[slot] = ids[i]));
    reorderTasks(full);
  };

  if (!draggable)
    return (
      <div className="-mx-2 grid gap-0.5">
        {tasks.map((t) => <TaskRow key={t.id} task={t} date={date} onEdit={onEdit} onDelete={onDelete} showDue={showDue} />)}
      </div>
    );
  return (
    <Reorder.Group as="div" axis="y" values={ids} onReorder={setIds} className="-mx-2 grid gap-0.5">
      {ids.map((id) => byId.get(id)).filter(Boolean).map((t) => (
        <DraggableRow key={t!.id} task={t!} date={date} onEdit={onEdit} onDelete={onDelete} onDrop={persist} showDue={showDue} />
      ))}
    </Reorder.Group>
  );
}

function DraggableRow(p: { task: Task; date: DateKey; onEdit: (t: Task) => void; onDelete: (t: Task) => void; onDrop: () => void; showDue?: boolean }) {
  const controls = useDragControls();
  return (
    <Reorder.Item as="div" value={p.task.id} dragListener={false} dragControls={controls} onDragEnd={p.onDrop} className="relative" whileDrag={{ scale: 1.01, zIndex: 10 }}>
      <TaskRow {...p} handle={<button className="icon-btn h-6 w-5 cursor-grab touch-none text-subtle opacity-0 group-hover:opacity-100 active:cursor-grabbing" onPointerDown={(e) => controls.start(e)} aria-label="Drag to reorder"><GripVertical className="h-3.5 w-3.5" /></button>} />
    </Reorder.Item>
  );
}

function TaskRow({ task: t, date, onEdit, onDelete, handle, showDue }: { task: Task; date: DateKey; onEdit: (t: Task) => void; onDelete: (t: Task) => void; handle?: React.ReactNode; showDue?: boolean }) {
  const { engine, catMap, today } = useData();
  const [open, setOpen] = useState(false);
  const done = t.kind === 'recurring' ? engine.isTaskDone(t, date) : !!t.completedOn;
  const prio = PRIORITIES.find((p) => p.value === t.priority)!;
  const future = t.kind === 'recurring' && date > today;
  const isOverdue = t.kind !== 'recurring' && !done && t.dueDate && t.dueDate < today;
  return (
    <div className="group rounded-xl border border-transparent bg-surface transition hover:border-line hover:bg-elevated/50">
      <div className="flex items-center gap-2 px-2 py-2.5">
        {handle ?? <span className="w-5" />}
        <Check checked={done} disabled={future} onChange={() => toggleTask(t, date)} label={`Mark ${t.title} ${done ? 'incomplete' : 'complete'}`} />
        <button className="min-w-0 flex-1 pl-1 text-left" onClick={() => setOpen((o) => !o)}>
          <div className="flex items-center gap-2">
            {t.color && <span className="h-3 w-1 shrink-0 rounded-full" style={{ background: t.color }} />}
            <span className={cn('truncate text-sm', done && 'text-subtle line-through')}>{t.title}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-subtle">
            <CategoryBadge category={catMap.get(t.categoryId)} className="text-[11px]" />
            {t.kind !== 'one-time' && <span className="inline-flex items-center gap-1"><Repeat className="h-3 w-3" />{t.kind === 'recurring' ? describeRecurrence(t) : KIND_LABEL[t.kind]}</span>}
            {t.estMinutes > 0 && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{t.estMinutes}m</span>}
            {(showDue || t.kind === 'weekly-goal' || t.kind === 'monthly-objective') && t.dueDate && (
              <span className={cn('inline-flex items-center gap-1', isOverdue && 'text-danger')}><CalendarDays className="h-3 w-3" />{fmtDate(t.dueDate)}</span>
            )}
          </div>
        </button>
        <span className="hidden items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] sm:inline-flex" style={{ color: prio.color, background: `color-mix(in srgb, ${prio.color} 12%, transparent)` }}>
          <Flag className="h-3 w-3" />{prio.label}
        </span>
        <div className="flex opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
          <button className="icon-btn h-7 w-7" onClick={() => onEdit(t)} aria-label="Edit task"><Pencil className="h-3.5 w-3.5" /></button>
          <button className="icon-btn h-7 w-7 hover:text-danger" onClick={() => onDelete(t)} aria-label="Delete task"><Trash2 className="h-3.5 w-3.5" /></button>
          <button className="icon-btn h-7 w-7" onClick={() => setOpen((o) => !o)} aria-label="Toggle details"><ChevronDown className={cn('h-3.5 w-3.5 transition', open && 'rotate-180')} /></button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="grid gap-2 border-t border-line px-10 py-3 text-xs text-muted sm:grid-cols-2">
              <div><span className="label mb-1 block">Description</span>{t.description || <span className="text-subtle">—</span>}</div>
              <div><span className="label mb-1 block">Notes</span>{t.notes || <span className="text-subtle">—</span>}</div>
              <div><span className="label mb-1 block">Due</span>{t.dueDate ? fmtDate(t.dueDate, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'No due date'}</div>
              <div><span className="label mb-1 block">Weight · Priority</span>{t.weight} · {prio.label}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CompletedView({ filter, catMap }: { filter: (t: Task) => boolean; catMap: Map<string, import('@/db/types').Category> }) {
  const { tasks, engine, today } = useData();
  const entries = useMemo(() => {
    const out: { task: Task; date: DateKey }[] = [];
    for (const t of tasks) {
      if (!filter(t)) continue;
      if (t.kind === 'recurring') {
        for (const d of rangeKeys(addDays(today, -30), today)) if (taskOccursOn(t, d) && engine.isTaskDone(t, d)) out.push({ task: t, date: d });
      } else if (t.completedOn) out.push({ task: t, date: t.completedOn });
    }
    return out.sort((a, b) => b.date.localeCompare(a.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, engine, today, filter]);
  const groups = new Map<string, typeof entries>();
  for (const e of entries) groups.set(e.date, [...(groups.get(e.date) ?? []), e]);
  if (!entries.length) return <Card><Empty icon={<CheckCheck className="h-5 w-5" />} title="No completed tasks yet" body="Completed tasks from the last 30 days appear here." /></Card>;
  return (
    <div className="grid gap-4">
      {[...groups].map(([d, list]) => (
        <Card key={d} title={d === today ? 'Today' : fmtDate(d, { weekday: 'long', month: 'short', day: 'numeric' })} subtitle={`${list.length} completed`}>
          <ul className="-mx-2">
            {list.map(({ task: t, date }) => (
              <li key={t.id + date} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-elevated/50">
                <Check checked onChange={() => toggleTask(t, date)} label={`Mark ${t.title} incomplete`} />
                <span className="flex-1 truncate text-sm text-muted">{t.title}</span>
                <CategoryBadge category={catMap.get(t.categoryId)} />
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
