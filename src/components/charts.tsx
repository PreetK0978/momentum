import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useData } from '@/hooks/data';
import { navigate, useThemeColors, withAlpha } from '@/hooks/ui';
import { addDays, fmtDate, rangeKeys, startOfWeek, weekday, WEEKDAYS_MIN, type DateKey } from '@/lib/date';
import type { DayStat } from '@/lib/scoring';
import { ChartTip } from './ui';

const axisProps = (c: ReturnType<typeof useThemeColors>) => ({
  tick: { fill: c.subtle, fontSize: 11 },
  axisLine: false,
  tickLine: false,
});

/** 5-step single-hue scale for completion %. Level 0 = nothing planned. */
export function heatColor(score: number | null, accent: string, line: string) {
  if (score === null) return withAlpha(line, 0.45);
  if (score === 0) return withAlpha(accent, 0.1);
  if (score < 40) return withAlpha(accent, 0.28);
  if (score < 70) return withAlpha(accent, 0.5);
  if (score < 90) return withAlpha(accent, 0.75);
  return accent;
}

export function HeatLegend() {
  const c = useThemeColors();
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-subtle">
      <span>Less</span>
      {[null, 0, 30, 60, 80, 100].map((v, i) => (
        <span key={i} className="h-2.5 w-2.5 rounded-[3px]" style={{ background: heatColor(v, c.accent, c.line) }} />
      ))}
      <span>More</span>
    </div>
  );
}

