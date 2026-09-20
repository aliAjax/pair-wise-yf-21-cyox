import type { LogEntry, ColorBatch, Carpet } from "./types";

/**
 * 本地演示数据：无后端，首次打开写入 localStorage，之后以本地数据为准。
 * 场景覆盖：
 *  - B-IND-01 余量告急（余量不足拒绝）
 *  - B-WOL-02 超耗冻结（未开工退回待匹配、在修保留、完工留档）
 *  - B-SIL-03 色差冻结且已有达标复验（演示解冻前置：复核人 ≠ 报告人）
 *  - B-COT-04 复验进行中（复验未结拒绝绑定）
 *  - B-NEW-05 正常可绑定
 */

export const SEED_BATCHES: ColorBatch[] = [
  {
    id: "B-IND-01",
    colorName: "靛蓝",
    hex: "#1d3557",
    dyeType: "植物染",
    origin: "藏毯",
    totalMeters: 30,
    frozen: false,
  },
  {
    id: "B-WOL-02",
    colorName: "石榴红",
    hex: "#9c2b1d",
    dyeType: "植物染",
    origin: "波斯",
    totalMeters: 100,
    frozen: true,
    frozenReason: "施工实际用量超耗",
    frozenAt: "2026-09-15T10:32:00.000Z",
  },
  {
    id: "B-SIL-03",
    colorName: "藤黄",
    hex: "#d9a420",
    dyeType: "矿物染",
    origin: "高加索",
    totalMeters: 60,
    frozen: true,
    frozenReason: "在修记录报告色差超限（ΔE > 2.0）",
    frozenAt: "2026-09-16T08:10:00.000Z",
    inspection: {
      id: "INS-03-02",
      reporter: "阿依古丽",
      reportedAt: "2026-09-17T02:00:00.000Z",
      status: "passed",
      deviation: 0.9,
      reviewer: "周师傅",
      reviewedAt: "2026-09-18T03:20:00.000Z",
      note: "同缸复染小样复核通过，偏差达标",
    },
  },
  {
    id: "B-COT-04",
    colorName: "米白",
    hex: "#efe9dc",
    dyeType: "化学染",
    origin: "安纳托利亚",
    totalMeters: 80,
    frozen: false,
    inspection: {
      id: "INS-04-01",
      reporter: "李然",
      reportedAt: "2026-09-18T07:40:00.000Z",
      status: "open",
      note: "客户反馈米白偏暖，抽检复验中",
    },
  },
  {
    id: "B-NEW-05",
    colorName: "松绿",
    hex: "#0f766e",
    dyeType: "植物染",
    origin: "安纳托利亚",
    totalMeters: 120,
    frozen: false,
  },
];

