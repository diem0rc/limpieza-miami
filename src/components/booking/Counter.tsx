"use client";

export default function Counter({
  label,
  value,
  min,
  max,
  onChange,
  decreaseLabel,
  increaseLabel,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (delta: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border-2 border-border bg-surface p-5">
      <span id={`counter-${label}`} className="text-h3 font-semibold text-text">
        {label}
      </span>

      <div className="flex items-center gap-2">
        <CounterButton
          label={`${decreaseLabel} — ${label}`}
          disabled={value <= min}
          onClick={() => onChange(-1)}
          sign="−"
        />
        <output
          aria-labelledby={`counter-${label}`}
          className="w-9 text-center text-h3 font-bold tabular-nums text-text"
        >
          {value}
        </output>
        <CounterButton
          label={`${increaseLabel} — ${label}`}
          disabled={value >= max}
          onClick={() => onChange(1)}
          sign="+"
        />
      </div>
    </div>
  );
}

function CounterButton({
  label,
  disabled,
  onClick,
  sign,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  sign: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      // 44px: objetivo táctil mínimo cómodo en móvil.
      className="grid h-11 w-11 place-items-center rounded-pill border-2 border-border-strong text-h3 font-semibold text-text transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:border-border disabled:text-text-faint disabled:hover:border-border"
    >
      {sign}
    </button>
  );
}
