import { handle } from "../../core/ipc";
import { toId } from "../../core/sanitize";
import type { Maintenance } from "./maintenance";

export function registerMaintenanceIpc({ maintenance }: { maintenance: Maintenance }): void {
  // 详情面板用
  handle("library:file-exists", (_ctx, id) => maintenance.fileExists(toId(id)));
  handle("library:scan-missing", () => maintenance.scan());
  handle("library:clean-missing", ({ window }, kind) => maintenance.clean(window, kind));
}
