/**
 * Nexora API Client.
 * Handles client-side API requests with credentials and error handling.
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
export const API_ORIGIN = API_BASE.replace(/\/api\/?$/, "");

function authHeaders(options: RequestInit = {}): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("nexora_token") : null;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

async function errorFromResponse(res: Response): Promise<Error> {
  let errorDetail = `Request failed with status ${res.status}`;
  try {
    const data = await res.json();
    if (data.detail) {
      errorDetail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    }
  } catch {
    // Keep default error
  }
  return new Error(errorDetail);
}

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: authHeaders(options),
    credentials: "include",
  });

  if (!res.ok) {
    throw await errorFromResponse(res);
  }

  return res.json() as Promise<T>;
}

/** Fetches a binary response (PDF/JSON export, page image, etc.) with auth. */
export async function fetchBlob(endpoint: string, options: RequestInit = {}): Promise<Blob> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: authHeaders(options),
    credentials: "include",
  });

  if (!res.ok) {
    throw await errorFromResponse(res);
  }

  return res.blob();
}

/** Downloads an authenticated API response as a file. */
export async function downloadApiFile(endpoint: string, filename: string): Promise<void> {
  const blob = await fetchBlob(endpoint);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Opens an authenticated API response in a new browser tab (PDF/page image). */
export async function openApiFile(endpoint: string): Promise<void> {
  const blob = await fetchBlob(endpoint);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
