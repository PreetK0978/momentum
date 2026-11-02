import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import type { Category, Goal, Habit, Reflection, Settings, Task } from '@/db/types';
import { ScoreEngine } from '@/lib/scoring';
import { todayKey } from '@/lib/date';
import { DEFAULT_SETTINGS } from '@/db/defaults';

interface DataCtx {
  ready: boolean;
  settings: Settings;
  categories: Category[];
  catMap: Map<string, Category>;
  habits: Habit[];
  tasks: Task[];
  goals: Goal[];
  reflections: Reflection[];
  engine: ScoreEngine;
  today: string;
}

const Ctx = createContext<DataCtx | null>(null);

/** Re-renders at midnight so "today" rolls over while the app stays open. */
function useToday() {
  const [today, setToday] = useState(todayKey());
  useEffect(() => {
    const id = setInterval(() => {
      const t = todayKey();
      setToday((prev) => (prev === t ? prev : t));
    }, 30_000);
    return () => clearInterval(id);
  }, []);
  return today;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const today = useToday();
  const settings = useLiveQuery(() => db.settings.get('app'));
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray());
  const habits = useLiveQuery(() => db.habits.orderBy('order').toArray());
  const logs = useLiveQuery(() => db.habitLogs.toArray());
  const tasks = useLiveQuery(() => db.tasks.orderBy('order').toArray());
  const completions = useLiveQuery(() => db.taskCompletions.toArray());
  const goals = useLiveQuery(() => db.goals.toArray());
  const reflections = useLiveQuery(() => db.reflections.toArray());

  const ready = !!(settings && categories && habits && logs && tasks && completions && goals && reflections);
  const s = settings ?? DEFAULT_SETTINGS;

  const engine = useMemo(
    () => new ScoreEngine({ habits: habits ?? [], logs: logs ?? [], tasks: tasks ?? [], completions: completions ?? [], categories: categories ?? [], settings: s }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [habits, logs, tasks, completions, categories, s.useWeighted, s.successThreshold, s.lateCompletionCounts, s.weekStart, today],
  );

  const catMap = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories]);

  const value: DataCtx = {
    ready,
    settings: s,
    categories: categories ?? [],
    catMap,
    habits: habits ?? [],
    tasks: tasks ?? [],
    goals: goals ?? [],
    reflections: reflections ?? [],
    engine,
    today,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useData must be used inside DataProvider');
  return v;
}
