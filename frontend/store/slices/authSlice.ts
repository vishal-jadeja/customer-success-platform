import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { api, setAccessToken } from "@/lib/axios";
import { extractApiError, type ApiError } from "@/lib/errors";

export type Role = "admin" | "manager" | "csm";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

interface TokenOut {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  status: "idle" | "loading" | "succeeded" | "failed";
  error: ApiError | null;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  status: "idle",
  error: null,
};

export const login = createAsyncThunk<
  TokenOut,
  { email: string; password: string },
  { rejectValue: ApiError }
>("auth/login", async (credentials, { rejectWithValue }) => {
  try {
    const { data } = await api.post<TokenOut>("/auth/login", credentials);
    return data;
  } catch (err) {
    return rejectWithValue(extractApiError(err));
  }
});

// The backend does not auto-login on register (POST /auth/register returns
// only the created user, no token) — so "register -> auto-login" is a
// frontend orchestration: create the user, then log in with the same
// credentials, rather than a backend behavior that doesn't exist.
export const register = createAsyncThunk<
  TokenOut,
  { email: string; password: string; full_name: string },
  { rejectValue: ApiError }
>("auth/register", async (data, { dispatch, rejectWithValue }) => {
  try {
    await api.post("/auth/register", data);
  } catch (err) {
    return rejectWithValue(extractApiError(err));
  }
  const result = await dispatch(login({ email: data.email, password: data.password }));
  if (login.rejected.match(result)) {
    return rejectWithValue(result.payload ?? extractApiError(result.error));
  }
  return result.payload as TokenOut;
});

// 60s timeout: Render free tier cold-starts in ~50s and the global 15s
// default would bounce the first visitor to /login on a slow wake-up.
export const refreshToken = createAsyncThunk<TokenOut, void, { rejectValue: ApiError }>(
  "auth/refreshToken",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.post<TokenOut>("/auth/refresh", undefined, {
        timeout: 60000,
      });
      return data;
    } catch (err) {
      return rejectWithValue(extractApiError(err));
    }
  },
);

export const fetchMe = createAsyncThunk<User, void, { rejectValue: ApiError }>(
  "auth/fetchMe",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get<User>("/auth/me");
      return data;
    } catch (err) {
      return rejectWithValue(extractApiError(err));
    }
  },
);

export interface ProfileUpdate {
  full_name?: string;
  current_password?: string;
  new_password?: string;
}

export const updateMe = createAsyncThunk<User, ProfileUpdate, { rejectValue: ApiError }>(
  "auth/updateMe",
  async (data, { rejectWithValue }) => {
    try {
      const { data: user } = await api.patch<User>("/auth/me", data);
      return user;
    } catch (err) {
      return rejectWithValue(extractApiError(err));
    }
  },
);

export const logout = createAsyncThunk<void, void>("auth/logout", async () => {
  // Best-effort: the reducer clears local state regardless of whether this
  // call succeeds (backend down must never leave the UI stuck "logged in").
  await api.post("/auth/logout").catch(() => undefined);
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action: PayloadAction<TokenOut>) => {
        state.status = "succeeded";
        state.user = action.payload.user;
        state.accessToken = action.payload.access_token;
        setAccessToken(action.payload.access_token);
      })
      .addCase(login.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? null;
      })
      .addCase(register.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action: PayloadAction<TokenOut>) => {
        state.status = "succeeded";
        state.user = action.payload.user;
        state.accessToken = action.payload.access_token;
        setAccessToken(action.payload.access_token);
      })
      .addCase(register.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? null;
      })
      .addCase(refreshToken.fulfilled, (state, action: PayloadAction<TokenOut>) => {
        state.user = action.payload.user;
        state.accessToken = action.payload.access_token;
        setAccessToken(action.payload.access_token);
      })
      .addCase(refreshToken.rejected, (state, action) => {
        state.error = action.payload ?? null;
      })
      .addCase(fetchMe.fulfilled, (state, action: PayloadAction<User>) => {
        state.user = action.payload;
      })
      .addCase(updateMe.fulfilled, (state, action: PayloadAction<User>) => {
        state.user = action.payload;
      })
      .addMatcher(
        (action): action is ReturnType<typeof logout.fulfilled | typeof logout.rejected> =>
          action.type === logout.fulfilled.type || action.type === logout.rejected.type,
        (state) => {
          state.user = null;
          state.accessToken = null;
          state.status = "idle";
          state.error = null;
          setAccessToken(null);
        },
      );
  },
});

export default authSlice.reducer;
