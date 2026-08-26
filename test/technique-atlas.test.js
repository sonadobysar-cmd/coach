import assert from 'node:assert/strict';
import { test } from 'node:test';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatTechniqueCards,
  loadTechniqueAtlas,
  selectTechniqueCards,
} from '../src/technique-atlas.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const atlas = await loadTechniqueAtlas(join(ROOT, 'data', 'master-technique-atlas.json'));

test('Master Technique Atlas je rozsáhlý, unikátní a každá karta má bezpečnostní hranice', () => {
  assert.ok(atlas.length >= 80);
  assert.equal(new Set(atlas.map(card => card.id)).size, atlas.length);
  for (const card of atlas) {
    assert.ok(card.avoid.length > 0, `${card.id} nemá avoid`);
    assert.ok(card.never_claim.length > 0, `${card.id} nemá never_claim`);
    assert.ok(['ai_coaching', 'support_only', 'human_only'].includes(card.access_level));
  }
});

test('běžné slovo „jsem“ samo nevybere nesouvisející produktivní techniku', () => {
  const selected = selectTechniqueCards(atlas, 'Jsem neschopná.', 'koucovaci_podpora', 'normal');
  assert.equal(selected[0]?.id, 'accurate_self_talk_edit');
  assert.ok(!selected.some(card => card.id === 'ten_minute_momentum_check'));
});

test('validace produktu volí zákaznický výzkum místo obecné motivační techniky', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Potřebuji validovat aplikaci před spuštěním. Třeba 4–5 h denně.',
    'mentoring',
    'normal',
  );
  assert.equal(selected[0]?.id, 'customer_discovery');
  assert.ok(!selected.some(card => card.id === 'mi_change_talk'));
  assert.ok(selected[0].steps.length >= 4);
  assert.match(selected[0].avoid.join(' '), /publiku|kontakt|rozpoč/i);
});

test('klinické human-only techniky router nikdy neposkytne modelu', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Chci zpracovat trauma přes EMDR, expozici a regresní hypnózu.',
    'podporna_stabilizace',
    'heightened',
  );
  assert.ok(selected.length > 0);
  assert.ok(selected.every(card => card.access_level !== 'human_only'));
  assert.ok(selected.some(card => card.id === 'external_grounding'));
  assert.ok(!selected.some(card => ['emdr', 'prolonged_exposure', 'regression_hypnosis'].includes(card.id)));
});

test('akupresurní a myofasciální léčebné návody zůstávají human-only', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Chci tlakový bod na astma a deep tissue masáž krku podle chatu.',
    'somaticka_konzultace',
    'heightened',
  );
  assert.ok(selected.every(card => !['acupressure_treatment', 'myofascial_manual_treatment'].includes(card.id)));
  assert.equal(atlas.find(card => card.id === 'acupressure_treatment').access_level, 'human_only');
  assert.equal(atlas.find(card => card.id === 'myofascial_manual_treatment').access_level, 'human_only');
});

test('úzkost volí stabilizaci, nikoli byznysový framework', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Mám úzkost, jsem rozklepaná a potřebuji se zklidnit.',
    'podporna_stabilizace',
    'heightened',
  );
  assert.equal(selected[0].id, 'external_grounding');
  assert.ok(selected.every(card => !card.family.startsWith('business_')));
});

test('cenotvorba volí ekonomiku zakázky a nenabízí wellbeing techniku', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Jak mám nastavit cenu služby, aby pokryla náklady a měla zdravou marži a zisk?',
    'mentoring',
    'normal',
  );
  assert.equal(selected[0].id, 'unit_economics');
  assert.ok(selected.every(card => !['mindfulness', 'trauma_informed_support'].includes(card.family)));
});

test('free trial v byznys mentoringu volí etický subscription protokol a nikdy nesouvisející NLP', () => {
  const selected = selectTechniqueCards(
    atlas,
    'U členství chci sedmidenní free trial, kartu předem, automatické obnovení a co nejméně rušení.',
    'mentoringova_konzultace',
    'normal',
  );
  assert.equal(selected[0]?.id, 'ethical_free_trial_design');
  assert.ok(selected.every(card => card.family !== 'nlp_inspired'));
  assert.match(selected[0].avoid.join(' '), /zrušení|dark patterns/i);
});

