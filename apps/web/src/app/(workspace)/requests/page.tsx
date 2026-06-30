"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, type Task } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function fmt(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}
function ymKey(s?: string | null) {
  if (!s) return "";
  const d = new Date(s);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function duration(t: Task) {
  if (!t.startedAt || !t.endedAt) return null;
  const ms = new Date(t.endedAt).getTime() - new Date(t.startedAt).getTime();
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  if (d >= 1) return `${d}일 ${h % 24}시간`;
  const m = Math.floor(ms / 60000);
  return h >= 1 ? `${h}시간` : `${m}분`;
}
function deadlineDiff(t: Task): { txt: string; color: string } {
  if (!t.dueDate || !t.endedAt) return { txt: "—", color: "var(--text-3)" };
  const days = Math.ceil((new Date(t.endedAt).getTime() - new Date(t.dueDate).getTime()) / 86400000);
  if (days > 0) return { txt: `+${days}일 초과`, color: "#dc2626" };
  if (days < 0) return { txt: `${-days}일 단축`, color: "#16a34a" };
  return { txt: "정시", color: "#16a34a" };
}

export default function RequestsPage() {
  const { user: me } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [who, setWho] = useState("all");
  const [month, setMonth] = useState("all");

  useEffect(() => {
    if (!me) return;
    api.get<Task[]>(`/tasks?assignerId=${me.id}`).then(setTasks).catch(() => {});
  }, [me]);

  // 남에게 요청한 업무만
  const requested = tasks.filter((t) => t.assignee && t.assignee.id !== me?.id);
  const people = Array.from(new Map(requested.map((t) => [t.assignee!.id, t.assignee!])).values());
  const months = Array.from(new Set(requested.map((t) => ymKey(t.endedAt || t.createdAt)).filter(Boolean))).sort().reverse();

  const rows = useMemo(
    () =>
      requested
        .filter((t) => (who === "all" ? true : t.assignee?.id === who))
        .filter((t) => (month === "all" ? true : ymKey(t.endedAt || t.createdAt) === month))
        .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()),
    [requested, who, month],
  );

  // 직원 선택 시 요약
  const summary = useMemo(() => {
    if (who === "all") return null;
    const list = rows;
    const done = list.filter((t) => t.endedAt);
    const withDue = done.filter((t) => t.dueDate);
    const onTime = withDue.filter((t) => new Date(t.endedAt!) <= new Date(t.dueDate!)).length;
    const durations = done
      .map((t) => (t.startedAt && t.endedAt ? new Date(t.endedAt).getTime() - new Date(t.startedAt).getTime() : null))
      .filter((x): x is number => x != null);
    const avgH = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 360000) / 10 : 0;
    const rework = list.reduce((a, t) => a + (t.reworkCount ?? 0), 0);
    const g = { 우수: 0, 양호: 0, 보완: 0 } as Record<string, number>;
    list.forEach((t) => { if (t.grade && g[t.grade] != null) g[t.grade]++; });
    return {
      total: list.length,
      done: done.length,
      onTimeRate: withDue.length ? Math.round((onTime / withDue.length) * 100) : null,
      avgH,
      avgRework: list.length ? Math.round((rework / list.length) * 10) / 10 : 0,
      g,
    };
  }, [rows, who]);

  const personName = people.find((p) => p.id === who)?.name ?? "";

  return (
    <>
      <div className="topbar">
        <div>
          <h1>요청 업무 관리</h1>
          <div className="sub">내가 요청한 업무 · 소요시간 · 마감 · 재작업 · 등급 분석</div>
        </div>
      </div>

      <div className="content">
        <Link href="/activity" className="detail-back">← 내 활동</Link>

        {/* 필터 */}
        <div className="card" style={{ padding: 14, marginBottom: 14, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>담당자</span>
            <select className="inp" value={who} onChange={(e) => setWho(e.target.value)} style={{ width: 130 }}>
              <option value="all">전체</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>월(완료 기준)</span>
            <select className="inp" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 120 }}>
              <option value="all">전체</option>
              {months.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-2)" }}>총 {rows.length}건</span>
        </div>

        {/* 직원 요약 */}
        {summary && (
          <div className="card" style={{ padding: 18, marginBottom: 14 }}>
            <div className="sec-title mb16"><span className="em">📊</span> {personName}님 종합 ({month === "all" ? "전체" : month})</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12 }}>
              {[
                ["요청", `${summary.total}건`],
                ["완료", `${summary.done}건`],
                ["마감 준수율", summary.onTimeRate == null ? "—" : `${summary.onTimeRate}%`],
                ["평균 소요", `${summary.avgH}시간`],
                ["평균 재작업", `${summary.avgRework}회`],
                ["등급", `우수 ${summary.g.우수}·양호 ${summary.g.양호}·보완 ${summary.g.보완}`],
              ].map(([k, v]) => (
                <div key={k} style={{ background: "var(--surface-2,#fafafa)", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>{k}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, fontSize: 13, color: "var(--text-2)", lineHeight: 1.6 }}>
              💬 <b>{personName}</b>님은 {month === "all" ? "" : month + "에 "}요청 {summary.total}건 중 {summary.done}건 완료
              {summary.onTimeRate != null && `, 마감 준수율 ${summary.onTimeRate}%`}
              {`, 평균 ${summary.avgH}시간 소요, 평균 재작업 ${summary.avgRework}회`}
              {summary.g.우수 + summary.g.양호 + summary.g.보완 > 0 && ` (우수 ${summary.g.우수}·양호 ${summary.g.양호}·보완 ${summary.g.보완})`}.
            </div>
          </div>
        )}

        {/* 표 */}
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--text-3)", fontSize: 11.5 }}>
                {["업무", "담당자", "요청일", "완료일", "소요", "마감대비", "재작업", "등급", "AI 한줄평"].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 20, color: "var(--text-3)", textAlign: "center" }}>요청한 업무가 없어요.</td></tr>
              )}
              {rows.map((t) => {
                const dd = deadlineDiff(t);
                return (
                  <tr key={t.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 12px" }}>
                      {t.project && <span style={{ color: "var(--text-3)", fontSize: 11 }}>({t.project.name}) </span>}
                      {t.title}
                    </td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{t.assignee?.name}</td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "var(--text-3)" }}>{fmt(t.createdAt)}</td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "var(--text-3)" }}>{fmt(t.endedAt)}</td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{duration(t) ?? "—"}</td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: dd.color }}>{dd.txt}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center", color: t.reworkCount ? "#c2410c" : "var(--text-3)" }}>{t.reworkCount ? `#${t.reworkCount}` : "—"}</td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{t.grade ? <span className="pill" style={{ background: "#ede9fe", color: "#6d28d9" }}>{t.grade}</span> : "—"}</td>
                    <td style={{ padding: "10px 12px", color: "var(--text-2)", maxWidth: 260 }}>{t.aiReview ? t.aiReview.slice(0, 80) + (t.aiReview.length > 80 ? "…" : "") : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
