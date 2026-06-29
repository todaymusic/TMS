// Phase 1 쉘용 목업 데이터 (PROTOTYPE.html 기준). 추후 실제 API로 교체.

export type Status = "on" | "away" | "dnd" | "off";
export const STATUS_LABEL: Record<Status, string> = {
  on: "업무 중",
  away: "자리비움",
  dnd: "방해금지",
  off: "오프라인",
};

export type Member = {
  name: string;
  dept: string;
  color: string;
  st: Status;
  task: string;
  proj: string;
  pct: number;
};

export const TEAM: Member[] = [
  { name: "김서연", dept: "디자인 리드", color: "#4f46e5", st: "on", task: "메인 히어로 일러스트", proj: "웹 리뉴얼", pct: 80 },
  { name: "이준호", dept: "프론트엔드", color: "#0f766e", st: "on", task: "스크롤 인터랙션 개발", proj: "웹 리뉴얼", pct: 55 },
  { name: "박민지", dept: "프로덕트 디자인", color: "#db2777", st: "away", task: "앱 온보딩 플로우", proj: "앱 v2.0", pct: 40 },
  { name: "최우진", dept: "백엔드", color: "#ea580c", st: "dnd", task: "결제 API 리팩토링", proj: "앱 v2.0", pct: 65 },
  { name: "정하늘", dept: "QA", color: "#0891b2", st: "on", task: "회귀 테스트 작성", proj: "앱 v2.0", pct: 30 },
  { name: "한지우", dept: "기획", color: "#7c3aed", st: "off", task: "2분기 회고 정리", proj: "—", pct: 100 },
];

// SPEC: 진행률 경과별 색상 코딩 (0⚪ / ~25🔴 / ~50🟠 / ~75🟡 / ~99🔵 / 100🟢)
export function progressColor(pct: number): string {
  if (pct <= 0) return "#9ca3af";
  if (pct <= 25) return "#dc2626";
  if (pct <= 50) return "#ea580c";
  if (pct <= 75) return "#eab308";
  if (pct <= 99) return "#2563eb";
  return "#16a34a";
}
