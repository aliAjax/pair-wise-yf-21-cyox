import type { Carpet, ColorBatch } from "../types";
import { DELTA_LIMIT } from "./rules";

/**
 * 占用校验层：纯函数聚合所有区域对色卡批次的占用，不触碰 React、不写存储。
 *
 * 占用口径：
 * - 已匹配 / 在修：按预估用量「预留」
 * - 已完工：按施工实际用量「消耗」
 * - 冻结后退回待匹配的区域：绑定解除，自动释放预留
 */

export interface BatchOccupancy {
  batchId: string;
  usedMeters: number; // 已完工实际消耗
  reservedMeters: number; // 未开工 + 在修区域的预估预留
  occupiedMeters: number; // 已用 + 预留
  freeMeters: number; // 可用余量
  boundAreaCount: number;
}

export function occupancyOf(
  batchId: string,
  carpets: Carpet[],
  batch: ColorBatch | undefined
): BatchOccupancy {
  let usedMeters = 0;
  let reservedMeters = 0;
  let boundAreaCount = 0;

  for (const carpet of carpets) {
    for (const area of carpet.areas) {
      if (area.batchId !== batchId) continue;
      boundAreaCount += 1;
      if (area.status === "done" && typeof area.actualMeters === "number") {
        usedMeters += area.actualMeters;
      } else if (area.status === "matched" || area.status === "in_repair") {
        reservedMeters += area.needMeters;
      }
    }
  }

  const totalMeters = batch?.totalMeters ?? 0;
  const occupiedMeters = usedMeters + reservedMeters;
  return {
    batchId,
    usedMeters,
    reservedMeters,
    occupiedMeters,
    freeMeters: totalMeters - occupiedMeters,
    boundAreaCount,
  };
}

export function occupancyMap(
  carpets: Carpet[],
  batches: ColorBatch[]
): Map<string, BatchOccupancy> {
  const map = new Map<string, BatchOccupancy>();
  for (const batch of batches) {
    map.set(batch.id, occupancyOf(batch.id, carpets, batch));
  }
  return map;
}

export type FreezeCause = "overrun" | "color-delta";

/** 施工报告是否触发批次冻结 */
export function shouldFreezeOnReport(
  needMeters: number,
  actualMeters: number,
  colorDelta: number | undefined
): { freeze: boolean; causes: FreezeCause[] } {
  const causes: FreezeCause[] = [];
  if (Number.isFinite(actualMeters) && actualMeters > needMeters) {
    causes.push("overrun");
  }
  if (
    typeof colorDelta === "number" &&
    Number.isFinite(colorDelta) &&
    Math.abs(colorDelta) > DELTA_LIMIT
  ) {
    causes.push("color-delta");
  }
  return { freeze: causes.length > 0, causes };
}

export const FREEZE_CAUSE_TEXT: Record<FreezeCause, string> = {
  overrun: "施工实际用量超耗",
  "color-delta": `在修记录报告色差超限（ΔE > ${DELTA_LIMIT.toFixed(1)}）`,
};
