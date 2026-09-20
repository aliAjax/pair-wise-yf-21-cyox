// 页面状态层：唯一 state 驱动列表、色卡余量、进度与产地筛选同步
// 业务规则全部委托 domain/batchRules（批次规则）与 domain/occupancy（占用校验）

import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import type {
  ArchiveState,
  AreaStatus,
  Batch,
  Carpet,
  DamagedArea,
  Origin,
} from "./domain/types";
import { AREA_STATUS_LABEL } from "./domain/types";
import {
  DELTA_E_LIMIT,
  completeArea,
  reportColorDifference,
  startArea,
  submitRecheck,
  toggleStep,
} from "./domain/batchRules";
import type { RuleResult } from "./domain/batchRules";
import {
  bindArea,
  consumedQty,
  plannedOccupancy,
  remainingQty,
} from "./domain/occupancy";
import type { BindResult } from "./domain/occupancy";
import { loadState, resetState, saveState } from "./store";
import { fmtQty, fmtTime } from "./utils";

const ORIGINS: Array<Origin | "全部"> = [
  "全部",
  "波斯",
  "安纳托利亚",
  "高加索",
  "藏毯",
];

const STATUS_COLOR: Record<AreaStatus, string> = {
  pending: "#b45309",
  bound: "#1d4ed8",
  repairing: "#0f766e",
  done: "#15803d",
};

interface Notice {
  kind: "ok" | "err";
  text: string;
}

