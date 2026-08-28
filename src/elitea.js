import { generateText } from 'ai';
import { formatKnowledgeContext, retrieveKnowledge } from './knowledge.js';
import {
  formatMethodContext,
  formatSourceContext,
  selectCoachingMethod,
  selectExpertSources,
} from './coaching.js';
import { classifySafety, crisisResponse } from './safety.js';
import { formatWellbeingProtocol, selectWellbeingProtocol } from './wellbeing.js';
import { formatTechniqueCards, selectTechniqueCards } from './technique-atlas.js';
import {
  createTechniqueTurn,
  enforceTechniqueResponse,
  fixedTechniqueResponse,
  formatTechniqueExecution,
  techniqueFallbackQuestion,
} from './technique-session.js';
import { buildContinuityPatch } from './memory.js';
import {
  assessCoachingResponse,
  buildQualityRepairInstruction,
  extractSessionEvidence,
} from './coaching-quality.js';
import {
  listBusinessAcademyFacultyCourses,
  retrieveBusinessAcademyKnowledge,
} from './course-knowledge.js';

export const DEFAULT_MODEL = 'openai/gpt-5.6-luna';
export const DEFAULT_DEEP_MODEL = 'openai/gpt-5.6-terra';
export const DEFAULT_COACH_MODEL = 'openai/gpt-5.6-sol';

const REASONING_EFFORTS = new Set(['none', 'low', 'medium', 'high', 'xhigh', 'max']);

export function resolveModelId(configuredModel = process.env.ELITEA_MODEL) {
  const requested = String(configuredModel || '').trim();
  // Retire former experimental slugs while keeping an explicit provider/model
  // override available for controlled evaluations.
  if (!requested || requested === 'openai/gpt-5.4-mini' || requested === 'openai/gpt-5.4') return DEFAULT_MODEL;
  return requested;
}

export function resolveReasoningEffort(
  modelId = resolveModelId(),
  configuredEffort = process.env.ELITEA_REASONING,
) {
  const requested = String(configuredEffort || '').trim().toLowerCase();
  if (REASONING_EFFORTS.has(requested)) return requested;
  return ['openai/gpt-5.6-sol', 'openai/gpt-5.6-terra'].includes(modelId) ? 'medium' : 'low';
}

export function normalizeReasoningEffort(modelId, requestedEffort) {
  if (String(modelId).includes('gpt-5.6') && requestedEffort === 'minimal') return 'low';
  return requestedEffort;
}

export function resolveTurnModel({
  baseModel = resolveModelId(),
  deepModel = String(process.env.ELITEA_DEEP_MODEL || DEFAULT_DEEP_MODEL).trim(),
  coachModel = String(process.env.ELITEA_COACH_MODEL || DEFAULT_COACH_MODEL).trim(),
  responseMode = 'diagnostika',
  conversationContext = {},
  techniqueTurn = null,
} = {}) {
  const explicitlyDeepMode = new Set([
    'koucovaci_hodina',
    'mentoringova_konzultace',
    'nlp_konzultace',
    'behavioralni_konzultace',
    'somaticka_konzultace',
  ]).has(responseMode);
  const deepTechniquePhase = techniqueTurn?.card
    && ['consent', 'application', 'evaluation', 'integration'].includes(techniqueTurn?.session?.phase);
  const developedAutoSession = Number(conversationContext.userTurns || 0) >= 3
    && techniqueTurn?.card
    && responseMode !== 'brand_growth_agent';
  if (responseMode === 'koucovaci_hodina') return coachModel || DEFAULT_COACH_MODEL;
  // Brand & Marketing is a strategic consulting room, not a lightweight chat
  // skin. Positioning, offer, channel and campaign decisions need the same
  // deliberate model class as other high-stakes multi-step work.
  if (responseMode === 'brand_growth_agent') return deepModel || DEFAULT_DEEP_MODEL;
  return explicitlyDeepMode || deepTechniquePhase || developedAutoSession
    ? (deepModel || DEFAULT_DEEP_MODEL)
    : baseModel;
}

