import { useEffect, useRef } from "react";
import type { Catalogue, ItemMeta } from "../types";
import type { Dispatch, SetStateAction } from "react";
import { itemMetadata } from "../lib";
import { readStored, writeStored } from "../storage";
export function useMetadata(
  ids: string[],
  names: Catalogue,
  setNames: Dispatch<SetStateAction<Catalogue>>,
  demo: boolean,
  scope: unknown,
) {
  const cache = useRef(
    readStored<Record<string, ItemMeta>>("fm-tooltip-cache", {}),
  );
  const attempted = useRef(new Set<string>());
  const previousScope = useRef<unknown>(null);
  const namesRef = useRef(names);
  namesRef.current = names;
  const key = ids.join(",");
  useEffect(() => {
    if (demo) return;
    const scopeChanged = previousScope.current !== scope;
    if (scopeChanged) {
      attempted.current.clear();
      previousScope.current = scope;
    }
    const controller = new AbortController();
    let active = true;
    const queue = key
      .split(",")
      .filter(
        (id) =>
          /^\d+$/.test(id) &&
          !attempted.current.has(id) &&
          (scopeChanged ||
            !namesRef.current[id]?.icon ||
            namesRef.current[id]?.missing ||
            namesRef.current[id]?.subclassId == null),
      );
    const scheduled = [...queue];
    const completed = new Set<string>();
    async function worker() {
      while (active && queue.length) {
        const id = queue.shift()!;
        attempted.current.add(id);
        try {
          let meta = cache.current[id];
          if (meta?.metadataVersion !== 3) {
            const response = await fetch(
              `https://nether.wowhead.com/forever/tooltip/item/${id}`,
              {
                signal: AbortSignal.any([
                  controller.signal,
                  AbortSignal.timeout(10000),
                ]),
              },
            );
            if (!response.ok) throw new Error();
            meta = itemMetadata(await response.json())!;
            if (!meta) throw new Error();
            cache.current[id] = meta;
          }
          if (active) {
            completed.add(id);
            setNames((previous) => {
              const old = previous[id];
              return {
                ...previous,
                [id]: {
                  ...meta,
                  ...old,
                  name:
                    !old?.name || old.missing || /[А-Яа-яЁё]/.test(old.name)
                      ? meta.name
                      : old.name,
                  icon: old?.icon || meta.icon,
                  quality: old?.quality ?? meta.quality,
                  classId: old?.classId ?? meta.classId,
                  subclassId: old?.subclassId ?? meta.subclassId,
                  requiredLevel: old?.requiredLevel ?? meta.requiredLevel,
                  missing: false,
                },
              };
            });
          }
        } catch {
          if (controller.signal.aborted) attempted.current.delete(id);
        }
      }
    }
    Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker)).then(
      () => {
        if (active) {
          const entries = Object.entries(cache.current).slice(-1000);
          writeStored("fm-tooltip-cache", Object.fromEntries(entries));
        }
      },
    );
    return () => {
      active = false;
      for (const id of scheduled)
        if (!completed.has(id)) attempted.current.delete(id);
      controller.abort();
    };
  }, [key, demo, setNames, scope]);
}
