// 领域模型：地毯档案、破损区、色卡批次、复验记录

export type Origin = "波斯" | "安纳托利亚" | "高加索" | "藏毯";

/** 破损区状态：待匹配 → 已绑定(未开工) → 在修 → 已完成 */
export type AreaStatus = "pending" | "bound" | "repairing" | "done";

export const AREA_STATUS_LABEL: Record<AreaStatus, string> = {
  pending: "待匹配",
  bound: "待开工",
  repairing: "在修",
  done: "已完成",
};

/** 复验记录：偏差达标且复核人≠报告人才算通过 */
export interface RecheckRecord {
  id: string;
  reporter: string; // 报告人
  reviewer: string; // 复核人
  deviation: number; // 复验偏差 ΔE
  passed: boolean;
  note: string;
  time: string;
}

/** 补线色卡批次 */
export interface Batch {
  id: string;
  code: string; // 批次号
  colorName: string;
  hex: string;
  totalStock: number; // 入库总量（克）
  frozen: boolean;
  freezeReason: string | null;
  recheckOpen: boolean; // 复验未结
  rechecks: RecheckRecord[];
}

/** 在修记录的色差报告 */
export interface ColorReport {
  id: string;
  areaId: string;
  batchId: string;
  reporter: string;
  deviation: number;
  overLimit: boolean;
  time: string;
}

export interface RepairStep {
  key: string;
  label: string;
  done: boolean;
}

/** 破损区域 */
export interface DamagedArea {
  id: string;
  carpetId: string;
  name: string;
  pos: { x: number; y: number }; // 纹样标记图坐标（百分比）
  plannedQty: number; // 计划占用（克）
  actualQty: number | null; // 施工实际用量（克）
  batchId: string | null;
  status: AreaStatus;
  steps: RepairStep[];
  beforeNote: string; // 修复前记录
  afterNote: string | null; // 修复后记录（留档）
}

/** 地毯纹样档案 */
export interface Carpet {
  id: string;
  code: string;
  origin: Origin;
  era: string;
  knotDensity: number; // 结密度
  material: string;
  dyeType: string;
  tone: string; // 纹样底色
}

export type LogKind =
  | "bind"
  | "start"
  | "done"
  | "report"
  | "freeze"
  | "unfreeze"
  | "reject";

export interface LogEntry {
  id: string;
  kind: LogKind;
  text: string;
  time: string;
}

/** 全量页面状态（唯一数据源，整体落盘 localStorage） */
export interface ArchiveState {
  carpets: Carpet[];
  areas: DamagedArea[];
  batches: Batch[];
  reports: ColorReport[];
  logs: LogEntry[];
}
