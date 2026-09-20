import type { ColorBatch, Inspection } from "../types";

/**
 * 批次规则层：只关心单个批次本身的规则，不读取其他批次或区域。
 * - 色差偏差（ΔE）达标线
 * - 冻结判定
 * - 复验闭环判定（未结 / 达标可解冻）
 */

export const DELTA_LIMIT = 2.0;
export const DELTA_LIMIT_LABEL = "ΔE ≤ 2.0";

export function isFrozen(batch: ColorBatch): boolean {
  return batch.frozen;
}

/** 复验未结：存在复验单且尚未被达标复核（解冻后会清空复验单） */
export function hasOpenInspection(batch: ColorBatch): boolean {
  return batch.inspection !== undefined;
}

export function deviationPassed(deviation: number): boolean {
  return Number.isFinite(deviation) && Math.abs(deviation) <= DELTA_LIMIT;
}

export type RejectReason =
  | "frozen"
  | "inspection-open"
  | "insufficient-margin";

/**
 * 破损区绑定前置校验（批次维度）。
 * 余量由占用校验层算出余量后传入，本层不负责聚合计算。
 */
export function checkBatchBinding(
  batch: ColorBatch,
  freeMeters: number,
  needMeters: number
): { ok: boolean; reasons: RejectReason[] } {
  const reasons: RejectReason[] = [];
  if (isFrozen(batch)) reasons.push("frozen");
  if (hasOpenInspection(batch)) reasons.push("inspection-open");
  if (freeMeters < needMeters || needMeters <= 0)
    reasons.push("insufficient-margin");
  return { ok: reasons.length === 0, reasons };
}

export const REJECT_REASON_TEXT: Record<RejectReason, string> = {
  frozen: "批次已冻结",
  "inspection-open": "复验未闭环",
  "insufficient-margin": "余量不足",
};

/**
 * 解冻前置规则：复验偏差达标，且复核人必须不同于报告人。
 * 仅给出判定结果，状态变更由 store 层执行。
 */
export function canUnfreeze(batch: ColorBatch): {
  ok: boolean;
  inspection: Inspection | undefined;
  reason?: "not-frozen" | "no-inspection" | "not-passed";
} {
  if (!batch.frozen) return { ok: false, inspection: undefined, reason: "not-frozen" };
  const inspection = batch.inspection;
  if (!inspection) return { ok: false, inspection: undefined, reason: "no-inspection" };
  if (inspection.status !== "passed")
    return { ok: false, inspection, reason: "not-passed" };
  // passed 状态在 store 层即保证 deviation 达标且复核人 ≠ 报告人，这里再防御一次
  if (
    inspection.reviewer === undefined ||
    inspection.reviewer.trim() === "" ||
    inspection.reviewer === inspection.reporter ||
    inspection.deviation === undefined ||
    !deviationPassed(inspection.deviation)
  ) {
    return { ok: false, inspection, reason: "not-passed" };
  }
  return { ok: true, inspection };
}

/** 复核人不同于报告人，且偏差达标，复验方可判定通过 */
export function validateReview(
  inspection: Inspection,
  reviewer: string,
  deviation: number
): { ok: boolean; reason?: "same-reviewer" | "deviation" } {
  if (reviewer.trim() === "" || reviewer.trim() === inspection.reporter.trim()) {
    return { ok: false, reason: "same-reviewer" };
  }
  if (!deviationPassed(deviation)) {
    return { ok: false, reason: "deviation" };
  }
  return { ok: true };
}
