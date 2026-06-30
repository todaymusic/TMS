"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api, STATUS_LABEL, type UserStatus } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const NAV = [
  { href: "/dashboard", ic: "🏠", label: "대시보드" },
  { href: "/calendar", ic: "📅", label: "캘린더" },
  { href: "/projects", ic: "📁", label: "프로젝트" },
  { href: "/activity", ic: "👤", label: "내 활동" },
] as const;

const STATUSES: UserStatus[] = ["on", "away", "dnd", "off"];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout, refresh } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const status = user?.status ?? "off";
  useEffect(() => {
    setMsg(user?.statusMessage ?? "");
  }, [user?.statusMessage]);

  async function changeStatus(s: UserStatus) {
    if (!user) return;
    setMenuOpen(false);
    try {
      await api.patch(`/users/${user.id}`, { status: s });
      await refresh();
    } catch {
      /* noop */
    }
  }
  async function saveMsg() {
    if (!user) return;
    setSaving(true);
    try {
      await api.patch(`/users/${user.id}`, { statusMessage: msg.trim() });
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">T</div>
        <div>
          <div className="brand-name">TMS</div>
          <div className="brand-sub">주식회사 오늘은</div>
        </div>
      </div>

      <div className="nav-label">워크스페이스</div>
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className={`nav-item${pathname.startsWith(n.href) ? " active" : ""}`}
        >
          <span className="ic">{n.ic}</span>
          <span className="label">{n.label}</span>
        </Link>
      ))}

      <div className="nav-div" />
      <Link
        href="/dm"
        className={`nav-item${pathname.startsWith("/dm") ? " active" : ""}`}
      >
        <span className="ic">💬</span>
        <span className="label">DM / 채팅</span>
      </Link>
      <Link
        href="/settings"
        className={`nav-item${pathname.startsWith("/settings") ? " active" : ""}`}
      >
        <span className="ic">⚙️</span>
        <span className="label">설정</span>
      </Link>

      <div className="status-box">
        <div onClick={() => setMenuOpen((o) => !o)} style={{ cursor: "pointer" }}>
          <div className="lbl">{user ? user.name : "내 상태"}</div>
          <div className="status-now">
            <span className={`dot ${status}`} />
            <span className="txt">{user?.statusMessage || STATUS_LABEL[status]}</span>
            <span className="car">▾</span>
          </div>
        </div>
        <div className={`status-menu${menuOpen ? " open" : ""}`}>
          {STATUSES.map((s) => (
            <div
              key={s}
              className="status-opt"
              onClick={(e) => {
                e.stopPropagation();
                void changeStatus(s);
              }}
            >
              <span className={`dot ${s}`} />
              {STATUS_LABEL[s]}
              {status === s && <span style={{ marginLeft: "auto" }}>✓</span>}
            </div>
          ))}

          {/* 커스텀 상태 메시지 */}
          <div
            className="status-opt"
            style={{ borderTop: "1px solid var(--border)", display: "block", padding: "8px 10px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>커스텀 상태</div>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                className="inp"
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                placeholder="예: 회의 중 3시까지"
                style={{ flex: 1, fontSize: 12, padding: "4px 8px" }}
              />
              <button className="btn sm" onClick={saveMsg} disabled={saving}>
                {saving ? "…" : "저장"}
              </button>
            </div>
          </div>

          <div
            className="status-opt"
            style={{ borderTop: "1px solid var(--border)", color: "#dc2626" }}
            onClick={(e) => {
              e.stopPropagation();
              logout();
            }}
          >
            🚪 로그아웃
          </div>
        </div>
      </div>
    </aside>
  );
}
