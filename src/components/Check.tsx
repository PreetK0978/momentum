import { motion } from 'framer-motion';
import { Check as CheckIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Animated completion checkbox. `partial` (0-1) renders a fill for numeric targets. */
export function Check({ checked, onChange, size = 20, partial = 0, label, color, disabled }: { checked: boolean; onChange: () => void; size?: number; partial?: number; label: string; color?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden rounded-md border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40',
        checked ? 'border-transparent' : 'border-[1.5px] border-subtle/60 bg-bg/40 hover:border-accent',
      )}
      style={{ width: size, height: size, background: checked ? color ?? 'rgb(var(--success))' : undefined }}
    >
      {!checked && partial > 0 && <span className="absolute inset-x-0 bottom-0 bg-success/30" style={{ height: `${Math.min(1, partial) * 100}%` }} />}
      {checked && (
        <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 24 }}>
          <CheckIcon className="text-white" style={{ width: size * 0.62, height: size * 0.62 }} strokeWidth={3} />
        </motion.span>
      )}
    </button>
  );
}
