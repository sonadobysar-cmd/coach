const VISUAL_TYPES = new Set(['process', 'cycle', 'comparison', 'funnel', 'journey', 'metrics']);

export function extractCourseVisual(markdown = '') {
  const source = String(markdown || '');
  const match = source.match(/<!--\s*elitea-visual:\s*([\s\S]*?)\s*-->/i);
  if (!match) return { markdown: source, visual: null };
  let parsed;
  try {
    parsed = JSON.parse(match[1]);
  } catch {
    throw new Error('Animovaný výklad lekce nemá platný JSON.');
  }
  const visual = sanitizeCourseVisual(parsed);
  return { markdown: source.replace(match[0], '').trim(), visual };
}

export function sanitizeCourseVisual(input = {}) {
  const type = VISUAL_TYPES.has(input?.type) ? input.type : '';
  const title = clean(input?.title, 120);
  const caption = clean(input?.caption, 280);
  const items = Array.isArray(input?.items)
    ? input.items.slice(0, 7).map(item => ({
      label: clean(item?.label, 90),
      detail: clean(item?.detail, 180),
    })).filter(item => item.label)
    : [];
  if (!type || !title || items.length < 2) {
    throw new Error('Animovaný výklad potřebuje podporovaný typ, název a nejméně dva smysluplné body.');
  }
  return { type, title, caption, items };
}

export function courseVisualTypes() {
  return [...VISUAL_TYPES];
}

function clean(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}
