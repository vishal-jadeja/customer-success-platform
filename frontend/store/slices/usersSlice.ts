import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { api } from "@/lib/axios";
import { extractApiError, type ApiError } from "@/lib/errors";
import { cleanParams } from "@/lib/queryParams";
import type { Role, User } from "@/store/slices/authSlice";

interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface UserListParams {
  page?: number;
  page_size?: number;
}

export interface UserUpdatePayload {
  role?: Role;
  is_active?: boolean;
}

type Status = "idle" | "loading" | "succeeded" | "failed";

interface UsersState {
  entities: Record<string, User>;
  ids: string[];
  total: number;
  page: number;
  page_size: number;
  status: Status;
  error: ApiError | null;
  // Per-id, same pattern as interactionsSlice's regeneratingIds: one row's
  // PATCH/DELETE must not disable every other row in the table.
  mutatingIds: string[];
  mutationErrors: Record<string, ApiError>;
}

const initialState: UsersState = {
  entities: {},
  ids: [],
  total: 0,
  page: 1,
  page_size: 20,
  status: "idle",
  error: null,
  mutatingIds: [],
  mutationErrors: {},
};

// GET /users returns a Page<User> envelope — unlike the dashboard endpoints,
// this one is NOT a bare array.
export const fetchUsers = createAsyncThunk<Page<User>, UserListParams, { rejectValue: ApiError }>(
  "users/fetchUsers",
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await api.get<Page<User>>("/users", { params: cleanParams(params) });
      return data;
    } catch (err) {
      return rejectWithValue(extractApiError(err));
    }
  },
);

export const updateUser = createAsyncThunk<
  User,
  { id: string; data: UserUpdatePayload },
  { rejectValue: ApiError }
>("users/updateUser", async ({ id, data }, { rejectWithValue }) => {
  try {
    const { data: user } = await api.patch<User>(`/users/${id}`, data);
    return user;
  } catch (err) {
    return rejectWithValue(extractApiError(err));
  }
});

// DELETE /users/{id} is a soft delete (204, is_active -> false) — the row
// stays in the table, greyed, never removed. Returns the id so the reducer
// can flip the flag on the existing entity rather than deleting it.
export const deactivateUser = createAsyncThunk<string, string, { rejectValue: ApiError }>(
  "users/deactivateUser",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/users/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(extractApiError(err));
    }
  },
);

const usersSlice = createSlice({
  name: "users",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action: PayloadAction<Page<User>>) => {
        state.status = "succeeded";
        state.entities = {};
        state.ids = [];
        for (const user of action.payload.items) {
          state.entities[user.id] = user;
          state.ids.push(user.id);
        }
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.page_size = action.payload.page_size;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? null;
      })
      .addCase(updateUser.pending, (state, action) => {
        const id = action.meta.arg.id;
        if (!state.mutatingIds.includes(id)) state.mutatingIds.push(id);
        delete state.mutationErrors[id];
      })
      .addCase(updateUser.fulfilled, (state, action: PayloadAction<User>) => {
        const id = action.payload.id;
        state.mutatingIds = state.mutatingIds.filter((mid) => mid !== id);
        state.entities[id] = action.payload;
      })
      .addCase(updateUser.rejected, (state, action) => {
        const id = action.meta.arg.id;
        state.mutatingIds = state.mutatingIds.filter((mid) => mid !== id);
        state.mutationErrors[id] = action.payload ?? {
          code: "UNKNOWN_ERROR",
          message: "Update failed.",
        };
      })
      .addCase(deactivateUser.pending, (state, action) => {
        const id = action.meta.arg;
        if (!state.mutatingIds.includes(id)) state.mutatingIds.push(id);
        delete state.mutationErrors[id];
      })
      .addCase(deactivateUser.fulfilled, (state, action: PayloadAction<string>) => {
        const id = action.payload;
        state.mutatingIds = state.mutatingIds.filter((mid) => mid !== id);
        const entity = state.entities[id];
        if (entity) entity.is_active = false;
      })
      .addCase(deactivateUser.rejected, (state, action) => {
        const id = action.meta.arg;
        state.mutatingIds = state.mutatingIds.filter((mid) => mid !== id);
        state.mutationErrors[id] = action.payload ?? {
          code: "UNKNOWN_ERROR",
          message: "Deactivate failed.",
        };
      });
  },
});

export default usersSlice.reducer;
