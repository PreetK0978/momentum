import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, ListChecks, Grid3x3, CalendarDays, LineChart, Target, FileText, Settings as SettingsIcon,
  PanelLeftClose, PanelLeftOpen, Menu, X, Moon, Sun, Plus,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { navigate, useIsMobile, type Route } from '@/hooks/ui';
import { useData } from '@/hooks/data';
import { updateSettings } from '@/db/repo';
import { fmtPct } from '@/lib/scoring';
import { SyncBadge } from '@/sync/SyncCard';

export const NAV: { id: Route; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'planner', label: 'Daily Planner', icon: ListChecks },
  { id: 'tracker', label: 'Monthly Tracker', icon: Grid3x3 },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'analytics', label: 'Analytics', icon: LineChart },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'reports', label: 'Monthly Reports', icon: FileText },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent2 shadow-sm">
        <svg viewBox="0 0 32 32" className="h-5 w-5" fill="none" stroke="rgb(var(--accentfg))" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 23 L12 11 L17 19 L21 13 L26 23" />
        </svg>
      </div>
      {!collapsed && <span className="text-[15px] font-semibold tracking-[0.14em]">MOMENTUM</span>}
    </div>
  );
}

function ModeToggle({ compact }: { compact?: boolean }) {
  const { settings } = useData();
  const dark = document.documentElement.dataset.mode !== 'light';
  return (
    <button
      className={cn('icon-btn', !compact && 'w-auto gap-2 px-2.5')}
      onClick={() => updateSettings({ mode: dark ? 'light' : 'dark' })}
      aria-label="Toggle light and dark mode"
      title={`Switch to ${dark ? 'light' : 'dark'} mode (current: ${settings.mode})`}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {!compact && <span className="text-xs">{dark ? 'Light' : 'Dark'} mode</span>}
    </button>
  );
}

function TodayMini({ collapsed }: { collapsed: boolean }) {
  const { engine, today } = useData();
  const d = engine.day(today);
  if (collapsed) return null;
  return (
    <div className="rounded-xl border border-line bg-elevated/50 p-3">
      <div className="flex items-center justify-between">
        <span className="label">Today</span>
        <span className="num text-xs font-medium">{fmtPct(d.pct)}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-accent to-accent2" animate={{ width: `${d.pct ?? 0}%` }} />
      </div>
      <p className="mt-2 text-[11px] text-subtle">
        {d.done} of {d.planned} planned done
      </p>
    </div>
  );
}

export function Shell({ route, children, onQuickAdd }: { route: Route; children: ReactNode; onQuickAdd: () => void }) {
  const { settings } = useData();
  const mobile = useIsMobile();
  const collapsed = settings.sidebarCollapsed;
  const [drawer, setDrawer] = useState(false);

  useEffect(() => setDrawer(false), [route]);

  if (mobile) {
    const primary = NAV.filter((n) => ['overview', 'planner', 'tracker', 'analytics'].includes(n.id));
    return (
      <div className="flex min-h-full flex-col">
        <header className="no-print glass sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center justify-between border-x-0 border-t-0 px-4 pt-[env(safe-area-inset-top)]">
          <button className="icon-btn" onClick={() => setDrawer(true)} aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </button>
          <Logo />
          <div className="flex items-center gap-1"><SyncBadge compact /><ModeToggle compact /></div>
        </header>
        <main className="flex-1 px-4 pb-28 pt-5">{children}</main>
        <nav className="no-print glass fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)]">
          {primary.slice(0, 2).map((n) => (
            <MobileTab key={n.id} item={n} active={route === n.id} />
          ))}
          <div className="grid place-items-center">
            <button onClick={onQuickAdd} className="grid h-11 w-11 place-items-center rounded-full bg-accent text-accentfg shadow-pop" aria-label="Quick add">
              <Plus className="h-5 w-5" />
            </button>
          </div>
          {primary.slice(2).map((n) => (
            <MobileTab key={n.id} item={n} active={route === n.id} />
          ))}
        </nav>
        <AnimatePresence>
          {drawer && (
            <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
              <motion.aside
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ type: 'spring', stiffness: 380, damping: 36 }}
                className="absolute inset-y-0 left-0 flex w-72 flex-col gap-4 border-r border-line bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
              >
                <div className="flex items-center justify-between">
                  <Logo />
                  <button className="icon-btn" onClick={() => setDrawer(false)} aria-label="Close navigation">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <NavList route={route} collapsed={false} />
                <div className="mt-auto">
                  <TodayMini collapsed={false} />
                </div>
              </motion.aside>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="flex min-h-full">
      <motion.aside
        animate={{ width: collapsed ? 72 : 248 }}
        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
        className="no-print sticky top-0 flex h-screen shrink-0 flex-col gap-5 border-r border-line bg-surface/60 px-3 py-4 backdrop-blur-xl"
      >
        <div className={cn('flex items-center px-1.5', collapsed ? 'justify-center' : 'justify-between')}>
          <Logo collapsed={collapsed} />
        </div>
        <button onClick={onQuickAdd} className={cn('btn-primary', collapsed ? 'h-10 w-10 self-center p-0' : 'w-full')} title="Quick add (N)">
          <Plus className="h-4 w-4" />
          {!collapsed && <span>Quick add</span>}
          {!collapsed && <kbd className="ml-auto rounded border border-white/20 px-1.5 text-[10px] opacity-70">N</kbd>}
        </button>
        <NavList route={route} collapsed={collapsed} />
        <div className="mt-auto flex flex-col gap-3">
          <TodayMini collapsed={collapsed} />
          <div className={cn('flex', collapsed ? 'justify-center' : 'px-1')}><SyncBadge compact={collapsed} /></div>
          <div className={cn('flex items-center', collapsed ? 'flex-col gap-1' : 'justify-between')}>
            <ModeToggle compact={collapsed} />
            <button className="icon-btn" onClick={() => updateSettings({ sidebarCollapsed: !collapsed })} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </motion.aside>
      <main className="min-w-0 flex-1 px-6 py-7 lg:px-10">
        <div className="mx-auto max-w-[1400px]">{children}</div>
      </main>
    </div>
  );
}

function NavList({ route, collapsed }: { route: Route; collapsed: boolean }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((n) => {
        const active = route === n.id;
        const I = n.icon;
        return (
          <button
            key={n.id}
            onClick={() => navigate(n.id)}
            title={collapsed ? n.label : undefined}
            className={cn(
              'group relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm transition',
              collapsed && 'justify-center px-0',
              active ? 'text-fg' : 'text-muted hover:bg-elevated/60 hover:text-fg',
            )}
          >
            {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-lg border border-line bg-elevated" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
            <I className={cn('relative h-[18px] w-[18px] shrink-0', active && 'text-accent')} />
            {!collapsed && <span className="relative truncate">{n.label}</span>}
          </button>
        );
      })}
    </nav>
  );
}

function MobileTab({ item, active }: { item: (typeof NAV)[number]; active: boolean }) {
  const I = item.icon;
  return (
    <button onClick={() => navigate(item.id)} className={cn('flex h-16 flex-col items-center justify-center gap-1 text-[10px]', active ? 'text-accent' : 'text-subtle')}>
      <I className="h-5 w-5" />
      {item.label.replace('Daily ', '').replace('Monthly ', '')}
    </button>
  );
}
