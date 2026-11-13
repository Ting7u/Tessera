import { useT } from "@renderer/shared/i18n";
import { RenameDialog } from "@renderer/shared/ui";
import { useAppStore } from "@renderer/store";

// 重命名标签（侧边栏标签右键 → 重命名）。新名字已存在时，主进程会弹框确认是否合并
export function RenameTagDialog() {
  const t = useT();
  const from = useAppStore((s) => s.renameTagFrom) ?? "";
  const close = useAppStore((s) => s.closeRenameTag);
  const renameTag = useAppStore((s) => s.renameTag);

  return (
    <RenameDialog
      title={t("rename.tagTitle")}
      from={from}
      emptyMessage={t("rename.tagEmpty")}
      onClose={close}
      onSubmit={(to) => renameTag(from, to)}
    />
  );
}