function App() {
  const [state, setState] = useState<ArchiveState>(loadState);
  const [originFilter, setOriginFilter] = useState<Origin | "全部">("全部");
  const [selectedCarpetId, setSelectedCarpetId] = useState<string | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  // 数据存本地：任何状态变化即落盘，刷新保留
  useEffect(() => {
    saveState(state);
  }, [state]);

  const apply = (result: RuleResult | BindResult, okText: string) => {
    setState(result.state);
    if (result.ok) {
      setNotice({ kind: "ok", text: okText });
    } else {
      const reason =
        "reasons" in result
          ? result.reasons.join("；")
          : result.reason ?? "操作被拒绝";
      setNotice({ kind: "err", text: `已整次拒绝：${reason}` });
    }
  };

  // 产地筛选与档案列表同步
  const visibleCarpets = useMemo(
    () =>
      originFilter === "全部"
        ? state.carpets
        : state.carpets.filter((c) => c.origin === originFilter),
    [state.carpets, originFilter]
  );

  const selectedCarpet =
    visibleCarpets.find((c) => c.id === selectedCarpetId) ?? visibleCarpets[0] ?? null;

  const carpetAreas = (carpetId: string) =>
    state.areas.filter((a) => a.carpetId === carpetId);

  const progressOf = (carpetId: string) => {
    const list = carpetAreas(carpetId);
    const done = list.filter((a) => a.status === "done").length;
    return { done, total: list.length, pct: list.length ? (done / list.length) * 100 : 0 };
  };

  // 顶部指标：与状态实时同步
  const metrics = {
    pending: state.areas.filter((a) => a.status === "pending").length,
    frozen: state.batches.filter((b) => b.frozen).length,
    remaining: state.batches.reduce((sum, b) => sum + remainingQty(state, b.id), 0),
    doneRate: state.areas.length
      ? Math.round(
          (state.areas.filter((a) => a.status === "done").length / state.areas.length) * 100
        )
      : 0,
  };

  const doneAreas = state.areas.filter((a) => a.status === "done");

  const exportCsv = () => {
    const header = "档案编号,产地,破损区域,批次,计划用量g,实际用量g,修复前,修复后";
    const rows = doneAreas.map((a) => {
      const carpet = state.carpets.find((c) => c.id === a.carpetId);
      const batch = state.batches.find((b) => b.id === a.batchId);
      const cell = (v: string | number | null) =>
        `"${String(v ?? "").replace(/"/g, '""')}"`;
      return [
        cell(carpet?.code ?? ""),
        cell(carpet?.origin ?? ""),
        cell(a.name),
        cell(batch?.code ?? ""),
        cell(a.plannedQty),
        cell(a.actualQty),
        cell(a.beforeNote),
        cell(a.afterNote),
      ].join(",");
    });
    const csv = "\uFEFF" + [header, ...rows].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "修复留档记录.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62009 · 补线批次复验闭环</p>
        <h1>地毯修复纹样档案</h1>
        <span>
          破损区仅可绑定未冻结且余量足够的色卡批次；超耗或色差超限即冻结批次，
          复验偏差达标（ΔE ≤ {DELTA_E_LIMIT}）且复核人不同于报告人方可解冻。
        </span>
        <div className="hero-actions">
          <button
            onClick={() => {
              setState(resetState());
              setNotice({ kind: "ok", text: "已恢复初始档案数据" });
            }}
          >
            恢复初始数据
          </button>
        </div>
      </section>

      {notice && (
        <div className={`notice ${notice.kind}`} role="status">
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)}>知道了</button>
        </div>
      )}

      <section className="metrics">
        <article>
          <small>待匹配区域</small>
          <strong>{metrics.pending}</strong>
        </article>
        <article>
          <small>冻结批次</small>
          <strong>{metrics.frozen}</strong>
        </article>
        <article>
          <small>色卡余量合计</small>
          <strong>{fmtQty(metrics.remaining)}</strong>
        </article>
        <article>
          <small>完工率</small>
          <strong>{metrics.doneRate}%</strong>
        </article>
      </section>

      <section className="workspace">
        <aside className="panel">
          <h2>产地筛选</h2>
          <div className="chips">
            {ORIGINS.map((o) => (
              <button
                key={o}
                className={originFilter === o ? "chip active" : "chip"}
                onClick={() => setOriginFilter(o)}
              >
                {o}
              </button>
            ))}
          </div>

          <h2 className="mt">档案列表</h2>
          <div className="carpet-list">
            {visibleCarpets.map((c) => {
              const p = progressOf(c.id);
              return (
                <button
                  key={c.id}
                  className={
                    selectedCarpet?.id === c.id ? "carpet-item active" : "carpet-item"
                  }
                  onClick={() => {
                    setSelectedCarpetId(c.id);
                    setSelectedAreaId(null);
                  }}
                >
                  <div className="carpet-item-head">
                    <strong>{c.code}</strong>
                    <span>{c.origin}</span>
                  </div>
                  <small>
                    {c.era} · 结密度{c.knotDensity} · {c.material}
                  </small>
                  <div className="bar">
                    <div className="fill" style={{ width: `${p.pct}%` }} />
                  </div>
                  <small>
                    进度 {p.done}/{p.total} 区域完工
                  </small>
                </button>
              );
            })}
            {visibleCarpets.length === 0 && <p className="empty">该产地暂无档案</p>}
          </div>
        </aside>

        {selectedCarpet && (
          <section className="panel detail">
            <div className="heading">
              <div>
                <p>
                  {selectedCarpet.origin} · {selectedCarpet.era} · 结密度
                  {selectedCarpet.knotDensity} · {selectedCarpet.material} ·{" "}
                  {selectedCarpet.dyeType}
                </p>
                <h2>{selectedCarpet.code} 纹样局部标记图</h2>
              </div>
            </div>

            <PatternMap
              carpet={selectedCarpet}
              areas={carpetAreas(selectedCarpet.id)}
              selectedAreaId={selectedAreaId}
              onSelect={setSelectedAreaId}
            />

            <div className="area-list">
              {carpetAreas(selectedCarpet.id).map((area) => (
                <AreaCard
                  key={area.id}
                  area={area}
                  state={state}
                  selected={selectedAreaId === area.id}
                  onSelect={() => setSelectedAreaId(area.id)}
                  onBind={(batchId, qty) =>
                    apply(
                      bindArea(state, area.id, batchId, qty),
                      `区域「${area.name}」已绑定批次`
                    )
                  }
                  onStart={() =>
                    apply(startArea(state, area.id), `区域「${area.name}」已开工`)
                  }
                  onToggleStep={(stepKey) =>
                    setState(toggleStep(state, area.id, stepKey))
                  }
                  onComplete={(actual, note) =>
                    apply(
                      completeArea(state, area.id, actual, note),
                      `区域「${area.name}」完工留档`
                    )
                  }
                  onReport={(reporter, deviation) =>
                    apply(
                      reportColorDifference(state, area.id, reporter, deviation),
                      `区域「${area.name}」色差报告已登记`
                    )
                  }
                />
              ))}
            </div>
          </section>
        )}
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>材料色卡</p>
            <h2>补线批次余量与复验</h2>
          </div>
        </div>
        <div className="batch-grid">
          {state.batches.map((b) => (
            <BatchCard
              key={b.id}
              batch={b}
              state={state}
              onRecheck={(input) =>
                apply(
                  submitRecheck(state, b.id, input),
                  `批次 ${b.code} 复验通过，已解冻`
                )
              }
            />
          ))}
        </div>
      </section>

      <section className="workspace bottom">
        <section className="panel">
          <div className="heading">
            <div>
              <p>修复前后记录</p>
              <h2>完工留档</h2>
            </div>
            <button onClick={exportCsv} disabled={doneAreas.length === 0}>
              导出CSV
            </button>
          </div>
          <div className="records">
            {doneAreas.map((a, i) => {
              const carpet = state.carpets.find((c) => c.id === a.carpetId);
              const batch = state.batches.find((b) => b.id === a.batchId);
              return (
                <article key={a.id}>
                  <b>{String(i + 1).padStart(2, "0")}</b>
                  <div>
                    <h3>
                      {carpet?.code} · {a.name}
                    </h3>
                    <p>
                      批次 {batch?.code}（{batch?.colorName}） · 计划 {fmtQty(a.plannedQty)} →
                      实际 {fmtQty(a.actualQty ?? 0)}
                    </p>
                    <p>修复前：{a.beforeNote}</p>
                    <p>修复后：{a.afterNote}</p>
                  </div>
                </article>
              );
            })}
            {doneAreas.length === 0 && <p className="empty">暂无完工留档</p>}
          </div>
        </section>

        <section className="panel">
          <div className="heading">
            <div>
              <p>闭环留痕</p>
              <h2>操作日志</h2>
            </div>
          </div>
          <ul className="log-list">
            {state.logs.map((log) => (
              <li key={log.id} className={`log-${log.kind}`}>
                <span>{fmtTime(log.time)}</span>
                <p>{log.text}</p>
              </li>
            ))}
          </ul>
        </section>
      </section>
    </main>
  );
}

