import { useState } from "react";
import type { Carpet, ColorBatch, RepairArea } from "../types";
import { carpetProgress } from "../lib/progress";
import { DELTA_LIMIT, isFrozen } from "../lib/rules";
import { fmtDateTime, fmtM } from "../lib/format";
import { completeArea, startWork } from "../store";
import { AreaStatusBadge, Badge, PatternMark } from "./ui";

function CompleteForm({
  carpet,
  area,
  batchFrozen,
}: {
  carpet: Carpet;
  area: RepairArea;
  batchFrozen: boolean;
}) {
  const [actual, setActual] = useState(String(area.needMeters));
  const [delta, setDelta] = useState("0");
  const [reporter, setReporter] = useState("");

  return (
    <div className="complete-form">
      <div className="complete-grid">
        <label>
          <span>实际用量 m（预估 {fmtM(area.needMeters)}m）</span>
          <input
            type="number"
            step="0.1"
            min="0"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
          />
        </label>
        <label>
          <span>色差 ΔE（&gt; {DELTA_LIMIT.toFixed(1)} 即超限）</span>
          <input
            type="number"
            step="0.1"
            min="0"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
          />
        </label>
        <label>
          <span>报告人</span>
          <input
            value={reporter}
            onChange={(e) => setReporter(e.target.value)}
            placeholder="施工记录人"
          />
        </label>
      </div>
      <button
        className="small-btn primary"
        onClick={() =>
          completeArea(carpet.id, area.id, {
            actualMeters: Number(actual),
            colorDelta: Number(delta),
            reporter,
          })
        }
      >
        提交完工报告
      </button>
      {batchFrozen && (
        <small className="frozen-hint">
          批次已冻结：本记录仍可提交留档；超耗或色差超限将追加冻结记录，未开工区域已退回待匹配。
        </small>
      )}
    </div>
  );
}

function AreaRow({
  carpet,
  area,
  batches,
  index,
}: {
  carpet: Carpet;
  area: RepairArea;
  batches: ColorBatch[];
  index: number;
}) {
  const batch = batches.find((b) => b.id === area.batchId);
  const batchFrozen = batch ? isFrozen(batch) : false;

  return (
    <div className="area-row">
      <div className="area-main">
        <div className="area-title">
          <span className="area-index">{String(index + 1).padStart(2, "0")}</span>
          <strong>{area.name}</strong>
          <AreaStatusBadge status={area.status} />
          {batchFrozen && area.status === "in_repair" && (
            <Badge tone="danger">绑定批次已冻结</Badge>
          )}
          {area.status === "matched" && batch && (
            <Badge tone="info">未开工 · 已预留</Badge>
          )}
        </div>
        <p className="area-damage">{area.damage}</p>
        <p className="area-meta">
          预估 {fmtM(area.needMeters)}m
          {batch ? (
            <>
              {" "}· 色卡 <span className="swatch-inline" style={{ background: batch.hex }} />
              {batch.colorName} <code>{batch.id}</code>
            </>
          ) : (
            " · 未绑定色卡"
          )}
          {area.status === "done" && area.actualMeters !== undefined && (
            <>
              {" "}· 实际 <strong>{fmtM(area.actualMeters)}m</strong>
              {area.actualMeters > area.needMeters && <Badge tone="danger">超耗</Badge>}
              {" "}· ΔE <strong className={Math.abs(area.colorDelta ?? 0) > DELTA_LIMIT ? "delta-bad" : ""}>
                {area.colorDelta}
              </strong>
              {Math.abs(area.colorDelta ?? 0) > DELTA_LIMIT && <Badge tone="danger">色差超限</Badge>}
              {" "}· 报告人 {area.reporter} · 留档于 {fmtDateTime(area.completedAt ?? "")}
            </>
          )}
        </p>

        {area.status === "matched" && (
          <button
            className="small-btn"
            onClick={() => startWork(carpet.id, area.id)}
          >
            开始施工（未开工 → 在修）
          </button>
        )}
        {area.status === "in_repair" && (
          <CompleteForm carpet={carpet} area={area} batchFrozen={batchFrozen} />
        )}
      </div>
    </div>
  );
}

export function CarpetCard({
  carpet,
  batches,
  index,
}: {
  carpet: Carpet;
  batches: ColorBatch[];
  index: number;
}) {
  const progress = carpetProgress(carpet);
  const statuses = carpet.areas.map((a) => a.status);

  return (
    <article className="panel carpet-card">
      <div className="carpet-layout">
        <PatternMark seedIndex={index} statuses={statuses} />
        <div className="carpet-body">
          <div className="carpet-head">
            <div>
              <p className="carpet-id">
                <code>{carpet.id}</code> · {carpet.origin}
              </p>
              <h3>{carpet.patternName}</h3>
            </div>
            <div className="progress-box">
              <div className="progress-ring">
                <svg viewBox="0 0 42 42">
                  <circle cx="21" cy="21" r="17" className="ring-bg" />
                  <circle
                    cx="21"
                    cy="21"
                    r="17"
                    className="ring-fg"
                    style={{
                      strokeDasharray: `${(progress / 100) * 106.8} 106.8`,
                    }}
                  />
                </svg>
                <span>{progress}%</span>
              </div>
            </div>
          </div>
          <p className="carpet-fields">
            {carpet.era} · 结密度 {carpet.knotDensity} 结/英寸 · {carpet.material} · {carpet.dyeType}
          </p>
          <div className="area-list">
            {carpet.areas.map((area, i) => (
              <AreaRow
                key={area.id}
                carpet={carpet}
                area={area}
                batches={batches}
                index={i}
              />
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
