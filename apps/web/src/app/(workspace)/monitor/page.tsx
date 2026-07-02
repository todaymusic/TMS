"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, progressColor, type Task, type User } from "@/lib/api";

export default function MonitorPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      const [u, t] = await Promise.all([
        api.get<User[]>("/users"),
        api.get<Task[]>("/tasks"),
      ]);
      setUsers(u);
      setTasks(t);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    const id = setInterval(load, 20000); // 20초마다 실시간 갱신
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 각 사용자의 현재 진행중(doing) 업무
  const doingByUser = new Map<string, Task>();
  for (const t of tasks) {
    if (t.status === "doing" && t.assignee && !doingByUser.has(t.assignee.id)) {
      doingByUser.set(t.assignee.id, t);
    }
  }
  const onlineCount = users.filter((u) => u.status !== "off").length;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>현황판</h1>
          <div className="sub">팀 실시간 업무 현황</div>
        </div>
      </div>

      <div className="content">
        {err && (
          <div className="card" style={{ color: "#dc2626", marginBottom: 16 }}>
            API 오류: {err}
          </div>
        )}
        <div className="card">
          <div className="panel-head">
            <div className="sec-title">
              <span className="em">🟢</span> 실시간 업무현황
            </div>
            <span className="live">
              <span className="ping" />
              LIVE
            </span>
            <span className="count">접속 {onlineCount}명</span>
          </div>
          <div className="team-grid">
            {loading && <div style={{ color: "var(--text-3)", fontSize: 13 }}>불러오는 중…</div>}
            {!loading &&
              users.map((m) => {
                const task = doingByUser.get(m.id);
                const pct = task?.progress ?? 0;
                return (
                  <Link
                    className="member"
                    key={m.id}
                    href={`/activity?userId=${m.id}`}
                    title={`${m.name}님의 활동 보기`}
                    style={{ cursor: "pointer", textDecoration: "none", color: "inherit" }}
                  >
                    <div className="member-top">
                      <div className="member-av">
                        <div className="avatar" style={{ background: m.avatarColor, width: 36, height: 36 }}>
                          {m.name.slice(0, 1)}
                        </div>
                        <span className={`dot ${m.status}`} />
                      </div>
                      <div>
                        <div className="member-name">{m.name}</div>
                        <div className="member-dept">{m.dept ?? ""}</div>
                      </div>
                      <span className="pill gray" style={{ marginLeft: "auto" }}>
                        {task?.project?.name ?? "—"}
                      </span>
                    </div>
                    <div className="member-task">
                      {m.status === "off" ? "오프라인" : task ? "진행중 · " : "대기 중"}
                      <b>{m.status === "off" ? "" : (task?.title ?? "")}</b>
                    </div>
                    {task?.statusMemo && (
                      <div
                        style={{
                          fontSize: 11.5,
                          color: "var(--text-3)",
                          marginTop: 2,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        📝 {task.statusMemo}
                      </div>
                    )}
                    <div className="member-foot">
                      <div className="prog" style={{ flex: 1 }}>
                        <i style={{ width: `${pct}%`, background: progressColor(pct) }} />
                      </div>
                      <span className="pct" style={{ color: progressColor(pct) }}>
                        {pct}%
                      </span>
                    </div>
                  </Link>
                );
              })}
          </div>
        </div>
      </div>
    </>
  );
}
