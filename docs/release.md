# 发布

> 本文只记录仓库里**已有的配置**；签名、自动更新、CI 目前没有配置（未知/未做，见 [tech-debt.md](./tech-debt.md)）。

1. 更新 `CHANGELOG.md`（把“未发布”移到新版本）和 `package.json` 的 `version`。
2. `npm run check` 全绿。
3. 打包：`npm run dist`（Windows）/ `dist:mac` / `dist:linux`；配置在 `electron-builder.yml`，输出到 `release/`。
4. 在干净机器上手动冒烟：首次启动、导入文件夹、缩略图、标签、下载、浏览器扩展配对、升级安装后旧数据仍在。
5. **不要改 `productName` / `appId`**，否则升级后用户数据目录变化。

浏览器扩展单独发布，版本号在 `extensions/browser/manifest.json`。