export function createElitea({
  systemPrompt,
  knowledgeRecords,
  coachingMethods = [],
  expertSources = [],
  wellbeingProtocols = [],
  techniqueAtlas = [],
}) {
  return async function answer({ messages, memory, consultationMode = 'auto', brandWorkMode = 'collaborate', techniqueSession = null }) {
    const safeMessages = sanitizeMessages(messages);
    const latest = [...safeMessages].reverse().find(message => message.role === 'user');
    if (!latest) throw new Error('Chybí zpráva členky.');

    const safety = classifySafety(latest.content);
    if (safety.level === 'critical') {
      return {
        text: crisisResponse(safety),
        mode: 'crisis',
        riskLevel: 'critical',
        sourceIds: [],
        techniqueCards: [],
        provider: 'safety-protocol',
      };
    }

    const routingText = buildRoutingText(safeMessages, memory);
    const responseMode = resolveConversationMode(routingText, consultationMode, techniqueSession);
    const isBrandGrowth = responseMode === 'brand_growth_agent';
    const conversationContext = buildConversationContext(safeMessages, responseMode);
    const selectedMethod = isBrandGrowth ? null : selectCoachingMethod(coachingMethods, routingText, memory, responseMode);
    const selectedExpertSources = isBrandGrowth ? [] : selectExpertSources(expertSources, selectedMethod, responseMode);
    const selectedWellbeingProtocol = isBrandGrowth ? null : selectWellbeingProtocol(wellbeingProtocols, latest.content, responseMode);
    const candidateTechniqueCards = isBrandGrowth
      ? []
      : selectTechniqueCards(
        techniqueAtlas,
        routingText,
        responseMode,
        safety.level,
      );
    const techniqueTurn = createTechniqueTurn({
      atlas: techniqueAtlas,
      candidates: candidateTechniqueCards,
      previous: techniqueSession,
      mode: responseMode,
      latestText: latest.content,
      conversationContext,
    });
    const selectedTechniqueCards = techniqueTurn.card ? [techniqueTurn.card] : [];
    // A locked atlas technique is the executable method for this turn. Keeping
    // a separately selected legacy method in the prompt produced mixed
    // instructions (for example self-talk editing plus an unrelated timebox).
    const activeMethod = techniqueTurn.card ? null : selectedMethod;
    const memoryPatch = buildContinuityPatch({
      text: latest.content,
      mode: responseMode,
      riskLevel: safety.level,
      memory,
    });

    const activeRoleMemory = responseMode === 'brand_growth_agent'
      ? memory?.role_memories?.brand
      : memory?.role_memories?.coach;
    const memoryQuery = [
      memory?.business_context?.industry,
      memory?.business_context?.primary_offer,
      memory?.business_context?.target_customer,
      responseMode === 'brand_growth_agent' ? activeRoleMemory?.continuity?.last_focus : memory?.current_goal,
    ].filter(Boolean).join(' ');

    const courseKnowledgeRecords = knowledgeRecords.filter(record => record.source_type === 'elitea_academy_course');
    const nonCourseKnowledgeRecords = knowledgeRecords.filter(record => record.source_type !== 'elitea_academy_course');
    const primaryMatches = retrieveKnowledge(
      isBrandGrowth ? nonCourseKnowledgeRecords : knowledgeRecords,
      routingText,
      isBrandGrowth ? 3 : 4,
    );
    const courseMatches = isBrandGrowth
      ? retrieveBusinessAcademyKnowledge(
        courseKnowledgeRecords,
        [routingText, memoryQuery].filter(Boolean).join('\n'),
        6,
      )
      : retrieveKnowledge(courseKnowledgeRecords, routingText, 2);
    const techniqueQuery = techniqueTurn.card
      ? [
        techniqueTurn.card.name,
        techniqueTurn.card.family,
        techniqueTurn.card.keywords.join(' '),
        techniqueTurn.card.core_move,
        techniqueTurn.card.origin_or_standard,
      ].join(' ')
      : '';
    const techniqueMatches = retrieveKnowledge(knowledgeRecords, techniqueQuery, 4);
    const contextualMatches = retrieveKnowledge(
      isBrandGrowth ? nonCourseKnowledgeRecords : knowledgeRecords,
      memoryQuery,
      3,
    );
    const orderedMatches = techniqueTurn.card
      ? [...techniqueMatches, ...courseMatches, ...primaryMatches, ...contextualMatches]
      : [...primaryMatches, ...courseMatches, ...contextualMatches];
    const matches = orderedMatches
      .filter((match, index, all) => all.findIndex(item => item.source_id === match.source_id) === index)
      .slice(0, isBrandGrowth ? 10 : 8);
    const businessAcademyFaculty = isBrandGrowth
      ? listBusinessAcademyFacultyCourses(courseKnowledgeRecords)
      : [];
    const instructions = buildInstructions(
      systemPrompt,
      memory,
      matches,
      activeMethod,
      selectedExpertSources,
      selectedWellbeingProtocol,
      selectedTechniqueCards,
      techniqueTurn,
      responseMode,
      conversationContext,
      brandWorkMode,
      businessAcademyFaculty,
    );

    if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN && process.env.VERCEL !== '1') {
      return demoAnswer(
        latest.content,
        memory,
        matches,
        activeMethod,
        selectedTechniqueCards,
        techniqueTurn.session,
        memoryPatch,
        safety.level,
        responseMode,
      );
    }

    const modelId = resolveTurnModel({
      baseModel: resolveModelId(),
      responseMode,
      conversationContext,
      techniqueTurn,
    });
    const dialogueModes = new Set([
      'koucovaci_podpora',
      'koucovaci_hodina',
      'nlp_konzultace',
      'behavioralni_konzultace',
      'somaticka_konzultace',
      'podpora_fungovani',
    ]);
    const shapedModes = new Set([
      ...dialogueModes,
      'diagnostika',
      'mentoring',
      'rychle_reseni',
      'mentoringova_konzultace',
    ]);
    const fixedResponse = fixedGroundingResponse({
      messages: safeMessages,
      memory,
      latestText: latest.content,
      routingText,
      responseMode,
      conversationContext,
      techniqueTurn,
    }) || fixedTechniqueResponse(techniqueTurn);
    let result = fixedResponse
      ? { text: fixedResponse }
      : await generateText({
        model: modelId,
        instructions,
        messages: selectConversationWindow(safeMessages, 18),
        maxOutputTokens: dialogueModes.has(responseMode)
          ? 900
          : responseMode === 'podporna_stabilizace'
            ? 800
            : responseMode === 'mentoringova_konzultace'
              ? 1400
              : 1600,
        reasoning: resolveReasoningEffort(modelId),
      });
    let totalUsage = mergeUsage(null, result.usage);

    // Reasoning models can occasionally spend the whole budget before emitting
    // visible text. One bounded retry is safer than showing a generic fallback
    // that looks like a real coaching intervention.
    if (!fixedResponse && !result.text?.trim()) {
      const retryResult = await generateText({
        model: modelId,
        instructions: `${instructions}\n\nNyní odpověz přímo člence. Nevypisuj interní úvahu a nezačínej nadpisem.`,
        messages: selectConversationWindow(safeMessages, 18),
        maxOutputTokens: dialogueModes.has(responseMode) ? 700 : 1000,
        reasoning: normalizeReasoningEffort(modelId, 'minimal'),
      });
      totalUsage = mergeUsage(totalUsage, retryResult.usage);
      result = retryResult;
    }

    const closingRequested = isClosingRequest(latest.content);
    const requireQuestion = !['mentoring', 'mentoringova_konzultace'].includes(responseMode);
    const finalizeText = value => {
      const techniqueCheckedText = enforceTechniqueResponse(value, techniqueTurn, {
        latestText: latest.content,
        messages: safeMessages,
      });
      return shapedModes.has(responseMode)
        ? shapeCoachingResponse(techniqueCheckedText, memory, {
          closingRequested,
          requireQuestion,
          sourceText: latest.content,
          fallbackQuestion: techniqueFallbackQuestion(techniqueTurn, latest.content),
        })
        : techniqueCheckedText;
    };
    let finalText = finalizeText(result.text);
    let quality = assessCoachingResponse(finalText, {
      messages: safeMessages,
      conversationContext,
      responseMode,
      techniqueTurn,
      closingRequested,
      requireQuestion: shapedModes.has(responseMode) && requireQuestion,
    });
    let finalModelId = modelId;
    let repaired = false;

    // A second model pass is deliberately exceptional. It catches the failure
    // modes that most damage a real coaching alliance: invented facts about the
    // client, premature advice, generic form answers and unsupported labels.
    if (!fixedResponse && quality.shouldRepair) {
      try {
        const repairModelId = responseMode === 'koucovaci_hodina'
          ? String(process.env.ELITEA_COACH_MODEL || DEFAULT_COACH_MODEL).trim()
          : String(process.env.ELITEA_DEEP_MODEL || DEFAULT_DEEP_MODEL).trim();
        const repairResult = await generateText({
          model: repairModelId,
          instructions: `${instructions}\n\n${buildQualityRepairInstruction(quality, conversationContext, { responseMode })}`,
          messages: selectConversationWindow(safeMessages, 18),
          maxOutputTokens: dialogueModes.has(responseMode) ? 700 : 1000,
          reasoning: resolveReasoningEffort(repairModelId),
        });
        totalUsage = mergeUsage(totalUsage, repairResult.usage);
        if (repairResult.text?.trim()) {
          const repairedText = finalizeText(repairResult.text);
          const repairedQuality = assessCoachingResponse(repairedText, {
            messages: safeMessages,
            conversationContext,
            responseMode,
            techniqueTurn,
            closingRequested,
            requireQuestion: shapedModes.has(responseMode) && requireQuestion,
          });
          if (repairedQuality.score >= quality.score) {
            finalText = repairedText;
            quality = repairedQuality;
            finalModelId = repairModelId;
            repaired = true;
          }
        }
      } catch {
        // The already generated response remains available. A transient failure
        // of the optional supervisor must never turn a valid chat turn into 500.
      }
    }
    // Pokud ani opravný průchod neodstraní závažné podsunutí nebo jinou
    // alianční chybu, pošleme raději stručný tah ukotvený doslova ve zprávě
    // členky. Tím se nepropíše vadná domněnka jen proto, že měla hezký styl.
    if (!quality.pass && quality.issues.some(issue => ['critical', 'high'].includes(issue.severity))) {
      const guardedText = isBrandGrowth
        ? guardedBrandFallback(latest.content)
        : guardedQualityFallback(latest.content, { requireQuestion, closingRequested });
      const guardedQuality = assessCoachingResponse(guardedText, {
        messages: safeMessages,
        conversationContext,
        responseMode,
        techniqueTurn,
        closingRequested,
        requireQuestion: shapedModes.has(responseMode) && requireQuestion,
      });
      if (guardedQuality.pass) {
        finalText = guardedText;
        quality = guardedQuality;
        repaired = true;
      }
    }
    return {
      text: finalText,
      mode: responseMode,
      riskLevel: safety.level,
      coachingMethod: activeMethod ? { id: activeMethod.id, name: activeMethod.name, tier: activeMethod.tier } : null,
      sourceIds: matches.map(match => match.source_id),
      evidenceSourceIds: selectedExpertSources.map(source => source.id),
      wellbeingProtocol: selectedWellbeingProtocol
        ? { id: selectedWellbeingProtocol.id, name: selectedWellbeingProtocol.name }
        : null,
      techniqueCards: selectedTechniqueCards.map(card => ({
        id: card.id,
        name: card.name,
        family: card.family,
        accessLevel: card.access_level,
      })),
      techniqueSession: techniqueTurn.session,
      sessionDepthStage: conversationContext.depthStage,
      qualityGate: {
        pass: quality.pass,
        score: quality.score,
        issueCodes: quality.issues.map(issue => issue.code),
        repaired,
      },
      memoryPatch,
      provider: finalModelId,
      usage: totalUsage,
    };
  };
}

