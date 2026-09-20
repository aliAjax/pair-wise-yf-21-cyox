// 占用校验：色卡批次余量计算与绑定校验
// 绑定为整次原子操作——任一校验不通过即整次拒绝，原绑定与工序不变。

import type { ArchiveState, Batch, DamagedArea } from "./types";
import { freshSteps } from "./batchRules";
import type { LogEntry } from "./types";
import { nowIso, uid } from "../utils";

/** 计划占用：已绑定 + 在修区域的计划用量 */
export function plannedOccupancy(state: ArchiveState, batchId: string): number {
  return state.areas
    .filter(
      (a) =>
        a.batchId === batchId &&
        (a.status === "bound" || a.status === "repairing")
    )
    .reduce((sum, a) => sum + a.plannedQty, 0);
}

/** 已消耗：已完成区域的实际用量（留档） */
export function consumedQty(state: ArchiveState, batchId: string): number {
  return state.areas
    .filter((a) => a.batchId === batchId && a.status === "done")
    .reduce((sum, a) => sum + (a.actualQty ?? 0), 0);
}

/** 批次余量 = 入库总量 − 计划占用 − 已消耗 */
export function remainingQty(state: ArchiveState, batchId: string): number {
  const batch = state.batches.find((b) => b.id === batchId);
  if (!batch) return 0;
  return (
    batch.totalStock - plannedOccupancy(state, batchId) - consumedQty(state, batchId)
  );
}

export interface BindingCheck {
  ok: boolean;
  reasons: string[];
}

/** 绑定前校验：未冻结、复验已结、余量足够，缺一不可 */
export function checkBinding(
  state: ArchiveState,
  area: DamagedArea | undefined,
  batch: Batch | undefined,
  qty: number
): BindingCheck {
  const reasons: string[] = [];
  if (!area) reasons.push("破损区不存在");
  else if (area.status !== "pending") reasons.push("破损区不在待匹配状态");
  if (!batch) {
    reasons.push("色卡批次不存在");
  } else {
    if (batch.frozen) reasons.push(`批次 ${batch.code} 已冻结`);
    if (batch.recheckOpen) reasons.push(`批次 ${batch.code} 复验未结`);
  }
  if (!Number.isFinite(qty) || qty <= 0) reasons.push("计划用量需为大于 0 的数值");
  if (batch && Number.isFinite(qty) && qty > 0) {
    const rest = remainingQty(state, batch.id);
    if (rest < qty) {
      reasons.push(`批次 ${batch.code} 余量不足：余 ${rest}g，需 ${qty}g`);
    }
  }
  return { ok: reasons.length === 0, reasons };
}

export interface BindResult {
  ok: boolean;
  reasons: string[];
  state: ArchiveState;
}

/**
 * 绑定破损区到色卡批次（整次原子）：
 * 校验全部通过才生成新状态；任一不通过返回原状态，原绑定与工序不变。
 */
export function bindArea(
  state: ArchiveState,
  areaId: string,
  batchId: string,
  qty: number
): BindResult {
  const area = state.areas.find((a) => a.id === areaId);
  const batch = state.batches.find((b) => b.id === batchId);
  const check = checkBinding(state, area, batch, qty);
  if (!check.ok || !area || !batch) {
    const rejectLog: LogEntry = {
      id: uid("log"),
      kind: "reject",
      text: `绑定被拒：${area ? `「${area.name}」` : areaId} → ${
        batch ? batch.code : batchId
      }，${check.reasons.join("；")}`,
      time: nowIso(),
    };
    return {
      ok: false,
      reasons: check.reasons,
      state: { ...state, logs: [rejectLog, ...state.logs].slice(0, 80) },
    };
  }

  const areas = state.areas.map((a) =>
    a.id === areaId
      ? {
          ...a,
          status: "bound" as const,
          batchId,
          plannedQty: qty,
          steps: freshSteps(),
        }
      : a
  );
  const bindLog: LogEntry = {
    id: uid("log"),
    kind: "bind",
    text: `区域「${area.name}」绑定批次 ${batch.code}，计划占用 ${qty}g`,
    time: nowIso(),
  };
  return {
    ok: true,
    reasons: [],
    state: { ...state, areas, logs: [bindLog, ...state.logs].slice(0, 80) },
  };
}
