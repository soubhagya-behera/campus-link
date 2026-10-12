const STEPS = [
  { id: 1, label: "Your details" },
  { id: 2, label: "Verify email" },
  { id: 3, label: "Password" },
] as const;

interface ProgressRailProps {
  current: number;
}

/**
 * Three-step progress indicator. Each step is a list item whose state is
 * exposed in text ("Step 2 of 3, current"), not by colour alone.
 */
export default function ProgressRail({ current }: ProgressRailProps) {
  return (
    <nav className="rg-rail" aria-label="Registration progress">
      <ol>
        {STEPS.map((step) => {
          const state = step.id < current ? "is-done" : step.id === current ? "is-active" : "";
          return (
            <li
              key={step.id}
              className={`rg-step-item ${state}`.trim()}
              aria-current={step.id === current ? "step" : undefined}
            >
              <span className="rg-node" aria-hidden="true">
                {step.id < current ? "✓" : step.id}
              </span>
              <span className="rg-step-label">
                <span className="rg-sr">
                  Step {step.id} of {STEPS.length}
                  {step.id === current ? ", current" : step.id < current ? ", done" : ""}
                  {" — "}
                </span>
                <span aria-hidden="true">{step.label}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
