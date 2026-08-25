import { isAxiosError } from "axios";

/**
 * Every backend error is the single envelope `{ error: { code, message, details, request_id } }`
 * (see backend/app/core/errors.py). Thunks funnel every catch through this so
 * `action.payload` in a component is always `{ code, message }`, never a raw
 * axios/network error shape.
 */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export function extractApiError(err: unknown): ApiError {
  if (isAxiosError(err)) {
    const envelope = err.response?.data?.error;
    if (envelope && typeof envelope.code === "string" && typeof envelope.message === "string") {
      return { code: envelope.code, message: envelope.message, details: envelope.details };
    }
    if (err.code === "ECONNABORTED") {
      return { code: "TIMEOUT", message: "The request timed out. Please try again." };
    }
    if (!err.response) {
      return { code: "NETWORK_ERROR", message: "Could not reach the server." };
    }
  }
  return { code: "UNKNOWN_ERROR", message: "Something went wrong. Please try again." };
}

/**
 * Maps a 422 VALIDATION_ERROR's `details` (FastAPI's
 * `[{loc: ["body", "field"], msg, type}]` shape, see
 * backend/app/core/errors.py::_clean_validation_errors) to
 * `{ field: message }` so react-hook-form's `setError` can attach it to the
 * matching input.
 */
export function fieldErrorsFromDetails(details: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(details)) return out;
  for (const entry of details) {
    const loc = entry?.loc;
    const msg = entry?.msg;
    if (Array.isArray(loc) && typeof msg === "string") {
      const field = loc[loc.length - 1];
      if (typeof field === "string") out[field] = msg;
    }
  }
  return out;
}
