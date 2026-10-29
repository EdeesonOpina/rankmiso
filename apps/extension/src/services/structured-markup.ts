/**
 * Bounded Microdata and RDFa Lite extraction. The function is serialized into
 * the page, so it must not close over imports.
 *
 * RDFa scope: vocab, typeof, property, about, resource, href, src, content,
 * and a prefix map. rel is copied only when it has an href. rev, datatype
 * coercion, hanging rel chains, and lists are not processed.
 */

export interface MarkupBlock {
  format: "microdata" | "rdfa";
  raw: string;
}

export function collectMarkup(root: ParentNode = document): MarkupBlock[] {
  const MAX_ITEMS = 40;
  const MAX_DEPTH = 6;
  const MAX_PROPS = 12;
  const MAX_TEXT = 240;

  function extractMicrodata(root: ParentNode) {
    const limitations: string[] = [];
    const referenced = new Set<Element>();
    root.querySelectorAll("[itemref]").forEach((element) => {
      for (const id of tokens(element.getAttribute("itemref"))) {
        const found = element.ownerDocument?.getElementById(id);
        if (found && found !== element) referenced.add(found);
        else if (!found) limitations.push("An itemref did not match an id.");
      }
    });
    const scopes = Array.from(root.querySelectorAll("[itemscope]"));
    if (scopes.length > 80)
      limitations.push("Only the first 80 itemscope elements were considered.");
    const top = scopes.filter((element, index) => {
      if (index >= 80 || referenced.has(element)) return false;
      let parent = element.parentElement;
      while (parent) {
        if (parent.hasAttribute("itemscope")) return false;
        parent = parent.parentElement;
      }
      return true;
    });
    const seen = new Set<Element>();
    const items = top.slice(0, MAX_ITEMS).map((element) => readItem(element, seen, 0, limitations));
    if (top.length > MAX_ITEMS) limitations.push("Microdata items stopped at 40.");
    return { items, limitations: unique(limitations) };
  }

  function readItem(
    element: Element,
    seen: Set<Element>,
    depth: number,
    limitations: string[],
  ): { "@type": string; "@id": string; properties: Record<string, unknown[]> } {
    if (depth > MAX_DEPTH || seen.has(element)) {
      limitations.push(
        depth > MAX_DEPTH ? "Nested items stopped at depth 6." : "An itemref cycle was stopped.",
      );
      return { "@type": "", "@id": "", properties: {} };
    }
    seen.add(element);
    const type = (element.getAttribute("itemtype") || "").trim();
    if (!type) limitations.push("An itemscope has no itemtype.");
    const properties: Record<string, unknown[]> = {};
    const used = new Set<Element>();
    const roots = [element];
    for (const id of tokens(element.getAttribute("itemref"))) {
      const found = element.ownerDocument?.getElementById(id);
      if (!found || found === element || seen.has(found)) {
        if (found) limitations.push("An itemref cycle was stopped.");
        continue;
      }
      const back = tokens(found.getAttribute("itemref")).some((backId) => {
        const target = element.ownerDocument?.getElementById(backId);
        return target != null && seen.has(target);
      });
      if (back) limitations.push("An itemref cycle was stopped.");
      roots.push(found);
    }
    for (const scope of roots)
      collectProps(scope, element, properties, used, seen, depth, limitations);
    return { "@type": type, "@id": (element.getAttribute("itemid") || "").trim(), properties };
  }

  function collectProps(
    scope: Element,
    item: Element,
    properties: Record<string, unknown[]>,
    used: Set<Element>,
    seen: Set<Element>,
    depth: number,
    limitations: string[],
  ) {
    scope.querySelectorAll("[itemprop]").forEach((node) => {
      if (used.has(node) || node === item || closer(node, scope, "itemscope")) return;
      used.add(node);
      const value = node.hasAttribute("itemscope")
        ? readItem(node, seen, depth + 1, limitations)
        : microValue(node);
      for (const name of tokens(node.getAttribute("itemprop"))) {
        const list = properties[name] ?? [];
        if (list.length >= MAX_PROPS) {
          limitations.push("Some Microdata properties were truncated.");
          continue;
        }
        list.push(value);
        properties[name] = list;
      }
    });
  }

  function microValue(element: Element): string {
    const tag = element.tagName;
    if (tag === "META") return text(element.getAttribute("content"));
    if (tag === "A" || tag === "LINK" || tag === "AREA") return url(element, "href");
    if (
      tag === "IMG" ||
      tag === "AUDIO" ||
      tag === "SOURCE" ||
      tag === "VIDEO" ||
      tag === "TRACK"
    ) {
      return url(element, "src");
    }
    if (tag === "OBJECT") return url(element, "data");
    if (tag === "DATA" || tag === "METER") return text(element.getAttribute("value"));
    if (tag === "TIME") return text(element.getAttribute("datetime") || element.textContent);
    return text(element.textContent);
  }

  function extractRdfa(root: ParentNode) {
    const limitations: string[] = [];
    if (root.querySelector("[rev]")) limitations.push("rev is not read.");
    if (root.querySelector("[datatype]")) {
      limitations.push("datatype is not applied. The text value is kept.");
    }
    const typed = Array.from(root.querySelectorAll("[typeof]"));
    if (typed.length > MAX_ITEMS) limitations.push("RDFa items stopped at 40.");
    const top = typed.filter((element, index) => index < MAX_ITEMS && !ancestorTyped(element));
    if (!typed.length && limitations.length === 0) return { items: [], limitations: [] };
    const items = top.map((element) => readRdfa(element, 0, limitations));
    if (root.querySelector("[rel]")) {
      limitations.push(
        "rel is copied only when it has an href. Chained incomplete triples are not read.",
      );
    }
    return { items, limitations: unique(limitations) };
  }

  function ancestorTyped(element: Element): boolean {
    let parent = element.parentElement;
    while (parent) {
      if (parent.hasAttribute("typeof")) return true;
      parent = parent.parentElement;
    }
    return false;
  }

  function readRdfa(
    element: Element,
    depth: number,
    limitations: string[],
  ): { "@type": string[]; "@id": string; properties: Record<string, unknown[]> } {
    if (depth > MAX_DEPTH) {
      limitations.push("Nested RDFa stopped at depth 6.");
      return { "@type": [], "@id": "", properties: {} };
    }
    const properties: Record<string, unknown[]> = {};
    element.querySelectorAll("[property], [rel]").forEach((node) => {
      if (node === element || closer(node, element, "typeof")) return;
      if (node.hasAttribute("property")) {
        const name = resolveTerm(node.getAttribute("property"), node, limitations);
        const value = node.hasAttribute("typeof")
          ? readRdfa(node, depth + 1, limitations)
          : rdfaValue(node);
        pushProp(properties, name, value, limitations);
        return;
      }
      const href = node.getAttribute("href");
      if (!href) return;
      pushProp(
        properties,
        resolveTerm(node.getAttribute("rel"), node, limitations),
        url(node, "href"),
        limitations,
      );
    });
    return {
      "@type": tokens(element.getAttribute("typeof")).map((token) =>
        resolveTerm(token, element, limitations),
      ),
      "@id": urlOrText(
        element.getAttribute("resource") || element.getAttribute("about") || "",
        element,
      ),
      properties,
    };
  }

  function rdfaValue(element: Element): string {
    if (element.hasAttribute("content")) return text(element.getAttribute("content"));
    if (element.hasAttribute("href")) return url(element, "href");
    if (element.hasAttribute("src")) return url(element, "src");
    return text(element.textContent);
  }

  function resolveTerm(value: string | null, element: Element, limitations: string[]): string {
    const token = (value || "").trim().split(/\s+/)[0] ?? "";
    if (!token) return "";
    if (/^https?:\/\//i.test(token)) return token;
    const colon = token.indexOf(":");
    if (colon > 0) {
      const prefix = token.slice(0, colon);
      const rest = token.slice(colon + 1);
      const base = prefixMap(element).get(prefix);
      if (!base) {
        limitations.push("A prefix was not declared.");
        return token;
      }
      return base + rest;
    }
    const base = vocab(element);
    return base ? base + token : token;
  }

  function vocab(element: Element): string {
    let current: Element | null = element;
    while (current) {
      const value = current.getAttribute("vocab")?.trim();
      if (value) return value.endsWith("/") || value.endsWith("#") ? value : `${value}/`;
      current = current.parentElement;
    }
    return "";
  }

  function prefixMap(element: Element): Map<string, string> {
    const map = new Map<string, string>();
    const chain: Element[] = [];
    let current: Element | null = element;
    while (current) {
      chain.push(current);
      current = current.parentElement;
    }
    for (const node of chain.reverse()) {
      const parts = (node.getAttribute("prefix") || "").trim().split(/\s+/).filter(Boolean);
      for (let index = 0; index + 1 < parts.length; index += 2) {
        const key = parts[index]?.replace(/:$/, "");
        const value = parts[index + 1];
        if (key && value) map.set(key, value);
      }
    }
    return map;
  }

  function pushProp(
    properties: Record<string, unknown[]>,
    name: string,
    value: unknown,
    limitations: string[],
  ) {
    if (!name) return;
    const list = properties[name] ?? [];
    if (list.length >= MAX_PROPS) {
      limitations.push("Some RDFa properties were truncated.");
      return;
    }
    list.push(value);
    properties[name] = list;
  }

  function closer(node: Element, scope: Element, attribute: string): boolean {
    let parent = node.parentElement;
    while (parent && parent !== scope) {
      if (parent.hasAttribute(attribute)) return true;
      parent = parent.parentElement;
    }
    return false;
  }

  function tokens(value: string | null): string[] {
    return (value || "").trim().split(/\s+/).filter(Boolean);
  }

  function text(value: string | null): string {
    return (value || "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
  }

  function url(element: Element, attribute: string): string {
    return urlOrText(element.getAttribute(attribute) || "", element);
  }

  function urlOrText(value: string, element: Element): string {
    if (!value) return "";
    try {
      return new URL(value, element.ownerDocument?.baseURI || undefined).href.slice(0, 500);
    } catch {
      return text(value);
    }
  }

  function unique(values: string[]): string[] {
    return [...new Set(values)].slice(0, 8);
  }

  const blocks: MarkupBlock[] = [];
  const microdata = extractMicrodata(root);
  if (microdata.items.length || microdata.limitations.length) {
    blocks.push({ format: "microdata", raw: JSON.stringify(microdata) });
  }
  const rdfa = extractRdfa(root);
  if (rdfa.items.length || rdfa.limitations.length) {
    blocks.push({ format: "rdfa", raw: JSON.stringify(rdfa) });
  }
  return blocks;
}
