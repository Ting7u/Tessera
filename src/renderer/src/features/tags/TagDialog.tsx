import { useState } from "react";
import { useT } from "@renderer/shared/i18n";
import { Dialog, TagChip } from "@renderer/shared/ui";
import { getCachedItem, useAppStore } from "@renderer/store";
import styles from "./TagDialog.module.scss";

// 给一张或多张图片加/删标签。多张时，已有标签显示“有这个标签的张数/总张数”，点 × 从这些图片全部移除
export function TagDialog() {
  const t = useT();
  const ids = useAppStore((s) => s.tagIds);
  const existing = useAppStore((s) => s.sidebar.tags);
  const closeTag = useAppStore((s) => s.closeTag);
  const addTagToMany = useAppStore((s) => s.addTagToMany);
  const removeTagFromMany = useAppStore((s) => s.removeTagFromMany);
  useAppStore((s) => s.items); // 标签变化后列表会更新，借此让弹窗重新读取缓存里的标签
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); // 弹窗盖在提示条上面，失败原因直接显示在弹窗里

  // 这些图片上各个标签出现的张数
  const counts = new Map<string, number>();
  for (const id of ids) {
    for (const tag of getCachedItem(id)?.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  const current = [...counts];

  const keyword = value.trim().toLowerCase();
  const suggestions = existing
    .filter(
      (tag) => counts.get(tag.name) !== ids.length && tag.name.toLowerCase().includes(keyword),
    )
    .slice(0, 12);

  const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

  // closeAfter：输入框里回车、点“完成”时添加完就关闭；点下面的已有标签时保持打开，可以继续加
  const add = async (raw: string, closeAfter = false): Promise<void> => {
    const name = raw.trim();
    if (!name || busy) return;
    setBusy(true);
    setError("");
    try {
      if (await addTagToMany(ids, name)) {
        setValue("");
        if (closeAfter) closeTag();
      } else setError(t("tag.addFailedMissing"));
    } catch (err) {
      console.error(err);
      setError(t("tag.addFailed", { message: messageOf(err) }));
    } finally {
      setBusy(false);
    }
  };

  // “完成”：输入框里还有没提交的文字就先添加，再关闭
  const done = (): void => {
    if (value.trim()) void add(value, true);
    else closeTag();
  };

  const remove = async (name: string): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (!(await removeTagFromMany(ids, name))) setError(t("tag.removeFailed"));
    } catch (err) {
      console.error(err);
      setError(t("tag.removeFailedMsg", { message: messageOf(err) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      onClose={closeTag}
      label={t("tag.title")}
      className={styles.dialog}
      backdropClassName={styles.overlay}
    >
      <header className={styles.header}>
        <h3>{t("tag.title")}</h3>
        <span>{t("tag.imageCount", { count: ids.length })}</span>
      </header>

      <div className={styles.label}>
        {ids.length > 1 ? t("tag.existingMany") : t("tag.existing")}
      </div>
      {current.length === 0 ? (
        <p className={styles.empty}>{t("tag.empty")}</p>
      ) : (
        <div className={styles.chips}>
          {current.map(([name, n]) => (
            <TagChip
              key={name}
              name={name}
              count={ids.length > 1 ? `${n}/${ids.length}` : undefined}
            >
              <button
                className={styles.remove}
                aria-label={t("tag.remove", { name })}
                onClick={() => void remove(name)}
              >
                ×
              </button>
            </TagChip>
          ))}
        </div>
      )}

      <div className={styles.label}>{t("tag.addLabel")}</div>
      <input
        autoFocus
        className={styles.input}
        value={value}
        maxLength={30}
        placeholder={t("tag.addPlaceholder")}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return; // 拼音还没选字时的回车不算确认
          if (event.key === "Enter") void add(value, true);
        }}
      />
      {suggestions.length > 0 && (
        <div className={styles.chips}>
          {suggestions.map((tag) => (
            <TagChip
              key={tag.key}
              name={tag.name}
              count={tag.count}
              onClick={() => void add(tag.name)}
            />
          ))}
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <footer className={styles.footer}>
        <button className={styles.done} onClick={done}>
          {t("common.done")}
        </button>
      </footer>
    </Dialog>
  );
}
