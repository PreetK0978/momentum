import { useMemo, useState, type ReactNode } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { Flame, CheckCircle2, ListTodo, Activity, CalendarCheck, Gauge, GripVertical, LayoutGrid, Eye, EyeOff, X, ArrowRight } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useData } from '@/hooks/data';
import { navigate, useAction, useThemeColors, withAlpha } from '@/hooks/ui';
import { Card, CategoryBadge, ChartTip, Empty, InfoTip, LucideIcon, ProgressBar, ProgressRing, Segmented, Stat, Trend } from '@/components/ui';
import { ContributionHeatmap, DailyTrendChart, HeatLegend } from '@/components/charts';
import { Check } from '@/components/Check';
import { addDays, addMonths, endOfMonth, fmtLong, fmtMonth, monthKeyOf, parseMonthKey, startOfMonth, daysInMonth, type DateKey } from '@/lib/date';
import { fmtPct, scoreTone } from '@/lib/scoring';
import { goalPct, goalProgress } from '@/lib/goals';
import { setHabitValue, toggleHabit, toggleTask, updateSettings } from '@/db/repo';
import { clearSampleData } from '@/db/sample';
import type { WidgetId } from '@/db/types';
import { cn } from '@/lib/cn';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

const TONE_LABEL = { good: 'On track', mid: 'Building', low: 'Behind', none: 'Nothing planned' } as const;

export function Overview() {
  const { settings, engine, today, tasks } = useData();
  const run = useAction();
  const [editing, setEditing] = useState(false);

  const month = engine.period(startOfMonth(today), endOfMonth(today));
  const prevMonthKey = addMonths(monthKeyOf(today), -1);
  const prevMonth = engine.period(`${prevMonthKey}-01`, endOfMonth(`${prevMonthKey}-01`));
  const day = engine.day(today);
  const yesterday = engine.day(addDays(today, -1));
  const cons = engine.consistency(30);
  const streak = engine.streak();
  const openTasks = tasks.filter((t) => t.kind !== 'recurring' && !t.completedOn);
  const overdue = openTasks.filter((t) => t.dueDate && t.dueDate < today).length;

  const widgets = settings.widgets;
  const order = widgets.map((w) => w.id);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-subtle">{fmtLong(today)}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-[28px]">
            {greeting()}
            {settings.userName ? `, ${settings.userName}` : ''}.
          </h1>
        </div>
        <div className="flex gap-2">
          <button className={cn(editing ? 'btn-primary' : 'btn-outline')} onClick={() => setEditing((e) => !e)}>
            <LayoutGrid className="h-4 w-4" />
            {editing ? 'Done' : 'Customize'}
          </button>
        </div>
      </div>

      {settings.hasSampleData && (
        <div className="mb-5 flex flex-col gap-3 rounded-xl border border-accent/30 bg-accent/[0.07] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted">You're previewing Momentum with sample data. Your own habits and tasks are kept when you clear it.</span>
          <button className="btn-outline shrink-0 py-1.5 text-xs" onClick={() => run(clearSampleData, 'Sample data cleared')}>
            <X className="h-3.5 w-3.5" /> Clear sample data
          </button>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Today" value={fmtPct(day.score)} icon={<Gauge className="h-4 w-4" />} sub={`${day.done}/${day.planned} done`} />
        <Stat label="This month" value={fmtPct(month.score)} icon={<CalendarCheck className="h-4 w-4" />} sub={<Trend delta={month.score !== null && prevMonth.score !== null ? month.score - prevMonth.score : null} />} />
        <Stat label="Consistency" value={fmtPct(cons.pct)} icon={<Activity className="h-4 w-4" />} sub={`${cons.successful}/${cons.scored} days ≥ ${settings.successThreshold}%`} hint="Share of scored days in the last 30 days that met your success threshold" />
        <Stat label="Done this month" value={month.done} icon={<CheckCircle2 className="h-4 w-4" />} sub={`of ${month.planned} planned`} />
        <Stat label="Open tasks" value={openTasks.length} icon={<ListTodo className="h-4 w-4" />} sub={overdue ? <span className="text-danger">{overdue} overdue</span> : 'None overdue'} />
        <Stat label="Streak" value={<span className="inline-flex items-baseline gap-1">{streak.current}<span className="text-sm font-normal text-subtle">days</span></span>} icon={<Flame className="h-4 w-4" />} sub={`Best: ${streak.best} days`} />
      </div>

      {editing ? (
        <Reorder.Group axis="y" values={order} onReorder={(ids) => updateSettings({ widgets: ids.map((id) => widgets.find((w) => w.id === id)!) })} className="grid gap-2">
          {widgets.map((w) => (
            <EditableWidget key={w.id} id={w.id} visible={w.visible} onToggle={() => updateSettings({ widgets: widgets.map((x) => (x.id === w.id ? { ...x, visible: !x.visible } : x)) })} />
          ))}
        </Reorder.Group>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {widgets.filter((w) => w.visible).map((w) => (
            <Widget key={w.id} id={w.id} ctx={{ day, yesterdayScore: yesterday.score, month, today }} />
          ))}
        </div>
      )}
    </div>
  );
}

const WIDGET_META: Record<WidgetId, { label: string; wide?: boolean }> = {
  today: { label: "Today's performance" },
  month: { label: 'Monthly performance' },
  'habits-today': { label: "Today's checklist" },
  trends: { label: 'Performance trends', wide: true },
  categories: { label: 'Category performance' },
  heatmap: { label: 'Consistency heatmap' },
  goals: { label: 'Goals in progress' },
};

function EditableWidget({ id, visible, onToggle }: { id: WidgetId; visible: boolean; onToggle: () => void }) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={id} dragListener={false} dragControls={controls} className="card flex items-center gap-3 px-3 py-3">
      <button className="icon-btn cursor-grab touch-none active:cursor-grabbing" onPointerDown={(e) => controls.start(e)} aria-label="Drag to reorder">
        <GripVertical className="h-4 w-4" />
      </button>
      <span className={cn('flex-1 text-sm', !visible && 'text-subtle line-through')}>{WIDGET_META[id].label}</span>
      <button className="icon-btn" onClick={onToggle} aria-label={visible ? 'Hide widget' : 'Show widget'}>
        {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>
    </Reorder.Item>
  );
}