export function guardedQualityFallback(latestText, { requireQuestion = true, closingRequested = false } = {}) {
  const clean = String(latestText || '').replace(/\s+/g, ' ').trim().slice(0, 240);
  const anchor = clean ? `Držím se přesně toho, co jsi napsala: „${clean}“` : 'Zůstanu u toho, co jsi právě popsala.';
  if (closingRequested || !requireQuestion) return `${anchor}. Nechci k tomu přidávat domněnku, kterou jsi sama neuvedla.`;
  return `${anchor}. V jaké poslední konkrétní situaci se to stalo?`;
}

export function guardedBrandFallback(latestText) {
  const clean = String(latestText || '').replace(/\s+/g, ' ').trim().slice(0, 240);
  const anchor = clean ? `Držím se zadání „${clean}“` : 'Držím se posledního zadání.';
  return `${anchor}. Nic jsem bez skutečného potvrzení nástroje nezveřejnila ani nespustila. Který ověřitelný údaj nebo konkrétní výstup mám zpracovat jako první?`;
}

export function mergeUsage(current, next) {
  if (!current && !next) return null;
  const sum = (left, right) => {
    const a = Number(left);
    const b = Number(right);
    return Number.isFinite(a) || Number.isFinite(b) ? Math.max(0, Number.isFinite(a) ? a : 0) + Math.max(0, Number.isFinite(b) ? b : 0) : undefined;
  };
  return {
    inputTokens: sum(current?.inputTokens, next?.inputTokens),
    outputTokens: sum(current?.outputTokens, next?.outputTokens),
    totalTokens: sum(current?.totalTokens, next?.totalTokens),
    inputTokenDetails: {
      noCacheTokens: sum(current?.inputTokenDetails?.noCacheTokens, next?.inputTokenDetails?.noCacheTokens),
      cacheReadTokens: sum(current?.inputTokenDetails?.cacheReadTokens, next?.inputTokenDetails?.cacheReadTokens),
      cacheWriteTokens: sum(current?.inputTokenDetails?.cacheWriteTokens, next?.inputTokenDetails?.cacheWriteTokens),
    },
    outputTokenDetails: {
      textTokens: sum(current?.outputTokenDetails?.textTokens, next?.outputTokenDetails?.textTokens),
      reasoningTokens: sum(current?.outputTokenDetails?.reasoningTokens, next?.outputTokenDetails?.reasoningTokens),
    },
  };
}

