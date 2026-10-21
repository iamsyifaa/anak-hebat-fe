import {
  fetchCurrentUserApi,
  loginWithPasswordApi,
  loginWithQrApi,
} from "@/lib/api/authApi";
import { getAccessToken } from "@/lib/api/client";
import type {
  AuthenticatedUser,
  AuthResult,
  StudentPasswordLoginPayload,
} from "@/lib/types/authType";
import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";

interface AuthState {
  user: AuthenticatedUser | null;
  accessToken: string;
  loading: boolean;
  restoring: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  accessToken: "",
  loading: false,
  restoring: false,
  error: null,
};

// Gagal login = thunk rejected (ApiError dilempar dari lib/api/client),
// jadi tidak ada lagi pengecekan response.code di komponen.
export const loginWithPassword = createAsyncThunk<
  AuthResult,
  StudentPasswordLoginPayload
>("auth/loginWithPassword", (payload) => loginWithPasswordApi(payload));

export const loginWithQr = createAsyncThunk<AuthResult, { qrPayload: string }>(
  "auth/loginWithQr",
  ({ qrPayload }) => loginWithQrApi(qrPayload),
);

// Redux tidak bertahan saat halaman di-refresh, sedangkan token ada di
// localStorage. Data user dipulihkan lewat GET /auth/me.
export const restoreSession = createAsyncThunk<AuthResult>(
  "auth/restoreSession",
  async () => {
    const accessToken = getAccessToken();
    if (!accessToken) throw new Error("Belum login.");
    const user = await fetchCurrentUserApi(accessToken);
    return { accessToken, user };
  },
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    resetAuth: (state) => {
      state.user = null;
      state.accessToken = "";
      state.loading = false;
      state.restoring = false;
      state.error = null;
    },
    clearAuthMessage: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    const onPending = (state: AuthState) => {
      state.loading = true;
      state.error = null;
    };
    const onFulfilled = (state: AuthState, action: PayloadAction<AuthResult>) => {
      state.loading = false;
      state.error = null;
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
    };

    builder
      .addCase(loginWithPassword.pending, onPending)
      .addCase(loginWithPassword.fulfilled, onFulfilled)
      .addCase(loginWithPassword.rejected, (state, action) => {
        state.loading = false;
        state.user = null;
        state.accessToken = "";
        state.error = action.error.message || "Username atau password salah.";
      })
      .addCase(loginWithQr.pending, onPending)
      .addCase(loginWithQr.fulfilled, onFulfilled)
      .addCase(loginWithQr.rejected, (state, action) => {
        state.loading = false;
        state.user = null;
        state.accessToken = "";
        state.error = action.error.message || "QR Code tidak valid.";
      })
      .addCase(restoreSession.pending, (state) => {
        state.restoring = true;
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.restoring = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
      })
      .addCase(restoreSession.rejected, (state) => {
        state.restoring = false;
      });
  },
});

export const { resetAuth, clearAuthMessage } = authSlice.actions;

export default authSlice.reducer;
