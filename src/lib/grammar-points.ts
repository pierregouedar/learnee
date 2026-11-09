import type { GrammarGroup, ProgrammePoint } from "@/lib/grammar-programme";

// Programme d'anglais §18.3, écrit à la main : clés partagées par la correction (catégorie d'erreur) et le module grammaire.
// `period` : 0 = sept.-oct., 1 = nov.-déc., 2 = janv.-févr., 3 = mars-avril (de mai à août : révisions sur tout le programme).
// `focus` : ce que la leçon doit couvrir ; sans ça, le modèle ne voit qu'une clé (« present_perfect ») et oublie le contraste.
export const ENGLISH_POINTS: ProgrammePoint[] = [
  {
    key: "present_simple_continuous",
    label: "Présent simple et présent continu",
    group: "verbs",
    period: 0,
    focus: "Contrast present simple (habits, facts, schedules) and present continuous (now, temporary). Stative verbs (know, want, like) are not used in -ing.",
  },
  {
    key: "past_simple",
    label: "Prétérit",
    group: "verbs",
    period: 0,
    focus: "Past simple for a finished action at a stated past time: -ed spelling, irregular pasts, did/didn't + base verb in questions and negatives.",
  },
  {
    key: "present_perfect",
    label: "Prétérit ou present perfect",
    group: "verbs",
    period: 0,
    focus: "Contrast past simple (finished and dated: yesterday, last week, ago, in 2022) and present perfect (link with now: ever, never, already, yet, just, since, for). The French passé composé translates to both: explain how to choose.",
  },
  {
    key: "irregular_verbs",
    label: "Verbes irréguliers",
    group: "verbs",
    period: 0,
    focus: "The most useful irregular verbs in professional contexts (base / past / past participle), the difference between the past form and the participle, did + base verb.",
  },
  {
    key: "questions",
    label: "Poser des questions",
    group: "sentence",
    period: 0,
    focus: "Word order in questions: auxiliary before the subject (do/does/did, be, have, modals), wh-questions, subject questions without do.",
  },
  {
    key: "articles",
    label: "Articles",
    group: "words",
    period: 0,
    focus: "a/an vs the vs no article: generalisations without the (Clients want...), first mention with a/an, specific the, jobs with a (She is a designer).",
  },
  {
    key: "futures",
    label: "Futurs (will, going to, présent continu)",
    group: "verbs",
    period: 1,
    focus: "Contrast will (decision made now, prediction), going to (plan, visible evidence) and present continuous (fixed arrangement). No will after when/if.",
  },
  {
    key: "modals",
    label: "Modaux (can, must, should, have to)",
    group: "sentence",
    period: 1,
    focus: "can/could, must vs have to, mustn't vs don't have to, should. Modal + base verb without to, no -s.",
  },
  {
    key: "comparatives",
    label: "Comparatifs et superlatifs",
    group: "sentence",
    period: 1,
    focus: "Short adjectives -er/-est, long adjectives more/most, irregular good/better/best and bad/worse/worst, than, as ... as.",
  },
  {
    key: "prepositions",
    label: "Prépositions de temps et de lieu",
    group: "words",
    period: 1,
    focus: "Time: at/on/in (at 9 am, on Monday, in May), for vs since vs during. Place: at/in/on.",
  },
  {
    key: "present_perfect_continuous",
    label: "Present perfect continu",
    group: "verbs",
    period: 2,
    focus: "have/has been + -ing for an activity that started in the past and is still going on, with for/since. Contrast with present perfect simple (result, quantity).",
  },
  {
    key: "past_perfect",
    label: "Plus-que-parfait",
    group: "verbs",
    period: 2,
    focus: "had + past participle for the earlier of two past actions, with when, before, after, by the time.",
  },
  {
    key: "conditionals",
    label: "Conditionnels",
    group: "verbs",
    period: 2,
    focus: "Zero, first (if + present, will), second (if + past, would), third (if + had + participle, would have + participle). Never will/would in the if-clause.",
  },
  {
    key: "passive",
    label: "Voix passive",
    group: "verbs",
    period: 2,
    focus: "be + past participle in each tense, by + agent, and when to prefer it (the action matters more than who did it).",
  },
  {
    key: "relatives",
    label: "Propositions relatives",
    group: "sentence",
    period: 2,
    focus: "who/which/that/whose/where, defining vs non-defining clauses (commas, no that), dropping the object pronoun.",
  },
  {
    key: "reported_speech",
    label: "Discours indirect",
    group: "verbs",
    period: 3,
    focus: "Tense backshift, say vs tell, reported questions (no inversion, if/whether) and orders (tell someone to).",
  },
  {
    key: "gerund_infinitive",
    label: "Gérondif ou infinitif",
    group: "verbs",
    period: 3,
    focus: "Verbs followed by -ing (enjoy, avoid, finish, look forward to) vs to + base verb (want, decide, plan, hope), -ing after prepositions.",
  },
  {
    key: "connectors",
    label: "Connecteurs logiques",
    group: "sentence",
    period: 3,
    focus: "Contrast (however, although, whereas), cause (because, due to), consequence (therefore, as a result), addition (moreover), and their punctuation.",
  },
  {
    key: "opinion_nuance",
    label: "Exprimer une opinion, nuancer",
    group: "sentence",
    period: 3,
    focus: "Giving and nuancing an opinion: I think/believe, in my view, it seems that, might/could, adverbs (probably, clearly), agreeing and disagreeing politely.",
  },
];

// Regroupement pour l'affichage du test de positionnement : conjugaison d'abord, puis construction, puis petits mots.
// Sans dépendance serveur : importé par le test de positionnement côté navigateur.
export const GRAMMAR_GROUPS: readonly { key: GrammarGroup; label: string; hint: string }[] = [
  { key: "verbs", label: "Conjugaison et temps", hint: "Écris la bonne forme du verbe entre parenthèses." },
  { key: "sentence", label: "Construire la phrase", hint: "Choisis la réponse qui complète correctement la phrase." },
  { key: "words", label: "Petits mots", hint: "Choisis le mot qui convient." },
];
