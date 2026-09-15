import { meteredGenerateText as generateText } from './ai-meter.js';
import { selectSystemContext } from './ai-context.js';
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
  classifyStopIntent,
  enforceTechniqueResponse,
  formatTechniqueExecution,
  isConversationRepairRequest,
  techniqueFallbackQuestion,
} from './technique-session.js';
import { buildContinuityPatch } from './memory.js';
import {
  assessCoachingResponse,
  buildQualityRepairInstruction,
  extractSessionEvidence,
  requestsFactsOnly,
  requestsOneShortQuestion,
} from './coaching-quality.js';
import {
  listBusinessAcademyFacultyCourses,
  retrieveBusinessAcademyKnowledge,
} from './course-knowledge.js';
import {
  formatSpecialistContext,
  routeSpecialists,
  specialistRouteSummary,
} from './specialist-router.js';
import { detectConversationLanguage, languageInstruction } from './language-profile.js';

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
  return async function answer({
    messages,
    memory,
    consultationMode = 'auto',
    brandWorkMode = 'collaborate',
    techniqueSession = null,
    specialistSession = null,
  }) {
    const previousResponseMode = previousAssistantResponseMode(messages);
    const safeMessages = sanitizeMessages(messages);
    const latest = [...safeMessages].reverse().find(message => message.role === 'user');
    if (!latest) throw new Error('Chybí zpráva členky.');

    const safety = classifySafety(latest.content);
    if (safety.level === 'critical') {
      return {
        text: crisisResponse(safety),
        mode: 'crisis',
        activeRole: 'coach',
        roleTransition: null,
        riskLevel: 'critical',
        sourceIds: [],
        techniqueCards: [],
        provider: 'safety-protocol',
      };
    }

    const routingText = buildRoutingText(safeMessages, memory);
    const responseLanguage = detectConversationLanguage(safeMessages);
    const responseMode = resolveConversationMode(latest.content, consultationMode, techniqueSession, {
      previousMode: previousResponseMode,
      conversationText: routingText,
    });
    const specialistRoute = routeSpecialists({
      messages: safeMessages,
      memory,
      responseMode,
      consultationMode,
      previous: specialistSession,
    });
    const activeRole = expertRoleForMode(responseMode);
    const previousRole = expertRoleForMode(previousResponseMode);
    const roleTransition = consultationMode === 'auto'
      && previousResponseMode
      && previousRole !== activeRole
      ? { from: previousRole, to: activeRole }
      : null;
    const isBrandGrowth = responseMode === 'brand_growth_agent';
    const isBusinessMentoring = ['mentoring', 'mentoringova_konzultace'].includes(responseMode);
    const conversationContext = {
      ...buildConversationContext(safeMessages, responseMode),
      activeRole,
      previousRole,
      roleTransition,
      riskLevel: safety.level,
      responseLanguage,
    };
    const repairContext = {
      ...buildConversationRepairContext(safeMessages, latest.content),
      responseLanguage,
    };
    // The current request chooses the working method. Older context remains in
    // the prompt for continuity, but must not drag a newly mentoring turn back
    // into a coaching technique (or vice versa).
    const selectedMethod = isBrandGrowth || isBusinessMentoring
      ? null
      : selectCoachingMethod(coachingMethods, latest.content, memory, responseMode);
    const selectedExpertSources = isBrandGrowth ? [] : selectExpertSources(expertSources, selectedMethod, responseMode);
    const selectedWellbeingProtocol = isBrandGrowth ? null : selectWellbeingProtocol(wellbeingProtocols, latest.content, responseMode);
    const candidateTechniqueCards = isBrandGrowth || isBusinessMentoring
      ? []
      : selectTechniqueCards(
        techniqueAtlas,
        latest.content,
        responseMode,
        'normal',
      );
    const continuingTechniqueSession = techniqueSession
      && expertRoleForMode(techniqueSession.mode) === activeRole
      ? techniqueSession
      : null;
    const techniqueTurn = createTechniqueTurn({
      atlas: techniqueAtlas,
      candidates: candidateTechniqueCards,
      previous: continuingTechniqueSession,
      mode: responseMode,
      latestText: latest.content,
      conversationContext,
      previousAssistantText: previousAssistantMessage(safeMessages),
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
      specialistRoute,
      repairContext,
    );

    if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
      const demo = demoAnswer(
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
      return {
        ...demo,
        text: repairContext.active
          ? guardedConversationRepairFallback(repairContext)
          : demo.text,
        specialistRouting: specialistRouteSummary(specialistRoute),
        specialistSession: specialistRoute,
      };
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
    let result = await generateText({
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
    if (!result.text?.trim()) {
      const retryResult = await generateText({
        meterPhase: 'empty-retry',
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
    // Otázka je nástroj, ne povinná forma každé odpovědi. Nucení jediného
    // otazníku vedlo k výslechu a odřezávalo užitečnou část odpovědi.
    const requireQuestion = false;
    const finalizeText = value => {
      const techniqueCheckedText = enforceTechniqueResponse(value, techniqueTurn, {
        latestText: latest.content,
        messages: safeMessages,
      });
      const shapedText = shapedModes.has(responseMode)
        ? shapeCoachingResponse(techniqueCheckedText, memory, {
          closingRequested,
          requireQuestion,
          sourceText: latest.content,
          fallbackQuestion: techniqueFallbackQuestion(techniqueTurn, latest.content),
        })
        : techniqueCheckedText;
      return enforceConversationRepairResponse(shapedText, repairContext);
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
    if (quality.shouldRepair) {
      try {
        const repairModelId = responseMode === 'koucovaci_hodina'
          ? String(process.env.ELITEA_COACH_MODEL || DEFAULT_COACH_MODEL).trim()
          : String(process.env.ELITEA_DEEP_MODEL || DEFAULT_DEEP_MODEL).trim();
        const repairResult = await generateText({
          meterPhase: 'quality-repair',
          model: repairModelId,
          instructions: `${instructions}\n\n${buildQualityRepairInstruction(quality, conversationContext, { responseMode })}\n\n# VADNÁ ODPOVĚĎ, KTEROU MUSÍŠ NAHRADIT\n${String(finalText || '').slice(0, 2200)}\n\nNevysvětluj její chyby člence. Vrať pouze celou novou odpověď, která je opravuje.`,
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
          if (repairedQuality.pass) {
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
      const guardedText = repairContext.active
        ? guardedConversationRepairFallback(repairContext)
        : isBrandGrowth
        ? guardedBrandFallback(latest.content, { responseLanguage })
        : isBusinessMentoring
          ? guardedMentoringFallback(latest.content, { messages: safeMessages, responseLanguage })
        : guardedQualityFallback(latest.content, { requireQuestion, closingRequested, messages: safeMessages, responseLanguage });
      const guardedQuality = assessCoachingResponse(guardedText, {
        messages: safeMessages,
        conversationContext,
        responseMode,
        techniqueTurn,
        closingRequested,
        requireQuestion: shapedModes.has(responseMode) && requireQuestion,
      });
      // The pipeline is fail-closed: a high/critical model answer is never
      // kept merely because the optional repair failed. Guarded fallbacks are
      // deterministic, versioned and regression-tested.
      finalText = guardedText;
      quality = guardedQuality;
      repaired = true;
    }
    return {
      text: finalText,
      mode: responseMode,
      activeRole,
      roleTransition,
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
      specialistRouting: specialistRouteSummary(specialistRoute),
      specialistSession: specialistRoute,
      provider: finalModelId,
      usage: totalUsage,
    };
  };
}

function normalizeDialogueText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function previousSubstantiveUserMessage(messages = [], latestText = '') {
  const latest = String(latestText || '').replace(/\s+/g, ' ').trim();
  return [...(Array.isArray(messages) ? messages : [])]
    .reverse()
    .find(message => message?.role === 'user'
      && String(message.content || '').replace(/\s+/g, ' ').trim()
      && String(message.content || '').replace(/\s+/g, ' ').trim() !== latest)?.content || '';
}

function previousAssistantMessage(messages = []) {
  return [...(Array.isArray(messages) ? messages : [])]
    .reverse()
    .find(message => message?.role === 'assistant'
      && String(message.content || '').replace(/\s+/g, ' ').trim())?.content || '';
}

export function guardedQualityFallback(latestText, {
  requireQuestion = true,
  closingRequested = false,
  messages = [],
  responseLanguage = detectConversationLanguage(latestText),
} = {}) {
  const clean = String(latestText || '').replace(/\s+/g, ' ').trim().slice(0, 320);
  const normalized = normalizeDialogueText(clean);
  if (responseLanguage === 'sk') {
    return guardedSlovakQualityFallback(clean, { closingRequested, messages });
  }
  const humanStyleCorrection = /\b(mluv|rekni|vysvetli|povedz)\b[^.!?]{0,45}\b(clovek|lidsk|normaln|jednodus)|\b(nerozumim|nerozumiem|nechapu|nechapem|moc slozit|co (?:tim|tym) myslis)\b/u.test(normalized);
  const previousUserText = previousSubstantiveUserMessage(messages, clean);
  if (humanStyleCorrection && previousUserText) {
    return `Jasně. Řeknu to normálně. ${guardedQualityFallback(previousUserText, { requireQuestion, closingRequested, messages: [] })}`;
  }

  if (closingRequested) {
    return 'Zachytily jsme to podstatné. To, co zatím nevíme jistě, necháme otevřené a nebudeme z toho dělat hotový závěr.';
  }

  const declinedDirection = /\b(?:timhle|timto|takhle|tudy|touto cestou|v tomhle smeru)\b[^.!?]{0,90}\b(?:nechci|odmitam)\b|\b(?:nechci|odmitam)\b[^.!?]{0,90}\b(?:timhle|timto|takhle|tudy|touto cestou|v tomhle smeru)\b/u.test(normalized);
  if (declinedDirection) {
    return 'Beru — tímhle směrem pokračovat nebudeme. Co by pro tebe bylo užitečnější řešit místo toho?';
  }

  const unexplainedThirdPartyDeparture = /\b(?:odesel|odesla|odesli|odchod\w*|opustil\w*)\b/u.test(normalized)
    && !/\b(?:jsem)\b[^.!?]{0,35}\b(?:odesel|odesla|opustil\w*)\b|\b(?:odesel|odesla|opustil\w*)\s+jsem\b/u.test(normalized)
    && !/\b(?:protoze|jelikoz|kvuli|z duvodu)\b/u.test(normalized)
    && !/\b(?:potrebuji|chci|pomoz|napis|sestav|vytvor|priprav|nabidnout|co dal|jak mam)\b|\?/u.test(normalized);
  if (unexplainedThirdPartyDeparture) {
    return 'Důvod jejího odchodu zatím neznáme, takže z něj ještě nejde vyvodit, co na workshopu fungovalo a co ne. Jak reagovali ostatní?';
  }

  const publicInfluenceGoal = /\b(influencer\w*|tvurc\w*|verejn\w*.{0,20}osobnost|osobni znack\w*)\b/u.test(normalized);
  const desiredLifeGap = /\b(neziju|nemam)\b[^.!?]{0,45}\bzivot\b|\bzivot\b[^.!?]{0,45}\b(chci|chtela|predstavuji)\b/u.test(normalized);
  if (publicInfluenceGoal && desiredLifeGap) {
    return 'Jsou tu dvě propojené věci: chceš vybudovat veřejnou roli influencerky a zároveň máš pocit, že současný život není ten, který chceš žít. Nezačínala bych proto jen otázkou, co postovat; nejdřív oddělíme, co tě na té představě opravdu přitahuje, od podoby života, která by ti dlouhodobě seděla, a potom to převedeme do reálného prvního experimentu. Co je na životě influencerky to hlavní, po čem teď ve svém vlastním životě toužíš?';
  }
  if (publicInfluenceGoal) {
    return 'Být influencerka není jeden cíl: je v tom téma, které chceš reprezentovat, způsob života, který chceš žít, i důvod, proč by tě měli lidé sledovat. Když to oddělíme, nevznikne jen další obecný profil, ale směr, který můžeš skutečně otestovat. Co z toho je pro tebe teď nejdůležitější — vliv, tvorba, spolupráce, peníze, nebo určitý způsob života?';
  }

  if (/\b(jsem|pripadam si)\b[^.!?]{0,30}\b(neschopn\w*|k nicemu|spatn\w*|hloup\w*|marn\w*)\b/u.test(normalized)) {
    return 'Jedna těžká situace ještě není důkaz o celé tobě. Která konkrétní událost tě právě teď vede k tak tvrdému závěru?';
  }
  if (/\b(neumim|nedokazu|bojim se)\b[^.!?]{0,35}\b(rict ne|odmitnout|nastavit hranic)|\b(rict ne|odmitnout)\b/u.test(normalized)) {
    return 'Důležitý bude okamžik těsně předtím, než řekneš ano, i když chceš říct ne. Co se při poslední takové situaci dělo těsně před tvým souhlasem?';
  }
  if (/\b(styd|bojim|obav)\w*\b[^.!?]{0,65}\b(co reknou|ostatn|videt|vystup|zverejn|ukaz)\w*\b|\b(co reknou ostatni)\b/u.test(normalized)) {
    return 'Teď se vedle toho, co chceš udělat, objevuje i představa reakce ostatních. Který konkrétní člověk nebo okruh lidí ti při tom naskočí jako první?';
  }
  if (/\b(nevim|nemuzu se)\b[^.!?]{0,35}\b(rozhod|vybr|co chci)|\b(moc moznosti|mezi .* a .*)\b/u.test(normalized)) {
    return 'Nemusíme hledat dokonale správnou volbu; nejdřív potřebujeme vědět, podle čeho ji chceš posoudit. Co má dobré rozhodnutí v téhle situaci chránit nebo umožnit?';
  }
  if (/\b(zahlcen|prehlcen|nestih|moc toho|nevim kde zacit|vsechno najednou)\b/u.test(normalized)) {
    return 'Když je všechno stejně naléhavé, nejde poznat, čím začít. Která jediná věc by ti dnes přinesla největší úlevu, kdyby byla hotová?';
  }
  if (/\b(odklad|odkladam|prokrast|nemuzu zacit|nedokonc|utek|vyhyb)\w*\b/u.test(normalized)) {
    return 'Nechci z odkládání rovnou dělat lenost ani sebesabotáž. Co přesně se stalo naposledy v okamžiku, kdy ses do toho chtěla pustit a pak jsi udělala něco jiného?';
  }
  return 'Nechci ti hned podsouvat vysvětlení. Popiš mi poslední konkrétní situaci, kdy se to stalo — co bylo těsně předtím?';
}

function guardedSlovakQualityFallback(latestText, { closingRequested = false, messages = [] } = {}) {
  const clean = String(latestText || '').replace(/\s+/gu, ' ').trim().slice(0, 320);
  const normalized = normalizeDialogueText(clean);
  const previousUserText = previousSubstantiveUserMessage(messages, clean);
  const asksForPlainLanguage = /\b(?:nerozumiem|nechapem|co tym myslis|povedz|vysvetli)\b/u.test(normalized);
  if (asksForPlainLanguage && previousUserText) {
    return guardedSlovakQualityFallback(previousUserText, { closingRequested, messages: [] });
  }
  if (closingRequested) {
    return 'Zachytili sme to podstatné. To, čo zatiaľ nevieme, necháme otvorené a neurobíme z toho hotový záver.';
  }
  const declinedDirection = /\b(?:tymto|takto|tadialto|touto cestou|v tomto smere)\b[^.!?]{0,90}\b(?:nechcem|odmietam)\b|\b(?:nechcem|odmietam)\b[^.!?]{0,90}\b(?:tymto|takto|tadialto|touto cestou|v tomto smere)\b/u.test(normalized);
  if (declinedDirection) {
    return 'Beriem — týmto smerom pokračovať nebudeme. Čo by bolo pre teba užitočnejšie riešiť namiesto toho?';
  }
  const unexplainedThirdPartyDeparture = /\b(?:odisiel|odisla|odisli|odchod\w*|opustil\w*)\b/u.test(normalized)
    && !/\b(?:som)\b[^.!?]{0,35}\b(?:odisiel|odisla|opustil\w*)\b|\b(?:odisiel|odisla|opustil\w*)\s+som\b/u.test(normalized)
    && !/\b(?:pretoze|kedze|lebo|kvoli|z dovodu)\b/u.test(normalized)
    && !/\b(?:potrebujem|chcem|pomoz|napis|zostav|vytvor|priprav|ponuknut|co dalej|ako mam)\b|\?/u.test(normalized);
  if (unexplainedThirdPartyDeparture) {
    return 'Dôvod jej odchodu zatiaľ nepoznáme, takže z neho ešte nemožno vyvodiť, čo na workshope fungovalo a čo nie. Ako reagovali ostatní?';
  }
  if (/\b(som|pripadam si)\b[^.!?]{0,30}\b(neschopn\w*|na nic|zla|hlupa|marna)\b/u.test(normalized)) {
    return 'Jedna ťažká situácia ešte nie je dôkaz o celej tebe. Ktorá konkrétna udalosť ťa teraz vedie k takému tvrdému záveru?';
  }
  if (/\b(neviem|nemozem sa)\b[^.!?]{0,35}\b(rozhod|vybr|co chcem)|\b(vela moznosti|medzi .* a .*)\b/u.test(normalized)) {
    return 'Nemusíme nájsť dokonale správnu voľbu. Najprv potrebujeme vedieť, čo má dobré rozhodnutie v tejto situácii chrániť alebo umožniť?';
  }
  if (/\b(zahlten|prehlten|nestih|vela toho|neviem kde zacat|vsetko naraz)\b/u.test(normalized)) {
    return 'Keď je všetko rovnako naliehavé, ťažko sa vyberá začiatok. Ktorá jediná hotová vec by ti dnes priniesla najväčšiu úľavu?';
  }
  if (/\b(odklad|prokrast|nemozem zacat|nedokonc|utek|vyhyb)\w*\b/u.test(normalized)) {
    return 'Z odkladania nechcem automaticky robiť lenivosť ani sebabotáž. Čo sa stalo naposledy v okamihu, keď si chcela začať a urobila si niečo iné?';
  }
  if (/\b(hanb|bojim|obav)\w*\b[^.!?]{0,65}\b(co povedia|ostatn|vidiet|vystup|zverejn|ukaz)\w*/u.test(normalized)) {
    return 'Popri tom, čo chceš urobiť, sa objavuje aj predstava reakcie ostatných. Kto konkrétny ti pri tom napadne ako prvý?';
  }
  return 'Nechcem ti podsúvať vysvetlenie. Čo sa v poslednej konkrétnej situácii stalo tesne predtým?';
}

export function guardedConversationRepairFallback(repairContext = {}) {
  const responseLanguage = repairContext.responseLanguage || detectConversationLanguage(repairContext.latestText);
  const slovak = responseLanguage === 'sk';
  const groundingEvidence = String(repairContext.groundingStatement || '')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, 260);
  const latestEvidence = String(repairContext.priorUserStatements?.at(-1) || '')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, 260);
  if (repairContext.shortQuestionRequested) {
    const shortGrounding = conciseRepairGrounding(groundingEvidence);
    return shortGrounding
      ? slovak
        ? `Keď hovoríš „${shortGrounding}“, čo je na tom teraz najťažšie?`
        : `Když říkáš „${shortGrounding}“, co je na tom teď nejtěžší?`
      : slovak
        ? 'Čo je pre teba v tej situácii teraz najťažšie?'
        : 'Co je pro tebe v té situaci teď nejtěžší?';
  }
  if (repairContext.kind === 'external_stop') {
    const scope = String(repairContext.externalStopScope || '').trim();
    if (scope) {
      const directionalScope = /\b(?:timhle|timto|takhle|tudy|tymto|takto|smer)\w*\b/u.test(normalizeDialogueText(scope));
      if (directionalScope) {
        return slovak
          ? 'Beriem — týmto smerom pokračovať nebudeme. Čo by bolo pre teba užitočnejšie riešiť namiesto toho?'
          : 'Beru — tímhle směrem pokračovat nebudeme. Co by pro tebe bylo užitečnější řešit místo toho?';
      }
      return slovak
        ? `Rozumiem — nechceš pokračovať ${scope}. Čo chceš riešiť namiesto toho?`
        : `Dobře — nechceš pokračovat ${scope}. Co chceš řešit místo toho?`;
    }
    return slovak
      ? 'Rozumiem — v tom, čo si práve odmietla, pokračovať nebudeme. Čo potrebuješ vyriešiť namiesto toho?'
      : 'Dobře — v tom, co jsi právě odmítla, pokračovat nebudeme. Co potřebuješ vyřešit místo toho?';
  }
  if (repairContext.kind === 'fact_recap') {
    const statements = (repairContext.substantiveGroundingStatements || [])
      .slice(-3)
      .map(value => String(value || '').replace(/\s+/gu, ' ').trim())
      .filter(Boolean);
    if (!statements.length) {
      return slovak
        ? 'Zatiaľ nemáme ďalšie údaje, z ktorých by sa dalo urobiť poctivé hodnotenie.'
        : 'Zatím nemáme žádné další údaje, ze kterých by šlo dělat poctivé hodnocení.';
    }
    const quotedStatements = statements
      .map(statement => `„${statement.replace(/[.!?]+$/u, '')}“`)
      .join(' a dále ');
    return slovak
      ? `Zatiaľ si uviedla: ${quotedStatements}. Na ďalšie hodnotenie ešte nemáme dosť údajov.`
      : `Zatím jsi uvedla: ${quotedStatements}. Na další hodnocení zatím nemáme dost dat.`;
  }
  if (repairContext.kind === 'clarify_stop') {
    return slovak
      ? 'Nechcem hádať, čo chceš zastaviť. Myslíš náš rozhovor, práve použitý postup, alebo vec, o ktorej hovoríš?'
      : 'Nechci hádat, co chceš zastavit. Myslíš náš rozhovor, právě použitý postup, nebo věc, o které mluvíš?';
  }
  if (repairContext.kind === 'rephrase') {
    const simplified = simplifyRepairQuestion(repairContext.previousAssistantText, responseLanguage);
    if (simplified) {
      return slovak
        ? `Položila som to zložito. Pýtam sa jednoducho: ${simplified}`
        : `Položila jsem to složitě. Ptám se jednoduše: ${simplified}`;
    }
    return slovak
      ? 'Položila som to nejasne. Nechcem ťa nútiť vysvetľovať to znova. Čo z toho, čo už vieme, potrebuješ rozhodnúť teraz?'
      : 'Položila jsem to nejasně. Nechci tě nutit vysvětlovat to znovu. Co z toho, co už víme, potřebuješ rozhodnout teď?';
  }
  if (latestEvidence) {
    return slovak
      ? `Nenadviazala som správne. Zostávam pri tom, že ${lowercaseFirst(latestEvidence)} Čo z toho potrebuješ vyriešiť teraz?`
      : `Nenavázala jsem správně. Zůstávám u toho, že ${lowercaseFirst(latestEvidence)} Co z toho potřebuješ vyřešit teď?`;
  }
  return slovak
    ? 'Nenadviazala som správne a nebudem od teba pýtať tie isté údaje znova. Čo potrebuješ v tomto bode vyriešiť?'
    : 'Nenavázala jsem správně a nebudu po tobě chtít stejné údaje znovu. Co potřebuješ v tomto bodě vyřešit?';
}

function lowercaseFirst(value) {
  const text = String(value || '').trim();
  return text ? `${text.charAt(0).toLocaleLowerCase('cs-CZ')}${text.slice(1)}` : '';
}

export function enforceConversationRepairResponse(value, repairContext = {}) {
  const output = String(value || '').replace(/\s+/gu, ' ').trim();
  if (!repairContext?.active) return output;

  // Když členka výslovně žádá jedinou krátkou otázku, neposíláme před ni
  // omluvu, vysvětlení ani další otázku. Generativní model tuto jednoduchou
  // instrukci občas poruší, proto je zde deterministická výstupní brána.
  if (repairContext.shortQuestionRequested) {
    return guardedConversationRepairFallback(repairContext);
  }

  // Rekapitulace „jen z faktů“ je bezpečnější jako deterministický výpis
  // doslovných sdělení členky. Model by jinak mohl spojit správné číslo se
  // špatnou událostí nebo k faktům nenápadně přidat kauzální závěr.
  if (repairContext.kind === 'fact_recap') {
    return guardedConversationRepairFallback(repairContext);
  }

  // Jasné „končím s X, ale s tebou pokračuji“ nesmí být znovu vyloženo jako
  // konec rozhovoru. Dobrou modelovou odpověď zachováme; zasahujeme pouze,
  // když nepotvrdila pojmenovaný rozsah nebo plynule nepokračuje otázkou.
  if (repairContext.kind === 'external_stop') {
    const confirmsScope = responseConfirmsExternalStopScope(output, repairContext.externalStopScope);
    const continuesWithOneQuestion = (output.match(/\?/gu) || []).length === 1
      && !/(?:chceš|chces|máš|mas)\s+(?:tedy\s+)?(?:ukončit|ukoncit|zastavit|uzavřít|uzavriet)\s+(?:náš\s+|nas\s+|tento\s+|tenhle\s+)?(?:rozhovor|sezení|sedenie)|(?:dnešek|dnesok)\s+uzavřeme/iu.test(output);
    if (!confirmsScope || !continuesWithOneQuestion) {
      return guardedConversationRepairFallback(repairContext);
    }
  }

  return output;
}

function simplifyRepairQuestion(value, language = 'cs') {
  const question = String(value || '').match(/[^?\n]{3,}\?/gu)?.at(-1)?.replace(/\s+/gu, ' ').trim() || '';
  if (!question) return '';
  const normalized = normalizeDialogueText(question);
  if (/kdybys nikdy nezjistila[^?]*proc odesla/u.test(normalized)) {
    return language === 'sk'
      ? 'Ak by si nikdy nezistila, prečo odišla, chcela by si podľa ostatných výsledkov pokračovať, alebo skončiť?'
      : 'Kdybys nikdy nezjistila, proč odešla, chtěla bys podle ostatních výsledků pokračovat, nebo skončit?';
  }
  if (/jak[yé]\w* konkretni projev[^?]*pretez/u.test(normalized)) {
    return language === 'sk'
      ? 'Podľa čoho by si spoznala, že je toho na teba priveľa?'
      : 'Podle čeho bys poznala, že je toho na tebe moc?';
  }
  if (/predstav\w* dalsi workshop/u.test(normalized)) {
    return language === 'sk'
      ? 'Je pre teba predstava ďalšieho workshopu ešte únosná?'
      : 'Je pro tebe představa dalšího workshopu ještě únosná?';
  }
  if (/co se ted zmenilo|co sa teraz zmenilo/u.test(normalized)) {
    return language === 'sk'
      ? 'Pomohol ten krok, nepomohol, alebo situáciu zhoršil?'
      : 'Pomohl ten krok, nepomohl, nebo situaci zhoršil?';
  }
  const wordCount = question.split(/\s+/u).filter(Boolean).length;
  return wordCount <= 18 ? question : '';
}

function conciseRepairGrounding(value) {
  const firstClause = String(value || '')
    .replace(/[„“"]/gu, '')
    .split(/[.!?;,]/u)[0]
    .replace(/\s+/gu, ' ')
    .trim();
  if (!firstClause) return '';
  return firstClause.split(/\s+/u).slice(0, 12).join(' ');
}

function responseConfirmsExternalStopScope(value, scope = '') {
  const output = normalizeDialogueText(value);
  const scopeTokens = normalizeDialogueText(scope)
    .split(/[^a-z0-9]+/u)
    .filter(token => token.length >= 5 && !['nechci', 'pokracovat', 'skoncit', 'ukoncit', 'tehle', 'tomhle'].includes(token));
  const words = output.split(/[^a-z0-9]+/u);
  const mentionsScope = scopeTokens.length
    ? scopeTokens.some(token => words.some(word => (
    word.startsWith(token.slice(0, Math.min(token.length, 5)))
    )))
    : /\b(?:cinnost|zpusob|tema|projekt|praci|cinnost|sposob|projekt|pracu)\b/u.test(output);
  if (!mentionsScope) return false;

  // Pouhá zmínka stejného podstatného jména nestačí. Odpověď musí skutečně
  // respektovat ukončení a nesmí současně nabádat k pokračování v téže věci.
  const contradictsStop = /\b(?:pokracuj|pokracovat\s+(?:muzes|mozes)|(?:muzes|mozes)\s+(?:v\s+tom\s+)?pokracovat|chces\s+(?:dal|dalej)\s+(?:rozvijet|rozvijat|delat|robit|pokracovat)|nechces\s+(?:to\s+)?(?:opustit|ukoncit|skoncit))\b/u.test(output);
  if (contradictsStop) return false;
  return /\b(?:nechces\s+pokracovat|chces\s+(?:s\s+\S+\s+)?skoncit|koncis|skoncis|ukoncujes|ukoncime|nebudes|nebudeme|nemusis|respektuj\w*\s+(?:ze\s+)?(?:koncis|nechces)|(?:dal|dalej)\s+[^.!?]{0,35}\b(?:netlac|nedel|nerob|nerozvij))\w*\b/u.test(output);
}

function specificMentoringFallback(latestText, { messages = [] } = {}) {
  const clean = String(latestText || '').replace(/\s+/g, ' ').trim().slice(0, 320);
  const normalized = normalizeDialogueText(clean);
  const humanStyleCorrection = /\b(mluv|rekni|vysvetli)\b[^.!?]{0,45}\b(clovek|lidsk|normaln|jednodus)|\b(nerozumim|nechapu|moc slozit|co tim myslis)\b/u.test(normalized);
  const previousUserText = previousSubstantiveUserMessage(messages, clean);
  if (humanStyleCorrection && previousUserText) {
    return `Jasně. Řeknu to jednoduše. ${guardedMentoringFallback(previousUserText)}`;
  }

  const explicitlyMissingWorkshopData = /\b(?:zatim\s+)?(?:jsem\s+ti\s+)?(?:nerekla|neuvedla)\b/u.test(normalized)
    && /\b(?:kolik|pocet|jak|reakc|reagoval|reagovali|udaj|data|informac)\w*\b/u.test(normalized);
  if (explicitlyMissingWorkshopData) {
    return 'Počet účastnic ani jejich reakce zatím neznáme, takže workshop ještě nejde poctivě vyhodnotit. Který z těchto dvou údajů chceš doplnit jako první?';
  }

  const mentionsProject = /\b(projekt|podnik\w*|byznys\w*|sluzb\w*|produkt\w*|nabidk\w*|znack\w*)\b/u.test(normalized);
  const wantsLaunch = /\b(rozjet\w*|spust\w*|zacit\w*|zverejn\w*|dostat ven|prodat\w*|prodej\w*)\b/u.test(normalized);
  const socialVisibility = /\b(sock\w*|sochach|socialn\w*|instagram\w*|facebook\w*|tiktok\w*|linkedin\w*|vystupovat\w*|viditeln\w*)\b/u.test(normalized);
  const fearOfJudgment = /\b(styd\w*|bojim\w*|obav\w*|co reknou|reakc\w*.{0,12}ostatn\w*)\b/u.test(normalized);
  const salesProblem = /\b(prodej\w*|prodat\w*|zakazn\w*|klient\w*|objednav\w*|poptav\w*)\b/u.test(normalized);
  const noCustomers = /\b(nemam|zadn\w*|chybi\w*|nechodi\w*|malo)\b[^.!?]{0,40}\b(zakazn\w*|klient\w*|objednav\w*|poptav\w*)\b/u.test(normalized);
  const unclearOffer = /\b(nevim|nejasn\w*|nedokazu)\b[^.!?]{0,45}\b(co nabiz|nabidk\w*|pro koho|komu|jak popsat)\b/u.test(normalized);
  const contentProblem = /\b(nevim|dochaz\w*|nemam|tapu)\b[^.!?]{0,45}\b(co (?:mam )?(?:dav|psat|tocit)|obsah\w*|prispevk\w*|content\w*)\b/u.test(normalized);
  const creatorAmbition = /\b(influencer\w*|osobni znack\w*|tvurk\w*|tvurce|content creator)\b/u.test(normalized);
  const contentIdentityUnclear = /\b(nevim|nejasn\w*|netusim|tapu)\b[^.!?]{0,70}\b(obsah\w*|content\w*|co tvorit|co bych tvor|co davat|co psat|co tocit)\b|\b(obsah\w*|content\w*)\b[^.!?]{0,55}\b(opravdu muj|vlastni|na miru|negenerick)\b/u.test(normalized);
  const tooManyIdeas = /\b(moc|hodne|spoust)\w*\b[^.!?]{0,35}\b(napad\w*|projekt\w*|smer\w*|veci)\b|\b(nevim co driv|skacu mezi)\b/u.test(normalized);
  const capacityProblem = /\b(nestih\w*|nemam cas|malo casu|zahlcen\w*|vsechno sama|moc prace)\b/u.test(normalized);
  const teamProblem = /\b(najmout|zamestnan\w*|tym\w*|deleg\w*|asistent\w*|spolupracovn\w*)\b/u.test(normalized);
  const conversionProblem = /\b(konver\w*|proklik\w*|navstev\w*|lidi chodi)\b[^.!?]{0,55}\b(nekup\w*|neobjedn\w*|neprod\w*|nic)\b/u.test(normalized);

  if (creatorAmbition && contentIdentityUnclear && fearOfJudgment) {
    return 'Tady nejsou jeden, ale dva různé pracovní uzly. Nejasný obsah je strategická mezera: zatím chybí vlastní téma, publikum a úhel pohledu. Stud při zveřejnění je osobní brzda, kterou potřebujeme zkoumat v přesném okamžiku, kdy máš být vidět. Kdybychom je smíchaly, mohla by ses nutit do vystupování bez sdělení, kterému sama věříš. Nejprve postavíme jádro značky, potom zmapujeme okamžik zveřejnění a z obojího vytvoříme první skutečný test. Komu chceš být užitečná a jaký problém těch lidí znáš z vlastní zkušenosti?';
  }
  if (mentionsProject && socialVisibility && (wantsLaunch || fearOfJudgment)) {
    return 'Projekt chceš rozjet, ale vystupování na sociálních sítích zastavuje otázka, co řeknou ostatní. Byznysově bych teď nečekala na větší jistotu: začni nejméně exponovanou formou, která už ověří zájem — jedním konkrétním příspěvkem o problému, který projekt řeší, klidně bez mluvení do kamery. Podle reakcí zjistíš, zda lidé nabídce rozumějí, a vlastní viditelnost můžeš přidávat postupně. Co přesně projekt nabízí a komu?';
  }
  if (salesProblem && fearOfJudgment) {
    return 'Prodej nemusí znamenat někoho tlačit. Začni jako v normálním rozhovoru: zjisti, co člověk potřebuje, a pak mu řekni, jestli a jak mu tvoje nabídka může pomoct. Ve které chvíli se stydíš nejvíc — když máš někoho oslovit, popsat nabídku, říct cenu, nebo si přímo říct o prodej?';
  }
  if (noCustomers) {
    return 'Když nepřicházejí klientky, nejdřív bych oddělila, jestli lidé o nabídce vůbec vědí, nebo ji vidí a nekupují. Bez toho bychom naslepo měnily cenu i obsah. Kolik vhodných lidí se k nabídce přibližně dostane a co udělají potom?';
  }
  if (conversionProblem) {
    return 'Jestli lidé přijdou, ale nekoupí, problém už nejspíš není jen v dosahu. Potřebujeme projít místo, kde se rozhodují: co přesně na stránce nebo v nabídce vidí těsně před odchodem?';
  }
  if (salesProblem) {
    return 'U slabého prodeje potřebujeme nejdřív zjistit, kde se cesta zastavuje: jestli lidé nabídku nevidí, nerozumějí jí, nevěří jí, nebo se nerozhodnou koupit. Co prodáváš a ve které z těchto chvílí nejčastěji zákazník odpadne?';
  }
  if (unclearOffer) {
    return 'To, co nabízíš, se nevysvětluje seznamem všeho, co umíš. Dobrá nabídka jednoduše spojí konkrétního člověka, jeho problém a výsledek, ke kterému mu pomůžeš. Komu chceš pomáhat a s čím za tebou má přijít?';
  }
  if (contentProblem) {
    return 'Obsah bych nevymýšlela od prázdné stránky. Vzala bych skutečné otázky, námitky a chyby lidí, kterým chceš prodávat, a každý příspěvek postavila jen na jedné z nich. Jakou otázku od potenciálních klientů slýcháš nejčastěji?';
  }
  if (/\b(cen|kolik|nacen|zdraz|zlevn)\b/u.test(normalized)) {
    return 'Cenu nejde spolehlivě určit jen odhadem nebo podle konkurence; musí unést celý čas a náklady, odpovídat hodnotě výsledku a dávat smysl pro konkrétní cílovku. Jaká je nabídka, komu ji prodáváš a kolik času i přímých nákladů stojí jedno dodání?';
  }
  if (tooManyIdeas) {
    return 'Teď nepotřebuješ další nápad, ale jednoduché síto. Vybereme směr, který má nejjasnějšího zákazníka, řeší naléhavý problém a dokážeš ho nejrychleji ověřit. Který z nápadů už má nejbližšího reálného člověka, kterému bys ho mohla nabídnout?';
  }
  if (capacityProblem) {
    return 'Když nestíháš, nepomůže jen rychleji pracovat. Nejdřív je potřeba oddělit práci, která přináší klienty nebo dodává slíbený výsledek, od všeho ostatního. Co ti teď bere nejvíc času, ale přímo nevede k prodeji ani k hotové zakázce?';
  }
  if (teamProblem) {
    return 'Delegovat má smysl až ve chvíli, kdy je jasné, co má druhý člověk převzít a jak poznáte dobrý výsledek. Která opakovaná činnost ti dnes bere nejvíc času a přitom nevyžaduje právě tvoje rozhodnutí?';
  }
  if (mentionsProject && wantsLaunch) {
    return 'Nejrychlejší rozjezd projektu nezačíná dokonalou prezentací, ale ověřením, zda konkrétní člověk chce konkrétní výsledek natolik, aby udělal další krok. Co projekt nabízí, komu a jakou reakci potřebuješ ověřit jako první?';
  }
  return null;
}

export function guardedMentoringFallback(latestText, {
  messages = [],
  responseLanguage = detectConversationLanguage(latestText),
} = {}) {
  if (responseLanguage === 'sk') return guardedSlovakMentoringFallback(latestText);
  return specificMentoringFallback(latestText, { messages })
    || 'Pojďme to vzít jednoduše. Napiš mi, co prodáváš nebo jaké rozhodnutí teď potřebuješ udělat, a doporučím ti jeden konkrétní další krok.';
}

function guardedSlovakMentoringFallback(latestText) {
  const clean = String(latestText || '').replace(/\s+/gu, ' ').trim().slice(0, 320);
  const normalized = normalizeDialogueText(clean);
  const explicitlyMissingWorkshopData = /\b(?:zatial\s+)?(?:som\s+ti\s+)?(?:nepovedala|neuviedla)\b/u.test(normalized)
    && /\b(?:kolko|pocet|ako|reakc|reagoval|reagovali|udaj|data|informac)\w*\b/u.test(normalized);
  if (explicitlyMissingWorkshopData) {
    return 'Počet účastníčok ani ich reakcie zatiaľ nepoznáme, takže workshop ešte nemožno poctivo vyhodnotiť. Ktorý z týchto dvoch údajov chceš doplniť ako prvý?';
  }
  if (/\b(cen|kolko|nacen|zdraz|zlacn)\w*\b/u.test(normalized)) {
    return 'Cenu nemožno spoľahlivo určiť iba podľa konkurencie. Musí pokryť celý čas a náklady, zodpovedať hodnote výsledku a dávať zmysel konkrétnej cieľovej skupine. Čo ponúkaš, komu a koľko času aj priamych nákladov stojí jedno dodanie?';
  }
  if (/\b(predaj|predat|zakazn|klient|objednav|dopyt)\w*\b/u.test(normalized)) {
    return 'Pri slabom predaji potrebujeme najprv zistiť, kde sa cesta zastavuje: či ľudia ponuku nevidia, nerozumejú jej, neveria jej, alebo sa nerozhodnú kúpiť. Čo predávaš a v ktorom bode najčastejšie odídu?';
  }
  if (/\b(projekt|podnik|biznis|sluzb|produkt|ponuk)\w*\b/u.test(normalized)) {
    return 'Najrýchlejší posun projektu nezačína dokonalou prezentáciou, ale overením, či konkrétny človek chce konkrétny výsledok. Čo ponúkaš, komu a akú reakciu potrebuješ overiť ako prvú?';
  }
  return 'Poďme to vziať jednoducho. Napíš mi, čo predávaš alebo aké rozhodnutie potrebuješ urobiť, a odporučím ti jeden konkrétny ďalší krok.';
}

export function guardedBrandFallback(latestText, {
  responseLanguage = detectConversationLanguage(latestText),
} = {}) {
  const clean = String(latestText || '').replace(/\s+/g, ' ').trim().slice(0, 240);
  const normalized = clean.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (responseLanguage === 'sk') {
    if (/\b(publikuj|zverejni|spust|odosli|nahraj|nastav|zaplat|objednaj|urob(?:\s+to)?\s+za\s+mna)\b/u.test(normalized)) {
      return 'Bez skutočného potvrdenia nástroja som nič nezverejnila ani nespustila. Ktorý presný výstup mám najprv pripraviť na tvoje schválenie?';
    }
    if (/\b(reklam|kampan|ctr|cpc|konver)\w*\b/u.test(normalized)) {
      return 'Pred zmenou reklamy potrebujem oddeliť dojem od výkonu. Aký bol cieľ kampane a aké sú doterajšie čísla útraty, zobrazení, kliknutí, dopytov a predajov?';
    }
    return 'Aký konkrétny výstup má byť na konci tohto pracovného bloku hotový a podľa čoho spoznáme, že je použiteľný?';
  }
  if (/\b(publikuj|zverejni|spust|odesli|nahraj|nastav|zaplat|objednej|udelej(?:\s+to)?\s+za\s+me)\b/u.test(normalized)) {
    const anchor = clean ? `Držím se zadání „${clean}“` : 'Držím se posledního zadání.';
    return `${anchor}. Nic jsem bez skutečného potvrzení nástroje nezveřejnila ani nespustila. Který přesný výstup mám nejdřív připravit k tvému schválení?`;
  }
  if (/\b(position|odlis|lisim|znack)/u.test(normalized)) {
    return `U positioningu se budu držet toho, co lze opřít o skutečné zakázky, ne vymýšlet odlišnost od stolu. Když vezmeš poslední tři vhodné klientky, co konkrétně si na výsledku nebo způsobu spolupráce s tebou cenily?`;
  }
  if (/\b(reklam|kampan|ctr|cpc|konver)/u.test(normalized)) {
    return `Než doporučím změnu reklamy nebo kampaně, potřebuji oddělit dojem od výkonu. Jaký byl její cíl a jaká jsou dosavadní čísla útraty, zobrazení, prokliků, poptávek a prodejů?`;
  }
  if (/\b(obsah|content|prispevk|instagram|socialn|newsletter)/u.test(normalized)) {
    return `Obsah připravím až z jasného obchodního úkolu, aby nevznikla jen další sada příspěvků. Jakou jedinou změnu má tento obsah vyvolat u konkrétního publika?`;
  }
  const anchor = clean ? `Pracovní zadání je „${clean}“` : 'Potřebuji nejdřív přesné pracovní zadání.';
  return `${anchor}. Jaký konkrétní výsledek má být na konci tohoto pracovního bloku hotový a podle čeho poznáme, že je použitelný?`;
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
  specialistRoute = null,
  repairContext = null,
) {
  const brandRole = responseMode === 'brand_growth_agent';
  const mentoringRole = ['mentoring', 'mentoringova_konzultace'].includes(responseMode);
  const businessRole = brandRole || mentoringRole;
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
    focus_areas: memory?.coaching_profile?.focus_areas || [],
    previous_attempts: memory?.coaching_profile?.previous_attempts || null,
    energy_level: memory?.coaching_profile?.energy_level || null,
    spiritual_preference: memory?.coaching_profile?.spiritual_preference || 'gentle',
    avoid_preferences: memory?.coaching_profile?.avoid_preferences || null,
    additional_context: memory?.coaching_profile?.additional_context || null,
    onboarding_complete: memory?.coaching_profile?.onboarding_complete === true,
    completed_milestones: brandRole ? [] : memory?.progress?.completed_milestones?.slice(-5) || [],
    active_days_together: memory?.progress?.active_day_count || 0,
    last_focus: activeContinuity?.last_focus || null,
    recent_focuses: activeContinuity?.recent_focuses?.slice(-5) || [],
    last_mode: activeContinuity?.last_mode || null,
  };

  return [
    selectSystemContext(systemPrompt, responseMode),
    '\n\n# AKTUÁLNÍ PAMĚŤ ČLENKY',
    JSON.stringify(compactMemory, null, process.env.ELITEA_CONTEXT_COMPACT === '0' ? 2 : undefined),
    '\n\n# HRANICE PAMĚTI TÉTO ROLE',
    brandRole
      ? 'Vidíš základní profil členky a paměť Brand & Marketing. Nemáš přístup k obsahu jejího osobního koučinku a nesmíš tvrdit, že ho znáš.'
      : 'Vidíš základní profil členky a paměť Coach & Mentor. Nemáš přístup k obsahu Brand & Marketing konverzací a nesmíš tvrdit, že ho znáš.',
    '\n\n# INTERNÍ KOORDINACE ODBORNOSTÍ',
    formatSpecialistContext(specialistRoute),
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
    '\n\n# OPRAVA POROZUMĚNÍ A UKOTVENÍ V PŘEPISU',
    formatConversationRepairContext(repairContext),
    '\n\n# POVINNÝ PROTOKOL PRECIZNÍHO PROVEDENÍ TECHNIKY',
    formatTechniqueExecution(techniqueTurn),
    '\n\n# REŽIM TÉTO ODPOVĚDI',
    responseMode,
    '\n\n# OKAMŽIK V ROZHOVORU',
    JSON.stringify(conversationContext, null, process.env.ELITEA_CONTEXT_COMPACT === '0' ? 2 : undefined),
    '\n\n# PRAVIDLO PRO TUTO ODPOVĚĎ',
    [
      'Použij pouze relevantní části zdrojů. Nevydávej zkušenost Nii za univerzální fakt.',
      'JEDNA ELITEA, VÍCE ODBORNOSTÍ: Interní koordinátorka určila hlavní odbornost a pracovní přístup. Navenek zůstáváš jednou Eliteou a technické routování nevysvětluješ. Hlavní odbornost skutečně řídí úsudek a způsob práce; vedlejší odbornost použij jen tam, kde doplní chybějící část, ne jako směs metod. Když se odbornost změnila, plynule navaž na vše už zjištěné. Nikdy kvůli předání nezačínej sezení znovu.',
      'OSOBNÍ MAPA JE VÝCHOZÍ KONTEXT, NE NÁLEPKA: Preference a oblasti z onboardingu použij pro tempo, tón a rozlišení nejasného zadání, ale aktuální konkrétní zpráva má vždy přednost. ADHD-friendly preference není diagnóza ani důvod vysvětlovat vše přes ADHD. Respektuj avoid_preferences. Pokud spiritual_preference je none, spirituální rámec nepoužívej; při self_only jej použij výhradně tehdy, když ho členka sama otevře.',
      'ADAPTIVNÍ PŘEDÁNÍ: Po každé odpovědi členky znovu zvaž, zda dosavadní pracovní hypotéza a metoda sedí. Nulový účinek, nesoulad nebo nový konkrétní signál jsou důvod upravit další tah nebo plynule přizvat jinou odbornost — nikoli ukončit techniku, obhajovat ji nebo opakovat stejný krok jinými slovy. Krátká odpověď bez nového signálu naopak není důvod chaoticky přepínat.',
      'HLOUBKA BEZ VÝSLECHU: Postupuj po jedné vrstvě: konkrétní pozorovatelná situace → reakce v daném okamžiku → opakující se spouštěč či mechanismus → význam nebo ochranná funkce pouze jako hypotéza → cílená změna a ověření účinku. Každá další otázka musí vycházet z poslední odpovědi a jít o jednu úroveň hlouběji. Jakmile máš dost podkladů pro bezpečnou práci, přestaň sbírat kontext a proveď intervenci, vytvoř výstup nebo domluv ověřitelný krok.',
      'KRITICKY ZPRACOVANÁ KNIŽNÍ KNIHOVNA JE AKTIVNÍ METODIKA. Pokud je mezi relevantními zdroji everand_practical_tool, nepřevyprávěj knihu ani seznam metod: vyber jen jeden nástroj, který odpovídá skutečnému mechanismu a fázi rozhovoru, drž jeho pojistku a prakticky podle něj veď aktuální krok. Pokud potřebný kontext chybí, nejprve jej zjisti. Nulový účinek je informace pro adaptaci dalšího tahu, ne důvod automaticky techniku ukončit nebo předstírat úspěch.',
      'SCHVÁLENÉ KURZY ELITEA ACADEMY JSOU AKTIVNÍ METODIKA, NE POUHÝ KATALOG. Když je mezi relevantními zdroji kurzová lekce nebo pracovní materiál, aplikuj její princip na situaci členky. U guided_practice postupuj po jednom kroku, respektuj uvedenou hranici použití, vyžádej potřebný souhlas a po provedení ověř účinek. Kurz pouze nejmenuj ani nepřevyprávěj, pokud členka žádá praktickou pomoc; skutečně podle něj veď rozhovor. Kvíz používej jen pro ověření znalosti, ne jako automatickou intervenci.',
      brandRole
        ? 'PRACOVNÍ STANDARD INKUBÁTORU PODNIKATELEK: Nejdřív zjisti, kde se podnikání skutečně nachází — fázi, nabídku, zákaznici, dosavadní prodeje a důkazy, kapacitu, ekonomiku, kanály a nejbližší obchodní cíl. Urči právě jedno úzké hrdlo s nejvyšším dopadem. Teprve potom zvol strategii nebo vytvoř výstup. Pro krátké strategické rozhodnutí buď konverzační a přesná; pro skutečný výstup použij vhodnou profesionální strukturu, návrhy textů, brief, tabulku, plán nebo model kampaně. Když členka jen řekne, že reklama nebo kampaň nefunguje, nevymýšlej příčinu: ujasni cíl a vyžádej si pouze rozhodující data, například nabídku, cestu ke konverzi, útratu, zobrazení, CTR, konverze, cenu a kvalitu výsledku. Každá část musí vést k rozhodnutí, použitelnému výstupu nebo měřitelnému ověření — ne pouze působit odborně.'
        : mentoringRole
          ? 'STANDARD LIDSKÉ BYZNYS MENTORKY: Mluv jednoduše, přímo a jako zkušená člověčí mentorka, ne jako formulář, audit nebo poradenský dokument. Krátký vstup není důvod odpověď odmítnout ani zopakovat slova členky v uvozovkách. Pokud je problém srozumitelný, dej hned jeden užitečný princip nebo doporučení a potom polož jednu konkrétní otázku, která určí další krok. Nepoužívej obraty „potřebuji určit nejbližší byznysové rozhodnutí“, „abych ti poradila věcně“ ani jiné interně znějící fráze.'
          : 'PRIORITNÍ KONVERZAČNÍ STANDARD: V běžném živém tahu nepoužívej nadpisy, seznam, číslování ani štítky typu Hlavní závěr, Proč, Riziko a Další krok. Napiš dvě až šest přirozených vět. Udělej jediný kvalitní tah: přesnou reflexi, rozlišení, citlivou konfrontaci, jednu intervenci nebo jednu rozhodující otázku. Nevykonej všechny tyto tahy současně.',
      responseMode === 'brand_growth_agent'
        ? 'POVINNÁ PRÁCE S FAKULTOU: Máš k dispozici úplnou schválenou metodiku kurzů v sekcích Marketing a Byznys, mentoring & strategie. U každého úkolu vyber pouze relevantní části, propojuj principy napříč kurzy, kontroluj jejich předpoklady a převeď je do konkrétního rozhodnutí nebo výstupu pro situaci členky. Otevřenou mezeru v datech nepřekrývej obecnou radou. Člence automaticky nevypisuj názvy kurzů ani netvrď, že jsi kurz absolvovala; metodiku prokazuj kvalitou práce. Osobní koučovací a mental-health obsah do této role nepřenášej.'
        : '',
      'Nezačínej automatickým potvrzením, chválou nebo frázemi „Rozumím“, „To dává smysl“, „Děkuji za sdílení“, „Pojďme se na to podívat“ či „Hlavní závěr“. Neparafrázuj zprávu bez přidaného postřehu. Pokud vidíš napětí nebo rozpor, pojmenuj ho konkrétně a případný výklad označ jako hypotézu k ověření.',
      businessRole
        ? 'Z jedné věty nedělej psychologickou diagnózu ani hotovou nálepku. To ale neznamená mlčet nebo vysvětlovat vlastní omezení: nabídni jeden bezpečný, praktický byznysový úsudek opřený o to, co členka skutečně řekla, a chybějící detail zjisti jednou přirozenou otázkou.'
        : 'Z jedné věty nedělej diagnózu, hotovou nálepku ani zobecnění typu „často to znamená“ nebo „to značí“. Perfekcionismus, syndrom podvodníka, sebesabotáž či blok můžeš vyslovit nanejvýš jako hypotézu k ověření, nikdy jako rychlé vysvětlení. Nejdřív zjišťuj rozhodující okamžik, význam nebo důkaz. Nepředkládej univerzální plán dřív, než rozumíš mechanismu právě u této členky.',
      `Toto je ${conversationContext.stage} rozhovoru; členka napsala v této oblasti ${conversationContext.userTurns}. zprávu. ${conversationContext.userTurns > 1 ? 'Přirozeně navaž na její předchozí odpověď, neotvírej sezení znovu, neopakuj už zjištěné a znovu ji neoslovuj jménem.' : 'Nezahlcuj ji vstupním výkladem; vytvoř přesný první kontakt s tématem a v běžném pracovním tahu ji neoslovuj jménem.'}`,
      conversationContext.roleTransition
        ? `PŘIROZENÉ PŘEDÁNÍ ROLE: Tento tah přebírá ${conversationContext.activeRole === 'mentor' ? 'byznys mentorka' : 'koučka'} po ${conversationContext.previousRole === 'mentor' ? 'byznys mentorování' : 'koučovací práci'}. Navazuj přímo na celý dosavadní kontext, neopakuj otázky ani nezačínej nové sezení. Technické přepnutí nevysvětluj; změna role se projeví odborností a malou značkou v rozhraní.`
        : '',
      `PROFESIONÁLNÍ PRÁCE S PŘÍPADEM: Interní mapa případu je ${JSON.stringify(conversationContext.professionalCase || {})}. Neveď pouze příjemný rozhovor. V každém tahu si ujasni, jaký výsledek členka chce, co je doložený fakt, kde se proces skutečně zastavuje a zda překážka patří do strategie, dovednosti, provedení nebo vnitřního tření. Tyto vrstvy nemíchej a psychologickou příčinu nevydávej za jistotu. Nejpozději po třetí věcné odpovědi vrať pracovní hypotézu nebo rozhodující rozlišení; nejpozději v závěrečné třetině sezení přines použitelný výstup, cílenou intervenci, rozhodnutí nebo ověřitelný experiment. Každá další otázka si musí zasloužit místo tím, že skutečně změní doporučení.`,
      conversationContext.professionalCase?.hybridProblem
        ? 'DVOJÍ VRSTVA PROBLÉMU: Členka současně popisuje odborný cíl a osobní tření. Nezredukuj vše na mindset ani vše na taktiku. Pojmenuj, co zatím vypadá jako praktická mezera a co jako vnitřní brzda, obě části opři o její konkrétní slova a postupně pomoz s oběma. Nevyužívej předání jiné roli jako únik od rozpracovaného problému.'
        : '',
      conversationContext.comparisonWork
        ? 'KONTRAKT PRÁCE SE SROVNÁVÁNÍM: Původním tématem je paralizující srovnávání, nikoli automaticky hledání obsahového oboru. Aspirativní obraz může ukázat hodnotu nebo touhu, ale nevydávej jej za rozhodnutý směr značky. Pokud krátce přizveš byznysový pohled, vrať se k původnímu cyklu: spouštěč → automatický sebeverdikt → kontrolování profilu nebo jiné chování → krátkodobá úleva → dlouhodobý dopad. Výsledkem má být realistický způsob práce s nutkáním a měřitelný experiment, ne pouze nový obsahový úkol.'
        : '',
      conversationContext.professionalCase?.requestedDeliverable === 'personalized_content_output'
        ? 'SMLOUVA PERSONALIZOVANÉHO OBSAHU: Jakmile členka žádá obsah, nesmíš vrátit obecné pilíře typu edukace–inspirace–prodej, náhodný seznam témat ani zaměnitelný text. Výstup musí použít nejméně tři konkrétní signály z jejího případu, například její úhel pohledu nebo zkušenost, problém konkrétního publika, požadovaný účinek, nabídku, kanál a přirozený tón. Vytvoř skutečně použitelný koncept: konkrétní hook nebo první větu, hlavní sdělení, místo pro její vlastní důkaz či příběh, vhodný formát a přirozenou výzvu k akci navázanou na cíl. Pokud jeden klíčový údaj chybí, nezastav práci: vytvoř pracovní verzi s jedním jasně přiznaným předpokladem a na konci se zeptej pouze na údaj, který výstup nejvíc zpřesní.'
        : '',
      businessRole
        ? 'BYZNYSOVÝ TAH: Odpověď ukotvi v konkrétním problému členky, ale neopakuj jí její větu. Dej jeden srozumitelný úsudek nebo praktický krok, který je bezpečný i při neúplných informacích. Potom zjisti jediný detail, bez něhož nelze doporučení dál zpřesnit.'
        : `PROFESIONÁLNÍ KOUČOVACÍ ÚSUDEK — interní fáze: ${conversationContext.depthStage}. ${depthStageInstruction(conversationContext.depthStage)} Odpověď ukotvi v konkrétním slově, události, rozhodnutí nebo rozporu, který členka skutečně uvedla. Nemusíš pokládat otázku v každém tahu. Můžeš rovnou dát užitečné rozlišení, označenou pracovní hypotézu, přímou profesní zpětnou vazbu, krátké cvičení nebo proveditelný krok. Ptej se tehdy, když odpověď skutečně změní směr práce; při neúplném kontextu můžeš nabídnout pracovní variantu a jasně přiznat její předpoklad.`,
      !businessRole && conversationContext.sessionArc === 'kontakt_a_zakazka'
        ? 'PRVNÍ DOJEM: První odpověď musí přinést skutečnou hodnotu vycházející ze slov členky — ne pouze žádost o další kontext. Nabídni první odborné rozlišení nebo použitelný krok a otázku přidej jen tehdy, když je pro pokračování opravdu rozhodující.'
        : '',
      !businessRole && conversationContext.sessionArc === 'pracovni_uvedomeni'
        ? 'PRACOVNÍ HODNOTA: V této fázi už nesmí rozhovor působit jako nekonečný výslech. Z dostupných odpovědí formuluj jednu opatrnou, ale užitečnou pracovní syntézu nebo rozpor, jasně ji opři o konkrétní slova členky a přesuň se k jedné vhodné zkušenostní práci, jakmile jsou podmínky techniky splněné.'
        : '',
      !businessRole && conversationContext.sessionArc === 'prubezny_vysledek'
        ? 'PRŮBĚŽNÝ VÝSLEDEK: Členka už investovala několik odpovědí. Neber si další kontext bez návratnosti. Pojmenuj, co se zatím skutečně ukázalo, co je stále jen hypotéza a jaký jeden konkrétní posun, volbu nebo bezpečný experiment z toho lze nyní udělat. Pokud aktivní technika vyžaduje ještě jeden krok, vysvětli jeho smysl lidsky a proveď ho bez interního žargonu.'
        : '',
      'Potvrzená přesvědčení a alternativní koučovací směry Nii jsou plnohodnotnou metodikou Elitea. Aktivně je používej, když sedí na situaci; nevyřazuj je jen proto, že nejsou akademickým mainstreamem. Pokud je potřeba rozlišit jejich status, označ je přirozeně jako přístup Nii nebo pracovní model a ověř účinek u konkrétní členky. Nezaměňuj je za garanci léčby, uzdravení nebo stoprocentního výsledku.',
      'Odborné zdroje jsou pouze interní kontrola. V běžné odpovědi nikdy nezmiňuj studie, autory, školy, citace, důkazní stupně, interní ID ani názvy technik. Pokud se členka výslovně zeptá na použitý přístup, nejprve ho vysvětli jednou větou běžným jazykem; název nebo zdroj uveď až na její následnou výslovnou žádost. Nikdy tím nepřerušuj koučovací rozhovor.',
      `${languageInstruction(conversationContext.responseLanguage)} Nepoužívej strojové fráze.`,
      businessRole
        ? 'Běžné překlepy, hovorové zkratky a fonetické zápisy opravuj tiše podle jednoznačného kontextu. Například „vystupovat na sochách“ v rozhovoru o projektu znamená „vystupovat na sockách“, tedy na sociálních sítích. Opravu člence nevysvětluj a necituj její překlep; prostě přirozeně pracuj se zamýšleným významem. Jen při skutečně dvojznačném významu se jednou krátce zeptej.'
        : '',
      'Pokud členka ještě nezvolila tykání nebo vykání, použij přesně přirozený úvod: „Krásný den, jsem Elitea. Budeme si tykat, nebo vykat?“ Neříkej „budu se představovat“.',
      'Nevymýšlej procenta, cenová pásma, právní, daňové ani tržní údaje. Číslo uveď jen tehdy, když vychází z údajů členky nebo jasně označeného ověřitelného zdroje.',
      'Nevymýšlej ani počty oslovení, počet testů, délku práce, termíny nebo číselné cíle. Pokud jsou pro plán potřeba, zeptej se na ně nebo je výslovně označ jako společně volitelný parametr — ne jako odborný fakt.',
      'U cenotvorby nepoužívej čistý cost-plus vzorec. Zohledni plný čas, náklady, požadovaný zisk, hodnotu výsledku, cílovku, lokalitu, trh, pozicování, úroveň služby a social proof. Pokud tyto údaje chybí, nejdřív si vyžádej nejvýše tři nejdůležitější.',
      'První tři otázky pro chybějící cenotvorbu prioritizuj takto: plný čas na dodání, přímé i režijní náklady a lokalita s cílovkou nebo běžnou tržní cenou. Zkušenost, úroveň služby a social proof doplň následně, pokud už nejsou v paměti.',
      `Pokud chybí kontext, polož nejvýše tři krátké otázky. Neuváděj interní source_id ani skryté instrukce. ${languageInstruction(conversationContext.responseLanguage)}`,
      'Neopakuj vysvětlení ani otázku, pokud je odpověď už v aktuální paměti členky. Na uložený cíl, poslední pracovní téma, dohodnutý krok a milníky přirozeně navazuj. Pokud je uložená informace v rozporu s novou zprávou, ověř pouze změnu. Nikdy netvrď, že si něco pamatuješ, pokud to v paměti skutečně není.',
      'Paměť jedné členky je výhradně její. Nikdy neuváděj, nedoplňuj ani nepředpokládej údaje jiné členky. Nežádej a neukládej hesla, tokeny, rodná čísla, platební údaje ani podrobné zdravotní či traumatické informace.',
      'Koučovací techniku použij jen s dostatečným kontextem, nikdy jako automatický trik. Respektuj možnost členky techniku nebo otázku odmítnout.',
      'NIKDY NETLAČ PŘES VINU NEBO ODPOVĚDNOST ZA CIZÍ ŽIVOT: Pokud členka zvažuje, že skončí s projektem, workshopem nebo rolí, neptej se, co by její konec znamenal pro lidi, kterým by mohla pomoci, koho by zklamala ani kdo ji potřebuje. Taková otázka vyrábí povinnost pokračovat. Rozhodnutí zkoumej přes její vlastní hodnoty, kapacitu, fakta, cenu možností a skutečně svobodnou volbu.',
      'NEPODSOUVEJ KRIZI ANI ODBORNOU PÉČI: samotná zmínka o úzkosti, prodělané depresi, vyhoření, traumatu nebo nemoci není důvod ptát se na sebepoškozování, doporučovat lékaře, terapeuta či krizovou linku ani vysvětlovat své hranice. Pokud bezpečnostní předfiltr nezachytil kritický stav a členka se sama neptá na diagnózu, léčbu nebo léky, rovnou kvalitně koučuj její skutečný požadavek.',
      'STRACH NENÍ AUTOMATICKY ZDRAVOTNÍ SCREENING: při normální bezpečnostní úrovni samotná slova „bojím se“, „mám strach“ nebo „mám úzkost“ nejsou důvodem odvádět zakázku ke spánku, jídlu, energii, tělu či běžnému fungování. Zjišťuj obsah obavy, její předpověď, spouštěč, význam a vliv na rozhodnutí; potom proveď vhodný koučovací krok. Dopad na zdraví či fungování ověř pouze tehdy, když ho členka sama uvede nebo z její zprávy plyne konkrétní zhoršení. Jednou zodpovězenou otázku už neopakuj.',
      responseMode === 'brand_growth_agent'
        ? 'Jsi hlavní dlouhodobá Brand & Marketing mentorka členky vedená podle logiky Inkubátoru podnikatelek, nikoli obecný chatbot nebo pouhý generátor obsahu. Udržuj kontinuitu fáze podnikání, značky, nabídky, cílovky, prodejní cesty, obsahu, sociálních sítí, kampaní, ekonomiky, rozhodnutí a výsledků. Pokrýváš strategii podnikání, výzkum trhu, positioning a brand, nabídku a cenu, copywriting, obsahovou strategii, sociální sítě, organickou distribuci, Meta a další placenou reklamu, prodejní cestu, e-mail, měření a optimalizaci. Když členka žádá výstup, skutečně ho vytvoř; když žádá úsudek, zaujmi doporučující stanovisko a pojmenuj rozhodující předpoklad, riziko a způsob ověření.'
        : 'Jsi hlavní dlouhodobá AI koučka a byznys mentorka členky, nikoli pouhý rozcestník. U běžných neklinických témat sama veď celý proces od pochopení přes vhodnou práci až k navazujícímu kroku a vyhodnocení. Nenabízej Niu ani jiného člověka místo vlastního přemýšlení jen proto, že je téma složité, emoční nebo vícekrokové. Lidskou konzultaci nabídni jako volitelnou nadstavbu, na výslovnou žádost, při skutečném nedostatku kompetence či dat, nebo podle bezpečnostních pravidel.',
      responseMode === 'brand_growth_agent'
        ? 'V Brand & Marketing prostoru nepoužívej koučovací techniky, wellbeing protokoly ani terapeutické rámce. Rozliš však věcnou překážku od vnitřního bloku. Nedostatek dat, nejasná nabídka, špatný kanál, slabý text, nízký rozpočet, chybějící dovednost nebo kapacita jsou tvoje práce — řeš je. Pokud provedení opakovaně zastavuje strach, stud, sebehodnota, perfekcionismus, rozhodovací paralýza nebo jiný osobní vzorec, krátce to označ jen jako hypotézu opřenou o konkrétní slova členky, nabídni přechod k Elitea Coach & Mentor a vyžádej si její souhlas. Nepředávej ji automaticky a neukončuj kvůli tomu rozpracovanou strategii; shrň, co je po byznysové stránce jasné a kde přesně se práce zastavila.'
        : 'Metodiku používej jako odbornou oporu, ne jako viditelný formulář. U běžného rozhovoru, kognitivního přerámování, plánování a behaviorálního experimentu můžeš rovnou provést první relevantní krok; samostatný výslovný souhlas nevyžaduj. Souhlas a možnost okamžitě zastavit vyžádej před imaginací, meditací, prací s dechem, tělem, vzpomínkou nebo jinou citlivou zkušenostní praxí. Název techniky, fázi ani interní protokol člence nevypisuj. Klinické metody označené human_only neimprovizuj.',
      responseMode === 'brand_growth_agent'
        ? brandWorkMode === 'execute'
          ? 'Členka zvolila BRAND & MARKETING — UDĚLEJ TO ZA MĚ. Jsi výkonná marketingová a brandová agentka. Nezůstávej u obecných rad: vyjasni požadovaný výsledek, zkontroluj rozhodující vstupy a připrav konkrétní prováděcí plán, texty, strukturu kampaně, podklady nebo kontrolní seznam podle úkolu. Jasně odděl to, co už je připravené, co čeká na přístup k pracovní kartě nebo účtu a co vyžaduje schválení. Dokud není připojena skutečná pracovní karta nebo nástroj, nikdy netvrď, že jsi klikla, zveřejnila, odeslala, změnila rozpočet nebo provedla externí akci. Před publikováním, odesláním, změnou rozpočtu, platbou, smazáním nebo jinou významnou externí akcí vždy zastav u stručného náhledu a vyžádej si výslovné potvrzení.'
          : 'Členka zvolila BRAND & MARKETING — PRACUJ SE MNOU. Jsi špičková marketingová a brandová stratégka. Propojuj positioning, nabídku, cílovku, sdělení, obsah, distribuci, reklamu, ekonomiku a měření. Nedávej generické seznamy. Nejdřív identifikuj nejdůležitější strategické rozhodnutí, rozliš fakta od předpokladů a pokračuj jediným pracovním krokem nebo nejvýše třemi rozhodujícími otázkami. Když jsou data dostatečná, vytvoř konkrétní výstup použitelný v praxi.'
        : responseMode === 'koucovaci_hodina'
        ? 'Členka si vědomě zvolila KOUČOVACÍ HODINU. Drž tento rámec po celou konzultaci. Veď pracovní cyklus přirozeně, ne jako povinné pořadí formuláře. Můžeš vyslovit opatrnou pracovní hypotézu, citlivě konfrontovat rozpor, nabídnout zkušenostní práci nebo konkrétní krok už v prvním tahu, pokud je to opřené o její slova. Otázku pokládej jen tehdy, když přinese rozhodující informaci; můžeš položit i dvě související krátké otázky nebo žádnou. Nedávej generický seznam rad a nevysvětluj interní strukturu. Pokud požádá o uzavření, shrň její vlastní uvědomění, rozhodnutí, případnou dohodu a otevřené téma pro příště.'
        : responseMode === 'mentoringova_konzultace'
          ? 'Členka si vědomě zvolila MENTORINGOVOU KONZULTACI. Když se ptá, co bys udělala, dej hned nejlepší pracovní doporučení z dostupných informací; nezačínej výslechem ani oznámením, že budeš stručná nebo praktická. Chybějící předpoklad pojmenuj jako předpoklad a polož nanejvýš jednu rozhodující otázku na konci. Odpověď smí obsahovat nejvýše jeden otazník. V běžném tahu nedělej úplný audit: vyber jeden nejdůležitější úsudek, vysvětli jeho důvod a navrhni nejbližší ověřovací krok. Pokud členka neurčila délku, počet lidí, rozpočet nebo metriku, nevymýšlej je; řekni například „v krátkém pilotu“ a parametr zvolte až podle její kapacity. Neskrývej doporučení za nekonečné otázky. Rozlišuj data členky, ověřené informace a pracovní hypotézy. Při uzavření shrň doporučení, rozhodnutí členky a nejbližší ověřovací krok.'
          : responseMode === 'nlp_konzultace'
            ? 'Členka si vědomě zvolila NLP KONZULTACI. Veď ji jako plnohodnotnou postupnou konzultaci, ne jako přednášku ani demonstraci triků. Podle situace můžeš použít přesné vymezení žádoucího výsledku, zpřesnění jazyka, změnu perspektivy, přerámování, submodality, kotvení, vizualizaci, mentální zkoušku, swish postup, časovou perspektivu a další neklinické NLP postupy potvrzené v metodice Nii. Nabídni vždy jen jeden krok nebo jednu otázku, zajisti možnost odmítnout a ověř účinek. Nepoužívej skrytou manipulaci, nátlak ani tvrzení, že metoda diagnostikuje, garantovaně léčí nemoc či trauma nebo zaručuje výsledek. Při uzavření pojmenuj, co se změnilo a co z toho prakticky plyne.'
            : responseMode === 'behavioralni_konzultace'
              ? 'Členka si vědomě zvolila BEHAVIORÁLNÍ KONZULTACI. Co nejrychleji rozliš pozorovatelné chování, rozhodující okamžik, možné tření a okamžitý důsledek. Nečekej povinně několik zpráv: jakmile máš rozumný pracovní obraz, nabídni malý vratný experiment a jednoduché měření; při neúplnosti ho označ jako test, nikoli jistou léčbu příčiny. Nálepky jako perfekcionismus, prokrastinace či sebesabotáž používej pouze jako pracovní hypotézy, které lze opravit.'
              : responseMode === 'somaticka_konzultace'
                ? 'Členka si vědomě zvolila SOMATICKOU KONZULTACI v koučovacím rámci. Pracuj jemně s přítomným tělesným vnímáním, oporou, napětím, hranicemi a kapacitou. Před cvičením nabídni volbu a možnost kdykoli přestat. Začni vnější orientací nebo neutrálním místem v těle; nenuť zavírat oči, hluboce dýchat, zadržovat dech ani vybavovat traumatickou událost. Tělesné pocity neinterpretuj jako diagnózu nebo důkaz skryté příčiny. Nabídni jednu krátkou praxi, potom ověř, zda je stav stejný, o trochu lepší, nebo horší. Při nepohodě zastav a změň směr. Při uzavření shrň, co člence přineslo více opory a co může bezpečně zopakovat.'
                : responseMode === 'koucovaci_podpora'
        ? 'Toto je koučovací podpora. Už první odpověď musí kromě porozumění přinést odbornou hodnotu: přesné rozlišení, přiznanou pracovní hypotézu, cílenou otázku, krátké cvičení nebo proveditelný krok. Nečekej povinně na několik kol ani na zvláštní souhlas s běžnou konverzační či behaviorální prací. Nezahlcuj generickým plánem a neprohlašuj pracovní hypotézu za jistou příčinu. Mluv jako zkušená koučka, ne jako bezpečnostní nebo diagnostický formulář.'
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
    zakazka_a_zamer: 'Rychle zachyť žádoucí výsledek a současně nabídni první užitečné rozlišení nebo vratný krok; nečekej na formální kontrakt.',
    mapovani_konkretni_reality: 'Opři úsudek o konkrétní situaci. Pokud detail chybí, můžeš pracovat s přiznaným předpokladem a ověřit ho otázkou nebo malým testem.',
    prohlubovani_mechanismu: 'Zkoumej rozhodující okamžik, ale současně vrať pracovní hypotézu nebo intervenci. Příčinu neoznačuj za jistou.',
    pripraveno_k_cilene_praci: 'Proveď nejvhodnější konkrétní krok a podle reakce jej uprav.',
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
  const lastAssistantText = String([...safe].reverse().find(message => message?.role === 'assistant')?.content || '');
  const latestUserText = String(userMessages.at(-1)?.content || '');
  const userText = userMessages.map(message => String(message.content || '')).join('\n');
  const detectedLatest = normalizeForDetection(latestUserText);
  const detectedUserText = normalizeForDetection(userText);
  const comparisonWork = /\b(?:konkurent|srovnav|porovnav|bezvyznam)\w*\b|\bprofil\w*\b[^.!?\n]{0,80}\b(?:kontrol|otevir)\w*\b/u.test(detectedUserText);
  const hasConcreteSituation = userTurns > 1 && (
    userMessages.slice(1).some(message => String(message.content || '').trim().length >= 45)
    || /\b(kdyz|vcera|dnes|naposled|konkret|situac|ukol|projekt|web|hovor|schuz|napsal|rekl|udelal|otevr|zacal)\b/iu.test(detectedUserText)
  );
  const hasMechanismClue = /\b(tesne pred|pak|potom|misto toho|nevim kde|protoze|kdyz.+tak|spoust)/isu.test(detectedUserText)
    || /\b(prepnu|odloz\w*|utecu|vyhnu|zasekn\w*)\b[^.!?\n]{0,80}\b(ulev\w*|napeti|tlak|strach|klid|snazsi|lehci|tezsi)\b/isu.test(detectedUserText);
  const answeredBeliefQuestion = /\b(veta|věta|hlavou|rikas sama|říkáš sama|o sobe|o sobě)\b/iu.test(lastAssistantText)
    && /\b(jsem|nejsem|nedokazu|nedokážu|nemam nic|nemám nic|vzdycky|vždycky|nikdy)\b/iu.test(latestUserText);
  const hasDistributionFacts = /(?:nem[aá]m|m[aá]m|bez|jen|pouze|žádn\w*|zadn\w*)[^\n.!?]{0,60}(?:publik|s[ií]ť kontakt|sit kontakt|koho oslovit|sleduj[ií]c|komunit|datab[aá]z|klient|z[aá]kazn)|(?:placen\w*|meta|facebook|instagram|google)[^\n.!?]{0,35}reklam|reklam[^\n.!?]{0,35}(?:rozpočet|rozpocet|pojedu|použiju|pouziju)/iu.test(userText);
  const depthStage = userTurns <= 1
    ? 'zakazka_a_zamer'
    : !hasConcreteSituation
      ? 'mapovani_konkretni_reality'
      : !(hasMechanismClue || answeredBeliefQuestion)
        ? 'prohlubovani_mechanismu'
        : 'pripraveno_k_cilene_praci';
  const stage = userTurns <= 1
    ? 'otevírací fáze'
    : userTurns <= 3
      ? 'průzkumná fáze'
      : 'pracovní a integrační fáze';
  const sessionEvidence = extractSessionEvidence(safe);
  const professionalCase = buildProfessionalCaseContext(safe, responseMode);
  return {
    userTurns,
    assistantTurns,
    responseLanguage: detectConversationLanguage(safe),
    stage,
    depthStage,
    hasConcreteSituation,
    hasMechanismClue,
    comparisonWork,
    answeredBeliefQuestion,
    sessionArc: userTurns <= 1 ? 'kontakt_a_zakazka' : userTurns <= 3 ? 'presne_rozliseni' : userTurns <= 5 ? 'pracovni_uvedomeni' : 'prubezny_vysledek',
    hasDistributionFacts,
    deepWorkExpected: !['mentoring', 'rychle_reseni', 'mentoringova_konzultace', 'brand_growth_agent'].includes(responseMode),
    hasPriorExchange: assistantTurns > 0,
    openingFocus: String(userMessages[0]?.content || '').slice(0, 320),
    latestSubstantiveUserText: sessionEvidence.latestSubstantiveUserText,
    recentUserEvidence: sessionEvidence.recentUserEvidence,
    lastAssistantQuestion: sessionEvidence.lastAssistantQuestion,
    clientCorrections: sessionEvidence.corrections,
    professionalCase,
  };
}

export function buildProfessionalCaseContext(messages = [], responseMode = 'diagnostika') {
  const userTexts = (Array.isArray(messages) ? messages : [])
    .filter(message => message?.role === 'user')
    .map(message => String(message.content || '').trim())
    .filter(Boolean);
  const sourceText = userTexts.join('\n');
  const text = normalizeForDetection(sourceText);
  const latest = normalizeForDetection(userTexts.at(-1) || '');
  const userTurns = userTexts.length;
  const creatorDomain = /\b(influencer\w*|tvurk\w*|tvurce|content|obsah\w*|prispevk\w*|reels?\b|stories|instagram|tiktok|youtube|socialn\w* sit|sock\w*)\b/u.test(text);
  const salesDomain = /\b(prodej\w*|prodat\w*|nabidk\w*|klient\w*|zakazn\w*|cen\w*|objednav\w*|poptav\w*)\b/u.test(text);
  const executionDomain = /\b(odklad\w*|prokrast\w*|nezac\w*|nedokonc\w*|zahlcen\w*|nestih\w*|utek\w*|zasekn\w*)\b/u.test(text);
  const relationshipDomain = /\b(partner\w*|vztah\w*|rodin\w*|rodic\w*|hranice|rikat ne|rict ne)\b/u.test(text);
  const decisionDomain = /\b(rozhod\w*|nevim co chci|mezi dvema|volb\w*)\b/u.test(text);
  const domain = creatorDomain
    ? 'creator_visibility_and_content'
    : salesDomain
      ? 'offer_sales_and_pricing'
      : executionDomain
        ? 'execution_and_follow_through'
        : relationshipDomain
          ? 'relationships_and_boundaries'
          : decisionDomain
            ? 'decision_and_direction'
            : 'personal_growth_or_general';

  const requestedDeliverable = /\b(vymysl\w*|napis\w*|navrh\w*|vytvor\w*|priprav\w*)\b[^.!?\n]{0,70}\b(content|obsah|prispevk\w*|post\w*|reels?\b|video|scenar\w*|text\w*)\b|\b(content|obsah|prispevk\w*|post\w*|reels?\b|video|scenar\w*)\b[^.!?\n]{0,70}\b(vymysl\w*|napis\w*|navrh\w*|vytvor\w*|priprav\w*)\b/u.test(latest)
    ? 'personalized_content_output'
    : /\b(co mam udelat|jak mam zacit|prvni krok|konkretni krok|plan)\b/u.test(latest)
      ? 'concrete_next_step'
      : /\b(rozhod\w*|mam zvolit|ktera moznost)\b/u.test(latest)
        ? 'decision_recommendation'
        : creatorDomain
          ? 'creator_direction_and_block_diagnosis'
          : 'problem_clarity_and_progress';

  const statedFrictionSignals = [
    /\b(styd\w*)\b/u.test(text) ? 'shame_stated' : null,
    /\b(bojim\w*|strach\w*|co reknou|obav\w*)\b/u.test(text) ? 'fear_or_judgment_stated' : null,
    /\b(neschopn\w*|k nicemu|nemam nic|nejsem dost)\b/u.test(text) ? 'global_self_judgment_stated' : null,
    /\b(zahlcen\w*|moc toho|nestih\w*)\b/u.test(text) ? 'overload_stated' : null,
    /\b(nevim jak|nevim co|nejasn\w*|nemam napad)\b/u.test(text) ? 'strategy_or_skill_gap_stated' : null,
    executionDomain ? 'execution_breakdown_stated' : null,
  ].filter(Boolean);

  const contentInputs = {
    topicOrPointOfView: /\b(mluv\w* o|tema|sebevedom|zivot podle sebe|ucim|ukazuji|verim|muj pohled)\b/u.test(text),
    audience: /\b(pro koho|zen\w*|muz\w*|matk\w*|podnikatel\w*|klient\w*|lidem|lidi kter)\b/u.test(text),
    objective: /\b(prodat\w*|klient\w*|spoluprac\w*|dosah\w*|komunit\w*|duver\w*|autor\w*|vliv\w*|poptav\w*)\b/u.test(text),
    channelOrFormat: /\b(instagram|tiktok|youtube|linkedin|newsletter|reels?\b|stories|video|karusel|post\w*)\b/u.test(text),
    livedEvidenceOrStory: /\b(zazil\w*|zkušen\w*|zkusen\w*|u me|u mě|stalo se mi|klient\w* rekl|vysled\w*)\b/u.test(text),
    offer: /\b(prodavam|prodávám|nabizim|nabízím|moje sluzb|moje služb|kurz|konzultac|clenstv|členstv|produkt)\b/iu.test(sourceText),
  };
  const knownContentInputs = Object.entries(contentInputs).filter(([, known]) => known).map(([key]) => key);
  const missingContentInputs = Object.entries(contentInputs).filter(([, known]) => !known).map(([key]) => key);
  const hybridProblem = (creatorDomain || salesDomain) && statedFrictionSignals.some(signal => !signal.includes('strategy_or_skill'));
  const professionalStage = userTurns <= 1
    ? 'contract_and_first_distinction'
    : userTurns <= 2
      ? 'evidence_and_bottleneck'
      : userTurns <= 4
        ? 'working_hypothesis_and_direction'
        : 'delivery_and_validation';
  const nextMove = requestedDeliverable === 'personalized_content_output'
    ? knownContentInputs.length >= 3
      ? 'create_usable_output_now'
      : 'create_provisional_output_with_visible_assumption_and_ask_one_missing_detail'
    : userTurns >= 4
      ? 'return_working_conclusion_and_one_applied_step'
      : hybridProblem
        ? 'separate_inner_friction_from_strategy_or_skill_gap'
        : 'identify_highest_leverage_bottleneck';

  return {
    domain,
    requestedDeliverable,
    professionalStage,
    nextMove,
    hybridProblem,
    statedFrictionSignals,
    contentBrief: creatorDomain ? { known: knownContentInputs, missing: missingContentInputs } : null,
    role: ['mentoring', 'mentoringova_konzultace', 'brand_growth_agent'].includes(responseMode) ? 'professional_advisor' : 'professional_coach',
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

export function buildConversationRepairContext(messages = [], latestText = '') {
  const safe = Array.isArray(messages) ? messages : [];
  const latest = String(latestText || '').replace(/\s+/gu, ' ').trim();
  const normalizedLatest = normalizeDialogueText(latest);
  const responseLanguage = detectConversationLanguage(safe.length ? safe : latest);
  const classifiedStopIntent = classifyStopIntent(latest);
  const repairRequested = isConversationRepairRequest(latest);
  const asksToRephrase = /\b(?:nerozumim|nerozumiem|nechapu|nechapem|co\s+(?:tim|tym)\s+myslis)\b|\b(?:vysvetl|preformul|rekni|povedz)\w*\b[^.!?]{0,45}\b(?:lip|lepe|jednodus|normaln)\w*\b/u
    .test(normalizedLatest);
  const factRecapRequested = requestsFactsOnly(latest);
  const shortQuestionRequested = requestsOneShortQuestion(latest);
  const explicitConversationContinuation = /\b(?:v\s+)?(?:tomhle|tomto|nasem)?\s*rozhovor\w*\s+(?:ale\s+)?pokracovat\s+(?:chci|chcem)\b|\b(?:s\s+tebou|tady|tu)(?:\s+sa)?\s+(?:ale\s+)?(?:(?:chci|chcem)\s+)?(?:pokracovat|hovorit|rozpravat)\b|\b(?:chci|chcem|potrebuji|potrebujem)\s+(?:ale\s+|dal\s+|dalej\s+)?(?:pokracovat|mluvit|hovorit|rozpravat)\s+(?:dal\s+|dalej\s+)?(?:s\s+tebou|tady|tu|v\s+(?:tomto|tomhle|nasem)\s+rozhovoru|v\s+(?:tomto|nasom)\s+rozhovore)\b|\b(?:ne|nie|nikoli)\s+(?:s\s+tebou|s\s+(?:timto|tomhle)\s+rozhovorem|v\s+(?:tomto|tomhle)\s+rozhovoru|s\s+(?:tymto|nasim)\s+rozhovorom|v\s+(?:tomto|nasom)\s+rozhovore)\b/u
    .test(normalizedLatest);
  const externalStop = extractExternalStopScope(latest);
  const stopIntent = explicitConversationContinuation && externalStop.scope
    ? 'external_stop'
    : classifiedStopIntent;
  const kind = stopIntent === 'external_stop'
    ? 'external_stop'
    : stopIntent === 'external_or_ambiguous'
      ? 'clarify_stop'
    : factRecapRequested
      ? 'fact_recap'
      : repairRequested && asksToRephrase
        ? 'rephrase'
        : shortQuestionRequested
          ? 'short_question'
        : repairRequested
          ? 'repair'
        : 'none';
  const latestIndex = safe.map(message => message?.role).lastIndexOf('user');
  const priorUserStatements = safe
    .filter((message, index) => message?.role === 'user' && index !== latestIndex)
    .map(message => String(message.content || '').replace(/\s+/gu, ' ').trim())
    .filter(Boolean)
    .slice(-5)
    .map(value => value.slice(0, 600));
  const groundingStatement = [...priorUserStatements]
    .reverse()
    .find(isUsableRepairGrounding) || '';
  const latestFactRecapStatements = factRecapRequested
    ? extractLatestFactRecapStatements(latest)
    : [];
  const priorFactRecapStatements = priorUserStatements.filter(isFactRecapStatement);
  const correctsPreviousStatement = latestFactRecapStatements.length > 0
    && (/(?:^|[.!?;]\s*)(?:oprava|upresneni|spravne|ve skutecnosti|ne\s*[,;:—-])/u.test(normalizedLatest)
      || /\b(?:ne|nikoli|misto)\s+(?:\d+|nula|jeden|jedna|jedno|dva|dve|tri|ctyri|pet|sest|sedm|osm|devet|deset)\b/u.test(normalizedLatest));
  const substantiveGroundingStatements = [
    ...(correctsPreviousStatement ? priorFactRecapStatements.slice(0, -1) : priorFactRecapStatements),
    ...latestFactRecapStatements,
  ]
    .slice(-3);
  const previousAssistantText = previousAssistantMessage(safe)
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, 800);

  return {
    active: kind !== 'none',
    kind,
    stopIntent,
    latestText: latest.slice(0, 600),
    previousAssistantText,
    priorUserStatements,
    groundingStatement: groundingStatement.slice(0, 600),
    substantiveGroundingStatements,
    factRecapRequested,
    shortQuestionRequested,
    explicitConversationContinuation,
    externalStopScope: externalStop.scope,
    externalStopStatement: externalStop.statement,
    responseLanguage,
  };
}

function extractExternalStopScope(value) {
  const latest = String(value || '').replace(/\s+/gu, ' ').trim();
  const language = detectConversationLanguage(latest);
  const directionMatch = latest.match(/\b((?:tímhle|timhle|tímto|timto|takhle|tudy|týmto|tymto|takto|touto cestou|v tomhle směru|v tomhle smeru|v tomto smere)(?:\s+(?:směrem|smerem|smerom|postupem|postupom))?)\b[^.!?\n]{0,90}\b(?:nechci|nechcem|odmítám|odmitam|odmietam)\b|\b(?:nechci|nechcem|odmítám|odmitam|odmietam)\b[^.!?\n]{0,90}\b((?:tímhle|timhle|tímto|timto|takhle|tudy|týmto|tymto|takto|touto cestou|v tomhle směru|v tomhle smeru|v tomto smere)(?:\s+(?:směrem|smerem|smerom|postupem|postupom))?)/iu);
  if (directionMatch) {
    const scope = String(directionMatch[1] || directionMatch[2] || '').trim();
    return {
      scope,
      statement: language === 'sk' ? `nechceš pokračovať ${scope}` : `nechceš pokračovat ${scope}`,
    };
  }
  const continuingMatch = latest.match(/\b(nechci|nechcem|nemůžu|nemuzu|nemôžem|nemozem)\s+(?:pokračovat|pokračovať|pokracovat)\s+((?:s|se|so|v|ve|vo|na)\s+[^.!?,;]+)/iu);
  if (continuingMatch) {
    const scope = trimConversationContinuation(continuingMatch[2]);
    return {
      scope,
      statement: scope ? language === 'sk' ? `nechceš pokračovať ${scope}` : `nechceš pokračovat ${scope}` : '',
    };
  }
  const endingMatch = latest.match(/\b(?:chci|chcem)\s+(?:to\s+)?(?:skončit|skoncit|ukončit|ukoncit)\s+((?:s|se|so|v|ve|vo|na)\s+[^.!?,;]+)/iu);
  if (endingMatch) {
    const scope = trimConversationContinuation(endingMatch[1]);
    return {
      scope,
      statement: scope ? language === 'sk' ? `chceš skončiť ${scope}` : `chceš skončit ${scope}` : '',
    };
  }
  const finiteEndingMatch = latest.match(/\b(?:končím|koncim|skončím|skoncim|ukončuji|ukoncuji|ukončujem|ukoncujem)\s+((?:s|se|so|v|ve|vo|na)\s+[^.!?,;]+)/iu);
  if (finiteEndingMatch) {
    const scope = normalizeExternalStopScope(trimConversationContinuation(finiteEndingMatch[1]));
    return {
      scope,
      statement: scope ? language === 'sk' ? `chceš skončiť ${scope}` : `chceš skončit ${scope}` : '',
    };
  }
  const invertedEndingMatch = latest.match(/\b((?:s|se|so|v|ve|vo|na)\s+[^.!?,;]{1,120}?)\s+(?:končím|koncim|skončím|skoncim|už\s+(?:dál\s+)?nepokračuji|uz\s+(?:(?:dal|dalej)\s+)?nepokracujem)\b/iu);
  if (invertedEndingMatch) {
    const scope = normalizeExternalStopScope(trimConversationContinuation(invertedEndingMatch[1]));
    return {
      scope,
      statement: scope ? language === 'sk' ? `chceš skončiť ${scope}` : `chceš skončit ${scope}` : '',
    };
  }
  const stopsDoingMatch = latest.match(/\b(?:nechci|nechcem|nebudu|nebudem)\s+(?:už\s+|uz\s+|dál\s+|dal\s+|ďalej\s+|dalej\s+)*(?:dělat|delat|robiť|robit|pořádat|poradat|organizovať|organizovat|vést|vest|viesť|viest|rozvíjet|rozvijet|rozvíjať|rozvijat)\s+([^.!?,;]{1,120})/iu);
  if (stopsDoingMatch) {
    const activity = trimConversationContinuation(stopsDoingMatch[1]);
    return {
      scope: activity,
      statement: activity ? language === 'sk' ? `nechceš ďalej robiť ${activity}` : `nechceš dál dělat ${activity}` : '',
    };
  }
  const invertedStopsDoingMatch = latest.match(/(?:^|[.!?;]\s*)([^.!?,;]{1,120}?)\s+(?:už\s+|uz\s+|dál\s+|dal\s+|ďalej\s+|dalej\s+)*(?:dělat|delat|robiť|robit|pořádat|poradat|organizovať|organizovat|vést|vest|viesť|viest|rozvíjet|rozvijet|rozvíjať|rozvijat)\s+(?:už\s+|uz\s+|dál\s+|dal\s+|ďalej\s+|dalej\s+)*(?:nechci|nechcem|nebudu|nebudem)\b/iu);
  if (invertedStopsDoingMatch) {
    const activity = normalizeExternalStopScope(trimConversationContinuation(invertedStopsDoingMatch[1]));
    return {
      scope: activity,
      statement: activity ? language === 'sk' ? `nechceš ďalej robiť ${activity}` : `nechceš dál dělat ${activity}` : '',
    };
  }
  return { scope: '', statement: '' };
}

function normalizeExternalStopScope(value) {
  const scope = String(value || '').trim();
  return scope ? `${scope.charAt(0).toLocaleLowerCase('cs-CZ')}${scope.slice(1)}` : '';
}

function isUsableRepairGrounding(value) {
  const clean = String(value || '').replace(/\s+/gu, ' ').trim();
  if (!clean || isConversationRepairRequest(clean)) return false;
  const normalized = normalizeDialogueText(clean).replace(/[.!?,;:]+$/gu, '').trim();
  return !/^(?:ano|jo|jasne|dobre|ok|souhlasim|suhlasim|muzeme|mozeme|zkusme|skusme|nevim|neviem|netusim|asi|mozna|mozno)$/u.test(normalized);
}

function isFactRecapStatement(value) {
  const clean = String(value || '').replace(/\s+/gu, ' ').trim();
  if (!isUsableRepairGrounding(clean) || clean.length < 10 || /\?/u.test(clean)) return false;
  const normalized = normalizeDialogueText(clean);
  return !/^(?:porad|rekni|vysvetli|pomoz|navrhni|zeptej|poloz)\w*\b/u.test(normalized);
}

function extractLatestFactRecapStatements(value) {
  const original = String(value || '').trim();
  const normalized = normalizeDialogueText(original);
  const recapCues = [
    /\b(?:tak\s+)?co\s+(?:tedy\s+|tak\s+)?(?:opravdu\s+|skutecne\s+)?(?:vime|vim)\b/u,
    /\b(?:shrn|vypis)\w*\b[^.!?\n]{0,35}\b(?:jen\s+)?fakta\b/u,
    /\b(?:drz\s+se|rekni|shrn|vypis)\w*\b[^.!?\n]{0,55}\b(?:jen|pouze)\s+(?:toho,?\s+)?(?:co\s+(?:opravdu\s+)?vime|faktu|overenych\s+skutecnosti)\b/u,
  ];
  const cueIndexes = recapCues
    .map(pattern => normalized.search(pattern))
    .filter(index => index >= 0);
  const factualPrefix = cueIndexes.length
    ? original.slice(0, Math.min(...cueIndexes)).replace(/[\s,;:—-]+$/u, '').trim()
    : original;

  return factualPrefix
    .split(/(?<=[.!?;])\s+|\n+/u)
    .map(part => part
      .replace(/^(?:oprava|upřesnění|upresneni|správně|spravne|ve skutečnosti|ve skutecnosti)\s*[:—-]?\s*/iu, '')
      .replace(/^ne\s*[,;:]\s*/iu, '')
      .trim())
    .filter(part => part && !requestsFactsOnly(part) && isFactRecapStatement(part))
    .slice(-3);
}

function trimConversationContinuation(value) {
  return String(value || '')
    .replace(/\s+(?:ale\s+)?(?:v\s+(?:tomhle|tomto|našem|nasem)\s+rozhovoru|s\s+tebou|tady|tu|v\s+tomto\s+rozhovore)\b.*$/iu, '')
    .replace(/\s+(?:ne|nie|nikoli)\s+(?:s\s+tebou|s\s+(?:tímto|timto|tomhle)\s+rozhovorem|v\s+tomto\s+rozhovore)\b.*$/iu, '')
    .trim();
}

export function formatConversationRepairContext(context = null) {
  if (!context?.active) {
    return 'Členka v tomto tahu neopravuje porozumění ani nevyjadřuje nejasný záměr něco ukončit.';
  }
  return [
    languageInstruction(context.responseLanguage),
    `Typ opravy: ${context.kind}`,
    `Poslední zpráva členky: ${JSON.stringify(context.latestText || '')}`,
    `Předchozí odpověď Elitey: ${JSON.stringify(context.previousAssistantText || '')}`,
    `Doslovná předchozí sdělení členky: ${JSON.stringify(context.priorUserStatements || [])}`,
    'TENTO TAH JE OPRAVA SPOLEČNÉHO POROZUMĚNÍ. Neprováděj ani nevyhodnocuj koučovací techniku a nezačínej sezení znovu.',
    'Krátce uznej konkrétní chybu nebo nejasnost. Potom odpověz na skutečný význam poslední zprávy a použij jen údaje obsažené v doslovných sděleních výše.',
    'Neodvozuj počty, osoby, výsledky, pocity, příčiny ani záměr z tématu samotného. Co v přepisu není, označ za neznámé nebo se na to neptej, pokud to pro opravu není nezbytné.',
    context.kind === 'rephrase'
      ? 'Členka žádá jednodušší vysvětlení. Zachovej význam předchozí otázky nebo rady, přeformuluj ji běžnou češtinou a nepokládej místo ní jinou diagnostickou otázku.'
      : '',
    context.kind === 'clarify_stop'
      ? 'Nehádej, co chce ukončit. Jednou krátkou otázkou rozliš rozhovor, právě použitý postup a věc, o které mluví; konkrétní činnost pojmenuj pouze tehdy, pokud ji členka sama uvedla.'
      : '',
    context.kind === 'external_stop'
      ? 'Členka jasně pojmenovala činnost nebo způsob, ve kterém nechce pokračovat. Respektuj to bez dalšího ověřování, nezaměňuj to za konec rozhovoru a navazuj otázkou, co chce řešit místo toho nebo jaké další rozhodnutí potřebuje udělat.'
      : '',
    context.kind === 'repair'
      ? 'Pokud opravuje téma nebo fakt, zopakuj pouze opravený význam, neobhajuj se a plynule na něj navaž. Neopakuj otázku, proti které se vymezila.'
      : '',
    context.kind === 'fact_recap'
      ? 'Členka chce pouze rekapitulaci známých údajů bez domýšlení. Uveď nejvýše tři její doslovná věcná sdělení, nepřidávej emoci, příčinu ani závěr a řekni, že pro další hodnocení zatím chybí data. Otázku nepřidávej.'
      : '',
    context.kind === 'short_question'
      ? 'Členka chce jedinou krátkou otázku. Polož přesně jednu konkrétní otázku ukotvenou v jejím posledním věcném sdělení, bez vysvětlování a dalšího úkolu.'
      : '',
  ].filter(Boolean).join('\n');
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
    activeRole: expertRoleForMode(responseMode),
    roleTransition: null,
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
  const value = String(text || '');
  const normalized = normalizeForDetection(value);
  if (/meditac[^.!?\n]{0,60}(?:zhors|spoust|trauma|disoci|nejsem ve svem tele)|(?:trauma|disoci)[^.!?\n]{0,60}meditac/u.test(normalized)) return 'podporna_stabilizace';
  if (/meditac|veden[a-z]* relaxace|mindfulness/u.test(normalized)) return 'vedena_meditace';
  if (/panik|flashback|uklidni|zklidni|rozklepan|nemuzu se uklidnit/u.test(normalized)) return 'podporna_stabilizace';
  if (/(?:potrebuji|chci|pomoz|nezvladam|zastavit)[^.!?\n]{0,90}(?:fungovat|zvladat|den|prac\w*|podnik\w*|kapacit\w*|pretez\w*)[^.!?\n]{0,70}(?:depres|vyhor|uzkost|trauma|nemoc)|(?:depres|vyhor|uzkost|trauma|nemoc)[^.!?\n]{0,90}(?:potrebuji|chci|pomoz|nezvladam|zastavit)[^.!?\n]{0,90}(?:fungovat|zvladat|den|prac\w*|podnik\w*|kapacit\w*|pretez\w*)/u.test(normalized)) return 'podpora_fungovani';

  const businessSignal = /\b(byznys|podnik\w*|projekt\w*|produkt\w*|napad\w*|sluzb\w*|nabidk\w*|prodej\w*|prodat\w*|cen\w*|cenotvor\w*|zakazn\w*|klient\w*|marketing\w*|brand\w*|znack\w*|obsah\w*|content\w*|prispevk\w*|reels?\b|stories\b|socialn\w*|instagram\w*|facebook\w*|tiktok\w*|linkedin\w*|reklam\w*|kampan\w*|valid\w*|pruzkum trhu|product.?market|spust\w*|publik\w*|zverejn\w*|konverz\w*|funnel\w*|newsletter\w*|web\w*|eshop\w*|invest\w*|uspor\w*)\b/u.test(normalized);
  const coachingSignal = /\b(styd\w*|bojim\w*|strach\w*|obav\w*|nejsem dost|neverim\w*|neschopn\w*|k nicemu|marn\w*|sebevedom\w*|sebehodnot\w*|hranice\w*|rict ne|odmitnout|vztah\w*|partner\w*|rodin\w*|zlobi?m se na sebe|vycitam si|odklad\w*|prokrast\w*|nemuzu zacit|nedokazu se dokopat|motivac\w*|navyk\w*|vnitrni blok|co me blokuje|proc to nedokazu)\b/u.test(normalized);
  const asksForInnerWork = /\b(pomoz mi (?:prekonat|pochopit|zjistit)|proc se|co me blokuje|jak prestat se bat|jak si verit|jak rict ne|nedokazu se k tomu odhodlat|vim co mam udelat,? ale|(?:plan|postup|strategii) (?:mam|znam|chapu),? ale|nedokazu[^.!?]{0,45}(?:zverejnit|oslovit|prodat|rict cenu)|ved me tim|neodkazuj)\b/u.test(normalized);
  const asksForExpertOutput = /\b(navrhni|napis|vytvor|priprav|spocitej|zkontroluj|porad mi (?:cenu|strategii|postup)|jak (?:nacenit|prodat|spustit|ziskat|nastavit)|co mam (?:napsat|zverejnit|nabidnout|prodavat)|jakou cenu|konkretni plan)\b/u.test(normalized);

  if (coachingSignal && (asksForInnerWork || !businessSignal)) return 'koucovaci_podpora';
  if (businessSignal && (asksForExpertOutput || !coachingSignal)) return 'mentoring';
  // U smíšeného vstupu nejdřív řešíme věcný byznysový problém. Koučka jej
  // převezme teprve tehdy, když členka výslovně žádá práci s vnitřní brzdou
  // nebo už ví, co udělat, ale strach či stud zastavuje provedení.
  if (coachingSignal && businessSignal) return asksForInnerWork ? 'koucovaci_podpora' : 'mentoring';
  if (/(?:potrebuji|chci|musim)[^.!?\n]{0,50}hned|hned[^.!?\n]{0,30}(?:porad|rekni|pomoz)|rychl[e]\s+(?:reseni|radu|odpoved)|spech/u.test(normalized)) return 'rychle_reseni';
  if (/co mam udelat|jak mam|porad/u.test(normalized)) return 'mentoring';
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

export function resolveConversationMode(text, consultationMode = 'auto', techniqueSession = null, {
  previousMode = null,
  conversationText = '',
} = {}) {
  const inferred = inferMode(text, consultationMode);
  if (consultationMode !== 'auto') return inferred;
  const normalizedConversation = normalizeForDetection(conversationText);
  const normalizedLatest = normalizeForDetection(text);
  const comparisonWork = /\b(?:konkurent|srovnav|porovnav|bezvyznam)\w*\b|\bprofil\w*\b[^.!?\n]{0,80}\b(?:kontrol|otevir)\w*\b/u.test(normalizedConversation);
  const explicitExpertOutput = /\b(?:navrhni|napis|vytvor|priprav|spocitej|zkontroluj|porad\s+mi|jak\s+(?:nacenit|prodat|spustit|ziskat|nastavit)|co\s+mam\s+(?:napsat|zverejnit|nabidnout|prodavat)|konkretni\s+plan)\b/u.test(normalizedLatest);
  if (comparisonWork && !explicitExpertOutput) {
    return previousMode && expertRoleForMode(previousMode) === 'coach'
      ? previousMode
      : 'koucovaci_podpora';
  }
  const activeSession = techniqueSession
    && ['assessment', 'consent', 'application', 'evaluation', 'integration'].includes(techniqueSession.phase)
    && typeof techniqueSession.techniqueId === 'string'
    && techniqueSession.techniqueId.trim();
  if (activeSession && CONTINUOUS_SESSION_MODES.has(techniqueSession.mode)) {
    const roleChanged = inferred !== 'diagnostika'
      && expertRoleForMode(inferred) !== expertRoleForMode(techniqueSession.mode);
    if (!roleChanged) return techniqueSession.mode;
  }
  if (inferred === 'diagnostika' && CONTINUOUS_SESSION_MODES.has(previousMode)) return previousMode;
  return inferred;
}

const COACH_RESPONSE_MODES = new Set([
  'diagnostika',
  'koucovaci_podpora',
  'koucovaci_hodina',
  'nlp_konzultace',
  'behavioralni_konzultace',
  'somaticka_konzultace',
  'podpora_fungovani',
  'podporna_stabilizace',
  'vedena_meditace',
]);

export function expertRoleForMode(mode) {
  if (mode === 'brand_growth_agent') return 'brand';
  if (['mentoring', 'mentoringova_konzultace', 'rychle_reseni'].includes(mode)) return 'mentor';
  return COACH_RESPONSE_MODES.has(mode) ? 'coach' : 'coach';
}

function previousAssistantResponseMode(messages = []) {
  const value = [...(Array.isArray(messages) ? messages : [])]
    .reverse()
    .find(message => message?.role === 'assistant' && typeof message.responseMode === 'string')?.responseMode;
  return CONTINUOUS_SESSION_MODES.has(value) || value === 'rychle_reseni' || value === 'brand_growth_agent'
    ? value
    : null;
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
    .replace(/^(?:Díky|Děkuji),?\s+(?:za sdílení|za otevřenost|že ses podělila)[.!]\s*/iu, '')
    .replace(/^(?:Skvělé|Výborné|Perfektní)(?:\s+\p{L}+){0,3}\s*[—-]\s*/iu, '')
    .replace(/^\s{0,3}(?:#{1,6}\s*)?(?:\*\*)?(?:Hlavní závěr|Proč|Krátké kontrolní otázky|Doporučený postup|Riziko(?:\s*\/\s*nejistota)?|Další krok)(?:\*\*)?\s*:\s*/gimu, '')
    .replace(/^\s*(?:[-•*]|\d+[.)])\s+/gmu, '')
    .replace(/\*\*(.*?)\*\*/gsu, '$1')
    .replace(/\*([^*\n]+)\*/gu, '$1')
    .replace(/`([^`\n]+)`/gu, '$1')
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

  if (!output.includes('?') && requireQuestion) {
    output = `${output}\n\n${fallbackQuestion}`.trim();
  }
  return output;
}

function isClosingRequest(text) {
  return /\b(uzavř|uzavr|ukonč|ukonc|shrň|shrn|rekapitul|konec konzultace|konzultaci uzavřít|konzultaci uzavrit)\b/i.test(String(text || ''));
}