test('kritický stav nedostane žádnou koučovací techniku', () => {
  assert.deepEqual(
    selectTechniqueCards(atlas, 'Chci si ublížit.', 'podporna_stabilizace', 'critical'),
    [],
  );
});

test('formát karty modelu obsahuje použití, hranice a zakázaná tvrzení', () => {
  const text = formatTechniqueCards([atlas.find(card => card.id === 'mi_oars')]);
  assert.match(text, /Vhodné když/);
  assert.match(text, /Nepoužít \/ zastavit/);
  assert.match(text, /Nikdy neslibovat/);
});

test('Meta Ads diagnostika volí metriku a ne wellness techniku', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Meta Ads reklama nefunguje, CTR a CPL jsou slabé a leady se nezavírají.',
    'mentoring',
    'normal',
  );
  assert.equal(selected[0].id, 'meta_metrics_diagnostic');
  assert.ok(selected.every(card => !['mindfulness', 'trauma_informed_support'].includes(card.family)));
});

test('somatická konzultace nabídne orientaci s možností skončit', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Jsem zahlcená a chci krátkou somatickou orientaci, abych se mohla vrátit k práci.',
    'somaticka_konzultace',
    'heightened',
  );
  assert.ok(selected.some(card => card.id === 'somatic_orient_choice'));
  assert.ok(selected.every(card => ['trauma_informed_support', 'mindfulness', 'relaxation', 'emotion_skills'].includes(card.family)));
});

test('somatický režim zná čtyřfázové zastavení bez léčebných tvrzení', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Chci krátkou somatickou konzultaci pro napětí v těle',
    'somaticka_konzultace',
    'normal',
  );
  assert.ok(selected.some(card => card.id === 'somatic_four_phase_checkin'));
  const protocol = atlas.find(card => card.id === 'somatic_four_phase_checkin');
  assert.equal(protocol.access_level, 'support_only');
  assert.ok(protocol.never_claim.includes('zpracování traumatu'));
});

test('somatická praxe nejprve nabídne informovanou volbu a možnost skončit', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Chci somatické cvičení, ale nechci zavřít oči a chci mít možnost skončit.',
    'somaticka_konzultace',
    'heightened',
  );
  assert.equal(selected[0].id, 'somatic_permission_gate');
  assert.match(selected[0].core_move, /dialog|oči otevřené/);
});

test('tělesný vjem se popisuje neutrálně bez hledání skrytého významu', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Cítím tlak na hrudi a chci jen popsat tělesný vjem bez hledání významu.',
    'somaticka_konzultace',
    'normal',
  );
  assert.equal(selected[0].id, 'neutral_sensation_description');
  assert.ok(selected[0].never_claim.some(claim => claim.includes('kořen problému')));
});

test('myšlenková spirála nejprve projde branou užitečnosti', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Přemýšlím pořád dokola a nevím, jestli mi ta myšlenka pomáhá, nebo je to spirála.',
    'koucovaci_podpora',
    'normal',
  );
  assert.equal(selected[0].id, 'thought_usefulness_gate');
});

test('stud dostane validaci bez tvrzení, že pod ním musí být hlubší emoce', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Strašně se stydím, že jsem selhala, a obviňuji se.',
    'koucovaci_podpora',
    'normal',
  );
  assert.equal(selected[0].id, 'shame_validation_choice');
  assert.ok(selected[0].never_claim.some(claim => claim.includes('vždy konkrétní emoce')));
});

test('hluboká změna volí vlastní sedmifázovou metodu ELITEA Compass', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Motám se v kruhu a chci zásadní změnu, ale nevím kudy dál.',
    'koucovaci_hodina',
    'normal',
  );
  assert.equal(selected[0].id, 'elitea_compass');
  assert.equal(selected[0].steps.length, 7);
  assert.deepEqual(selected[0].step_kinds, [
    'elicitation', 'elicitation', 'elicitation', 'elicitation', 'elicitation', 'intervention', 'elicitation',
  ]);
  assert.ok(selected[0].never_claim.some(claim => claim.includes('zaručí transformaci')));
});

