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
  // 계정 앱 분리(tms/hellotms)
  homeApp: string; // 이 웹/계정의 기본 앱
  isSuperAdmin: boolean; // 마승일·신선중 = 두 앱 모드 전환 가능
  viewApp: string; // 현재 들어가 있는 앱: "tms" | "hellotms" (계정은 그대로)
  setViewApp: (app: string) => void; // 앱 모드 전환(마승일 그대로 그 앱으로 들어감)
};

// 이 웹이 어느 앱인지(env). tms 웹=tms, hello 웹=hellotms
const HOME_APP = process.env.NEXT_PUBLIC_APP ?? "tms";
// 두 앱 전체를 볼 수 있는 대표 계정(이름 기준)
const SUPER_ADMINS = ["마승일", "신선중"];

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  refresh: async () => {},
  homeApp: HOME_APP,
  isSuperAdmin: false,
  viewApp: HOME_APP,
  setViewApp: () => {},
});

const COOKIE_MAXAGE = 60 * 60 * 24 * 30; // 30일

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = !!user && SUPER_ADMINS.includes(user.name);
  const ownApp = user?.app ?? HOME_APP;

  // 대표(마승일·신선중)만 앱 모드를 바꿀 수 있고, 그 값을 저장/복원
  const [viewAppState, setViewAppState] = useState<string>(HOME_APP);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("tms_viewapp");
      if (saved) setViewAppState(saved);
    } catch {
      /* noop */
    }
  }, []);
  const setViewApp = (a: string) => {
    setViewAppState(a);
    try {
      localStorage.setItem("tms_viewapp", a);
    } catch {
      /* noop */
    }
  };
  // 대표가 아니면 항상 자기 계정의 앱. 대표면 선택한 앱 모드로 들어감(계정은 그대로).
  const viewApp = isSuperAdmin ? viewAppState : ownApp;

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

      // 앱 진입 시 하루 경계 리셋 — 전날 진행중이던 업무 자동 '중단'(자동로그인 케이스 포함)
      try {
        const u = JSON.parse(
          localStorage.getItem("tms_user") || "null",
        ) as User | null;
        if (u?.id) api.post(`/tasks/day-reset?userId=${u.id}`, {}).catch(() => {});
      } catch {
        /* noop */
      }
    }

    // 접속 하트비트 — 현황판 온라인/오프라인 판정용 (탭 닫히면 멈춰서 곧 오프라인)
    const beat = () => {
      if (localStorage.getItem("tms_token")) {
        api.post("/auth/heartbeat", {}).catch(() => {});
      }
    };
    beat();
    const hb = setInterval(beat, 60_000);
    return () => clearInterval(hb);
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
    <Ctx.Provider
      value={{ user, loading, login, logout, refresh, homeApp: HOME_APP, isSuperAdmin, viewApp, setViewApp }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
