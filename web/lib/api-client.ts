export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("aimap_token");
}

export function setToken(token: string) {
  localStorage.setItem("aimap_token", token);
}

export function clearToken() {
  localStorage.removeItem("aimap_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = true
): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (auth) {
    const token = getToken();
    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }
  }

  const url = API_BASE ? `${API_BASE}${path}` : path;
  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    window.location.replace("/login");
    // Return a never-resolving promise so callers silently wait during redirect
    return new Promise<never>(() => {});
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string, init: RequestInit = {}) => request<T>(path, { ...init, method: "GET" }),
  post: <T>(path: string, body?: unknown, init: RequestInit = {}) =>
    request<T>(path, {
      ...init,
      method: "POST",
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  postNoAuth: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }, false),
};

/** Su kien NDJSON tu POST .../deep-analysis-stream (hoac reanalyze-stream). */
export type DeepAnalysisStreamEvent =
  | { type: "progress"; overlay_step: number; status: string; step_key: string }
  | { type: "error"; detail: string }
  | { type: "result"; data: unknown };

/**
 * POST stream NDJSON: moi dong la mot JSON. Goi onEvent cho progress/error; tra ve data cua dong result.
 */
export async function postNdjsonStream(
  path: string,
  body: unknown,
  init: { signal: AbortSignal; onEvent?: (e: DeepAnalysisStreamEvent) => void },
): Promise<unknown> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/x-ndjson",
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = API_BASE ? `${API_BASE}${path}` : path;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: init.signal,
  });

  if (res.status === 401) {
    clearToken();
    window.location.replace("/login");
    return new Promise<never>(() => {});
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(typeof err.detail === "string" ? err.detail : `HTTP ${res.status}`);
  }

  if (!res.body) {
    throw new Error("Phản hồi không có stream.");
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buffer = "";
  let lastResult: unknown = null;

  const flushLine = (line: string) => {
    const t = line.trim();
    if (!t) return;
    const evt = JSON.parse(t) as DeepAnalysisStreamEvent;
    if (init.onEvent) init.onEvent(evt);
    if (evt.type === "error") {
      throw new Error(evt.detail || "Lỗi phân tích");
    }
    if (evt.type === "result") {
      lastResult = evt.data;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += dec.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";
    for (const line of parts) {
      flushLine(line);
    }
  }
  if (buffer.trim()) {
    flushLine(buffer);
  }

  if (lastResult === null || lastResult === undefined) {
    throw new Error("Máy chủ không trả về kết quả (thiếu dòng result).");
  }
  return lastResult;
}
