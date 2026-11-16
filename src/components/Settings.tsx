import { useEffect, useRef, useState } from "react";
import { sourceUrl } from "../lib";
import type { Translate } from "../types";
export function Settings({
  source,
  onSave,
  onDemo,
  onClose,
  t,
}: {
  source: string;
  onSave: (source: string) => void;
  onDemo: () => void;
  onClose: () => void;
  t: Translate;
}) {
  const [value, setValue] = useState(source);
  const [error, setError] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="settings-modal"
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={t("Settings", "Настройки")}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
          if (event.key === "Tab") {
            const controls = panel.current?.querySelectorAll<HTMLElement>(
              "button,input,a[href]",
            );
            if (!controls?.length) return;
            const first = controls[0],
              last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <div className="dialog-header">
          <h2>{t("Data source", "Источник данных")}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label={t("Close", "Закрыть")}
          >
            ×
          </button>
        </div>
        <p>
          {t(
            "Prices come from scheduled Blizzard snapshots. API keys stay in GitHub Secrets.",
            "Цены приходят из снимков Blizzard по расписанию. Ключи остаются в GitHub Secrets.",
          )}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              sourceUrl(value.trim());
              onSave(value.trim());
            } catch {
              setError(
                t(
                  "Use an HTTPS data-folder URL without credentials, query or fragment.",
                  "Укажите HTTPS-адрес папки данных без пароля, параметров и #.",
                ),
              );
            }
          }}
        >
          <label className="source-label">
            {t(
              "Custom data URL (optional)",
              "Адрес другого источника (необязательно)",
            )}
            <input
              type="url"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="https://example.com/data/"
            />
          </label>
          <p>
            {t(
              "Leave empty to use this site’s snapshots. External sources must allow CORS.",
              "Оставьте пустым для снимков этого сайта. Внешний источник должен разрешать CORS.",
            )}
          </p>
          <p role="alert">{error}</p>
          <div className="dialog-actions">
            <button type="button" className="button" onClick={onDemo}>
              {t("Open demo", "Открыть демо")}
            </button>
            <button className="button">
              {t("Save source", "Сохранить источник")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
