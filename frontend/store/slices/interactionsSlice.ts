import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { api } from "@/lib/axios";
import { extractApiError, type ApiError } from "@/lib/errors";
import { cleanParams } from "@/lib/queryParams";
import type { InteractionTypeValue, SentimentValue } from "@/schemas/interaction";

export interface Insight {
  id: string;
  status: "pending" | "completed" | "failed";
  summary: string | null;
  sentiment: SentimentValue | null;
  action_items: string[];
  risks: string[];
  error_message: string | null;
  provider: string | null;
  model: string | null;
  latency_ms: number | null;
  attempts: number;
}

export interface Interaction {
  id: string;
  customer_id: string;
  user_id: string;
  type: InteractionTypeValue;
  title: string;
  notes: string;
  occurred_at: string;
  duration_minutes: number | null;
  created_at: string;
  updated_at: string;
  insight: Insight | null;
}

interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface InteractionListParams {
  page?: number;
  page_size?: number;
  customer_id?: string;
  type?: InteractionTypeValue | "";
  sentiment?: SentimentValue | "";
  date_from?: string;
  date_to?: string;
  q?: string;
}

export interface InteractionFormPayload {
  customer_id: string;
  type: InteractionTypeValue;
  title: string;
  notes: string;
  occurred_at: string;
  duration_minutes?: number | null;
}

// Longer than axios's global 15s timeout: the backend's LLM_TOTAL_BUDGET_SECONDS
// is 35s (worst case is one provider timing out then a failover call), so the
// default timeout can abort client-side while the backend keeps working and
// eventually succeeds. See backend/app/core/config.py's own "45s client cap"
// comment — this is that cap, applied on every request that runs the AI
// pipeline inline (create, and regenerate below).
const LLM_CALL_TIMEOUT_MS = 45_000;

type Status = "idle" | "loading" | "succeeded" | "failed";

interface InteractionsState {
  entities: Record<string, Interaction>;
  ids: string[];
  total: number;
  page: number;
  page_size: number;
  status: Status;
  error: ApiError | null;
  detailStatus: Status;
  detailError: ApiError | null;
  filters: InteractionListParams;
  // Per-interaction-id, not a single global flag: one row regenerating must
  // not disable a sibling's Retry button (e.g. two failed rows on one
  // customer's compact insight list).
  regeneratingIds: string[];
  regenerateErrors: Record<string, ApiError>;
}

const initialState: InteractionsState = {
  entities: {},
  ids: [],
  total: 0,
  page: 1,
  page_size: 20,
  status: "idle",
  error: null,
  detailStatus: "idle",
  detailError: null,
  filters: {},
  regeneratingIds: [],
  regenerateErrors: {},
};

export const fetchInteractions = createAsyncThunk<
  Page<Interaction>,
  InteractionListParams,
  { rejectValue: ApiError }
>("interactions/fetchInteractions", async (params, { rejectWithValue }) => {
  try {
    const { data } = await api.get<Page<Interaction>>("/interactions", {
      params: cleanParams(params),
    });
    return data;
  } catch (err) {
    return rejectWithValue(extractApiError(err));
  }
});

export const fetchForCustomer = createAsyncThunk<
  Page<Interaction>,
  { customerId: string; params?: Omit<InteractionListParams, "customer_id"> },
  { rejectValue: ApiError }
>("interactions/fetchForCustomer", async ({ customerId, params }, { rejectWithValue }) => {
  try {
    const { data } = await api.get<Page<Interaction>>(`/customers/${customerId}/interactions`, {
      params: cleanParams(params ?? {}),
    });
    return data;
  } catch (err) {
    return rejectWithValue(extractApiError(err));
  }
});

export const fetchInteraction = createAsyncThunk<Interaction, string, { rejectValue: ApiError }>(
  "interactions/fetchInteraction",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.get<Interaction>(`/interactions/${id}`);
      return data;
    } catch (err) {
      return rejectWithValue(extractApiError(err));
    }
  },
);

export const createInteraction = createAsyncThunk<
  Interaction,
  InteractionFormPayload,
  { rejectValue: ApiError }
>("interactions/createInteraction", async (data, { rejectWithValue }) => {
  try {
    const { data: interaction } = await api.post<Interaction>("/interactions", data, {
      timeout: LLM_CALL_TIMEOUT_MS,
    });
    return interaction;
  } catch (err) {
    return rejectWithValue(extractApiError(err));
  }
});

export const updateInteraction = createAsyncThunk<
  Interaction,
  { id: string; data: Partial<Omit<InteractionFormPayload, "customer_id">> },
  { rejectValue: ApiError }
