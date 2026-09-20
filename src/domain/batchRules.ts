// 批次规则：冻结 / 解冻 / 复验闭环，以及触发冻结的施工规则
// 纯函数，不碰页面状态；所有函数返回新状态，由页面层决定是否采纳。

import type {
  ArchiveState,
  Batch,
  ColorReport,
  DamagedArea,
  LogEntry,
  RecheckRecord,
} from "./types";
import { nowIso, uid } from "../utils";

/** 色差超限阈值 ΔE */
export const DELTA_E_LIMIT = 1.5;

/** 标准修复工序模板 */
export const STEP_TEMPLATE: Array<{ key: string; label: string }> = [
  { key: "clean", label: "清理基布" },
  { key: "match", label: "配色校对" },
  { key: "weave", label: "补线织补" },
  { key: "shape", label: "整形定型" },
  { key: "accept", label: "验收拍照" },
];

export function freshSteps() {
  return STEP_TEMPLATE.map((s) => ({ ...s, done: false }));
}

export interface RuleResult {
  ok: boolean;
  reason: string | null;
  state: ArchiveState;
}

function fail(state: ArchiveState, reason: string): RuleResult {
  return { ok: false, reason, state };
}

function pushLog(state: ArchiveState, kind: LogEntry["kind"], text: string): ArchiveState {
  const entry: LogEntry = { id: uid("log"), kind, text, time: nowIso() };
  return { ...state, logs: [entry, ...state.logs].slice(0, 80) };
}

function batchOf(state: ArchiveState, batchId: string): Batch | undefined {
  return state.batches.find((b) => b.id === batchId);
}

function areaOf(state: ArchiveState, areaId: string): DamagedArea | undefined {
  return state.areas.find((a) => a.id === areaId);
}

/**
 * 冻结批次并级联处理：
 * - 未开工（已绑定）区域退回待匹配，释放占用、重置工序；
 * - 在修区域保留（色差报告来源）；
 * - 已完成记录留档不动。
 */
export function freezeBatch(
  state: ArchiveState,
  batchId: string,
  reason: string
): ArchiveState {
  const batch = batchOf(state, batchId);
  if (!batch || batch.frozen) return state;

  const returned = state.areas.filter(
    (a) => a.batchId === batchId && a.status === "bound"
  );
  const areas = state.areas.map((a) =>
    a.batchId === batchId && a.status === "bound"
      ? { ...a, status: "pending" as const, batchId: null, plannedQty: 0, steps: freshSteps() }
      : a
  );
  const batches = state.batches.map((b) =>
    b.id === batchId
      ? { ...b, frozen: true, freezeReason: reason, recheckOpen: true }
      : b
  );

  let next: ArchiveState = { ...state, areas, batches };
  next = pushLog(next, "freeze", `批次 ${batch.code} 冻结：${reason}`);
  for (const a of returned) {
    next = pushLog(next, "freeze", `区域「${a.name}」未开工，退回待匹配`);
  }
  return next;
}

/** 施工实际用量超耗判定 */
export function isOverConsumed(actualQty: number, plannedQty: number): boolean {
  return actualQty > plannedQty;
}

/** 复验判定：偏差达标且复核人不同于报告人 */
export function evaluateRecheck(input: {
  reporter: string;
  reviewer: string;
  deviation: number;
}): { passed: boolean; reason: string | null } {
  const reporter = input.reporter.trim();
  const reviewer = input.reviewer.trim();
  if (!reporter || !reviewer) {
    return { passed: false, reason: "报告人与复核人均需填写" };
  }
  if (input.deviation > DELTA_E_LIMIT) {
    return {
      passed: false,
      reason: `复验偏差 ΔE ${input.deviation} 超出限值 ${DELTA_E_LIMIT}`,
    };
  }
  if (reporter === reviewer) {
    return { passed: false, reason: "复核人须不同于报告人" };
  }
  return { passed: true, reason: null };
}

/** 提交复验：达标且双人复核才解冻；否则维持冻结并留痕 */
export function submitRecheck(
  state: ArchiveState,
  batchId: string,
  input: { reporter: string; reviewer: string; deviation: number }
): RuleResult {
  const batch = batchOf(state, batchId);
  if (!batch) return fail(state, "批次不存在");
  if (!batch.frozen) return fail(state, "批次未冻结，无需复验");
  if (!Number.isFinite(input.deviation) || input.deviation < 0) {
    return fail(state, "复验偏差需为不小于 0 的数值");
  }

  const { passed, reason } = evaluateRecheck(input);
  const record: RecheckRecord = {
    id: uid("rck"),
    reporter: input.reporter.trim(),
    reviewer: input.reviewer.trim(),
    deviation: input.deviation,
    passed,
    note: passed ? "复验通过，批次解冻" : reason ?? "复验未通过",
    time: nowIso(),
  };

  let next: ArchiveState = {
    ...state,
    batches: state.batches.map((b) =>
      b.id === batchId
        ? {
            ...b,
            rechecks: [record, ...b.rechecks],
            ...(passed
              ? { frozen: false, freezeReason: null, recheckOpen: false }
              : {}),
          }
        : b
    ),
  };

  next = pushLog(
    next,
    passed ? "unfreeze" : "reject",
    passed
      ? `批次 ${batch.code} 复验通过（ΔE ${input.deviation}，复核 ${record.reviewer}），解除冻结`
      : `批次 ${batch.code} 复验未通过：${record.note}`
  );
  return { ok: passed, reason: passed ? null : record.note, state: next };
}

