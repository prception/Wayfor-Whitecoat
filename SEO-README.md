# SEO Setup — WayForWhitecoat

This documents the technical + on-page SEO added to the site.

## What was added

**Every public page** (`index`, `about`, `contact`, `countries`, `gallery`, and all
26 country pages) now has, inside a `<!-- SEO:START --> … <!-- SEO:END -->` block
right after `<title>`:

- `meta description` (unique per page) + `meta keywords`
- `meta author`, `robots` (`index, follow, max-image-preview:large`), `theme-color`
- `link rel="canonical"`
- Open Graph tags (`og:type/site_name/title/description/url/image/locale`)
- Twitter Card tags (`summary_large_image`)
- favicon + `site.webmanifest` references
- JSON-LD structured data:
  - Home: `Organization` + `WebSite` (with SearchAction)
  - Country pages: `EducationalOccupationalProgram` + `BreadcrumbList`
  - Other main pages: `BreadcrumbList`

**Also fixed:** wrong/duplicate `<title>`s (about/contact/countries/gallery and several
country pages previously said "MBBS in Netherlands"), and demoted decorative
background-text `<h1>`s on about/contact to non-heading tags so each page has exactly
one real `<h1>`.

**New files:** `robots.txt`, `sitemap.xml`, `site.webmanifest`.

## ⚠️ Before going live — 2 things to do

### 1. Set the real domain
Everything currently uses the placeholder **`https://www.wayforwhitecoat.com`**.
Once the real domain is known, find-and-replace that string across:
`*.html`, `countries/*.html`, `robots.txt`, `sitemap.xml`.

Or re-run the generator with the right `BASE_URL`:
`scratchpad/seo_inject.py` (the SEO blocks are idempotent — it strips and re-inserts).

### 2. Add the favicon / share-image assets (referenced but not yet present)
Place these in the site root:
- `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`
- `apple-touch-icon.png` (180×180)
- `android-chrome-192x192.png`, `android-chrome-512x512.png`

And add a proper **1200×630 social share image**. The meta currently points
`og:image` at `assets/images/hero-new.png`; replace with a purpose-built
share image if you have one (recommended).

> Tip: realfavicongenerator.net produces all of the above from one logo.

## After deploy
- Submit `sitemap.xml` in Google Search Console.
- Test pages with Google's Rich Results Test (validates the JSON-LD).
