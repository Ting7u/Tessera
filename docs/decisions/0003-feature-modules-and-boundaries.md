# 0003 按功能分模块，并用脚本强制依赖方向

状态：已采纳

**决定**：主进程 `app → modules → db → core`；渲染进程 `features → store → shared`；模块/feature 之间只通过对方的 `index.ts`；`shared` 不依赖其他层。`scripts/check-boundaries.mjs` 在 `npm run check` 中强制。

**理由**：职责清晰，多人并行修改冲突少；AI 只需读相关模块即可工作；规则写成脚本而不是靠自觉。

**代价**：跨模块需要共用的东西要么提到 `core`/`shared`，要么通过 `app/composition.ts` 注入，起初会觉得绕。
