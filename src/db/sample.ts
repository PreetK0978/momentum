// Sample data for the onboarding preview. Everything here is ordinary data and
// is removed by "Clear sample data" in Settings (or the banner on Overview).
import { db } from './db';
import type { Goal, Habit, HabitLog, Task, TaskCompletion } from './types';
import { addDays, addMonths, endOfMonth, endOfWeek, monthKeyOf, rangeKeys, todayKey, weekday } from '@/lib/date';
import { habitCountsOn, taskOccursOn } from '@/lib/schedule';
import { updateSettings } from './repo';

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export async function loadSampleData() {
  const today = todayKey();
  const start = addDays(today, -150);
  const t = Date.now();
  const base = { description: '', unit: '', archived: false, archivedOn: null, endDate: null, createdAt: t, updatedAt: t, intervalDays: 1 };
  const all = [0, 1, 2, 3, 4, 5, 6];
  const habits: Habit[] = [
    { ...base, id: 's-h1', name: 'Wake up by 6:30', categoryId: 'cat-discipline', frequency: 'daily', weekdays: all, target: 1, weight: 2, startDate: start, order: 0 },
    { ...base, id: 's-h2', name: 'Gym session', categoryId: 'cat-fitness', frequency: 'weekdays', weekdays: [1, 3, 5, 6], target: 1, weight: 3, startDate: start, order: 1 },
    { ...base, id: 's-h3', name: 'Deep study', categoryId: 'cat-academics', frequency: 'weekdays', weekdays: [1, 2, 3, 4, 5], target: 2, unit: 'hours', weight: 3, startDate: start, order: 2 },
    { ...base, id: 's-h4', name: 'Coding practice', categoryId: 'cat-coding', frequency: 'daily', weekdays: all, target: 1, weight: 2, startDate: start, order: 3 },
    { ...base, id: 's-h5', name: 'Read 20 pages', categoryId: 'cat-growth', frequency: 'daily', weekdays: all, target: 20, unit: 'pages', weight: 1, startDate: start, order: 4 },
    { ...base, id: 's-h6', name: 'Drink 3L water', categoryId: 'cat-health', frequency: 'daily', weekdays: all, target: 1, weight: 1, startDate: start, order: 5 },
    { ...base, id: 's-h7', name: 'Log expenses', categoryId: 'cat-finance', frequency: 'interval', intervalDays: 2, weekdays: all, target: 1, weight: 1, startDate: start, order: 6 },
    { ...base, id: 's-h8', name: 'No phone after 22:00', categoryId: 'cat-discipline', frequency: 'daily', weekdays: all, target: 1, weight: 2, startDate: addDays(today, -60), order: 7 },
  ];
  // per-habit base probability; everything improves gently over time
  const prob: Record<string, number> = { 's-h1': 0.8, 's-h2': 0.74, 's-h3': 0.76, 's-h4': 0.84, 's-h5': 0.66, 's-h6': 0.9, 's-h7': 0.62, 's-h8': 0.6 };
  const r = rng(42);
  const logs: HabitLog[] = [];
  const days = rangeKeys(start, addDays(today, -1));
  days.forEach((d, i) => {
    const trend = (i / days.length) * 0.18;
    const weekendDip = weekday(d) === 0 ? -0.1 : 0;
    for (const h of habits) {
      if (!habitCountsOn(h, d)) continue;
      if (r() < prob[h.id] + trend + weekendDip) logs.push({ id: `${h.id}|${d}`, habitId: h.id, date: d, month: monthKeyOf(d), value: h.target, updatedAt: t });
    }
  });
  // today partially done so the dashboard looks alive
  for (const id of ['s-h1', 's-h4', 's-h6']) {
    const h = habits.find((x) => x.id === id)!;
    if (habitCountsOn(h, today)) logs.push({ id: `${id}|${today}`, habitId: id, date: today, month: monthKeyOf(today), value: h.target, updatedAt: t });
  }

  const tb = { description: '', notes: '', estMinutes: 30, weight: 1, color: null, completedAt: null, completedOn: null, createdAt: t, updatedAt: t, recurrence: null };
  const tasks: Task[] = [
    { ...tb, id: 's-t1', title: 'Finish linear algebra problem set', categoryId: 'cat-academics', priority: 'critical', kind: 'one-time', dueDate: today, estMinutes: 90, weight: 3, order: 0, description: 'Chapter 4, problems 1-18' },
    { ...tb, id: 's-t2', title: 'Review pull request for side project', categoryId: 'cat-coding', priority: 'high', kind: 'one-time', dueDate: today, estMinutes: 45, weight: 2, order: 1 },
    { ...tb, id: 's-t3', title: 'Plan meals for the week', categoryId: 'cat-health', priority: 'medium', kind: 'one-time', dueDate: addDays(today, 1), order: 2 },
    { ...tb, id: 's-t4', title: 'Pay credit card bill', categoryId: 'cat-finance', priority: 'high', kind: 'one-time', dueDate: addDays(today, 3), estMinutes: 10, order: 3 },
    { ...tb, id: 's-t5', title: 'Email professor about project topic', categoryId: 'cat-academics', priority: 'medium', kind: 'one-time', dueDate: addDays(today, -2), estMinutes: 15, order: 4 },
    { ...tb, id: 's-t6', title: 'Evening review & plan tomorrow', categoryId: 'cat-discipline', priority: 'medium', kind: 'recurring', dueDate: start, recurrence: { type: 'daily', weekdays: [], dayOfMonth: 1, until: null }, estMinutes: 10, order: 5 },
    { ...tb, id: 's-t7', title: 'Weekly budget check-in', categoryId: 'cat-finance', priority: 'low', kind: 'recurring', dueDate: start, recurrence: { type: 'weekdays', weekdays: [0], dayOfMonth: 1, until: null }, estMinutes: 20, order: 6 },
    { ...tb, id: 's-t8', title: 'Ship one portfolio feature', categoryId: 'cat-coding', priority: 'high', kind: 'weekly-goal', dueDate: endOfWeek(today, 1), estMinutes: 240, weight: 3, order: 7 },
    { ...tb, id: 's-t9', title: 'Complete online course module 3', categoryId: 'cat-growth', priority: 'medium', kind: 'monthly-objective', dueDate: endOfMonth(today), estMinutes: 600, weight: 2, order: 8 },
    { ...tb, id: 's-t10', title: 'Book dentist appointment', categoryId: 'cat-health', priority: 'low', kind: 'one-time', dueDate: addDays(today, -4), estMinutes: 5, order: 9, completedAt: t, completedOn: addDays(today, -4) },
  ];
  const completions: TaskCompletion[] = [];
  for (const d of days) {
    for (const task of tasks.filter((x) => x.kind === 'recurring')) {
      if (taskOccursOn(task, d) && r() < 0.8) completions.push({ id: `${task.id}|${d}`, taskId: task.id, date: d, month: monthKeyOf(d), updatedAt: t });
    }
  }

  const monthStart = `${today.slice(0, 7)}-01`;
  const goals: Goal[] = [
    { id: 's-g1', name: 'Complete 16 gym sessions', description: 'Four sessions a week, every week.', categoryId: 'cat-fitness', period: 'monthly', deadline: endOfMonth(today), target: 16, current: 0, unit: 'sessions', linkedHabitId: 's-h2', startDate: monthStart, completed: false, createdAt: t, updatedAt: t },
    { id: 's-g2', name: 'Study 60 hours', description: '', categoryId: 'cat-academics', period: 'monthly', deadline: endOfMonth(today), target: 60, current: 14, unit: 'hours', linkedHabitId: null, startDate: monthStart, completed: false, createdAt: t, updatedAt: t },
    { id: 's-g3', name: 'Complete 4 coding projects', description: 'Small, shippable projects.', categoryId: 'cat-coding', period: 'quarterly', deadline: addDays(today, 70), target: 4, current: 1, unit: 'projects', linkedHabitId: null, startDate: addDays(today, -20), completed: false, createdAt: t, updatedAt: t },
    { id: 's-g4', name: 'Read 12 books', description: '', categoryId: 'cat-growth', period: 'yearly', deadline: `${today.slice(0, 4)}-12-31`, target: 12, current: 9, unit: 'books', linkedHabitId: null, startDate: `${today.slice(0, 4)}-01-01`, completed: false, createdAt: t, updatedAt: t },
  ];

  await db.transaction('rw', [db.habits, db.habitLogs, db.tasks, db.taskCompletions, db.goals, db.reflections], async () => {
    await db.habits.bulkPut(habits);
    await db.habitLogs.bulkPut(logs);
    await db.tasks.bulkPut(tasks);
    await db.taskCompletions.bulkPut(completions);
    await db.goals.bulkPut(goals);
    await db.reflections.put({
      id: addMonths(today.slice(0, 7), -1),
      wentWell: 'Morning routine held on most weekdays. Coding practice became automatic.',
      wentWrong: 'Weekends slipped; reading was inconsistent.',
      improve: 'Prepare gym bag the night before. Read before bed instead of scrolling.',
      nextObjectives: 'Hit 80% daily average. Four gym sessions per week.',
      updatedAt: t,
    });
  });
  await updateSettings({ hasSampleData: true });
}

/** Removes only the sample records (ids prefixed "s-"), keeping anything the user created. */
export async function clearSampleData() {
  const isSample = (id: string) => id.startsWith('s-');
  await db.transaction('rw', [db.habits, db.habitLogs, db.tasks, db.taskCompletions, db.goals, db.reflections], async () => {
    await db.habitLogs.filter((l) => isSample(l.habitId)).delete();
    await db.taskCompletions.filter((c) => isSample(c.taskId)).delete();
    await db.habits.filter((h) => isSample(h.id)).delete();
    await db.tasks.filter((x) => isSample(x.id)).delete();
    await db.goals.filter((g) => isSample(g.id)).delete();
    await db.reflections.filter((r) => r.wentWell.startsWith('Morning routine held')).delete();
  });
  await updateSettings({ hasSampleData: false });
}
