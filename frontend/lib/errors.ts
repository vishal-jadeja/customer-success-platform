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
}

export function extractApiError(err: unknown): ApiError {
  if (isAxiosError(err)) {
    const envelope = err.response?.data?.error;
    if (envelope && typeof envelope.code === "string" && typeof envelope.message === "string") {
      return { code: envelope.code, message: envelope.message };
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
