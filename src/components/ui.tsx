import type { ReactNode } from 'react';
import { ArrowUpRight, Info } from 'lucide-react';
export function Card({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <div className="card-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Hint({ text }: { text: string }) {
  return (
    <span className="hint" tabIndex={0} role="note" aria-label={text} title={text}>
      <Info size={13} />
      <span className="hint-content">{text}</span>
    </span>
  );
}
export function KPI({
  label,
  value,
  detail,
  color = 'mint',
  icon,
  children,
  hint,
}: {
  label: string;
  value: string;
  detail: string;
  color?: string;
  hint?: string;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="card kpi">
      <div className="kpi-top">
        <span>
          {label}
          {hint && <Hint text={hint} />}
        </span>
        <span className={`kpi-icon ${color}`}>{icon ?? <ArrowUpRight size={18} />}</span>
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-bottom">{detail}</div>
      {children}
    </div>
  );
}
export function Notice({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'warn';
}) {
  return (
    <div className={`notice ${tone}`}>
      <Info size={16} />
      <div>{children}</div>
    </div>
  );
}
export function Tag({ children, color = 'mint' }: { children: ReactNode; color?: string }) {
  return <span className={`tag ${color}`}>{children}</span>;
}
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  suffix = '',
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-wrap">
        <input
          aria-label={label}
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            if (e.target.value !== '' && Number.isFinite(e.target.valueAsNumber))
              onChange(Math.min(max, Math.max(min, e.target.valueAsNumber)));
          }}
        />
        <span>{suffix}</span>
      </div>
    </label>
  );
}
export function SectionIntro({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-intro">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
