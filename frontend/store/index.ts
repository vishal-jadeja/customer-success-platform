import { configureStore } from "@reduxjs/toolkit";

import authReducer from "@/store/slices/authSlice";
import customersReducer from "@/store/slices/customersSlice";
import dashboardReducer from "@/store/slices/dashboardSlice";
import interactionsReducer from "@/store/slices/interactionsSlice";
import usersReducer from "@/store/slices/usersSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    customers: customersReducer,
    interactions: interactionsReducer,
    dashboard: dashboardReducer,
    users: usersReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