interface Ctx {
  day: ReturnType<ReturnType<typeof useData>['engine']['day']>;
  yesterdayScore: number | null;
  month: ReturnType<ReturnType<typeof useData>['engine']['period']>;
  today: DateKey;
}

function Widget({ id, ctx }: { id: WidgetId; ctx: Ctx }) {
  const wide = WIDGET_META[id].wide;
  const body: Record<WidgetId, ReactNode> = {
    today: <TodayWidget ctx={ctx} />,
    month: <MonthWidget ctx={ctx} />,
    'habits-today': <ChecklistWidget today={ctx.today} />,
    trends: <TrendsWidget />,
    categories: <CategoriesWidget />,
    heatmap: <HeatmapWidget />,
    goals: <GoalsWidget />,
  };
  return <div className={cn(wide && 'lg:col-span-2')}>{body[id]}</div>;
}

function TodayWidget({ ctx }: { ctx: Ctx }) {
  const { settings } = useData();
  const { day } = ctx;
  const tone = scoreTone(day.score, settings.successThreshold);
  const toneColor = { good: 'text-success', mid: 'text-warning', low: 'text-danger', none: 'text-subtle' }[tone];
  return (
    <Card
      title="Today's performance"
      subtitle="Completed planned items vs. everything planned today"
      action={<InfoTip>Daily score = completed planned items ÷ planned items × 100. Only habits scheduled for today and tasks due today count.</InfoTip>}
      className="h-full"
    >
      <div className="flex flex-col items-center gap-6 sm:flex-row">
        <ProgressRing value={day.score} size={148} stroke={12}>
          <div>
            <div className="num text-3xl font-semibold">{fmtPct(day.score)}</div>
            <div className={cn('mt-0.5 text-xs font-medium', toneColor)}>{TONE_LABEL[tone]}</div>
          </div>
        </ProgressRing>
        <div className="grid w-full flex-1 grid-cols-2 gap-3">
          <Mini label="Completed" value={day.done} />
          <Mini label="Planned" value={day.planned} />
          <Mini label="Remaining" value={day.planned - day.done} />
          <Mini label="vs. yesterday" value={<Trend delta={day.score !== null && ctx.yesterdayScore !== null ? day.score - ctx.yesterdayScore : null} />} />
          <div className="col-span-2">
            <div className="mb-1.5 flex justify-between text-xs text-subtle">
              <span>Daily target</span>
              <span className="num">{settings.dailyTarget}%</span>
            </div>
            <div className="relative">
              <ProgressBar value={day.score} />
              <span className="absolute -top-1 h-3.5 w-0.5 rounded bg-fg/60" style={{ left: `${settings.dailyTarget}%` }} />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-bg/40 px-3 py-2.5">
      <div className="text-[11px] text-subtle">{label}</div>
      <div className="num mt-0.5 text-lg font-semibold">{value}</div>
    </div>
  );
}

