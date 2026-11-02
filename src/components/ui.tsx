import { useEffect, useId, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDownRight, ArrowUpRight, Minus, X, Info, Circle, HeartPulse, Dumbbell, GraduationCap, Code2, Sprout, Target, Wallet, BookOpen,
  Brain, Music, Palette, Users, Home, Briefcase, Moon, Sun, Coffee, Leaf, Star, Zap, type LucideIcon as LucideIconType,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { WEEKDAYS_MIN } from '@/lib/date';
import type { Category } from '@/db/types';

export function Card({ children, className, title, action, subtitle }: { children: ReactNode; className?: string; title?: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cn('card card-pad', className)}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold text-fg">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-subtle">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight md:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const ICONS: Record<string, LucideIconType> = { HeartPulse, Dumbbell, GraduationCap, Code2, Sprout, Target, Wallet, BookOpen, Brain, Music, Palette, Users, Home, Briefcase, Moon, Sun, Coffee, Leaf, Star, Zap };

export function LucideIcon({ name, className }: { name: string; className?: string }) {
  const I = ICONS[name] ?? Circle;
  return <I className={className} />;
}

export function CategoryBadge({ category, className }: { category?: Category; className?: string }) {
  if (!category) return null;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-muted', className)}>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: category.color }} />
      <span className="truncate">{category.name}</span>
    </span>
  );
}

// ---------- progress ----------

export function ProgressRing({ value, size = 120, stroke = 10, color = 'rgb(var(--accent))', track = 'rgb(var(--line))', children }: { value: number | null; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (v / 100) * c }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function ProgressBar({ value, color, className, height = 6 }: { value: number | null; color?: string; className?: string; height?: number }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-line/70', className)} style={{ height }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color ?? 'rgb(var(--accent))' }}
        initial={{ width: 0 }}
        animate={{ width: `${v}%` }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

export function Trend({ delta, suffix = ' pts' }: { delta: number | null; suffix?: string }) {
  if (delta === null || Number.isNaN(delta)) return <span className="text-xs text-subtle">No prior data</span>;
  const up = delta > 0.5, down = delta < -0.5;
  const I = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium', up ? 'text-success' : down ? 'text-danger' : 'text-subtle')}>
      <I className="h-3.5 w-3.5" />
      {up ? '+' : ''}
      {delta.toFixed(1)}
      {suffix}
    </span>
  );
}

export function Stat({ label, value, sub, icon, hint }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; hint?: string }) {
  return (
    <div className="card flex min-w-0 flex-col gap-1.5 px-4 py-3.5" title={hint}>
      <div className="flex items-center justify-between gap-2">
        <span className="label truncate">{label}</span>
        {icon && <span className="text-subtle">{icon}</span>}
      </div>
      <div className="num text-2xl font-semibold">{value}</div>
      {sub && <div className="min-h-[16px] text-xs text-subtle">{sub}</div>}
    </div>
  );
}

// ---------- form controls ----------

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-subtle">{hint}</span>}
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange, className }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cn('seg', className)} role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === value} data-active={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('relative h-5 w-9 shrink-0 rounded-full transition', checked ? 'bg-accent' : 'bg-line')}
    >
      <motion.span layout className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow', checked ? 'left-[18px]' : 'left-0.5')} transition={{ type: 'spring', stiffness: 500, damping: 32 }} />
    </button>
  );
}

export function WeekdayPicker({ value, onChange, weekStart = 1 }: { value: number[]; onChange: (v: number[]) => void; weekStart?: number }) {
  const order = Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7);
  return (
    <div className="flex gap-1.5">
      {order.map((d) => {
        const on = value.includes(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d].sort())}
            className={cn('h-8 w-8 rounded-lg border text-xs font-medium transition', on ? 'border-accent/50 bg-accent/15 text-fg' : 'border-line text-subtle hover:text-fg')}
          >
            {WEEKDAYS_MIN[d]}
          </button>
        );
      })}
    </div>
  );
}

export function CategorySelect({ value, onChange, categories }: { value: string; onChange: (v: string) => void; categories: Category[] }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

// ---------- overlays ----------

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="no-print fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={id}
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className={cn('relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-pop sm:rounded-2xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg')}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 id={id} className="text-sm font-semibold">{title}</h2>
              <button className="icon-btn" onClick={onClose} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4">{children}</div>
            {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function useConfirm() {
  const [state, setState] = useState<{ title: string; body: string; action: string; resolve: (v: boolean) => void } | null>(null);
  const confirm = (title: string, body: string, action = 'Delete') => new Promise<boolean>((resolve) => setState({ title, body, action, resolve }));
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  const dialog = (
    <Modal
      open={!!state}
      onClose={() => close(false)}
      title={state?.title ?? ''}
      footer={
        <>
          <button className="btn-ghost" onClick={() => close(false)}>Cancel</button>
          <button className="btn bg-danger text-white hover:brightness-110" onClick={() => close(true)}>{state?.action}</button>
        </>
      }
    >
      <p className="text-sm text-muted">{state?.body}</p>
    </Modal>
  );
  return { confirm, dialog };
}

export function Empty({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && <div className="mb-1 grid h-11 w-11 place-items-center rounded-xl border border-line bg-elevated text-subtle">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {body && <p className="max-w-sm text-xs text-subtle">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function InfoTip({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" className="text-subtle hover:text-fg" onClick={() => setOpen((o) => !o)} aria-label="How this is calculated">
        <Info className="h-3.5 w-3.5" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute left-1/2 top-6 z-40 w-64 -translate-x-1/2 rounded-lg border border-line bg-elevated p-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-muted shadow-pop"
          >
            {children}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/** Shared tooltip body for Recharts. */
export function ChartTip({ active, payload, label, fmt, labelFmt }: { active?: boolean; payload?: { name: string; value: number | null; color?: string; payload?: Record<string, unknown> }[]; label?: string | number; fmt?: (v: number | null, name: string) => string; labelFmt?: (l: string | number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-elevated/95 px-3 py-2 text-xs shadow-pop backdrop-blur">
      {label !== undefined && <div className="mb-1 font-medium text-fg">{labelFmt ? labelFmt(label) : label}</div>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span>{p.name}</span>
          <span className="num ml-auto pl-3 font-medium text-fg">{fmt ? fmt(p.value, p.name) : p.value === null ? '—' : `${Math.round(p.value)}%`}</span>
        </div>
      ))}
    </div>
  );
}
