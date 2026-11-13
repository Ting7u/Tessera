// 预加载脚本：在渲染进程里把 window.api 搭起来。
// 它按 shared/ipc/spec.ts 的说明书自动生成接口，加新接口时不用改这里。
// 只做“转发”，不放业务逻辑。
import { contextBridge, ipcRenderer, webUtils } from "electron";
import { apiSpec, type Binding, type TesseraApi } from "@shared/ipc";
import type { I18nState } from "@shared/i18n";

type Callback = (payload: unknown) => void;

/** 按绑定类型生成对应的函数 */
function bind(binding: Binding): (...args: unknown[]) => unknown {
  switch (binding.kind) {
    case "invoke":
      return (...args) => ipcRenderer.invoke(binding.channel, ...args);
    case "send":
      return (...args) => ipcRenderer.send(binding.channel, ...args);
    case "event":
      // 订阅类接口统一返回“取消订阅”函数，方便在 useEffect 里清理
      return (callback: unknown) => {
        const handler = (_event: unknown, payload: unknown): void =>
          (callback as Callback)(payload);
        ipcRenderer.on(binding.channel, handler);
        return () => ipcRenderer.removeListener(binding.channel, handler);
      };
  }
}

const groups: Record<string, Record<string, unknown>> = {};
for (const [groupName, group] of Object.entries(apiSpec)) {
  groups[groupName] = {};
  for (const [name, binding] of Object.entries(group)) {
    groups[groupName][name] = bind(binding);
  }
}

// 只能在 preload 里做的部分
groups.app.platform = process.platform;
// 同步取一次初始语言：页面加载前就知道该用哪种语言，第一帧不会闪一下错的语言
groups.i18n.initial = ipcRenderer.sendSync("i18n:get") as I18nState;
groups.importer.getPathForFile = (file: Blob) => webUtils.getPathForFile(file as File);

// 这里是唯一一处类型断言：spec 的结构和 TesseraApi 由类型系统保证一致
contextBridge.exposeInMainWorld("api", groups as unknown as TesseraApi);
