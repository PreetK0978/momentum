// Repository layer: every write in the app goes through here, so a future sync
// adapter only needs to hook these functions (each record has id + updatedAt).
import { db, DATA_TABLES } from './db';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, FALLBACK_CATEGORY } from './defaults';
import type { Category, Goal, Habit, Reflection, Settings, Task } from './types';
import { monthKeyOf, todayKey, type DateKey } from '@/lib/date';
import { uid } from '@/lib/id';

const now = () => Date.now();

// ---------- bootstrap ----------

export async function ensureDefaults() {
  await db.transaction('rw', db.settings, db.categories, async () => {
    const s = await db.settings.get('app');
    if (!s) await db.settings.put({ ...DEFAULT_SETTINGS, updatedAt: now() });
    else {
      // fill in any settings keys added in later versions
      const merged = { ...DEFAULT_SETTINGS, ...s, notifications: { ...DEFAULT_SETTINGS.notifications, ...s.notifications } };
      const ids = new Set(merged.widgets.map((w) => w.id));
      for (const w of DEFAULT_SETTINGS.widgets) if (!ids.has(w.id)) merged.widgets.push(w);
      await db.settings.put(merged);
    }
    if ((await db.categories.count()) === 0) {
      // updatedAt 0: built-in defaults never override edits synced from another device
      await db.categories.bulkPut(DEFAULT_CATEGORIES.map((c) => ({ ...c, updatedAt: 0 })));
    }
  });
}

/** Settings that belong to this device only; they are never synced and don't count as an edit. */
export const DEVICE_SETTINGS = ['sidebarCollapsed', 'notifications', 'lastAutoBackup'] as const;

export async function updateSettings(patch: Partial<Settings>) {
  const deviceOnly = Object.keys(patch).every((k) => (DEVICE_SETTINGS as readonly string[]).includes(k));
  await db.settings.update('app', deviceOnly ? patch : { ...patch, updatedAt: now() });
}

// ---------- categories ----------

export async function saveCategory(c: Partial<Category> & { name: string; color: string; icon: string }) {
  const name = c.name.trim();
  if (!name) throw new Error('Category name is required');
  const all = await db.categories.toArray();
  if (all.some((x) => x.name.toLowerCase() === name.toLowerCase() && x.id !== c.id)) throw new Error('A category with this name already exists');
  const existing = c.id ? all.find((x) => x.id === c.id) : undefined;
  const rec: Category = {
    id: c.id ?? uid(),
    name,
    color: c.color,
    icon: c.icon,
    order: existing?.order ?? all.length,
    builtin: existing?.builtin ?? false,
    updatedAt: now(),
  };
  await db.categories.put(rec);
  return rec;
}

export async function deleteCategory(id: string) {
  const fallback = id === FALLBACK_CATEGORY ? (await db.categories.toArray()).find((c) => c.id !== id)?.id : FALLBACK_CATEGORY;
  if (!fallback) throw new Error('At least one category is required');
  await db.transaction('rw', db.categories, db.habits, db.tasks, db.goals, async () => {
    await db.habits.where('categoryId').equals(id).modify({ categoryId: fallback, updatedAt: now() });
    await db.tasks.where('categoryId').equals(id).modify({ categoryId: fallback, updatedAt: now() });
    await db.goals.where('categoryId').equals(id).modify({ categoryId: fallback, updatedAt: now() });
    await db.categories.delete(id);
  });
}

// ---------- habits ----------

export function validateHabit(h: Partial<Habit>): string | null {
  if (!h.name?.trim()) return 'Habit name is required';
  if (h.name.trim().length > 80) return 'Habit name must be 80 characters or fewer';
  if (!h.categoryId) return 'Choose a category';
  if (h.frequency === 'weekdays' && !h.weekdays?.length) return 'Select at least one weekday';
  if (h.frequency === 'interval' && (!h.intervalDays || h.intervalDays < 1 || h.intervalDays > 365)) return 'Interval must be between 1 and 365 days';
  if (!h.target || h.target < 1 || h.target > 10000) return 'Target must be between 1 and 10,000';
  if (!h.startDate) return 'Start date is required';
  if (h.endDate && h.endDate < h.startDate) return 'End date must be after the start date';
  return null;
}

