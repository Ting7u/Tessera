// tessera:// 协议（地址的拼法见 shared/protocol.ts）：
//   tessera://thumb/<hash>.jpg  →  <thumbs>/<hash>.jpg
//   tessera://original/<id>     →  getPathById(id) 返回的原图文件
import path from "node:path";
import { pathToFileURL } from "node:url";
import { net, protocol } from "electron";
import { ORIGINAL_HOST, PROTOCOL_SCHEME, THUMB_HOST } from "@shared/protocol";

/** 必须在 app ready 之前调用 */
export function registerScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: PROTOCOL_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: true,
      },
    },
  ]);
}

/** 必须在 app ready 之后调用 */
export function registerHandler({
  thumbsDir,
  getPathById,
}: {
  thumbsDir: string;
  getPathById: (id: number) => string | null;
}): void {
  protocol.handle(PROTOCOL_SCHEME, (request) => {
    const url = new URL(request.url);

    if (url.hostname === THUMB_HOST) {
      const name = path.basename(decodeURIComponent(url.pathname)); // basename 防止路径穿越
      return net.fetch(pathToFileURL(path.join(thumbsDir, name)).toString());
    }

    if (url.hostname === ORIGINAL_HOST) {
      const id = Number(path.basename(decodeURIComponent(url.pathname)));
      const file = Number.isInteger(id) ? getPathById(id) : null;
      if (!file) return new Response("Not found", { status: 404 });
      return net.fetch(pathToFileURL(file).toString());
    }

    return new Response("Not found", { status: 404 });
  });
}
