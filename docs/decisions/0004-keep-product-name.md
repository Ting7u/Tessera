# 0004 保持 productName / name 不变

状态：已采纳

**背景**：Electron 的 `userData` 目录由 `productName` 决定，里面有用户的数据库、缩略图、托管图片和设置。

**决定**：`name: tessera`、`productName: Tessera`、`appId`、`userData` 下的文件名、`settings.json` 键、`tessera://` 协议格式都不改。

**理由**：改了会让老用户升级后找不到图库。若将来必须改名，需要先写数据迁移（把旧目录内容迁到新目录）并新增决策记录。
