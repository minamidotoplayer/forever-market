import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { loadItemTooltip } from "../tooltip";
import { ItemIcon, qualityClass } from "./Common";
import type { ItemMeta, Translate } from "../types";

export function ItemTooltip({
  id,
  meta,
  t,
  large = false,
  className = "item-cell",
  children,
}: {
  id: string;
  meta?: ItemMeta;
  t: Translate;
  large?: boolean;
  className?: string;
  children: (tooltipId?: string) => ReactNode;
}) {
  const tooltipId = useId();
  const anchor = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const inspect = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const opening = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closing = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const focused = useRef(false);
  const suppressFocus = useRef(false);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [content, setContent] = useState<{
    status: "loading" | "ready" | "error";
    html: string;
  }>({ status: "loading", html: "" });
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const name = meta?.name || `${t("Item", "Предмет")} #${id}`;
  function clearTimers() {
    clearTimeout(opening.current);
    clearTimeout(closing.current);
  }
  function hide(restoreFocus = false) {
    clearTimers();
    setOpen(false);
    setPinned(false);
    if (
      restoreFocus &&
      inspect.current &&
      document.activeElement !== inspect.current
    ) {
      suppressFocus.current = true;
      inspect.current.focus({ preventScroll: true });
    }
  }
  function show() {
    clearTimers();
    if (!/^\d+$/.test(id)) return;
    window.dispatchEvent(
      new window.CustomEvent("fm-tooltip-open", { detail: tooltipId }),
    );
    setOpen(true);
  }
  function leave() {
    clearTimeout(opening.current);
    if (!pinned && !focused.current)
      closing.current = setTimeout(() => setOpen(false), 150);
  }
  useEffect(() => {
    hide();
    return clearTimers;
  }, [id]);
  useEffect(() => {
    const otherOpened = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== tooltipId) hide();
    };
    window.addEventListener("fm-tooltip-open", otherOpened);
    return () => window.removeEventListener("fm-tooltip-open", otherOpened);
  }, [tooltipId]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setContent({ status: "loading", html: "" });
    loadItemTooltip(id).then(
      (html) => {
        if (active) setContent({ status: "ready", html });
      },
      () => {
        if (active) setContent({ status: "error", html: "" });
      },
    );
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        hide(pinned);
      }
    };
    const outside = (event: Event) => {
      const target = event.target as Node;
      if (!anchor.current?.contains(target) && !panel.current?.contains(target))
        hide();
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => {
      active = false;
      document.removeEventListener("keydown", escape);
      document.removeEventListener("pointerdown", outside);
    };
  }, [id, open, pinned]);
  useEffect(() => {
    if (pinned && open) closeButton.current?.focus({ preventScroll: true });
  }, [pinned, open]);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect();
      const box = panel.current?.getBoundingClientRect();
      if (!rect || !box) return;
      const width = Math.min(320, window.innerWidth - 24);
      const right = rect.right + 10;
      const left =
        right + width <= window.innerWidth - 12
          ? right
          : Math.min(
              window.innerWidth - width - 12,
              Math.max(12, rect.left - width - 10),
            );
      const top = Math.max(
        12,
        Math.min(rect.top, window.innerHeight - box.height - 12),
      );
      setPosition({ left, top });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, content, pinned]);
  return (
    <div
      ref={anchor}
      className={className}
      onMouseEnter={() => {
        clearTimeout(closing.current);
        opening.current = setTimeout(show, 160);
      }}
      onMouseLeave={leave}
      onFocusCapture={() => {
        focused.current = true;
        if (suppressFocus.current) {
          suppressFocus.current = false;
          return;
        }
        show();
      }}
      onBlurCapture={(event) => {
        if (
          anchor.current?.contains(event.relatedTarget as Node) ||
          panel.current?.contains(event.relatedTarget as Node)
        )
          return;
        focused.current = false;
        if (pinned) hide();
        else leave();
      }}
    >
      <button
        ref={inspect}
        className="item-inspect"
        aria-label={`${t("Item details", "Описание предмета")}: ${name}`}
        aria-describedby={open && !pinned ? tooltipId : undefined}
        aria-expanded={pinned}
        aria-controls={open ? tooltipId : undefined}
        disabled={!/^\d+$/.test(id)}
        onClick={(event) => {
          event.stopPropagation();
          if (pinned) hide();
          else {
            show();
            setPinned(true);
          }
        }}
      >
        <ItemIcon meta={meta} large={large} />
      </button>
      {children(open && !pinned ? tooltipId : undefined)}
      {open &&
        createPortal(
          <div
            ref={panel}
            id={tooltipId}
            className="wow-item-tooltip"
            role={pinned ? "dialog" : "tooltip"}
            aria-label={pinned ? name : undefined}
            style={position}
            onClick={(event) => event.stopPropagation()}
            onMouseEnter={() => clearTimeout(closing.current)}
            onMouseLeave={leave}
          >
            {pinned && (
              <button
                ref={closeButton}
                className="tooltip-close quiet"
                aria-label={t(
                  "Close item tooltip",
                  "Закрыть описание предмета",
                )}
                onClick={() => hide(true)}
              >
                ×
              </button>
            )}
            {content.status === "ready" ? (
              <div
                className="wow-tooltip-body"
                dangerouslySetInnerHTML={{ __html: content.html }}
              />
            ) : (
              <>
                <strong className={qualityClass(meta?.quality)}>{name}</strong>
                <p role="status">
                  {content.status === "loading"
                    ? t("Loading item details…", "Загрузка описания…")
                    : t(
                        "Item details are temporarily unavailable.",
                        "Описание предмета временно недоступно.",
                      )}
                </p>
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