test('mapa reality oddělí fakta, výklady a neznámé', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Potřebuji oddělit fakta a domněnky a zjistit, co skutečně vím.',
    'koucovaci_hodina',
    'normal',
  );
  assert.equal(selected[0].id, 'elitea_evidence_map');
  assert.match(selected[0].core_move, /pozorovatelná fakta.*význam.*neznámé.*ověření/);
});

test('sken kapacity hledá podmínky před zvyšováním tlaku', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Pořád to nedělám a nevím, co mi brání. Možná mi chybí kapacita a energie.',
    'behavioralni_konzultace',
    'normal',
  );
  assert.equal(selected[0].id, 'elitea_capacity_friction_scan');
  assert.match(selected[0].core_move, /schopnost.*podmínky.*motivaci.*kapacitu/);
  assert.ok(selected[0].avoid.some(item => item.includes('přetížení')));
});

test('experimentální smyčka obsahuje situaci, když–tak plán a vyhodnocení', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Chci tu změnu otestovat malým experimentem, dát si když–tak plán a potom pokus vyhodnotit.',
    'behavioralni_konzultace',
    'normal',
  );
  assert.equal(selected[0].id, 'elitea_experiment_loop');
  assert.match(selected[0].core_move, /když–tak.*signál.*uprav/);
  assert.ok(selected[0].never_claim.some(claim => claim.includes('univerzální pravdu')));
});

test('při sebeobviňování oddělí vliv od viny', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Možná je všechno moje vina a jen si to celé projektuji',
    'koucovaci_podpora',
    'normal',
  );
  assert.ok(selected.some(card => card.id === 'agency_without_self_blame'));
});

test('neklid při meditaci volí přizpůsobení místo nucené nehybnosti', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Meditace mi nejde, nevydržím sedět a klid mě znervózňuje',
    'vedena_meditace',
    'heightened',
  );
  assert.ok(selected.some(card => card.id === 'stillness_readiness'));
});

test('osobní podpůrný plán vychází z praktik, které členka skutečně vyzkoušela', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Chci vlastní plán a rutinu pro stres podle toho, co mi pomáhá',
    'koucovaci_podpora',
    'normal',
  );
  assert.ok(selected.some(card => card.id === 'personal_regulation_recipe'));
});

test('prokrastinaci nejprve rozliší podle zdroje tření', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Pořád prokrastinuju, odkládám nabídku a nemůžu začít.',
    'behavioralni_konzultace',
    'normal',
  );
  assert.equal(selected[0].id, 'procrastination_friction_map');
});

test('návykový vzorec používá Nii model náhradní smyčky bez garantované léčby', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Automaticky scrolluju a kontroluju e-mail pokaždé, když mám začít pracovat. Chci ten zlozvyk nahradit.',
    'behavioralni_konzultace',
    'normal',
  );
  assert.equal(selected[0].id, 'low_risk_habit_loop_replacement');
  const card = atlas.find(item => item.id === 'low_risk_habit_loop_replacement');
  assert.match(card.core_move, /starého neurálního programu/i);
  assert.ok(card.never_claim.some(item => item.includes('garantovaná léčba závislosti')));
});

test('tvrdou vnitřní řeč převádí do Nii modelu pozitivního přeprogramování', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Můj vnitřní hlas říká, že vždycky selžu a nic nedokážu.',
    'behavioralni_konzultace',
    'normal',
  );
  assert.ok(selected.some(card => card.id === 'accurate_self_talk_edit'));
  const card = atlas.find(item => item.id === 'accurate_self_talk_edit');
  assert.match(card.core_move, /programuje a posiluje neurální i psychické vzorce/i);
  assert.ok(card.never_claim.some(item => item.includes('garantovaná léčba')));
});

test('výslovný požadavek na self-talk a přeprogramování volí specializovanou kartu jako první', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Pořád si opakuji, že selžu. Chci změnit svůj self-talk a přeprogramovat ten vzorec.',
    'behavioralni_konzultace',
    'normal',
  );
  assert.equal(selected[0].id, 'accurate_self_talk_edit');
});