function MonthWidget({ ctx }: { ctx: Ctx }) {
  const { habits, settings, today } = useData();
  const { month } = ctx;
  const { year, month0 } = parseMonthKey(monthKeyOf(today));
  const elapsed = Number(today.slice(8));
  const habitLogsDone = month.days.reduce((a, d) => a + d.done, 0);
  const active = habits.filter((h) => !h.archived).length;
  return (
    <Card
      title="Monthly performance"
      subtitle={fmtMonth(monthKeyOf(today))}
      action={<InfoTip>Monthly score = average of daily scores across days that had planned activities. Days with nothing scheduled are ignored.</InfoTip>}
      className="h-full"
    >
      <div className="flex items-end justify-between">
        <div>
          <div className="num text-4xl font-semibold">{fmtPct(month.score, 1)}</div>
          <div className="mt-1 text-xs text-subtle">Monthly completion score</div>
        </div>
        <div className="text-right text-xs text-subtle">
          Day {elapsed} of {daysInMonth(year, month0)}
        </div>
      </div>
      <ProgressBar className="mt-4" value={month.score} />
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Mini label="Completed" value={habitLogsDone} />
        <Mini label="Active habits" value={active} />
        <Mini label="Avg. daily" value={fmtPct(month.score)} />
        <Mini label={`Days ≥ ${settings.successThreshold}%`} value={`${month.successfulDays}/${month.scoredDays}`} />
      </div>
    </Card>
  );
}

