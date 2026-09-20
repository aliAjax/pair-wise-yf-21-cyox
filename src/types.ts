// 地毯修复档案 · 补线批次复验闭环 —— 领域模型

export type Origin = "波斯" | "安纳托利亚" | "高加索" | "藏毯";
export type Material = "羊毛" | "丝" | "棉" | "混纺";
export type DyeType = "植物染" | "矿物染" | "化学染";

/** 破损区域工序状态：待匹配 → 已匹配(未开工) → 在修 → 已完工留档 */
export type AreaStatus = "idle" | "matched" | "in_repair" | "done";

/** 复验单状态：进行中 / 复核不合格(未结) / 达标待解冻(冻结批次) */
export type InspectionStatus = "open" | "failed" | "passed";

export interface Inspection {
  id: string;
  reporter: string;
  reportedAt: string;
  status: InspectionStatus;
  deviation?: number;
  reviewer?: string;
  reviewedAt?: string;
  note?: string;
}

export interface ColorBatch {
  id: string;
  colorName: string;
  hex: string;
  dyeType: DyeType;
  origin: Origin;
  totalMeters: number;
  frozen: boolean;
  frozenReason?: string;
  frozenAt?: string;
  /** 存在且 status !== undefined 即代表复验未闭环；达标解冻后清空 */
  inspection?: Inspection;
}

export interface RepairArea {
  id: string;
  name: string;
  damage: string;
  /** 预估补线用量（绑定后即作为预留配额，单位 m） */
  needMeters: number;
  status: AreaStatus;
  batchId?: string;
  actualMeters?: number;
  colorDelta?: number;
  reporter?: string;
  completedAt?: string;
}

export interface Carpet {
  id: string;
  origin: Origin;
  era: string;
  knotDensity: number;
  material: Material;
  dyeType: DyeType;
  patternName: string;
  areas: RepairArea[];
  createdAt: string;
}

export type LogKind =
  | "bind"
  | "reject"
  | "start"
  | "complete"
  | "freeze"
  | "inspect"
  | "review"
  | "unfreeze"
  | "create";

export interface LogEntry {
  id: string;
  at: string;
  kind: LogKind;
  message: string;
}

export interface PersistShape {
  version: 1;
  batches: ColorBatch[];
  carpets: Carpet[];
  logs: LogEntry[];
}
