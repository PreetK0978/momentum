import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Printer, Trophy, AlertTriangle, CalendarRange, Layers, Check as CheckIcon } from 'lucide-react';
import { useData } from '@/hooks/data';
import { navigate } from '@/hooks/ui';
import { Card, PageHeader, ProgressRing, Trend } from '@/components/ui';
import { DailyTrendChart, SimpleBars } from '@/components/charts';
import { saveReflection } from '@/db/repo';
import { addMonths, endOfMonth, fmtDate, fmtMonth, monthDays, monthKeyOf } from '@/lib/date';
import { fmtPct } from '@/lib/scoring';
import { habitCountsOn } from '@/lib/schedule';

export function Reports({ initialMonth }: { initialMonth: string | null }) {
  const { engine, today, habits, reflections } = useData();
  const current = monthKeyOf(today);
  const [mk, setMk] = useState(initialMonth && /^\d{4}-\d{2}$/.test(initialMonth) ? initialMonth : Number(today.slice(8)) <= 7 ? addMonths(current, -1) : current);
  const first = monthKeyOf(engine.earliest);
  const days = monthDays(mk);
  const from = days[0], to = days[days.length - 1];
  const inProgress = mk === current;

  const r = useMemo(() => {
    const p = engine.period(from, to);
    const prevMk = addMonths(mk, -1);
    const prev = engine.period(`${prevMk}-01`, endOfMonth(`${prevMk}-01`));
    const weeks = engine.weeks(from, to).map((w) => ({ ...w, label: `${fmtDate(w.from < from ? from : w.from)} – ${fmtDate(w.to > to ? to : w.to)}` }));
    const bestWeek = weeks.filter((w) => w.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
    const cats = engine.categoryScores(from, to).filter((c) => c.planned > 0).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
    const hs = habits.map((h) => ({ h, ...engine.habitStats(h, from, to) })).filter((x) => x.scheduled > 0);
    const bestHabit = [...hs].sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0) || b.done - a.done)[0];
    const missedHabit = [...hs].sort((a, b) => b.scheduled - b.done - (a.scheduled - a.done))[0];
    const perfect = days.filter((d) => { const s = engine.day(d); return s.planned > 0 && s.done === s.planned && !s.future; }).length;
    return { p, prev, weeks, bestWeek, cats, hs, bestHabit, missedHabit, perfect };
  }, [engine, mk, from, to, habits, days]);

  const delta = r.p.score !== null && r.prev.score !== null ? r.p.score - r.prev.score : null;

  // print in light mode for a clean PDF
  useEffect(() => {
    let prev: string | undefined;
    const before = () => { prev = document.documentElement.dataset.mode; document.documentElement.dataset.mode = 'light'; };
    const after = () => { if (prev) document.documentElement.dataset.mode = prev; };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); };
  }, []);

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="Monthly Reports"
          subtitle="A complete review of each month, with your own reflection."
          actions={
            <>
              <div className="flex items-center gap-1">
                <button className="icon-btn border border-line" disabled={mk <= first} onClick={() => setMk(addMonths(mk, -1))} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
                <span className="w-36 text-center text-sm font-medium">{fmtMonth(mk)}</span>
                <button className="icon-btn border border-line" disabled={mk >= current} onClick={() => setMk(addMonths(mk, 1))} aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
              </div>
              <button className="btn-primary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Export PDF</button>
            </>
          }
        />
      </div>

      <div className="print-area grid gap-4">
        <div className="card relative overflow-hidden p-6 md:p-8">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="label">Momentum · Monthly report{inProgress && ' · in progress'}</div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">{fmtMonth(mk)}</h2>
              <p className="mt-2 max-w-md text-sm text-muted">
                {r.p.scoredDays === 0
                  ? 'No planned activity was recorded this month.'
                  : `You completed ${r.p.done} of ${r.p.planned} planned activities across ${r.p.scoredDays} active days, with ${r.p.successfulDays} successful day${r.p.successfulDays === 1 ? '' : 's'} and ${r.perfect} perfect day${r.perfect === 1 ? '' : 's'}.`}
              </p>
              <div className="mt-3 flex items-center gap-2 text-sm"><Trend delta={delta} /> <span className="text-subtle">vs. {fmtMonth(addMonths(mk, -1))} ({fmtPct(r.prev.score)})</span></div>
            </div>
            <ProgressRing value={r.p.score} size={150} stroke={12}>
              <div>
                <div className="num text-3xl font-semibold">{fmtPct(r.p.score)}</div>
                <div className="text-[11px] text-subtle">monthly score</div>
              </div>
            </ProgressRing>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label="Planned activities" value={r.p.planned} />
          <Tile label="Completed activities" value={r.p.done} />
          <Tile label="Completion" value={fmtPct(r.p.planned ? (r.p.done / r.p.planned) * 100 : null, 1)} />
          <Tile label="Improvement" value={delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} pts`} />
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Insight icon={<CalendarRange className="h-4 w-4" />} label="Best-performing week" value={r.bestWeek?.label ?? '—'} sub={r.bestWeek ? fmtPct(r.bestWeek.score) : undefined} />
          <Insight icon={<Layers className="h-4 w-4" />} label="Most consistent category" value={r.cats[0]?.category.name ?? '—'} sub={r.cats[0] ? fmtPct(r.cats[0].pct) : undefined} color={r.cats[0]?.category.color} />
          <Insight icon={<Layers className="h-4 w-4" />} label="Least consistent category" value={r.cats.length > 1 ? r.cats[r.cats.length - 1].category.name : '—'} sub={r.cats.length > 1 ? fmtPct(r.cats[r.cats.length - 1].pct) : undefined} color={r.cats[r.cats.length - 1]?.category.color} />
          <Insight icon={<Trophy className="h-4 w-4" />} label="Best-performing habit" value={r.bestHabit?.h.name ?? '—'} sub={r.bestHabit ? `${fmtPct(r.bestHabit.pct)} · ${r.bestHabit.done}/${r.bestHabit.scheduled}` : undefined} tone="good" />
          <Insight icon={<AlertTriangle className="h-4 w-4" />} label="Most frequently missed" value={r.missedHabit && r.missedHabit.scheduled > r.missedHabit.done ? r.missedHabit.h.name : '—'} sub={r.missedHabit && r.missedHabit.scheduled > r.missedHabit.done ? `missed ${r.missedHabit.scheduled - r.missedHabit.done}×` : undefined} tone="bad" />
          <Insight icon={<CheckIcon className="h-4 w-4" />} label="Perfect days" value={String(r.perfect)} sub="every planned item done" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Daily scores" subtitle="Every day of the month">
            <DailyTrendChart days={r.p.days} height={220} showAvg={false} />
          </Card>
          <Card title="Weekly breakdown" subtitle="Average daily score per week">
            <SimpleBars data={r.weeks.map((w) => ({ label: w.label, Score: w.score === null ? 0 : Math.round(w.score) }))} labelKey="label" valueKey="Score" height={220} fmtLabel={(l) => l.split(' – ')[0]} />
          </Card>
        </div>

        <Card title="Habits this month">
          {r.hs.length === 0 ? (
            <p className="text-sm text-subtle">No habits were scheduled this month.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-subtle">
                    <th className="py-2 font-medium">Habit</th>
                    <th className="py-2 text-right font-medium">Scheduled</th>
                    <th className="py-2 text-right font-medium">Done</th>
                    <th className="py-2 text-right font-medium">Best run</th>
                    <th className="py-2 text-right font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {[...r.hs].sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0)).map((x) => (
                    <tr key={x.h.id} className="border-t border-line">
                      <td className="py-2">{x.h.name}</td>
                      <td className="num py-2 text-right text-muted">{x.scheduled}</td>
                      <td className="num py-2 text-right text-muted">{x.done}</td>
                      <td className="num py-2 text-right text-muted">{x.best}d</td>
                      <td className="num py-2 text-right font-semibold">{fmtPct(x.pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <ReflectionCard key={mk} mk={mk} initial={reflections.find((x) => x.id === mk)} />
        <p className="no-print text-center text-xs text-subtle">
          Looking for a specific day? <button className="underline hover:text-fg" onClick={() => navigate('calendar', `${mk}-01`)}>Open this month in the calendar</button>. Habits active this month: {habits.filter((h) => days.some((d) => habitCountsOn(h, d))).length}.
        </p>
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card px-4 py-3.5">
      <div className="label">{label}</div>
      <div className="num mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Insight({ icon, label, value, sub, color, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; color?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="card flex items-start gap-3 px-4 py-3.5">
      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tone === 'good' ? 'bg-success/15 text-success' : tone === 'bad' ? 'bg-warning/15 text-warning' : 'bg-accent/12 text-accent'}`} style={color ? { background: color + '22', color } : undefined}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-subtle">{label}</div>
        <div className="truncate text-sm font-semibold">{value}</div>
        {sub && <div className="num text-xs text-muted">{sub}</div>}
      </div>
    </div>
  );
}

