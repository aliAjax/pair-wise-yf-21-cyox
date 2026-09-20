import { useSyncExternalStore } from "react";
import type {
  Carpet,
  ColorBatch,
  DyeType,
  LogEntry,
  LogKind,
  Material,
  Origin,
  PersistShape,
  RepairArea,
} from "./types";
import { SEED_BATCHES, SEED_CARPETS, SEED_LOGS } from "./seed";
import {
  canUnfreeze,
  checkBatchBinding,
  validateReview,
} from "./lib/rules";
import {
  FREEZE_CAUSE_TEXT,
  occupancyMap,
  shouldFreezeOnReport,
} from "./lib/occupancy";

/**
 * 页面状态层：唯一的可变状态入口。
 * 规则判定在 lib/rules，占用聚合在 lib/occupancy；此处只编排原子事务。
 * 数据全部存浏览器 localStorage，刷新后保留；无后端、无新增依赖。
 */

const STORAGE_KEY = "carpet-repair-archive-v1";

export interface Notice {
  tone: "ok" | "error";
  text: string;
}

interface State extends PersistShape {
  notice?: Notice;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function seedState(): State {
  return {
    version: 1,
    batches: clone(SEED_BATCHES),
    carpets: clone(SEED_CARPETS),
    logs: clone(SEED_LOGS),
  };
}

function loadState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistShape;
      if (parsed && parsed.version === 1 && Array.isArray(parsed.batches)) {
        return { ...parsed, notice: undefined };
      }
    }
  } catch {
    // 本地数据损坏时回退演示数据
  }
  return seedState();
}

let state: State = loadState();
const listeners = new Set<() => void>();