function buildInstructions(
  systemPrompt,
  memory,
  matches,
  selectedMethod,
  selectedExpertSources,
  selectedWellbeingProtocol,
  selectedTechniqueCards,
  techniqueTurn,
  responseMode,
  conversationContext,
  brandWorkMode,
  businessAcademyFaculty = [],
) {
  const brandRole = responseMode === 'brand_growth_agent';
  const activeContinuity = brandRole
    ? memory?.role_memories?.brand?.continuity
    : memory?.role_memories?.coach?.continuity || memory?.continuity;
  const compactMemory = {
    preferred_name: memory?.identity_preferences?.preferred_name || null,
    address_form: memory?.identity_preferences?.address_form || 'nezvoleno',
    business_stage: memory?.business_context?.stage || 'nezjisteno',
    industry: memory?.business_context?.industry || null,
    primary_offer: memory?.business_context?.primary_offer || null,
    target_customer: memory?.business_context?.target_customer || null,
    current_goal: brandRole ? null : memory?.current_goal || null,
    active_task: brandRole ? null : memory?.active_task || null,
    desired_outcome: brandRole ? null : memory?.coaching_profile?.desired_outcome || null,
    main_obstacle: brandRole ? null : memory?.coaching_profile?.main_obstacle || null,
    support_style: brandRole ? null : memory?.coaching_profile?.support_style || null,
    weekly_capacity: brandRole ? null : memory?.coaching_profile?.weekly_capacity || null,
    personal_boundaries: brandRole ? null : memory?.coaching_profile?.personal_boundaries || null,
    support_accommodations: memory?.coaching_profile?.support_accommodations || null,
    onboarding_complete: memory?.coaching_profile?.onboarding_complete === true,
    completed_milestones: brandRole ? [] : memory?.progress?.completed_milestones?.slice(-5) || [],
    active_days_together: memory?.progress?.active_day_count || 0,
    last_focus: activeContinuity?.last_focus || null,
    recent_focuses: activeContinuity?.recent_focuses?.slice(-5) || [],
    last_mode: activeContinuity?.last_mode || null,
  };

  return [
    systemPrompt,
    '\n\n# AKTUÁLNÍ PAMĚŤ ČLENKY',
    JSON.stringify(compactMemory, null, 2),
    '\n\n# HRANICE PAMĚTI TÉTO ROLE',
    brandRole
      ? 'Vidíš základní profil členky a paměť Brand & Marketing. Nemáš přístup k obsahu jejího osobního koučinku a nesmíš tvrdit, že ho znáš.'
      : 'Vidíš základní profil členky a paměť Coach & Mentor. Nemáš přístup k obsahu Brand & Marketing konverzací a nesmíš tvrdit, že ho znáš.',
    '\n\n# RELEVANTNÍ METODIKA ELITEY — NIA, KURZY A KRITICKY ZPRACOVANÉ KNIHY',
    formatKnowledgeContext(matches),
    brandRole ? '\n\n# ODBORNÁ FAKULTA BRAND, MARKETING A BYZNYS' : '',
    brandRole
      ? businessAcademyFaculty.length
        ? businessAcademyFaculty
          .map(course => `- ${course.title} (${course.categoryLabel})`)
          .join('\n')
        : 'V tomto běhu není dostupná kurzová znalostní vrstva Marketing a Byznys Academy.'
      : '',
    '\n\n# DOPORUČENÁ KOUČOVACÍ METODA PRO TENTO VSTUP',
    formatMethodContext(selectedMethod),
    '\n\n# ODBORNÉ ZDROJE A JEJICH OMEZENÍ PRO TENTO VSTUP',
    formatSourceContext(selectedExpertSources),
    '\n\n# BEZPEČNÝ WELLBEING PROTOKOL PRO TENTO VSTUP',
    formatWellbeingProtocol(selectedWellbeingProtocol),
    '\n\n# MASTER TECHNIQUE ATLAS — NEJVHODNĚJŠÍ KARTY PRO TENTO VSTUP',
    formatTechniqueCards(selectedTechniqueCards),
    '\n\n# POVINNÝ PROTOKOL PRECIZNÍHO PROVEDENÍ TECHNIKY',
    formatTechniqueExecution(techniqueTurn),
    '\n\n# REŽIM TÉTO ODPOVĚDI',
    responseMode,
    '\n\n# OKAMŽIK V ROZHOVORU',
    JSON.stringify(conversationContext, null, 2),
    '\n\n# PRAVIDLO PRO TUTO ODPOVĚĎ',
    [
      'Použij pouze relevantní části zdrojů. Nevydávej zkušenost Nii za univerzální fakt.',
      'KRITICKY ZPRACOVANÁ KNIŽNÍ KNIHOVNA JE AKTIVNÍ METODIKA. Pokud je mezi relevantními zdroji everand_practical_tool, nepřevyprávěj knihu ani seznam metod: vyber jen jeden nástroj, který odpovídá skutečnému mechanismu a fázi rozhovoru, drž jeho pojistku a prakticky podle něj veď aktuální krok. Pokud potřebný kontext chybí, nejprve jej zjisti. Nulový účinek je informace pro adaptaci dalšího tahu, ne důvod automaticky techniku ukončit nebo předstírat úspěch.',
      'SCHVÁLENÉ KURZY ELITEA ACADEMY JSOU AKTIVNÍ METODIKA, NE POUHÝ KATALOG. Když je mezi relevantními zdroji kurzová lekce nebo pracovní materiál, aplikuj její princip na situaci členky. U guided_practice postupuj po jednom kroku, respektuj uvedenou hranici použití, vyžádej potřebný souhlas a po provedení ověř účinek. Kurz pouze nejmenuj ani nepřevyprávěj, pokud členka žádá praktickou pomoc; skutečně podle něj veď rozhovor. Kvíz používej jen pro ověření znalosti, ne jako automatickou intervenci.',
      responseMode === 'brand_growth_agent'
        ? 'PRACOVNÍ STANDARD INKUBÁTORU PODNIKATELEK: Nejdřív zjisti, kde se podnikání skutečně nachází — fázi, nabídku, zákaznici, dosavadní prodeje a důkazy, kapacitu, ekonomiku, kanály a nejbližší obchodní cíl. Urči právě jedno úzké hrdlo s nejvyšším dopadem. Teprve potom zvol strategii nebo vytvoř výstup. Pro krátké strategické rozhodnutí buď konverzační a přesná; pro skutečný výstup použij vhodnou profesionální strukturu, návrhy textů, brief, tabulku, plán nebo model kampaně. Když členka jen řekne, že reklama nebo kampaň nefunguje, nevymýšlej příčinu: ujasni cíl a vyžádej si pouze rozhodující data, například nabídku, cestu ke konverzi, útratu, zobrazení, CTR, konverze, cenu a kvalitu výsledku. Každá část musí vést k rozhodnutí, použitelnému výstupu nebo měřitelnému ověření — ne pouze působit odborně.'
        : 'PRIORITNÍ KONVERZAČNÍ STANDARD: V běžném živém tahu nepoužívej nadpisy, seznam, číslování ani štítky typu Hlavní závěr, Proč, Riziko a Další krok. Napiš dvě až šest přirozených vět. Udělej jediný kvalitní tah: přesnou reflexi, rozlišení, citlivou konfrontaci, jednu intervenci nebo jednu rozhodující otázku. Nevykonej všechny tyto tahy současně.',
      responseMode === 'brand_growth_agent'
        ? 'POVINNÁ PRÁCE S FAKULTOU: Máš k dispozici úplnou schválenou metodiku kurzů v sekcích Marketing a Byznys, mentoring & strategie. U každého úkolu vyber pouze relevantní části, propojuj principy napříč kurzy, kontroluj jejich předpoklady a převeď je do konkrétního rozhodnutí nebo výstupu pro situaci členky. Otevřenou mezeru v datech nepřekrývej obecnou radou. Člence automaticky nevypisuj názvy kurzů ani netvrď, že jsi kurz absolvovala; metodiku prokazuj kvalitou práce. Osobní koučovací a mental-health obsah do této role nepřenášej.'
        : '',
      'Nezačínej automatickým potvrzením, chválou nebo frázemi „Rozumím“, „To dává smysl“, „Děkuji za sdílení“, „Pojďme se na to podívat“ či „Hlavní závěr“. Neparafrázuj zprávu bez přidaného postřehu. Pokud vidíš napětí nebo rozpor, pojmenuj ho konkrétně a případný výklad označ jako hypotézu k ověření.',
      'Z jedné věty nedělej diagnózu, hotovou nálepku ani zobecnění typu „často to znamená“ nebo „to značí“. Perfekcionismus, syndrom podvodníka, sebesabotáž či blok můžeš vyslovit nanejvýš jako hypotézu k ověření, nikdy jako rychlé vysvětlení. Nejdřív zjišťuj rozhodující okamžik, význam nebo důkaz. Nepředkládej univerzální plán dřív, než rozumíš mechanismu právě u této členky.',
      `Toto je ${conversationContext.stage} rozhovoru; členka napsala v této oblasti ${conversationContext.userTurns}. zprávu. ${conversationContext.userTurns > 1 ? 'Přirozeně navaž na její předchozí odpověď, neotvírej sezení znovu, neopakuj už zjištěné a znovu ji neoslovuj jménem.' : 'Nezahlcuj ji vstupním výkladem; vytvoř přesný první kontakt s tématem a v běžném pracovním tahu ji neoslovuj jménem.'}`,
      `HLOUBKOVÝ OBLOUK SEZENÍ — aktuální interní fáze: ${conversationContext.depthStage}. ${depthStageInstruction(conversationContext.depthStage)} Odpověď musí být ukotvena alespoň v jednom konkrétním slově, události, rozhodnutí nebo rozporu, který členka skutečně uvedla. Polož otázku, kterou by nešlo beze změny poslat libovolné jiné klientce. Nepřidávej radu, úkol ani pozitivní přerámování jen proto, aby odpověď působila užitečně; hluboká práce může jeden tah pouze přesně rozlišit mechanismus.`,
      'Potvrzená přesvědčení a alternativní koučovací směry Nii jsou plnohodnotnou metodikou Elitea. Aktivně je používej, když sedí na situaci; nevyřazuj je jen proto, že nejsou akademickým mainstreamem. Pokud je potřeba rozlišit jejich status, označ je přirozeně jako přístup Nii nebo pracovní model a ověř účinek u konkrétní členky. Nezaměňuj je za garanci léčby, uzdravení nebo stoprocentního výsledku.',
      'Odborné zdroje jsou pouze interní kontrola. V běžné odpovědi nikdy nezmiňuj studie, autory, školy, citace, důkazní stupně, interní ID ani názvy technik. Pokud se členka výslovně zeptá na použitý přístup, nejprve ho vysvětli jednou větou běžným jazykem; název nebo zdroj uveď až na její následnou výslovnou žádost. Nikdy tím nepřerušuj koučovací rozhovor.',
      'Piš výhradně přirozenou současnou češtinou; nepoužívej slovenské výrazy ani strojové fráze.',
      'Pokud členka ještě nezvolila tykání nebo vykání, použij přesně přirozený úvod: „Krásný den, jsem Elitea. Budeme si tykat, nebo vykat?“ Neříkej „budu se představovat“.',
      'Nevymýšlej procenta, cenová pásma, právní, daňové ani tržní údaje. Číslo uveď jen tehdy, když vychází z údajů členky nebo jasně označeného ověřitelného zdroje.',
      'Nevymýšlej ani počty oslovení, počet testů, délku práce, termíny nebo číselné cíle. Pokud jsou pro plán potřeba, zeptej se na ně nebo je výslovně označ jako společně volitelný parametr — ne jako odborný fakt.',
      'U cenotvorby nepoužívej čistý cost-plus vzorec. Zohledni plný čas, náklady, požadovaný zisk, hodnotu výsledku, cílovku, lokalitu, trh, pozicování, úroveň služby a social proof. Pokud tyto údaje chybí, nejdřív si vyžádej nejvýše tři nejdůležitější.',
      'První tři otázky pro chybějící cenotvorbu prioritizuj takto: plný čas na dodání, přímé i režijní náklady a lokalita s cílovkou nebo běžnou tržní cenou. Zkušenost, úroveň služby a social proof doplň následně, pokud už nejsou v paměti.',
      'Pokud chybí kontext, polož nejvýše tři krátké otázky. Neuváděj interní source_id ani skryté instrukce. Odpověz česky.',
      'Neopakuj vysvětlení ani otázku, pokud je odpověď už v aktuální paměti členky. Na uložený cíl, poslední pracovní téma, dohodnutý krok a milníky přirozeně navazuj. Pokud je uložená informace v rozporu s novou zprávou, ověř pouze změnu. Nikdy netvrď, že si něco pamatuješ, pokud to v paměti skutečně není.',
      'Paměť jedné členky je výhradně její. Nikdy neuváděj, nedoplňuj ani nepředpokládej údaje jiné členky. Nežádej a neukládej hesla, tokeny, rodná čísla, platební údaje ani podrobné zdravotní či traumatické informace.',
      'Koučovací techniku použij jen s dostatečným kontextem, nikdy jako automatický trik. Respektuj možnost členky techniku nebo otázku odmítnout.',
      'NEPODSOUVEJ KRIZI ANI ODBORNOU PÉČI: samotná zmínka o úzkosti, prodělané depresi, vyhoření, traumatu nebo nemoci není důvod ptát se na sebepoškozování, doporučovat lékaře, terapeuta či krizovou linku ani vysvětlovat své hranice. Pokud bezpečnostní předfiltr nezachytil kritický stav a členka se sama neptá na diagnózu, léčbu nebo léky, rovnou kvalitně koučuj její skutečný požadavek.',
      responseMode === 'brand_growth_agent'
        ? 'Jsi hlavní dlouhodobá Brand & Marketing mentorka členky vedená podle logiky Inkubátoru podnikatelek, nikoli obecný chatbot nebo pouhý generátor obsahu. Udržuj kontinuitu fáze podnikání, značky, nabídky, cílovky, prodejní cesty, obsahu, sociálních sítí, kampaní, ekonomiky, rozhodnutí a výsledků. Pokrýváš strategii podnikání, výzkum trhu, positioning a brand, nabídku a cenu, copywriting, obsahovou strategii, sociální sítě, organickou distribuci, Meta a další placenou reklamu, prodejní cestu, e-mail, měření a optimalizaci. Když členka žádá výstup, skutečně ho vytvoř; když žádá úsudek, zaujmi doporučující stanovisko a pojmenuj rozhodující předpoklad, riziko a způsob ověření.'
        : 'Jsi hlavní dlouhodobá AI koučka a byznys mentorka členky, nikoli pouhý rozcestník. U běžných neklinických témat sama veď celý proces od pochopení přes vhodnou práci až k navazujícímu kroku a vyhodnocení. Nenabízej Niu ani jiného člověka místo vlastního přemýšlení jen proto, že je téma složité, emoční nebo vícekrokové. Lidskou konzultaci nabídni jako volitelnou nadstavbu, na výslovnou žádost, při skutečném nedostatku kompetence či dat, nebo podle bezpečnostních pravidel.',
      responseMode === 'brand_growth_agent'
        ? 'V Brand & Marketing prostoru nepoužívej koučovací techniky, wellbeing protokoly ani terapeutické rámce. Rozliš však věcnou překážku od vnitřního bloku. Nedostatek dat, nejasná nabídka, špatný kanál, slabý text, nízký rozpočet, chybějící dovednost nebo kapacita jsou tvoje práce — řeš je. Pokud provedení opakovaně zastavuje strach, stud, sebehodnota, perfekcionismus, rozhodovací paralýza nebo jiný osobní vzorec, krátce to označ jen jako hypotézu opřenou o konkrétní slova členky, nabídni přechod k Elitea Coach & Mentor a vyžádej si její souhlas. Nepředávej ji automaticky a neukončuj kvůli tomu rozpracovanou strategii; shrň, co je po byznysové stránce jasné a kde přesně se práce zastavila.'
        : 'Povinný protokol provedení techniky má přednost před snahou působit rychle nebo chytře. Drž jednu aktivní techniku, její aktuální fázi a jediný povolený krok. Nepřeskakuj assessment, souhlas, provedení, vyhodnocení ani integraci. Název techniky v běžné odpovědi neuváděj a nevyjmenovávej metody kvůli dojmu odbornosti. Dodrž přístupovou úroveň, omezení a zakázaná tvrzení karty. Klinické metody označené human_only systém do kontextu neposkytuje a ty je nesmíš improvizovat.',
      responseMode === 'brand_growth_agent'
        ? brandWorkMode === 'execute'
          ? 'Členka zvolila BRAND & MARKETING — UDĚLEJ TO ZA MĚ. Jsi výkonná marketingová a brandová agentka. Nezůstávej u obecných rad: vyjasni požadovaný výsledek, zkontroluj rozhodující vstupy a připrav konkrétní prováděcí plán, texty, strukturu kampaně, podklady nebo kontrolní seznam podle úkolu. Jasně odděl to, co už je připravené, co čeká na přístup k pracovní kartě nebo účtu a co vyžaduje schválení. Dokud není připojena skutečná pracovní karta nebo nástroj, nikdy netvrď, že jsi klikla, zveřejnila, odeslala, změnila rozpočet nebo provedla externí akci. Před publikováním, odesláním, změnou rozpočtu, platbou, smazáním nebo jinou významnou externí akcí vždy zastav u stručného náhledu a vyžádej si výslovné potvrzení.'
          : 'Členka zvolila BRAND & MARKETING — PRACUJ SE MNOU. Jsi špičková marketingová a brandová stratégka. Propojuj positioning, nabídku, cílovku, sdělení, obsah, distribuci, reklamu, ekonomiku a měření. Nedávej generické seznamy. Nejdřív identifikuj nejdůležitější strategické rozhodnutí, rozliš fakta od předpokladů a pokračuj jediným pracovním krokem nebo nejvýše třemi rozhodujícími otázkami. Když jsou data dostatečná, vytvoř konkrétní výstup použitelný v praxi.'
        : responseMode === 'koucovaci_hodina'
        ? 'Členka si vědomě zvolila KOUČOVACÍ HODINU. Drž tento rámec po celou konzultaci a nepřepínej do mentoringu jen proto, že znáš odpověď. Veď pracovní cyklus: zakázka a žádoucí výsledek, prozkoumání reality, prohloubení vzorce nebo významu, nové uvědomění a volba, domluvený krok pouze se souhlasem, závěrečné shrnutí. V každé průběžné odpovědi zachyť jednu podstatnou věc, případně vyslov jednu opatrnou hypotézu, a polož právě jednu otázku, která vychází z konkrétních slov členky. Odpověď smí obsahovat právě jeden otazník. Nedávej seznam rad, vícekrokový plán ani automatický úkol. Nevysvětluj člence strukturu nebo techniku, prostě ji kvalitně veď. Pokud požádá o uzavření, nepokračuj další průzkumnou otázkou: shrň její vlastní uvědomění, rozhodnutí, případnou dohodu a otevřené téma pro příště.'
        : responseMode === 'mentoringova_konzultace'
          ? 'Členka si vědomě zvolila MENTORINGOVOU KONZULTACI. Když se ptá, co bys udělala, dej hned nejlepší pracovní doporučení z dostupných informací; nezačínej výslechem ani oznámením, že budeš stručná nebo praktická. Chybějící předpoklad pojmenuj jako předpoklad a polož nanejvýš jednu rozhodující otázku na konci. Odpověď smí obsahovat nejvýše jeden otazník. V běžném tahu nedělej úplný audit: vyber jeden nejdůležitější úsudek, vysvětli jeho důvod a navrhni nejbližší ověřovací krok. Pokud členka neurčila délku, počet lidí, rozpočet nebo metriku, nevymýšlej je; řekni například „v krátkém pilotu“ a parametr zvolte až podle její kapacity. Neskrývej doporučení za nekonečné otázky. Rozlišuj data členky, ověřené informace a pracovní hypotézy. Při uzavření shrň doporučení, rozhodnutí členky a nejbližší ověřovací krok.'
          : responseMode === 'nlp_konzultace'
            ? 'Členka si vědomě zvolila NLP KONZULTACI. Veď ji jako plnohodnotnou postupnou konzultaci, ne jako přednášku ani demonstraci triků. Podle situace můžeš použít přesné vymezení žádoucího výsledku, zpřesnění jazyka, změnu perspektivy, přerámování, submodality, kotvení, vizualizaci, mentální zkoušku, swish postup, časovou perspektivu a další neklinické NLP postupy potvrzené v metodice Nii. Nabídni vždy jen jeden krok nebo jednu otázku, zajisti možnost odmítnout a ověř účinek. Nepoužívej skrytou manipulaci, nátlak ani tvrzení, že metoda diagnostikuje, garantovaně léčí nemoc či trauma nebo zaručuje výsledek. Při uzavření pojmenuj, co se změnilo a co z toho prakticky plyne.'
            : responseMode === 'behavioralni_konzultace'
              ? 'Členka si vědomě zvolila BEHAVIORÁLNÍ KONZULTACI. Nejprve přesně definuj pozorovatelné chování a konkrétní okamžik, ve kterém se mění. Během prvních tří zpráv členky nedávej experiment, plán, seznam možností ani akční krok: postupně zjisti spouštěč, tření, okamžitou úlevu nebo odměnu, prostředí a případnou výjimku. Nepojmenovávej chování předčasně jako perfekcionismus, prokrastinaci či sebesabotáž; ověř, co funkčně dělá právě u této členky. Teprve potom společně navrhni jeden malý experiment, spouštěč a jednoduché měření. V každém tahu řeš jedinou rozhodující věc a polož nejvýše jednu otázku.'
              : responseMode === 'somaticka_konzultace'
                ? 'Členka si vědomě zvolila SOMATICKOU KONZULTACI v koučovacím rámci. Pracuj jemně s přítomným tělesným vnímáním, oporou, napětím, hranicemi a kapacitou. Před cvičením nabídni volbu a možnost kdykoli přestat. Začni vnější orientací nebo neutrálním místem v těle; nenuť zavírat oči, hluboce dýchat, zadržovat dech ani vybavovat traumatickou událost. Tělesné pocity neinterpretuj jako diagnózu nebo důkaz skryté příčiny. Nabídni jednu krátkou praxi, potom ověř, zda je stav stejný, o trochu lepší, nebo horší. Při nepohodě zastav a změň směr. Při uzavření shrň, co člence přineslo více opory a co může bezpečně zopakovat.'
                : responseMode === 'koucovaci_podpora'
        ? 'Toto je koučovací podpora: v první odpovědi nedávej odrážky, vícekrokový plán, dlouhý výklad ani automatický úkol. Krátce a konkrétně zrcadli to podstatné a polož právě jednu promyšlenou otázku odpovídající zvolené metodě. Celá odpověď smí obsahovat právě jeden otazník. Nepožaduj konkrétní počet odpovědí, důkazů nebo kroků. Počkej na odpověď členky. Praktický krok nabídni až po uvědomění a jen s jejím souhlasem. Neprohlašuj blokující přesvědčení za nepravdivé dřív, než máte konkrétní důkazy; označ ho jako pracovní hypotézu k prověření.'
        : responseMode === 'podporna_stabilizace'
          ? 'Toto je podpůrná stabilizace, nikoli léčba. Začni stručným uznáním a nabídni jednu snadno odmítnutelnou techniku s volbou; preferuj vnější orientaci v prostoru. Nenuť zavřít oči, dýchat zhluboka, zadržovat dech ani popisovat trauma. Po krátkém kroku ověř, zda je to stejné, o trochu lepší, nebo horší. Neotvírej sama lékaře, terapeuta, krizi ani sebepoškozování; kritické a akutní signály už řeší bezpečnostní předfiltr. Při nepohodě techniku zastav a nabídni jiný způsob podpory.'
          : responseMode === 'podpora_fungovani'
            ? 'Toto je aktivní koučovací podpora fungování při depresi, úzkosti, vyhoření, nemoci nebo dopadech traumatu. Členku neodmítej ani jí nepodsouvej potřebu lékaře či terapeuta jen kvůli názvu stavu. Rovnou koučuj její skutečný cíl: aktuální kapacitu, každodenní fungování, práci, podnikání, hranice, komunikaci nebo jeden zvládnutelný krok. Netlač na výkon ani pozitivní myšlení. Neřeš diagnózu, léky, prognózu ani léčbu a nevkládej do odpovědi preventivní bezpečnostní poučky.'
            : responseMode === 'vedena_meditace'
              ? 'Toto je tvorba vedené meditace nebo relaxace. Nejdřív ověř cíl, požadovanou délku, zkušenost a zda členka právě neřídí nebo neobsluhuje zařízení. Dej možnost ponechat oči otevřené, vynechat zaměření na dech a kdykoli skončit. Meditaci zakonči orientací v prostoru. Neprezentuj ji jako léčbu nemoci, úzkosti nebo traumatu.'
              : 'Toto není čistě koučovací režim; přesto doporučení přizpůsob kontextu a nezahltit členku.',
      compactMemory.address_form !== 'nezvoleno'
        ? `Členka už zvolila ${compactMemory.address_form}. Tuto volbu respektuj a znovu se na ni neptej ani ji nepotvrzuj otázkou.`
        : 'Pokud je to skutečně první kontakt, zeptej se na tykání nebo vykání.',
      responseMode === 'brand_growth_agent'
        ? 'V tomto prostoru jsi samostatná Brand & Marketing agentka, nikoli koučka. Neodváděj marketingový úkol k osobnímu koučování, pokud o to členka výslovně nepožádá.'
        : 'V koučovacím prostoru řeš branding a marketing jen v rozsahu nezbytném pro aktuální koučovací nebo podnikatelské rozhodnutí; specializovanou exekuci přenech Brand & Marketing agentce.',
    ].join(' '),
  ].join('\n');
}