const PROMPTS = [
  { key: 'wentWell', label: 'What went well?' },
  { key: 'wentWrong', label: 'What went wrong?' },
  { key: 'improve', label: 'What should improve?' },
  { key: 'nextObjectives', label: 'Main objectives for next month' },
] as const;

function ReflectionCard({ mk, initial }: { mk: string; initial?: { wentWell: string; wentWrong: string; improve: string; nextObjectives: string } }) {
  const [v, setV] = useState({ wentWell: initial?.wentWell ?? '', wentWrong: initial?.wentWrong ?? '', improve: initial?.improve ?? '', nextObjectives: initial?.nextObjectives ?? '' });
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle');
  const timer = useRef<number>();
  const dirty = useRef(false);

  useEffect(() => {
    if (!dirty.current) return;
    setSaved('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      await saveReflection({ id: mk, ...v });
      setSaved('saved');
    }, 600);
    return () => window.clearTimeout(timer.current);
  }, [v, mk]);

  return (
    <Card title="Personal reflection" subtitle="Saved automatically" action={<span className="text-xs text-subtle">{saved === 'saving' ? 'Saving…' : saved === 'saved' ? 'Saved' : ''}</span>}>
      <div className="grid gap-4 md:grid-cols-2">
        {PROMPTS.map((p) => (
          <label key={p.key} className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">{p.label}</span>
            <textarea
              className="input min-h-[96px] resize-y leading-relaxed"
              value={v[p.key]}
              maxLength={4000}
              onChange={(e) => { dirty.current = true; setV((x) => ({ ...x, [p.key]: e.target.value })); }}
            />
          </label>
        ))}
      </div>
    </Card>
  );
}
