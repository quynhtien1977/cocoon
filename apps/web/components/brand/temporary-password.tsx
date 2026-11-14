"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";

/** Masked by default so the temporary password is not readable over the shoulder; it lives only in this component's state. */
export function TemporaryPassword({ value }: { value: string }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setShown(true); // Clipboard blocked: show it so it can still be copied by hand.
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1 align-middle">
      <code className="rounded-sm bg-muted px-2 py-1 font-mono font-semibold text-foreground" aria-label={shown ? undefined : "Mật khẩu tạm đang ẩn"}>{shown ? value : "••••••••••"}</code>
      <button type="button" onClick={() => setShown(!shown)} aria-pressed={shown} className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
        {shown ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}{shown ? "Ẩn" : "Hiện"}
      </button>
      <button type="button" onClick={copy} className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
        {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}{copied ? "Đã sao chép" : "Sao chép"}
      </button>
    </span>
  );
}
