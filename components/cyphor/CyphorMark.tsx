import { cn } from "@/lib/utils";

/**
 * Signature mark: a segmented rotor ring with an offset core, standing in for
 * a cipher disk mid-turn. Renders in currentColor so it can sit on the
 * signal-teal accent or plain foreground depending on context.
 */
export function CyphorMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-5 w-5", className)}
      aria-hidden="true"
    >
      <circle
        cx="16"
        cy="16"
        r="12.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeDasharray="4.2 5.4"
      />
      <circle cx="16" cy="16" r="3.4" fill="currentColor" />
      <circle cx="16" cy="4.6" r="1.6" fill="currentColor" />
    </svg>
  );
}
