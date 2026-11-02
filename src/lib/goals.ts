import type { Goal } from '@/db/types';
import type { ScoreEngine } from './scoring';
import { minKey, rangeKeys } from './date';

/** Linked goals count completed days of their habit inside the goal window. */
export function goalProgress(g: Goal, engine: ScoreEngine): number {
  if (!g.linkedHabitId) return g.current;
  const h = engine.data.habits.find((x) => x.id === g.linkedHabitId);
  if (!h) return g.current;
  const end = minKey(g.deadline, engine.today);
  if (end < g.startDate) return 0;
  return rangeKeys(g.startDate, end).filter((d) => engine.habitValue(h.id, d) >= h.target).length;
}

export function goalPct(g: Goal, engine: ScoreEngine) {
  return Math.min(100, (goalProgress(g, engine) / g.target) * 100);
}
