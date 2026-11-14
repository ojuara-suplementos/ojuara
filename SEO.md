# SEO — Ojuara Suplementos

## Implemented
- Route-specific Helmet titles, descriptions, canonical, Open Graph and Twitter text; variants canonicalize to their product, ordering canonicalizes to the listing, meaningful category/pagination parameters are retained.
- Home Organization/WebSite, listing and product BreadcrumbList, product Product/Offer from registered prices and per-variant stock. No reviews, fabricated address, hours or phone are added. Offers use the regular registered price, not an unconditional payment-specific Pix price.
- Admin, checkout, nonexistent products and unknown routes get noindex. Robots allows rendering assets while excluding private paths. Cloudflare adds private-route X-Robots-Tag headers; these do not replace authentication.
- Vite production builds anonymously fetch every active product and category with pagination, generate sitemap.xml, extensionless product HTML with static head/schema and no-JavaScript public links. No lastmod is generated without authoritative page-content timestamps. Build fails if the catalog cannot be read rather than deploying a silently incomplete sitemap.
- More descriptive product image alt text and high priority for the detail image; existing lazy loading, dimensions and layout are preserved.

## Cloudflare Pages
- Build command: `npm run build`; output: `dist`. Retain the existing Vite/React configuration. `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must reference the same public catalog as the browser app; never use a service-role credential.
- Pages serves generated `produto/<slug>.html` at `/produto/<slug>` and redirects `.html` URLs to clean URLs. Its native SPA fallback handles other routes because the output has no top-level `404.html`. No blanket redirect is added that could override product files or assets.
- `public/_headers` is Cloudflare-specific. Lovable hosting ignores it; private pages still have client noindex/robots directives.
- Canonicals, structured-data identifiers, social URLs and sitemap use the confirmed production domain `https://ojuarasuplementos.com/`. Publish a fresh Cloudflare deployment to apply these changes; DNS/domain binding and redirects from alternate hostnames are hosting settings and are not changed by this source update.
- Each deployment refreshes sitemap and static product/social metadata. Product edits do not automatically redeploy Cloudflare; configure a secure external scheduled deployment/build hook if continuous freshness is needed. Never expose its private hook URL in frontend code.

## Limitations and remaining checks
- Categories, offers and pagination share `/produtos` with query parameters. Their route-specific metadata is available to JS-rendering crawlers; non-JS social crawlers receive generic listing metadata. Static product HTML provides correct text/schema without a full SSR migration, but the React UI remains client-rendered.
- No og:image/twitter:image added: there is no user-approved absolute, share-sized HTTPS image URL. Product schema references the real selected product image. Provide appropriate public images (1200×630, a few hundred KB) to complete social image cards without incorrect image substitutions.
- Active out-of-stock products remain in the sitemap with OutOfStock metadata; the existing unavailable product UI is unchanged. Inactivation removes static output on the next deployment.
- No mass image recompression or arbitrary image proxy is introduced: uploaded product images are externally stored and may need origin-side modern format conversion. Local hero/logo assets are already relatively small.
- Field Core Web Vitals and ranking/indexation must be measured after publishing on the real domain using Search Console/PageSpeed. A local browser observation is not a field CWV verdict. No guaranteed rankings or rich results.
- Connect Search Console, submit `/sitemap.xml`, and verify Google Business Profile separately. No external setup has been performed.
- Existing npm audit warnings are not repaired via unrelated major dependency upgrades in this SEO-only task.