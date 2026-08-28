const STOP_WORDS = new Set(['a', 'ale', 'bez', 'co', 'do', 'i', 'jak', 'je', 'jsou', 'k', 'ke', 'na', 'nebo', 'o', 'od', 'po', 'pro', 'se', 's', 'si', 'u', 'v', 've', 'z', 'ze']);

export function buildCourseSearchIndex(courses = []) {
  return courses.flatMap(course => (course.modules || []).flatMap((module, moduleIndex) =>
    (module.items || []).map((item, itemIndex) => {
      const plainText = stripMarkdown(item.markdown || '');
      return {
        courseSlug: course.slug,
        courseTitle: course.title,
        courseSubtitle: course.subtitle || '',
        courseCategoryId: course.categoryId || '',
        moduleTitle: module.title,
        moduleIndex,
        itemId: item.id,
        itemTitle: item.title,
        itemKind: item.kind,
        itemIndex,
        minutes: Number(item.minutes || 0),
        plainText,
        normalized: normalize([course.title, course.subtitle, module.title, item.title, plainText].join(' ')),
      };
    })));
}

export function searchCourseIndex(index = [], query = '', limit = 24) {
  const normalizedQuery = normalize(query);
  const tokens = tokenize(normalizedQuery);
  if (normalizedQuery.length < 2 || !tokens.length) return [];
  const safeLimit = Math.min(Math.max(Number(limit) || 24, 1), 50);

  return index
    .map(entry => ({ entry, score: scoreEntry(entry, normalizedQuery, tokens) }))
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score
      || a.entry.courseTitle.localeCompare(b.entry.courseTitle, 'cs')
      || a.entry.moduleIndex - b.entry.moduleIndex
      || a.entry.itemIndex - b.entry.itemIndex)
    .slice(0, safeLimit)
    .map(({ entry, score }) => ({
      courseSlug: entry.courseSlug,
      courseTitle: entry.courseTitle,
      courseCategoryId: entry.courseCategoryId,
      moduleTitle: entry.moduleTitle,
      itemId: entry.itemId,
      itemTitle: entry.itemTitle,
      itemKind: entry.itemKind,
      minutes: entry.minutes,
      snippet: createSnippet(entry.plainText, tokens),
      score,
    }));
}

function scoreEntry(entry, phrase, tokens) {
  const course = normalize(`${entry.courseTitle} ${entry.courseSubtitle}`);
  const module = normalize(entry.moduleTitle);
  const title = normalize(entry.itemTitle);
  if (!tokens.every(token => entry.normalized.includes(token))) return 0;
  let score = tokens.reduce((total, token) => total
    + (title.includes(token) ? 18 : 0)
    + (module.includes(token) ? 9 : 0)
    + (course.includes(token) ? 6 : 0)
    + Math.min(6, occurrences(entry.normalized, token)), 0);
  if (title.includes(phrase)) score += 40;
  else if (module.includes(phrase)) score += 20;
  else if (entry.normalized.includes(phrase)) score += 10;
  return score;
}

function createSnippet(text, tokens) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const normalized = normalize(clean);
  const positions = tokens.map(token => normalized.indexOf(token)).filter(index => index >= 0);
  const center = positions.length ? Math.min(...positions) : 0;
  const start = Math.max(0, center - 90);
  const raw = clean.slice(start, start + 260).trim();
  return `${start ? '…' : ''}${raw}${start + 260 < clean.length ? '…' : ''}`;
}

function stripMarkdown(value) {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  return [...new Set(value.split(' ').filter(token => token.length > 1 && !STOP_WORDS.has(token)))];
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('cs')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function occurrences(haystack, needle) {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}
