import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrendingUp, TrendingDown, Calculator } from 'lucide-react';
import { useData } from '@/hooks/data';
import { useThemeColors, withAlpha } from '@/hooks/ui';
import { Card, ChartTip, Empty, PageHeader, ProgressBar, ProgressRing, Segmented, Trend } from '@/components/ui';
import { DailyTrendChart, SimpleBars, WeekdayBars, heatColor } from '@/components/charts';
import { addDays, addMonths, endOfMonth, endOfQuarter, endOfWeek, endOfYear, fmtDate, fmtMonth, maxKey, monthKeyOf, rangeKeys, startOfMonth, startOfQuarter, startOfWeek, startOfYear, type DateKey } from '@/lib/date';
import { fmtPct } from '@/lib/scoring';
import { habitCountsOn } from '@/lib/schedule';
import { cn } from '@/lib/cn';

type Range = '7d' | '30d' | '3m' | '6m' | '1y' | 'all';
const RANGES: { value: Range; label: string }[] = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'All' },
];

export function Analytics() {
  const { engine, today, settings } = useData();
  const [range, setRange] = useState<Range>('30d');
  const from = useMemo(() => {
    const back = { '7d': 6, '30d': 29, '3m': 90, '6m': 182, '1y': 364, all: 0 }[range];
    return range === 'all' ? engine.earliest : maxKey(addDays(today, -back), range === '1y' ? addDays(today, -364) : addDays(today, -back));
  }, [range, today, engine.earliest]);
  const period = engine.period(from, today);
  const prevLen = rangeKeys(from, today).length;
  const prev = engine.period(addDays(from, -prevLen), addDays(from, -1));

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Where you're improving, and where you're falling behind."
        actions={<Segmented value={range} onChange={setRange} options={RANGES} />}
      />

      <ScoreBoard />

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPI label="Average score" value={fmtPct(period.score, 1)} delta={period.score !== null && prev.score !== null ? period.score - prev.score : null} />
        <KPI label="Completed" value={String(period.done)} sub={`of ${period.planned} planned`} />
        <KPI label="Successful days" value={`${period.successfulDays}`} sub={`of ${period.scoredDays} scored days`} />
        <KPI label="Completion rate" value={fmtPct(period.planned ? (period.done / period.planned) * 100 : null, 1)} sub="all items, unweighted" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2" title="Daily performance" subtitle={`${fmtDate(from)} – ${fmtDate(today)} · dashed line = ${settings.successThreshold}% success threshold`}>
          <DailyTrendChart days={period.days} height={260} showAvg={period.days.length > 10} />
        </Card>
        <WeeklyChart from={from} />
        <MonthlyComparison from={from} />
        <CategoryChart from={from} />
        <CompletedVsMissed from={from} />
        <Card title="Performance by weekday" subtitle="Average daily score for each day of the week">
          <WeekdayBars from={from} to={today} height={230} />
        </Card>
        <HabitRanking from={from} />
        <HabitHeatmap from={from} />
        <MonthlyTimeline />
      </div>
    </div>
  );
}

function KPI({ label, value, sub, delta }: { label: string; value: string; sub?: string; delta?: number | null }) {
  return (
    <div className="card px-4 py-3.5">
      <div className="label">{label}</div>
      <div className="num mt-1 text-2xl font-semibold">{value}</div>
      <div className="mt-0.5 text-xs text-subtle">{delta !== undefined ? <><Trend delta={delta} /> vs. previous period</> : sub}</div>
    </div>
  );
}

