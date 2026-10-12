interface AlertProps {
  tone?: "error" | "info";
  title?: string;
  children: React.ReactNode;
}

/**
 * Form-level feedback. Errors are announced assertively because they usually
 * appear in response to a submit; informational notes are polite.
 */
export default function Alert({ tone = "error", title, children }: AlertProps) {
  const error = tone === "error";
  return (
    <div
      className={`rg-alert${error ? "" : " rg-alert--info"}`}
      role={error ? "alert" : "status"}
      aria-live={error ? "assertive" : "polite"}
    >
      <div>
        {title ? <strong>{title}</strong> : null}
        {children}
      </div>
    </div>
  );
}
