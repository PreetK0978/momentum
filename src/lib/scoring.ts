import type { Category, Habit, HabitLog, Settings, Task, TaskCompletion } from '@/db/types';
import { addDays, minKey, rangeKeys, startOfWeek, todayKey, type DateKey } from './date';
import { habitCountsOn, taskOccursOn } from './schedule';

/**
 * Scoring rules (also shown in the in-app "How scores work" panel):
 *  - A day's planned items = active habits scheduled that day + tasks due / recurring that day.
 *  - Daily score    = completed planned items / planned items x 100.
 *  - Weighted score = sum of weights completed / sum of weights planned x 100.
 *  - Period score   = average of daily scores over days that had planned items.
 *  - Category score = completed / planned for that category across the period.
 *  - Successful day = daily score >= success threshold.
 *  - Consistency    = successful days / scored days over the last 30 days.
 *  - Streak         = consecutive successful days; days with nothing planned don't break it.
 */

export interface PlannedItem {
  kind: 'habit' | 'task';
  id: string;
  name: string;
  categoryId: string;
  weight: number;
  done: boolean;
  value: number;
  target: number;
}

export interface DayStat {
  date: DateKey;
  planned: number;
  done: number;
  wPlanned: number;
  wDone: number;
  pct: number | null; // basic completion %
  wpct: number | null; // weighted %
  score: number | null; // whichever the user selected in settings
  future: boolean;
  byCat: Record<string, { planned: number; done: number }>;
}

export interface PeriodStat {
  from: DateKey;
  to: DateKey;
  score: number | null;
  scoredDays: number;
  successfulDays: number;
  planned: number;
  done: number;
  days: DayStat[];
}

export interface EngineData {
  habits: Habit[];
  logs: HabitLog[];
  tasks: Task[];
  completions: TaskCompletion[];
  categories: Category[];
  settings: Settings;
}

export class ScoreEngine {
  readonly today: DateKey;
  readonly earliest: DateKey;
  private logMap = new Map<string, number>();
  private compSet = new Set<string>();
  private cache = new Map<DateKey, DayStat>();

  constructor(readonly data: EngineData) {
    this.today = todayKey();
    for (const l of data.logs) this.logMap.set(l.id, l.value);
    for (const c of data.completions) this.compSet.add(c.id);
    let e = this.today;
    for (const h of data.habits) if (h.startDate < e) e = h.startDate;
    for (const t of data.tasks) if (t.dueDate && t.dueDate < e) e = t.dueDate;
    this.earliest = e;
  }

  get threshold() {
    return this.data.settings.successThreshold;
  }

  habitValue(habitId: string, date: DateKey): number {
    return this.logMap.get(`${habitId}|${date}`) ?? 0;
  }

  isTaskDone(t: Task, date: DateKey): boolean {
    if (t.kind === 'recurring') return this.compSet.has(`${t.id}|${date}`);
    if (!t.completedOn) return false;
    return this.data.settings.lateCompletionCounts || !t.dueDate || t.completedOn <= t.dueDate;
  }

  items(date: DateKey): PlannedItem[] {
    const out: PlannedItem[] = [];
    for (const h of this.data.habits) {
      if (!habitCountsOn(h, date)) continue;
      const v = this.habitValue(h.id, date);
      out.push({ kind: 'habit', id: h.id, name: h.name, categoryId: h.categoryId, weight: h.weight || 1, done: v >= h.target, value: v, target: h.target });
    }
    for (const t of this.data.tasks) {
      if (!taskOccursOn(t, date)) continue;
      const d = this.isTaskDone(t, date);
      out.push({ kind: 'task', id: t.id, name: t.title, categoryId: t.categoryId, weight: t.weight || 1, done: d, value: d ? 1 : 0, target: 1 });
    }
    return out;
  }

  day(date: DateKey): DayStat {
    const hit = this.cache.get(date);
    if (hit) return hit;
    const items = this.items(date);
    let planned = 0, done = 0, wPlanned = 0, wDone = 0;
    const byCat: DayStat['byCat'] = {};
    for (const it of items) {
      planned++;
      wPlanned += it.weight;
      const c = (byCat[it.categoryId] ??= { planned: 0, done: 0 });
      c.planned++;
      if (it.done) {
        done++;
        wDone += it.weight;
        c.done++;
      }
    }
    const future = date > this.today;
    const pct = planned && !future ? (done / planned) * 100 : null;
    const wpct = wPlanned && !future ? (wDone / wPlanned) * 100 : null;
    const stat: DayStat = { date, planned, done, wPlanned, wDone, pct, wpct, score: this.data.settings.useWeighted ? wpct : pct, future, byCat };
    this.cache.set(date, stat);
    return stat;
  }

