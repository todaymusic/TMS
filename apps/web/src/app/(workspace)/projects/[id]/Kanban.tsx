"use client";

import { useState } from "react";
import {
  api,
  type Priority,
  type TaskDetail,
  type TaskInProject,
  type TaskStatus,
} from "@/lib/api";
import TaskDetailModal from "@/components/TaskDetailModal";
import ProjectTaskCreateModal from "./ProjectTaskCreateModal";

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

export default function Kanban({
  projectId,
  projectName,
  initial,
  members,
}: {
  projectId: string;
  projectName: string;
  initial: TaskInProject[];
  members: { id: string; name: string }[];
}) {
  const [tasks, setTasks] = useState<TaskInProject[]>(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // 상세 모달에서 저장 시 보드 카드 갱신
  function applyUpdate(u: TaskDetail) {
    setTasks((cur) =>
      cur.map((t) =>
        t.id === u.id
          ? {
              ...t,
              title: u.title,
              priority: u.priority,
              status: u.status,
              dueDate: u.dueDate,
              progress: u.progress,
              assignee: u.assignee,
            }
          : t,
      ),
    );
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
        <button className="btn primary sm" onClick={() => setCreateOpen(true)}>
          ＋ 태스크 추가
        </button>
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
                  onClick={() => setSelected(t.id)}
                  style={{ cursor: "pointer", opacity: dragId === t.id ? 0.5 : 1 }}
                  title="클릭하면 상세 보기"
                >
                  <div className="kt">{t.title}</div>
                  <div className="kf">
                    <span className={`pri ${PRI[t.priority].cls}`}>
                      {PRI[t.priority].label}
                    </span>
                    {t.dueDate && <span className="dd">{md(t.dueDate)}</span>}
                    {t.assignee && (
                      <span
                        style={{ marginLeft: t.dueDate ? undefined : "auto", color: "var(--text-3)", fontSize: 11 }}
                        title="담당자"
                      >
                        {t.assignee.name}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div className="hint" style={{ marginTop: 12 }}>
        ↔ 카드를 드래그하면 상태 변경 · 클릭하면 상세 보기/수정
      </div>

      {selected && (
        <TaskDetailModal
          taskId={selected}
          onClose={() => setSelected(null)}
          onSaved={applyUpdate}
          onDeleted={(id) => {
            setTasks((cur) => cur.filter((t) => t.id !== id));
            setSelected(null);
          }}
        />
      )}

      {createOpen && (
        <ProjectTaskCreateModal
          projectId={projectId}
          projectName={projectName}
          members={members}
          onClose={() => setCreateOpen(false)}
          onCreated={(t) => {
            setTasks((cur) => [t, ...cur]);
            setCreateOpen(false);
          }}
        />
      )}
    </>
  );
}