export async function saveHabit(h: Partial<Habit>): Promise<Habit> {
  const err = validateHabit(h);
  if (err) throw new Error(err);
  const existing = h.id ? await db.habits.get(h.id) : undefined;
  const count = await db.habits.count();
  const rec: Habit = {
    id: h.id ?? uid(),
    name: h.name!.trim(),
    description: h.description?.trim() ?? '',
    categoryId: h.categoryId!,
    frequency: h.frequency ?? 'daily',
    weekdays: h.weekdays ?? [0, 1, 2, 3, 4, 5, 6],
    intervalDays: h.intervalDays ?? 1,
    target: Math.round(h.target ?? 1),
    unit: h.unit?.trim() ?? '',
    weight: Math.min(5, Math.max(1, Math.round(h.weight ?? 1))),
    startDate: h.startDate!,
    endDate: h.endDate || null,
    archived: h.archived ?? false,
    archivedOn: h.archived ? (existing?.archived ? existing.archivedOn : todayKey()) : null,
    order: existing?.order ?? h.order ?? count,
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now(),
  };
  await db.habits.put(rec);
  return rec;
}

export async function setHabitArchived(id: string, archived: boolean) {
  await db.habits.update(id, { archived, archivedOn: archived ? todayKey() : null, updatedAt: now() });
}

export async function deleteHabit(id: string) {
  await db.transaction('rw', db.habits, db.habitLogs, db.goals, async () => {
    await db.habitLogs.where('habitId').equals(id).delete();
    await db.goals.filter((g) => g.linkedHabitId === id).modify({ linkedHabitId: null, updatedAt: now() });
    await db.habits.delete(id);
  });
}

export async function reorderHabits(ids: string[]) {
  await db.transaction('rw', db.habits, async () => {
    await Promise.all(ids.map((id, i) => db.habits.update(id, { order: i, updatedAt: now() })));
  });
}

export async function setHabitValue(habitId: string, date: DateKey, value: number) {
  const id = `${habitId}|${date}`;
  if (value <= 0) await db.habitLogs.delete(id);
  else await db.habitLogs.put({ id, habitId, date, month: monthKeyOf(date), value, updatedAt: now() });
}

export async function toggleHabit(habit: Habit, date: DateKey) {
  const cur = await db.habitLogs.get(`${habit.id}|${date}`);
  await setHabitValue(habit.id, date, (cur?.value ?? 0) >= habit.target ? 0 : habit.target);
}

// ---------- tasks ----------

export function validateTask(t: Partial<Task>): string | null {
  if (!t.title?.trim()) return 'Title is required';
  if (t.title.trim().length > 120) return 'Title must be 120 characters or fewer';
  if (!t.categoryId) return 'Choose a category';
  if (t.kind === 'recurring') {
    if (!t.dueDate) return 'Recurring tasks need a start date';
    if (!t.recurrence) return 'Choose how this task repeats';
    if (t.recurrence.type === 'weekdays' && !t.recurrence.weekdays.length) return 'Select at least one weekday';
    if (t.recurrence.type === 'monthly' && (t.recurrence.dayOfMonth < 1 || t.recurrence.dayOfMonth > 31)) return 'Day of month must be 1-31';
    if (t.recurrence.until && t.recurrence.until < t.dueDate) return 'Repeat-until date must be after the start date';
  }
  if ((t.kind === 'weekly-goal' || t.kind === 'monthly-objective') && !t.dueDate) return 'Pick the period this belongs to';
  if (t.estMinutes !== undefined && (t.estMinutes < 0 || t.estMinutes > 1440)) return 'Estimated duration must be 0-1440 minutes';
  return null;
}

