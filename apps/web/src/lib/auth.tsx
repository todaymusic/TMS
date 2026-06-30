"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, type User } from "./api";

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  refresh: async () => {},
});

const COOKIE_MAXAGE = 60 * 60 * 24 * 30; // 30일

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 캐시된 사용자로 즉시 복원
    try {
      const raw = localStorage.getItem("tms_user");
      if (raw) setUser(JSON.parse(raw) as User);
    } catch {
      /* noop */
    }
    setLoading(false);
    // 토큰 있으면 /auth/me 로 최신 정보 동기화(권한·프로필 변경 반영)
    if (localStorage.getItem("tms_token")) {
      api
        .get<User>("/auth/me")
        .then((fresh) => {
          setUser(fresh);
          localStorage.setItem("tms_user", JSON.stringify(fresh));
        })
        .catch(() => {});
    }
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post<{ accessToken: string; user: User }>(
      "/auth/login",
      { email, password },
    );
    localStorage.setItem("tms_token", res.accessToken);
    localStorage.setItem("tms_user", JSON.stringify(res.user));
    document.cookie = `tms_token=${res.accessToken}; path=/; max-age=${COOKIE_MAXAGE}; samesite=lax`;
    setUser(res.user);
  }

  async function refresh() {
    try {
      const fresh = await api.get<User>("/auth/me");
      setUser(fresh);
      localStorage.setItem("tms_user", JSON.stringify(fresh));
    } catch {
      /* noop */
    }
  }

  function logout() {
    localStorage.removeItem("tms_token");
    localStorage.removeItem("tms_user");
    document.cookie = "tms_token=; path=/; max-age=0";
    setUser(null);
    window.location.href = "/login";
  }

  return (
    <Ctx.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
