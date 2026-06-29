"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { STATUS_LABEL, type Status } from "@/lib/mock";

const NAV = [
  { href: "/dashboard", ic: "🏠", label: "대시보드" },
  { href: "/calendar", ic: "📅", label: "캘린더" },
  { href: "/projects", ic: "📁", label: "프로젝트" },
  { href: "/activity", ic: "👤", label: "내 활동", badge: 3 },
] as const;

const STATUSES: Status[] = ["on", "away", "dnd", "off"];

export default function Sidebar() {
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>("on");
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">W</div>
        <div>
          <div className="brand-name">Workly</div>
          <div className="brand-sub">디자인팀 워크스페이스</div>
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
          {"badge" in n && n.badge ? <span className="badge">{n.badge}</span> : null}
        </Link>
      ))}

      <div className="nav-div" />
      <div className="nav-item"><span className="ic">💬</span><span className="label">DM / 채팅</span></div>
      <div className="nav-item"><span className="ic">⚙️</span><span className="label">설정</span></div>

      <div className="status-box" onClick={() => setMenuOpen((o) => !o)}>
        <div className="lbl">내 상태</div>
        <div className="status-now">
          <span className={`dot ${status}`} />
          <span className="txt">{STATUS_LABEL[status]}</span>
          <span className="car">▾</span>
        </div>
        <div className={`status-menu${menuOpen ? " open" : ""}`}>
          {STATUSES.map((s) => (
            <div
              key={s}
              className="status-opt"
              onClick={(e) => {
                e.stopPropagation();
                setStatus(s);
                setMenuOpen(false);
              }}
            >
              <span className={`dot ${s}`} />
              {STATUS_LABEL[s]}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