export async function saveTask(t: Partial<Task>): Promise<Task> {
  const err = validateTask(t);
  if (err) throw new Error(err);
  const existing = t.id ? await db.tasks.get(t.id) : undefined;
  const min = (await db.tasks.orderBy('order').first())?.order ?? 0;
  const rec: Task = {
    id: t.id ?? uid(),
    title: t.title!.trim(),
    description: t.description?.trim() ?? '',
    notes: t.notes?.trim() ?? '',
    categoryId: t.categoryId!,
    priority: t.priority ?? 'medium',
    kind: t.kind ?? 'one-time',
    dueDate: t.dueDate || null,
    recurrence: t.kind === 'recurring' ? t.recurrence ?? null : null,
    estMinutes: Math.max(0, Math.round(t.estMinutes ?? 0)),
    weight: Math.min(5, Math.max(1, Math.round(t.weight ?? 1))),
    color: t.color ?? null,
    order: existing?.order ?? min - 1,
    completedAt: existing?.completedAt ?? null,
    completedOn: existing?.completedOn ?? null,
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now(),
  };
  await db.tasks.put(rec);
  return rec;
}

export async function deleteTask(id: string) {
  await db.transaction('rw', db.tasks, db.taskCompletions, async () => {
    await db.taskCompletions.where('taskId').equals(id).delete();
    await db.tasks.delete(id);
  });
}

/** Toggle completion. Recurring tasks complete per-occurrence; others complete once. */
export async function toggleTask(t: Task, date: DateKey) {
  if (t.kind === 'recurring') {
    const id = `${t.id}|${date}`;
    if (await db.taskCompletions.get(id)) await db.taskCompletions.delete(id);
    else await db.taskCompletions.put({ id, taskId: t.id, date, month: monthKeyOf(date), updatedAt: now() });
    return;
  }
  const done = !!t.completedOn;
  await db.tasks.update(t.id, done ? { completedAt: null, completedOn: null, updatedAt: now() } : { completedAt: now(), completedOn: todayKey(), updatedAt: now() });
}

export async function reorderTasks(ids: string[]) {
  await db.transaction('rw', db.tasks, async () => {
    await Promise.all(ids.map((id, i) => db.tasks.update(id, { order: i, updatedAt: now() })));
  });
}

// ---------- goals ----------

export function validateGoal(g: Partial<Goal>): string | null {
  if (!g.name?.trim()) return 'Goal name is required';
  if (!g.categoryId) return 'Choose a category';
  if (!g.deadline) return 'Deadline is required';
  if (!g.target || g.target <= 0) return 'Target must be greater than zero';
  if (g.current !== undefined && g.current < 0) return 'Progress cannot be negative';
  if (g.startDate && g.deadline < g.startDate) return 'Deadline must be after the start date';
  return null;
}

export async function saveGoal(g: Partial<Goal>): Promise<Goal> {
  const err = validateGoal(g);
  if (err) throw new Error(err);
  const existing = g.id ? await db.goals.get(g.id) : undefined;
  const rec: Goal = {
    id: g.id ?? uid(),
    name: g.name!.trim(),
    description: g.description?.trim() ?? '',
    categoryId: g.categoryId!,
    period: g.period ?? 'monthly',
    deadline: g.deadline!,
    target: g.target!,
    current: g.current ?? 0,
    unit: g.unit?.trim() ?? '',
    linkedHabitId: g.linkedHabitId || null,
    startDate: g.startDate ?? todayKey(),
    completed: g.completed ?? (g.current ?? 0) >= g.target!,
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now(),
  };
  await db.goals.put(rec);
  return rec;
}

export async function setGoalProgress(g: Goal, current: number) {
  const v = Math.max(0, current);
  await db.goals.update(g.id, { current: v, completed: v >= g.target, updatedAt: now() });
}

export async function deleteGoal(id: string) {
  await db.goals.delete(id);
}

// ---------- reflections ----------

export async function saveReflection(r: Omit<Reflection, 'updatedAt'>) {
  await db.reflections.put({ ...r, updatedAt: now() });
}

// ---------- export / import / backup ----------

export interface ExportBundle {
  app: 'momentum';
  version: 1;
  exportedAt: string;
  settings: Settings | undefined;
  data: Record<(typeof DATA_TABLES)[number], unknown[]>;
}

