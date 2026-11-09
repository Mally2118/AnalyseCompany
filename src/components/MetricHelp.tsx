import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { metricHelp } from '../data/metric-help';
import { MathFormula } from './MathFormula';
export function MetricHelp({ metric }: { metric: string }) {
  const m = metricHelp[metric];
  const [open, setOpen] = useState(false),
    [position, setPosition] = useState({ left: 12, top: 12 });
  const button = useRef<HTMLButtonElement>(null),
    popup = useRef<HTMLDivElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    id = useId();
  const cancel = () => {
    clearTimeout(timer.current);
  };
  const hide = () => {
    timer.current = setTimeout(() => setOpen(false), 180);
  };
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (!button.current || !popup.current) return;
      const b = button.current.getBoundingClientRect(),
        r = popup.current.getBoundingClientRect();
      setPosition({
        left: Math.max(12, Math.min(b.left, innerWidth - r.width - 12)),
        top: Math.max(
          12,
          Math.min(
            b.bottom + 10 + r.height > innerHeight ? b.top - r.height - 10 : b.bottom + 10,
            innerHeight - r.height - 12,
          ),
        ),
      });
    };
    place();
    const observer = new ResizeObserver(place);
    if (popup.current) observer.observe(popup.current);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!button.current?.contains(e.target as Node) && !popup.current?.contains(e.target as Node))
        setOpen(false);
    };
    const hash = () => setOpen(false);
    document.addEventListener('pointerdown', close);
    window.addEventListener('hashchange', hash);
    return () => {
      cancel();
      document.removeEventListener('pointerdown', close);
      window.removeEventListener('hashchange', hash);
    };
  }, []);
  if (!m) return null;
  return (
    <>
      <button
        ref={button}
        className="metric-help"
        type="button"
        aria-label={`О показателе «${m.name}»`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-haspopup="dialog"
        onPointerEnter={(e) => {
          if (e.pointerType !== 'touch') {
            cancel();
            setOpen(true);
          }
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== 'touch') hide();
        }}
        onFocus={() => {
          cancel();
          setOpen(true);
        }}
        onBlur={hide}
        onClick={(e) => {
          e.preventDefault();
          cancel();
          if (matchMedia('(hover: none)').matches) setOpen(true);
          else window.location.hash = `guide/${metric}`;
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            e.stopPropagation();
          }
        }}
      >
        ?
      </button>
      {open &&
        createPortal(
          <div
            id={id}
            ref={popup}
            role="dialog"
            aria-label={m.name}
            className="metric-popover"
            style={position}
            onPointerEnter={cancel}
            onPointerLeave={(e) => {
              if (e.pointerType !== 'touch') hide();
            }}
            onFocus={cancel}
            onBlur={hide}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                button.current?.focus();
                setOpen(false);
              }
            }}
          >
            <div className="popover-heading">
              <strong>{m.name}</strong>
              <button type="button" aria-label="Закрыть подсказку" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
            <p>{m.meaning}</p>
            <MathFormula latex={m.latex} />
            <p className="popover-variables">{m.variables}</p>
            <a href={`#guide/${metric}`}>Полная формула и пример →</a>
          </div>,
          document.body,
        )}
    </>
  );
}
