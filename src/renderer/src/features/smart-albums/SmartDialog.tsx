import { useState, type KeyboardEvent } from "react";
import type { SmartRule } from "@shared/types";
import { useT } from "@renderer/shared/i18n";
import { Dialog, Switch } from "@renderer/shared/ui";
import { useAppStore } from "@renderer/store";
import styles from "./SmartDialog.module.scss";

// 标签输入框里，逗号或分号隔开，中英文都行
const TAG_SEPARATORS = /[,;，；、]/;

// 新建智能分类：几个条件同时满足的图片会自动归入这个分类。
// 显示与否由 App 里的 Presence 控制，所以每次打开都是一个空白表单（这里的 state 随卸载清空）
export function SmartDialog() {
  const t = useT();
  const close = useAppStore((s) => s.closeSmart);
  const createSmart = useAppStore((s) => s.createSmart);
  const selectCategory = useAppStore((s) => s.selectCategory);
  const showToast = useAppStore((s) => s.showToast);

  const [name, setName] = useState("");
  const [days, setDays] = useState("");
  const [tag, setTag] = useState("");
  const [minSizeMB, setMinSizeMB] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [error, setError] = useState("");

  const submit = async (): Promise<void> => {
    const title = name.trim();
    const rule: SmartRule = {
      days: Number(days) || 0,
      tags: tag
        .split(TAG_SEPARATORS)
        .map((s) => s.trim())
        .filter(Boolean),
      minSizeMB: Number(minSizeMB) || 0,
      favorite,
    };
    if (!title) return setError(t("smart.error.nameRequired"));
    if (!rule.days && !rule.tags.length && !rule.minSizeMB && !rule.favorite) {
      return setError(t("smart.error.conditionRequired"));
    }
    const res = await createSmart(title, rule);
    if (!("id" in res)) return setError(res.error || t("smart.error.createFailed"));
    close();
    selectCategory(`smart:${res.id}`);
    if (res.dropped.length) {
      showToast(t("smart.droppedTags", { tags: res.dropped.join(t("common.listSeparator")) }), {
        duration: 4000,
      });
    }
  };

  // 输入框里按回车 = 创建（拼音还没选字时的回车不算）
  const onEnter = (event: KeyboardEvent): void => {
    if (event.key === "Enter" && !event.nativeEvent.isComposing) void submit();
  };

  return (
    <Dialog
      onClose={close}
      label={t("smart.new")}
      className={styles.dialog}
      backdropClassName={styles.overlay}
    >
      <h3>{t("smart.new")}</h3>
      <p className={styles.sub}>{t("smart.subtitle")}</p>

      <label className={styles.field}>
        <span className={styles.label}>{t("smart.name")}</span>
        <input
          autoFocus
          className={styles.input}
          value={name}
          maxLength={30}
          placeholder={t("smart.namePlaceholder")}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onEnter}
        />
      </label>

      <div className={styles.group}>
        <div className={styles.groupTitle}>{t("smart.conditions")}</div>
        <p className={styles.sub}>{t("smart.conditionsHint")}</p>

        <label className={styles.field}>
          <span className={styles.label}>{t("smart.days")}</span>
          <span className={styles.control}>
            <input
              type="number"
              min="0"
              className={styles.input}
              value={days}
              placeholder={t("smart.noLimit")}
              onChange={(e) => setDays(e.target.value)}
              onKeyDown={onEnter}
            />
            <span className={styles.unit}>{t("smart.unit.days")}</span>
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{t("smart.tags")}</span>
          <input
            className={styles.input}
            value={tag}
            placeholder={t("smart.tagsPlaceholder")}
            onChange={(e) => setTag(e.target.value)}
            onKeyDown={onEnter}
          />
          <span className={styles.sub}>{t("smart.tagsHint")}</span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{t("smart.minSize")}</span>
          <span className={styles.control}>
            <input
              type="number"
              min="0"
              step="0.1"
              className={styles.input}
              value={minSizeMB}
              placeholder={t("smart.noLimit")}
              onChange={(e) => setMinSizeMB(e.target.value)}
              onKeyDown={onEnter}
            />
            <span className={styles.unit}>{t("smart.unit.mb")}</span>
          </span>
        </label>

        <Switch
          className={styles.favoriteSwitch}
          checked={favorite}
          onChange={setFavorite}
          label={t("smart.favoriteOnly")}
        />
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.buttons}>
        <button className={styles.cancel} onClick={close}>
          {t("common.cancel")}
        </button>
        <button className={styles.submit} onClick={() => void submit()}>
          {t("smart.create")}
        </button>
      </div>
    </Dialog>
  );
}
