# IPC 指南

渲染进程和主进程的**全部**通信都经过类型化的 IPC 契约。原理见 [architecture.md](./architecture.md#2-ipc唯一的跨进程通道)。

## 三种方向

| 方向 | 声明位置 | 渲染进程怎么用 | 主进程怎么实现 |
| --- | --- | --- | --- |
| 请求/响应 | `contract.ts` 的 `InvokeMap` | `await api.tags.rename(a, b)` | `handle("library:tag-rename", (ctx, a, b) => ...)` |
| 单向通知 | `SendMap` | `api.app.setTheme("dark")` | `onSend("theme-changed", (ctx, theme) => ...)` |
| 主进程推送 | `EventMap` | `const off = api.library.onChanged(cb)`（返回取消订阅函数） | `broadcast("library:changed")` |

另有一个 `SyncMap`（同步取值），只用于页面加载前必须拿到的初始语言，不要再加新的。

## 加一个新接口（以“获取图片数量”为例）

1. `src/shared/ipc/contract.ts` → `InvokeMap` 里加：`"library:count": () => number;`
2. `src/shared/ipc/spec.ts` → `apiSpec.library` 里加：`count: invoke("library:count"),`
3. 主进程对应模块的 `ipc.ts` 里实现：`handle("library:count", () => repos.images.count());`
4. 渲染进程使用：`const n = await api.library.count();`（类型自动推导）
5. 浏览器调试模式：在 `renderer/src/dev/mockApi.ts` 里补一个模拟实现（没补会返回 `undefined`）。

preload **不用改**。主进程启动时 `assertAllHandled()` 会检查说明书里的每个通道是否都有实现，漏了会在控制台报错；
`npm run check:ipc` 在不启动应用的情况下做同样的检查。

## 实现处理函数的规则

- 参数不可信：**先校验再使用**。用 `core/sanitize.ts`：`toId`、`cleanTag`、`cleanIds`……
  数组要限制长度，字符串要限制长度，数字要限制范围。
- 只收 id，不收路径。需要路径时从数据库取，或用系统对话框让用户选。
- 需要弹原生对话框/菜单时，用 `ctx.window` 作为父窗口；`ctx.window` 为 null（窗口已关）也要能工作。
- 处理函数里不写业务：调用模块的服务，返回结果。
- 返回值必须能被结构化克隆（不能返回函数、类实例、Error 对象）。失败用 `{ ok: false, error: "..." }`
  这样的结果值，而不是抛异常（抛出的异常到界面会变成一条难读的错误）。

## 推送事件的规则

- 高频事件要限流（进度最多 10 次/秒，列表变更最多 1 次/秒），限流工具在 `core/notify.ts`。
- 载荷保持小：通知“列表变了”，不要把整个列表推过去，让界面自己重新取。
- 订阅方负责取消订阅（`useEffect` 里返回取消函数）。
