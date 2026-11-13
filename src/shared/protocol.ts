// 自定义协议 tessera:// 的地址规则。主进程（处理请求）和渲染进程（拼地址）共用这一份。
//   tessera://thumb/<hash>.jpg  → 缩略图
//   tessera://original/<id>     → 原图（主进程按 id 查磁盘路径，页面传不了任意路径）

export const PROTOCOL_SCHEME = "tessera";
export const THUMB_HOST = "thumb";
export const ORIGINAL_HOST = "original";

export const thumbUrl = (thumbName: string): string =>
  `${PROTOCOL_SCHEME}://${THUMB_HOST}/${thumbName}`;

export const originalUrl = (id: number): string =>
  `${PROTOCOL_SCHEME}://${ORIGINAL_HOST}/${id}`;
