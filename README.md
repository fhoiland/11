# 11-ern

Poengregistrering for kortspillet 11-ern.

## Om appen

Appen er bygget med Astro og Tailwind CSS, men er fortsatt en lett PWA uten backend. Denne versjonen holder seg synket med originalrepoet, samtidig som den har en tydeligere prosjektstruktur, bedre testbarhet og mer robuste lagrings- og oppdateringsrutiner.

## Funksjonalitet

- Spilleroppsett for 2-8 spillere
- Runderegistrering med automatisk sortering etter totalpoeng
- Raskere mobilregistrering med `-5` og `+5` per spiller
- Angre siste runde
- Nivåsystem med 11 nivåer og progresjon per spiller
- Nivåoversikt sortert etter høyeste nivå
- Bedre sluttskjerm med stilling, oppsummering og valg om å fortsette eller starte nytt
- Rundehistorikk med redigering og sletting
- Spillhistorikk med statistikk og klikkbare detaljvisninger
- Regler-modal med nivåer og poengberegning
- Innstillinger for lyst, mørkt eller auto-tema
- Fargevalg for appens aksentfarge
- Valgfri juksregistrering med konfigurerbare straffepoeng
- Eksport og import av backup som JSON
- Endringslogg som vises etter oppdateringer
- PWA-støtte og lokal lagring via `localStorage`

## Teknologi

- Astro
- Tailwind CSS
- Vanlig klient-JavaScript for UI
- Egen spillmotor i `src/lib/game-engine.js`
- Versjonert lagring og backupvalidering i `src/lib/storage.js`
- Node sin innebygde test-runner for logikk- og lagringstester
- Service worker med separat shell- og asset-cache

## Kom i gang

```bash
npm install
npm run dev
```

Bygg produksjonsversjonen med:

```bash
npm run build
```

For å teste bygget lokalt:

```bash
npm run preview
```

For å kjøre Astro sin prosjektvalidering:

```bash
npm run check
```

For å kjøre testene:

```bash
npm test
```

## Struktur

- `src/pages/index.astro` inneholder appskallet og modalene
- `src/scripts/app.js` kobler UI-en til spillmotor, lagring og modalflyt
- `src/lib/game-engine.js` inneholder ren spillogikk og oppsummering
- `src/lib/storage.js` håndterer versjonert lagring, backup og validering
- `src/styles/global.css` inneholder appstiler og temavarianter
- `tests/` inneholder logikk- og lagringstester
- `public/manifest.json` og `public/sw.js` holder på PWA-oppsettet

## Versjonshistorikk

| Versjon | Endring |
|---------|---------|
| v3.2.0 | Angre siste runde, eksport/import, bedre sluttskjerm, raskere mobilregistrering, modulbasert spillmotor, tester, versjonert lagring og mer robust service worker |
| v3.1.0 | Synk med originalrepoet: regler-modal, innstillinger, fargevalg, juksregistrering, klikkbar spillhistorikk og automatisk service worker-oppdatering |
| v3.0.0 | Migrert til Astro og Tailwind CSS |
| v2.6.0 | Regelknapp som åpner komplett spillregler-modal |
| v2.5.0 | Fargefiks i mørk modus og changelog etter oppdatering |
| v2.4.0 | Innstillingsmodal med tema, fargevalg og juksregistrering |
| v2.3.0 | Klikkbare spilldetaljer i historikk og deaktivert dobbelttrykk-zoom |
| v2.2.0 | Redigering av tidligere runder og bekreftelse ved nytt spill |
| v2.1.0 | Historikk for siste spill og statistikkvisning |
