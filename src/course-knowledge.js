import { tokenize } from './knowledge.js';

const MAX_CHUNK_CHARS = 3600;

export function buildCourseKnowledge(courses = []) {
  const records = [];
  let sequence = 1_000_000;

  for (const course of courses) {
    records.push(prepareCourseRecord({
      source_id: `academy-${course.id}-overview`,
      domain: `academy:${course.id}`,
      section: course.title,
      topic: `${course.title} — odborný rámec`,
      content: [course.subtitle, course.description].filter(Boolean).join('\n\n'),
      course,
      record_kind: 'course_overview',
      practice_mode: 'method_orientation',
      sequence: sequence++,
    }));

    for (const module of course.modules || []) {
      for (const item of module.items || []) {
        const chunks = chunkMarkdown(item.markdown);
        chunks.forEach((content, chunkIndex) => {
          records.push(prepareCourseRecord({
            source_id: `academy-${course.id}-${item.id}-${chunkIndex + 1}`,
            domain: `academy:${course.id}`,
            section: `${course.title} / ${module.title}`,
            topic: item.title,
            content,
            course,
            module,
            item,
            record_kind: 'course_item',
            practice_mode: practiceModeForItem(item.kind),
            sequence: sequence++,
          }));
        });
      }
    }

    for (const material of course.materials || []) {
      const content = formatMaterial(material);
      chunkMarkdown(content).forEach((chunk, chunkIndex) => {
        records.push(prepareCourseRecord({
          source_id: `academy-${course.id}-material-${material.id}-${chunkIndex + 1}`,
          domain: `academy:${course.id}:materials`,
          section: `${course.title} / pracovní materiály`,
          topic: material.title,
          content: chunk,
          course,
          material,
          record_kind: 'course_material',
          practice_mode: 'guided_practice',
          boundary: material.boundary,
          sequence: sequence++,
        }));
      });
    }
  }

  return records;
}

export function courseKnowledgeCoverage(courses = [], records = []) {
  const coveredItemKeys = new Set(records
    .filter(record => record.record_kind === 'course_item')
    .map(record => `${record.course_id}:${record.course_item_id}`));
  const coveredMaterialKeys = new Set(records
    .filter(record => record.record_kind === 'course_material')
    .map(record => `${record.course_id}:${record.material_id}`));

  const courseItems = courses.flatMap(course => (course.modules || []).flatMap(module =>
    (module.items || []).map(item => `${course.id}:${item.id}`)));
  const courseMaterials = courses.flatMap(course => (course.materials || [])
    .map(material => `${course.id}:${material.id}`));

  return {
    courses: courses.length,
    courseItems: courseItems.length,
    coveredCourseItems: courseItems.filter(key => coveredItemKeys.has(key)).length,
    courseMaterials: courseMaterials.length,
    coveredCourseMaterials: courseMaterials.filter(key => coveredMaterialKeys.has(key)).length,
    complete: courseItems.every(key => coveredItemKeys.has(key))
      && courseMaterials.every(key => coveredMaterialKeys.has(key)),
  };
}

function prepareCourseRecord({
  source_id,
  domain,
  section,
  topic,
  content,
  course,
  module = null,
  item = null,
  material = null,
  record_kind,
  practice_mode,
  boundary = '',
  sequence,
}) {
  const searchText = [
    course.title,
    course.subtitle,
    course.topicLabel,
    module?.title,
    item?.title,
    material?.title,
    material?.categoryLabel,
    domain,
    section,
    topic,
    content,
  ].filter(Boolean).join(' ');
  const topicText = [course.title, course.topicLabel, module?.title, item?.title, material?.title, topic]
    .filter(Boolean).join(' ');

  return {
    source_id,
    domain,
    section,
    topic,
    content,
    source_type: 'elitea_academy_course',
    source_origin: `Elitea Academy / ${course.title}`,
    knowledge_role: 'approved_course_methodology',
    evidence_level: 'owner_authored_course_methodology',
    review_status: 'approved_for_ai_by_owner_request',
    approved_for_ai: true,
    owner: course.instructor || 'Nia Dobyšar',
    language: 'cs',
    use_when: [course.slug, course.topicLabel, item?.kind, material?.categoryLabel].filter(Boolean),
    do_not_use_as: course.id === 'kbt-koucink-v-praxi'
      ? ['psychotherapy', 'diagnosis', 'medical_treatment']
      : ['guarantee_of_result'],
    safety_tags: ['respect_course_boundaries'],
    version: '1.0',
    sequence,
    record_kind,
    practice_mode,
    boundary: String(boundary || '').trim(),
    course_id: course.id,
    course_slug: course.slug,
    course_title: course.title,
    module_id: module?.id || null,
    module_title: module?.title || null,
    course_item_id: item?.id || material?.itemId || null,
    course_item_kind: item?.kind || null,
    material_id: material?.id || null,
    _tokens: new Set(tokenize(searchText)),
    _topicTokens: new Set(tokenize(topicText)),
  };
}

function practiceModeForItem(kind) {
  return {
    'self-practice': 'guided_practice',
    'client-practice': 'guided_practice',
    practice: 'guided_practice',
    lesson: 'apply_principles',
    overview: 'method_orientation',
    quiz: 'knowledge_check',
  }[kind] || 'apply_principles';
}

function formatMaterial(material = {}) {
  return [
    material.purpose && `Účel: ${material.purpose}`,
    material.takeaway && `Výstup: ${material.takeaway}`,
    material.boundary && `Hranice použití: ${material.boundary}`,
    Array.isArray(material.howToUse) && material.howToUse.length
      ? `Postup:\n${material.howToUse.map((step, index) => `${index + 1}. ${step}`).join('\n')}`
      : '',
    Array.isArray(material.prompts) && material.prompts.length
      ? `Pracovní otázky:\n${material.prompts.map(prompt => `- ${prompt.label}: ${prompt.help}`).join('\n')}`
      : '',
    material.resourceMarkdown && `Doplňkový scénář nebo audio podklad:\n${material.resourceMarkdown}`,
  ].filter(Boolean).join('\n\n');
}

function chunkMarkdown(value = '', maxChars = MAX_CHUNK_CHARS) {
  const text = String(value || '').replace(/\r\n/g, '\n').trim();
  if (!text) return [];

  const paragraphs = text.split(/\n{2,}/).map(part => part.trim()).filter(Boolean);
  const chunks = [];
  let current = '';

  const pushCurrent = () => {
    if (current.trim()) chunks.push(current.trim());
    current = '';
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      pushCurrent();
      for (let offset = 0; offset < paragraph.length; offset += maxChars) {
        chunks.push(paragraph.slice(offset, offset + maxChars).trim());
      }
      continue;
    }
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > maxChars) pushCurrent();
    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  pushCurrent();
  return chunks;
}
