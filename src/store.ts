// 本地持久化：整棵状态树存 localStorage，刷新保留

import type { ArchiveState } from "./domain/types";
import { seedState } from "./data/seed";

const STORAGE_KEY = "hxyfront-62009-archive-v1";

export function loadState(): ArchiveState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw) as ArchiveState;
    if (
      !parsed ||
      !Array.isArray(parsed.carpets) ||
      !Array.isArray(parsed.areas) ||
      !Array.isArray(parsed.batches) ||
      !Array.isArray(parsed.reports) ||
      !Array.isArray(parsed.logs)
    ) {
      return seedState();
    }
    return parsed;
  } catch {
    return seedState();
  }
}

export function saveState(state: ArchiveState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储不可用时静默降级为内存态
  }
}

export function resetState(): ArchiveState {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  return seedState();
}
