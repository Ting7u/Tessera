// 渲染进程调用主进程的唯一入口。组件里不要直接写 window.api，统一 import { api }。
// window.api 由 preload 注入；浏览器单独调试时由 main.tsx 在加载界面前装上 dev/mockApi。
import type { TesseraApi } from "@shared/ipc/spec";

if (!window.api) {
  throw new Error(
    "window.api 不存在：preload 没有加载，或浏览器调试模式没有先安装模拟 API（见 main.tsx）",
  );
}

export const api: TesseraApi = window.api;
export type { TesseraApi };
