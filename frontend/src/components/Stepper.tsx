"use client";

interface Props {
  steps: string[];
  current: number;
}

/** Progress through the create flow: a glass pill on desktop, a compact bar on phones. */
export default function Stepper({ steps, current }: Props) {
  return (
    <>
      <div
        role="list"
        aria-label="Progress"
        className="hidden md:flex items-center gap-3 py-2 pl-2 pr-5 rounded-full bg-glass backdrop-blur-[16px] border border-line shadow-sm"
      >
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <div
              key={label}
              role="listitem"
              aria-current={active ? "step" : undefined}
              className={`flex items-center gap-3 ${i < steps.length - 1 ? "flex-1" : ""}`}
            >
              <span
                className={`w-9 h-9 shrink-0 rounded-full grid place-items-center text-[13px] font-semibold transition-all duration-300 ${
                  done
                    ? "bg-accent text-on-accent"
                    : active
                      ? "bg-ink text-bg"
                      : "text-ink-2 shadow-[inset_0_0_0_1px_var(--line-strong)]"
                }`}
              >
                {done ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span className={`text-sm whitespace-nowrap ${active ? "font-semibold text-ink" : "font-medium text-ink-2"}`}>
                {label}
              </span>
              {i < steps.length - 1 && (
                <span className="relative flex-1 min-w-6 h-0.5 rounded-sm bg-line-strong overflow-hidden">
                  <span
                    className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-500"
                    style={{ width: done ? "100%" : "0%" }}
                  />
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="md:hidden flex flex-col gap-2.5">
        <div className="flex justify-between text-[13px]">
          <span className="text-ink-2">
            Step {current + 1} of {steps.length}
          </span>
          <span className="font-semibold text-ink">{steps[current]}</span>
        </div>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
          {steps.map((s, i) => (
            <span key={s} className={`h-1 rounded ${i <= current ? "bg-accent" : "bg-surface-2"}`} />
          ))}
        </div>
      </div>
    </>
  );
}
