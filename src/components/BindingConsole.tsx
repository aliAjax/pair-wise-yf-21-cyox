import { useMemo, useState } from "react";
import type { ColorBatch, Carpet } from "../types";
import { occupancyMap } from "../lib/occupancy";
import {
  checkBatchBinding,
  hasOpenInspection,
  isFrozen,
  REJECT_REASON_TEXT,
} from "../lib/rules";
import { fmtM } from "../lib/format";
import { bindArea } from "../store";

/**
 * 绑定控制台：把批次规则与占用校验的结果直接呈现在页面上。
 * 选择区域与批次后实时给出拒绝原因；正式提交时仍由 store 整次事务校验。
 */
export function BindingConsole({
  carpets,
  batches,
}: {
  carpets: Carpet[];
  batches: ColorBatch[];
}) {
  const idleOptions = useMemo(() => {
    const options: {
      carpetId: string;
      areaId: string;
      label: string;
      needMeters: number;
    }[] = [];
    for (const carpet of carpets) {
      for (const area of carpet.areas) {
        if (area.status === "idle") {
          options.push({
            carpetId: carpet.id,
            areaId: area.id,
            label: `${carpet.id}「${area.name}」（${carpet.origin}）`,
            needMeters: area.needMeters,
          });
        }
      }
    }
    return options;
  }, [carpets]);

  const [areaKey, setAreaKey] = useState("");
  const [batchId, setBatchId] = useState("");

  const selected = idleOptions.find(
    (o) => `${o.carpetId}/${o.areaId}` === areaKey
  );
  const selectedBatch = batches.find((b) => b.id === batchId);

  const occupancy = useMemo(
    () => occupancyMap(carpets, batches),
    [carpets, batches]
  );

  const preview = useMemo(() => {
    if (!selected || !selectedBatch) return undefined;
    const occ = occupancy.get(selectedBatch.id);
    const freeMeters = occ?.freeMeters ?? selectedBatch.totalMeters;
    const check = checkBatchBinding(
      selectedBatch,
      freeMeters,
      selected.needMeters
    );
    return { check, freeMeters };
  }, [selected, selectedBatch, occupancy]);

  const canSubmit = !!selected && !!selectedBatch && preview?.check.ok;

  return (
    <section className="panel bind-console">
      <div className="heading">
        <div>
          <p>批次规则 · 占用校验</p>
          <h2>破损区绑定色卡批次</h2>
        </div>
      </div>
      <div className="rule-line">
        破损区只能绑定<strong>未冻结</strong>、<strong>复验已闭环</strong>且<strong>余量足够</strong>的色卡批次；
        余量不足、批次冻结或复验未结时<strong>整次拒绝</strong>，原绑定与工序不变。
      </div>
      {idleOptions.length === 0 ? (
        <p className="empty-hint">当前没有待匹配的破损区。</p>
      ) : (
        <>
          <div className="bind-form">
            <label>
              <span>待匹配破损区</span>
              <select
                value={areaKey}
                onChange={(e) => setAreaKey(e.target.value)}
              >
                <option value="">选择破损区…</option>
                {idleOptions.map((o) => (
                  <option key={o.areaId} value={`${o.carpetId}/${o.areaId}`}>
                    {o.label} · 需 {fmtM(o.needMeters)}m
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>色卡批次</span>
              <select
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
              >
                <option value="">选择批次…</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.colorName} {b.id}
                    {isFrozen(b) ? "（冻结）" : ""}
                    {hasOpenInspection(b) ? "（复验未结）" : ""}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="primary"
              disabled={!canSubmit}
              onClick={() => {
                if (!selected) return;
                bindArea(selected.carpetId, selected.areaId, batchId);
                setAreaKey("");
                setBatchId("");
              }}
            >
              确认绑定并预留
            </button>
          </div>

          {selected && selectedBatch && preview && (
            <div
              className={`bind-preview ${
                preview.check.ok ? "ok" : "bad"
              }`}
            >
              {preview.check.ok ? (
                <p>
                  ✓ 校验通过：{selectedBatch.colorName} 可用余量{" "}
                  {fmtM(preview.freeMeters)}m ≥ 需求 {fmtM(selected.needMeters)}m
                  ，绑定后该用量转为预留。
                </p>
              ) : (
                <div>
                  <p>✗ 整次拒绝，原绑定与工序不变：</p>
                  <ul>
                    {preview.check.reasons.map((reason) => (
                      <li key={reason}>
                        {REJECT_REASON_TEXT[reason]}
                        {reason === "insufficient-margin" &&
                          `（可用 ${fmtM(preview.freeMeters)}m，需 ${fmtM(
                            selected.needMeters
                          )}m）`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
