/** 数值与时间格式化（纯展示工具） */

export function fmtM(n: number): string {
  return (Math.round(n * 100) / 100).toLocaleString("zh-CN", {
    maximumFractionDigits: 2,
  });
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