>("interactions/updateInteraction", async ({ id, data }, { rejectWithValue }) => {
  try {
    const { data: interaction } = await api.patch<Interaction>(`/interactions/${id}`, data);
    return interaction;
  } catch (err) {
    return rejectWithValue(extractApiError(err));
  }
});

// Response is a bare InsightOut (not a full InteractionOut) — the route
// returns 200 even when generation itself fails (InsightService persists
// status='failed' + error_message rather than raising), so a "failed"
// insight here is a normal fulfilled outcome, not a rejection. rejected only
// fires for transport failures: 403 (non-owned customer), 404, network, or a
// client-side timeout.
export const regenerateInsight = createAsyncThunk<
  { id: string; insight: Insight },
  string,
  { rejectValue: ApiError }
>("interactions/regenerateInsight", async (id, { rejectWithValue }) => {
  try {
    const { data } = await api.post<Insight>(
      `/interactions/${id}/insight/regenerate`,
      undefined,
      { timeout: LLM_CALL_TIMEOUT_MS },
    );
    return { id, insight: data };
  } catch (err) {
    return rejectWithValue(extractApiError(err));
  }
});

function applyPage(state: InteractionsState, payload: Page<Interaction>) {
  state.entities = { ...state.entities };
  state.ids = [];
  for (const interaction of payload.items) {
    state.entities[interaction.id] = interaction;
    state.ids.push(interaction.id);
  }
  state.total = payload.total;
  state.page = payload.page;
  state.page_size = payload.page_size;
}

const interactionsSlice = createSlice({
  name: "interactions",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchInteractions.pending, (state, action) => {
        state.status = "loading";
        state.error = null;
        state.filters = action.meta.arg;
      })
      .addCase(fetchInteractions.fulfilled, (state, action: PayloadAction<Page<Interaction>>) => {
        state.status = "succeeded";
        applyPage(state, action.payload);
      })
      .addCase(fetchInteractions.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? null;
      })
      .addCase(fetchForCustomer.pending, (state, action) => {
        state.status = "loading";
        state.error = null;
        state.filters = { customer_id: action.meta.arg.customerId, ...action.meta.arg.params };
      })
      .addCase(fetchForCustomer.fulfilled, (state, action: PayloadAction<Page<Interaction>>) => {
        state.status = "succeeded";
        applyPage(state, action.payload);
      })
      .addCase(fetchForCustomer.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? null;
      })
      .addCase(fetchInteraction.pending, (state) => {
        state.detailStatus = "loading";
        state.detailError = null;
      })
      .addCase(fetchInteraction.fulfilled, (state, action: PayloadAction<Interaction>) => {
        state.detailStatus = "succeeded";
        state.entities[action.payload.id] = action.payload;
      })
      .addCase(fetchInteraction.rejected, (state, action) => {
        state.detailStatus = "failed";
        state.detailError = action.payload ?? null;
      })
      .addCase(createInteraction.fulfilled, (state, action: PayloadAction<Interaction>) => {
        state.entities[action.payload.id] = action.payload;
      })
      .addCase(updateInteraction.fulfilled, (state, action: PayloadAction<Interaction>) => {
        state.entities[action.payload.id] = action.payload;
      })
      .addCase(regenerateInsight.pending, (state, action) => {
        const id = action.meta.arg;
        if (!state.regeneratingIds.includes(id)) state.regeneratingIds.push(id);
        delete state.regenerateErrors[id];
        // Deliberately no optimistic flip of entity.insight.status here: that
        // would discard the still-useful error_message on a request that
        // ends up rejected. The disabled+spinner Retry button (driven by
        // regeneratingIds) already communicates "in flight" on its own.
      })
      .addCase(
        regenerateInsight.fulfilled,
        (state, action: PayloadAction<{ id: string; insight: Insight }>) => {
          const { id, insight } = action.payload;
          state.regeneratingIds = state.regeneratingIds.filter((rid) => rid !== id);
          delete state.regenerateErrors[id];
          // Patch only the insight field — never replace the entity (the
          // response carries no interaction fields) and never refetch the list.
          const entity = state.entities[id];
          if (entity) entity.insight = insight;
        },
      )
      .addCase(regenerateInsight.rejected, (state, action) => {
        const id = action.meta.arg;
        state.regeneratingIds = state.regeneratingIds.filter((rid) => rid !== id);
        state.regenerateErrors[id] = action.payload ?? {
          code: "UNKNOWN_ERROR",
          message: "Regeneration failed.",
        };
      });
  },
});

export default interactionsSlice.reducer;
