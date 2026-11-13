/// <reference types="vite/client" />
// window.api 的全局类型：结构由 src/shared/ipc/spec.ts 推导（preload 实现，浏览器调试时由 dev/mockApi 实现）。
import type { TesseraApi } from "@shared/ipc/spec";

declare global {
  interface Window {
    api: TesseraApi;
  }
}

export {};