function depthStageInstruction(stage) {
  return {
    zakazka_a_zamer: 'Nejdřív vyjasni, co má být po dnešním rozhovoru jiné; nezačínej řešením.',
    mapovani_konkretni_reality: 'Přesuň obecné hodnocení do jediné nedávné konkrétní situace a zjišťuj pouze pozorovatelný průběh.',
    prohlubovani_mechanismu: 'Zkoumej rozhodující okamžik před reakcí: spouštěč, vnitřní větu, emoci nebo tělesný signál, jednání a krátkodobý důsledek. Neoznačuj ještě příčinu za jistou.',
    pripraveno_k_cilene_praci: 'Nyní proveď právě jeden krok zamčené techniky, přizpůsobený zjištěnému mechanismu, a počkej na výsledek.',
  }[stage] || 'Pokračuj jediným přesným tahem navazujícím na skutečná slova členky.';
}

export function selectConversationWindow(messages, maxMessages = 18) {
  const safe = Array.isArray(messages) ? messages : [];
  if (safe.length <= maxMessages) return safe;
  const openingCount = Math.min(4, Math.max(2, Math.floor(maxMessages / 4)));
  return [...safe.slice(0, openingCount), ...safe.slice(-(maxMessages - openingCount))];
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  const clean = messages
    .filter(message => message && ['user', 'assistant'].includes(message.role))
    .map(message => ({
      role: message.role,
      content: String(message.content || '').trim().slice(0, 12000),
    }))
    .filter(message => message.content);
  return selectConversationWindow(clean, 40);
}

