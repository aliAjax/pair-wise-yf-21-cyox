import type { ReactNode } from "react";
import type { AreaStatus, InspectionStatus } from "../types";
import { AREA_STATUS_LABEL } from "../lib/progress";

export function Badge({
  tone,
  children,
}: {
  tone: "neutral" | "warn" | "danger" | "ok" | "info";
  children: ReactNode;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function AreaStatusBadge({ status }: { status: AreaStatus }) {
  const tone = {
    idle: "neutral",
    matched: "info",
    in_repair: "warn",
    done: "ok",
  }[status] as "neutral" | "info" | "warn" | "ok";
  return <Badge tone={tone}>{AREA_STATUS_LABEL[status]}</Badge>;
}

export function InspectionBadge({ status }: { status?: InspectionStatus }) {
  if (!status) return <Badge tone="ok">复验已闭环</Badge>;
  if (status === "open") return <Badge tone="warn">复验进行中</Badge>;
  if (status === "failed") return <Badge tone="danger">复验不合格·待复核</Badge>;
  return <Badge tone="ok">复验达标·待解冻</Badge>;
}

/** 色卡余量条：已用（实际消耗）/ 预留 / 余量 三段 */
export function OccupancyBar({
  used,
  reserved,
  total,
}: {
  used: number;
  reserved: number;
  total: number;
}) {
  const pctUsed = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const pctReserved = total > 0 ? Math.min(100 - pctUsed, (reserved / total) * 100) : 0;
  return (
    <div className="occ-bar" aria-label={`总量 ${total}m，已用 ${used}m，预留 ${reserved}m`}>
      <div className="occ-used" style={{ width: `${pctUsed}%` }} />
      <div className="occ-reserved" style={{ width: `${pctReserved}%` }} />
    </div>
  );
}

/** 纹样局部标记图：纯 SVG，按破损区状态打点，无新增依赖 */
export function PatternMark({
  seedIndex,
  statuses,
}: {
  seedIndex: number;
  statuses: AreaStatus[];
}) {
  const motifs = [
    { cx: 50, cy: 50, r: 26 },
    { cx: 22, cy: 22, r: 9 },
    { cx: 78, cy: 22, r: 9 },
    { cx: 22, cy: 78, r: 9 },
    { cx: 78, cy: 78, r: 9 },
  ];
  const dots = [
    { x: 22, y: 22 },
    { x: 78, y: 22 },
    { x: 50, y: 50 },
    { x: 22, y: 78 },
    { x: 78, y: 78 },
  ];
  const dotFill: Record<AreaStatus, string> = {
    idle: "#94a3b8",
    matched: "#0f766e",
    in_repair: "#b45309",
    done: "#15803d",
  };
  const rotate = (seedIndex % 4) * 12;
  return (
    <svg className="pattern-svg" viewBox="0 0 100 100" role="img" aria-label="纹样局部标记图">
      <g transform={`rotate(${rotate} 50 50)`}>
        {motifs.map((m, i) => (
          <circle
            key={i}
            cx={m.cx}
            cy={m.cy}
            r={m.r}
            fill="none"
            stroke="var(--primary)"
            strokeOpacity={i === 0 ? 0.55 : 0.3}
            strokeWidth={i === 0 ? 1.4 : 1}
          />
        ))}
        {motifs.slice(1).map((m, i) => (
          <line
            key={`l${i}`}
            x1={m.cx}
            y1={m.cy}
            x2={50}
            y2={50}
            stroke="var(--secondary)"
            strokeOpacity={0.25}
            strokeWidth={0.8}
          />
        ))}
      </g>
      {statuses.slice(0, dots.length).map((status, i) => (
        <circle key={i} cx={dots[i].x} cy={dots[i].y} r={4.2} fill={dotFill[status]} />
      ))}
    </svg>
  );
}
