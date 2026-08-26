import { readFile } from 'node:fs/promises';
import { normalize } from './knowledge.js';

const ACCESS_LEVELS = new Set(['ai_coaching', 'support_only', 'human_only']);
const STABILIZATION_FAMILIES = new Set([
  'trauma_informed_support',
  'mindfulness',
  'relaxation',
  'emotion_skills',
]);
const MEDITATION_FAMILIES = new Set(['mindfulness', 'relaxation', 'trauma_informed_support']);
const ROUTING_STOP_WORDS = new Set([
  'aby', 'ale', 'ani', 'bez', 'bych', 'byla', 'bylo', 'byly', 'chci', 'coz', 'jako', 'jsem', 'jsme',
  'jsou', 'kdyz', 'která', 'ktere', 'který', 'mela', 'meli', 'melo', 'může', 'nebo', 'neni',
  'mam', 'mám', 'podle', 'pokud', 'potrebuji', 'potřebuji', 'proto', 'protoze', 'prave', 'sama', 'sebe', 'tahle', 'takze', 'taky',
  'tohle', 'tomu', 'tvoje', 'tvou', 'vsechno', 'zase', 'ze',
]);

export async function loadTechniqueAtlas(path) {
  const parsed = JSON.parse(await readFile(path, 'utf8'));
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Master Technique Atlas je prázdný.');
  }
  const cards = parsed.map(validateTechniqueCard);
  if (new Set(cards.map(card => card.id)).size !== cards.length) {
    throw new Error('Master Technique Atlas obsahuje duplicitní ID.');
  }
  return cards;
}

