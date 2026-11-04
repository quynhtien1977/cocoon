"use client";

import { useEffect, useState } from "react";
import { ApiError } from "./client";

/** Loads on mount and on retry. `load` must be stable (module-level or useCallback). */
export function useApiData<T>(load: (signal: AbortSignal) => Promise<T>, errorMessage = "Chưa tải được dữ liệu. Kiểm tra kết nối rồi thử lại.") {
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
        setError(errorMessage);
        setLoading(false);
      })
      .finally(() => clearTimeout(timeout));
    return () => { current = false; controller.abort(); };
  }, [load, attempt, errorMessage]);

  const retry = () => { setLoading(true); setError(null); setMissing(false); setAttempt((value) => value + 1); };
  return { data, loading, error, missing, retry };
}
