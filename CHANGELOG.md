# 更新日志

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/)。每次发布前把“未发布”的内容移到新版本下。

## 未发布

### 重构（功能不变）
- 全面迁移到 TypeScript；改用 electron-vite 构建；目录按 `shared / preload / main / renderer` 重组，
  对照表见 `docs/migration-map.md`。
- 主进程：`Store` 巨型类拆成 4 个 Repository + 纯 SQL 构建函数；`library/*` 拆成 14 个功能模块 + 装配层。
- 渲染进程：全局 store 按领域拆 slice；弹窗、重命名框、标签块、Esc 关闭等重复实现合并为通用组件/hook。
- 类型化 IPC 契约（`shared/ipc`）：新增接口只需声明一次，preload 自动生成 `window.api`。
- 新增工程检查：`check:boundaries`（依赖方向）、`check:ipc`（IPC 完整性）、`check:i18n`；单元测试（node:test）。
- 新增完整文档（`docs/`、`AGENTS.md`、`CONTRIBUTING.md`）。

### 有意的小改动
- 下载进度提示由主进程用 `{ text, downloading: true }` 标明，不再靠界面里的中文正则猜测。
- 顶部栏“排序”“布局”菜单改用通用 Menu；智能分类弹窗的“仅收藏”改用通用 Switch。
- 修正 `package.json` 里 i18n 检查脚本路径错误。
- 浏览器扩展目录里误放的主进程调试副本 `downloads.js` 已删除。

### 已知差异
- 设置页切换分类后，“维护”页的扫描结果会被清空（旧版保留）。
