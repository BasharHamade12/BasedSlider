import { ReactNode, useEffect, useId, useRef, useState } from 'react';

export function Section({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`prop-section ${open ? 'open' : ''}`}>
      <button className="prop-section-head" onClick={() => setOpen((value) => !value)} type="button">
        <span className="prop-section-icon">{icon}</span>
        <span>{title}</span>
        <span className="prop-section-chevron">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="prop-section-body">{children}</div>}
    </section>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min = -100000,
  max = 100000,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  const [text, setText] = useState(String(value));
  // Commit must read the latest typed value, not the value captured in this
  // render's closure: pressing Enter right after typing can otherwise commit
  // the previous text if the re-render with the new state lands late.
  const latestText = useRef(String(value));
  // Tracks the last value handed to onChange so we skip redundant commits,
  // even when events fire before the re-render lands.
  const committedRef = useRef(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelNextBlur = useRef(false);
  useEffect(() => {
    latestText.current = String(value);
    committedRef.current = value;
    // Don't clobber text the user is typing: immediate commits of intermediate
    // values (e.g. typing "1.25" for line height) must not rewrite the field.
    if (document.activeElement !== inputRef.current) setText(String(value));
  }, [value]);

  const commit = () => {
    if (cancelNextBlur.current) {
      cancelNextBlur.current = false;
      latestText.current = String(value);
      setText(String(value));
      return;
    }
    const parsed =
      latestText.current.trim() === '' ? Number.NaN : Number(latestText.current);
    if (!Number.isFinite(parsed)) {
      latestText.current = String(value);
      setText(String(value));
      return;
    }
    const next = Math.min(max, Math.max(min, parsed));
    if (next !== committedRef.current) {
      committedRef.current = next;
      onChange(next);
    }
    latestText.current = String(next);
    setText(String(next));
  };

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-control">
        <input
          type="number"
          className="field-input"
          value={text}
          min={min}
          max={max}
          step={step}
          ref={inputRef}
          onChange={(event) => {
            const next = event.target.value;
            latestText.current = next;
            setText(next);
            // Commit immediately so typing, autofill, paste and arrow stepping
            // all update the canvas without waiting for blur.
            if (cancelNextBlur.current) return;
            if (next.trim() === '') return;
            const parsed = Number(next);
            if (!Number.isFinite(parsed)) return;
            const clamped = Math.min(max, Math.max(min, parsed));
            if (clamped !== committedRef.current) {
              committedRef.current = clamped;
              latestText.current = String(clamped);
              onChange(clamped);
            }
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              cancelNextBlur.current = true;
              setText(String(value));
              event.currentTarget.blur();
            }
          }}
        />
        {suffix && <span className="field-suffix">{suffix}</span>}
      </span>
    </label>
  );
}

export function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  format,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-control field-slider">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className="field-value">{format ? format(value) : value}</span>
      </span>
    </label>
  );
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [text, setText] = useState(value);
  // Same latest-value ref as NumberField: Enter commits the text actually in
  // the field, not a stale render closure.
  const latestText = useRef(value);
  const cancelNextBlur = useRef(false);
  useEffect(() => {
    latestText.current = value;
    setText(value);
  }, [value]);
  const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';

  const commit = () => {
    if (cancelNextBlur.current) {
      cancelNextBlur.current = false;
      latestText.current = value;
      setText(value);
      return;
    }
    const next = latestText.current.trim();
    if (next === '' || /^(#|rgb|hsl|linear-gradient|none|transparent)/.test(next)) {
      onChange(next);
    } else {
      latestText.current = value;
      setText(value);
    }
  };

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-control field-color">
        <input
          type="color"
          value={hex}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`${label} color`}
        />
        <input
          type="text"
          className="field-input"
          value={text}
          onChange={(event) => {
            latestText.current = event.target.value;
            setText(event.target.value);
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              cancelNextBlur.current = true;
              setText(value);
              event.currentTarget.blur();
            }
          }}
        />
      </span>
    </label>
  );
}

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** When set on any option, entries are rendered inside an <optgroup> per group. */
  group?: string;
  /** Optional font-family preview applied to the option element. */
  fontFamily?: string;
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  const styled = (option: SelectOption<T>) => (
    <option
      key={option.value}
      value={option.value}
      style={option.fontFamily ? { fontFamily: option.fontFamily } : undefined}
    >
      {option.label}
    </option>
  );

  const grouped = options.some((option) => option.group !== undefined);
  const body: ReactNode[] = [];
  if (grouped) {
    let currentGroup: string | undefined;
    let bucket: ReactNode[] = [];
    const flush = () => {
      if (bucket.length === 0) return;
      body.push(
        <optgroup key={currentGroup} label={currentGroup}>
          {bucket}
        </optgroup>,
      );
      bucket = [];
    };
    for (const option of options) {
      if (option.group !== currentGroup) {
        flush();
        currentGroup = option.group;
      }
      bucket.push(styled(option));
    }
    flush();
  } else {
    body.push(...options.map((option) => styled(option)));
  }

  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <span className="field-control">
        <select
          id={id}
          className="field-input"
          value={value}
          onChange={(event) => onChange(event.target.value as T)}
        >
          {body}
        </select>
      </span>
    </label>
  );
}

export function ToggleField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="field field-toggle">
      <span className="field-label">{label}</span>
      <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(value);
  const cancelNextBlur = useRef(false);
  useEffect(() => setText(value), [value]);
  return (
    <label className="field field-block">
      <span className="field-label">{label}</span>
      <input
        className="field-input"
        type="text"
        value={text}
        placeholder={placeholder}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          if (cancelNextBlur.current) {
            cancelNextBlur.current = false;
            setText(value);
            return;
          }
          onChange(text);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            cancelNextBlur.current = true;
            setText(value);
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 4,
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  mono?: boolean;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <label className="field field-block">
      <span className="field-label">{label}</span>
      <textarea
        className={`field-input field-textarea ${mono ? 'mono' : ''}`}
        rows={rows}
        value={text}
        spellCheck={false}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => onChange(text)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (value: T) => void;
  label?: string;
}) {
  return (
    <div className="field field-block">
      {label && <span className="field-label">{label}</span>}
      <div className="segmented">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            title={option.title}
            className={`segmented-btn ${value === option.value ? 'active' : ''}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ButtonRow({ children }: { children: ReactNode }) {
  return <div className="button-row">{children}</div>;
}

export function SmallButton({
  children,
  onClick,
  title,
  danger,
  active,
}: {
  children: ReactNode;
  onClick: () => void;
  title?: string;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`small-btn ${danger ? 'danger' : ''} ${active ? 'active' : ''}`}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}