function ScoreBoard() {
  const { engine, today, settings } = useData();
  const [explain, setExplain] = useState(false);
  const ws = settings.weekStart;
  const scores = [
    { label: 'Weekly', p: engine.period(startOfWeek(today, ws), endOfWeek(today, ws)) },
    { label: 'Monthly', p: engine.period(startOfMonth(today), endOfMonth(today)) },
    { label: 'Quarterly', p: engine.period(startOfQuarter(today), endOfQuarter(today)) },
    { label: 'Yearly', p: engine.period(startOfYear(today), endOfYear(today)) },
  ];
  const cons = engine.consistency(30);
  return (
    <Card
      title="Performance scores"
      subtitle={settings.useWeighted ? 'Weighted scoring is on — items count by their weight (1-5).' : 'Basic completion scoring. Enable weighted scoring in Settings.'}
      action={<button className="btn-ghost px-2 py-1 text-xs" onClick={() => setExplain((e) => !e)}><Calculator className="h-3.5 w-3.5" />{explain ? 'Hide' : 'How scores work'}</button>}
    >
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
        {scores.map(({ label, p }) => (
          <div key={label} className="flex flex-col items-center gap-2 text-center">
            <ProgressRing value={p.score} size={92} stroke={7}>
              <span className="num text-lg font-semibold">{fmtPct(p.score)}</span>
            </ProgressRing>
            <div>
              <div className="text-sm font-medium">{label}</div>
              <div className="text-[11px] text-subtle">{p.scoredDays} scored day{p.scoredDays === 1 ? '' : 's'}</div>
            </div>
          </div>
        ))}
        <div className="flex flex-col items-center gap-2 text-center">
          <ProgressRing value={cons.pct} size={92} stroke={7} color="rgb(var(--success))">
            <span className="num text-lg font-semibold">{fmtPct(cons.pct)}</span>
          </ProgressRing>
          <div>
            <div className="text-sm font-medium">Consistency</div>
            <div className="text-[11px] text-subtle">{cons.successful}/{cons.scored} days, last 30</div>
          </div>
        </div>
      </div>
      {explain && (
        <div className="mt-5 grid gap-3 rounded-xl border border-line bg-bg/40 p-4 text-xs leading-relaxed text-muted md:grid-cols-2">
          <Rule t="Planned items">Habits scheduled for that day (by frequency, start/end dates, archive date) plus tasks due or recurring that day. Weekly goals and monthly objectives count on the last day of their period. Tasks without a due date never count.</Rule>
          <Rule t="Daily score">Completed planned items ÷ planned items × 100. A habit with a numeric target is complete when its logged value reaches the target.</Rule>
          <Rule t="Weighted score">Σ weight of completed items ÷ Σ weight of planned items × 100. Each habit and task has a weight from 1 to 5.</Rule>
          <Rule t="Weekly / monthly / quarterly / yearly">Average of the daily scores across days in that period that had at least one planned item. Days with nothing scheduled are skipped — they never lower your score. Future days are excluded, and today joins the average once it reaches your success threshold (or tomorrow, when it is final).</Rule>
          <Rule t="Category score">Completed ÷ planned items for that category across the period.</Rule>
          <Rule t="Successful day & consistency">A day is successful when its score ≥ {settings.successThreshold}% (change in Settings). Consistency = successful days ÷ scored days in the last 30 days.</Rule>
          <Rule t="Streak">Consecutive successful days. Days without planned items don't break a streak, and today only counts once it's successful.</Rule>
          <Rule t="One-time tasks">Count as complete for their due date only if finished on or before it{settings.lateCompletionCounts ? ' — late completions currently count too (Settings)' : ''}.</Rule>
        </div>
      )}
    </Card>
  );
}

function Rule({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-0.5 font-medium text-fg">{t}</div>
      {children}
    </div>
  );
}

function WeeklyChart({ from }: { from: DateKey }) {
  const { engine, today } = useData();
  const data = engine.weeks(from, today).map((w) => ({ label: w.from, Score: w.score === null ? 0 : Math.round(w.score) }));
  return (
    <Card title="Weekly completion" subtitle="Average daily score per week">
      <SimpleBars data={data} labelKey="label" valueKey="Score" height={230} fmtLabel={(d) => fmtDate(d)} highlightLast />
    </Card>
  );
}

function MonthlyComparison({ from }: { from: DateKey }) {
  const { engine, today } = useData();
  const months: string[] = [];
  for (let mk = monthKeyOf(from); mk <= monthKeyOf(today); mk = addMonths(mk, 1)) months.push(mk);
  if (months.length < 2) for (let i = 1; months.length < 3; i++) months.unshift(addMonths(monthKeyOf(today), -i));
  const data = months.map((mk) => {
    const p = engine.period(`${mk}-01`, endOfMonth(`${mk}-01`));
    return { label: mk, Score: p.score === null ? 0 : Math.round(p.score) };
  });
  return (
    <Card title="Monthly comparison" subtitle="Monthly score, month over month">
      <SimpleBars data={data} labelKey="label" valueKey="Score" height={230} fmtLabel={(m) => fmtMonth(m, true)} highlightLast />
    </Card>
  );
}

