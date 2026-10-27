export interface ApiProblem {
  status?: number;
  title?: string;
  detail?: string;
  code?: string;
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly errors: Record<string, string[]>;

  constructor(status: number, problem: ApiProblem) {
    super(problem.detail ?? problem.title ?? "Không thể hoàn tất yêu cầu. Vui lòng thử lại.");
    this.name = "ApiError";
    this.status = status;
    this.code = problem.code ?? "API_ERROR";
    this.errors = problem.errors ?? {};
  }
}

interface ApiRequestOptions {
  method?: string;
  json?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
  refresh?: boolean;
  redirectOnUnauthorized?: boolean;
}

let refreshRequest: Promise<boolean> | undefined;

async function refreshSession(): Promise<boolean> {
  if (!refreshRequest) {
    refreshRequest = fetch("/api/v1/auth/refresh", {
      method: "POST", credentials: "include", cache: "no-store",
    }).then((response) => response.ok).catch(() => false)
      .finally(() => { refreshRequest = undefined; });
  }
  return refreshRequest;
}

async function readProblem(response: Response): Promise<ApiProblem> {
  if (response.headers.get("content-type")?.includes("json")) {
    const body: unknown = await response.json().catch(() => undefined);
    if (body && typeof body === "object") {
      const raw = body as Record<string, unknown>;
      const problem: ApiProblem = {};
      if (typeof raw.title === "string") problem.title = raw.title;
      if (typeof raw.detail === "string") problem.detail = raw.detail;
      if (typeof raw.code === "string") problem.code = raw.code;
      if (raw.errors && typeof raw.errors === "object") {
        problem.errors = {};
        for (const [field, messages] of Object.entries(raw.errors))
          if (Array.isArray(messages) && messages.every((message) => typeof message === "string"))
            problem.errors[field] = messages;
      }
      return problem;
    }
  }
  return {};
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  if (!path.startsWith("/") || path.startsWith("//"))
    throw new Error("Đường dẫn API phải bắt đầu bằng một dấu /.");
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.json !== undefined) headers.set("Content-Type", "application/json");
  const request: RequestInit = {
    method: options.method ?? "GET", headers, credentials: "include", cache: "no-store",
    signal: options.signal,
    body: options.json === undefined ? undefined : JSON.stringify(options.json),
  };
  const url = `/api/v1${path}`;
  let response = await fetch(url, request);
  const canRefresh = options.refresh !== false && !path.startsWith("/auth/");
  if (response.status === 401 && canRefresh && await refreshSession())
    response = await fetch(url, request);
  if (!response.ok) {
    const problem = await readProblem(response);
    if (response.status === 401 && canRefresh && options.redirectOnUnauthorized !== false && typeof window !== "undefined")
      window.location.assign(new URL("/login", window.location.origin).href);
    throw new ApiError(response.status, problem);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
