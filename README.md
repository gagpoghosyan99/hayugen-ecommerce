# hayugen-ecommerce

Interactive clothing-rail homepage for [HAYUGEN](https://hayugen.com/). This repository holds a Dawn-compatible theme overlay. It is **not published** to the live storefront.

## Local preview

```bash
python3 -m http.server 4173
```

Open [http://127.0.0.1:4173/preview/](http://127.0.0.1:4173/preview/).

The preview loads live product titles, prices, variants, and images from hayugen.com. Add to Cart is stored only in this browser.

## Add to the Shopify theme

The live theme is **HAYUGEN Production Candidate** (Dawn 15.5). Copy these files into that theme, then add **Clothing rail hero** as the first homepage section:

- `sections/clothing-rail-hero.liquid`
- `snippets/clothing-rail-item.liquid`
- `assets/clothing-rail-hero.css`
- `assets/clothing-rail-hero.js`
- merge `locales/en.default.json`

In the theme editor:

1. Select the men’s collection (`frontpage` / T-Shirt for male).
2. Or add Garment blocks to control order.
3. Keep the existing `hayugen_hero` disabled if this section replaces it.

Do not push to the live published theme without approval.

## Image limitation

Current catalog photos are on-model studio shots, not transparent hanging garments. The rail presents them as hanging look cards cropped to the shirt. Ghost-mannequin or flat-lay PNGs will make the rail look closer to the reference video.
