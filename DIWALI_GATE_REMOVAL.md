# Removing the Diwali gate

The Diwali game currently replaces the whole of tinit.in. Everything below must be
undone when the game comes down. Skipping any item leaves the site half-reverted, for
example the real site showing "Play the Diwali Game" in link previews.

## 1. Overlay code

- `src/main.jsx`: remove the `DiwaliIntro` and `hasTeamAccess` imports and the
  `hasTeamAccess() ? ... : <DiwaliIntro />` check, so it always renders
  `<HelmetProvider><BrowserRouter><App /></BrowserRouter></HelmetProvider>`.
- Delete `src/components/shared/DiwaliIntro.jsx`.
- Delete `src/utils/teamAccess.js` (the `?team=tin2026` bypass).

`src/App.jsx` needs no change. It is identical to the version from before the gate
(commit `8d983c0`).

## 2. The game

- Delete `public/diwali.html`.

## 3. `index.html` title and preview tags ("Play the Diwali Game")

Everything is inside the `<!--SEO-META-START-->` block. Keep those two marker comments,
because `scripts/prerender.js` depends on them.

Restore these to their original text:

```html
<title>TIN - Trade Interface Network</title>
<meta property="og:title" content="TIN - Trade Interface Network" />
<meta property="og:description" content="TIN connects India's building materials and construction industry — discover stores and brands, find contractors and designers, and browse jobs and project inspiration, all in one place." />
```

Remove these three tags, which were added for the Diwali game and did not exist before.
If you would rather keep them, give them the normal site text instead:

```html
<meta property="og:site_name" content="TIN – Play the Diwali Game 🪔" />
<meta name="twitter:title" content="TIN – Play the Diwali Game 🪔" />
<meta name="twitter:description" content="A little Diwali fun. Beat the high score!" />
```

The plain `<meta name="description">` tag was never changed, so leave it alone.

## 4. Sitemap and store/job preview pages

`npm run build` only creates `sitemap.xml` and the store and job preview pages if a
Firebase service account key is present. **Without the key it does not fail. It prints
"skipping" and carries on**, so the deploy looks fine but those pages are missing. They
have been missing from every deploy during the gate.

Before the final build, do one of these:

- Put the key at the repo root as `serviceAccountKey.json`, or
- Set `SERVICE_ACCOUNT_PATH` to the key's location.

Key files are gitignored. Never commit one.

After building, confirm that the output has no "skipping" lines and that `dist/` contains
`sitemap.xml`, `jobs/` and `store/`.

## 5. Deploy and check

1. Deploy with `firebase deploy --only hosting`.
2. Open tinit.in in a private window and confirm the real site loads, not the game.
3. Check the page title and a shared link preview.
4. Refresh the Facebook preview with the Sharing Debugger ("Scrape Again"). WhatsApp and
   Google update on their own over time.
5. Delete this file.