function CategoryChart({ from }: { from: DateKey }) {
  const { engine, today } = useData();
  const c = useThemeColors();
  const rows = engine.categoryScores(from, today).filter((r) => r.planned > 0).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
  const data = rows.map((r) => ({ label: r.category.name, Score: Math.round(r.pct ?? 0), color: r.category.color, n: `${r.done}/${r.planned}` }));
  return (
    <Card title="Category performance" subtitle="Completed ÷ planned per category">
      {data.length ? (
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 4 }}>
            <CartesianGrid horizontal={false} stroke={c.line} strokeOpacity={0.6} />
            <XAxis type="number" domain={[0, 100]} tick={{ fill: c.subtle, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
            <YAxis type="category" dataKey="label" width={130} tick={{ fill: c.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: withAlpha(c.fg, 0.04) }} content={<ChartTip />} />
            <Bar dataKey="Score" radius={[0, 4, 4, 0]} maxBarSize={16}>
              {data.map((d) => <Cell key={d.label} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <Empty title="No category data in this range" />
      )}
    </Card>
  );
}

function CompletedVsMissed({ from }: { from: DateKey }) {
  const { engine, today } = useData();
  const c = useThemeColors();
  const weeks = engine.weeks(from, today).map((w) => ({ label: w.from, Completed: w.done, Missed: Math.max(0, w.planned - w.done) }));
  const total = weeks.reduce((a, w) => ({ d: a.d + w.Completed, m: a.m + w.Missed }), { d: 0, m: 0 });
  return (
    <Card title="Completed vs. missed" subtitle={`${total.d} completed · ${total.m} missed or still open`}>
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={weeks} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid vertical={false} stroke={c.line} strokeOpacity={0.6} />
          <XAxis dataKey="label" tick={{ fill: c.subtle, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(d) => fmtDate(d)} minTickGap={12} />
          <YAxis tick={{ fill: c.subtle, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip cursor={{ fill: withAlpha(c.fg, 0.04) }} content={<ChartTip fmt={(v) => String(v ?? 0)} labelFmt={(l) => `Week of ${fmtDate(String(l))}`} />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: c.muted }} />
          <Bar dataKey="Completed" stackId="a" fill={c.success} stroke={c.surface} strokeWidth={1} maxBarSize={30} />
          <Bar dataKey="Missed" stackId="a" fill={withAlpha(c.danger, 0.55)} stroke={c.surface} strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={30} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

function HabitRanking({ from }: { from: DateKey }) {
  const { habits, engine, today, catMap } = useData();
  const ranked = habits
    .map((h) => ({ h, ...engine.habitStats(h, from, today) }))
    .filter((x) => x.scheduled > 0)
    .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0) || b.scheduled - a.scheduled);
  const top = ranked.slice(0, Math.min(5, Math.ceil(ranked.length / 2)));
  const bottom = ranked.slice(top.length).reverse().slice(0, 5); // never overlaps with top
  const List = ({ items, good }: { items: typeof ranked; good: boolean }) => (
    <ul className="grid gap-3">
      {items.map((x) => (
        <li key={x.h.id}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: catMap.get(x.h.categoryId)?.color }} />
              <span className="truncate">{x.h.name}</span>
            </span>
            <span className="num shrink-0 text-xs text-muted">{x.done}/{x.scheduled} · <span className="font-semibold text-fg">{fmtPct(x.pct)}</span></span>
          </div>
          <ProgressBar value={x.pct} height={4} color={good ? 'rgb(var(--success))' : 'rgb(var(--warning))'} />
        </li>
      ))}
    </ul>
  );
  return (
    <Card title="Habit consistency ranking" subtitle="Completion rate on scheduled days">
      {ranked.length === 0 ? (
        <Empty title="No habit data in this range" />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-success"><TrendingUp className="h-3.5 w-3.5" />Most consistent</div>
            <List items={top} good />
          </div>
          <div>
            <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-warning"><TrendingDown className="h-3.5 w-3.5" />Least consistent</div>
            <List items={bottom} good={false} />
          </div>
        </div>
      )}
    </Card>
  );
}

/** Habit × time heatmap. Daily cells for short ranges, weekly completion cells for long ones. */
function HabitHeatmap({ from }: { from: DateKey }) {
  const { habits, engine, today, settings } = useData();
  const c = useThemeColors();
  const days = rangeKeys(from, today);
  const weekly = days.length > 45;
  const cols: { key: string; days: DateKey[] }[] = weekly
    ? engine.weeks(from, today).map((w) => ({ key: w.from, days: rangeKeys(maxKey(w.from, from), w.to < today ? w.to : today) }))
    : days.map((d) => ({ key: d, days: [d] }));
  const list = habits.filter((h) => !h.archived || days.some((d) => habitCountsOn(h, d)));
  const cell = weekly ? 14 : days.length > 14 ? 14 : 22;

  return (
    <Card className="lg:col-span-2" title="Habit consistency heatmap" subtitle={weekly ? 'Each cell is one week — share of scheduled days completed' : 'Each cell is one day'}>
      {list.length === 0 ? (
        <Empty title="No habits to show" />
      ) : (
        <div className="overflow-x-auto">
          <table className="border-separate" style={{ borderSpacing: 3 }}>
            <tbody>
              {list.map((h) => (
                <tr key={h.id}>
                  <td className="sticky left-0 z-10 max-w-[160px] truncate bg-surface pr-3 text-xs text-muted">{h.name}</td>
                  {cols.map((col) => {
                    let s = 0, d = 0;
                    for (const day of col.days) {
                      if (!habitCountsOn(h, day)) continue;
                      const ok = engine.habitValue(h.id, day) >= h.target;
                      if (day === today && !ok) continue;
                      s++;
                      if (ok) d++;
                    }
                    const pct = s ? (d / s) * 100 : null;
                    const title = `${h.name} · ${weekly ? 'week of ' : ''}${fmtDate(col.key, { month: 'short', day: 'numeric', year: 'numeric' })}: ${s ? `${d}/${s}` : 'not scheduled'}`;
                    return (
                      <td key={col.key} title={title} className="rounded-[3px] p-0" style={{ width: cell, height: cell, minWidth: cell, background: heatColor(pct, c.accent, c.line) }} />
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td />
                {cols.map((col, i) => (
                  <td key={col.key} className={cn('pt-1 text-center text-[9px] text-subtle')}>
                    {(weekly ? i % 4 === 0 : i % Math.ceil(cols.length / 10) === 0) ? fmtDate(col.key, { month: 'numeric', day: 'numeric' }) : ''}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[11px] text-subtle">Darker = more consistent. Grey = not scheduled. Week starts on {settings.weekStart === 1 ? 'Monday' : 'Sunday'}.</p>
    </Card>
  );
}

function MonthlyTimeline() {
  const { engine, today } = useData();
  const months: string[] = [];
  for (let mk = monthKeyOf(engine.earliest); mk <= monthKeyOf(today); mk = addMonths(mk, 1)) months.push(mk);
  const rows = months.map((mk) => ({ mk, p: engine.period(`${mk}-01`, endOfMonth(`${mk}-01`)) })).reverse();
  return (
    <Card className="lg:col-span-2" title="Monthly progress timeline" subtitle="Every month you've tracked, newest first">
      <ol className="relative ml-2 border-l border-line">
        {rows.map(({ mk, p }, i) => {
          const before = rows[i + 1]?.p.score ?? null;
          return (
            <li key={mk} className="relative pb-5 pl-6 last:pb-0">
              <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface" style={{ background: p.score !== null && p.score >= engine.threshold ? 'rgb(var(--success))' : 'rgb(var(--accent))' }} />
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <div className="text-sm font-medium">{fmtMonth(mk)}{mk === monthKeyOf(today) && <span className="ml-2 text-xs font-normal text-subtle">in progress</span>}</div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-subtle">{p.done}/{p.planned} done · {p.successfulDays} successful days</span>
                  <Trend delta={p.score !== null && before !== null ? p.score - before : null} />
                  <span className="num w-12 text-right text-sm font-semibold">{fmtPct(p.score)}</span>
                </div>
              </div>
              <ProgressBar className="mt-2" value={p.score} height={4} />
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
