"use client";
import { Check, Circle } from "lucide-react";

/** Live hints that mirror the server policy (the server remains the authority). */
export function PasswordRules({ password }: { password: string }) {
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  const rules = [
    { ok: password.length >= 10, text: "At least 10 characters" },
    { ok: classes >= 3, text: "Three of: lowercase, uppercase, number, symbol" },
    { ok: new TextEncoder().encode(password).length <= 72 && password.length > 0, text: "At most 72 characters" },
  ];
  return (
    <ul className="mt-2 space-y-1 text-xs" aria-label="Password requirements">
      {rules.map((r) => (
        <li key={r.text} className={`flex items-center gap-2 ${r.ok ? "text-green-600" : "text-muted-foreground"}`}>
          {r.ok ? <Check className="w-3 h-3" aria-hidden /> : <Circle className="w-3 h-3" aria-hidden />}
          <span>{r.text}</span>
          <span className="sr-only">{r.ok ? "(met)" : "(not met yet)"}</span>
        </li>
      ))}
    </ul>
  );
}