export function selectTechniqueCards(cards, text = '', mode = 'diagnostika', safetyLevel = 'normal') {
  if (safetyLevel === 'critical') return [];
  const query = normalize(text);
  if (!query) return [];
  const queryTokens = new Set(query.split(/\s+/).filter(token => token.length >= 3));

  return cards
    .filter(card => card.access_level !== 'human_only')
    .filter(card => isAllowedForMode(card, mode))
    .map(card => ({ card, score: scoreCard(card, query, queryTokens, mode, safetyLevel) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.card.name.localeCompare(b.card.name, 'cs'))
    .slice(0, 2)
    .map(item => item.card);
}

export function formatTechniqueCards(cards) {
  if (!cards?.length) {
    return 'Atlas pro tento vstup nevybral žádnou techniku. Neimprovizuj klinickou intervenci; nejdřív doplň kontext nebo nabídni bezpečnou lidskou pomoc.';
  }
  return cards.map(card => [
    `[${card.id}] ${card.name} | rodina: ${card.family} | přístup: ${card.access_level}`,
    `Vhodné když: ${card.use_when.join('; ')}`,
    `Jádro postupu: ${card.core_move}`,
    `Nepoužít / zastavit: ${card.avoid.join('; ')}`,
    `Nikdy neslibovat: ${card.never_claim.join('; ')}`,
    `Původ / standard: ${card.origin_or_standard}`,
  ].join('\n')).join('\n\n');
}

function validateTechniqueCard(card) {
  const requiredStrings = ['id', 'name', 'family', 'access_level', 'core_move', 'origin_or_standard'];
  for (const field of requiredStrings) {
    if (typeof card?.[field] !== 'string' || !card[field].trim()) {
      throw new Error(`Technika nemá platné pole ${field}.`);
    }
  }
  if (!ACCESS_LEVELS.has(card.access_level)) {
    throw new Error(`Technika ${card.id} má neplatnou úroveň přístupu.`);
  }
  for (const field of ['keywords', 'use_when', 'avoid', 'never_claim']) {
    if (!Array.isArray(card[field]) || card[field].length === 0) {
      throw new Error(`Technika ${card.id} nemá vyplněné pole ${field}.`);
    }
  }
  if (card.steps !== undefined && (!Array.isArray(card.steps) || card.steps.length === 0 || card.steps.some(step => typeof step !== 'string' || !step.trim()))) {
    throw new Error(`Technika ${card.id} má neplatné volitelné pole steps.`);
  }
  if (card.step_kinds !== undefined && (
    !Array.isArray(card.step_kinds)
    || !Array.isArray(card.steps)
    || card.step_kinds.length !== card.steps.length
    || card.step_kinds.some(kind => !['elicitation', 'intervention'].includes(kind))
  )) {
    throw new Error(`Technika ${card.id} má neplatné volitelné pole step_kinds.`);
  }
  return card;
}

function isAllowedForMode(card, mode) {
  if (mode === 'podporna_stabilizace') return STABILIZATION_FAMILIES.has(card.family);
  if (mode === 'somaticka_konzultace') return STABILIZATION_FAMILIES.has(card.family);
  if (mode === 'vedena_meditace') return MEDITATION_FAMILIES.has(card.family);
  if (mode === 'nlp_konzultace') {
    return ['nlp_inspired', 'core_coaching', 'communication', 'solution_focused'].includes(card.family);
  }
  if (mode === 'behavioralni_konzultace') {
    return ['cognitive_behavioral_coaching', 'goal_execution', 'behavior_change', 'decision_support', 'cbt_inspired', 'act_inspired', 'motivational_interviewing', 'learning', 'productivity', 'core_coaching'].includes(card.family);
  }
  if (['mentoring', 'mentoringova_konzultace'].includes(mode)) {
    return ![
      'nlp_inspired',
      'mindfulness',
      'relaxation',
      'trauma_informed_support',
      'emotion_skills',
    ].includes(card.family);
  }
  return card.access_level !== 'support_only' || hasSupportContext(card);
}

function hasSupportContext(card) {
  return ['emotion_skills', 'communication', 'mindfulness', 'trauma_informed_support'].includes(card.family);
}

function scoreCard(card, query, queryTokens, mode, safetyLevel) {
  let score = 0;
  for (const keyword of card.keywords) {
    const normalizedKeyword = normalize(keyword);
    if (query.includes(normalizedKeyword) && !ROUTING_STOP_WORDS.has(normalizedKeyword)) {
      score += normalizedKeyword.includes(' ') ? 9 : 5;
    }
    const keywordTokens = normalizedKeyword
      .split(/\s+/)
      .filter(token => token.length >= 3 && !ROUTING_STOP_WORDS.has(token));
    score += keywordTokens.filter(token => queryTokens.has(token)).length * 2;
  }

  if (/cen|marz|zisk|naklad|cashflow|prijm|vydaj/.test(query)) {
    if (card.family === 'business_finance' || card.id === 'pricing_ladder') score += 14;
    else if (card.family.startsWith('business_')) score -= 3;
  }
  if (/nabidk|produkt|cilov|zakazn|klient.*problem/.test(query) && card.family === 'business_offer') score += 12;
  if (/free trial|zkusebn.*obdob|automatick.*obnov|karta.*predem|zrus.*(?:clenstv|predplat)|subscription/.test(query)
    && card.id === 'ethical_free_trial_design') score += 42;
  if (/valid(?:ac|ov)|pruzkum trhu|overit.*(?:napad|produkt|sluzb|trh)|placen.*pilot|kupni zajem/.test(query) && card.id === 'customer_discovery') score += 30;
  if (/lead|prodej|follow|akvizic/.test(query) && card.family === 'business_sales') score += 12;
  if (/pixel|dataset|tracking|mereni konverz|odkud prisel lead/.test(query) && card.id === 'meta_tracking_readiness') score += 19;
  if (/reklam.*zamit|policy|compliance|before after|citliv.*tema/.test(query) && card.id === 'meta_compliance_preflight') score += 18;
  if (/struktur.*kampan|campaign.*adset|cbo|abo|kolik kampani/.test(query) && card.id === 'meta_campaign_architecture') score += 17;
  if (/retarget|remarket|tepl.*publik|navstev.*web|opusten.*formular/.test(query) && card.id === 'meta_retargeting_message_ladder') score += 18;
  if (/reklam.*uhel|testimonial|ugc|creative|kreativ.*reklam/.test(query) && card.id === 'meta_creative_angle_brief') score += 15;
  if (/video.*reklam|hook|skript|reels.*reklam/.test(query) && card.id === 'meta_video_script_builder') score += 17;
  if (/instant form|webov.*formular|messenger.*lead|whatsapp.*lead|call ads/.test(query) && card.id === 'meta_lead_route_selector') score += 19;
  if (/skalo|zvysit rozpocet|vertical scaling|horizontal scaling|roas kles/.test(query) && card.id === 'meta_scaling_readiness') score += 19;
  if (/atribuc|conversion window|roas nesedi|google.*prodej|meta.*prodej/.test(query) && card.id === 'meta_attribution_lag_check') score += 18;
  if (/black friday|sezonni kampan|media plan|vanocni reklam/.test(query) && card.id === 'meta_seasonal_media_plan') score += 20;
  if (/deleg|tym|vsechno sama/.test(query) && card.family === 'business_operations') score += 12;
  if (/rozhod|dilema|variant/.test(query) && ['business_decision', 'core_coaching'].includes(card.family)) score += 7;
  if (/nejsem dost|selzu|presvedcen|myslenk/.test(query) && ['cbt_inspired', 'act_inspired'].includes(card.family)) score += 8;
  if (/neschopn|k nicemu|jsem marna|jsem hrozna/.test(query) && card.id === 'accurate_self_talk_edit') score += 28;
  if (/vnitrni hlas|sebemluv|self[- ]?talk|vzdycky selzu|nedokazu|preprogram/.test(query) && card.id === 'accurate_self_talk_edit') score += 25;
  if (/nemam cas|kam to dat|novy navyk|rutina/.test(query) && card.id === 'habit_space_design') score += 14;
  if (/moc navyku|kde zacit|nejvetsi dopad|paka/.test(query) && card.id === 'keystone_habit_selector') score += 15;
  if (/prokrast|odklad|nemuzu zacit|vyhybam se/.test(query) && card.id === 'procrastination_friction_map') score += 19;
  if (/zlozvyk|spoustec|automaticky|scroll|kontrol.*email|nahradit.*navyk/.test(query) && card.id === 'low_risk_habit_loop_replacement') score += 20;
  if (/cil|pokrok|milnik|merit/.test(query) && card.id === 'goal_evidence_ladder') score += 13;
  if (/nesoustred|rozptyl|multitask|focus|telefon/.test(query) && card.id === 'single_task_focus_block') score += 17;
  if (/plan.*dne|naplanovat.*zitra|vecerni plan|ranni chaos|priority.*dne/.test(query) && card.id === 'next_day_priority_plan') score += 18;
  if (/batch|davkov.*ukol|email.*najednou|natocit.*vide|obsah.*dopredu|prepin.*kontext/.test(query) && card.id === 'similar_task_batching_test') score += 17;
  if (/strateg.*cil|dilc.*cil|jak dosahnout.*cil|plan.*cil|priorit.*aktivit/.test(query) && card.id === 'goal_strategy_cascade') score += 19;
  if (/feedback|zpetn.*vazb|zlepsit dovednost|trenink/.test(query) && card.id === 'skill_feedback_loop') score += 15;
  if (/zapamat|retenc|poznamk|uceni|kurz/.test(query) && card.id === 'active_recall_capture') score += 15;
  if (/neprijemn.*vzpomink|bolestn.*vzpomink|pustit.*minul|zmenit.*vyznam|emoci.*naboj/.test(query) && card.id === 'nia_memory_release_practice') score += 24;
  if (/cviceni.*koncentr|brain builder|trenink.*soustred|trenink.*pozornost|mentaln.*vypoct|jedin.*myslenk/.test(query) && card.id === 'nia_concentration_training_menu') score += 24;
  if (/udrzet.*fokus|udrzet.*soustred|ztracim.*pozornost|mind map|myslenk.*map|vnitrn.*rozptyl|relevanc.*ukol/.test(query) && card.id === 'focus_maintenance_seven_strategies') score += 25;
  if (/motivac.*ucen|nemam motivac.*ucit|studijn.*motivac|proc se ucim|rozjet.*ucen/.test(query) && card.id === 'learning_motivation_boost') score += 25;
  if (/porozumen.*text|ctu.*nepamatu|reading comprehension|retenc.*cten|shrnut.*odstav|hlavn.*myslenk.*text/.test(query) && card.id === 'reading_comprehension_five_moves') score += 25;
  if (/vizualn.*pribeh|imaginac.*pamet|propojit.*informac.*obraz|kreativn.*zapamat/.test(query) && card.id === 'imaginative_memory_story') score += 25;
  if (/pametov.*palac|memory palace|metod.*loci|zapamat.*seznam|tras.*pam|kotv.*prostor/.test(query) && card.id === 'memory_palace_route') score += 25;
  if (/zmenit.*navyk|zmenit.*vzorec|preprogram.*navyk|proces.*zmen|napojit.*navyk|vecern.*mental/.test(query) && card.id === 'neuroplasticity_change_process') score += 25;
  if (/brain builder|trenovat.*mozek|nov.*dovednost|mentaln.*stimul|ucit.*neco.*nov|novost.*obtiznost/.test(query) && card.id === 'brain_builder_activity_design') score += 25;
  if (/vsimat.*okol|mentaln.*autopilot|jedu.*autopilot|vedom.*pruzkum|nov.*pohled|stereotyp.*inspirac/.test(query) && card.id === 'awareness_novelty_scan') score += 25;
  if (/10 minut|deset minut|kratk.*blok|ztratil.*momentum|rychl.*restart|rozjet.*aspon/.test(query) && card.id === 'ten_minute_momentum_check') score += 25;
  if (/regenerac|recovery|vycerpan|obnov.*energ|energie.*vysled|vyhodnot.*vysled|zpetn.*vazb.*produktivit/.test(query) && card.id === 'recovery_feedback_loop') score += 25;
  if (/zapamatovatel|co si.*mozek.*uloz|prvenstv|cerstvost|prekvapen.*pam|emocn.*dopad|primacy|recency/.test(query) && card.id === 'memory_signal_design') score += 25;
  if (/14.*technik.*pamet|zlepsit.*pamet|pamatuj.*spat|chunking|elaborativ|vybavovac.*podnet|doodl/.test(query) && card.id === 'memory_fourteen_tool_selector') score += 25;
  if (/stroop|barevn.*slov|barv.*inkoust|hlavolam.*koncentr|konflikt.*cten.*barv|inhibic/.test(query) && card.id === 'stroop_concentration_practice') score += 25;
  if (/ambival|nevim jestli|chci.*ale/.test(query) && card.family === 'motivational_interviewing') score += 10;
  if (/meta mirror|vztahov.*zrcadl|jak pusobim.*(?:konflikt|interakc)/.test(query) && card.id === 'nlp_meta_mirror') score += 30;
  if (/satir|co se (?:ne)?stane.*(?:udelam|neudelam)|ctyri.*(?:otazk|variant)/.test(query) && card.id === 'nlp_satir_decision_matrix') score += 30;
  if (/lazarus|jedn.*slov|jadro.*problem|nedokaz.*shrn|ztracim se.*temat/.test(query) && card.id === 'nlp_lazarus_focus') score += 30;
  if (/hierarch.*hodnot|hodnot.*priorit|soulad.*hodnot|vnitrni konflikt.*hodnot/.test(query) && card.id === 'nlp_values_hierarchy') score += 30;
  if (/submodal|vlastnost.*predstav|obraz.*budouc|jak.*(?:vypada|zni|citi).*cil/.test(query) && card.id === 'nlp_submodality_goal') score += 30;
  if (/pacing|leading|nejdriv.*porozum.*potom.*ved|naladit.*komunikac/.test(query) && card.id === 'nlp_pacing_leading') score += 30;
  if (/ctyri.*urovn.*komunik|co.*(?:rek|sdel).*co.*slysel|nedorozum.*(?:sdel|vyznam)/.test(query) && card.id === 'nlp_four_levels_communication') score += 30;
  if (/johari|slepe mist|jak me vidi.*druz|zpetn.*vazb.*sebeuvedom/.test(query) && card.id === 'nlp_johari_feedback') score += 30;
  if (/modelov.*strateg|modelov.*uspe|rozebrat.*postup.*(?:vzor|clovek)|neslep.*kopir/.test(query) && card.id === 'nlp_modeling_strategy') score += 30;
  if (/future pacing|budouc.*mentaln.*zkous|predstav.*(?:za pul roku|za rok|pristi situac)/.test(query) && card.id === 'nlp_future_pacing') score += 30;
  if (/attending|immediacy|co se deje mezi nami|rozpor.*(?:slov|rik).*jednan|ted.*rozhovor/.test(query) && card.id === 'nlp_attending_immediacy') score += 30;
  if (/cartesian|kartez|opportunity cost|co (?:ne)?nastane.*kdyz/.test(query) && card.id === 'nlp_cartesian_consequence_check') score += 30;
  if (/metafor|prirovnan|jako bych|obraz.*problem/.test(query) && card.id === 'nlp_metaphor_exploration') score += 30;
  if (/swish|prerusit.*automat|spoustec.*nov.*reakc|mentaln.*nacvik.*navyk/.test(query) && card.id === 'nlp_swish_habit_rehearsal') score += 30;
  if (/trauma|fobi|zavisl|sebeposkoz|poruch.*prijmu.*potrav/.test(query) && card.id === 'nlp_swish_habit_rehearsal') score -= 100;
  if (/logical levels|neurologic.*levels|soulad.*cil|kongruenc.*cil|prostred.*dovednost.*presvedcen.*identit/.test(query) && card.id === 'nlp_logical_levels_alignment') score += 30;
  if (/nlp state|map.*stav|fyziolog.*myslen.*emoc|z ceho.*sklada.*stav/.test(query) && card.id === 'nlp_state_map') score += 30;
  if (/trauma|flashback|panik|uzkost|rozklep/.test(query) && card.family === 'trauma_informed_support') score += 16;
  if (/spiral|pribeh|myslenk.*dokola/.test(query) && card.id === 'story_sensation_choice') score += 13;
  if (/spiral|rumin|myslenk.*dokola|porad.*premysl|uzitecn.*myslenk/.test(query) && card.id === 'thought_usefulness_gate') score += 24;
  if (/projekc|obvin|vina|moje chyba|odpovednost/.test(query) && card.id === 'agency_without_self_blame') score += 15;
  if (/stud|stydim|ponizen|sebeobvin|selhal/.test(query) && card.id === 'shame_validation_choice') score += 24;
  if (/nechci zavrit oci|nedokazu se soustredit|kratk.*cviceni/.test(query) && card.id === 'somatic_dialogue_practice_switch') score += 14;
  if (/somatick.*cvicen|somatick.*prax|nechci zavrit oci|moznost.*skonc|souhlas/.test(query) && card.id === 'somatic_permission_gate') score += 26;
  if (/telesn.*vjem|tlak|teplo|mravenc|kde.*citim|popsat.*telo/.test(query) && card.id === 'neutral_sensation_description') score += 22;
  if (/meditac|relax|dech/.test(query) && ['mindfulness', 'relaxation'].includes(card.family)) score += 12;
  if (/meditace mi nejde|klid.*znervoz|nevydrzim sedet/.test(query) && card.id === 'stillness_readiness') score += 18;
  if (/pohyb|rozhybat|protahnout/.test(query) && card.id === 'gentle_mobilization_choice') score += 14;
  if (/co mi pomaha|vlastni plan|rutina.*stres/.test(query) && card.id === 'personal_regulation_recipe') score += 14;
  if (/konflikt|hranice|rict ne|pozadat|omluv/.test(query) && card.family === 'communication') score += 10;
  if (/elitea.*compass|chci.*(?:zmenu|transformac)|zasadn.*posun|motam.*kruh|nevim.*kudy.*dal|zasekl.*bez.*posun/.test(query) && card.id === 'elitea_compass') score += 44;
  if (/fakt.*(?:domnen|vyklad|predpoklad)|co.*skutecne.*vim|overit.*predpoklad|nejasn.*situac/.test(query) && card.id === 'elitea_evidence_map') score += 32;
  if (/proc.*(?:to )?nedelam|co.*brani|chybi.*kapacit|nemam.*energ|prekazk.*zmen|frikc/.test(query) && card.id === 'elitea_capacity_friction_scan') score += 34;
  if (/mal.*experiment|otestovat.*zmen|kdyz.*tak.*plan|vyhodnotit.*pokus|upravit.*krok/.test(query) && card.id === 'elitea_experiment_loop') score += 34;
  if (mode === 'podporna_stabilizace' && card.id === 'external_grounding') score += 20;
  if (mode === 'somaticka_konzultace' && ['external_grounding', 'gentle_breath_choice', 'mindful_pause'].includes(card.id)) score += 16;
  if (mode === 'somaticka_konzultace' && card.id === 'somatic_orient_choice') score += 24;
  if (mode === 'somaticka_konzultace' && card.id === 'somatic_four_phase_checkin') score += 20;
  if (mode === 'somaticka_konzultace' && card.id === 'somatic_permission_gate') score += 22;
  if (mode === 'nlp_konzultace' && card.family === 'nlp_inspired') score += 14;
  if (mode === 'behavioralni_konzultace' && ['cognitive_behavioral_coaching', 'goal_execution'].includes(card.family)) score += 12;
  if (mode === 'vedena_meditace' && ['mindful_pause', 'gentle_breath_choice'].includes(card.id)) score += 8;
  if (mode === 'koucovaci_podpora' && ['business_finance', 'business_strategy'].includes(card.family)) score -= 6;
  if (safetyLevel === 'heightened' && card.access_level === 'ai_coaching') score -= 4;
  return score;
}
