"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";

/** Loads on mount and on retry. `load` must be stable (module-level or useCallback). */
export function useApiData<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    const timeout = setTimeout(() => controller.abort(), 15_000);
    load(controller.signal)
      .then((result) => { if (current) { setData(result); setLoading(false); } })
      .catch((reason: unknown) => {
        if (!current) return;
        setMissing(reason instanceof ApiError && reason.status === 404);
        setError("Chưa tải được phản hồi. Kiểm tra kết nối rồi thử lại.");
        setLoading(false);
      })
      .finally(() => clearTimeout(timeout));
    return () => { current = false; controller.abort(); };
  }, [load, attempt]);

  const retry = () => { setLoading(true); setError(null); setMissing(false); setAttempt((value) => value + 1); };
  return { data, loading, error, missing, retry };
}
