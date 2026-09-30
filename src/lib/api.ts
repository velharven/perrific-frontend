import axios from "axios";
import { getCalendarConnection } from "./calendarConnection";

const TOKEN_KEY = "task_manager_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export const api = axios.create({
  baseURL: "/api",
});

api.interceptors.request.use((config) => {
  const token = getToken();
  const url = config.url || "";
  if (
    (url.includes("/calendar/google") && !/\/(status|connect)$/.test(url)) ||
    url.includes("/activities")
  ) {
    const connectionId = getCalendarConnection();
    if (connectionId !== undefined)
      config.headers["X-Calendar-Connection-Id"] = connectionId || "";
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => {
    const expected = res.config.headers["X-Calendar-Connection-Id"];
    if (
      expected !== undefined &&
      (expected || null) !== (getCalendarConnection() || null)
    ) {
      return Promise.reject({
        response: {
          status: 409,
          data: { message: "Akun Google telah berubah." },
        },
      });
    }
    if (res.config.method !== "get") {
      const url = res.config.url || "";
      const data = res.data.data;
      const activity =
        res.data.activity ||
        data?.activity ||
        (url.includes("/activities") && data?.userId ? data : null);
      const deleted =
        res.config.method === "delete" &&
        (url.includes("/activities/") ||
          url.includes("/calendar/google/events/"));
      if (activity || deleted || data?.activities)
        window.dispatchEvent(
          new CustomEvent("calendar:mutation", {
            detail: {
              connectionId: getCalendarConnection(),
              pendingCount: res.data.pendingCount,
              retry: data?.pending,
              activity,
              activities: data?.activities,
              deletedActivityIds: data?.deletedActivityIds,
              events: data?.events,
              affectedSeriesIds: data?.affectedSeriesIds,
              operationId: data?.operationId,
              activityId: data?.id,
              eventId: url.includes("/calendar/google/events/")
                ? data?.id
                : undefined,
              googleEventId: data?.googleEventId,
              action: data?.activities ? 'seriesMove' : deleted ? "delete" : "update",
            },
          }),
        );
    }
    return res;
  },
  (error) => {
    // Hanya request non-auth yang 401 boleh mengakhiri sesi; panggilan auth
    // sendiri (/auth/me saat boot, login, dsb.) ditangani pemanggilnya agar
    // gangguan sesaat (network/5xx) tidak membuang token yang masih valid.
    const url = String(error.config?.url ?? "");
    const isAuthCall =
      url === "/auth/me" ||
      url.endsWith("/auth/me") ||
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/google");
    const isCalendarCall = url.includes("/calendar/google");
    if (
      error.response?.status === 401 &&
      !isAuthCall &&
      !isCalendarCall &&
      !window.location.pathname.startsWith("/login")
    ) {
      clearToken();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ?? "http://localhost:4000";
