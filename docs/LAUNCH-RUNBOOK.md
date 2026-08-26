# Elitea — produkční minimum a dohled

## Automatický dohled

- Kontrolní URL: `https://elitea.cz/api/health`
- Očekávaný stav: HTTP 200 a `"ok": true`.
- Kontrolovat každých 5 minut; upozornit po dvou po sobě jdoucích chybách.
- Endpoint nevrací klíče ani osobní data, pouze dostupnost AI, přihlášení, plateb a rezervačního e-mailu.

Externí uptime službu je potřeba propojit s účtem majitelky, aby upozornění chodila na správný e-mail nebo telefon. Samotný endpoint je součástí aplikace.

## Kontrola před každým nasazením

1. `npm test`
2. `npm run build`
3. Ověřit čistý `git diff --check`.
4. Lokálně zkontrolovat veřejný web, registraci/přihlášení, obnovu hesla, Academy a mobilní šířku.
5. Po nasazení ověřit `/api/health`, `/api/status`, ceny, právní stránky a to, že anonymní požadavek na detail kurzu vrátí 401/403.

## Incidenty

- AI nedostupná: zastavit placenou propagaci a ověřit Vercel AI Gateway/OIDC.
- Přihlášení nedostupné: ověřit Neon Auth a Data API; neobcházet autorizaci.
- Platby nedostupné: ověřit Stripe webhook a produkční price ID; nevytvářet členství ručně bez auditní stopy.
- Rezervační e-mail nedostupný: ověřit Resend doménu a odesílatele.
- Podezření na únik: nemazat logy, zneplatnit dotčené klíče, uložit časovou osu a kontaktovat poskytovatele.

