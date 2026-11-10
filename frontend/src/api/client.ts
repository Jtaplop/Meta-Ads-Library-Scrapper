/**
 * API client for Meta Ads Scraper backend
 */

export class ApiError extends Error {
  status: number;
  detail: string;
  code?: string;

  constructor(status: number, detail: string, code?: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.code = code;
  }
}

/**
 * Format FastAPI error detail (which can be a string, array of validation errors, or object)
 */
function extractErrorDetail(payload: unknown): { detail: string; code?: string } {
  if (!payload || typeof payload !== "object") {
    return { detail: typeof payload === "string" ? payload : "Error de comunicación con la API" };
  }

  const obj = payload as Record<string, unknown>;
  const code = typeof obj.code === "string" ? obj.code : undefined;

  if (typeof obj.detail === "string") {
    return { detail: obj.detail, code };
  }

  if (Array.isArray(obj.detail)) {
    // Pydantic validation errors
    const messages = obj.detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "msg" in item) {
          const loc = Array.isArray(item.loc) ? item.loc.join(" -> ") : "";
          return loc ? `${loc}: ${item.msg}` : String(item.msg);
        }
        return JSON.stringify(item);
      })
      .filter(Boolean);
    return {
      detail: messages.length > 0 ? messages.join("; ") : "Error de validación",
      code,
    };
  }

  if (typeof obj.message === "string") {
    return { detail: obj.message, code };
  }

  return { detail: JSON.stringify(payload), code };
}

/**
 * Typed fetch wrapper handling JSON parsing, 204 No Content, and FastAPI errors
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith("/api") ? path : path.startsWith("/") ? `/api${path}` : `/api/${path}`;

  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type") && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let errorDetail = response.statusText || `HTTP ${response.status}`;
    let errorCode: string | undefined;

    try {
      const errorJson = await response.json();
      const extracted = extractErrorDetail(errorJson);
      errorDetail = extracted.detail;
      errorCode = extracted.code;
    } catch {
      // Body is not JSON
      try {
        const text = await response.text();
        if (text) errorDetail = text;
      } catch {
        // Fallback to statusText
      }
    }

    throw new ApiError(response.status, errorDetail, errorCode);
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  // Fallback for non-json or empty responses
  const text = await response.text();
  if (!text) {
    return undefined as unknown as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}
