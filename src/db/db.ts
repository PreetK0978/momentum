import Dexie, { type Table } from 'dexie';
import type { Backup, Category, Goal, Habit, HabitLog, Meta, Reflection, Settings, Task, TaskCompletion } from './types';

export class MomentumDB extends Dexie {
  categories!: Table<Category, string>;
  habits!: Table<Habit, string>;
  habitLogs!: Table<HabitLog, string>;
  tasks!: Table<Task, string>;
  taskCompletions!: Table<TaskCompletion, string>;
  goals!: Table<Goal, string>;
  reflections!: Table<Reflection, string>;
  settings!: Table<Settings, string>;
  backups!: Table<Backup, string>;
  meta!: Table<Meta, string>; // device-local: sync config and sync base; never exported or synced

  constructor() {
    super('momentum');
    this.version(1).stores({
      categories: 'id, order',
      habits: 'id, categoryId, archived, order',
      habitLogs: 'id, habitId, date, month, [habitId+date]',
      tasks: 'id, categoryId, kind, dueDate, completedOn, order',
      taskCompletions: 'id, taskId, date, month',
      goals: 'id, categoryId, period, deadline',
      reflections: 'id',
      settings: 'id',
      backups: 'id, createdAt',
    });
    this.version(2).stores({ meta: 'id' });
  }
}

export const db = new MomentumDB();

export const DATA_TABLES = ['categories', 'habits', 'habitLogs', 'tasks', 'taskCompletions', 'goals', 'reflections'] as const;
export type DataTable = (typeof DATA_TABLES)[number];

// Any local write to synced data marks the store dirty so the sync engine can push it.
type Listener = () => void;
const listeners = new Set<Listener>();
let muted = 0;
export function onLocalChange(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
/** Runs fn without emitting change events (used when applying remote data). */
export async function withoutChangeEvents<T>(fn: () => Promise<T>): Promise<T> {
  muted++;
  try {
    return await fn();
  } finally {
    muted--;
  }
}
const emit = () => {
  if (!muted) listeners.forEach((l) => l());
};
for (const t of [...DATA_TABLES, 'settings'] as const) {
  const table = db.table(t);
  table.hook('creating', () => { emit(); });
  table.hook('updating', () => { emit(); });
  table.hook('deleting', () => { emit(); });
}