test('rozptýlenou práci převádí do krátkého bloku jediné priority', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Nesoustředím se, pořád koukám na telefon a dělám multitasking.',
    'mentoring',
    'normal',
  );
  assert.equal(selected[0].id, 'single_task_focus_block');
});

test('plán dalšího dne používá večerní přípravu a ranní prioritu z metodiky Nii', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Večer chci naplánovat zítřek, protože ráno mám chaos a nevím, jaké jsou priority dne.',
    'mentoring',
    'normal',
  );
  assert.equal(selected[0].id, 'next_day_priority_plan');
  assert.match(selected[0].core_move, /podvědomí/i);
  assert.match(selected[0].core_move, /ráno/i);
});

test('batching se nejprve testuje podle času, kvality a energie', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Chci natočit více videí dopředu a dávkovat podobné úkoly, abych omezila přepínání kontextu.',
    'mentoring',
    'normal',
  );
  assert.equal(selected[0].id, 'similar_task_batching_test');
  assert.match(selected[0].core_move, /čas, kvalitu a energii/);
});

test('vágní plán cíle převádí do propojené kaskády s Nii přesvědčením o cílech', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Mám cíl, ale nevím, jak dosáhnout cíle a propojit dílčí cíle, strategii, priority a aktivity.',
    'mentoring',
    'normal',
  );
  assert.equal(selected[0].id, 'goal_strategy_cascade');
  assert.match(selected[0].core_move, /zdola nahoru/);
  assert.match(selected[0].core_move, /zvyšuje soustředění a urychluje postup/i);
  assert.ok(selected[0].never_claim.some(item => item.includes('stoprocentní')));
});

test('studium kurzu používá aktivní vybavení místo kopírování', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Dělám si poznámky z kurzu, ale nic si nezapamatuji.',
    'mentoring',
    'normal',
  );
  assert.ok(selected.some(card => card.id === 'active_recall_capture'));
  const card = atlas.find(item => item.id === 'active_recall_capture');
  assert.match(card.core_move, /vlastními slovy/);
  assert.match(card.core_move, /pohyby očí/i);
  assert.ok(card.never_claim.some(item => item.includes('garantovaná fotografická paměť')));
});

test('Elitea má obnovenou neklinickou práci s emočním nábojem vzpomínky', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Nemůžu pustit nepříjemnou vzpomínku a chci změnit její význam.',
    'koucovaci_podpora',
    'normal',
  );
  assert.ok(selected.some(card => card.id === 'nia_memory_release_practice'));
  const card = atlas.find(item => item.id === 'nia_memory_release_practice');
  assert.match(card.core_move, /změnit její význam/i);
  assert.ok(card.never_claim.some(item => item.includes('garantované vymazání')));
});

test('Elitea nabízí brain-builder menu koncentrace podle Nii', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Chci cvičení koncentrace a brain builder pro lepší soustředění.',
    'behavioralni_konzultace',
    'normal',
  );
  assert.ok(selected.some(card => card.id === 'nia_concentration_training_menu'));
  const card = atlas.find(item => item.id === 'nia_concentration_training_menu');
  assert.match(card.core_move, /mentální výpočty/i);
  assert.match(card.core_move, /vizualizaci/i);
});

test('lekce 48 volí sedm strategií udržení fokusu', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Ztrácím pozornost a potřebuji udržet fokus při práci.',
    'mentoring',
    'normal',
  );
  assert.equal(selected[0].id, 'focus_maintenance_seven_strategies');
  assert.match(selected[0].core_move, /myšlenkovou mapu/i);
});

test('lekce 49 volí praktické páky motivace k učení', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Nemám motivaci se učit a pořád čekám na správnou náladu.',
    'koucovaci_podpora',
    'normal',
  );
  assert.equal(selected[0].id, 'learning_motivation_boost');
  assert.match(selected[0].core_move, /začít nejmenším krokem/i);
});

test('lekce 50 volí aktivní porozumění textu', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Čtu a nic si nepamatuji, potřebuji zlepšit porozumění textu.',
    'mentoring',
    'normal',
  );
  assert.equal(selected[0].id, 'reading_comprehension_five_moves');
  assert.match(selected[0].core_move, /hlavní tvrzení, důkazy a závěr/i);
});

