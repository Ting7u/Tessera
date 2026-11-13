import { useT } from "@renderer/shared/i18n";
import { RenameDialog } from "@renderer/shared/ui";
import { useAppStore } from "@renderer/store";

// 重命名智能分类（侧边栏智能分类右键 → 重命名）
export function RenameSmartDialog() {
  const t = useT();
  const target = useAppStore((s) => s.renameSmartTarget);
  const close = useAppStore((s) => s.closeRenameSmart);
  const renameSmartAlbum = useAppStore((s) => s.renameSmartAlbum);

  return (
    <RenameDialog
      title={t("rename.smartTitle")}
      from={target?.name ?? ""}
      emptyMessage={t("rename.nameEmpty")}
      onClose={close}
      onSubmit={async (to) => {
        if (!target) return { ok: false };
        const res = await renameSmartAlbum(target.id, to);
        return res.ok
          ? { ok: true }
          : { ok: false, error: res.error || t("toast.renameFailedRetry") };
      }}
    />
  );
}
