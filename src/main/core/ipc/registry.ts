// 主进程这边的 IPC 注册工具：所有 ipcMain.handle / on / webContents.send 都走这里，
// 通道名和参数、返回值类型由 shared/ipc/contract.ts 约束。业务模块里不要直接用 ipcMain。
import { BrowserWindow, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from "electron";
import type {
  EventChannel,
  EventPayloadArgs,
  InvokeArgs,
  InvokeChannel,
  InvokeResult,
  SendArgs,
  SendChannel,
  SyncChannel,
  SyncMap,
} from "@shared/ipc";
import { apiSpec } from "@shared/ipc";

export interface IpcContext {
  /** 发起请求的窗口；窗口已关闭时为 null */
  window: BrowserWindow | null;
}

const contextOf = (event: IpcMainInvokeEvent | IpcMainEvent): IpcContext => ({
  window: BrowserWindow.fromWebContents(event.sender),
});

const registered = new Set<string>();

function claim(channel: string): void {
  if (registered.has(channel)) throw new Error(`[ipc] 通道重复注册：${channel}`);
  registered.add(channel);
}

/** 处理渲染进程的 invoke 请求。渲染进程传来的参数不可信，处理函数里必须自己校验 */
export function handle<C extends InvokeChannel>(
  channel: C,
  handler: (ctx: IpcContext, ...args: InvokeArgs<C>) => InvokeResult<C> | Promise<InvokeResult<C>>,
): void {
  claim(channel);
  ipcMain.handle(channel, (event, ...args) =>
    handler(contextOf(event), ...(args as unknown as InvokeArgs<C>)),
  );
}

/** 处理渲染进程的“只通知、不等结果”消息 */
export function onSend<C extends SendChannel>(
  channel: C,
  handler: (ctx: IpcContext, ...args: SendArgs<C>) => void,
): void {
  claim(channel);
  ipcMain.on(channel, (event, ...args) =>
    handler(contextOf(event), ...(args as unknown as SendArgs<C>)),
  );
}

/** 处理渲染进程的同步取值（页面加载前的初始值） */
export function onSync<C extends SyncChannel>(
  channel: C,
  handler: () => ReturnType<SyncMap[C]>,
): void {
  claim(channel);
  ipcMain.on(channel, (event) => {
    event.returnValue = handler();
  });
}

/** 向所有窗口推送事件 */
export function broadcast<E extends EventChannel>(
  channel: E,
  ...payload: EventPayloadArgs<E>
): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, ...payload);
}

/**
 * 启动时自检：说明书（spec）里每个 invoke / send 通道都必须有人处理。
 * 漏实现时在控制台报错，而不是等用户点到那个按钮才发现。
 */
export function assertAllHandled(): void {
  const missing: string[] = [];
  for (const group of Object.values(apiSpec)) {
    for (const binding of Object.values(group)) {
      if (binding.kind !== "event" && !registered.has(binding.channel))
        missing.push(binding.channel);
    }
  }
  if (!registered.has("i18n:get")) missing.push("i18n:get");
  if (missing.length) console.error(`[ipc] 以下通道没有处理函数：\n  ${missing.join("\n  ")}`);
}
