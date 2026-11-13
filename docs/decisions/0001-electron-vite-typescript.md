# 0001 使用 electron-vite + 全 TypeScript

状态：已采纳

**背景**：旧项目是 JS（`electron/` 主进程 + Vite 渲染进程），目录混乱、没有类型，多人/AI 协作时接口靠口头约定。

**决定**：全部迁移 TypeScript（strict）；用 electron-vite 统一构建 main / preload / renderer；Prettier 强制双引号 + 行尾分号。

**理由**：类型让跨模块、跨进程接口可检查；统一构建减少自写脚本；风格由工具强制，评审不争论格式。

**代价/风险**：本次迁移时无法联网安装，真实构建未验证（见 [tech-debt.md](../tech-debt.md)）；electron-vite 的目录约定（`out/`、preload 路径）可能与旧 `package.json` 入口不同，已按其约定调整。
