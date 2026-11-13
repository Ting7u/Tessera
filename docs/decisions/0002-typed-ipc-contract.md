# 0002 类型化 IPC 契约

状态：已采纳

**背景**：旧代码里通道名在 preload、main、渲染进程三处手写，容易漏改、类型靠猜。

**决定**：`shared/ipc/contract.ts` 声明全部通道的参数/返回值类型，`spec.ts` 声明 `window.api` 的形状；preload 按 spec 自动生成；主进程用 `handle/onSend/onSync/broadcast`；启动时和 `check:ipc` 都会检查每个通道都有实现。

**理由**：加接口只改一处声明，类型贯通三个进程；漏实现会被检查发现。

**约束**：已有通道名不改（兼容老行为和浏览器扩展）；渲染进程入参一律视为不可信。
