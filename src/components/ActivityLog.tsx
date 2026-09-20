import { fmtDateTime } from "../lib/format";
import type { LogEntry } from "../types";

const KIND_LABEL: Record<LogEntry["kind"], string> = {
  bind: "绑定",
  reject: "拒绝",
  start: "开工",
  complete: "完工",
  freeze: "冻结",
  inspect: "复验",
  review: "复核",
  unfreeze: "解冻",
  create: "建档",
};

export function ActivityLog({ logs }: { logs: LogEntry[] }) {
  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>复验闭环台账</p>
          <h2>批次与工序操作记录</h2>
        </div>
      </div>
      <ol className="log-list">
        {logs.map((log) => (
          <li key={log.id} className={`log-kind-${log.kind}`}>
            <span className="log-tag">{KIND_LABEL[log.kind]}</span>
            <span className="log-text">{log.message}</span>
            <time>{fmtDateTime(log.at)}</time>
          </li>
        ))}
      </ol>
    </section>
  );
}
