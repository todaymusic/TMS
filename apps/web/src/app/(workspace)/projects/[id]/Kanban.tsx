"use client";

import { useState } from "react";
import {
  api,
  type Priority,
  type TaskInProject,
  type TaskStatus,
} from "@/lib/api";

const PRI: Record<Priority, { label: string; cls: string }> = {
  urgent: { label: "긴급", cls: "u" },
  high: { label: "높음", cls: "h" },
  medium: { label: "보통", cls: "m" },
  low: { label: "낮음", cls: "l" },
};

const COLS: { key: TaskStatus; label: string; emoji: string }[] = [
  { key: "todo", label: "할일", emoji: "📥" },
  { key: "doing", label: "진행중", emoji: "🔄" },
  { key: "review", label: "검토중", emoji: "👀" },
  { key: "done", label: "완료", emoji: "✅" },
];

function md(d: string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

// 카드가 속하는 컬럼 (completed_pending → 완료 컬럼)
function colOf(status: TaskStatus): TaskStatus {
  return status === "completed_pending" ? "done" : status;
}

const PRIOS: Priority[] = ["urgent", "high", "medium", "low"];

export default function Kanban({
  projectId,
  initial,
  members,
}: {
  projectId: string;
  initial: TaskInProject[];
  members: { id: string; name: string }[];
}) {
  const [tasks, setTasks] = useState<TaskInProject[]>(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  // 태스크 추가
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [prio, setPrio] = useState<Priority>("medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [due, setDue] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  async function addTask() {
    if (!title.trim()) return;
    setAddBusy(true);
    try {
      const created = await api.post<TaskInProject & { assignee: TaskInProject["assignee"] }>(
        "/tasks",
        {
          title: title.trim(),
          category: "project",
          status: "todo",
          priority: prio,
          projectId,
          assigneeId: assigneeId || undefined,
          dueDate: due ? new Date(due).toISOString() : undefined,
        },
      );
      setTasks((cur) => [...cur, created]);
      setTitle("");
      setDue("");
      setAssigneeId("");
      setAdding(false);
    } finally {
      setAddBusy(false);
    }
  }

  async function move(id: string, to: TaskStatus) {
    const t = tasks.find((x) => x.id === id);
    if (!t || colOf(t.status) === to) return;
    const prev = tasks;
    // 낙관적 업데이트
    setTasks((cur) => cur.map((x) => (x.id === id ? { ...x, status: to } : x)));
    try {
      await api.patch(`/tasks/${id}`, { status: to });
    } catch {
      setTasks(prev); // 실패 시 롤백
    }
  }

  return (
    <>
      {/* 태스크 추가 */}
      <div style={{ marginBottom: 12 }}>
        {!adding ? (
          <button className="btn sm" onClick={() => setAdding(true)}>
            ＋ 태스크 추가
          </button>
        ) : (
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
              padding: 12,
              border: "1px solid var(--border)",
              borderRadius: 10,
            }}
          >
            <input
              className="inp"
              placeholder="태스크 제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ flex: 2, minWidth: 160 }}
              autoFocus
            />
            <select className="inp" value={prio} onChange={(e) => setPrio(e.target.value as Priority)} style={{ width: 90 }}>
              {PRIOS.map((p) => (
                <option key={p} value={p}>
                  {PRI[p].label}
                </option>
              ))}
            </select>
            <select className="inp" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} style={{ width: 110 }}>
              <option value="">담당자</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <input className="inp" type="date" value={due} onChange={(e) => setDue(e.target.value)} style={{ width: 150 }} />
            <button className="btn primary sm" onClick={addTask} disabled={addBusy}>
              {addBusy ? "추가 중…" : "추가"}
            </button>
            <button className="btn sm" onClick={() => setAdding(false)}>
              취소
            </button>
          </div>
        )}
      </div>

      <div className="kanban">
        {COLS.map((col) => {
          const items = tasks.filter((t) => colOf(t.status) === col.key);
          return (
            <div
              key={col.key}
              className="kcol"
              onDragOver={(e) => {
                e.preventDefault();
                setOver(col.key);
              }}
              onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData("text/plain") || dragId;
                if (id) void move(id, col.key);
              }}
              style={
                over === col.key
                  ? { outline: "2px dashed var(--primary, #4f46e5)", outlineOffset: -2, borderRadius: 8 }
                  : undefined
              }
            >
              <div className="kcol-head">
                {col.emoji} {col.label} <span className="n">{items.length}</span>
              </div>
              {items.map((t) => (
                <div
                  key={t.id}
                  className="kcard"
                  draggable
                  onDragStart={(e) => {
                    setDragId(t.id);
                    e.dataTransfer.setData("text/plain", t.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => setDragId(null)}
                  style={{ cursor: "grab", opacity: dragId === t.id ? 0.5 : 1 }}
                >
                  <div className="kt">{t.title}</div>
                  <div className="kf">
                    <span className={`pri ${PRI[t.priority].cls}`}>
                      {PRI[t.priority].label}
                    </span>
                    {t.dueDate && <span className="dd">{md(t.dueDate)}</span>}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div className="hint" style={{ marginTop: 12 }}>
        ↔ 카드를 다른 칸으로 드래그하면 상태가 바뀝니다.
      </div>
    </>
  );
}