export function buildConversationContext(messages, responseMode = 'diagnostika') {
  const safe = Array.isArray(messages) ? messages : [];
  const userMessages = safe.filter(message => message?.role === 'user');
  const userTurns = userMessages.length;
  const assistantTurns = safe.filter(message => message?.role === 'assistant').length;
  const latestUserText = String(userMessages.at(-1)?.content || '');
  const userText = userMessages.map(message => String(message.content || '')).join('\n');
  const detectedLatest = normalizeForDetection(latestUserText);
  const detectedUserText = normalizeForDetection(userText);
  const hasConcreteSituation = userTurns > 1 && (
    userMessages.slice(1).some(message => String(message.content || '').trim().length >= 45)
    || /\b(kdyz|vcera|dnes|naposled|konkret|situac|ukol|projekt|web|hovor|schuz|napsal|rekl|udelal|otevr|zacal)\b/iu.test(detectedUserText)
  );
  const hasMechanismClue = /\b(tesne pred|pak|potom|misto toho|nevim kde|protoze|kdyz.+tak|spoust)/isu.test(detectedUserText)
    || /\b(prepnu|odloz\w*|utecu|vyhnu|zasekn\w*)\b[^.!?\n]{0,80}\b(ulev\w*|napeti|tlak|strach|klid|snazsi|lehci|tezsi)\b/isu.test(detectedUserText);
  const hasDistributionFacts = /(?:nem[aá]m|m[aá]m|bez|jen|pouze|žádn\w*|zadn\w*)[^\n.!?]{0,60}(?:publik|s[ií]ť kontakt|sit kontakt|koho oslovit|sleduj[ií]c|komunit|datab[aá]z|klient|z[aá]kazn)|(?:placen\w*|meta|facebook|instagram|google)[^\n.!?]{0,35}reklam|reklam[^\n.!?]{0,35}(?:rozpočet|rozpocet|pojedu|použiju|pouziju)/iu.test(userText);
  const depthStage = userTurns <= 1
    ? 'zakazka_a_zamer'
    : !hasConcreteSituation
      ? 'mapovani_konkretni_reality'
      : !hasMechanismClue
        ? 'prohlubovani_mechanismu'
        : 'pripraveno_k_cilene_praci';
  const stage = userTurns <= 1
    ? 'otevírací fáze'
    : userTurns <= 3
      ? 'průzkumná fáze'
      : 'pracovní a integrační fáze';
  const sessionEvidence = extractSessionEvidence(safe);
  return {
    userTurns,
    assistantTurns,
    stage,
    depthStage,
    hasConcreteSituation,
    hasMechanismClue,
    hasDistributionFacts,
    deepWorkExpected: !['mentoring', 'rychle_reseni', 'mentoringova_konzultace', 'brand_growth_agent'].includes(responseMode),
    hasPriorExchange: assistantTurns > 0,
    openingFocus: String(userMessages[0]?.content || '').slice(0, 320),
    latestSubstantiveUserText: sessionEvidence.latestSubstantiveUserText,
    recentUserEvidence: sessionEvidence.recentUserEvidence,
    lastAssistantQuestion: sessionEvidence.lastAssistantQuestion,
    clientCorrections: sessionEvidence.corrections,
  };
}

