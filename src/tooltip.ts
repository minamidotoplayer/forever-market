// Preserve tooltip formatting without allowing remote scripts, links or styles.
const tags = new Set([
  "TABLE",
  "TBODY",
  "THEAD",
  "TR",
  "TD",
  "TH",
  "B",
  "STRONG",
  "I",
  "EM",
  "SPAN",
  "DIV",
  "BR",
  "SMALL",
]);
const discard = new Set([
  "SCRIPT",
  "STYLE",
  "SVG",
  "MATH",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "TEMPLATE",
  "IMG",
  "FORM",
  "INPUT",
  "BUTTON",
  "LINK",
  "META",
]);
const classes =
  /^(q[0-7]?|moneygold|moneysilver|moneycopper|toycolor|whtt-sellprice)$/;

export function sanitizeTooltipHtml(html: string): string {
  const parsed = document.createElement("template");
  parsed.innerHTML = html.slice(0, 100_000);
  const output = document.createElement("div");
  function copy(node: Node, parent: Node) {
    if (node.nodeType === 3) {
      parent.appendChild(document.createTextNode(node.textContent || ""));
      return;
    }
    if (node.nodeType !== 1) return;
    const source = node as Element;
    if (discard.has(source.tagName)) return;
    // Unknown wrappers (including anchors) become plain text containers.
    const target = tags.has(source.tagName)
      ? document.createElement(source.tagName.toLowerCase())
      : null;
    if (target) {
      const safeClasses = [...source.classList].filter((value) =>
        classes.test(value),
      );
      if (safeClasses.length) target.className = safeClasses.join(" ");
      if (["TD", "TH"].includes(source.tagName)) {
        for (const attribute of ["colspan", "rowspan"]) {
          const value = source.getAttribute(attribute);
          if (value && /^[1-8]$/.test(value))
            target.setAttribute(attribute, value);
        }
      }
      parent.appendChild(target);
    }
    for (const child of source.childNodes) copy(child, target || parent);
  }
  for (const child of parsed.content.childNodes) copy(child, output);
  return output.innerHTML;
}

const cache = new Map<string, Promise<string>>();
export function loadItemTooltip(id: string): Promise<string> {
  if (!/^\d+$/.test(id)) return Promise.reject(new Error("Invalid item ID"));
  const previous = cache.get(id);
  if (previous) return previous;
  const request = (async () => {
    const response = await fetch(
      `https://nether.wowhead.com/forever/tooltip/item/${id}`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!response.ok) throw new Error("Tooltip unavailable");
    const data = await response.json();
    if (typeof data.tooltip !== "string" || !data.tooltip.trim())
      throw new Error("Tooltip unavailable");
    return sanitizeTooltipHtml(data.tooltip);
  })().catch((error) => {
    if (cache.get(id) === request) cache.delete(id);
    throw error;
  });
  cache.set(id, request);
  if (cache.size > 128) cache.delete(cache.keys().next().value!);
  return request;
}
