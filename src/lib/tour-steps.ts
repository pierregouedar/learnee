// Visite guidée qui se promène dans l'app : chaque étape ouvre sa page et met en lumière un bloc réel.
// `target` : sélecteur CSS du bloc ; absent ou introuvable (état vide…), la bulle s'affiche seule.
export type TourStep = { path: string; target?: string; title: string; text: string };

/** Étapes de la visite, dans la langue et l'objectif du profil (l'anglais du BTS garde ses textes). */
export function tourSteps({ nameFr, bts, exam, points }: { nameFr: string; bts: boolean; exam: boolean; points: number }): TourStep[] {
  return [
    {
      path: "/",
      title: "Bienvenue sur Learnee",
      text: `Ton entraînement en ${nameFr}${bts ? " pour le BTS Communication" : ""}, un peu chaque jour. On fait le tour de l’app en une minute : suis la bulle.`,
    },
    {
      path: "/",
      target: 'section[aria-labelledby="plan-title"] > ol',
      title: "Ton programme du jour",
      text: "Chaque jour, l’accueil te dit quoi faire : les révisions et la tâche prévue. Ce qui est fait se coche tout seul.",
    },
    {
      path: "/",
      target: 'section[aria-labelledby="week-title"]',
      title: "Ta semaine",
      text: "Ce qui est prévu chaque jour, et ce que tu as déjà fait. Tu peux changer ce planning dans ton profil.",
    },
    {
      path: "/",
      target: 'section[aria-labelledby="stats-title"]',
      title: "Tes progrès",
      text: "Tes mots acquis, tes dernières notes et, après le test, ton niveau par compétence.",
    },
    {
      path: "/",
      target: 'section[aria-labelledby="tiers-title"]',
      title: "Ton parcours en 3 paliers",
      text: `Les textes s’allongent au fil de tes progrès, jusqu’au ${exam ? "format de l’examen" : "format complet"}. Après 3 copies d’affilée à 12/20 ou plus, Learnee te propose de passer au palier suivant.`,
    },
    {
      path: "/ecrit",
      target: 'section[aria-labelledby="news-title"]',
      title: exam ? "Écrit : l’exercice de l’examen" : "Écrit : lire, résumer, écrire",
      text: `Choisis un sujet, de préférence une actualité. Tu lis l’article en ${nameFr}, tu le résumes en français, puis tu réponds à la consigne en ${nameFr}. La correction donne une note sur 20 et explique chaque erreur.`,
    },
    {
      path: "/ecrit",
      target: "#own-subject",
      title: "Ou ton propre sujet",
      text: "Un thème qui t’intéresse, ou un article que tu colles : Learnee en fait un sujet à ton niveau.",
    },
    {
      path: "/grammaire",
      target: 'section[aria-labelledby="focus-title"]',
      title: "Grammaire : une leçon, puis la pratique",
      text: "Le point conseillé dépend de tes erreurs et du programme. Chaque série commence par une leçon courte, puis 12 exercices corrigés au fur et à mesure.",
    },
    {
      path: "/grammaire",
      target: 'section[aria-labelledby="programme-title"]',
      title: "Le programme de l’année",
      text: `${points > 0 ? `Les ${points} points` : "Tous les points"}, période par période. Un point est validé après deux séries à 85 % ou plus, à quelques jours d’écart.`,
    },
    {
      path: "/revisions",
      target: "#review-session",
      title: "Révisions du vocabulaire",
      text: "Un mot inconnu en lisant ? Touche-le (ou sélectionne-le) : sa définition s’affiche, et « Garder » l’ajoute ici. Chaque mot revient au bon moment pour ne pas l’oublier.",
    },
    {
      path: "/ecoute",
      target: 'section[aria-labelledby="ready-title"]',
      title: "Écoute : comprendre l’oral",
      text: `${bts ? "Un audio professionnel" : "Un audio"}, trois écoutes au maximum. Tu prends des notes, tu résumes en français, et la correction montre ce que tu as compris ou manqué.`,
    },
    {
      path: "/positionnement",
      target: "#placement-intro",
      title: "Pour commencer : le test de positionnement",
      text: "20 à 25 minutes pour savoir d’où tu pars. Il règle ton palier de départ et tes priorités de grammaire. Tu pourras revoir cette visite depuis l’accueil.",
    },
  ];
}
