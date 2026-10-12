import { useEffect, useId, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { CODE_LENGTH } from "../lib/validation";

interface OtpInputProps {
  /** Always CODE_LENGTH characters: a digit, or "" for an empty slot. */
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  label?: string;
  autoFocus?: boolean;
}

/**
 * Six single-digit inputs.
 *
 * Six real fields rather than one, because each digit needs its own accessible
 * name ("Digit 3 of 6") and its own focus target. Keyboard behaviour:
 * typing advances, Backspace clears then steps back, arrows and Home/End jump,
 * and pasting a whole code distributes across the cells.
 */
export default function OtpInput({
  value,
  onChange,
  disabled,
  invalid,
  describedBy,
  label = "Verification code",
  autoFocus,
}: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const groupId = useId();
  const digits = Array.from({ length: CODE_LENGTH }, (_, i) => value[i] ?? "");

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  /** Write a run of digits starting at `from`, ignoring anything non-numeric. */
  const spread = (from: number, chunk: string) => {
    const next = [...digits];
    const clean = chunk.replace(/\D/g, "");
    let cursor = from;
    for (const char of clean) {
      if (cursor >= CODE_LENGTH) break;
      next[cursor] = char;
      cursor += 1;
    }
    onChange(next.join(""));
    const focusAt = Math.min(cursor, CODE_LENGTH - 1);
    refs.current[focusAt]?.focus();
  };

  const handleChange = (index: number, raw: string) => {
    const clean = raw.replace(/\D/g, "");
    // More than one character means a paste or an autofill landed here.
    if (clean.length > 1) {
      spread(index, clean);
      return;
    }
    const next = [...digits];
    next[index] = clean;
    onChange(next.join(""));
    if (clean && index < CODE_LENGTH - 1) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    const focus = (at: number) => {
      event.preventDefault();
      refs.current[Math.max(0, Math.min(CODE_LENGTH - 1, at))]?.focus();
    };
    switch (event.key) {
      case "Backspace": {
        // Clear this digit; if it was already empty, step back and clear that.
        if (digits[index]) {
          const next = [...digits];
          next[index] = "";
          onChange(next.join(""));
        } else if (index > 0) {
          const next = [...digits];
          next[index - 1] = "";
          onChange(next.join(""));
          focus(index - 1);
        }
        break;
      }
      case "Delete": {
        const next = [...digits];
        next[index] = "";
        onChange(next.join(""));
        break;
      }
      case "ArrowLeft":
        focus(index - 1);
        break;
      case "ArrowRight":
        focus(index + 1);
        break;
      case "Home":
        focus(0);
        break;
      case "End":
        focus(CODE_LENGTH - 1);
        break;
      default:
        break;
    }
  };

  const handlePaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text");
    if (!/\d/.test(text)) return;
    event.preventDefault();
    spread(index, text);
  };

  // The first empty cell is where the next keystroke belongs.
  const nextEmpty = digits.findIndex((d) => !d);

  return (
    <div role="group" aria-labelledby={groupId} aria-describedby={describedBy}>
      <p className="rg-sr" id={groupId}>
        {label}
      </p>
      <div className="rg-otp">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              refs.current[index] = el;
            }}
            className={[
              "rg-otp-cell",
              digit ? "is-filled" : "",
              !digit && index === nextEmpty && !invalid ? "is-next" : "",
              invalid ? "is-invalid" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            type="text"
            inputMode="numeric"
            // SMS autofill offers the whole code on the first cell.
            autoComplete={index === 0 ? "one-time-code" : "off"}
            pattern="[0-9]*"
            maxLength={1}
            value={digit}
            disabled={disabled}
            aria-label={`Digit ${index + 1} of ${CODE_LENGTH}`}
            aria-invalid={invalid ? true : undefined}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={(e) => handlePaste(index, e)}
            onFocus={(e) => e.target.select()}
          />
        ))}
      </div>
    </div>
  );
}
