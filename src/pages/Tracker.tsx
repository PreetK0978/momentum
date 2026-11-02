import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Archive, ArchiveRestore, Grid3x3 } from 'lucide-react';
import { useData } from '@/hooks/data';
import { useAction, useIsMobile } from '@/hooks/ui';
import { Card, Empty, PageHeader, ProgressBar, Segmented, Toggle, useConfirm } from '@/components/ui';
import { Check } from '@/components/Check';
import { HabitForm } from '@/components/forms';
import { deleteHabit, setHabitArchived, setHabitValue, toggleHabit } from '@/db/repo';
import type { Habit } from '@/db/types';
import { addDays, addMonths, fmtDate, fmtMonth, monthDays, monthKey, monthKeyOf, MONTHS, parseMonthKey, rangeKeys, startOfWeek, weekday, WEEKDAYS_MIN, type DateKey } from '@/lib/date';
import { describeHabitSchedule, habitCountsOn, isHabitScheduled } from '@/lib/schedule';
import { fmtPct } from '@/lib/scoring';
import { cn } from '@/lib/cn';

export function Tracker() {
  const { habits, today, categories } = useData();
  const mobile = useIsMobile();
  const [mk, setMk] = useState(monthKeyOf(today));
  const [showArchived, setShowArchived] = useState(false);
  const [cat, setCat] = useState('all');
  const [form, setForm] = useState<{ open: boolean; habit: Habit | null }>({ open: false, habit: null });
  const { confirm, dialog } = useConfirm();
  const run = useAction();
  const { year, month0 } = parseMonthKey(mk);

  const visible = habits.filter((h) => (showArchived || !h.archived) && (cat === 'all' || h.categoryId === cat));
  const years = useMemo(() => {
    const y = Number(today.slice(0, 4));
    const first = Math.min(y - 1, ...habits.map((h) => Number(h.startDate.slice(0, 4))));
    return Array.from({ length: Math.max(y, Number(mk.slice(0, 4))) + 6 - first }, (_, i) => first + i);
  }, [habits, today, mk]);

  const actions = {
    edit: (h: Habit) => setForm({ open: true, habit: h }),
    remove: async (h: Habit) => {
      if (await confirm('Delete habit?', `"${h.name}" and all of its history will be permanently deleted. Archive it instead to keep its history.`)) run(() => deleteHabit(h.id), 'Habit deleted');
    },
    archive: (h: Habit) => run(() => setHabitArchived(h.id, !h.archived), h.archived ? 'Habit restored' : 'Habit archived — history kept'),
  };

  return (
    <div>
      <PageHeader
        title="Monthly Tracker"
        subtitle="Check off habits day by day. Every change saves instantly."
        actions={<button className="btn-primary" onClick={() => setForm({ open: true, habit: null })}><Plus className="h-4 w-4" /> New habit</button>}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button className="icon-btn border border-line" onClick={() => setMk(addMonths(mk, -1))} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
          <select className="input w-auto py-1.5 text-sm font-medium" value={month0} onChange={(e) => setMk(monthKey(year, Number(e.target.value)))} aria-label="Month">
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select className="input w-auto py-1.5 text-sm font-medium" value={year} onChange={(e) => setMk(monthKey(Number(e.target.value), month0))} aria-label="Year">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="icon-btn border border-line" onClick={() => setMk(addMonths(mk, 1))} aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
          {mk !== monthKeyOf(today) && <button className="btn-ghost py-1.5 text-xs" onClick={() => setMk(monthKeyOf(today))}>This month</button>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select className="input w-auto py-1.5 text-xs" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filter by category">
            <option value="all">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-xs text-muted">
            <Toggle checked={showArchived} onChange={setShowArchived} label="Show archived" /> Show archived
          </label>
        </div>
      </div>

      {visible.length === 0 ? (
        <Card>
          <Empty icon={<Grid3x3 className="h-5 w-5" />} title="No habits yet" body="Create your first habit — wake up early, gym, study, read — and track it across the month." action={<button className="btn-primary" onClick={() => setForm({ open: true, habit: null })}><Plus className="h-4 w-4" /> New habit</button>} />
        </Card>
      ) : mobile ? (
        <MobileTracker habits={visible} actions={actions} />
      ) : (
        <>
          <Matrix mk={mk} habits={visible} actions={actions} />
          <MonthSummary mk={mk} habits={visible} />
        </>
      )}

      <HabitForm open={form.open} habit={form.habit} onClose={() => setForm({ open: false, habit: null })} />
      {dialog}
    </div>
  );
}

interface Actions { edit: (h: Habit) => void; remove: (h: Habit) => void; archive: (h: Habit) => void }

function Matrix({ mk, habits, actions }: { mk: string; habits: Habit[]; actions: Actions }) {
  const { engine, today, catMap } = useData();
  const days = monthDays(mk);

  const habitPct = (h: Habit) => {
    let s = 0, d = 0;
    for (const day of days) {
      if (day > today || !habitCountsOn(h, day)) continue;
      const ok = engine.habitValue(h.id, day) >= h.target;
      if (day === today && !ok) continue;
      s++;
      if (ok) d++;
    }
    return { s, d, pct: s ? (d / s) * 100 : null };
  };
  const dayPct = (day: DateKey) => {
    let s = 0, d = 0;
    for (const h of habits) {
      if (!habitCountsOn(h, day)) continue;
      s++;
      if (engine.habitValue(h.id, day) >= h.target) d++;
    }
    return day > today || !s ? null : (d / s) * 100;
  };

  const cellW = 34;
  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 min-w-[240px] border-b border-r border-line bg-surface px-4 py-2.5 text-left">
                <span className="label">Habit</span>
              </th>
              {days.map((d) => {
                const isToday = d === today;
                const wd = weekday(d);
                return (
                  <th key={d} className={cn('border-b border-line px-0 py-2 text-center font-normal', isToday && 'bg-accent/10')} style={{ minWidth: cellW }}>
                    <div className={cn('text-[10px]', wd === 0 || wd === 6 ? 'text-subtle/70' : 'text-subtle')}>{WEEKDAYS_MIN[wd]}</div>
                    <div className={cn('num mx-auto mt-0.5 grid h-6 w-6 place-items-center rounded-md text-xs', isToday ? 'bg-accent font-semibold text-accentfg' : 'text-muted')}>{Number(d.slice(8))}</div>
                  </th>
                );
              })}
              <th className="sticky right-0 z-20 min-w-[92px] border-b border-l border-line bg-surface px-3 py-2.5 text-right"><span className="label">Rate</span></th>
            </tr>
          </thead>
          <tbody>
            {habits.map((h) => {
              const cat = catMap.get(h.categoryId);
              const st = habitPct(h);
              return (
                <tr key={h.id} className="group">
                  <td className={cn('sticky left-0 z-10 border-b border-r border-line bg-surface px-4 py-2 group-hover:bg-elevated', h.archived && 'opacity-60')}>
                    <div className="flex items-center gap-2.5">
                      <span className="h-7 w-1 shrink-0 rounded-full" style={{ background: cat?.color }} />
                      <button className="min-w-0 flex-1 text-left" onClick={() => actions.edit(h)} title="Edit habit">
                        <div className="max-w-[150px] truncate text-[13px] font-medium">{h.name}</div>
                        <div className="truncate text-[11px] text-subtle">
                          {describeHabitSchedule(h)}
                          {h.target > 1 && ` · ${h.target} ${h.unit}`}
                          {h.archived && ' · archived'}
                        </div>
                      </button>
                      <div className="flex opacity-0 transition group-hover:opacity-100">
                        <button className="icon-btn h-6 w-6" onClick={() => actions.edit(h)} aria-label={`Edit ${h.name}`}><Pencil className="h-3 w-3" /></button>
                        <button className="icon-btn h-6 w-6" onClick={() => actions.archive(h)} aria-label={h.archived ? 'Restore' : 'Archive'} title={h.archived ? 'Restore' : 'Archive'}>{h.archived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}</button>
                        <button className="icon-btn h-6 w-6 hover:text-danger" onClick={() => actions.remove(h)} aria-label={`Delete ${h.name}`}><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </div>
                  </td>
                  {days.map((d) => {
                    const counts = habitCountsOn(h, d);
                    const v = engine.habitValue(h.id, d);
                    const done = v >= h.target;
                    const future = d > today;
                    const missed = counts && !done && d < today;
                    return (
                      <td key={d} className={cn('border-b border-line p-0 text-center', d === today && 'bg-accent/[0.06]', missed && 'bg-danger/[0.05]')}>
                        <div className="grid h-11 place-items-center">
                          {counts ? (
                            <Check
                              size={20}
                              checked={done}
                              disabled={future}
                              partial={h.target > 1 ? v / h.target : 0}
                              onChange={() => toggleHabit(h, d)}
                              label={`${h.name}, ${fmtDate(d, { month: 'long', day: 'numeric' })}: ${done ? 'done' : 'not done'}`}
                            />
                          ) : isHabitScheduled(h, d) || d < h.startDate || (h.endDate && d > h.endDate) ? (
                            <span className="h-1 w-1 rounded-full bg-line" title="Not active on this day" />
                          ) : (
                            <span className="h-1 w-1 rounded-full bg-line" title="Not scheduled" />
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="sticky right-0 z-10 border-b border-l border-line bg-surface px-3 py-2 text-right group-hover:bg-elevated">
                    <div className="num text-[13px] font-semibold">{fmtPct(st.pct)}</div>
                    <div className="num text-[11px] text-subtle">{st.d}/{st.s}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="sticky left-0 z-10 border-r border-line bg-surface px-4 py-2.5"><span className="label">Daily completion</span></td>
              {days.map((d) => {
                const p = dayPct(d);
                return (
                  <td key={d} className={cn('px-0 py-2 text-center', d === today && 'bg-accent/[0.06]')}>
                    <div className="mx-auto flex h-10 w-3 flex-col justify-end overflow-hidden rounded-sm bg-line/50" title={p === null ? 'No data' : `${Math.round(p)}%`}>
                      <div className="w-full rounded-sm" style={{ height: `${p ?? 0}%`, background: p !== null && p >= engine.threshold ? 'rgb(var(--success))' : 'rgb(var(--accent) / 0.6)' }} />
                    </div>
                    <div className="num mt-1 text-[9px] text-subtle">{p === null ? '' : Math.round(p)}</div>
                  </td>
                );
              })}
              <td className="sticky right-0 z-10 border-l border-line bg-surface" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function MonthSummary({ mk, habits }: { mk: string; habits: Habit[] }) {
  const { engine, today } = useData();
  const days = monthDays(mk).filter((d) => d <= today);
  const stats = habits.map((h) => ({ h, ...engine.habitStats(h, `${mk}-01`, monthDays(mk).at(-1)!) })).filter((x) => x.scheduled > 0);
  const scheduled = stats.reduce((a, x) => a + x.scheduled, 0);
  const done = stats.reduce((a, x) => a + x.done, 0);
  const best = [...stats].sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))[0];
  const worst = [...stats].sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0))[0];
  const perfect = days.filter((d) => {
    const hs = habits.filter((h) => habitCountsOn(h, d));
    return hs.length > 0 && hs.every((h) => engine.habitValue(h.id, d) >= h.target);
  }).length;
  const longest = Math.max(0, ...stats.map((x) => x.best));
  return (
    <Card className="mt-4" title={`${fmtMonth(mk)} summary`} subtitle="Habits only · today counts once it's checked">
      {scheduled === 0 ? (
        <p className="text-sm text-subtle">No scheduled habit days in this month yet.</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-[1.2fr_2fr]">
          <div>
            <div className="num text-4xl font-semibold">{fmtPct((done / scheduled) * 100, 1)}</div>
            <div className="mt-1 text-xs text-subtle">{done} of {scheduled} scheduled check-ins</div>
            <ProgressBar className="mt-4" value={(done / scheduled) * 100} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SumTile label="Perfect days" value={perfect} />
            <SumTile label="Longest run" value={`${longest}d`} />
            <SumTile label="Strongest" value={best?.h.name ?? '—'} sub={fmtPct(best?.pct)} />
            <SumTile label="Needs attention" value={worst?.h.name ?? '—'} sub={fmtPct(worst?.pct)} />
          </div>
        </div>
      )}
    </Card>
  );
}

function SumTile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-bg/40 px-3 py-2.5">
      <div className="text-[11px] text-subtle">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold">{value}</div>
      {sub && <div className="num text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

/** Mobile: a week strip or a single day with large touch targets. */
function MobileTracker({ habits, actions }: { habits: Habit[]; actions: Actions }) {
  const { engine, today, settings, catMap } = useData();
  const [mode, setMode] = useState<'day' | 'week'>('day');
  const [date, setDate] = useState(today);
  const step = mode === 'day' ? 1 : 7;
  const week = rangeKeys(startOfWeek(date, settings.weekStart), addDays(startOfWeek(date, settings.weekStart), 6));

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <Segmented value={mode} onChange={setMode} options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }]} />
        <div className="flex items-center gap-1">
          <button className="icon-btn" onClick={() => setDate(addDays(date, -step))} aria-label="Previous"><ChevronLeft className="h-4 w-4" /></button>
          <button className="text-xs font-medium" onClick={() => setDate(today)}>{mode === 'day' ? fmtDate(date, { weekday: 'short', month: 'short', day: 'numeric' }) : `${fmtDate(week[0])} – ${fmtDate(week[6])}`}</button>
          <button className="icon-btn" onClick={() => setDate(addDays(date, step))} aria-label="Next"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      {mode === 'day' ? (
        <div className="card divide-y divide-line p-0">
          {habits.filter((h) => habitCountsOn(h, date)).map((h) => {
            const v = engine.habitValue(h.id, date);
            const done = v >= h.target;
            return (
              <div key={h.id} className="flex items-center gap-3 px-4 py-3.5">
                <Check size={26} checked={done} disabled={date > today} partial={h.target > 1 ? v / h.target : 0} onChange={() => toggleHabit(h, date)} label={`Toggle ${h.name}`} />
                <button className="min-w-0 flex-1 text-left" onClick={() => actions.edit(h)}>
                  <div className={cn('truncate text-sm font-medium', done && 'text-subtle line-through')}>{h.name}</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-subtle"><span className="h-1.5 w-1.5 rounded-full" style={{ background: catMap.get(h.categoryId)?.color }} />{catMap.get(h.categoryId)?.name}</div>
                </button>
                {h.target > 1 && date <= today && (
                  <div className="flex items-center text-xs">
                    <button className="icon-btn" onClick={() => setHabitValue(h.id, date, Math.max(0, v - 1))} aria-label="Decrease">−</button>
                    <span className="num w-12 text-center">{v}/{h.target}</span>
                    <button className="icon-btn" onClick={() => setHabitValue(h.id, date, v + 1)} aria-label="Increase">+</button>
                  </div>
                )}
              </div>
            );
          })}
          {!habits.some((h) => habitCountsOn(h, date)) && <Empty title="No habits scheduled this day" />}
        </div>
      ) : (
        <div className="card p-3">
          <div className="grid grid-cols-[1fr_repeat(7,28px)] items-center gap-x-1 gap-y-2">
            <span />
            {week.map((d) => (
              <span key={d} className={cn('text-center text-[10px]', d === today ? 'font-semibold text-accent' : 'text-subtle')}>
                {WEEKDAYS_MIN[weekday(d)]}
                <br />
                {Number(d.slice(8))}
              </span>
            ))}
            {habits.map((h) => (
              <Row key={h.id} h={h} week={week} />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  function Row({ h, week }: { h: Habit; week: DateKey[] }) {
    return (
      <>
        <button className="truncate pr-1 text-left text-xs font-medium" onClick={() => actions.edit(h)}>{h.name}</button>
        {week.map((d) => (
          <span key={d} className="grid place-items-center">
            {habitCountsOn(h, d) ? (
              <Check size={24} checked={engine.habitValue(h.id, d) >= h.target} disabled={d > today} onChange={() => toggleHabit(h, d)} label={`${h.name} ${d}`} />
            ) : (
              <span className="h-1 w-1 rounded-full bg-line" />
            )}
          </span>
        ))}
      </>
    );
  }
}
