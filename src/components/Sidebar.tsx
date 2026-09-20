import { useMemo, useState } from "react";
import type { DyeType, Material, Origin } from "../types";
import { addCarpet, resetDemo, type NewCarpetInput } from "../store";

const ORIGINS: Origin[] = ["波斯", "安纳托利亚", "高加索", "藏毯"];
const MATERIALS: Material[] = ["羊毛", "丝", "棉", "混纺"];
const DYES: DyeType[] = ["植物染", "矿物染", "化学染"];

export function Sidebar({
  activeOrigin,
  onFilter,
  originCounts,
}: {
  activeOrigin: Origin | "全部";
  onFilter: (origin: Origin | "全部") => void;
  originCounts: Record<string, number>;
}) {
  const [form, setForm] = useState<NewCarpetInput>({
    origin: "波斯",
    material: "羊毛",
    dyeType: "植物染",
    era: "",
    knotDensity: 40,
    patternName: "",
    areaName: "",
    damage: "",
    needMeters: 5,
  });

  const set = <K extends keyof NewCarpetInput>(key: K, value: NewCarpetInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const rules = useMemo(
    () => [
      "仅未冻结、复验已结且余量足够的批次可绑定",
      "超耗或色差 ΔE > 2.0：批次立即冻结",
      "冻结后未开工退回待匹配，在修/完工留档",
      "复验达标且复核人 ≠ 报告人方可解冻",
    ],
    []
  );

  return (
    <aside className="sidebar">
      <section className="panel">
        <h2>产地筛选</h2>
        <div className="chips">
          <button
            className={activeOrigin === "全部" ? "chip-active" : ""}
            onClick={() => onFilter("全部")}
          >
            全部
          </button>
          {ORIGINS.map((origin) => (
            <button
              key={origin}
              className={activeOrigin === origin ? "chip-active" : ""}
              onClick={() => onFilter(origin)}
            >
              {origin}
              <em>{originCounts[origin] ?? 0}</em>
            </button>
          ))}
        </div>
        <ul className="rule-list">
          {rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>新增档案</p>
            <h2>建档与首个破损区</h2>
          </div>
        </div>
        <div className="create-form">
          <label>
            <span>地毯产地</span>
            <select value={form.origin} onChange={(e) => set("origin", e.target.value as Origin)}>
              {ORIGINS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <label>
            <span>年代</span>
            <input value={form.era} onChange={(e) => set("era", e.target.value)} placeholder="如 约1960s" />
          </label>
          <label>
            <span>结密度（结/英寸）</span>
            <input
              type="number"
              min="1"
              value={form.knotDensity}
              onChange={(e) => set("knotDensity", Number(e.target.value))}
            />
          </label>
          <label>
            <span>材质</span>
            <select value={form.material} onChange={(e) => set("material", e.target.value as Material)}>
              {MATERIALS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label>
            <span>染色类型</span>
            <select value={form.dyeType} onChange={(e) => set("dyeType", e.target.value as DyeType)}>
              {DYES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label>
            <span>纹样名称</span>
            <input value={form.patternName} onChange={(e) => set("patternName", e.target.value)} placeholder="如 石榴藤蔓纹" />
          </label>
          <label>
            <span>首个破损区域</span>
            <input value={form.areaName} onChange={(e) => set("areaName", e.target.value)} placeholder="如 左缘磨损段" />
          </label>
          <label>
            <span>预估补线用量 m</span>
            <input
              type="number"
              step="0.1"
              min="0"
              value={form.needMeters}
              onChange={(e) => set("needMeters", Number(e.target.value))}
            />
          </label>
          <label className="wide">
            <span>破损描述</span>
            <input value={form.damage} onChange={(e) => set("damage", e.target.value)} placeholder="破损位置与程度" />
          </label>
        </div>
        <button className="primary full-btn" onClick={() => addCarpet(form)}>
          保存档案（破损区进入待匹配）
        </button>
      </section>

      <button className="ghost-btn" onClick={resetDemo}>
        重置本地演示数据
      </button>
    </aside>
  );
}
