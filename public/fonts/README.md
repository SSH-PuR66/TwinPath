# Self-hosted fonts

| File | Family | Axes | License |
| --- | --- | --- | --- |
| `bricolage-grotesque-latin-var.woff2` | Bricolage Grotesque (Mathieu Triay) | wght 200-800, wdth 75-100, opsz 12-96 | SIL Open Font License 1.1 |
| `ibm-plex-sans-latin-var.woff2` | IBM Plex Sans (IBM) | wght 400-600 | SIL Open Font License 1.1 |
| `fraunces-latin-var.woff2`, `fraunces-italic-latin-var.woff2` | Fraunces | not referenced since 2026-09-02; kept for the theme catalog | SIL OFL 1.1 |

Latin subsets served by Google Fonts, copied here so the app never calls a third-party
font host (CSP `font-src 'self'`). `@font-face` rules live in `src/tokens.css`.
