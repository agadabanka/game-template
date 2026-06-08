---
name: book
description: Rebuild the illustrated PDF playbook ("Jazz — Building a Bunny with a Bazooka") from book/book.html, optionally regenerating chapter/backdrop art with Gemini nano-banana-pro. Use when the user asks to update/rebuild the book or PDF, add a chapter, fix the cover, or refresh its art.
---

# /book — rebuild the illustrated PDF playbook

The book is one self-contained HTML (`book/book.html`) of art-backed `.page`
sections, rendered to **`book/jazz-playbook.pdf`** by headless Chromium
(`tools/build-book.mjs`).

## Structure
- Each page = a `<section class="page" style="background-image:url('img/art/NAME.jpg')">`
  with a `.scrim` (gradient for legibility) + a `.card` of content
  (kicker/h2/grid/callout). Copy an existing section as a template; keep new pages
  before the BACK page. Each section is exactly one A4 page (`.page` is 210×297mm).
- The **cover** uses `.cover .titlebox`; the **platform diagram** uses the
  `.diap` / `.diagram` / `.layer` / `.box` classes (a 2-page architecture spread).
- Art lives in `book/img/art/`: `cover, ch1–ch7, back, panorama, stack`
  (`stack` is the dark blueprint backdrop behind the diagram spread).

## How to run
1. (Optional) Generate art — needs `GEMINI_SA_JSON` (or `GOOGLE_APPLICATION_CREDENTIALS`):
   ```
   node scripts/gen-book-art.mjs            # all plates
   node scripts/gen-book-art.mjs cover      # one plate
   ```
   Chapter plates are reference-conditioned on `art-src/STYLE_modelsheet.jpg` so
   the bunny + bold-outline cartoon style stay on-model; aspect `2:3`; **NO text**.
   *Backdrops* (e.g. `stack`) set `noRef:true` in the JOBS array so they generate
   free-form — the model sheet would otherwise force the hero into frame.
2. Edit `book/book.html` to add/update pages.
3. Rebuild the PDF:
   ```
   node tools/build-book.mjs                # → book/jazz-playbook.pdf
   ```
   It prints page count + size + pageerror count. Commit the HTML, any new art,
   AND the rebuilt PDF.
4. **Verify the render** (the PDF can differ from a browser; always eyeball it):
   ```
   pdfinfo book/jazz-playbook.pdf | grep Pages          # real page count
   pdftoppm -jpeg -r 90 -f 1 -l 1 book/jazz-playbook.pdf /tmp/cov   # page 1 → /tmp/cov-01.jpg
   ```
   then Read the jpg. (Or screenshot a `.page` element from `book.html` directly
   with Playwright at viewport 794×1123.)

## Gotchas we hit (fixed — don't regress)
- **Cover title was unreadable / showed a "black box".** White title text sat
  directly on the bright sky with a heavy `text-shadow`, which muddied into a dark
  halo (and read as a solid black box in iOS PDF preview). Fix: the title lives in a
  **semi-transparent dark panel** (`.cover .titlebox` has its own background/border)
  with a light drop shadow — never rely on text-shadow over a bright photo.
- **Page count was wrong (reported ~20 for 11 pages).** The counter regex matched
  `class="pageno"` footers too; it now uses `/class="page[ "]/` (a real fix in
  `build-book.mjs`). Trust `pdfinfo … | grep Pages` as ground truth.
- **Backdrops came out with the bunny dead-center.** Reference-conditioning pulls
  the hero in even when the prompt says "empty center" — generate backdrops with
  `noRef:true` (no ref image).
- Keep text on art legible: every page needs a `.scrim` gradient and content in a
  `.card`. Light text on a bright region without a panel will not read.

## Keep it honest
The book documents the real system, including hard-won failures. The 2-page
**platform field map** (the layered stack: foundations → platform → engine →
content/authoring → evaluation → feedback loop → publish) is the orientation map —
update it whenever a new tier or tool is added, and mirror new lessons into
`CAPABILITIES.md` and `DIARY.md`.