export async function exportAll(): Promise<ExportBundle> {
  const data = {} as ExportBundle['data'];
  for (const t of DATA_TABLES) data[t] = await db.table(t).toArray();
  return { app: 'momentum', version: 1, exportedAt: new Date().toISOString(), settings: await db.settings.get('app'), data };
}

const REQUIRED_KEYS: Record<(typeof DATA_TABLES)[number], string[]> = {
  categories: ['id', 'name', 'color'],
  habits: ['id', 'name', 'categoryId', 'frequency', 'startDate', 'target'],
  habitLogs: ['id', 'habitId', 'date', 'value'],
  tasks: ['id', 'title', 'categoryId', 'kind'],
  taskCompletions: ['id', 'taskId', 'date'],
  goals: ['id', 'name', 'target', 'deadline'],
  reflections: ['id'],
};

export function validateBundle(raw: unknown): ExportBundle {
  const b = raw as ExportBundle;
  if (!b || typeof b !== 'object' || b.app !== 'momentum') throw new Error('This file is not a Momentum export');
  if (b.version !== 1) throw new Error(`Unsupported export version: ${String(b.version)}`);
  if (!b.data || typeof b.data !== 'object') throw new Error('Export is missing its data section');
  for (const t of DATA_TABLES) {
    const rows = b.data[t] ?? [];
    if (!Array.isArray(rows)) throw new Error(`"${t}" must be a list`);
    rows.forEach((r, i) => {
      for (const k of REQUIRED_KEYS[t]) {
        if (r === null || typeof r !== 'object' || !(k in (r as object))) throw new Error(`${t}[${i}] is missing "${k}"`);
      }
    });
  }
  return b;
}

/** mode 'replace' wipes data first; 'merge' upserts by id (ids are unique, so no duplicates). */
export async function importBundle(b: ExportBundle, mode: 'replace' | 'merge') {
  await db.transaction('rw', [...DATA_TABLES.map((t) => db.table(t)), db.settings], async () => {
    if (mode === 'replace') for (const t of DATA_TABLES) await db.table(t).clear();
    for (const t of DATA_TABLES) {
      const rows = (b.data[t] ?? []) as { id: string }[];
      // de-duplicate within the file itself (last one wins)
      const unique = [...new Map(rows.map((r) => [r.id, r])).values()];
      if (unique.length) await db.table(t).bulkPut(unique);
    }
    if (mode === 'replace' && b.settings) await db.settings.put({ ...DEFAULT_SETTINGS, ...b.settings, id: 'app', onboarded: true });
  });
  await ensureDefaults();
}

export async function createBackup(label: string, auto = false) {
  const bundle = await exportAll();
  await db.backups.put({ id: uid(), createdAt: now(), label, auto, data: JSON.stringify(bundle) });
  // keep the 10 most recent automatic snapshots; manual backups are kept until deleted
  const autos = await db.backups.orderBy('createdAt').reverse().filter((b) => b.auto).toArray();
  if (autos.length > 10) await db.backups.bulkDelete(autos.slice(10).map((b) => b.id));
}

export async function restoreBackup(id: string) {
  const b = await db.backups.get(id);
  if (!b) throw new Error('Backup not found');
  await createBackup('Before restore', true);
  await importBundle(validateBundle(JSON.parse(b.data)), 'replace');
}

export async function autoBackupIfDue() {
  const s = await db.settings.get('app');
  const today = todayKey();
  if (!s || s.lastAutoBackup === today) return;
  const hasData = (await db.habits.count()) + (await db.tasks.count()) > 0;
  if (hasData) await createBackup('Daily snapshot', true);
  await updateSettings({ lastAutoBackup: today });
}

export async function clearAllData() {
  await db.transaction('rw', DATA_TABLES.map((t) => db.table(t)), async () => {
    for (const t of DATA_TABLES) await db.table(t).clear();
  });
  await updateSettings({ hasSampleData: false });
  await ensureDefaults();
}
