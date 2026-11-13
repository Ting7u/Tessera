import type { LanguagePreference } from "@shared/i18n";
import { setLanguagePreference, useT, usePreference } from "@renderer/shared/i18n";
import { Icon } from "@renderer/shared/ui";
import styles from "../SettingsDialog.module.scss";

const LANGUAGE_OPTIONS: readonly LanguagePreference[] = ["system", "zh", "en"]; // 名字在 locales 里是 language.<option>

// 设置 → 语言
export function LanguageSection() {
  const t = useT();
  const languagePreference = usePreference();

  return (
    <>
      <h3 className={styles.heading}>{t("language.label")}</h3>
      <p className={styles.hint}>{t("language.hint")}</p>

      <div className={styles.options} role="radiogroup" aria-label={t("language.label")}>
        {LANGUAGE_OPTIONS.map((option) => {
          const selected = languagePreference === option;
          return (
            <button
              key={option}
              role="radio"
              aria-checked={selected}
              className={`${styles.option} ${selected ? styles.selected : ""}`}
              onClick={() => setLanguagePreference(option)}
            >
              <span>{t(`language.${option}`)}</span>
              {selected && <Icon name="check" size={16} />}
            </button>
          );
        })}
      </div>
    </>
  );
}
