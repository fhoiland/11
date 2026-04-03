# 11-ern

Poengregistrering for kortspillet 11-ern.

## Om appen

Appen er bygget med Astro og Tailwind CSS, men følger fortsatt samme enkle idé som originalen: én lett PWA uten backend, med lokal lagring og offline-støtte. Denne versjonen er synket med de siste endringene fra originalrepoet og beholder samtidig Astro-strukturen og Pages-oppsettet.

## Funksjonalitet

- Spilleroppsett for 2-8 spillere
- Runderegistrering med automatisk sortering etter totalpoeng
- Nivåsystem med 11 nivåer og progresjon per spiller
- Nivåoversikt sortert etter høyeste nivå
- Vinnerskjerm når en spiller fullfører alle nivåene
- Rundehistorikk med redigering og sletting
- Spillhistorikk med statistikk og klikkbare detaljvisninger
- Regler-modal med nivåer og poengberegning
- Innstillinger for lyst, mørkt eller auto-tema
- Fargevalg for appens aksentfarge
- Valgfri juksregistrering med konfigurerbare straffepoeng
- Endringslogg som vises etter oppdateringer
- PWA-støtte og lokal lagring via `localStorage`

## Teknologi

- Astro
- Tailwind CSS
- Vanlig klient-JavaScript for spillogikk
- Service worker for caching og raske oppdateringer

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

## Struktur

- `src/pages/index.astro` inneholder appskallet og modalene
- `src/scripts/app.js` inneholder spillogikken
- `src/styles/global.css` inneholder appstiler og temavarianter
- `public/manifest.json` og `public/sw.js` holder på PWA-oppsettet

## Versjonshistorikk

| Versjon | Endring |
|---------|---------|
| v3.1.0 | Synk med originalrepoet: regler-modal, innstillinger, fargevalg, juksregistrering, klikkbar spillhistorikk og automatisk service worker-oppdatering |
| v3.0.0 | Migrert til Astro og Tailwind CSS |
| v2.6.0 | Regelknapp som åpner komplett spillregler-modal |
| v2.5.0 | Fargefiks i mørk modus og changelog etter oppdatering |
| v2.4.0 | Innstillingsmodal med tema, fargevalg og juksregistrering |
| v2.3.0 | Klikkbare spilldetaljer i historikk og deaktivert dobbelttrykk-zoom |
| v2.2.0 | Redigering av tidligere runder og bekreftelse ved nytt spill |
| v2.1.0 | Historikk for siste spill og statistikkvisning |
