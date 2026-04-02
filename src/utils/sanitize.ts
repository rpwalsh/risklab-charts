// ============================================================================
// RiskLab Charts — HTML / SVG Sanitization Utilities
//
// These are the single source of truth for escaping untrusted strings before
// they are interpolated into innerHTML or attribute values.  Every rendering
// path in the library that touches data-sourced text MUST use these helpers.
// ============================================================================

/**
 * Escape a string for safe interpolation into HTML content or attribute values.
 *
 * Covers the five characters that can break out of HTML text nodes *and*
 * double-quoted attribute values:  `& < > " '`
 *
 * @example
 * ```ts
 * tip.innerHTML = `<strong>${escapeHtml(label)}</strong>`;
 * ```
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validate that a string looks like a safe CSS color value.
 *
 * Accepts hex (`#rgb`, `#rrggbb`, `#rrggbbaa`), named colors, `rgb()`,
 * `rgba()`, `hsl()`, `hsla()`, `oklch()`, `currentColor`, `transparent`,
 * and CSS custom properties (`var(--name)`).
 *
 * Returns the original string if it passes, otherwise returns a safe fallback.
 *
 * This prevents attribute-breakout via color values such as:
 *   `red" onmouseover="alert(1)`
 */
export function safeColor(color: string, fallback = '#888'): string {
  const SAFE_COLOR =
    /^(#[0-9a-f]{3,8}|transparent|currentColor|inherit|[a-z]{3,30}|(?:rgb|rgba|hsl|hsla|oklch|oklab|lch|lab|color)\([^)]{1,120}\)|var\(--[a-zA-Z0-9_-]{1,80}\))$/i;
  return SAFE_COLOR.test(color.trim()) ? color.trim() : fallback;
}

/** Event-handler attribute names that must be stripped from untrusted SVG. */
const DANGEROUS_ATTRS = /^on[a-z]+$/i;

/** Elements that must not appear in user-supplied SVG fragments. */
const DANGEROUS_TAGS = new Set([
  'script',
  'foreignobject',
  'iframe',
  'object',
  'embed',
  'applet',
  'form',
  'input',
  'textarea',
]);

/**
 * Sanitize an SVG markup string by removing `<script>`, `<foreignObject>`,
 * and all `on*` event-handler attributes.
 *
 * Uses the browser's DOMParser (no external dependency) so the SVG is never
 * inserted into the live document during sanitization.
 *
 * **When to use:** any code path that sets `element.innerHTML = userSVG`.
 *
 * @param svg  Raw SVG markup string.
 * @returns    Sanitized SVG markup string.
 */
export function sanitizeSVG(svg: string): string {
  if (typeof DOMParser === 'undefined') {
    // SSR / non-browser — strip with regex as a best-effort fallback.
    return svg
      .replace(/<script[\s>][\s\S]*?<\/script>/gi, '')
      .replace(/<foreignobject[\s>][\s\S]*?<\/foreignobject>/gi, '')
      .replace(/\s+on\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/\s+on\w+\s*=\s*'[^']*'/gi, '');
  }

  const doc = new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`,
    'image/svg+xml',
  );

  const walk = (node: Element) => {
    // Remove dangerous elements
    const children = Array.from(node.children);
    for (const child of children) {
      if (DANGEROUS_TAGS.has(child.localName.toLowerCase())) {
        child.remove();
        continue;
      }
      // Remove dangerous attributes
      for (const attr of Array.from(child.attributes)) {
        if (DANGEROUS_ATTRS.test(attr.name)) {
          child.removeAttribute(attr.name);
        }
        // Strip javascript: URIs in href/xlink:href
        if (
          (attr.name === 'href' || attr.name === 'xlink:href') &&
          /^\s*javascript:/i.test(attr.value)
        ) {
          child.removeAttribute(attr.name);
        }
      }
      walk(child);
    }
  };

  walk(doc.documentElement);
  return doc.documentElement.innerHTML;
}
