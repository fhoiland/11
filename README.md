# 11-ern

Registrering av poeng i kortspillet 11-ern.

## Om appen

Appen er nå migrert til Astro og Tailwind CSS. Den er fortsatt en lett PWA uten backend, men har fått en ryddigere prosjektstruktur med `src/` for UI og klientlogikk, og `public/` for manifest og service worker.

## Funksjonalitet

- Spilleroppsett for 2–8 spillere
- Runderegistrering med automatisk sortering etter totalpoeng
- Nivåsystem med 11 nivåer og progresjon per spiller
- Nivåoversikt sortert etter høyeste nivå
- Vinnerskjerm når en spiller fullfører alle nivåene
- Rundehistorikk med redigering og sletting
- Spillhistorikk med enkle statistikker
- Mørkt tema med automatisk systemdeteksjon og manuell bryter
- Oppdateringsbanner når ny service worker er klar
- PWA-støtte og lokal lagring via `localStorage`

## Teknologi

- Astro
- Tailwind CSS
- Vanlig klient-JavaScript for spillogikk
- Service worker for caching

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

- `src/pages/index.astro` inneholder appskallet
- `src/scripts/app.js` inneholder spillogikken
- `src/styles/global.css` inneholder Tailwind-baserte komponentstiler
- `public/manifest.json` og `public/sw.js` holder på PWA-oppsettet

## Versjonshistorikk

| Versjon | Endring |
|---------|---------|
| v3.0.0 | Migrert til Astro og Tailwind CSS |
| v2.2.0 | Fjernet nivå fra poengoversikten, tydeligere totalpoeng og poenginndata |
| v2.1.0 | Mørkt tema med automatisk systemdeteksjon og manuell toggle |
| v2.0.0 | Spillhistorikk og statistikk per spiller |
