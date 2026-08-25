import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { api } from "@/lib/axios";
import { extractApiError, type ApiError } from "@/lib/errors";
import { cleanParams } from "@/lib/queryParams";
import type { CustomerStatusValue } from "@/schemas/customer";

// Mirrors backend/app/schemas/dashboard.py::DashboardSummary. by_status /
// sentiment_breakdown are always zero-filled with every enum key server-side,
// but typed loosely + read with `?? 0` so a stale/unexpected payload can
// never crash a card.
export interface DashboardSummary {
  total_customers: number;
  by_status: Record<string, number>;
  // Decimal -> JSON string under Pydantic v2 (same as Customer.arr, Phase 09).
  // Union-typed so the UI is correct either way; always read through
  // formatCurrency(), never rendered raw.
  total_arr: string | number;
  avg_health_score: number;
  interactions_last_30d: number;
  sentiment_breakdown: Record<string, number>;
}

// Mirrors backend/app/schemas/dashboard.py::SentimentTrendPoint. The response
// is SPARSE — only days with a non-null-sentiment insight appear, no
// zero-filled gap days. See lib/trend.ts for the gap-fill.
export interface SentimentTrendPoint {
  date: string; // "YYYY-MM-DD"
  positive: number;
  neutral: number;
  negative: number;
}

// Strict subset of CustomerListItem, deliberately NOT the customersSlice
// `Customer` type — this array must never half-populate customers.entities,
// and a distinct name stops it being passed somewhere that expects `owner`.
export interface AtRiskCustomer {
  id: string;
  name: string;
  company: string;
  email: string;
  industry: string | null;
  status: CustomerStatusValue;
  health_score: number;
  arr: string | null; // nullable here, unlike DashboardSummary.total_arr
  owner_id: string;
  created_at: string;
  updated_at: string;
}

type Status = "idle" | "loading" | "succeeded" | "failed";

interface DashboardState {
  summary: DashboardSummary | null;
  summaryStatus: Status;
  summaryError: ApiError | null;

  trend: SentimentTrendPoint[];
  trendDays: number;
  trendStatus: Status;
  trendError: ApiError | null;

  atRisk: AtRiskCustomer[];
  atRiskStatus: Status;
  atRiskError: ApiError | null;
}

const initialState: DashboardState = {
  summary: null,
  summaryStatus: "idle",
  summaryError: null,
  trend: [],
  trendDays: 30,
  trendStatus: "idle",
  trendError: null,
  atRisk: [],
  atRiskStatus: "idle",
  atRiskError: null,
};

export const fetchSummary = createAsyncThunk<DashboardSummary, void, { rejectValue: ApiError }>(
  "dashboard/fetchSummary",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get<DashboardSummary>("/dashboard/summary");
      return data;
    } catch (err) {
      return rejectWithValue(extractApiError(err));
    }
  },
);

export interface TrendParams {
  days?: number;
}

// Bare top-level array, not a Page<T> envelope.
export const fetchSentimentTrend = createAsyncThunk<
  SentimentTrendPoint[],
  TrendParams,
  { rejectValue: ApiError }
>("dashboard/fetchSentimentTrend", async (params, { rejectWithValue }) => {
  try {
    const { data } = await api.get<SentimentTrendPoint[]>("/dashboard/sentiment-trend", {
      params: cleanParams(params),
    });
    return data;
  } catch (err) {
    return rejectWithValue(extractApiError(err));
  }
});

export interface AtRiskParams {
  limit?: number;
}

// Bare top-level array, not a Page<T> envelope.
export const fetchAtRisk = createAsyncThunk<
  AtRiskCustomer[],
  AtRiskParams,
  { rejectValue: ApiError }
>("dashboard/fetchAtRisk", async (params, { rejectWithValue }) => {
  try {
    const { data } = await api.get<AtRiskCustomer[]>("/dashboard/at-risk", {
      params: cleanParams(params),
    });
    return data;
  } catch (err) {
    return rejectWithValue(extractApiError(err));
  }
});

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSummary.pending, (state) => {
        state.summaryStatus = "loading";
        state.summaryError = null;
      })
      .addCase(fetchSummary.fulfilled, (state, action: PayloadAction<DashboardSummary>) => {
        state.summaryStatus = "succeeded";
        state.summary = action.payload;
      })
      .addCase(fetchSummary.rejected, (state, action) => {
        state.summaryStatus = "failed";
        state.summaryError = action.payload ?? null;
      })
      .addCase(fetchSentimentTrend.pending, (state, action) => {
        state.trendStatus = "loading";
        state.trendError = null;
        state.trendDays = action.meta.arg.days ?? 30;
      })
      .addCase(
        fetchSentimentTrend.fulfilled,
        (state, action: PayloadAction<SentimentTrendPoint[]>) => {
          state.trendStatus = "succeeded";
          state.trend = action.payload;
        },
      )
      .addCase(fetchSentimentTrend.rejected, (state, action) => {
        state.trendStatus = "failed";
        state.trendError = action.payload ?? null;
      })
      .addCase(fetchAtRisk.pending, (state) => {
        state.atRiskStatus = "loading";
        state.atRiskError = null;
      })
      .addCase(fetchAtRisk.fulfilled, (state, action: PayloadAction<AtRiskCustomer[]>) => {
        state.atRiskStatus = "succeeded";
        state.atRisk = action.payload;
      })
      .addCase(fetchAtRisk.rejected, (state, action) => {
        state.atRiskStatus = "failed";
        state.atRiskError = action.payload ?? null;
      });
  },
});

export default dashboardSlice.reducer;
