const CRISIS_PATTERNS = [
  /sebevra/i,
  /zabit se/i,
  /vezmu si zivot/i,
  /ukoncit (svuj )?zivot/i,
  /ublizit si/i,
  /ublizim si/i,
  /si (chci )?ublizit/i,
  /chci si neco udelat/i,
  /(?:nechci(?:\s+uz)?|uz\s+nechci)\s+zit/i,
  /nema (?:uz )?(?:zadny )?smysl zit/i,
  /radsi bych (?:tu )?nebyl[ae]?/i,
  /si neco udelam/i,
  /bezprostredni ohrozeni/i,
];

const DANGER_PATTERNS = [
  /vyhrozuje mi/i,
  /je za dvermi/i,
  /napadl me/i,
  /bojim se o zivot/i,
  /mam zbran/i,
];

const MEDICAL_EMERGENCY_PATTERNS = [
  /nemuzu dychat/i,
  /nemohu dychat/i,
  /bolest na hrudi/i,
  /omdlevam/i,
  /ochrnul/i,
  /tezka alergicka reakce/i,
];

export function classifySafety(text = '') {
  const normalized = normalize(text);
  const crisis = CRISIS_PATTERNS.some(pattern => pattern.test(normalized));
  const danger = DANGER_PATTERNS.some(pattern => pattern.test(normalized));
  const medical = MEDICAL_EMERGENCY_PATTERNS.some(pattern => pattern.test(normalized));
  return {
    level: crisis || danger || medical ? 'critical' : 'normal',
    crisis,
    danger,
    medical,
    heightened: false,
  };
}

export function crisisResponse({ danger = false, medical = false } = {}) {
  const immediate = medical
    ? 'Tyto příznaky mohou vyžadovat okamžité zdravotní posouzení. V Česku zavolej 155 nebo 112; mimo Česko místní tísňovou linku. Pokud můžeš, požádej někoho poblíž, aby s tebou zůstal.'
    : danger
      ? 'Pokud jsi právě v bezprostředním ohrožení v Česku, zavolej 112 nebo 158 a přesuň se na bezpečné místo, pokud to můžeš udělat bez dalšího rizika. Mimo Česko zavolej místní tísňovou linku.'
      : 'Pokud hrozí, že si ublížíš nebo jsi v bezprostředním nebezpečí, zavolej v Česku hned 112 nebo 155, tedy tísňovou nebo krizovou pomoc. Mimo Česko zavolej místní tísňovou nebo krizovou linku.';

  return [
    medical ? 'Tohle nechci zlehčit ani vydávat automaticky za úzkost.' : 'Mrzí mě, že je ti teď takhle těžko. Nemusíš na to zůstávat sama.',
    immediate,
    'Zkus teď také kontaktovat člověka, kterému důvěřuješ, a požádej ho, aby s tebou zůstal osobně nebo na telefonu.',
    'Jsem AI mentorka a nemohu nahradit okamžitou odbornou pomoc. Teď je nejdůležitější tvoje bezpečí — byznys počká.',
  ].join('\n\n');
}

function normalize(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
