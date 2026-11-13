# 浏览器扩展与本机桥接

扩展在 `extensions/browser/`（纯 JS，不参与构建，开发者模式加载该目录）；主进程一侧是 `src/main/modules/bridge/`。

## 作用

在网页图片上右键“下载到 Tessera”，扩展把图片地址和页面地址发给本机的 Tessera，由主进程的 `downloads` 模块下载并入库。

## 协议（HTTP，只监听 127.0.0.1）

端口范围：`38765` 起共 10 个（`src/shared/constants.ts` 的 `BRIDGE_PORT_START/COUNT`）。
**`extensions/browser/background.js` 里的 `PORTS` 必须与之一致**（`check:ipc` 会检查）。

| 请求 | 说明 |
| --- | --- |
| `GET /ping` | 返回 `{ app: "tessera", version }`。扩展用它探测哪个端口是 Tessera。不校验 Origin |
| `POST /pair` | 首次配对：Tessera 弹窗让用户确认。已有令牌 → 200 `{ token }`；等待确认 → 202 `{ status: "pending" }`，扩展轮询；被拒绝 → 403 `{ error: "denied" }`（有 60 秒冷却）；已有别的扩展在配对 → 409 |
| `POST /download` | 头 `Authorization: Bearer <token>`，体 `{ urls: string[], pageUrl?: string }`。立即 202 `{ accepted: n }`，下载在后台进行，结果通过界面提示/系统通知告知 |

## 安全设计（这个接口会开本机端口，网页脚本也能向 127.0.0.1 发请求）

1. 只监听 `127.0.0.1`。
2. `Host` 必须是 `127.0.0.1` / `localhost`（防 DNS 重绑定）。
3. 除 `/ping` 外，`Origin` 必须是 `chrome|edge|moz-extension://…`。网页脚本的 Origin 是网页自己的，伪造不了。
4. 首次连接必须在 Tessera 内点“允许”；之后每个扩展用独立令牌，令牌与扩展 Origin 绑定，存于 `settings.json` 的 `bridgeTokens`，比较用常量时间。
5. 请求体上限 1 MB；下载走 `downloads` 的规则（只下 http/https，数量和单张大小有上限）。

**修改这个模块必须保持以上五点。** 不要放宽 Origin 校验，不要加通配 CORS。

## 改动注意

- 接口是对外约定（已安装的扩展会调用），只增不改；要改先写决策记录。
- 本模块没有自动化测试，改动后需手动验证：未配对 → 配对确认 → 下载 → 拒绝后冷却。