export const SEED_CARPETS: Carpet[] = [
  {
    id: "CAR-092",
    origin: "波斯",
    era: "约1960s",
    knotDensity: 38,
    material: "羊毛",
    dyeType: "植物染",
    patternName: "石榴藤蔓纹",
    createdAt: "2026-09-08T01:00:00.000Z",
    areas: [
      {
        id: "CAR-092-A1",
        name: "左缘磨损段",
        damage: "边缘纬线磨损，需补线 3.2m",
        needMeters: 3.2,
        status: "done",
        batchId: "B-WOL-02",
        actualMeters: 3.6,
        colorDelta: 0.8,
        reporter: "周师傅",
        completedAt: "2026-09-15T10:32:00.000Z",
      },
      {
        id: "CAR-092-A2",
        name: "右下角补线",
        damage: "毯角缺损待补，预估 6m",
        needMeters: 6,
        status: "idle", // 冻结时未开工，已退回待匹配
      },
      {
        id: "CAR-092-A3",
        name: "中心纹裂隙",
        damage: "裂隙顺纹延伸，预估 4m",
        needMeters: 4,
        status: "in_repair",
        batchId: "B-WOL-02",
      },
    ],
  },
  {
    id: "CAR-117",
    origin: "安纳托利亚",
    era: "约1930s",
    knotDensity: 42,
    material: "羊毛",
    dyeType: "植物染",
    patternName: "双生命树纹",
    createdAt: "2026-09-09T01:00:00.000Z",
    areas: [
      {
        id: "CAR-117-A1",
        name: "中心纹样缺口",
        damage: "中心树冠缺口，需米白补线 6.5m",
        needMeters: 6.5,
        status: "matched",
        batchId: "B-COT-04",
      },
      {
        id: "CAR-117-A2",
        name: "流苏根加固",
        damage: "穗根脱线，预估 2.5m",
        needMeters: 2.5,
        status: "done",
        batchId: "B-IND-01",
        actualMeters: 2.4,
        colorDelta: 1.1,
        reporter: "李然",
        completedAt: "2026-09-14T06:00:00.000Z",
      },
    ],
  },
  {
    id: "CAR-138",
    origin: "藏毯",
    era: "约1970s",
    knotDensity: 50,
    material: "羊毛",
    dyeType: "植物染",
    patternName: "祥云法轮纹",
    createdAt: "2026-09-10T01:00:00.000Z",
    areas: [
      {
        id: "CAR-138-A1",
        name: "右上部褪色",
        damage: "局部褪色需靛蓝补线，预估 12m",
        needMeters: 12,
        status: "in_repair",
        batchId: "B-IND-01",
      },
      {
        id: "CAR-138-A2",
        name: "底部边框磨白",
        damage: "边框磨白，待匹配色卡",
        needMeters: 4,
        status: "idle",
      },
    ],
  },
  {
    id: "CAR-150",
    origin: "高加索",
    era: "约1950s",
    knotDensity: 46,
    material: "丝",
    dyeType: "矿物染",
    patternName: "几何星芒纹",
    createdAt: "2026-09-11T01:00:00.000Z",
    areas: [
      {
        id: "CAR-150-A1",
        name: "星芒纹缺纬",
        damage: "缺纬断经，藤黄补线 10m",
        needMeters: 10,
        status: "done",
        batchId: "B-SIL-03",
        actualMeters: 10,
        colorDelta: 3.2,
        reporter: "阿依古丽",
        completedAt: "2026-09-16T08:10:00.000Z",
      },
      {
        id: "CAR-150-A2",
        name: "左上角补色",
        damage: "角部补色，预估 5m",
        needMeters: 5,
        status: "idle", // 色差冻结时退回待匹配
      },
    ],
  },
];

export const SEED_LOGS: LogEntry[] = [
  {
    id: "LOG-SEED-06",
    at: "2026-09-18T03:20:00.000Z",
    kind: "review",
    message:
      "藤黄批次 B-SIL-03 复验达标（ΔE 0.9，复核人周师傅 ≠ 报告人阿依古丽），等待解冻",
  },
  {
    id: "LOG-SEED-05",
    at: "2026-09-17T02:00:00.000Z",
    kind: "inspect",
    message: "阿依古丽为藤黄批次 B-SIL-03 发起解冻复验（INS-03-02）",
  },
  {
    id: "LOG-SEED-04",
    at: "2026-09-16T08:10:00.000Z",
    kind: "freeze",
    message:
      "CAR-150「星芒纹缺纬」报告色差 ΔE 3.2 超限，藤黄批次 B-SIL-03 冻结，未开工区域退回待匹配，已完工记录留档",
  },
  {
    id: "LOG-SEED-03",
    at: "2026-09-15T10:32:00.000Z",
    kind: "freeze",
    message:
      "CAR-092「左缘磨损段」实际用量 3.6m 超过预估 3.2m，石榴红批次 B-WOL-02 冻结，未开工区域退回待匹配，在修区域维持工序",
  },
  {
    id: "LOG-SEED-02",
    at: "2026-09-14T06:00:00.000Z",
    kind: "complete",
    message: "CAR-117「流苏根加固」完工：实际 2.4m / 预估 2.5m，ΔE 1.1，占用靛蓝批次 B-IND-01",
  },
  {
    id: "LOG-SEED-01",
    at: "2026-09-08T01:00:00.000Z",
    kind: "create",
    message: "档案初始化：载入 5 个色卡补线批次与 4 张地毯档案（本地演示数据）",
  },
];