test('lekce 52 volí paměťový palác s pevnou trasou', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Chci si přes memory palace zapamatovat seznam bodů prezentace.',
    'mentoring',
    'normal',
  );
  assert.equal(selected[0].id, 'memory_palace_route');
  assert.match(selected[0].core_move, /pevnou trasu/i);
});

test('lekce 2 převádí změnu návyku do pětikrokového procesu', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Chci změnit návyk a přeprogramovat vzorec přes konkrétní proces změny.',
    'behavioralni_konzultace',
    'normal',
  );
  assert.equal(selected[0].id, 'neuroplasticity_change_process');
  assert.match(selected[0].core_move, /připoj k již stabilnímu návyku/i);
});

test('lekce 4 navrhne osobní brain builder podle sedmi kritérií', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Chci si vybrat brain builder a učit se něco nového pro mentální stimulaci.',
    'behavioralni_konzultace',
    'normal',
  );
  assert.equal(selected[0].id, 'brain_builder_activity_design');
  assert.match(selected[0].core_move, /novost, soustředění, přiměřenou obtížnost/i);
});

test('lekce 9 převádí mentální autopilot do vědomého průzkumu okolí', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Jedu na mentální autopilot a potřebuji si víc všímat okolí a získat nový pohled.',
    'koucovaci_podpora',
    'normal',
  );
  assert.equal(selected[0].id, 'awareness_novelty_scan');
  assert.match(selected[0].core_move, /nových detailů/i);
});

test('Meta lead generation volí cestu podle kvality a kapacity follow-upu', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Mám použít instant form, webový formulář, Messenger lead nebo WhatsApp lead?',
    'mentoring',
    'normal',
  );
  assert.equal(selected[0].id, 'meta_lead_route_selector');
});

test('škálování reklamy nejprve kontroluje ekonomiku a kapacitu', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Chci škálovat reklamu a zvýšit rozpočet, ale ROAS trochu klesl.',
    'mentoring',
    'normal',
  );
  assert.equal(selected[0].id, 'meta_scaling_readiness');
  assert.match(selected[0].core_move, /marži a cashflow/);
});

test('nesoulad výsledků platforem volí kontrolu atribuce', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Meta ukazuje prodeje, Google ukazuje prodeje a ROAS nesedí kvůli atribuci.',
    'mentoring',
    'normal',
  );
  assert.equal(selected[0].id, 'meta_attribution_lag_check');
});

test('sezónní kampaň nepřebírá univerzální procenta rozpočtu', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Potřebuji media plan pro Black Friday a sezónní kampaň.',
    'mentoring',
    'normal',
  );
  assert.equal(selected[0].id, 'meta_seasonal_media_plan');
  assert.ok(selected[0].never_claim.includes('univerzální rozdělení rozpočtu mezi funnel fáze'));
});

test('večerní volba postoje směruje k dennímu behaviorálnímu záměru', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Večer si chci zvolit postoj na zítřek a ráno si ho připomenout.',
    'coaching',
    'normal',
  );
  assert.equal(selected[0].id, 'daily_attitude_behavior_intention');
  assert.match(selected[0].core_move, /následující den/i);
});

test('negativní vnitřní řeč volí přesnou editaci self-talku', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Pořád si v hlavě opakuji, že to nedokážu. Chci změnit svůj self talk.',
    'coaching',
    'normal',
  );
  assert.equal(selected[0].id, 'accurate_self_talk_edit');
  assert.match(selected[0].origin_or_standard, /lekce 12–15/i);
});

test('krátký návrat k práci volí desetiminutový reset momenta', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Ztratila jsem momentum a potřebuji se rozjet aspoň na deset minut.',
    'mentoring',
    'normal',
  );
  assert.equal(selected[0].id, 'ten_minute_momentum_check');
});

test('vyčerpávající produktivita volí regeneraci se zpětnou vazbou', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Jsem vyčerpaná, potřebuji regeneraci a vyhodnotit, co mi opravdu přináší výsledky.',
    'mentoring',
    'normal',
  );
  assert.equal(selected[0].id, 'recovery_feedback_loop');
});

