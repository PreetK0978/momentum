import type { Habit, Task } from '@/db/types';
import { daysInMonth, diffDays, parseKey, startOfMonth, startOfWeek, weekday, type DateKey } from './date';

export function isHabitScheduled(h: Habit, date: DateKey): boolean {
  if (date < h.startDate) return false;
  if (h.endDate && date > h.endDate) return false;
  switch (h.frequency) {
    case 'daily':
      return true;
    case 'weekdays':
      return h.weekdays.includes(weekday(date));
    case 'interval':
      return diffDays(date, h.startDate) % Math.max(1, h.intervalDays) === 0;
  }
}

/** Habits are counted for a date only while active; archived habits keep their history. */
export function habitCountsOn(h: Habit, date: DateKey): boolean {
  if (!isHabitScheduled(h, date)) return false;
  if (h.archived) return !!h.archivedOn && date < h.archivedOn;
  return true;
}

export function taskOccursOn(t: Task, date: DateKey): boolean {
  if (!t.dueDate) return false;
  if (t.kind !== 'recurring' || !t.recurrence) return t.dueDate === date;
  const r = t.recurrence;
  if (date < t.dueDate) return false;
  if (r.until && date > r.until) return false;
  switch (r.type) {
    case 'daily':
      return true;
    case 'weekdays':
      return r.weekdays.includes(weekday(date));
    case 'weekly':
      return weekday(date) === weekday(t.dueDate);
    case 'monthly': {
      const d = parseKey(date);
      const dim = daysInMonth(d.getFullYear(), d.getMonth());
      return d.getDate() === Math.min(r.dayOfMonth, dim);
    }
  }
}

/** Whether a task should be visible in the "Today" list for this date. */
export function taskVisibleOn(t: Task, date: DateKey, weekStart: number): boolean {
  if (t.kind === 'weekly-goal' && t.dueDate) {
    return date >= startOfWeek(t.dueDate, weekStart) && date <= t.dueDate;
  }
  if (t.kind === 'monthly-objective' && t.dueDate) {
    return date >= startOfMonth(t.dueDate) && date <= t.dueDate;
  }
  return taskOccursOn(t, date);
}

export function describeHabitSchedule(h: Habit): string {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (h.frequency === 'daily') return 'Every day';
  if (h.frequency === 'interval') return h.intervalDays === 1 ? 'Every day' : `Every ${h.intervalDays} days`;
  const set = [...h.weekdays].sort();
  if (set.length === 5 && [1, 2, 3, 4, 5].every((d) => set.includes(d))) return 'Weekdays';
  if (set.length === 2 && set.includes(0) && set.includes(6)) return 'Weekends';
  return set.map((d) => names[d]).join(', ');
}

export function describeRecurrence(t: Task): string {
  if (!t.recurrence) return '';
  const r = t.recurrence;
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  switch (r.type) {
    case 'daily': return 'Daily';
    case 'weekdays': return [...r.weekdays].sort().map((d) => names[d]).join(', ');
    case 'weekly': return t.dueDate ? `Weekly on ${names[weekday(t.dueDate)]}` : 'Weekly';
    case 'monthly': return `Monthly on day ${r.dayOfMonth}`;
  }
}
