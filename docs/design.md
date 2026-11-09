# Learnee design system

A calm study tool for sessions of up to 2 h. It is not a marketing site: no hero, no decorative gradients, no entry or scroll animations. All copy is in French. The source of truth is `src/app/globals.css`.

## Fonts (`src/app/layout.tsx`)
- UI: **Geist** (`font-sans`, the default everywhere).
- English article (and any long English text): **Literata**, loaded as `--font-article`. Use the `font-article` utility. Recommended: `font-article measure text-lg leading-relaxed`.
- Numbers that change live (counters, timers, scores): `tabular-nums`.

## Color tokens (shadcn semantic variables, light and dark)
- `background` / `foreground`: warm paper with ink text; dark mode is warm graphite, never pure black or white.
- `card`: slightly lifted surface. `muted` / `muted-foreground`: secondary text and quiet fills.
- `primary`: the only accent, a forest green used like a teacher's ink. Use it for the main action button, corrections, the ink circle, success states (such as a word count in range) and focus rings. Never add another hue for emphasis.
- `accent`: pale green fill (hover or selected rows, highlighted feedback). `destructive`: errors only.
- Never hard-code Tailwind palette colors (`emerald-700`, `zinc-900`...). Use the tokens so both themes stay consistent.
- Every text/background pair meets WCAG AA in both themes (lowest: muted-foreground on muted, 5.3:1).

## Spacing and layout
- Page container (already in the layout): `mx-auto max-w-5xl px-4 py-6 sm:py-10`. Do not add another container in a page.
- Reading/writing columns: `measure` (62ch, about 72 characters per line). Two-pane layouts (article + draft): `grid gap-8 lg:grid-cols-2` stacked below `lg`.
- Vertical rhythm: `space-y-8` between sections, `space-y-3` inside a block, `gap-2` between a label and its field.
- Must work at 375 px with no horizontal scroll: no fixed widths, and long words wrap (`break-words`).

## Radius and surfaces
- `--radius` = 0.5rem. Buttons and inputs: `rounded-lg` (8px, the shadcn default). Sheets (`Panel`): `rounded-xl`.
- The whole app reads as a corrected notebook: lists, figures and callouts sit on the paper with hairlines (`border-y`, `border-t`, `divide-y`), not in boxes. A `Panel` is a sheet (`bg-card`, one soft `shadow-[0_1px_2px_rgba(0,0,0,0.05)]`) and is used only for a block that is really separate: a copy, a form, a chart, a recommended next step.
- Callouts (advice, tier proposal, mock exam reminder): a margin note, `border-l-2 border-primary pl-5`, no fill.

## Components
- `AppHeader`: `h-14`, not sticky (to keep vertical space while writing on a phone). Brand mark: the logo drawn inline in theme colors, same path as `docs/logo.svg` and `src/app/icon.svg`; wordmark in Literata.
- `WordCounter count target`: "42 mots · cible 60-80", shown in `text-primary` when the count is in range.
- Buttons: shadcn `Button`. `default` is the single primary action on a screen; `outline` or `ghost` for the rest. Labels are 1-3 words (« Corriger », « Nouveau sujet »).
- Icons: `lucide-react` (already installed), `size-4`.
- Forms: a visible label above each field, never a placeholder used as a label; the error message goes under the field in `text-destructive`.
- Loading: a text status plus a skeleton or a quiet `animate-pulse`. No spinning loaders during correction waits.
- Motion: only color transitions on hover or focus. Anything else must respect `prefers-reduced-motion`.

## Page patterns (reference: the Today dashboard, `src/app/page.tsx`)
- Shared building blocks live in `src/components/page.tsx`: `PageHeader` (optional small context line, Literata `text-4xl sm:text-5xl font-normal` title, one helpful sentence, actions on the right, hairline under it), `Panel` (sheet with serif title/description/actions), `SectionTitle`, `IconBadge` (bare `size-5` icon in a `w-6` column; `primary` = ink green for done or recommended, `muted` = faded), `EmptyState` (dashed hairlines, says what is missing and how to fill it). Use them instead of ad-hoc markup.
- Task/activity icons: `ACTIVITY_ICONS` in `src/components/dashboard.tsx` (PenLine = écrit, BookOpen = grammaire, Headphones = écoute, FilePen = réécriture, Layers = révisions, Timer = examen blanc).
- Lists of things to open (subjects, listenings, history entries, grammar points): `divide-y border-y` straight on the paper, rows `py-4` with no side padding; each row = `IconBadge` + title + one muted line + action on the right; rows wrap on phone. No highlighted row fill: say "conseillé" or "le plus récent" in words and give that row the only `default` button.
- Step-by-step sessions (grammar set, reviews): `SessionProgress` (`src/components/session-progress.tsx`), "Question n sur N" + thin progress bar. Grades in lists: `GradeBadge` (`src/components/grade-badge.tsx`), Literata figure, ink green from 12/20 (6/10) up, no pill.
- Numbers that matter get a `StatTile`: hairline on top, muted label, Literata `text-3xl font-normal` value, muted hint that says what a change compares to ("+1,5 par rapport à la précédente"). `Sparkline` (one series, no axes) is for pages without a full chart.
- The correction page circles the overall grade with `InkCircle` next to the title, and the student's text is shown on ruled lines (`ruled`, `leading-8`): errors struck through in ink, corrections written in green.
- The Today dashboard is a corrected notebook, not a grid of cards. Signature: `InkCircle` (`src/components/ink.tsx`), a hand-drawn green ring around a grade or today's date; use it only for those, never as decoration. The bright moment is `CopySheet`: the last copy as a ruled sheet (`ruled` utility, margin line) with up to two errors struck through and corrected in green, grade circled. Other numbers sit in a `Ledger` (rows with hairlines, serif value on the right). Plan, week and news are lists with `border-y divide-y`, no card fill.
- Section titles on the Today dashboard use `SECTION_TITLE` (Literata, `text-xl font-normal`); the date `h1` is Literata `text-4xl sm:text-5xl font-normal`. Literata never goes above weight 400, anywhere in the app.
- The Today dashboard has one main chart: the grade curve in "Ton parcours" (`ScoreChart` inside `TierTimeline`), on the `graph-paper` utility, next to the streak toward the next tier. Only the copies of the current streak are circled in ink; the others stay muted.
- A list of actions has one `default` button, on the first task to do; the others are `outline`.
- Two-column layouts: `grid gap-8 lg:grid-cols-5` with the main flow in `lg:col-span-3`; single column below `lg`.
- Headings: page `h1` via `PageHeader`; section `h2`/`h3` in Literata, `font-normal` (`text-xl` for sections, `text-lg` for sub-groups); never more than one primary (`default`) button per block.
- Copy: French, tutoiement, plain words, no em dash or en dash anywhere; avoid gendered agreement for the student when a neutral wording exists.