function ChecklistWidget({ today }: { today: DateKey }) {
  const { engine, habits, tasks, catMap } = useData();
  const items = engine.items(today);
  const done = items.filter((i) => i.done).length;
  return (
    <Card
      title="Today's checklist"
      subtitle={`${done} of ${items.length} complete`}
      action={<button className="btn-ghost px-2 py-1 text-xs" onClick={() => navigate('planner')}>Planner <ArrowRight className="h-3.5 w-3.5" /></button>}
      className="h-full"
    >
      {items.length === 0 ? (
        <Empty title="Nothing planned today" body="Add habits in the Monthly Tracker or tasks in the Planner." />
      ) : (
        <ul className="-mx-2 max-h-[300px] overflow-y-auto">
          {items.map((it) => {
            const habit = it.kind === 'habit' ? habits.find((h) => h.id === it.id) : undefined;
            const task = it.kind === 'task' ? tasks.find((t) => t.id === it.id) : undefined;
            const toggle = () => (habit ? toggleHabit(habit, today) : task && toggleTask(task, today));
            return (
              <li key={it.kind + it.id} className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-elevated/60">
                <Check checked={it.done} onChange={toggle} label={`Mark ${it.name} ${it.done ? 'incomplete' : 'complete'}`} partial={it.target > 1 ? it.value / it.target : 0} />
                <div className="min-w-0 flex-1">
                  <div className={cn('truncate text-sm transition', it.done && 'text-subtle line-through decoration-subtle/60')}>{it.name}</div>
                  <CategoryBadge category={catMap.get(it.categoryId)} />
                </div>
                {habit && habit.target > 1 && (
                  <div className="flex items-center gap-1 text-xs text-muted">
                    <button className="icon-btn h-6 w-6" onClick={() => setHabitValue(habit.id, today, Math.max(0, it.value - 1))} aria-label="Decrease">−</button>
                    <span className="num w-14 text-center">{it.value}/{habit.target}</span>
                    <button className="icon-btn h-6 w-6" onClick={() => setHabitValue(habit.id, today, it.value + 1)} aria-label="Increase">+</button>
                  </div>
                )}
                <span className="text-[10px] uppercase tracking-wider text-subtle">{it.kind}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function TrendsWidget() {
  const { engine, today, categories } = useData();
  const c = useThemeColors();
  const [tab, setTab] = useState<'daily' | 'weekly' | 'monthly' | 'category' | 'history'>('daily');
  const data = useMemo(() => {
    if (tab === 'daily') return engine.period(addDays(today, -29), today).days;
    return [];
  }, [tab, engine, today]);
  const weekly = useMemo(() => engine.weeks(addDays(today, -7 * 11), today).map((w) => ({ label: w.from, Score: w.score === null ? null : Math.round(w.score) })), [engine, today]);
  const monthly = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const mk = addMonths(monthKeyOf(today), i - 5);
        const p = engine.period(`${mk}-01`, endOfMonth(`${mk}-01`));
        return { label: mk, Score: p.score === null ? null : Math.round(p.score), Consistency: p.scoredDays ? Math.round((p.successfulDays / p.scoredDays) * 100) : null };
      }),
    [engine, today],
  );
  const cats = useMemo(() => engine.categoryScores(addDays(today, -29), today).filter((x) => x.planned > 0).map((x) => ({ label: x.category.name, Score: Math.round(x.pct ?? 0), color: x.category.color })), [engine, today]);
  const history = useMemo(() => {
    const first = monthKeyOf(engine.earliest);
    const out = [];
    for (let mk = first; mk <= monthKeyOf(today); mk = addMonths(mk, 1)) {
      const p = engine.period(`${mk}-01`, endOfMonth(`${mk}-01`));
      out.push({ label: mk, Score: p.score === null ? null : Math.round(p.score) });
    }
    return out;
  }, [engine, today]);

  const axis = { tick: { fill: c.subtle, fontSize: 11 }, axisLine: false, tickLine: false };
  const yAxis = <YAxis domain={[0, 100]} ticks={[0, 50, 100]} {...axis} tickFormatter={(v) => `${v}%`} />;
  const grid = <CartesianGrid vertical={false} stroke={c.line} strokeOpacity={0.6} />;

  return (
    <Card
      title="Performance trends"
      action={
        <div className="max-w-full overflow-x-auto">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Consistency' },
              { value: 'category', label: 'Categories' },
              { value: 'history', label: 'History' },
            ]}
          />
        </div>
      }
    >
      <div className="h-[240px]">
        {tab === 'daily' && <DailyTrendChart days={data} height={240} />}
        {tab === 'weekly' && (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={weekly} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              {grid}
              <XAxis dataKey="label" {...axis} tickFormatter={(d) => new Date(d + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} />
              {yAxis}
              <Tooltip cursor={{ fill: withAlpha(c.fg, 0.04) }} content={<ChartTip labelFmt={(l) => `Week of ${new Date(l + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`} />} />
              <Bar dataKey="Score" radius={[4, 4, 0, 0]} maxBarSize={34}>
                {weekly.map((_, i) => <Cell key={i} fill={i === weekly.length - 1 ? c.accent : withAlpha(c.accent, 0.5)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        {tab === 'monthly' && (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={monthly} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
              {grid}
              <XAxis dataKey="label" {...axis} tickFormatter={(m) => fmtMonth(m, true)} />
              {yAxis}
              <Tooltip content={<ChartTip labelFmt={(l) => fmtMonth(String(l))} />} />
              <Line type="monotone" dataKey="Score" stroke={c.accent} strokeWidth={2} dot={{ r: 3, fill: c.accent, stroke: c.surface, strokeWidth: 2 }} connectNulls />
              <Line type="monotone" dataKey="Consistency" stroke={c.accent2} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: c.accent2, stroke: c.surface, strokeWidth: 2 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
        {tab === 'category' &&
          (cats.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={cats} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid horizontal={false} stroke={c.line} strokeOpacity={0.6} />
                <XAxis type="number" domain={[0, 100]} {...axis} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="label" {...axis} width={120} />
                <Tooltip cursor={{ fill: withAlpha(c.fg, 0.04) }} content={<ChartTip />} />
                <Bar dataKey="Score" radius={[0, 4, 4, 0]} maxBarSize={18}>
                  {cats.map((x) => <Cell key={x.label} fill={x.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Empty title="No category data in the last 30 days" />
          ))}
        {tab === 'history' && (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={history} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
              {grid}
              <XAxis dataKey="label" {...axis} tickFormatter={(m) => fmtMonth(m, true)} />
              {yAxis}
              <Tooltip content={<ChartTip labelFmt={(l) => fmtMonth(String(l))} />} />
              <Line type="monotone" dataKey="Score" name="Monthly score" stroke={c.accent} strokeWidth={2} dot={{ r: 3, fill: c.accent, stroke: c.surface, strokeWidth: 2 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="mt-3 text-xs text-subtle">
        {tab === 'daily' && 'Last 30 days. Dashed line marks your success threshold; the second line is a 7-day rolling average.'}
        {tab === 'weekly' && 'Average daily score per week, last 12 weeks. Current week highlighted.'}
        {tab === 'monthly' && 'Solid: monthly score. Dashed: share of days that met your success threshold.'}
        {tab === 'category' && `Completion rate by category over the last 30 days (${categories.length} categories).`}
        {tab === 'history' && 'Every month since your first tracked activity.'}
      </p>
    </Card>
  );
}

function CategoriesWidget() {
  const { engine, today } = useData();
  const rows = engine.categoryScores(startOfMonth(today), today);
  return (
    <Card title="Category performance" subtitle="This month · completed ÷ planned" action={<InfoTip>Category score = completed activities ÷ planned activities in that category during the month.</InfoTip>} className="h-full">
      <ul className="grid gap-3.5">
        {rows.map(({ category, pct, done, planned }) => (
          <li key={category.id}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-md" style={{ background: category.color + '22', color: category.color }}>
                  <LucideIcon name={category.icon} className="h-3.5 w-3.5" />
                </span>
                {category.name}
              </span>
              <span className="num text-xs text-muted">
                {planned ? `${done}/${planned} · ` : ''}
                <span className="font-medium text-fg">{fmtPct(pct)}</span>
              </span>
            </div>
            <ProgressBar value={pct} color={category.color} height={5} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function HeatmapWidget() {
  const { today } = useData();
  return (
    <Card title="Consistency heatmap" subtitle="Last 6 months · click a day for details" action={<HeatLegend />} className="h-full">
      <ContributionHeatmap from={addDays(today, -26 * 7)} to={today} cell={11} />
    </Card>
  );
}

function GoalsWidget() {
  const { goals, engine, catMap } = useData();
  const active = goals.filter((g) => !g.completed && goalProgress(g, engine) < g.target).sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 5);
  return (
    <Card title="Goals in progress" action={<button className="btn-ghost px-2 py-1 text-xs" onClick={() => navigate('goals')}>All goals <ArrowRight className="h-3.5 w-3.5" /></button>} className="h-full">
      {active.length === 0 ? (
        <Empty title="No active goals" body="Set measurable goals like “Read 2 books” or “Study 60 hours”." action={<button className="btn-outline text-xs" onClick={() => navigate('goals')}>Create a goal</button>} />
      ) : (
        <ul className="grid gap-4">
          {active.map((g) => {
            const cat = catMap.get(g.categoryId);
            return (
              <li key={g.id}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{g.name}</span>
                  <span className="num shrink-0 text-xs text-muted">
                    {goalProgress(g, engine)}/{g.target} {g.unit}
                  </span>
                </div>
                <ProgressBar value={goalPct(g, engine)} color={cat?.color} height={5} />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
