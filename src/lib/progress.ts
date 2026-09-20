import type { AreaStatus, Carpet } from "../types";

/**
 * 页面状态辅助：工序进度（纯派生）。
 * 待匹配 / 已匹配 / 在修 各计 25%，已完工计 100%，一张地毯取其破损区均值。
 */

export const AREA_STAGE_WEIGHT: Record<AreaStatus, number> = {
  idle: 0.25,
  matched: 0.25,
  in_repair: 0.25,
  done: 1,
};

export const AREA_STATUS_LABEL: Record<AreaStatus, string> = {
  idle: "待匹配",
  matched: "未开工",
  in_repair: "在修",
  done: "已完工留档",
};

export function carpetProgress(carpet: Carpet): number {
  if (carpet.areas.length === 0) return 0;
  const sum = carpet.areas.reduce(
    (acc, area) => acc + AREA_STAGE_WEIGHT[area.status],
    0
  );
  return Math.round((sum / carpet.areas.length) * 100);
}