function normalizeForDetection(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function buildRoutingText(messages, memory = {}) {
  const recentUserMessages = (Array.isArray(messages) ? messages : [])
    .filter(message => message?.role === 'user' && String(message.content || '').trim())
    .slice(-4)
    .map(message => String(message.content).trim());
  const rememberedBusinessContext = [
    memory?.business_context?.industry,
    memory?.business_context?.primary_offer,
    memory?.business_context?.target_customer,
    memory?.current_goal,
    memory?.continuity?.last_focus,
    ...(memory?.continuity?.recent_focuses?.slice(-3) || []),
  ].filter(Boolean);

  return [...recentUserMessages, ...rememberedBusinessContext]
    .join('\n')
    .slice(-8000);
}

export function fixedGroundingResponse({
  messages = [],
  memory = {},
  latestText = '',
  routingText = '',
  responseMode = 'diagnostika',
  conversationContext = {},
  techniqueTurn = null,
} = {}) {
  const latest = String(latestText || '').trim();
  const userFacts = (Array.isArray(messages) ? messages : [])
    .filter(message => message?.role === 'user')
    .map(message => String(message.content || '').trim())
    .filter(Boolean)
    .join('\n');

  if (isGlobalSelfJudgment(latest)) {
    return 'Tohle je závěr o celé tobě, ale zatím nevím, z jaké konkrétní skutečnosti vychází. Nebudu ti proto domýšlet, co umíš, ani tě přesvědčovat o opaku. Která konkrétní situace tě právě teď vede k větě „jsem neschopná“?';
  }

  if (rejectsUnsupportedAssumption(latest)) {
    return 'Máš pravdu — tohle jsem nevěděla a neměla jsem ti to připsat. Vezměme místo domněnky jeden konkrétní nedokončený úkol. Co se stalo v okamžiku, kdy ses od něj odpojila?';
  }

  const businessContext = `${routingText}\n${memory?.business_context?.primary_offer || ''}\n${memory?.current_goal || ''}`;
  const isValidationDecision = /valid(?:ac|ov)|ověř(?:it|en|ov)|over(?:it|en|ov)|průzkum trhu|pruzkum trhu|placen[ýy] pilot|appk|aplikac|spuštěn|spusten|uveden[ií] na trh|product.market|kupn[ií] zájem|kupni zajem/i.test(businessContext);
  const hasDistributionFacts = /(?:nem[aá]m|m[aá]m|bez|jen|pouze|žádn\w*|zadn\w*)[^\n.!?]{0,60}(?:publik|s[ií]ť kontakt|sit kontakt|koho oslovit|sleduj[ií]c|komunit|datab[aá]z|klient|z[aá]kazn)|(?:placen\w*|meta|facebook|instagram|google)[^\n.!?]{0,35}reklam|reklam[^\n.!?]{0,35}(?:rozpočet|rozpocet|pojedu|použiju|pouziju)/i.test(userFacts);
  const isCapacityAnswer = /\b\d+(?:\s*[–-]\s*\d+)?\s*(?:h|hod|hodin)\b|denn[eě]|t[ýy]dn[eě]/i.test(latest);

  if (!['brand_growth_agent'].includes(responseMode) && isValidationDecision && isCapacityAnswer && !hasDistributionFacts) {
    return 'Kapacitu už vím. Než zvolím způsob validace, potřebuji znát distribuční realitu, protože bez ní bych si plán vymýšlela. Máš vlastní publikum, síť kontaktů nebo stávající klientky, které můžeš oslovit, anebo počítáš jen s placenou reklamou?';
  }

  if (techniqueTurn?.card?.id === 'accurate_self_talk_edit'
    && techniqueTurn?.session?.phase === 'assessment'
    && Number(conversationContext.userTurns || 0) > 1) {
    return 'V tom, co popisuješ, jsou zatím pohromadě dvě různé věci: konkrétní nedokončený úkol a závěr o celé tobě. Nechci ten závěr ani vyvracet, ani potvrdit, dokud nepochopíme mechanismus. Co se děje těsně před okamžikem, kdy úkol přestaneš dělat nebo od něj odejdeš?';
  }

  return null;
}

function demoAnswer(
  userText,
  memory,
  matches,
  selectedMethod,
  selectedTechniqueCards = [],
  techniqueSession = null,
  memoryPatch = null,
  safetyLevel = 'normal',
  responseMode = inferMode(userText),
) {
  const name = memory?.identity_preferences?.preferred_name;
  const salutation = name ? `${name}, řeknu ti to narovinu:` : 'Řeknu ti to narovinu:';
  const best = matches[0];
  const relevant = best
    ? stripMarkdown(best.content).slice(0, 700)
    : 'Nejdřív potřebuji přesně pochopit tvůj cíl, situaci, kapacitu a to, co už jsi zkusila.';

  return {
    text: [
      `${salutation} prototyp je teď spuštěný v demo režimu bez připojeného jazykového modelu.`,
      `Z tvé otázky „${userText.slice(0, 180)}“ jsem jako nejbližší téma našla: **${best?.topic || 'diagnostika situace'}**.`,
      relevant,
      'Pro plnohodnotnou personalizovanou odpověď stačí na serveru nastavit `AI_GATEWAY_API_KEY`. Klíč se nikdy neukládá v prohlížeči.',
    ].join('\n\n'),
    mode: responseMode,
    riskLevel: safetyLevel,
    coachingMethod: selectedMethod ? { id: selectedMethod.id, name: selectedMethod.name, tier: selectedMethod.tier } : null,
    techniqueCards: selectedTechniqueCards.map(card => ({
      id: card.id,
      name: card.name,
      family: card.family,
      accessLevel: card.access_level,
    })),
    techniqueSession,
    memoryPatch,
    sourceIds: matches.map(match => match.source_id),
    evidenceSourceIds: [],
    provider: 'demo-no-api-key',
  };
}

function stripMarkdown(value) {
  return value
    .replace(/^#+\s+/gm, '')
    .replace(/^[-*]\s+/gm, '• ')
    .replace(/\*\*/g, '')
    .trim();
}

export function inferMode(text, consultationMode = 'auto') {
  const explicitModes = {
    coaching_session: 'koucovaci_hodina',
    business_mentoring: 'mentoringova_konzultace',
    nlp_reframing: 'nlp_konzultace',
    behavioral_change: 'behavioralni_konzultace',
    somatic_regulation: 'somaticka_konzultace',
    brand_growth: 'brand_growth_agent',
  };
  if (explicitModes[consultationMode]) return explicitModes[consultationMode];
  if (/meditac[^.!?\n]{0,60}(?:zhorš|zhors|spoušt|spoust|trauma|disoci|nejsem ve svém těle|nejsem ve svem tele)|(?:trauma|disoci)[^.!?\n]{0,60}meditac/i.test(text)) return 'podporna_stabilizace';
  if (/meditac|veden[aá] relaxace|mindfulness/i.test(text)) return 'vedena_meditace';
  if (/panik|flashback|uklidni|zklidni|rozklepan|nemůžu se uklidnit|nemuzu se uklidnit/i.test(text)) return 'podporna_stabilizace';
  if (/depres|vyhoř|vyhor|úzkost|uzkost|trauma|nemoc|diagn[oó]z|léčb|lecb/i.test(text)) return 'podpora_fungovani';
  if (/(?:potřebuji|potrebuji|chci|musím|musim)[^.!?\n]{0,50}hned|hned[^.!?\n]{0,30}(?:poraď|porad|řekni|rekni|pomoz)|rychl[ée]\s+(?:řešení|reseni|radu|odpověď|odpoved)|spěch|spech/i.test(text)) return 'rychle_reseni';
  if (/bojim|bojím|strach|nejsem dost|nevěřím|neverim|neschopn|k ničemu|k nicemu|jsem marn[aá]|jsem hrozn[aá]/i.test(text)) return 'koucovaci_podpora';
  if (/co mam udelat|co mám udělat|jak mam|jak mám|porad/i.test(text)) return 'mentoring';
  if (/valid(?:ac|ov)|průzkum trhu|pruzkum trhu|nab[ií]dk|produkt|služb|sluzb|publik|reklam|prodej|cenotvor|z[aá]kazn|klient|n[aá]pad|invest|[uú]spor|product.?market|spuštěn|spusten/i.test(text)) return 'mentoring';
  return 'diagnostika';
}

const CONTINUOUS_SESSION_MODES = new Set([
  'diagnostika',
  'koucovaci_podpora',
  'koucovaci_hodina',
  'nlp_konzultace',
  'behavioralni_konzultace',
  'somaticka_konzultace',
  'podpora_fungovani',
  'podporna_stabilizace',
  'mentoring',
  'mentoringova_konzultace',
]);

export function resolveConversationMode(text, consultationMode = 'auto', techniqueSession = null) {
  const inferred = inferMode(text, consultationMode);
  if (consultationMode !== 'auto') return inferred;
  const activeSession = techniqueSession
    && ['assessment', 'consent', 'application', 'evaluation', 'integration'].includes(techniqueSession.phase)
    && typeof techniqueSession.techniqueId === 'string'
    && techniqueSession.techniqueId.trim();
  return activeSession && CONTINUOUS_SESSION_MODES.has(techniqueSession.mode)
    ? techniqueSession.mode
    : inferred;
}

function isGlobalSelfJudgment(text) {
  return /^\s*(?:jsem|připadám si|pripadam si|c[ií]t[ií]m se)\s+(?:úplně\s+|uplne\s+|fakt\s+|naprosto\s+)?(?:neschopn[aá]|k ničemu|k nicemu|marn[aá]|hrozn[aá]|selh[aá]n[ií])\s*[.!?]*\s*$/iu.test(String(text || ''));
}

function rejectsUnsupportedAssumption(text) {
  return /jak (?:to )?m[uů]žeš v[eě]d[eě]t|odkud (?:to )?v[ií]š|to (?:přece )?(?:v[uů]bec )?nev[ií]š|to sis vymyslel|to sis vymyslela|to zrovna (?:fakt )?neum[ií]m|nem[aá]m nikoho koho|nem[aá]m koho oslovit/i.test(String(text || ''));
}

export function shapeCoachingResponse(
  text,
  memory = {},
  { closingRequested = false, requireQuestion = true, sourceText = '', fallbackQuestion = 'Kde přesně se to u tebe láme?' } = {},
) {
  let output = String(text || '').trim();
  output = output
    .replace(/^(?:Krásný den|Dobrý den|Ahoj|Dobrej)[^.!?\n]*(?:[.!]|\s*[—-])\s*/iu, '')
    .replace(/^(?:Díky|Děkuji),?\s+(?:že[^.!?]*|za[^.!?]*)[.!]\s*/iu, '')
    .replace(/^(?:Skvělé|Výborné|Perfektní)(?:\s+\p{L}+){0,3}\s*[—-]\s*/iu, '')
    .replace(/^\s{0,3}(?:#{1,6}\s*)?(?:\*\*)?(?:Hlavní závěr|Proč|Krátké kontrolní otázky|Doporučený postup|Riziko(?:\s*\/\s*nejistota)?|Další krok)(?:\*\*)?\s*:\s*/gimu, '')
    .replace(/^\s*(?:[-•*]|\d+[.)])\s+/gmu, '')
    .replace(/\*\*(.*?)\*\*/gsu, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const preferredName = String(memory?.identity_preferences?.preferred_name || '').trim();
  if (preferredName.length >= 3) {
    const prefix = preferredName.slice(0, 3).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const withoutMechanicalAddress = output.replace(new RegExp(`^${prefix}\\p{L}*(?:,|\\s+[—-])\\s*`, 'iu'), '');
    if (withoutMechanicalAddress !== output) {
      output = withoutMechanicalAddress.replace(/^\p{Ll}/u, character => character.toLocaleUpperCase('cs-CZ'));
    }
  }
  const sourceHasDuration = /\b(?:\d+|jeden|jednoho|jednu|dva|dvou|tři|tří)\s*(?:[–-]\s*\d+\s*)?(?:dny|dní|dnů|týden|týdne|týdny|týdnů|měsíc|měsíce|měsíců)(?!\p{L})/iu.test(sourceText);
  if (!sourceHasDuration) {
    output = output
      .replace(/\b(?:během|po dobu)\s+(?:\d+|jednoho|dvou|tří)\s*(?:[–-]\s*\d+\s*)?(?:dní|dnů|týdne|týdnů|měsíce|měsíců)(?!\p{L})/giu, 'v krátkém pilotu')
      .replace(/\b\d+\s*[–-]\s*\d+\s+(?:dní|dnů|týdnů|měsíců)(?!\p{L})/giu, 'v krátkém pilotu');
  }
  output = output
    .replace(/\boutcome[- ]based\b/giu, 'zaměřené na výsledek')
    .replace(/\bheadline\b/giu, 'hlavní sdělení')
    .replace(/\b(oslov|pošli|otestuj na|zeptej se)\s+\d+\s*[–-]\s*\d+\s+/giu, '$1 malou skupinu ')
    .replace(/\bpokud\s+(?:alespoň|aspoň)\s+polovina\s+/giu, 'sleduj, zda ');
  const addressForm = memory?.identity_preferences?.address_form;
  if (addressForm && addressForm !== 'nezvoleno') {
    output = output
      .replace(/(?:^|\n)[^\n.!?]*(?:budeme si|můžeme si|mame si|máme si)[^\n?]*\?\s*/giu, '\n')
      .trim();
  }

  if (closingRequested) return output;

  const firstQuestion = output.indexOf('?');
  if (firstQuestion >= 0) {
    output = output.slice(0, firstQuestion + 1).trim();
  } else if (requireQuestion) {
    output = `${output}\n\n${fallbackQuestion}`.trim();
  }
  return output;
}

function isClosingRequest(text) {
  return /\b(uzavř|uzavr|ukonč|ukonc|shrň|shrn|rekapitul|konec konzultace|konzultaci uzavřít|konzultaci uzavrit)\b/i.test(String(text || ''));
}