/** 纹样局部标记图：破损区按状态着色，点击标记选中 */
function PatternMap(props: {
  carpet: Carpet;
  areas: DamagedArea[];
  selectedAreaId: string | null;
  onSelect: (areaId: string) => void;
}) {
  const { carpet, areas, selectedAreaId, onSelect } = props;
  return (
    <div>
      <svg
        className="pattern-map"
        viewBox="0 0 100 62"
        role="img"
        aria-label={`${carpet.code} 纹样局部标记图`}
      >
        <rect x="1" y="1" width="98" height="60" rx="2" fill={carpet.tone} opacity="0.1" />
        <rect
          x="5"
          y="5"
          width="90"
          height="52"
          rx="1.5"
          fill="none"
          stroke={carpet.tone}
          strokeWidth="1"
          strokeDasharray="3 2"
          opacity="0.7"
        />
        <polygon
          points="50,13 73,31 50,49 27,31"
          fill="none"
          stroke={carpet.tone}
          strokeWidth="0.9"
          opacity="0.55"
        />
        <polygon points="50,22 62,31 50,40 38,31" fill={carpet.tone} opacity="0.18" />
        {areas.map((a, i) => {
          const selected = a.id === selectedAreaId;
          const color = STATUS_COLOR[a.status];
          return (
            <g
              key={a.id}
              transform={`translate(${a.pos.x}, ${(a.pos.y * 62) / 100})`}
              onClick={() => onSelect(a.id)}
              style={{ cursor: "pointer" }}
            >
              <title>{`${a.name} · ${AREA_STATUS_LABEL[a.status]}`}</title>
              {selected && (
                <circle r="5.6" fill="none" stroke={color} strokeWidth="0.8" opacity="0.65" />
              )}
              <circle r={selected ? 3.7 : 3} fill={color} stroke="#ffffff" strokeWidth="0.8" />
              <text y="1.1" textAnchor="middle" fontSize="2.6" fill="#ffffff" fontWeight="700">
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="chips">
        {(Object.keys(AREA_STATUS_LABEL) as AreaStatus[]).map((s) => (
          <span key={s} className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <i
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: STATUS_COLOR[s],
                display: "inline-block",
              }}
            />
            {AREA_STATUS_LABEL[s]}
          </span>
        ))}
      </div>
    </div>
  );
}

/** 破损区卡片：绑定批次 / 开工 / 工序 / 完工登记 / 色差报告 / 留档 */
function AreaCard(props: {
  area: DamagedArea;
  state: ArchiveState;
  selected: boolean;
  onSelect: () => void;
  onBind: (batchId: string, qty: number) => void;
  onStart: () => void;
  onToggleStep: (stepKey: string) => void;
  onComplete: (actualQty: number, note: string) => void;
  onReport: (reporter: string, deviation: number) => void;
}) {
  const { area, state, selected } = props;
  const batch = state.batches.find((b) => b.id === area.batchId) ?? null;
  const [bindBatchId, setBindBatchId] = useState("");
  const [bindQty, setBindQty] = useState("10");
  const [actualQty, setActualQty] = useState("");
  const [afterNote, setAfterNote] = useState("");
  const [reporter, setReporter] = useState("");
  const [deviation, setDeviation] = useState("");

  const doneSteps = area.steps.filter((s) => s.done).length;

  return (
    <article
      className={selected ? "area-card selected" : "area-card"}
      onClick={props.onSelect}
    >
      <div className="area-head">
        <div>
          <h3>{area.name}</h3>
          <p className="muted">修复前：{area.beforeNote}</p>
        </div>
        <span className="badge" style={{ background: STATUS_COLOR[area.status] }}>
          {AREA_STATUS_LABEL[area.status]}
        </span>
      </div>

      {batch && (
        <p className="muted" style={{ margin: 0 }}>
          批次 {batch.code}（{batch.colorName}） · 计划占用 {fmtQty(area.plannedQty)}
          {area.actualQty !== null && ` · 实际 ${fmtQty(area.actualQty)}`}
          {batch.frozen && area.status !== "done" && (
            <em className="frozen-text">批次已冻结</em>
          )}
        </p>
      )}

      {area.status !== "pending" && area.status !== "done" && (
        <div className="steps">
          {area.steps.map((s) => (
            <button
              key={s.key}
              className={s.done ? "step done" : "step"}
              disabled={area.status !== "repairing"}
              onClick={(e) => {
                e.stopPropagation();
                props.onToggleStep(s.key);
              }}
            >
              {s.done ? "✓ " : ""}
              {s.label}
            </button>
          ))}
          <small className="muted">
            工序 {doneSteps}/{area.steps.length}
          </small>
        </div>
      )}

      {area.status === "pending" && (
        <div className="inline-form" onClick={(e) => e.stopPropagation()}>
          <select value={bindBatchId} onChange={(e) => setBindBatchId(e.target.value)}>
            <option value="">选择色卡批次</option>
            {state.batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} {b.colorName} · 余 {fmtQty(remainingQty(state, b.id))}
                {b.frozen ? " · 已冻结" : ""}
                {b.recheckOpen ? " · 复验未结" : ""}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            value={bindQty}
            onChange={(e) => setBindQty(e.target.value)}
            placeholder="计划用量g"
          />
          <button
            className="primary"
            onClick={() => props.onBind(bindBatchId, Number(bindQty))}
          >
            绑定批次
          </button>
        </div>
      )}

      {area.status === "bound" && (
        <div className="inline-form" onClick={(e) => e.stopPropagation()}>
          <button className="primary" onClick={props.onStart}>
            开工
          </button>
        </div>
      )}

      {area.status === "repairing" && (
        <div className="repair-forms" onClick={(e) => e.stopPropagation()}>
          <div className="inline-form">
            <input
              type="number"
              min="0"
              step="0.5"
              value={actualQty}
              onChange={(e) => setActualQty(e.target.value)}
              placeholder={`实际用量g（计划${area.plannedQty}，超耗将冻结批次）`}
            />
            <input
              value={afterNote}
              onChange={(e) => setAfterNote(e.target.value)}
              placeholder="修复后记录"
            />
            <button
              className="primary"
              onClick={() => props.onComplete(Number(actualQty), afterNote)}
            >
              完工登记
            </button>
          </div>
          <div className="inline-form">
            <input
              value={reporter}
              onChange={(e) => setReporter(e.target.value)}
              placeholder="报告人"
            />
            <input
              type="number"
              min="0"
              step="0.1"
              value={deviation}
              onChange={(e) => setDeviation(e.target.value)}
              placeholder={`色差ΔE（>${DELTA_E_LIMIT} 即冻结批次）`}
            />
            <button onClick={() => props.onReport(reporter, Number(deviation))}>
              报告色差
            </button>
          </div>
        </div>
      )}

      {area.status === "done" && <p className="muted archived">留档：{area.afterNote}</p>}
    </article>
  );
}

/** 色卡批次卡：余量构成、冻结原因、复验表单与复验历史 */
function BatchCard(props: {
  batch: Batch;
  state: ArchiveState;
  onRecheck: (input: { reporter: string; reviewer: string; deviation: number }) => void;
}) {
  const { batch, state } = props;
  const [reporter, setReporter] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [deviation, setDeviation] = useState("");

  const planned = plannedOccupancy(state, batch.id);
  const consumed = consumedQty(state, batch.id);
  const rest = remainingQty(state, batch.id);
  const pct = (v: number) =>
    `${Math.max(0, Math.min(100, (v / batch.totalStock) * 100))}%`;

  const usedBy = state.areas
    .filter((a) => a.batchId === batch.id)
    .map((a) => {
      const carpet = state.carpets.find((c) => c.id === a.carpetId);
      return `${carpet?.code ?? ""}·${a.name}（${AREA_STATUS_LABEL[a.status]}）`;
    });

  return (
    <article className={batch.frozen ? "batch-card frozen" : "batch-card"}>
      <div className="batch-head">
        <span className="swatch" style={{ background: batch.hex }} />
        <div>
          <h3>
            {batch.code} · {batch.colorName}
          </h3>
          <small className="muted">入库总量 {fmtQty(batch.totalStock)}</small>
        </div>
        {batch.frozen && <span className="badge danger">已冻结</span>}
        {batch.recheckOpen && <span className="badge warn">复验未结</span>}
      </div>

      <div>
        <div className="stock-bar">
          <div className="seg consumed" style={{ width: pct(consumed) }} />
          <div className="seg planned" style={{ width: pct(planned) }} />
          <div className="seg rest" style={{ width: pct(rest) }} />
        </div>
        <div className="stock-legend">
          <span>已用 {fmtQty(consumed)}</span>
          <span>占用 {fmtQty(planned)}</span>
          <strong>余量 {fmtQty(rest)}</strong>
        </div>
      </div>

      {usedBy.length > 0 && (
        <small className="muted">占用区域：{usedBy.join("、")}</small>
      )}

      {batch.frozen && (
        <div className="freeze-box" onClick={(e) => e.stopPropagation()}>
          <p className="frozen-text">冻结原因：{batch.freezeReason}</p>
          <div className="inline-form">
            <input
              value={reporter}
              onChange={(e) => setReporter(e.target.value)}
              placeholder="报告人"
            />
            <input
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
              placeholder="复核人（须≠报告人）"
            />
            <input
              type="number"
              min="0"
              step="0.1"
              value={deviation}
              onChange={(e) => setDeviation(e.target.value)}
              placeholder={`复验ΔE（≤${DELTA_E_LIMIT} 达标）`}
            />
            <button
              className="primary"
              onClick={() =>
                props.onRecheck({ reporter, reviewer, deviation: Number(deviation) })
              }
            >
              提交复验
            </button>
          </div>
        </div>
      )}

      {batch.rechecks.length > 0 && (
        <ul className="mini-list">
          {batch.rechecks.map((r) => (
            <li key={r.id} className={r.passed ? "pass" : "over"}>
              复验 ΔE {r.deviation} · 报告 {r.reporter} / 复核 {r.reviewer} ·{" "}
              {r.passed ? "通过，已解冻" : r.note} · {fmtTime(r.time)}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export default App;