function persist() {
  const { notice: _notice, ...snapshot } = state;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // 存储不可用时仍保持内存态可用
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

function pushLog(state: State, kind: LogKind, message: string) {
  state.logs.unshift({ id: makeId("LOG"), at: nowIso(), kind, message });
  if (state.logs.length > 120) state.logs.length = 120;
}

function commit(next: State) {
  state = next;
  persist();
  emit();
}

function succeed(message: string, kind: LogKind, logMessage = message) {
  const next = clone(state);
  next.notice = { tone: "ok", text: message };
  pushLog(next, kind, logMessage);
  commit(next);
}

function fail(message: string, context?: { log?: string }) {
  const next = clone(state);
  next.notice = { tone: "error", text: message };
  if (context?.log) pushLog(next, "reject", context.log);
  commit(next);
}

export function clearNotice() {
  if (!state.notice) return;
  const next = clone(state);
  next.notice = undefined;
  commit(next);
}

/* ----------------------------- 派生数据（只读） ----------------------------- */

export function getSnapshot(): State {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useArchive(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** 重置为本地演示数据（仍写入 localStorage） */
export function resetDemo() {
  state = seedState();
  state.notice = { tone: "ok", text: "已重置为本地演示数据" };
  persist();
  emit();
}

/* ------------------------------ 查找辅助（可变副本） ------------------------------ */

function findCarpet(next: State, carpetId: string): Carpet | undefined {
  return next.carpets.find((c) => c.id === carpetId);
}

function findArea(
  carpet: Carpet,
  areaId: string
): RepairArea | undefined {
  return carpet.areas.find((a) => a.id === areaId);
}

function findBatch(next: State, batchId: string): ColorBatch | undefined {
  return next.batches.find((b) => b.id === batchId);
}

/* --------------------------------- 绑定事务 --------------------------------- */

/**
 * 破损区绑定色卡批次：
 * 仅当批次未冻结、复验已闭环、余量足够时成立；任一不满足整次拒绝，
 * 原绑定与工序保持不变。绑定成功后按预估用量占用预留配额。
 */
export function bindArea(carpetId: string, areaId: string, batchId: string) {
  const current = state;
  const batch = current.batches.find((b) => b.id === batchId);
  const carpet = current.carpets.find((c) => c.id === carpetId);
  const area = carpet?.areas.find((a) => a.id === areaId);

  if (!batch || !carpet || !area) {
    fail("绑定失败：未找到对应区域或批次");
    return;
  }
  if (area.status !== "idle") {
    fail(`绑定失败：「${area.name}」已绑定批次或已开工，工序不可改动`);
    return;
  }

  // 占用口径：模拟该区域绑定后，全部其它区域占用不变，再叠加本区域预估
  const occupancy = occupancyMap(current.carpets, current.batches).get(batchId);
  const freeMeters = occupancy?.freeMeters ?? batch.totalMeters;
  const check = checkBatchBinding(batch, freeMeters, area.needMeters);

  if (!check.ok) {
    const labels = check.reasons.map(
      (reason) =>
        ({
          frozen: "批次冻结",
          "inspection-open": "复验未结",
          "insufficient-margin": `余量不足（可用 ${freeMeters.toFixed(
            2
          )}m，需 ${area.needMeters.toFixed(2)}m）`,
        })[reason]
    );
    const text = `绑定被整次拒绝：${labels.join("、")}。原绑定与工序不变`;
    fail(text, {
      log: `拒绝绑定 CAR-${carpet.id.slice(-3)}「${area.name}」→ ${batch.colorName} ${
        batch.id
      }：${labels.join("、")}`,
    });
    return;
  }

  const next = clone(current);
  const targetArea = findArea(findCarpet(next, carpetId)!, areaId)!;
  targetArea.batchId = batchId;
  targetArea.status = "matched";
  const message = `已绑定：${carpet.id}「${area.name}」→ ${batch.colorName}（${batch.id}），预留 ${area.needMeters.toFixed(
    2
  )}m`;
  next.notice = { tone: "ok", text: message };
  pushLog(next, "bind", message);
  commit(next);
}

/* --------------------------------- 开工事务 --------------------------------- */

export function startWork(carpetId: string, areaId: string) {
  const area = state.carpets
    .find((c) => c.id === carpetId)
    ?.areas.find((a) => a.id === areaId);
  if (!area) {
    fail("开工失败：未找到破损区域");
    return;
  }
  if (area.status !== "matched") {
    fail(`开工失败：「${area.name}」当前为${area.status}，仅未开工区域可开始施工`);
    return;
  }
  const next = clone(state);
  const targetArea = findArea(findCarpet(next, carpetId)!, areaId)!;
  targetArea.status = "in_repair";
  const message = `已开工：${carpetId}「${area.name}」工序进入在修，预留配额不变`;
  next.notice = { tone: "ok", text: message };
  pushLog(next, "start", message);
  commit(next);
}

/* --------------------------------- 完工报告 --------------------------------- */

export interface CompleteInput {
  actualMeters: number;
  colorDelta: number;
  reporter: string;
}

/**
 * 在修记录提交完工：
 * - 正常：记录留档，预估预留转为实际消耗，色卡余量随之变化；
 * - 实际用量超耗，或色差 ΔE > 2.0：批次立即冻结；
 *   未开工(matched)区域退回待匹配并释放预留；在修/完工记录保留。
 * - 整个完工报告本身始终留档（含超限记录）。
 */
export function completeArea(
  carpetId: string,
  areaId: string,
  input: CompleteInput
) {
  const carpet = state.carpets.find((c) => c.id === carpetId);
  const area = carpet?.areas.find((a) => a.id === areaId);
  if (!carpet || !area) {
    fail("完工登记失败：未找到破损区域");
    return;
  }
  if (area.status !== "in_repair") {
    fail(`完工登记失败：「${area.name}」不在在修状态`);
    return;
  }
  if (!Number.isFinite(input.actualMeters) || input.actualMeters <= 0) {
    fail("完工登记失败：请填写有效的实际用量");
    return;
  }
  if (input.reporter.trim() === "") {
    fail("完工登记失败：请填写施工报告人");
    return;
  }
  const batchId = area.batchId;
  if (!batchId) {
    fail("完工登记失败：该区域未绑定色卡批次");
    return;
  }

  const { freeze, causes } = shouldFreezeOnReport(
    area.needMeters,
    input.actualMeters,
    input.colorDelta
  );

  const next = clone(state);
  const targetArea = findArea(findCarpet(next, carpetId)!, areaId)!;
  targetArea.status = "done";
  targetArea.actualMeters = input.actualMeters;
  targetArea.colorDelta = input.colorDelta;
  targetArea.reporter = input.reporter.trim();
  targetArea.completedAt = nowIso();

  const archiveMsg = `${carpetId}「${area.name}」完工留档：实际 ${input.actualMeters}m / 预估 ${area.needMeters}m，ΔE ${input.colorDelta}，报告人 ${input.reporter.trim()}`;
  pushLog(next, "complete", archiveMsg);

  if (freeze) {
    const batch = findBatch(next, batchId)!;
    batch.frozen = true;
    batch.frozenAt = nowIso();
    batch.frozenReason = causes.map((c) => FREEZE_CAUSE_TEXT[c]).join("；");

    // 级联：该批次下未开工区域退回待匹配，释放预留与绑定；在修/完工保留
    const released: string[] = [];
    for (const c of next.carpets) {
      for (const a of c.areas) {
        if (a.batchId === batchId && a.status === "matched") {
          released.push(`${c.id}「${a.name}」`);
          a.batchId = undefined;
          a.status = "idle";
        }
      }
    }

    const causeText = causes.map((c) => FREEZE_CAUSE_TEXT[c]).join("、");
    const msg =
      `${batch.colorName}批次 ${batchId} 立即冻结（${causeText}）。` +
      (released.length
        ? `未开工区域退回待匹配：${released.join("、")}；`
        : "无未开工区域需退回；") +
      "在修与已完工记录保留留档";
    next.notice = { tone: "error", text: msg };
    pushLog(next, "freeze", msg);
  } else {
    next.notice = { tone: "ok", text: archiveMsg };
  }
  commit(next);
}

/* --------------------------------- 复验事务 --------------------------------- */

/**
 * 发起复验：批次进入「复验未结」，冻结/正常批次均可发起；
 * 未结期间不可绑定新区域（绑定规则层拦截）。
 */
export function openInspection(batchId: string, reporter: string, note: string) {
  const batch = state.batches.find((b) => b.id === batchId);
  if (!batch) {
    fail("发起复验失败：未找到批次");
    return;
  }
  if (reporter.trim() === "") {
    fail("发起复验失败：请填写报告人");
    return;
  }
  if (batch.inspection && batch.inspection.status !== "passed") {
    fail("发起复验失败：该批次已有未闭环复验单");
    return;
  }

  const next = clone(state);
  const target = findBatch(next, batchId)!;
  target.inspection = {
    id: makeId("INS"),
    reporter: reporter.trim(),
    reportedAt: nowIso(),
    status: "open",
    note: note.trim() || undefined,
  };
  const message = `${target.colorName}批次 ${batchId} 已发起复验（报告人 ${reporter.trim()}），闭环前暂停绑定`;
  next.notice = { tone: "ok", text: message };
  pushLog(next, "inspect", message);
  commit(next);
}

/**
 * 复核复验：
 * - 复核人必须不同于报告人；
 * - 偏差达标（ΔE ≤ 2.0）：复验闭环。冻结批次转为「达标待解冻」，正常批次直接恢复；
 * - 任一不满足：复验判为不合格（仍未结），批次维持原状。
 */
export function reviewInspection(
  batchId: string,
  reviewer: string,
  deviation: number
) {
  const batch = state.batches.find((b) => b.id === batchId);
  if (!batch || !batch.inspection) {
    fail("复核失败：该批次没有待复核的复验单");
    return;
  }
  if (!Number.isFinite(deviation)) {
    fail("复核失败：请填写复验色差偏差 ΔE");
    return;
  }

  const inspection = batch.inspection;
  const verdict = validateReview(inspection, reviewer, deviation);
  const reviewerName = reviewer.trim();

  if (!verdict.ok) {
    if (verdict.reason === "same-reviewer") {
      const text = "复核被拒绝：复核人必须不同于报告人，复验仍未闭环";
      fail(text, {
        log: `${batch.colorName}批次 ${batchId} 复核失败：复核人${
          reviewerName === "" ? "未填写" : `「${reviewerName}」`
        }与报告人「${inspection.reporter}」相同`,
      });
      return;
    }
    // 偏差不达标 → 落为不合格，复验未结
    const next = clone(state);
    const target = findBatch(next, batchId)!;
    const targetInspection = target.inspection!;
    targetInspection.status = "failed";
    targetInspection.reviewer = reviewerName;
    targetInspection.reviewedAt = nowIso();
    targetInspection.deviation = deviation;
    const message = `${target.colorName}批次 ${batchId} 复验不合格：ΔE ${deviation} 超出 ${
      2.0
    }，批次${target.frozen ? "维持冻结" : "不得作为解冻依据"}，复验仍未结`;
    next.notice = { tone: "error", text: message };
    pushLog(next, "review", message);
    commit(next);
    return;
  }

  const next = clone(state);
  const target = findBatch(next, batchId)!;
  const targetInspection = target.inspection!;
  targetInspection.status = "passed";
  targetInspection.deviation = deviation;
  targetInspection.reviewer = reviewerName;
  targetInspection.reviewedAt = nowIso();

  let message: string;
  if (target.frozen) {
    message =
      `${target.colorName}批次 ${batchId} 复验达标（ΔE ${deviation}，复核人 ${reviewerName} ≠ 报告人 ${inspection.reporter}），` +
      "状态为达标待解冻，确认后即可解冻";
  } else {
    // 正常批次的抽检复验：达标即闭环
    target.inspection = undefined;
    message = `${target.colorName}批次 ${batchId} 抽检复验闭环（ΔE ${deviation}，复核人 ${reviewerName} ≠ 报告人 ${inspection.reporter}），恢复绑定`;
  }
  next.notice = { tone: "ok", text: message };
  pushLog(next, "review", message);
  commit(next);
}

/**
 * 解冻：仅在复验达标（偏差达标 + 复核人 ≠ 报告人）且批次冻结时可执行。
 * 解冻后清空复验单、冻结信息，批次恢复绑定。
 */
export function unfreezeBatch(batchId: string) {
  const batch = state.batches.find((b) => b.id === batchId);
  if (!batch) {
    fail("解冻失败：未找到批次");
    return;
  }
  const verdict = canUnfreeze(batch);
  if (!verdict.ok) {
    const reasonText = {
      "not-frozen": "批次未处于冻结状态",
      "no-inspection": "缺少复验单，须先发起复验",
      "not-passed": "复验尚未达标，且复核人须不同于报告人",
    }[verdict.reason ?? "not-passed"];
    fail(`解冻被拒绝：${reasonText}`);
    return;
  }

  const next = clone(state);
  const target = findBatch(next, batchId)!;
  target.frozen = false;
  target.frozenReason = undefined;
  target.frozenAt = undefined;
  target.inspection = undefined;
  const message = `${target.colorName}批次 ${batchId} 已解冻，复验闭环完成，恢复绑定与占用`;
  next.notice = { tone: "ok", text: message };
  pushLog(next, "unfreeze", message);
  commit(next);
}

/* --------------------------------- 新增档案 --------------------------------- */

export interface NewCarpetInput {
  origin: Origin;
  material: Material;
  dyeType: DyeType;
  era: string;
  knotDensity: number;
  patternName: string;
  areaName: string;
  damage: string;
  needMeters: number;
}

export function addCarpet(input: NewCarpetInput) {
  if (input.era.trim() === "" || input.patternName.trim() === "") {
    fail("建档失败：请填写年代与纹样名称");
    return;
  }
  if (!Number.isFinite(input.knotDensity) || input.knotDensity <= 0) {
    fail("建档失败：请填写有效的结密度");
    return;
  }
  if (input.areaName.trim() === "" || !Number.isFinite(input.needMeters) || input.needMeters <= 0) {
    fail("建档失败：请填写首个破损区域名称与有效预估用量");
    return;
  }

  const next = clone(state);
  const seq = next.carpets.length + 141;
  const id = `CAR-${seq}`;
  const carpet: Carpet = {
    id,
    origin: input.origin,
    era: input.era.trim(),
    knotDensity: input.knotDensity,
    material: input.material,
    dyeType: input.dyeType,
    patternName: input.patternName.trim(),
    createdAt: nowIso(),
    areas: [
      {
        id: `${id}-A1`,
        name: input.areaName.trim(),
        damage: input.damage.trim() || "待补充破损描述",
        needMeters: input.needMeters,
        status: "idle",
      },
    ],
  };
  next.carpets.push(carpet);
  const message = `新档案 ${id} 已建档：${input.origin}·${carpet.patternName}，破损区「${carpet.areas[0].name}」待匹配`;
  next.notice = { tone: "ok", text: message };
  pushLog(next, "create", message);
  commit(next);
}
