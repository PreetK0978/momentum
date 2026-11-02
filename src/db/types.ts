import type { DateKey, MonthKey } from '@/lib/date';

// Every record carries a stable string id and updatedAt so the store can later
// be synced to a server (last-write-wins per record) without schema changes.

export interface Category {
  id: string;
  name: string;
  color: string; // hex
  icon: string; // lucide icon name
  order: number;
  builtin: boolean;
  updatedAt: number;
}

export type HabitFrequency = 'daily' | 'weekdays' | 'interval';

export interface Habit {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  frequency: HabitFrequency;
  weekdays: number[]; // 0 = Sunday, used when frequency = 'weekdays'
  intervalDays: number; // used when frequency = 'interval'
  target: number; // amount per scheduled day (1 = simple checkbox)
  unit: string;
  weight: number; // 1-5, used by the weighted score
  startDate: DateKey;
  endDate: DateKey | null;
  archived: boolean;
  archivedOn: DateKey | null; // days before this still count toward history
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface HabitLog {
  id: string; // `${habitId}|${date}` — one record per habit per day, no duplicates
  habitId: string;
  date: DateKey;
  month: MonthKey;
  value: number;
  updatedAt: number;
}

export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type TaskKind = 'one-time' | 'recurring' | 'weekly-goal' | 'monthly-objective';
export type RecurrenceType = 'daily' | 'weekdays' | 'weekly' | 'monthly';

export interface Recurrence {
  type: RecurrenceType;
  weekdays: number[]; // for 'weekdays'
  dayOfMonth: number; // for 'monthly'
  until: DateKey | null;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  notes: string;
  categoryId: string;
  priority: Priority;
  kind: TaskKind;
  dueDate: DateKey | null; // one-time: due date; recurring: start date; goals: period end
  recurrence: Recurrence | null;
  estMinutes: number;
  weight: number;
  color: string | null;
  order: number;
  completedAt: number | null; // one-time / goals
  completedOn: DateKey | null;
  createdAt: number;
  updatedAt: number;
}

export interface TaskCompletion {
  id: string; // `${taskId}|${date}`
  taskId: string;
  date: DateKey;
  month: MonthKey;
  updatedAt: number;
}

export type GoalPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface Goal {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  period: GoalPeriod;
  deadline: DateKey;
  target: number;
  current: number;
  unit: string;
  linkedHabitId: string | null; // progress auto-counted from habit completions
  startDate: DateKey;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Reflection {
  id: MonthKey;
  wentWell: string;
  wentWrong: string;
  improve: string;
  nextObjectives: string;
  updatedAt: number;
}

export type ThemePreset = 'obsidian' | 'midnight' | 'violet' | 'minimal' | 'emerald';
export type WidgetId = 'today' | 'month' | 'categories' | 'trends' | 'habits-today' | 'goals' | 'heatmap';

export interface Settings {
  id: 'app';
  userName: string;
  theme: ThemePreset;
  mode: 'dark' | 'light' | 'system';
  weekStart: 0 | 1;
  successThreshold: number; // a day at or above this % counts as successful
  dailyTarget: number; // % goal for each day
  weeklyTarget: number; // % goal for each week
  useWeighted: boolean;
  lateCompletionCounts: boolean;
  widgets: { id: WidgetId; visible: boolean }[];
  notifications: { enabled: boolean; time: string; lastSent: DateKey | null };
  calendarShowScores: boolean;
  sidebarCollapsed: boolean;
  onboarded: boolean;
  hasSampleData: boolean;
  lastAutoBackup: DateKey | null;
  updatedAt: number;
}

export interface Backup {
  id: string;
  createdAt: number;
  label: string;
  auto: boolean;
  data: string; // serialized ExportBundle
}

export interface SyncConfig {
  owner: string;
  repo: string;
  token: string;
  path: string;
}

export interface Meta {
  id: 'syncConfig' | 'syncBase' | 'syncState';
  value: unknown;
}
