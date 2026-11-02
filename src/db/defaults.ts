import type { Category, Settings } from './types';

// Category hues follow a fixed, CVD-validated categorical order.
export const CATEGORY_PALETTE = ['#3987e5', '#e0703f', '#1baf7a', '#d99a0b', '#e07aa0', '#9085e9', '#2f9e44', '#e35d5d'];

export const DEFAULT_CATEGORIES: Omit<Category, 'updatedAt'>[] = [
  { id: 'cat-health', name: 'Health', color: CATEGORY_PALETTE[0], icon: 'HeartPulse', order: 0, builtin: true },
  { id: 'cat-fitness', name: 'Fitness', color: CATEGORY_PALETTE[1], icon: 'Dumbbell', order: 1, builtin: true },
  { id: 'cat-academics', name: 'Academics', color: CATEGORY_PALETTE[2], icon: 'GraduationCap', order: 2, builtin: true },
  { id: 'cat-coding', name: 'Coding & Tech', color: CATEGORY_PALETTE[3], icon: 'Code2', order: 3, builtin: true },
  { id: 'cat-growth', name: 'Personal Development', color: CATEGORY_PALETTE[4], icon: 'Sprout', order: 4, builtin: true },
  { id: 'cat-discipline', name: 'Discipline', color: CATEGORY_PALETTE[5], icon: 'Target', order: 5, builtin: true },
  { id: 'cat-finance', name: 'Finance', color: CATEGORY_PALETTE[6], icon: 'Wallet', order: 6, builtin: true },
];

export const FALLBACK_CATEGORY = 'cat-growth';

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  userName: '',
  theme: 'midnight',
  mode: 'dark',
  weekStart: 1,
  successThreshold: 80,
  dailyTarget: 80,
  weeklyTarget: 75,
  useWeighted: false,
  lateCompletionCounts: false,
  widgets: [
    { id: 'today', visible: true },
    { id: 'month', visible: true },
    { id: 'habits-today', visible: true },
    { id: 'trends', visible: true },
    { id: 'categories', visible: true },
    { id: 'heatmap', visible: true },
    { id: 'goals', visible: true },
  ],
  notifications: { enabled: false, time: '20:00', lastSent: null },
  calendarShowScores: true,
  sidebarCollapsed: false,
  onboarded: false,
  hasSampleData: false,
  lastAutoBackup: null,
  updatedAt: 0,
};

export const CATEGORY_ICONS = ['HeartPulse', 'Dumbbell', 'GraduationCap', 'Code2', 'Sprout', 'Target', 'Wallet', 'BookOpen', 'Brain', 'Music', 'Palette', 'Users', 'Home', 'Briefcase', 'Moon', 'Sun', 'Coffee', 'Leaf', 'Star', 'Zap'];