/** Contribution-style heatmap: columns are weeks, rows are weekdays. */
export function ContributionHeatmap({ from, to, cell = 12, onSelect }: { from: DateKey; to: DateKey; cell?: number; onSelect?: (d: DateKey) => void }) {
  const { engine, settings } = useData();
  const c = useThemeColors();
  const [hover, setHover] = useState<{ d: DayStat; x: number; y: number } | null>(null);
  const ws = settings.weekStart;
  const weeks = useMemo(() => {
    const out: DateKey[][] = [];
    for (let s = startOfWeek(from, ws); s <= to; s = addDays(s, 7)) out.push(rangeKeys(s, addDays(s, 6)));
    return out;
  }, [from, to, ws]);
  const gap = 3;
  const months: { i: number; label: string }[] = [];
  weeks.forEach((w, i) => {
    const first = w.find((d) => d.endsWith('-01') || (i === 0 && d >= from));
    if (first && (i === 0 || first.endsWith('-01'))) months.push({ i, label: fmtDate(first, { month: 'short' }) });
  });

  return (
    <div className="relative">
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex flex-col gap-1.5">
          <div className="relative ml-7 h-4" style={{ width: weeks.length * (cell + gap) }}>
            {months.map((m) => (
              <span key={m.i} className="absolute text-[10px] text-subtle" style={{ left: m.i * (cell + gap) }}>
                {m.label}
              </span>
            ))}
          </div>
          <div className="flex gap-[3px]">
            <div className="mr-1 flex w-6 flex-col gap-[3px]">
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i} className="text-[10px] leading-none text-subtle" style={{ height: cell, lineHeight: `${cell}px` }}>
                  {i % 2 === 1 ? WEEKDAYS_MIN[(i + ws) % 7] : ''}
                </span>
              ))}
            </div>
            {weeks.map((w, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {w.map((d) => {
                  const out = d < from || d > to;
                  const st = engine.day(d);
                  return (
                    <button
                      key={d}
                      disabled={out || st.future}
                      onClick={() => (onSelect ? onSelect(d) : navigate('calendar', d))}
                      onMouseEnter={(e) => {
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        const p = (e.currentTarget.closest('.relative') as HTMLElement).getBoundingClientRect();
                        setHover({ d: st, x: r.left - p.left + cell / 2, y: r.top - p.top });
                      }}
                      onMouseLeave={() => setHover(null)}
                      aria-label={`${fmtDate(d, { weekday: 'short', month: 'short', day: 'numeric' })}: ${st.score === null ? 'nothing scored' : Math.round(st.score) + '%'}`}
                      className="rounded-[3px] transition hover:ring-2 hover:ring-fg/40 disabled:cursor-default disabled:hover:ring-0"
                      style={{ width: cell, height: cell, background: out || st.future ? 'transparent' : heatColor(st.score, c.accent, c.line) }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      {hover && (
        <div className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-elevated px-2.5 py-1.5 text-xs shadow-pop" style={{ left: hover.x, top: hover.y - 6 }}>
          <div className="font-medium">{fmtDate(hover.d.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
          <div className="text-muted">
            {hover.d.planned ? `${hover.d.done}/${hover.d.planned} done · ${Math.round(hover.d.score ?? 0)}%` : 'Nothing planned'}
          </div>
        </div>
      )}
    </div>
  );
}

/** Daily completion line with the success threshold drawn as a reference. */
export function DailyTrendChart({ days, height = 220, showAvg = true }: { days: DayStat[]; height?: number; showAvg?: boolean }) {
  const c = useThemeColors();
  const { settings } = useData();
  const data = useMemo(() => {
    let acc = 0, n = 0;
    const win: number[] = [];
    return days.map((d) => {
      if (d.score !== null) { win.push(d.score); acc += d.score; n++; }
      if (win.length > 7) win.shift();
      return { date: d.date, Score: d.score === null ? null : Math.round(d.score), '7-day avg': win.length ? Math.round(win.reduce((a, b) => a + b, 0) / win.length) : null, _avg: n ? acc / n : null };
    });
  }, [days]);
  const many = days.length > 45;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="g-score" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.accent} stopOpacity={0.28} />
            <stop offset="100%" stopColor={c.accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={c.line} strokeDasharray="0" strokeOpacity={0.6} />
        <XAxis dataKey="date" {...axisProps(c)} tickFormatter={(d) => fmtDate(d)} minTickGap={28} />
        <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} {...axisProps(c)} tickFormatter={(v) => `${v}%`} />
        <ReferenceLine y={settings.successThreshold} stroke={c.success} strokeDasharray="4 4" strokeOpacity={0.6} />
        <Tooltip cursor={{ stroke: c.subtle, strokeDasharray: '3 3' }} content={<ChartTip labelFmt={(l) => fmtDate(String(l), { weekday: 'short', month: 'short', day: 'numeric' })} />} />
        <Area type="monotone" dataKey="Score" stroke={many ? withAlpha(c.accent, 0.55) : c.accent} strokeWidth={many ? 1.25 : 2} fill="url(#g-score)" connectNulls dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: c.surface }} />
        {showAvg && <Line type="monotone" dataKey="7-day avg" stroke={c.accent2} strokeWidth={2} dot={false} connectNulls activeDot={{ r: 4, strokeWidth: 2, stroke: c.surface }} />}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SimpleBars({ data, height = 200, color, labelKey, valueKey, valueName = 'Score', fmtLabel, highlightLast, onBarClick }: { data: Record<string, unknown>[]; height?: number; color?: string; labelKey: string; valueKey: string; valueName?: string; fmtLabel?: (v: string) => string; highlightLast?: boolean; onBarClick?: (row: Record<string, unknown>) => void }) {
  const c = useThemeColors();
  const col = color ?? c.accent;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke={c.line} strokeOpacity={0.6} />
        <XAxis dataKey={labelKey} {...axisProps(c)} tickFormatter={fmtLabel} interval="preserveStartEnd" minTickGap={8} />
        <YAxis domain={[0, 100]} ticks={[0, 50, 100]} {...axisProps(c)} tickFormatter={(v) => `${v}%`} />
        <Tooltip cursor={{ fill: withAlpha(c.fg, 0.04) }} content={<ChartTip labelFmt={(l) => (fmtLabel ? fmtLabel(String(l)) : String(l))} />} />
        <Bar dataKey={valueKey} name={valueName} radius={[4, 4, 0, 0]} maxBarSize={36} onClick={(row) => onBarClick?.(row as unknown as Record<string, unknown>)} style={{ cursor: onBarClick ? 'pointer' : undefined }}>
          {data.map((_, i) => (
            <Cell key={i} fill={highlightLast && i !== data.length - 1 ? withAlpha(col, 0.45) : col} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Sparkline({ values, color, height = 36 }: { values: (number | null)[]; color?: string; height?: number }) {
  const c = useThemeColors();
  const data = values.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
        <YAxis domain={[0, 100]} hide />
        <Line type="monotone" dataKey="v" stroke={color ?? c.accent} strokeWidth={1.75} dot={false} connectNulls isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function WeekdayBars({ from, to, height = 200 }: { from: DateKey; to: DateKey; height?: number }) {
  const { engine, settings } = useData();
  const data = useMemo(() => {
    const acc = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 }));
    for (const d of engine.period(from, to).days) if (d.score !== null) { acc[weekday(d.date)].sum += d.score; acc[weekday(d.date)].n++; }
    return Array.from({ length: 7 }, (_, i) => {
      const wd = (i + settings.weekStart) % 7;
      return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][wd], Score: acc[wd].n ? Math.round(acc[wd].sum / acc[wd].n) : 0, days: acc[wd].n };
    });
  }, [engine, from, to, settings.weekStart]);
  return <SimpleBars data={data} labelKey="day" valueKey="Score" valueName="Avg. score" height={height} />;
}
