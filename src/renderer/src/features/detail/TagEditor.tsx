import { useRef, useState } from "react";
import { useT } from "@renderer/shared/i18n";
import { Icon } from "@renderer/shared/ui";
import { useAppStore } from "@renderer/store";
import styles from "./DetailPanel.module.scss";

export interface TagEditorProps {
  id: number;
  tags: string[];
}

// 标签：点标签上的 × 移除；点“添加”输入后回车确认，Esc 取消
export function TagEditor({ id, tags }: TagEditorProps) {
  const t = useT();
  const addTag = useAppStore((s) => s.addTag);
  const removeTag = useAppStore((s) => s.removeTag);
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const cancelled = useRef(false); // Esc 之后触发的 blur 不应再提交

  const start = (): void => {
    cancelled.current = false;
    setAdding(true);
  };
  const finish = (): void => {
    const name = value.trim();
    setValue("");
    setAdding(false);
    if (name && !cancelled.current) void addTag(id, name);
  };
  const cancel = (): void => {
    cancelled.current = true;
    setValue("");
    setAdding(false);
  };

  return (
    <div className={styles.tags}>
      {tags.map((tag) => (
        <span key={tag}>
          {tag}
          {/* 用 <i> 而不是 <button>：避免被 .tags button 的“添加”按钮样式命中 */}
          <i
            className={styles.tagRemove}
            role="button"
            tabIndex={0}
            aria-label={t("tag.remove", { name: tag })}
            onClick={() => void removeTag(id, tag)}
            onKeyDown={(event) => event.key === "Enter" && void removeTag(id, tag)}
          >
            ×
          </i>
        </span>
      ))}
      {adding ? (
        <input
          autoFocus
          className={styles.tagInput}
          value={value}
          maxLength={30}
          placeholder={t("tag.inputPlaceholder")}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") finish();
            else if (event.key === "Escape") cancel();
          }}
          onBlur={finish}
        />
      ) : (
        <button onClick={start}>
          <Icon name="plus" size={13} />
          {t("tag.add")}
        </button>
      )}
    </div>
  );
}
