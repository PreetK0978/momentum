import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}

export const useIsMobile = () => useMediaQuery('(max-width: 767px)');

// ---------- routing (hash-based so refresh keeps the page) ----------

export type Route = 'overview' | 'planner' | 'tracker' | 'calendar' | 'analytics' | 'goals' | 'reports' | 'settings';
const ROUTES: Route[] = ['overview', 'planner', 'tracker', 'calendar', 'analytics', 'goals', 'reports', 'settings'];

function readRoute(): { route: Route; param: string | null } {
  const [r, p] = window.location.hash.replace(/^#\/?/, '').split('/');
  return { route: ROUTES.includes(r as Route) ? (r as Route) : 'overview', param: p ? decodeURIComponent(p) : null };
}

export function useRoute() {
  const [state, setState] = useState(readRoute);
  useEffect(() => {
    const on = () => setState(readRoute());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return state;
}

export function navigate(route: Route, param?: string) {
  window.location.hash = `/${route}${param ? '/' + encodeURIComponent(param) : ''}`;
}

// ---------- theme colors for charts ----------

const VARS = ['bg', 'surface', 'elevated', 'line', 'fg', 'muted', 'subtle', 'accent', 'accent2', 'success', 'warning', 'danger'] as const;
export type ThemeColors = Record<(typeof VARS)[number], string>;

function readColors(): ThemeColors {
  const cs = getComputedStyle(document.documentElement);
  const out = {} as ThemeColors;
  for (const v of VARS) out[v] = `rgb(${cs.getPropertyValue(`--${v}`).trim().split(/\s+/).join(',')})`;
  return out;
}

export function useThemeColors(): ThemeColors {
  const [c, setC] = useState(readColors);
  useEffect(() => {
    const obs = new MutationObserver(() => setC(readColors()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-mode'] });
    return () => obs.disconnect();
  }, []);
  return c;
}

export function withAlpha(rgb: string, a: number) {
  return rgb.replace('rgb(', 'rgba(').replace(')', `,${a})`);
}

// ---------- toasts ----------

interface Toast { id: number; msg: string; kind: 'ok' | 'err' }
const ToastCtx = createContext<(msg: string, kind?: 'ok' | 'err') => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, msg, kind }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="no-print pointer-events-none fixed bottom-20 right-4 z-[100] flex flex-col items-end gap-2 md:bottom-6">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-line bg-elevated px-3.5 py-2.5 text-sm shadow-pop"
            >
              {t.kind === 'ok' ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertCircle className="h-4 w-4 text-danger" />}
              <span>{t.msg}</span>
              <button className="ml-1 text-subtle hover:text-fg" onClick={() => setItems((x) => x.filter((y) => y.id !== t.id))} aria-label="Dismiss">
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/** Wraps an async action and reports its error as a toast. */
export function useAction() {
  const toast = useToast();
  return useCallback(
    async (fn: () => Promise<unknown>, success?: string) => {
      try {
        await fn();
        if (success) toast(success);
        return true;
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Something went wrong', 'err');
        return false;
      }
    },
    [toast],
  );
}
