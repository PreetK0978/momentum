import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, CircleDashed } from 'lucide-react';
import { useData } from '@/hooks/data';
import { useThemeColors, withAlpha } from '@/hooks/ui';
import { Card, CategoryBadge, Empty, PageHeader, ProgressRing } from '@/components/ui';
import { Check } from '@/components/Check';
import { ContributionHeatmap, HeatLegend } from '@/components/charts';
import { toggleHabit, toggleTask } from '@/db/repo';
import { addMonths, addDays, endOfYear, fmtLong, fmtMonth, isValidKey, monthDays, monthKeyOf, startOfWeek, startOfYear, weekday, WEEKDAYS_SHORT, type DateKey } from '@/lib/date';
import { fmtPct, scoreTone } from '@/lib/scoring';
import { cn } from '@/lib/cn';

export function CalendarPage({ initialDate }: { initialDate: string | null }) {
  const { engine, today, settings } = useData();
  const start = initialDate && isValidKey(initialDate) ? initialDate : today;
  const [selected, setSelected] = useState<DateKey>(start);
  const [mk, setMk] = useState(monthKeyOf(start));
  const [year, setYear] = useState(Number(start.slice(0, 4)));
  const c = useThemeColors();

  useEffect(() => {
    if (initialDate && isValidKey(initialDate)) {
      setSelected(initialDate);
      setMk(monthKeyOf(initialDate));
      setYear(Number(initialDate.slice(0, 4)));
    }
  }, [initialDate]);

  const days = monthDays(mk);
  const lead = (weekday(days[0]) - settings.weekStart + 7) % 7;
  const headers = Array.from({ length: 7 }, (_, i) => WEEKDAYS_SHORT[(i + settings.weekStart) % 7]);
  const month = engine.period(days[0], days[days.length - 1]);
  const firstYear = Number(engine.earliest.slice(0, 4));

  const select = (d: DateKey) => {
    setSelected(d);
    if (monthKeyOf(d) !== mk) setMk(monthKeyOf(d));
  };

  return (
    <div>
      <PageHeader title="Calendar" subtitle="Every day you've tracked, kept forever. Click a day to inspect it." />
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card
          title={fmtMonth(mk)}
          subtitle={`Month score ${fmtPct(month.score)} · ${month.successfulDays} successful day${month.successfulDays === 1 ? '' : 's'}`}
          action={
            <div className="flex items-center gap-1">
              <button className="icon-btn border border-line" onClick={() => setMk(addMonths(mk, -1))} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
              <button className="btn-ghost px-2 py-1 text-xs" onClick={() => { setMk(monthKeyOf(today)); setSelected(today); }}>Today</button>
              <button className="icon-btn border border-line" onClick={() => setMk(addMonths(mk, 1))} aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
            </div>
          }
        >
          <div className="grid grid-cols-7 gap-1.5">
            {headers.map((h) => <div key={h} className="pb-1 text-center text-[11px] text-subtle">{h}</div>)}
            {Array.from({ length: lead }, (_, i) => <div key={'x' + i} />)}
            {days.map((d) => {
              const st = engine.day(d);
              const isSel = d === selected;
              const tone = scoreTone(st.score, settings.successThreshold);
              return (
                <button
                  key={d}
                  onClick={() => select(d)}
                  className={cn(
                    'group relative flex aspect-square flex-col rounded-xl border p-1.5 text-left transition sm:p-2',
                    isSel ? 'border-accent ring-2 ring-accent/30' : 'border-line hover:border-subtle',
                    st.future && 'opacity-60',
                  )}
                  style={{ background: st.future || st.score === null ? undefined : withAlpha(c.accent, 0.04 + (st.score / 100) * 0.3) }}
                  aria-label={`${fmtLong(d)}: ${st.score === null ? 'no score' : Math.round(st.score) + '%'}`}
                >
                  <span className={cn('num text-xs font-medium', d === today && 'grid h-5 w-5 place-items-center rounded-full bg-accent text-accentfg')}>{Number(d.slice(8))}</span>
                  {settings.calendarShowScores && st.score !== null && (
                    <span className="num mt-auto hidden text-[11px] font-semibold sm:block">{Math.round(st.score)}%</span>
                  )}
                  {st.planned > 0 && !st.future && (
                    <span className={cn('absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full', { good: 'bg-success', mid: 'bg-warning', low: 'bg-danger', none: 'bg-line' }[tone])} />
                  )}
                  {st.planned > 0 && <span className="num mt-auto text-[10px] text-subtle sm:mt-0">{st.done}/{st.planned}</span>}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-subtle">
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-success" />≥ {settings.successThreshold}%</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-warning" />Building</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-danger" />Behind</span>
          </div>
        </Card>
        <DayDetail date={selected} />
      </div>

      <Card
        className="mt-4"
        title={`${year} at a glance`}
        subtitle="Contribution-style heatmap of daily scores"
        action={
          <div className="flex items-center gap-3">
            <HeatLegend />
            <div className="flex items-center gap-1">
              <button className="icon-btn border border-line" disabled={year <= firstYear - 1} onClick={() => setYear(year - 1)} aria-label="Previous year"><ChevronLeft className="h-4 w-4" /></button>
              <span className="num w-10 text-center text-sm">{year}</span>
              <button className="icon-btn border border-line" onClick={() => setYear(year + 1)} aria-label="Next year"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        }
      >
        <ContributionHeatmap from={startOfYear(`${year}-01-01`)} to={endOfYear(`${year}-01-01`)} cell={13} onSelect={select} />
      </Card>
    </div>
  );
}

function DayDetail({ date }: { date: DateKey }) {
  const { engine, habits, tasks, catMap, today, settings } = useData();
  const st = engine.day(date);
  const items = engine.items(date);
  const done = items.filter((i) => i.done);
  const missed = items.filter((i) => !i.done);
  const completedOneOffs = tasks.filter((t) => t.completedOn === date && t.dueDate !== date);
  const wk = engine.period(startOfWeek(date, settings.weekStart), addDays(startOfWeek(date, settings.weekStart), 6));

  const toggle = (kind: 'habit' | 'task', id: string) => {
    if (kind === 'habit') { const h = habits.find((x) => x.id === id); if (h) toggleHabit(h, date); }
    else { const t = tasks.find((x) => x.id === id); if (t) toggleTask(t, date); }
  };
  const future = date > today;

  return (
    <Card title={fmtLong(date)} subtitle={future ? 'Upcoming' : date === today ? 'Today · in progress' : 'History'} className="xl:sticky xl:top-6 xl:self-start">
      <div className="flex items-center gap-5">
        <ProgressRing value={st.score} size={96} stroke={8}>
          <span className="num text-lg font-semibold">{fmtPct(st.score)}</span>
        </ProgressRing>
        <div className="grid flex-1 grid-cols-2 gap-2 text-xs">
          <div><div className="text-subtle">Planned</div><div className="num text-base font-semibold">{st.planned}</div></div>
          <div><div className="text-subtle">Completed</div><div className="num text-base font-semibold">{st.done}</div></div>
          <div><div className="text-subtle">Weighted</div><div className="num text-base font-semibold">{fmtPct(st.wpct)}</div></div>
          <div><div className="text-subtle">Week avg.</div><div className="num text-base font-semibold">{fmtPct(wk.score)}</div></div>
        </div>
      </div>

      {items.length === 0 ? (
        <Empty title="Nothing was planned this day" body="Unscheduled days never count against you." />
      ) : (
        <div className="mt-5 grid gap-4">
          <Section icon={<CheckCircle2 className="h-3.5 w-3.5 text-success" />} title={`Completed (${done.length})`}>
            {done.map((i) => (
              <Item key={i.kind + i.id} name={i.name} kind={i.kind} cat={catMap.get(i.categoryId)} checked onToggle={() => toggle(i.kind, i.id)} disabled={future} />
            ))}
          </Section>
          <Section icon={future ? <CircleDashed className="h-3.5 w-3.5 text-subtle" /> : <XCircle className="h-3.5 w-3.5 text-danger" />} title={`${future ? 'Planned' : date === today ? 'Remaining' : 'Missed'} (${missed.length})`}>
            {missed.map((i) => (
              <Item key={i.kind + i.id} name={i.name} kind={i.kind} cat={catMap.get(i.categoryId)} checked={false} onToggle={() => toggle(i.kind, i.id)} disabled={future && i.kind === 'habit'} />
            ))}
          </Section>
        </div>
      )}
      {completedOneOffs.length > 0 && (
        <div className="mt-4">
          <div className="label mb-2">Also completed this day</div>
          {completedOneOffs.map((t) => <div key={t.id} className="truncate py-1 text-sm text-muted">{t.title}</div>)}
        </div>
      )}
    </Card>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">{icon}{title}</div>
      <div className="grid gap-0.5">{children}</div>
    </div>
  );
}

function Item({ name, kind, cat, checked, onToggle, disabled }: { name: string; kind: string; cat?: import('@/db/types').Category; checked: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-elevated/50">
      <Check size={18} checked={checked} onChange={onToggle} disabled={disabled} label={`Toggle ${name}`} />
      <span className={cn('min-w-0 flex-1 truncate text-sm', checked && 'text-muted')}>{name}</span>
      <CategoryBadge category={cat} className="hidden sm:inline-flex" />
      <span className="text-[10px] uppercase tracking-wider text-subtle">{kind}</span>
    </div>
  );
}
