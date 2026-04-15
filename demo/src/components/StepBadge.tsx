interface StepBadgeProps {
  number: number;
  active: boolean;
  done: boolean;
}

export function StepBadge({ number, active, done }: StepBadgeProps) {
  if (done) {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sol-green/20 text-sol-green">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
        active
          ? "bg-sol-purple text-white"
          : "border border-ink-600 bg-ink-800 text-ink-500"
      }`}
    >
      {number}
    </span>
  );
}