test('návrh zapamatovatelné prezentace volí pět paměťových signálů', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Jak udělat prezentaci zapamatovatelnou pomocí překvapení a silného začátku?',
    'mentoring',
    'normal',
  );
  assert.equal(selected[0].id, 'memory_signal_design');
});

test('praktické zlepšení paměti volí výběr ze čtrnácti nástrojů', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Chci zlepšit paměť, zkusit chunking, vybavovací podněty nebo doodling.',
    'koucovaci_podpora',
    'normal',
  );
  assert.equal(selected[0].id, 'memory_fourteen_tool_selector');
  assert.match(selected[0].never_claim.join(' '), /pohyb očí/i);
});

test('barevná slova volí Stroopův koncentrační trénink', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Chci si zkusit Stroopův hlavolam: pojmenovat barvu inkoustu místo přečtení slova.',
    'koucovaci_podpora',
    'normal',
  );
  assert.equal(selected[0].id, 'stroop_concentration_practice');
  assert.match(selected[0].never_claim.join(' '), /diagnostikuje/i);
});

test('nové NLP Practitioner postupy jsou krokové a směrují na konkrétní techniku', () => {
  const cases = [
    ['Chci projít Meta Mirror kvůli konfliktu s obchodní partnerkou.', 'nlp_meta_mirror'],
    ['Nevím, co se stane, když to udělám nebo neudělám. Chci Satir matici.', 'nlp_satir_decision_matrix'],
    ['Jsem zahlcená a nedokážu najít jádro problému ani ho shrnout.', 'nlp_lazarus_focus'],
    ['Potřebuji ujasnit hierarchii svých hodnot a priority.', 'nlp_values_hierarchy'],
    ['Chci pomocí submodalit zpřesnit obraz budoucího cíle.', 'nlp_submodality_goal'],
    ['Jak použít pacing a leading pro lepší komunikaci bez nátlaku?', 'nlp_pacing_leading'],
    ['Řekla jsem něco jiného, než klient slyšel, a vzniklo nedorozumění.', 'nlp_four_levels_communication'],
    ['Chci přes Johariho okno najít slepá místa ve vedení týmu.', 'nlp_johari_feedback'],
    ['Chci modelovat strategii úspěšné podnikatelky, ale ne ji slepě kopírovat.', 'nlp_modeling_strategy'],
    ['Chci future pacing a mentální zkoušku příští obchodní prezentace.', 'nlp_future_pacing'],
    ['Chci pojmenovat rozpor mezi tím, co v rozhovoru říkám, a tím, co dělám.', 'nlp_attending_immediacy'],
    ['Chci kartézské otázky a zjistit opportunity cost svého rozhodnutí.', 'nlp_cartesian_consequence_check'],
    ['Pořád říkám, že moje podnikání je klec. Chci prozkoumat tu metaforu.', 'nlp_metaphor_exploration'],
    ['Chci swish jako mentální nácvik nové reakce na spouštěč běžného návyku.', 'nlp_swish_habit_rehearsal'],
    ['Chci přes logical levels prověřit soulad cíle, hodnot a identity.', 'nlp_logical_levels_alignment'],
    ['Chci zmapovat NLP state: fyziologii, myšlenky, emoce a reakci.', 'nlp_state_map'],
  ];

  for (const [query, expectedId] of cases) {
    const selected = selectTechniqueCards(atlas, query, 'nlp_konzultace', 'normal');
    assert.equal(selected[0]?.id, expectedId, query);
    assert.ok(selected[0].steps.length >= 5, `${expectedId} nemá úplný krokový postup`);
    assert.equal(selected[0].steps.length, selected[0].step_kinds.length);
  }
});

test('NLP režim nikdy nezpřístupní klinickou human-only techniku', () => {
  const selected = selectTechniqueCards(
    atlas,
    'Chci přes regresní hypnózu, rychlou léčbu fobie a swish zpracovat trauma.',
    'nlp_konzultace',
    'normal',
  );
  assert.ok(selected.every(card => card.access_level !== 'human_only'));
  assert.ok(!selected.some(card => ['regression_hypnosis', 'nlp_swirk_phobia'].includes(card.id)));
  assert.ok(!selected.some(card => card.id === 'nlp_swish_habit_rehearsal'));
});
