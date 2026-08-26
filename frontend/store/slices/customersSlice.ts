import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { api } from "@/lib/axios";
import { extractApiError, type ApiError } from "@/lib/errors";
import { cleanParams } from "@/lib/queryParams";
import type { CustomerSortValue, CustomerStatusValue } from "@/schemas/customer";
import type { User } from "@/store/slices/authSlice";

export interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  phone?: string | null;
  industry: string | null;
  status: CustomerStatusValue;
  health_score: number;
  arr: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  // Present only on rows returned by GET /customers/{id} (CustomerOut),
  // absent on plain list rows (CustomerListItem) — see backend
  // app/schemas/customer.py. Optional here rather than two separate
  // frontend types so both shapes fit one normalised `entities` map.
  interaction_count?: number;
  owner?: User | null;
}

interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface CustomerListParams {
  page?: number;
  page_size?: number;
  q?: string;
  status?: CustomerStatusValue | "";
  owner_id?: string;
  industry?: string;
  min_health?: number;
  max_health?: number;
  sort?: CustomerSortValue;
  order?: "asc" | "desc";
}

export interface CustomerFormPayload {
  name: string;
  company: string;
  email: string;
  phone?: string | null;
  industry?: string | null;
  status: CustomerStatusValue;
  health_score: number;
  arr?: string | null;
  owner_id?: string | null;
}

type Status = "idle" | "loading" | "succeeded" | "failed";

interface CustomersState {
  entities: Record<string, Customer>;
  ids: string[];
  total: number;
  page: number;
  page_size: number;
  status: Status;
  error: ApiError | null;
  detailStatus: Status;
  detailError: ApiError | null;
  deleteError: ApiError | null;
  filters: CustomerListParams;
}

const initialState: CustomersState = {
  entities: {},
  ids: [],
  total: 0,
  page: 1,
  page_size: 20,
  status: "idle",
  error: null,
  detailStatus: "idle",
  detailError: null,
  deleteError: null,
  filters: {},
};

export const fetchCustomers = createAsyncThunk<
  Page<Customer>,
  CustomerListParams,
  { rejectValue: ApiError }
>("customers/fetchCustomers", async (params, { rejectWithValue }) => {
  try {
    const { data } = await api.get<Page<Customer>>("/customers", { params: cleanParams(params) });
    return data;
  } catch (err) {
    return rejectWithValue(extractApiError(err));
  }
});

export const fetchCustomer = createAsyncThunk<Customer, string, { rejectValue: ApiError }>(
  "customers/fetchCustomer",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.get<Customer>(`/customers/${id}`);
      return data;
    } catch (err) {
      return rejectWithValue(extractApiError(err));
    }
  },
);

export const createCustomer = createAsyncThunk<
  Customer,
  CustomerFormPayload,
  { rejectValue: ApiError }
>("customers/createCustomer", async (data, { rejectWithValue }) => {
  try {
    const { data: customer } = await api.post<Customer>("/customers", data);
    return customer;
  } catch (err) {
    return rejectWithValue(extractApiError(err));
  }
});

export const updateCustomer = createAsyncThunk<
  Customer,
  { id: string; data: Partial<CustomerFormPayload> },
  { rejectValue: ApiError }
>("customers/updateCustomer", async ({ id, data }, { rejectWithValue }) => {
  try {
    const { data: customer } = await api.patch<Customer>(`/customers/${id}`, data);
    return customer;
  } catch (err) {
    return rejectWithValue(extractApiError(err));
  }
});

export const deleteCustomer = createAsyncThunk<string, string, { rejectValue: ApiError }>(
  "customers/deleteCustomer",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/customers/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(extractApiError(err));
    }
  },
);

const customersSlice = createSlice({
  name: "customers",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCustomers.pending, (state, action) => {
        state.status = "loading";
        state.error = null;
        state.filters = action.meta.arg;
      })
      .addCase(fetchCustomers.fulfilled, (state, action: PayloadAction<Page<Customer>>) => {
        state.status = "succeeded";
        state.entities = {};
        state.ids = [];
        for (const customer of action.payload.items) {
          state.entities[customer.id] = customer;
          state.ids.push(customer.id);
        }
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.page_size = action.payload.page_size;
      })
      .addCase(fetchCustomers.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? null;
      })
      .addCase(fetchCustomer.pending, (state) => {
        state.detailStatus = "loading";
        state.detailError = null;
      })
      .addCase(fetchCustomer.fulfilled, (state, action: PayloadAction<Customer>) => {
        state.detailStatus = "succeeded";
        state.entities[action.payload.id] = action.payload;
      })
      .addCase(fetchCustomer.rejected, (state, action) => {
        state.detailStatus = "failed";
        state.detailError = action.payload ?? null;
      })
      .addCase(createCustomer.fulfilled, (state, action: PayloadAction<Customer>) => {
        state.entities[action.payload.id] = action.payload;
      })
      .addCase(updateCustomer.fulfilled, (state, action: PayloadAction<Customer>) => {
        // Merge, don't replace: PATCH's response (CustomerOut) can lack
        // `owner` if the route builds it without with_owner — keep whatever
        // the detail fetch already populated.
        state.entities[action.payload.id] = { ...state.entities[action.payload.id], ...action.payload };
      })
      .addCase(deleteCustomer.pending, (state) => {
        state.deleteError = null;
      })
      .addCase(deleteCustomer.fulfilled, (state, action: PayloadAction<string>) => {
        delete state.entities[action.payload];
        state.ids = state.ids.filter((id) => id !== action.payload);
        state.total = Math.max(0, state.total - 1);
      })
      .addCase(deleteCustomer.rejected, (state, action) => {
        state.deleteError = action.payload ?? null;
      });
  },
});

export default customersSlice.reducer;
