"use client";

interface Props {
  steps: string[];
  current: number;
}

export default function Stepper({ steps, current }: Props) {
  return (
    <div className="flex items-start mb-10">
      {steps.map((label, i) => {
        const isComplete = i < current;
        const isActive = i === current;
        return (
          <div key={label} className="flex items-start flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                  isComplete
                    ? "bg-accent border-accent text-white"
                    : isActive
                    ? "border-accent text-accent bg-accent/10"
                    : "border-border-custom text-muted"
                }`}
              >
                {isComplete ? (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-xs font-medium whitespace-nowrap ${
                  isActive ? "text-text" : "text-muted"
                }`}
              >
                {label}
              </span>
            </div>
            {i !== steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 mt-[18px] transition-colors ${
                  isComplete ? "bg-accent" : "bg-border-custom"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