/** 开工：已绑定 → 在修 */
export function startArea(state: ArchiveState, areaId: string): RuleResult {
  const area = areaOf(state, areaId);
  if (!area) return fail(state, "破损区不存在");
  if (area.status !== "bound" || !area.batchId) {
    return fail(state, "仅待开工区域可开工");
  }
  const batch = batchOf(state, area.batchId);
  if (!batch || batch.frozen) return fail(state, "绑定批次已冻结，无法开工");

  const areas = state.areas.map((a) =>
    a.id === areaId ? { ...a, status: "repairing" as const } : a
  );
  let next: ArchiveState = { ...state, areas };
  next = pushLog(next, "start", `区域「${area.name}」开工，批次 ${batch.code}`);
  return { ok: true, reason: null, state: next };
}

/** 推进/回退工序（仅在修区域） */
export function toggleStep(
  state: ArchiveState,
  areaId: string,
  stepKey: string
): ArchiveState {
  return {
    ...state,
    areas: state.areas.map((a) =>
      a.id === areaId && a.status === "repairing"
        ? {
            ...a,
            steps: a.steps.map((s) =>
              s.key === stepKey ? { ...s, done: !s.done } : s
            ),
          }
        : a
    ),
  };
}

/**
 * 完工登记实际用量：
 * - 工序须全部完成；
 * - 实际用量超耗 → 批次立即冻结（本记录已完成，留档不受影响）。
 */
export function completeArea(
  state: ArchiveState,
  areaId: string,
  actualQty: number,
  afterNote: string
): RuleResult {
  const area = areaOf(state, areaId);
  if (!area) return fail(state, "破损区不存在");
  if (area.status !== "repairing" || !area.batchId) {
    return fail(state, "仅在修区域可完工登记");
  }
  if (!Number.isFinite(actualQty) || actualQty <= 0) {
    return fail(state, "实际用量需为大于 0 的数值");
  }
  if (area.steps.some((s) => !s.done)) {
    return fail(state, "工序未全部完成，不能完工登记");
  }

  const batch = batchOf(state, area.batchId);
  const over = isOverConsumed(actualQty, area.plannedQty);
  const areas = state.areas.map((a) =>
    a.id === areaId
      ? {
          ...a,
          status: "done" as const,
          actualQty,
          afterNote: afterNote.trim() || "修复完成",
        }
      : a
  );

  let next: ArchiveState = { ...state, areas };
  next = pushLog(
    next,
    "done",
    `区域「${area.name}」完工留档，实际用量 ${actualQty}g（计划 ${area.plannedQty}g）`
  );
  if (over && batch) {
    next = freezeBatch(
      next,
      batch.id,
      `施工实际用量 ${actualQty}g 超耗（计划 ${area.plannedQty}g，区域「${area.name}」）`
    );
  }
  return { ok: true, reason: null, state: next };
}

/**
 * 在修记录报告色差：
 * 任一在修记录色差超限 → 批次立即冻结，复验挂起。
 */
export function reportColorDifference(
  state: ArchiveState,
  areaId: string,
  reporter: string,
  deviation: number
): RuleResult {
  const area = areaOf(state, areaId);
  if (!area) return fail(state, "破损区不存在");
  if (area.status !== "repairing" || !area.batchId) {
    return fail(state, "仅在修区域可报告色差");
  }
  if (!reporter.trim()) return fail(state, "请填写报告人");
  if (!Number.isFinite(deviation) || deviation < 0) {
    return fail(state, "色差偏差需为不小于 0 的数值");
  }

  const batch = batchOf(state, area.batchId);
  const overLimit = deviation > DELTA_E_LIMIT;
  const report: ColorReport = {
    id: uid("rpt"),
    areaId,
    batchId: area.batchId,
    reporter: reporter.trim(),
    deviation,
    overLimit,
    time: nowIso(),
  };

  let next: ArchiveState = { ...state, reports: [report, ...state.reports] };
  next = pushLog(
    next,
    "report",
    `区域「${area.name}」报告色差 ΔE ${deviation}（报告人 ${report.reporter}）${
      overLimit ? "，超出限值" : "，未超限"
    }`
  );
  if (overLimit && batch) {
    next = freezeBatch(
      next,
      batch.id,
      `在修记录「${area.name}」色差 ΔE ${deviation} 超限（限值 ${DELTA_E_LIMIT}）`
    );
  }
  return { ok: true, reason: null, state: next };
}