  period(from: DateKey, to: DateKey): PeriodStat {
    const end = minKey(to, this.today);
    const days = end >= from ? rangeKeys(from, end).map((d) => this.day(d)) : [];
    let sum = 0, scoredDays = 0, successfulDays = 0, planned = 0, done = 0;
    for (const d of days) {
      planned += d.planned;
      done += d.done;
      if (d.score === null) continue;
      // today is still in progress: it joins the average once it's successful (or tomorrow, when final)
      if (d.date === this.today && d.score < this.threshold) continue;
      sum += d.score;
      scoredDays++;
      if (d.score >= this.threshold) successfulDays++;
    }
    return { from, to, score: scoredDays ? sum / scoredDays : null, scoredDays, successfulDays, planned, done, days };
  }

  categoryScores(from: DateKey, to: DateKey) {
    const p = this.period(from, to);
    const acc: Record<string, { planned: number; done: number }> = {};
    for (const d of p.days)
      for (const [k, v] of Object.entries(d.byCat)) {
        const a = (acc[k] ??= { planned: 0, done: 0 });
        a.planned += v.planned;
        a.done += v.done;
      }
    return this.data.categories.map((c) => {
      const a = acc[c.id] ?? { planned: 0, done: 0 };
      return { category: c, planned: a.planned, done: a.done, pct: a.planned ? (a.done / a.planned) * 100 : null };
    });
  }

  /** Current and best run of successful days. Unscheduled days are skipped, never counted as breaks. */
  streak(): { current: number; best: number } {
    const days = rangeKeys(this.earliest, this.today).map((d) => this.day(d));
    let best = 0, run = 0;
    for (const d of days) {
      if (d.score === null) continue;
      if (d.score >= this.threshold) {
        run++;
        best = Math.max(best, run);
      } else if (d.date !== this.today) run = 0;
    }
    let current = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      const d = days[i];
      if (d.score === null) continue;
      if (d.score >= this.threshold) current++;
      else if (d.date === this.today) continue; // today is still in progress
      else break;
    }
    return { current, best };
  }

  consistency(windowDays = 30): { pct: number | null; successful: number; scored: number } {
    const p = this.period(addDays(this.today, -(windowDays - 1)), this.today);
    return { pct: p.scoredDays ? (p.successfulDays / p.scoredDays) * 100 : null, successful: p.successfulDays, scored: p.scoredDays };
  }

  habitStats(h: Habit, from: DateKey, to: DateKey) {
    const end = minKey(to, this.today);
    let scheduled = 0, done = 0, run = 0, best = 0;
    if (end >= from)
      for (const d of rangeKeys(from, end)) {
        if (!habitCountsOn(h, d)) continue;
        const ok = this.habitValue(h.id, d) >= h.target;
        if (d === this.today && !ok) continue; // don't count today as missed yet
        scheduled++;
        if (ok) {
          done++;
          run++;
          best = Math.max(best, run);
        } else run = 0;
      }
    return { scheduled, done, pct: scheduled ? (done / scheduled) * 100 : null, best, current: run };
  }

  weeks(from: DateKey, to: DateKey): PeriodStat[] {
    const ws = this.data.settings.weekStart;
    const out: PeriodStat[] = [];
    for (let s = startOfWeek(from, ws); s <= to; s = addDays(s, 7)) out.push(this.period(s, addDays(s, 6)));
    return out;
  }
}

export function fmtPct(v: number | null | undefined, digits = 0): string {
  return v === null || v === undefined || Number.isNaN(v) ? '—' : `${v.toFixed(digits)}%`;
}

export type Tone = 'good' | 'mid' | 'low' | 'none';

export function scoreTone(v: number | null, threshold: number): Tone {
  if (v === null) return 'none';
  if (v >= threshold) return 'good';
  if (v >= threshold * 0.6) return 'mid';
  return 'low';
}
