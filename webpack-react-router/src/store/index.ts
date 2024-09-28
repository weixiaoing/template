import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slice/auth";

// 根store
export const store = configureStore({
  //  不同slice
  reducer: {
    auth: authReducer,
  },
});

export type AppStore = typeof store;
export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
