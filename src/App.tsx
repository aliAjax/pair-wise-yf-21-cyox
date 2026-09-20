import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import type { Origin } from "./types";
import { clearNotice, resetDemo, useArchive } from "./store";
import { occupancyMap } from "./lib/occupancy";
import { hasOpenInspection, isFrozen } from "./lib/rules";
import { Sidebar } from "./components/Sidebar";
import { BatchCard } from "./components/BatchCard";
import { BindingConsole } from "./components/BindingConsole";
import { CarpetCard } from "./components/CarpetCard";
import { ActivityLog } from "./components/ActivityLog";

function Notice() {
  const { notice } = useArchive();
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(clearNotice, 5200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  if (!notice) return null;
  return (
    <div className={`notice notice-${notice.tone}`} role="status">
      {notice.text}
    </div>
  );
}

function Metrics() {
  const { carpets, batches } = useArchive();
  const allAreas = carpets.flatMap((c) => c.areas);
  const waiting = allAreas.filter((a) => a.status === "idle").length;
  const done = allAreas.filter((a) => a.status === "done").length;
  const completion = allAreas.length
    ? Math.round((done / allAreas.length) * 100)
    : 0;
  const frozenCount = batches.filter(isFrozen).length;
  const inspecting = batches.filter(hasOpenInspection).length;

  const items: { label: string; value: string; hint: string }[] = [
    { label: "待匹配破损区", value: String(waiting), hint: "等待绑定色卡批次" },
    { label: "纹样档案", value: String(carpets.length), hint: "本地地毯档案" },
    { label: "色卡批次", value: String(batches.length), hint: `冻结 ${frozenCount} · 复验中 ${inspecting}` },
    { label: "工序完工率", value: `${completion}%`, hint: `已完工留档 ${done} 处` },
  ];

  return (
    <section className="metrics">
      {items.map((item) => (
        <article key={item.label}>
          <small>{item.label}</small>
          <strong>{item.value}</strong>
          <span>{item.hint}</span>
        </article>
      ))}
    </section>
  );
}

function App() {
  const { batches, carpets, logs } = useArchive();
  const [filter, setFilter] = useState<Origin | "全部">("全部");

  // 色卡余量：占用校验层统一聚合，批次卡片与绑定预览共用同一份结果
  const occupancy = useMemo(
    () => occupancyMap(carpets, batches),
    [carpets, batches]
  );

  // 列表、进度与产地筛选同步：筛选只改变档案列表派生，不改动底层数据
  const originCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const carpet of carpets) {
      counts[carpet.origin] = (counts[carpet.origin] ?? 0) + 1;
    }
    return counts;
  }, [carpets]);

  const visibleCarpets = useMemo(
    () =>
      (filter === "全部"
        ? carpets
        : carpets.filter((c) => c.origin === filter)
      ).slice(),
    [carpets, filter]
  );

  return (
    <main className="app">
      <Notice />

      <section className="hero">
        <p>hxyfront-62009 · 补线批次复验闭环 · 本地存储 localStorage</p>
        <h1>地毯修复纹样档案</h1>
        <span>
          破损区绑定色卡批次需同时满足未冻结、复验已闭环、余量足够；超耗或色差超限立即冻结批次，
          未开工退回待匹配、在修与完工记录留档；复验偏差达标且复核人不同于报告人方可解冻。
          列表、色卡余量、工序进度与产地筛选实时同步，刷新后保留，无后端、无新增依赖。
        </span>
        <div className="hero-actions">
          <button className="primary" onClick={resetDemo}>重置演示数据</button>
        </div>
      </section>

      <Metrics />

      <div className="workspace-two">
        <Sidebar
          activeOrigin={filter}
          onFilter={setFilter}
          originCounts={originCounts}
        />

        <div className="main-col">
          <BindingConsole carpets={carpets} batches={batches} />

          <section className="panel">
            <div className="heading">
              <div>
                <p>材料色卡 · 批次状态</p>
                <h2>补线批次余量与复验</h2>
              </div>
            </div>
            <div className="batch-grid">
              {batches.map((batch) => (
                <BatchCard
                  key={batch.id}
                  batch={batch}
                  occupancy={occupancy.get(batch.id)!}
                />
              ))}
            </div>
          </section>

          <section className="panel list-panel">
            <div className="heading">
              <div>
                <p>工序进度 · 修复前后记录</p>
                <h2>
                  档案列表
                  {filter !== "全部" && <span className="filter-tag">产地：{filter}</span>}
                </h2>
              </div>
            </div>
            <div className="carpet-list">
              {visibleCarpets.length === 0 ? (
                <p className="empty-hint">该产地暂无档案。</p>
              ) : (
                visibleCarpets.map((carpet, i) => (
                  <CarpetCard
                    key={carpet.id}
                    carpet={carpet}
                    batches={batches}
                    index={i}
                  />
                ))
              )}
            </div>
            <p className="sync-hint">
              列表筛选仅影响展示；平均工序进度按破损区阶段（待匹配/未开工/在修 25%，已完工 100%）派生，
              绑定、冻结与留档后自动重算。
            </p>
          </section>

          <ActivityLog logs={logs} />
        </div>
      </div>
    </main>
  );
}

export default App;
