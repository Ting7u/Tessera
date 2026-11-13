import { handle } from "../../core/ipc";
import type { createFolders } from "./folders";

export function registerFoldersIpc({
  folders,
}: {
  folders: ReturnType<typeof createFolders>;
}): void {
  handle("library:folder-menu", ({ window }, dir) => ({ ok: folders.popupMenu(window, dir) }));
}
