# Perfume store — Next.js + Google Sheets (cash on delivery)

A free-to-run store: the **storefront** is a Next.js site (host it on Netlify), and the **Google Sheet is the database**.
When a customer orders, a row is added to the `Orders` tab, stock is reduced in the `Products` tab, and an email is sent to the owner (and to the customer if they gave an email).

```
Customer → Next.js site → /api/order → Google Apps Script → Google Sheet (+ emails)
```

## 1. Try it locally (demo mode, no Sheet needed)

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no `.env.local`, the site uses sample products and orders are only logged in the terminal.

## 2. Set up the Google Sheet

1. Create a new Google Sheet. Add five tabs named exactly **Products**, **Orders**, **Settings**, **Coupons**, **Testimonials**.
2. Import the files in [`sheet-template/`](sheet-template) into each tab (File → Import → *Replace current sheet*), or copy the header rows.
3. **Products** columns: `id | name | price | size | stock | image | description | top_notes | heart_notes | base_notes | active`
   - `id`: unique, lowercase, no spaces (e.g. `noir-ambre-50`). One row per size.
   - **Sizes (30 ml / 50 ml / 100 ml):** add one row per size and give them **exactly the same `name`** (capitals and extra spaces don't matter). The site shows them as ONE product with a size picker: each size keeps its own `price`, `stock` and (optionally) `image`. The home card lists the sizes and shows "From <lowest price>". Sizes are sorted by the number in `size` (30ml, 50ml, 100ml). A product with a single row simply has no picker. Rows with a different `name` (even a typo) become separate products.
   - `image`: a direct image URL (Cloudinary, Imgur…), or a path like `/images/noir.jpg` for a file placed in `public/images/`. Empty = placeholder bottle.
     **Several images:** put them all in the same cell, separated by `;` (or `|`, or a new line inside the cell):
     `https://…/front.jpg; https://…/side.jpg; https://…/box.jpg`. The first one is the main photo (home grid, cart). The product page shows a gallery with thumbnails, arrows and swipe, and the home card switches to the second photo on hover. Use 3:4 portrait photos (about 900×1200).
   - `top_notes`, etc.: separate several notes with `;`.
   - `active`: `FALSE` hides a product.
4. **Settings**: `delivery_fee` and `free_delivery_over` (0 = never free).
   **Orders** columns end with `coupon | discount` (the order shows which coupon was used and how much it took off).
   **Coupons**: see the *Coupons* section below.
   **Testimonials** and the About / reviews texts in **Settings**: see *About us and customer reviews* below.
5. Select the `phone` column in **Orders** → Format → Number → *Plain text*.

## 3. Add the Apps Script backend

1. In the Sheet: Extensions → Apps Script. Delete the default code and paste [`apps-script/Code.gs`](apps-script/Code.gs).
2. Project Settings (gear) → Script properties → add:
   - `API_SECRET` = a long random string (keep it, you need it in step 4)
   - `OWNER_EMAIL` = the email that receives order notifications (optional, defaults to the Sheet owner)
   - `STORE_NAME` = brand name shown in emails (optional)
   - `LOGO_URL` = an `https://` link to your logo image, shown in the email header instead of the text name (optional)
3. Select the `testSetup` function and click **Run**. Accept the permissions (Sheets + sending mail). You receive two sample emails: the one you get for each order, and a copy of the one your customers get.
4. Deploy → New deployment → type **Web app** → Execute as **Me**, Who has access **Anyone** → Deploy. Copy the **Web app URL** (ends in `/exec`).
   - After any later code change use Deploy → *Manage deployments* → edit → New version.

## 4. Connect the site

Copy `.env.example` to `.env.local`:

```
APPS_SCRIPT_URL=<the /exec URL>
APPS_SCRIPT_SECRET=<the same API_SECRET>
NEXT_PUBLIC_BRAND_NAME="Your Brand"
NEXT_PUBLIC_CURRENCY=TND
```

Restart `npm run dev`, place a test order, and check the Sheet and your inbox.

**Orders not appearing in the Sheet?** Run the connection check. It tests the URL, access, secret and deployment, and creates no order:

```bash
npm run check:sheet
```

Common causes: `.env.local` is missing or empty (the site then runs in demo mode and shows a red "Demo mode: this order was NOT saved" notice and a `DEMO-` order number), `npm run dev` was not restarted after editing `.env.local`, the Web app's "Who has access" is not *Anyone*, `API_SECRET` differs from `APPS_SCRIPT_SECRET`, or `Code.gs` was edited without Deploy → Manage deployments → *New version*.

## 5. Deploy on Netlify (free)

1. **Put the code on GitHub** (a *private* repository is fine): in GitHub Desktop choose *Publish repository*, or create an empty repo on github.com and `git remote add origin <url>` then `git push -u origin master`. `.env.local` is git-ignored, so your secret is never uploaded.
2. **Netlify → Add new site → Import an existing project → GitHub →** pick the repo. Netlify detects Next.js and reads [`netlify.toml`](netlify.toml) (build command `npm run build`, Node 22). Don't deploy yet: set the variables first (step 3).
3. **Site configuration → Environment variables** (set them *before* the first deploy: the `NEXT_PUBLIC_…` ones are baked into the build, so changing them later needs a new deploy):

   | Variable | Value | Notes |
   |---|---|---|
   | `APPS_SCRIPT_URL` | the Web app URL ending in `/exec` | |
   | `APPS_SCRIPT_SECRET` | the same string as `API_SECRET` in Apps Script | tick **Contains secret values**; never put it in a `NEXT_PUBLIC_` variable |
   | `NEXT_PUBLIC_BRAND_NAME` | `Bel Air Fragrances` | |
   | `NEXT_PUBLIC_CURRENCY` | `TND` | |
   | `NEXT_PUBLIC_TAGLINE` | optional | |
   | `NEXT_PUBLIC_SITE_URL` | your own domain, e.g. `https://belair.tn` | only once you have one (see *SEO*); without it the Netlify address is used |

   **Build failed on "secrets scanning"?** Netlify blocks a build when a variable marked *secret* appears in the pages it produces, and `NEXT_PUBLIC_…` values always do (they are public on purpose). [`netlify.toml`](netlify.toml) already tells the scanner to skip them (`SECRETS_SCAN_OMIT_KEYS`); you can also simply un-tick *Contains secret values* on those variables. Only `APPS_SCRIPT_SECRET` should be secret.

   Without the first two the site runs in demo mode (a red "Demo mode: this order was NOT saved" notice appears after an order).
4. **Deploy.** Every later `git push` redeploys automatically.
5. **Before announcing the site:**
   - Run `installMailTrigger` in Apps Script (see *Faster orders*): without it an order can take 8–12 s, which may be longer than a Netlify function is allowed to run.
   - Place a test order on the live site and check the Orders tab, the stock and your inbox. Then delete the test row and put the stock back.
   - Delete the example coupons (`EXAMPLE10`, `EXAMPLE-SHARED`) from the Coupons tab.
   - Open the site on a phone. If the 3D bottle is slow, nothing is lost: it lowers its own quality, and adding `?3d=off` to the address turns it off.
6. **Your own domain** (optional): Site configuration → Domain management → Add a domain.

If a deploy fails with an error about caching or `use cache`, that is the Next.js `cacheComponents` setting in `next.config.ts` not being supported by Netlify's runtime yet. Send me the build log.

## SEO (Google, sharing)

What the site does by itself, with nothing to set up:

- **Each page has its own title, description and share card.** Products read like *Noir Ambre Eau de Parfum 30ml, 50ml* and use the product photo when a link is shared on WhatsApp, Facebook, X or iMessage. The home page uses a generated card (`opengraph-image`) in your colours.
- **One address per product.** The 30/50/100 ml sizes share one page in search results (`canonical` link), so Google doesn't see three copies.
- **`/sitemap.xml` and `/robots.txt`** are generated from your Products tab. The cart and `/api` are kept out of Google.
- **Structured data for Google** (JSON-LD): the shop (name, logo, social pages, phone), and for every product its price, sizes and in-stock / out-of-stock state, so results can show the price. No fake star ratings are added.
- **Icons**: tab icon, iPhone home-screen icon and a web manifest.
- **A friendly 404 page.** An unknown product link shows it and tells Google not to index it.
- **Deploy previews are hidden from Google** (`noindex` + `Disallow: /`), so a test copy never competes with the real shop. Only the production site is indexable.

Things to do once the site is live:

1. **Set the real address.** Add your domain in Netlify, then set `NEXT_PUBLIC_SITE_URL=https://yourdomain` (no slash at the end) and redeploy. Without it the `….netlify.app` address is used.
2. **Optional texts in the Settings tab** (all blank = sensible defaults). These need the latest [`apps-script/Code.gs`](apps-script/Code.gs) pasted and redeployed as a **New version**:

   | key | what to put |
   |---|---|
   | `seo_title` | the home page title in Google, up to about 60 characters, e.g. `Bel Air Fragrances — Perfume in Tunis` |
   | `seo_description` | the text under the title in Google, up to about 155 characters |
   | `seo_image` | an `https://` picture (1200×630 works best) used when the home page is shared |
   | `instagram_url`, `facebook_url`, `tiktok_url` | your pages: shown as icons in the footer and given to Google |
   | `contact_phone` | the shop phone, e.g. `+216 20 000 000`, given to Google |

3. **Google Search Console** (free): add your site, then *Sitemaps → submit* `sitemap.xml`. Either verify with the *HTML tag* method and put the code in the `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` variable (Bing: `NEXT_PUBLIC_BING_SITE_VERIFICATION`), or use the DNS method and skip the variables.
4. **Check it**: the [Rich Results Test](https://search.google.com/test/rich-results) on a product page, and share a link to yourself on WhatsApp to see the card.
5. **Google Business Profile** matters most for a local shop: keep your Maps listing, address and opening hours complete, and put your website on it. Pages are prebuilt so they are fast; keep product photos under ~300 KB.

Good to know: new sites take days to weeks to appear in Google, and no setting can speed that up. The Products → `description` text is what people read in search results, so write a real sentence for each product.

## Animation and 3D

- **One 3D bottle, two homes.** The hero and the About section share a single 3D canvas (three.js via react-three-fiber, `src/components/motion/bottle-scene.tsx`). The bottle sways and follows the mouse in the hero, then **flies down as you scroll**, spinning once, and lands in the About frame, where a golden halo and sparkles appear. It then scrolls away with the section. The label on the bottle shows `NEXT_PUBLIC_BRAND_NAME`.
  - How it works: the hero and the About frame each contain an empty "slot" (`data-bottle-slot="hero"` and `"about"`). Every frame the scene measures both slots on the page and moves the bottle between them, so it always lands exactly on the frame, at any screen size. Wrap other sections in `<BottleStage>` and use `<BottleSlot>` (`src/components/motion/bottle-stage.tsx`) to give it more stops.
  - **Design rules:** flat colours only, no gradients anywhere (CSS, 3D and emails). Icons are [Phosphor](https://phosphoricons.com) (`@phosphor-icons/react`): use the `/dist/ssr` import in server components, e.g. `import { Truck } from "@phosphor-icons/react/dist/ssr"`, and the `duotone` weight for the two-tone gold look. Adding `?motion=off` to the address skips the scroll animations (static page, handy for testing).
  - **Performance:** the canvas is only drawn while the hero/About area is on screen. If a device is slow, the scene lowers its quality by itself (fewer pixels and no sparkles, then simple see-through glass instead of refractive glass). Add `?3d=lite` to the address to see the lightest mode, or `?3d=off` to switch the 3D bottle off completely (flat illustrations only), e.g. `https://yoursite.com/?3d=off`.
  - The About section also has gold corner lines that draw themselves, a circular badge that turns as you scroll, and a title whose words rise one by one.
- The model is `public/models/parfum.glb` (200 KB, Draco-compressed), converted from `blender File.blend` with Blender: [`tools/convert-blend.py`](tools/convert-blend.py). It reduces 155k triangles to ~61k and drops the empties. To redo it:
  `blender -b "blender File.blend" --python tools/convert-blend.py -- public/models/parfum.glb 2.6`
  The Draco decoder in `public/draco/` is served from your own site (no CDN).
- Materials are recreated in `bottle-scene.tsx` from the values in the .blend's Cycles shaders (glass IOR and amber absorption, liquid colour, gold colour/metalness/roughness, black plastic tip). Cycles shader nodes can't be exported to the web directly. The label textures (`label.jpg`, `label 2.png`, `Normal Paper.jpg`) were not included with the .blend, so the label is drawn with your brand name instead. Put the real `label.jpg` in `public/` and load it in `brandLabel()` to use it.
- The hero background colour is `HERO_BG` in `src/lib/config.ts`. The 3D canvas uses the same colour so the glass refracts a seamless backdrop.
- Scroll animations use GSAP ScrollTrigger (`src/components/motion/scroll-scope.tsx`). Add `data-reveal` to any element to make it fade up on scroll.
- Visitors without WebGL, or with "reduce motion" turned on, get a flat bottle illustration and no animation.
- three.js is loaded only on the home page, in the browser, so other pages stay light.

## Coupons (% off, with an expiry date; single-use or shared)

Create codes in the **Coupons** tab (import [`sheet-template/Coupons.csv`](sheet-template/Coupons.csv)):

| code | percent | expires | max_uses | uses | used | used_at | order_id |
|---|---|---|---|---|---|---|---|
| WELCOME-8K2P | 10 | 2026-12-31 | | | | | |
| SUMMER-X7Q4 | 15 | 2026-08-31 | 100 | | | | |
| FRIENDS-M3ZD | 5 | | unlimited | | | | |

- `code`: not case-sensitive. Make it hard to guess (e.g. `WELCOME-8K2P`), because anyone who guesses a valid code can use it.
- `percent`: a plain number, `15` = 15% off the products (delivery is not discounted). Don't use a *percent* cell format.
- `expires`: the **last day** the code works (it stays valid until the end of that day). Leave blank for no expiry.
- `max_uses` says how many orders the code works on **in total**:
  - **blank (or `1`): single use.** The first order uses it up and nobody can use it again (row 1 above).
  - **a number, e.g. `100`:** shared code. It works on 100 orders, then stops (row 2).
  - **`unlimited`:** no cap, it runs until the expiry date (row 3).
  - Anything else (`0`, text, `2.5`) makes the code invalid, so a typo can't give away unlimited discounts.
- **One use per customer on shared codes** (`max_uses` other than 1): the same phone number (compared by its last 8 digits, so `+216 20 123 456` and `20123456` match) or the same email can't use the same code twice. A customer can get around this with another phone and email, so it stops casual reuse, not determined abuse. For a strict limit, make one single-use code per customer.
- `uses`, `used`, `used_at`, `order_id`: **leave empty.** The script counts the orders in `uses`, ticks `used` when the code is used up, and writes the time and number of the last order. Tick `used` yourself to switch a code off early. Shared codes need the `uses` column and single-use codes need the `used` column, otherwise the code is refused.
- The code is checked again at the moment the order is placed. If two customers try the last use at once, only the first order wins; the second sees "This coupon has already been used" (or "reached its usage limit") and can order at full price. A shared code that this customer already used is refused only at that moment, because the site doesn't know their phone number until they fill in the form.
- Free delivery (`free_delivery_over`) is judged on the products *after* the discount.
- The Orders tab shows the code and the discount in the `coupon` and `discount` columns.
- Delete the example codes `EXAMPLE10` and `EXAMPLE-SHARED` before going live.
- Sheets made with the first version of coupons (without `max_uses` and `uses`) keep working: every code is single use.

**After updating the code you must redeploy it:** paste the new [`apps-script/Code.gs`](apps-script/Code.gs), add the headers `coupon` and `discount` at the end of the Orders header row (columns N and O), then Deploy → Manage deployments → ✏️ → Version: *New version* → Deploy. Run `npm run check:sheet` to confirm coupons are supported. `npm run test:script` runs the Apps Script's own tests (single and shared codes, expiry, one use per customer, percent maths) on your computer without touching Google.

In demo mode (no Sheet connected) the coupon box accepts `DEMO10` (10% off) so you can try it.

## About us and customer reviews (home page)

**About us** sits right under the hero (the 3D bottle flies into its frame as you scroll) and **customer reviews** sit under the collection. Everything is edited in the Google Sheet, nothing is hard-coded.

**About us** (Settings tab, `key | value` rows):

| key | what to put |
|---|---|
| `about_title` | the heading, e.g. `Our story` (default: *About <your brand>*) |
| `about_text` | your text. **One paragraph per line**: press Alt+Enter (Windows) or Option+Enter (Mac) inside the cell for a new line |
| `about_image` | optional. The 3D bottle now lives in the About frame, so this photo is only shown to visitors who can't see the 3D (no WebGL, or "reduce motion"). An `https://` image link (or `/images/…`), portrait works best; empty = a flat bottle illustration |

Until you write `about_text`, a short generic welcome text is shown.

**Customer reviews**, copied from your Google Maps listing. Google has no free feed for its review summary: the Places API needs a billing account and has display rules, and copying pages automatically is against Google's terms. So you copy the numbers and texts once and update them when you like:

| key (Settings tab) | what to put |
|---|---|
| `google_rating` | the average, e.g. `4.8` (a comma is fine: `4,8`) |
| `google_reviews_count` | the number of reviews, e.g. `127` |
| `google_maps_url` | the link to your Google Maps listing (`https://…`). Shown as "See all reviews" |
| `reviews_summary` | the **Résumé des avis** text from your Maps listing, copied as is |
| `reviews_title` | optional heading (default: *What our customers say*) |

And in the **Testimonials** tab one row per review (up to 12 are shown, in this order): `name | rating | text | active`. `rating` is 1–5 (blank = no stars), `active = FALSE` hides a row. Use the reviewer's first name or initials and only reviews you are happy to show. Keep what you copy accurate and unedited, and keep the link to Google Maps next to it.

- The section only appears when there is something to show (a rating, a summary or at least one active review). Nothing is ever invented: an empty Sheet means no reviews section.
- After you change the Sheet, the site updates within about 2 minutes.
- Needs the latest [`apps-script/Code.gs`](apps-script/Code.gs) pasted and redeployed as a **New version** (the older script doesn't send these texts: the About section then shows the default text and reviews stay hidden).
- In demo mode (no Sheet connected) sample content is shown with a red "Sample content" notice.
- The page texts around them ("About us", "Based on … Google reviews", "Résumé des avis") are in [`src/components/home-sections.tsx`](src/components/home-sections.tsx) if you want them in another language.

## The emails

Each order sends two emails (the second only if the customer typed an email address):

- **To you:** the order number and time, the customer's name, phone (tap to call), email, address and note, the items, the coupon and delivery lines, and a clear *Total to pay on delivery*, with a button that opens your Orders sheet.
- **To the customer:** a thank-you, the same order summary, where it is going, and three "what happens next" steps. Replies go to `OWNER_EMAIL`.

Both are branded with your colours and shop name, work on phones (no sideways scrolling), and carry a plain-text version for mail apps that don't show formatting. The amounts show your currency (`NEXT_PUBLIC_CURRENCY`, e.g. `89 TND`). Everything a customer types is escaped, so nothing they write can change how the email looks.

- **See them without placing an order:** `npm run preview:email`, then open `.email-preview/index.html` in your browser (desktop and phone width, nothing is sent). The name comes from `NEXT_PUBLIC_BRAND_NAME`.
- **See them in your inbox:** run `testSetup` in Apps Script.
- **Change the look:** colours and layout are in [`apps-script/Code.gs`](apps-script/Code.gs), section *Email design* (`MAIL_COLORS`, `emailShell_`, `sendOwnerEmail_`, `sendCustomerEmail_`). After editing, `npm run preview:email`, paste into Apps Script and redeploy as a new version.
- Some mail apps hide images until the reader allows them, so a logo may appear only after that. The shop name in text is always visible when no logo is set.

## Faster orders (email queue)

Sending an email from Google takes seconds. If the emails are sent *during* the order, an order can take 8–12 s, and some hosts (e.g. Netlify's free plan, about 10 s per request at the time of writing) can cut that off, which leads to errors and duplicate orders. The **email queue** fixes this: the order is saved and answered right away (about 4–6 s), and a trigger sends the emails about every minute.

**Turn it on (once):**
1. Paste the latest [`apps-script/Code.gs`](apps-script/Code.gs) into Apps Script and save.
2. In the editor pick **`installMailTrigger`** in the function dropdown and click **Run**. Google asks for one extra permission (running on a schedule); allow it.
3. **Deploy → Manage deployments → ✏️ → Version: New version → Deploy.**
4. Run `npm run check:sheet`. It should say *Email queue is running*.

**How it behaves**
- Emails arrive up to about a minute after the order instead of instantly.
- A failed email is retried up to 5 times, and a retry only repeats the email that failed (nobody is emailed twice). After 5 failures the script gives up on that order's emails (the order itself is always saved in the Sheet).
- **Safety net:** the trigger records a "heartbeat" each run. If it has not run for 10 minutes (trigger deleted or broken), orders go back to sending their emails immediately, so emails are never lost silently. `npm run check:sheet` warns you when this happens.
- If it is not turned on, nothing changes: emails are sent during the order, as before.
- **Turn it off:** run **`removeMailTrigger`** (pending emails are sent first), then redeploy is not needed.
- The Script Properties `MAIL_MODE`, `MAIL_HEARTBEAT` and `mail:…` are managed by the script. Don't edit them.
- The dev server log shows each order's timing, e.g. `[order] ORD-… saved. Round trip to Apps Script 4300 ms (script 3100 ms, emails queued).`

## How it behaves

- Product data is cached and refreshed from the Sheet every ~2 minutes, and right after each order. Price/stock changes in the Sheet appear within a couple of minutes.
- The browser never decides prices or stock: Apps Script re-checks every item against the Sheet, under a lock, so two customers can't buy the last bottle.
- Gmail limits Apps Script to about 100 emails/day on a free account. Each order uses 1–2.
- To process an order, change its `status` cell in the Orders tab (New → Confirmed → Delivered…).

## Limits to know about

- Fine for up to a few hundred orders per month. Beyond that, move to a real database.
- Keep the Sheet private. It holds customer phone numbers and addresses.
- No online payment by design (cash on delivery only).
