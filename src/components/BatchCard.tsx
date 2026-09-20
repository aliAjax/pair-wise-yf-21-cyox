import { useState } from "react";
import type { ColorBatch } from "../types";
import type { BatchOccupancy } from "../lib/occupancy";
import {
  DELTA_LIMIT,
  hasOpenInspection,
  isFrozen,
} from "../lib/rules";
import { fmtDateTime, fmtM } from "../lib/format";
import {
  openInspection,
  reviewInspection,
  unfreezeBatch,
} from "../store";
import { Badge, InspectionBadge, OccupancyBar } from "./ui";

function InspectionPanel({ batch }: { batch: ColorBatch }) {
  const inspection = batch.inspection;
  const [reporter, setReporter] = useState("");
  const [note, setNote] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [deviation, setDeviation] = useState("");

  if (!inspection) {
    return (
      <div className="inspection-box">
        <p className="inspection-title">常规抽检复验（闭环前暂停绑定）</p>
        <div className="inspection-grid">
          <label>
            <span>报告人</span>
            <input
              value={reporter}
              onChange={(e) => setReporter(e.target.value)}
              placeholder="报告人姓名"
            />
          </label>
          <label className="wide">
            <span>复验说明</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="抽检原因（可选）"
            />
          </label>
        </div>
        <button
          className="small-btn"
          onClick={() => openInspection(batch.id, reporter, note)}
        >
          发起复验
        </button>
      </div>
    );
  }

  const reviewDisabled = inspection.status === "passed";
  return (
    <div className="inspection-box">
      <div className="inspection-head">
        <p className="inspection-title">
          复验单 {inspection.id} · <InspectionBadge status={inspection.status} />
        </p>
        <small>报告人 {inspection.reporter} · {fmtDateTime(inspection.reportedAt)}</small>
      </div>
      {inspection.note && <p className="inspection-note">{inspection.note}</p>}

      {inspection.status === "passed" ? (
        <div className="review-result ok">
          复核人 {inspection.reviewer} · ΔE {inspection.deviation} · {fmtDateTime(inspection.reviewedAt ?? "")}
          {inspection.note ? `（${inspection.note}）` : ""}
        </div>
      ) : (
        <>
          {inspection.status === "failed" && (
            <div className="review-result bad">
              上次复核：{inspection.reviewer} · ΔE {inspection.deviation}，偏差超限，复验未结，可重新复核
            </div>
          )}
          <div className="inspection-grid">
            <label>
              <span>复核人（须不同于报告人）</span>
              <input
                value={reviewer}
                onChange={(e) => setReviewer(e.target.value)}
                placeholder={`不得为 ${inspection.reporter}`}
              />
            </label>
            <label>
              <span>复验偏差 ΔE（达标线 ≤ {DELTA_LIMIT.toFixed(1)}）</span>
              <input
                type="number"
                step="0.1"
                min="0"
                value={deviation}
                onChange={(e) => setDeviation(e.target.value)}
                placeholder="如 1.2"
              />
            </label>
          </div>
          <button
            className="small-btn"
            disabled={reviewDisabled}
            onClick={() =>
              reviewInspection(batch.id, reviewer, Number(deviation))
            }
          >
            提交复核
          </button>
        </>
      )}
    </div>
  );
}

export function BatchCard({
  batch,
  occupancy,
}: {
  batch: ColorBatch;
  occupancy: BatchOccupancy;
}) {
  const frozen = isFrozen(batch);
  const pending = hasOpenInspection(batch);
  const tight = !frozen && occupancy.freeMeters < 8;

  return (
    <article className={`batch-card ${frozen ? "is-frozen" : ""} ${pending ? "is-pending" : ""}`}>
      <header className="batch-head">
        <div className="batch-color">
          <span className="swatch" style={{ background: batch.hex }} />
          <div>
            <h3>
              {batch.colorName} <code>{batch.id}</code>
            </h3>
            <p>
              {batch.dyeType} · {batch.origin}适配
            </p>
          </div>
        </div>
        <div className="batch-badges">
          {frozen ? (
            <Badge tone="danger">批次冻结</Badge>
          ) : pending ? (
            <Badge tone="warn">复验未结</Badge>
          ) : (
            <Badge tone="ok">可绑定</Badge>
          )}
          {batch.inspection && <InspectionBadge status={batch.inspection.status} />}
        </div>
      </header>

      <div className="batch-margin">
        <div className="margin-line">
          <span>总量 {fmtM(batch.totalMeters)}m</span>
          <span className={tight && !frozen ? "tight" : ""}>
            可用余量 <strong>{fmtM(occupancy.freeMeters)}m</strong>
          </span>
        </div>
        <OccupancyBar
          used={occupancy.usedMeters}
          reserved={occupancy.reservedMeters}
          total={batch.totalMeters}
        />
        <div className="margin-detail">
          <span><i className="dot dot-used" />已耗 {fmtM(occupancy.usedMeters)}m</span>
          <span><i className="dot dot-reserved" />预留 {fmtM(occupancy.reservedMeters)}m</span>
          <span>绑定区域 {occupancy.boundAreaCount} 处</span>
        </div>
      </div>

      {frozen && (
        <p className="freeze-reason">
          冻结原因：{batch.frozenReason}
          {batch.frozenAt ? `（${fmtDateTime(batch.frozenAt)}）` : ""}
        </p>
      )}

      {frozen && batch.inspection?.status === "passed" && (
        <button className="primary small-btn" onClick={() => unfreezeBatch(batch.id)}>
          复验达标，确认解冻
        </button>
      )}

      <InspectionPanel batch={batch} />
    </article>
  );
}
