# Rédac B2 — Spécification

Application d'entraînement à l'épreuve d'anglais du BTS Communication (écrit E21 et compréhension orale pour l'E22), avec révision du vocabulaire intégrée, pour des élèves de niveau A2 à B1 qui visent le B2.

Document de référence pour le développement. Prix et modèles vérifiés le 22 septembre 2026.

---

## 1. Contexte

### 1.1 Public visé

- Élève de BTS Communication, ou candidat à une certification d'anglais.
- Niveau de départ : A2 à B1. Objectif : B2 en quelques mois.
- Francophone, interface 100 % en français.
- Usage principal sur ordinateur portable, secondaire sur mobile.
- Temps de travail visé : 1h30 à 2h par jour, dont cette appli ne représente qu'une partie (Anki, lecture, séries, oral à côté).

### 1.2 L'épreuve E2 (référentiel du 19 décembre 2022, sessions 2025 et suivantes)

- Coefficient 3, niveau attendu B2, deux sous-épreuves de même poids (1,5 chacune).
- **E21, écrit, 2 heures**, dictionnaire unilingue autorisé.
  - Support : un ou plusieurs documents en anglais, ancrés dans le monde de l'entreprise, 50 lignes maximum (en pratique 430 à 650 mots).
  - Partie 1 : compte rendu **en français** des idées essentielles.
  - Partie 2 : écrit **en anglais** à partir de consignes (courriel, courrier, bref rapport, instruction, analyse, document commercial, argumentation…).
  - Les deux parties ont le même poids.
- **E22, oral** : 20 min de préparation + 20 min de passage, sur un dossier avec au moins un document audio ou vidéo et un document texte ou visuel, lié à une opération de communication. Présentation puis entretien avec le jury.

Source : présentation IA-IPR, académie de Bordeaux, « BTS Communication, nouveau référentiel ».

**Périmètre de l'appli** : l'écrit E21 en entier, plus la **compréhension orale** qui conditionne l'E22 (le dossier contient toujours au moins un audio ou une vidéo, et la CO est évaluée à travers l'interaction avec le jury). La production orale reste travaillée à part (simulations humaines, cf. §11).

---

## 2. Objectifs et non-objectifs

### Objectifs

1. Reproduire fidèlement le format E21 : article pro en anglais, compte rendu en français, écrit pro en anglais.
2. Fournir une correction de type examinateur : notes sur 10 par partie, erreurs expliquées en français, niveau CECRL estimé.
3. Nourrir les sujets avec l'actualité réelle de trois domaines : **communication/marketing, IA, automobile**.
4. Suivre la progression dans le temps.
5. Entraîner la compréhension orale sur des audios au format de l'E22 (cf. §15).
6. Faire apprendre le vocabulaire rencontré en CE comme en CO, par répétition espacée intégrée (cf. §16).
7. Coûter moins de 25 € sur toute la préparation, audio compris (cible réaliste : moins de 2 € de LLM + 10 à 20 € de synthèse vocale).
8. Rester simple : l'élève doit pouvoir s'en servir sans aide.

### Non-objectifs

- Pas d'évaluation de la production orale (prise de parole) : l'appli entraîne la compréhension orale, pas l'expression.
- Pas de multi-utilisateurs, pas de gestion de comptes complexe : un compte élève, plus des comptes en lecture seule.
- Pas de self-host de modèle : aucun modèle adapté ne tourne sur du matériel perso (cf. §6.4).
- Pas de gamification (points, streaks) : la note et la courbe suffisent.

---

## 3. Fonctionnalités

### 3.1 MVP

| # | Fonctionnalité | Détail |
|---|---|---|
| F1 | Choix d'un sujet | Liste de sujets filtrable par domaine (Comm / IA / Auto). |
| F2 | Génération de sujet | Article 450-600 mots + consigne d'écrit pro en français. |
| F3 | Article collé | L'élève colle un vrai article, le modèle ne génère que titre + consigne. |
| F4 | Sujet libre | Un thème saisi, le modèle génère article + consigne. |
| F5 | Rédaction | Deux zones de texte avec compteur de mots, sauvegarde automatique. |
| F6 | Correction | Notes /10 + /10, niveau, erreurs annotées, idées oubliées, version modèle, vocabulaire, conseil prioritaire. |
| F7 | Historique | Liste des sessions corrigées + courbe des notes avec ligne des 12/20. |

### 3.2 V1.1 (dans la semaine)

| # | Fonctionnalité | Détail |
|---|---|---|
| F8 | Dictionnaire unilingue | Sélection d'un mot dans l'article (CE) ou dans la transcription révélée (CO) → définition en anglais simple, traduction cachée derrière un clic, bouton d'écoute de la prononciation, bouton « Garder ». |
| F9 | Vocabulaire | Agrégation dédupliquée (corrections + mots gardés), chaque mot gardé devient une carte de révision (cf. §16). Export CSV Anki en option. |
| F10 | Actus automatiques | Cron nocturne : récupération RSS + pré-génération de 3-4 sujets (cf. §7). |
| F11 | Mode examen | Chrono 2h optionnel, masquage des définitions (le vrai dico papier est plus lent). |

### 3.3 V1.2 (dans les deux semaines)

| # | Fonctionnalité | Détail |
|---|---|---|
| F12 | CO générée | Script d'audio au format E22 (interview, podcast, spot radio) généré à partir d'un sujet, puis synthèse vocale ElevenLabs à plusieurs voix. |
| F13 | CO sur audio réel | Upload d'un extrait authentique (pub, podcast, JT), transcription via ElevenLabs Scribe. |
| F14 | Exercice CO | Écoutes limitées, compte rendu en français, correction, puis transcription révélée et réécoute phrase par phrase. |
| F15 | Révision espacée | Session quotidienne de cartes (algorithme FSRS), alimentée automatiquement par les mots gardés en CE et CO. |

Détails : §15 (CO) et §16 (révision).

### 3.4 V1.3 (progression et grammaire)

| # | Fonctionnalité | Détail |
|---|---|---|
| F16 | Paliers | Sujets écrits en 3 paliers de difficulté, passage automatique proposé (cf. §17). |
| F17 | Grammaire | Sessions courtes adaptatives, 6 formats d'exercices, correction instantanée (cf. §18). |
| F18 | Positionnement | Test initial de 20-25 min, refait en janvier et en avril (cf. §19.1). |
| F19 | Aujourd'hui | Écran d'accueil avec la tâche du jour selon la semaine type (cf. §19.2-19.3). |
| F20 | Réécriture | Second jet de la copie après correction (cf. §19.5). |
| F21 | Bilan hebdo | Résumé du dimanche pour le suivi (cf. §19.6). |

**Priorité conseillée** : F16 (paliers) dès que possible, car sans lui les premiers sujets seront trop durs. Idéalement, intégrer au moins le palier 1 dans le MVP.

### 3.5 Plus tard

- Tableau de suivi des erreurs récurrentes par type (grammaire, vocabulaire…) sur les 10 dernières copies.
- Vue « correcteur » pour la personne qui suit les progrès : ajouter ses propres commentaires sur une copie.
- Sujets à partir de vraies annales E21 (saisie manuelle).
- Dossiers E22 complets (audio + document visuel + mise en situation) pour préparer les simulations orales, avec éventuellement de courtes vidéos générées via l'API Higgsfield (§15.6.3).

---

## 4. Parcours utilisateur

```
[Accueil / Choix]
   ├─ carte d'actu ──────────┐
   ├─ coller un article ─────┼─→ [Génération] ─→ [Rédaction] ─→ [Correction] ─→ [Résultat]
   └─ sujet libre ───────────┘        (≈10-30 s)     (≈1h-2h)       (≈30-90 s)        │
                                                                                     ↓
                                                                   [Historique] ←── enregistré
```

États à gérer :
- Un seul sujet « en cours » à la fois. S'il existe au chargement, on reprend directement sur l'écran de rédaction.
- Abandon d'un sujet : confirmation, puis suppression du brouillon.
- Échec de génération ou de correction : message clair en français, brouillon conservé, bouton pour réessayer.

---

## 5. Contraintes UX (non négociables)

1. **Correcteur orthographique du navigateur désactivé** sur la zone anglaise (`spellcheck="false"`, `lang="en"`). Le jour J, il n'y en aura pas.
2. **Pas de traduction automatique de l'article** : seulement des définitions en anglais, la traduction française est masquée par défaut (esprit du dictionnaire unilingue).
3. **Compteurs de mots** visibles en permanence sur les deux zones, avec la cible du palier courant (§17.2). Format examen : 150-200 mots pour le compte rendu, 150-200 pour l'écrit anglais.
4. **Sauvegarde automatique** du brouillon à chaque frappe (debounce 1 s). Aucune perte possible si l'onglet se ferme.
5. **Interface entièrement en français**, textes clairs, pas de jargon technique.
6. **Correction lisible** : erreurs barrées en rouge dans la copie, correction en vert juste à côté, clic sur une erreur → explication.
7. **Attentes affichées** : message explicite pendant la génération et la correction (« Correction en cours, environ une minute »).
8. **Lisibilité** : police de lecture avec empattements pour l'article, lignes de moins de 80 caractères, mode sombre, responsive jusqu'au mobile.
9. **Refus d'une correction vide** : moins de 20 mots au total → message, pas d'appel au modèle.

---

## 6. Architecture LLM

### 6.1 Principe

- Toutes les clés API **côté serveur uniquement**. Le front appelle le backend, jamais le fournisseur directement.
- Une couche d'abstraction unique `llm.call({ task, input, schema })`, avec le choix du modèle et du tier piloté par configuration (variable d'environnement ou fichier), pour pouvoir changer de modèle sans toucher au code.
- Tous les modèles envisagés exposent une API compatible OpenAI : un seul client suffit, en changeant `base_url` + `model`.
- Sorties en **JSON structuré** avec schéma (`response_format: { type: "json_schema", ... }`) quand le fournisseur le supporte. Sinon, prompt « JSON uniquement » + parsing tolérant (bloc de code, ou du premier `{` au dernier `}`).
- Validation du JSON à la réception (zod ou équivalent). Si invalide : une seule relance automatique, puis erreur affichée.

### 6.2 Routage par tâche (proposition de départ, à valider par le banc d'essai §6.5)

| Tâche | Modèle | Tier | Latence acceptable | Repli |
|---|---|---|---|---|
| Génération de sujet (cron) | GPT-5.6 Luna | Flex | minutes | standard |
| Génération de sujet (à la demande) | GPT-5.6 Luna ou DeepSeek V4.1 Flash | standard | 10-30 s | autre modèle |
| Consigne pour article collé | idem | standard | 10-20 s | autre modèle |
| Correction | à décider au banc d'essai | Flex si Luna | 30-90 s | standard après 429 ou 90 s |
| Définition de mot | le moins cher / le plus rapide | standard | < 3 s | aucun (message d'erreur) |
| Script d'audio CO (cron) | comme la génération de sujet | Flex | minutes | standard |
| Correction CO | même modèle que la correction CE | Flex si Luna | 30-90 s | standard après 429 ou 90 s |
| Audio de CO | ElevenLabs Flash v2.5 (défaut) ou Seed Audio 1.0 si retenu au test (§15.6) | — | minutes (cron) | ElevenLabs si Seed Audio échoue au contrôle WER |
| Alignement / contrôle qualité | WhisperX auto-hébergé (ou Scribe) | — | minutes (cron) | Scribe |
| Transcription d'audio réel | ElevenLabs Scribe v2 (batch) | — | < 1 min | message d'erreur |

### 6.3 Mode Flex (OpenAI)

- Activation : `service_tier: "flex"` dans la requête.
- Prix : moitié du standard (tarif Batch). Luna passe de 0,20 $ / 1,20 $ à environ 0,10 $ / 0,60 $ par million de tokens.
- Réponses plus lentes : timeout client à **15 minutes** pour le cron.
- Erreur `429 Resource Unavailable` possible, **non facturée**.
- Stratégie pour la correction : Flex → si 429 ou pas de réponse après 90 s → annuler et relancer en standard. Journaliser quel tier a servi.
- Stratégie pour le cron : Flex avec backoff exponentiel (3 tentatives), sinon on saute ce sujet.

### 6.4 Modèles évalués

Prix par million de tokens (entrée / sortie), relevés le 22/09/2026.

| Modèle | Prix | Notes |
|---|---|---|
| GLM-5.3-Flash | ~0,075-0,15 $ / 0,25-0,50 $ selon hébergeur | Le moins cher. Orienté code et agents. Poids ouverts, hébergeurs UE disponibles. |
| DeepSeek V4.1 Flash | 0,12 $ / 0,48 $ (OpenRouter) ; 0,15 $ / 0,60 $ heures creuses en direct | Mode réflexion (tokens de raisonnement facturés en sortie). API directe hébergée en Chine : passer par OpenRouter pour choisir l'hébergeur. |
| GPT-5.6 Luna | 0,20 $ / 1,20 $ ; moitié en Flex | Positionné généraliste (chat). Sorties JSON par schéma. |
| Claude Haiku 4.5 | 1 $ / 5 $ | Solide pour les définitions et la génération. |
| Claude Sonnet 5 | 2 $ / 10 $ | Référence qualité pour la correction. |
| Jev (TypeSafe) | 0,04 $ / sortie gratuite | **Écarté** : ne génère pas de texte, seulement des décisions typées. |

Self-host écarté : GLM-5.3-Flash fait 320 milliards de paramètres, DeepSeek V4.1 Flash demande environ 306 Go de mémoire GPU en 4 bits.

### 6.5 Banc d'essai (à faire avant de figer le choix de la correction)

1. Prendre 5 copies réelles (ou 5 copies rédigées volontairement avec des erreurs connues).
2. Les faire corriger par DeepSeek V4.1 Flash, GPT-5.6 Luna et Claude Sonnet 5, avec le même prompt (§8.2), 2 fois chacun.
3. Générer une page HTML de comparaison côte à côte.
4. Critères, par ordre d'importance :
   - **Justesse** : erreurs réelles détectées, pas d'erreurs inventées.
   - **Extraits exacts** : `extrait` recopié caractère pour caractère (sinon le surlignage casse). Mesurable automatiquement.
   - **Cohérence** : écart de note entre les 2 passages d'une même copie ≤ 1 point.
   - **Pédagogie** : explications en français compréhensibles pour une A2-B1.
   - Coût et latence en dernier.
5. Garder le modèle le moins cher qui passe les quatre premiers critères.

### 6.6 Coûts estimés

Hypothèse par session : génération ~500 tokens en entrée / ~1 000 en sortie ; correction ~2 200 / ~2 000 ; 10 définitions ~150 / ~80 chacune. Total ≈ 3 000 / 3 500 tokens. Environ 175 sessions jusqu'à l'examen (5 par semaine).

| Montage | Par session | Total préparation |
|---|---|---|
| GLM-5.3-Flash partout | ~0,2 ct | ~0,40 $ |
| DeepSeek V4.1 Flash partout | ~0,3 ct | ~0,50 $ |
| Luna Flex (génération + correction) + Luna standard (définitions) | ~0,3 ct | ~0,50 $ |
| Luna standard partout | ~0,5 ct | ~0,90 $ |
| Sonnet 5 (génération + correction) + Haiku 4.5 (définitions) | ~4-5 ct | ~8-9 $ |

Le poste audio s'ajoute (détail en §15.7) : environ 10 à 20 $ sur la préparation pour deux exercices de CO par semaine.

Garde-fous :
- **Plafond de dépense mensuel** configuré chez chaque fournisseur (ex. 5 $).
- Compteur de tokens par appel stocké en base (§9), pour vérifier les estimations.
- Rate limit applicatif : 30 appels LLM par heure maximum (protège contre une boucle ou un bug).

---

## 7. Actualités (F10)

### 7.1 Sources

Flux RSS en anglais, un par domaine, par exemple via la recherche Google News :

```
https://news.google.com/rss/search?q=<requête>&hl=en-GB&gl=GB&ceid=GB:en
```

Requêtes de départ (à ajuster) :
- Comm : `advertising campaign OR brand marketing OR influencer`
- IA : `artificial intelligence business OR generative AI`
- Auto : `carmaker OR electric vehicles Europe`

Compléter avec des flux spécialisés si besoin (presse marketing, presse auto, rubriques tech).

### 7.2 Traitement nocturne

1. Récupérer les 20 derniers items de chaque flux.
2. Dédupliquer (titre normalisé + URL) contre les 30 derniers jours.
3. Sélectionner 1 à 2 items par domaine, en privilégiant les sujets « business » (une étape LLM de classement rapide est possible, via le modèle le moins cher).
4. Construire un **brief factuel** court (titre + résumé RSS + source + date).
5. Générer le sujet (§8.1) en Flex, stocker avec statut `ready`.
6. Garder un stock de 6 à 10 sujets prêts, supprimer les sujets non utilisés au-delà de 14 jours.

### 7.3 Droits

- Les articles générés sont **originaux**, écrits à partir des faits du brief. Ne jamais stocker ni afficher le texte intégral d'articles tiers récupérés automatiquement.
- Le mode « article collé » (F3) est un usage personnel : le texte collé reste dans la session de l'élève, sans republication.
- Aucune citation inventée attribuée à une personne réelle (consigne explicite dans le prompt).

---

## 8. Prompts

Les prompts sont en anglais (meilleure compréhension des consignes par tous les modèles), les sorties destinées à l'élève sont en français.

### 8.1 Génération de sujet

Variables : `{task_type}` tiré au hasard parmi la liste ci-dessous, `{source_block}` selon le mode.

Types d'écrit :
- un courriel professionnel
- une note ou un bref rapport à votre responsable
- un post LinkedIn pour une marque
- un court communiqué de presse
- un argumentaire (pour ou contre) à présenter à un client

```text
The student is French, preparing the BTS Communication written English exam
(épreuve E21, target level B2 of the CEFR). The production task must be: {task_type}.
Write the task instructions IN FRENCH, as in the real exam: set a realistic
professional context (the student works in communication for a French company,
agency or brand linked to the article), say who writes to whom and why, list 2 or
3 points to include, and ask for 150 to 200 words in English.

Write an original press article in English for exam training.
{source_block}
Requirements: 450 to 600 words, 5 to 7 paragraphs, the style of a quality
newspaper or trade magazine, B2-level vocabulary with some expressions useful for
business and communication, several points of view. Never invent quotations
attributed to real named people; if you need a quote, attribute it to an unnamed
"analyst" or "marketing consultant".

Reply with only JSON:
{"title": "English headline", "article": "paragraphs separated by a blank line",
 "task": "the task instructions in French"}
```

`{source_block}` :
- Actu : `Base the article ONLY on these facts from recent news (you may add general background knowledge, but no new specific facts, figures or events): """{brief}"""`
- Sujet libre : `The topic chosen by the student: "{topic}". Use only well-established general knowledge; do not invent specific recent events or figures.`

Mode article collé : même en-tête, puis `Here is a real English article the student will work on: """{article}"""` et sortie `{"title", "task"}` uniquement.

Validation côté serveur : longueur de l'article conforme au palier (§17.2) à ±15 %, sinon une relance.

Les paramètres de palier (`{tier}`, longueurs, questions guides) sont décrits en §17.5 et s'ajoutent à ce prompt.

### 8.2 Correction

```text
You are an experienced BTS examiner in France correcting a practice paper for
épreuve E21 (English, BTS Communication, expected level B2). Be demanding but
encouraging, and write ALL comments and explanations in simple French for the
student.

ARTICLE:
"""{article}"""

PART 1 – compte rendu written in French (should give the essential ideas in about
150-200 words, no personal opinion, no word-for-word translation):
"""{cr}"""

PART 2 – task: {task}
Student's English text:
"""{pe}"""

Grade each part out of 10 (half points allowed) using BTS criteria:
part 1 = understanding and restitution of key ideas, organisation, clarity;
part 2 = task completion, coherence, range and accuracy of English, appropriate
register. An empty part gets 0.
For part 2, list up to 12 of the most useful errors. "extrait" must be copied
EXACTLY, character for character, from the student's text (keep it short: the
few words that are wrong). "correction" is the corrected wording. Classify each
"type" as one of: grammaire, vocabulaire, orthographe, registre, structure.
Give 6 to 10 vocabulary items.
Reply with only JSON matching the schema.
```

### 8.3 Définition (dictionnaire unilingue)

```text
Act as a monolingual learner's dictionary for a B1 learner of English.
Define "{word}" as it is used in this context: "{sentence}".
Reply with only JSON:
{"definition": "simple English definition, max 20 words",
 "exemple": "a new short example sentence",
 "fr": "French translation in context"}
```

Contraintes : sélection de 1 à 4 mots, 60 caractères maximum ; contexte limité à la phrase (≤ 400 caractères). Mettre en cache les définitions (clé : mot + hash de la phrase).

---

## 9. Modèle de données

Stockage simple : SQLite suffit largement (un seul compte élève, quelques centaines de lignes).

```ts
// Sujet disponible (pré-généré ou généré à la demande)
type Subject = {
  id: string;
  domain: "comm" | "ia" | "auto" | "libre";
  source: "rss" | "paste" | "topic";
  sourceRef?: string;        // URL ou thème, jamais le texte intégral d'un tiers
  title: string;
  article: string;
  task: string;              // consigne en français
  status: "ready" | "used" | "expired";
  createdAt: string;         // ISO
  llm: LlmTrace;
};

// Travail de l'élève sur un sujet
type Session = {
  id: string;
  subjectId: string;
  cr: string;                // compte rendu FR
  pe: string;                // écrit EN
  lookups: VocabItem[];      // mots gardés via le dictionnaire
  status: "draft" | "corrected" | "abandoned";
  result?: Correction;
  startedAt: string;
  correctedAt?: string;
  llm?: LlmTrace;
};

type Correction = {
  compte_rendu: { note: number; commentaire: string; idees_manquantes: string[] };
  expression: {
    note: number;
    niveau: "A2" | "B1" | "B1+" | "B2" | "C1";
    erreurs: {
      extrait: string; correction: string; explication: string;
      type: "grammaire" | "vocabulaire" | "orthographe" | "registre" | "structure";
      categorie?: string;   // pour "grammaire" : clé du programme (§18.4), ex. "present_perfect"
    }[];
    points_forts: string[];
    version_amelioree: string;
  };
  vocabulaire: VocabItem[];
  conseil: string;
};

type VocabItem = { en: string; fr: string; exemple?: string };

type LlmTrace = {
  provider: string; model: string; tier: "standard" | "flex";
  inputTokens: number; outputTokens: number; costUsd: number; latencyMs: number;
};
```

Les tables de la CO et de la révision sont décrites en §15.5 et §16.4.

Règles :
- `note` arrondie à 0,5 côté serveur, bornée entre 0 et 10.
- Les `extrait` introuvables dans `pe` sont conservés dans la liste d'erreurs mais pas surlignés (compter leur taux : c'est un indicateur de qualité du modèle).
- Un seul `Session` en `draft` à la fois.

---

## 10. API backend (indicative)

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/subjects?domain=` | Sujets `ready`. |
| POST | `/api/subjects` | Génération à la demande (`{mode: "topic" \| "paste", payload}`). |
| POST | `/api/sessions` | Démarrer une session sur un sujet. |
| PATCH | `/api/sessions/:id` | Sauvegarde du brouillon (`cr`, `pe`, `lookups`). |
| POST | `/api/sessions/:id/correct` | Lancer la correction (long : prévoir SSE ou polling). |
| GET | `/api/sessions?status=corrected` | Historique. |
| POST | `/api/define` | Définition d'un mot. |
| GET | `/api/vocab.csv` | Export Anki. |
| GET | `/api/stats` | Notes dans le temps, coûts cumulés. |
| GET | `/api/listening?domain=` | Exercices de CO prêts (§15). |
| POST | `/api/listening/upload` | Upload d'un audio réel, transcription Scribe. |
| POST | `/api/listening/:id/attempts` | Démarrer un exercice de CO. |
| PATCH | `/api/listening/attempts/:id` | Brouillon + compteur d'écoutes. |
| POST | `/api/listening/attempts/:id/correct` | Correction du compte rendu de CO. |
| GET | `/api/pronounce?word=` | Audio de prononciation (mis en cache). |
| GET | `/api/review/due` | Cartes à réviser aujourd'hui (§16). |
| POST | `/api/review/:cardId` | Enregistrer une note de révision (1-4). |
| GET | `/api/today` | Tâches du jour (§19.2). |
| GET | `/api/grammar/next` | Prochaine série de grammaire selon erreurs et programme (§18.4). |
| POST | `/api/grammar/attempts` | Envoyer les réponses d'une série. |
| POST | `/api/grammar/items/:id/flag` | Signaler un item erroné. |
| POST | `/api/placement` | Test de positionnement (§19.1). |
| POST | `/api/sessions/:id/rewrite` | Second jet de la copie (§19.5). |

Correction : la requête peut durer plus d'une minute (voire plus en Flex). Soit on la passe en tâche asynchrone avec un statut `correcting` et du polling toutes les 3 s, soit on streame via SSE. Le polling est le plus simple pour la première version.

---

## 11. Hors appli, mais dans le plan

Pour mémoire, l'appli ne fait pas tout :
- **Oral E22** (moitié de la note) : simulation hebdomadaire avec une personne qui joue le jury (dossier = une vidéo pub + une affiche ou un article, 20 min de prépa, 20 min de passage).
- **Rythme dans l'appli** : voir la semaine type (§19.3). Pas d'examen blanc avant janvier (§17.4).
- **Révision du vocabulaire** : 10-15 min par jour dans l'appli (§16). Choisir **un seul outil** de révision, l'appli ou Anki, pour ne pas réviser les mêmes mots deux fois.
- **Écoute libre et lecture** : podcasts et vidéos marketing en anglais, séries (en complément des exercices de CO, pour le volume).
- **Conversation** : une ou deux soirées par semaine en anglais à la maison.

---

## 12. Sécurité et confidentialité

- Clés API dans des variables d'environnement, jamais dans le front ni dans le dépôt.
- Accès à l'appli protégé (auth basique, ou derrière un VPN / reverse proxy avec auth).
- Copies de l'élève : préférer des hébergeurs de modèles dans l'UE quand c'est possible (routage UE sur OpenRouter ou équivalent), éviter l'API directe DeepSeek si c'est un problème pour l'hébergeur.
- Sauvegarde de la base SQLite (cron quotidien) : l'historique est précieux pour suivre la progression.
- Plafonds de dépense chez chaque fournisseur + rate limit applicatif.

---

## 13. Critères d'acceptation du MVP

- [ ] Choisir un sujet, rédiger, corriger, voir le résultat : parcours complet sans erreur.
- [ ] Fermer l'onglet en pleine rédaction puis revenir : rien n'est perdu.
- [ ] La zone anglaise n'affiche aucun soulignement orthographique.
- [ ] Les erreurs sont surlignées dans la copie pour au moins 90 % d'entre elles (extraits retrouvés).
- [ ] Une panne du fournisseur LLM affiche un message en français et conserve le brouillon.
- [ ] La correction d'une même copie, lancée deux fois, donne des notes à ±1 point.
- [ ] Le coût réel d'une session est journalisé et reste sous 1 centime (hors Sonnet).
- [ ] L'interface est utilisable sur un téléphone.

---

## 14. Plan de la première version

1. Squelette backend + SQLite + client LLM unique configurable (1h).
2. Endpoints génération à la demande + correction (1h), en reprenant les prompts du §8.
3. Front : choix, rédaction avec autosave, résultat annoté (1h30). Le prototype `redac-b2.html` peut servir de base pour le HTML/CSS et la logique d'annotation (`annotate()`).
4. Test du parcours complet avec un modèle par défaut (DeepSeek V4.1 Flash via OpenRouter ou Luna).

Reporter à plus tard : cron RSS, Flex, dictionnaire, export Anki, banc d'essai.

---

## 15. Module compréhension orale (CO)

### 15.1 Pourquoi

- L'E22 repose sur un dossier avec au moins un document audio ou vidéo : si l'audio est mal compris pendant les 20 minutes de préparation, toute la présentation en pâtit.
- La CO est souvent la compétence la plus lente à progresser au niveau A2 : il faut la travailler tôt et régulièrement.
- Rythme cible : **2 exercices de CO par semaine**, en plus des sujets écrits.

### 15.2 Deux sources d'audio

**A. Audio généré (F12)**, pour la régularité et la progressivité :
1. Le LLM écrit un script à partir d'un sujet d'actu (même pipeline que §7), dans un des formats de l'E22 : interview à deux voix, extrait de podcast, débat court, spot radio, bulletin d'info.
2. Génération audio : ElevenLabs (un segment par réplique, une voix par locuteur) ou Seed Audio 1.0 (scène complète avec ambiance, par morceaux de 120 s max), puis concaténation (ffmpeg) en un seul MP3. Choix du moteur et contraintes : §15.6.
3. Varier les accents d'un exercice à l'autre (britannique, américain, autres accents anglophones), avec une liste de 6 à 8 voix choisies dans la bibliothèque.

**B. Audio réel (F13)**, pour s'habituer à l'authentique :
1. Upload d'un extrait de 1 à 4 minutes (pub, podcast, JT, vidéo de marque) trouvé par l'élève ou par la personne qui suit les progrès.
2. Transcription via ElevenLabs Scribe v2, avec horodatages.
3. Le LLM produit ensuite un titre et une mise en situation.

Limite à garder en tête : une voix de synthèse est trop propre (pas de bruit de fond, pas d'hésitations, pas de chevauchements). Alterner A et B, avec une part croissante de B au fil des mois (par exemple 1 sur 4 au début, 1 sur 2 à partir de février).

### 15.3 Progression de difficulté

| Période | Débit | Vocabulaire | Durée | Format |
|---|---|---|---|---|
| Sept.-déc. | lent (consigne dans le prompt + vitesse 0,85x dispo) | B1 | 1 min 30-2 min | monologue, interview simple |
| Janv.-mars | naturel | B1+/B2 | 2-3 min | interview, podcast à deux |
| Avr.-examen | naturel, accents variés | B2 | 2-4 min | débat, extraits réels majoritaires |

Le niveau est un paramètre du prompt (`{level}`) et de la génération audio, pas un choix de l'élève.

### 15.4 Déroulé de l'exercice (F14)

1. **Mise en situation** affichée en français (qui parle, contexte professionnel), comme dans un dossier d'E22.
2. **Écoutes** : 3 maximum, compteur visible, transcription **masquée**. Zone de prise de notes libre à côté du lecteur. Vitesse 0,85x disponible jusqu'en décembre, puis masquée (paramètre).
3. **Compte rendu en français** (80 à 150 mots) de ce qui a été compris.
4. **Correction** par le LLM, qui compare au script : note /10, idées bien comprises, idées manquées, contresens expliqués.
5. **Révélation** de la transcription, découpée en phrases cliquables : clic sur une phrase = réécoute de ce passage.
6. **Définitions** : sélection de mots sur la transcription révélée, même comportement que F8, avec prononciation. **Jamais avant la fin des écoutes**, sinon l'élève lit au lieu d'écouter.

Contraintes UX spécifiques :
- Pas de transcription, de sous-titres ni de définitions tant que le compte rendu n'est pas envoyé.
- Le nombre d'écoutes utilisées est enregistré (moins d'écoutes nécessaires avec le temps = progrès visible).
- Lecteur accessible au clavier (espace = lecture/pause, flèche gauche = -5 s).

### 15.5 Données

```ts
type Listening = {
  id: string;
  domain: "comm" | "ia" | "auto" | "libre";
  source: "generated" | "upload";
  format: "interview" | "podcast" | "debate" | "radio_ad" | "news";
  level: "B1" | "B1+" | "B2";
  title: string;
  context: string;              // mise en situation en français
  script: Segment[];            // généré ou transcrit
  audioPath: string;            // MP3 sur disque
  durationSec: number;
  voices?: string[];            // ids de voix ElevenLabs
  status: "ready" | "used" | "expired";
  createdAt: string;
  llm?: LlmTrace;
  tts?: {
    provider: "elevenlabs" | "seed-audio";
    via?: string;               // fournisseur pour Seed Audio : "byteplus" | "venice" | "aimlapi"...
    model: string;
    characters?: number;        // ElevenLabs
    seconds?: number;           // Seed Audio
    costUsd: number;
    wer?: number;               // contrôle qualité vs script (Seed Audio)
    attempts: number;           // nombre de générations avant acceptation
  };
};

type Segment = { speaker: string; text: string; startMs: number; endMs: number };

type ListeningAttempt = {
  id: string;
  listeningId: string;
  plays: number;
  notes: string;                // prise de notes libre
  summary: string;              // compte rendu FR
  lookups: VocabItem[];
  status: "draft" | "corrected";
  result?: {
    note: number;               // /10
    comprises: string[];
    manquees: string[];
    contresens: { idee: string; explication: string }[];
    conseil: string;
  };
  startedAt: string;
  correctedAt?: string;
};
```

Horodatages : avec ElevenLabs, calculés à la concaténation (durée de chaque segment) ; avec Seed Audio, issus de l'alignement WhisperX/Scribe ; pour l'audio réel, fournis par Scribe.

### 15.6 Fournisseurs audio (vérifié le 22/09/2026)

Deux moteurs candidats pour l'audio généré, à départager par un test d'écoute (§15.6.4). ElevenLabs reste la solution de référence tant que le test n'est pas fait.

#### 15.6.1 ElevenLabs (référence)

- Synthèse vocale **mot pour mot**, segment par segment : la transcription est exactement le script, et les horodatages se déduisent de la concaténation.
- Tarifs API : 0,10 $ / 1 000 caractères en Multilingual v2/v3, 0,05 $ en Flash/Turbo (~1 000 caractères = 1 minute d'audio).
- Scribe v2 (transcription) : 0,22 $ par heure d'audio. **Nécessaire dans tous les cas** pour les audios réels (F13).
- Limite : voix « trop propres », sans ambiance sonore.

#### 15.6.2 ByteDance Seed Audio 1.0 (alternative à tester)

Modèle sorti le 29 juin 2026. Génère une scène audio complète à partir d'un prompt : dialogue à plusieurs voix, bruitages, ambiance. Intérêt pédagogique : des audios plus proches des documents authentiques de l'E22.

Où y accéder :

| Fournisseur | Prix | Remarques |
|---|---|---|
| BytePlus (officiel ByteDance) | 0,15 $ / minute générée | **60 minutes d'essai gratuites** : à utiliser pour le test. |
| Venice | affiché 0 $ / seconde | Zéro rétention des données. À vérifier : accès API, quotas, abonnement requis. |
| AIMLAPI | 0,00325 $ / seconde (~0,20 $/min) | API compatible OpenAI. |
| Atlas Cloud, RunComfy, WaveSpeed, autres | 0,002 à 0,00325 $ / seconde selon le revendeur | ~60 % d'écart de prix entre revendeurs. WaveSpeed facture à la génération (à partir de 0,30 $). |

Caractéristiques utiles : jusqu'à 3 extraits audio de référence (clonage de voix) ou 1 image de référence, formats mp3/wav/pcm/ogg_opus, taux d'échantillonnage configurable. Sur le contrôle, le timing des dialogues est l'aspect le plus abouti ; le contrôle fin des effets, de l'ambiance et de la musique est encore annoncé comme à venir.

**Contraintes à gérer dans le pipeline :**

1. **120 secondes maximum par requête.** Découper les scripts de plus de 2 minutes en 2 ou 3 morceaux, puis concaténer avec ffmpeg.
2. **Cohérence des voix entre morceaux.** Générer d'abord un court extrait (5-10 s) par locuteur, le stocker, puis le passer en audio de référence (`@audio1`, `@audio2`…) à chaque morceau. Réutiliser ces références d'un exercice à l'autre pour constituer une « banque de voix » stable.
3. **Fidélité au script (critique).** Le modèle compose une scène et peut reformuler ou improviser. Or la correction de CO et la réécoute phrase par phrase exigent que l'audio corresponde exactement au script.
4. **Pas d'horodatages en sortie.** Il faut aligner l'audio après coup.

**Contrôle qualité automatique (obligatoire avec Seed Audio) :**

1. Transcrire l'audio généré avec **WhisperX** (open source, auto-hébergé, gratuit, suffisant sur CPU pour des extraits de 2-3 min) ou Scribe (quelques centimes).
2. Comparer la transcription au script : taux d'erreur sur les mots (WER).
3. Si WER ≤ 5 % : accepter, et utiliser les horodatages de l'alignement pour les `Segment`.
4. Si WER > 5 % : régénérer une fois ; en cas de nouvel échec, basculer sur ElevenLabs pour cet exercice.
5. Journaliser le WER et le taux de rejet : c'est l'indicateur qui décide si Seed Audio reste dans le pipeline.

#### 15.6.3 Higgsfield (écarté pour l'audio)

- L'API développeur (pay-per-generation, prix publics par modèle) n'expose **pas de modèle audio** à ce jour : vérifié dans le catalogue de la console. Les fonctions audio (synthèse vocale, Seed Audio, changement de voix) ne sont disponibles que dans l'interface web.
- Seul audio accessible via l'API : le son généré **dans les vidéos** (option `generate_audio` de Seedance, Kling…).
- **Piste conservée pour plus tard** : génération de courtes vidéos (faux spots, mini-reportages) pour les dossiers E22 (§3.4). Ordre de grandeur : quelques centimes par seconde selon le modèle, soit moins d'un euro pour un spot de 20 s.

#### 15.6.4 Test de départage

1. Écrire 5 scripts réels (formats variés : interview, podcast, spot radio).
2. Les générer avec ElevenLabs (Flash) et avec Seed Audio via l'essai BytePlus.
3. Mesurer le WER de Seed Audio (§15.6.2).
4. Faire écouter les paires à l'élève sans dire lequel est lequel : lequel ressemble le plus à un vrai document ? lequel est le plus compréhensible à son niveau ?
5. Décision : Seed Audio si WER acceptable **et** préféré à l'écoute ; sinon ElevenLabs. Si Seed Audio gagne, basculer ensuite vers le fournisseur le moins cher (Venice si l'accès API gratuit se confirme, sinon le revendeur le moins cher).

### 15.7 Coûts audio

Base : ~60 exercices de 2-3 min, soit ~150 minutes d'audio sur la préparation.

| Montage | Coût estimé |
|---|---|
| ElevenLabs Flash | ~9 $ |
| ElevenLabs Multilingual | ~18 $ |
| Seed Audio via BytePlus (0,15 $/min, 60 min offertes) | ~13 $ |
| Seed Audio via revendeur à 0,002 $/s | ~18 $ |
| Seed Audio via Venice (si gratuit confirmé en API) | ~0 $ |
| Transcription Scribe des audios réels (~20 extraits de 3 min) | < 0,30 $ |
| Alignement WhisperX auto-hébergé | 0 $ |
| Prononciation des mots (en cache, ElevenLabs Flash) | négligeable |
| Script + correction CO (LLM) | < 0,30 $ |

Option ElevenLabs : l'abonnement Starter (6 $/mois) inclut 120 000 caractères Flash, soit une quarantaine d'audios par mois.

Garde-fous : plafond mensuel chez chaque fournisseur, 4 000 caractères maximum par script (validation serveur), génération uniquement par le cron ou sur action explicite.

### 15.8 Prompts

**Script d'audio**

```text
Write a script for an English listening exercise (BTS Communication, French
student, target level {level}). Format: {format}. Duration: about {minutes}
minutes when spoken (roughly {chars} characters). Base it ONLY on these facts:
"""{brief}"""
Use {n_speakers} speakers with distinct roles (e.g. host and guest). Natural
spoken English: contractions, discourse markers, a few rephrasings. {pace_rule}
Never invent quotations attributed to real named people.
Also write, IN FRENCH, a short professional context (2-3 sentences) placing the
student in a communication job linked to this audio.
Reply with only JSON:
{"title": "...", "context": "...",
 "segments": [{"speaker": "A", "role": "host", "text": "..."}]}
```

`{pace_rule}` en début d'année : `Keep sentences short and vocabulary at B1 level; avoid idioms.` En fin d'année : `Use natural pace and B2 vocabulary, including some idioms and business expressions.`

**Correction du compte rendu de CO**

```text
You are a BTS examiner. A French student (level A2-B1, target B2) listened to an
English audio {plays} time(s) and wrote a summary IN FRENCH. Compare it with the
transcript. Write all feedback in simple French.

TRANSCRIPT:
"""{transcript}"""

STUDENT SUMMARY:
"""{summary}"""

Grade out of 10 (half points allowed) on: main ideas understood, key details,
absence of misunderstandings. Reply with only JSON:
{"note": 0, "comprises": ["..."], "manquees": ["..."],
 "contresens": [{"idee": "what she wrote", "explication": "what was actually said"}],
 "conseil": "one priority piece of advice, 1-2 sentences"}
```

### 15.9 Critères d'acceptation

- [ ] Un exercice généré se joue en entier, avec au moins deux voix distinctes.
- [ ] Avec Seed Audio : tout audio accepté a un WER ≤ 5 % par rapport au script, et les rejets basculent sur ElevenLabs sans intervention.
- [ ] Les voix restent identiques d'un morceau à l'autre dans un même exercice.
- [ ] Transcription et définitions sont inaccessibles avant l'envoi du compte rendu.
- [ ] Le compteur bloque au-delà de 3 écoutes et le nombre est enregistré.
- [ ] Un clic sur une phrase de la transcription relance l'audio à ce passage (décalage < 1 s).
- [ ] Un audio réel de 3 minutes est transcrit et jouable en moins de 2 minutes.

---

## 16. Révision du vocabulaire (répétition espacée)

### 16.1 Principe

- Chaque mot gardé (bouton « Garder » en CE ou en CO) et chaque item de vocabulaire proposé par une correction devient **automatiquement une carte**, sans manipulation.
- La carte garde **la phrase d'origine** où le mot a été rencontré : c'est ce qui aide le plus à mémoriser.
- Révision dans l'appli, une session par jour de 10 à 15 minutes, signalée dès l'accueil (« 18 cartes à revoir »).
- Algorithme **FSRS** via la bibliothèque `ts-fsrs` (le même algorithme qu'Anki).
- Un seul outil de révision : si l'appli est adoptée, abandonner Anki pour ce vocabulaire (l'export CSV reste disponible en secours).

### 16.2 Carte

- **Recto** : le mot ou l'expression, la phrase d'origine avec le mot en gras, bouton de prononciation.
- **Verso** : définition en anglais simple, exemple, puis traduction française, et la source (titre du sujet ou de l'audio).
- **Boutons** : À revoir / Difficile / Correct / Facile (notes 1 à 4 de FSRS).

Plus tard : carte inversée (définition en anglais → retrouver le mot) pour les mots déjà solides dans le sens normal.

### 16.3 Règles

- Déduplication par forme normalisée (minuscules, sans ponctuation). Si le mot existe déjà, la nouvelle phrase s'ajoute aux contextes au lieu de créer un doublon.
- Maximum **15 nouvelles cartes par jour** (le reste attend) et 100 révisions par jour, pour éviter l'avalanche après une semaine chargée.
- Les items proposés par une correction (6 à 10 par copie) s'ajoutent avec une case « Ajouter à mes révisions » cochée par défaut, que l'élève peut décocher.
- Possibilité de suspendre une carte (« Je connais déjà »).

### 16.4 Données

```ts
type Card = {
  id: string;
  term: string;                    // forme affichée
  termKey: string;                 // forme normalisée, unique
  definition: string;              // anglais simple
  example?: string;
  fr: string;
  contexts: { sentence: string; sourceType: "reading" | "listening"; sourceId: string }[];
  audioPath?: string;              // prononciation en cache
  fsrs: {                          // état ts-fsrs sérialisé
    due: string; stability: number; difficulty: number;
    elapsed_days: number; scheduled_days: number;
    reps: number; lapses: number; state: number; last_review?: string;
  };
  suspended: boolean;
  createdAt: string;
};

type ReviewLog = { id: string; cardId: string; rating: 1 | 2 | 3 | 4; reviewedAt: string; elapsedMs: number };
```

### 16.5 Statistiques utiles

- Nombre de mots « acquis » (stabilité FSRS supérieure à 21 jours), affiché à côté de la courbe des notes.
- Taux de réussite des révisions sur 7 jours (cible : 85 à 90 %).
- Nombre de jours de révision d'affilée, affiché discrètement.

### 16.6 Critères d'acceptation

- [ ] Un mot gardé en CE ou en CO apparaît dans les révisions du lendemain sans action supplémentaire.
- [ ] Un mot déjà présent n'est pas dupliqué, sa nouvelle phrase s'ajoute aux contextes.
- [ ] La session du jour respecte les limites de 15 nouvelles cartes et 100 révisions.
- [ ] La prononciation se joue depuis le recto de la carte.
- [ ] L'état FSRS survit à un redémarrage du serveur et à une restauration de sauvegarde.

---

## 17. Progression par paliers (sujets écrits)

### 17.1 Pourquoi

Au niveau A2, le format complet de l'examen (600 mots, 2 × 150-200 mots) est trop difficile d'emblée : incompréhension, notes basses pendant des semaines, découragement. Les sujets écrits montent donc en difficulté par paliers, jusqu'au format réel.

### 17.2 Les trois paliers

| | Palier 1 | Palier 2 | Palier 3 (format examen) |
|---|---|---|---|
| Période indicative | sept.-nov. | déc.-févr. | à partir de mars |
| Texte | 200-250 mots, vocabulaire B1 simple, 3-4 paragraphes | 350-450 mots, B1+/B2 | 450-600 mots, B2 |
| Compte rendu FR | **guidé** : 3-4 questions en français, réponses courtes | libre, ~100 mots | libre, 150-200 mots |
| Écrit EN | 60-80 mots, types simples (courriel court, message) | 100-120 mots | 150-200 mots, les 5 types |
| Aides | liste de 5-6 mots clés du texte avec définition en anglais, modèle de structure pour l'écrit | modèle de structure disponible sur demande | aucune |
| Barème | /10 + /10, grille adaptée au palier | idem | grille BTS |

### 17.3 Règles de passage

- Passage au palier supérieur proposé quand la note est **≥ 12/20 sur 3 sujets consécutifs** du palier.
- Proposition, pas obligation : l'élève peut rester au palier actuel.
- Retour au palier inférieur proposé après 3 notes consécutives < 8/20.
- Le palier courant est stocké dans le profil (§19.4) et passé en paramètre aux prompts.

### 17.4 Examens blancs

- **Aucun avant janvier.**
- Janvier-mars : 1 examen blanc par mois, format palier 3 intégral, chrono 2 h, sans définitions.
- Avril-examen : 1 toutes les 2 semaines.
- Les examens blancs sont marqués comme tels dans l'historique et la courbe (point distinct).

### 17.5 Adaptation des prompts (§8.1 et §8.2)

Paramètres ajoutés : `{tier}`, `{article_words}`, `{task_words}`, `{cr_mode}`.

Ajout au prompt de génération :

```text
Difficulty tier {tier}/3. Article length: {article_words} words.
Tier 1: short sentences, common vocabulary (B1), no idioms, 3-4 paragraphs.
Also return "guide_questions": 3-4 questions IN FRENCH that guide a summary of
the key ideas, and "keywords": 5-6 key words with a simple English definition.
Tier 2: B1+/B2 vocabulary, a few business expressions.
Tier 3: exam format, B2.
The writing task asks for {task_words} words.
```

Ajout au prompt de correction :

```text
The student is at tier {tier}/3 (1 = guided, 3 = real exam). Grade against what
is expected at this tier, not against the final exam, and say in the comment
what would be needed to reach the next tier.
```

---

## 18. Module grammaire et conjugaison

### 18.1 Principe

- Sessions courtes : **10 à 15 minutes**, un point de grammaire par session, 10 à 15 items.
- **Adaptatif** : les points travaillés viennent en priorité des erreurs réelles de l'élève (types et catégories relevés par les corrections CE/CO), puis du programme de base.
- **Correction déterministe** quand c'est possible (réponses attendues stockées) : pas d'appel LLM, instantané, gratuit, fiable. LLM uniquement pour les réponses ouvertes.

### 18.2 Formats d'exercices

| Format | Exemple | Correction |
|---|---|---|
| Phrase à trous (verbe à conjuguer) | « She ___ (work) here since 2022. » | déterministe, plusieurs réponses acceptées |
| Repérage d'erreur | « He don't like the new logo. » → trouver et corriger | déterministe (position + correction) |
| Transformation | voix passive, discours indirect, conditionnel | déterministe avec variantes, sinon LLM |
| Traduction FR → EN | « Nous avons lancé la campagne la semaine dernière. » | LLM (plusieurs réponses valides) |
| Remise en ordre | mots mélangés → phrase correcte | déterministe |
| QCM | choix entre 3-4 formes | déterministe |

Toutes les phrases sont ancrées dans le **monde professionnel de la communication** (campagnes, clients, réseaux sociaux, événements).

Chaque réponse fausse affiche immédiatement la bonne réponse et une explication courte en français (générée avec la série, stockée).

### 18.3 Programme de base (A2 → B2)

| Période | Points |
|---|---|
| Sept.-oct. | présent simple / continu, prétérit, **prétérit vs present perfect**, verbes irréguliers, questions, articles |
| Nov.-déc. | futurs (will, going to, présent continu), modaux (can, must, should, have to), comparatifs et superlatifs, prépositions de temps et de lieu |
| Janv.-févr. | present perfect continu, plus-que-parfait, conditionnels (0, 1, 2), voix passive, relatives |
| Mars-avr. | conditionnel 3, discours indirect, gérondif vs infinitif, connecteurs logiques, expressions de l'opinion et de la nuance |
| Mai | révisions ciblées sur les erreurs récurrentes |

### 18.4 Sélection des points (algorithme simple)

1. Compter les erreurs par catégorie sur les 5 dernières corrections (CE + CO + traductions).
2. Si une catégorie dépasse 3 occurrences : session sur cette catégorie.
3. Sinon : point suivant du programme de la période.
4. Un point est « maîtrisé » à ≥ 85 % de réussite sur 2 sessions espacées d'au moins 3 jours ; il repasse en révision 3 semaines plus tard.

Pour que ça marche, le prompt de correction (§8.2) renvoie en plus une **catégorie grammaticale** fine pour chaque erreur de type `grammaire` (ex. `present_perfect`, `articles`, `prepositions`, `passive`, `conditionals`), prise dans la liste fermée du programme.

### 18.5 Verbes irréguliers

- Les ~100 verbes irréguliers les plus courants sont ajoutés comme cartes dans la révision espacée (§16), par lots de 10 par semaine.
- Recto : base verbale + phrase d'exemple ; verso : prétérit, participe passé, traduction.

### 18.6 Génération des séries

- Générées à l'avance par le cron (Flex), 3 séries par point du programme, puis à la demande pour les points issus des erreurs.
- Validation serveur : chaque item a une réponse attendue non vide, pas de doublon dans la série.
- Contrôle qualité : l'appli propose un bouton « Cette correction me semble fausse » ; l'item signalé est retiré et journalisé.

```text
Create a grammar practice set for a French learner of English (level {level},
BTS Communication). Grammar point: {point}. {n} items, formats: {formats}.
All sentences must relate to professional communication (campaigns, clients,
social media, events, press). For each item give the prompt, all accepted
answers, and a short explanation IN FRENCH of the rule.
Reply with only JSON:
{"point": "...", "items": [{"format": "gap", "prompt": "...",
  "accepted": ["..."], "explanation": "..."}]}
```

### 18.7 Données

```ts
type GrammarSet = {
  id: string;
  point: string;                     // clé du programme, ex. "present_perfect"
  level: "A2" | "B1" | "B1+" | "B2";
  items: GrammarItem[];
  createdAt: string;
  llm?: LlmTrace;
};

type GrammarItem = {
  id: string;
  format: "gap" | "error_spot" | "transform" | "translate" | "reorder" | "mcq";
  prompt: string;
  options?: string[];                // QCM, remise en ordre
  accepted: string[];                // réponses acceptées (vide pour "translate")
  explanation: string;               // FR
  flagged?: boolean;
};

type GrammarAttempt = {
  id: string;
  setId: string;
  answers: { itemId: string; answer: string; correct: boolean; feedback?: string }[];
  score: number;                     // % de réussite
  startedAt: string;
  finishedAt?: string;
};

type GrammarMastery = { point: string; lastScores: number[]; masteredAt?: string; nextReviewAt?: string };
```

Comparaison des réponses : normalisation (minuscules, espaces, apostrophes typographiques, contractions `don't` = `do not`).

### 18.8 Critères d'acceptation

- [ ] Une session de 12 items se fait en moins de 15 minutes, correction instantanée à chaque item (hors traductions).
- [ ] Une catégorie d'erreur relevée 4 fois dans les dernières copies déclenche une session dédiée.
- [ ] Les contractions et apostrophes typographiques ne provoquent pas de faux négatifs.
- [ ] Un item signalé n'est plus jamais proposé.

---

## 19. Parcours du jour et suivi

### 19.1 Test de positionnement

- Au premier lancement : 20-25 minutes, pour calibrer le palier et les priorités de grammaire.
- Contenu : 20 items de grammaire couvrant le programme, un texte court de palier 1 avec 4 questions, un écrit de 60 mots, un audio court avec 3 questions.
- Sortie : palier de départ, liste des 3 points de grammaire prioritaires, niveau estimé par compétence.
- À refaire en janvier et en avril pour mesurer la progression.

### 19.2 Écran « Aujourd'hui »

Page d'accueil qui supprime la question « qu'est-ce que je fais aujourd'hui ? » :
- les cartes à réviser (nombre, durée estimée) ;
- la tâche principale du jour selon le planning de la semaine (§19.3) ;
- un raccourci pour reprendre un travail en cours.

Un clic lance la tâche. Le reste de l'appli (choix libre d'un sujet, historique…) reste accessible à côté.

### 19.3 Semaine type

| Jour | Tâche principale (30-45 min) | + chaque jour |
|---|---|---|
| Lundi | Sujet écrit (palier courant) | révision vocabulaire 10-15 min |
| Mardi | Grammaire + écoute (CO) | idem |
| Mercredi | Grammaire + réécriture de la dernière copie | idem |
| Jeudi | Sujet écrit | idem |
| Vendredi | Écoute (CO) | idem |
| Samedi | Grammaire ou sujet écrit au choix | idem |
| Dimanche | Repos (révision vocabulaire seule, optionnelle) | — |

À partir de janvier, un samedi par mois devient **examen blanc** (§17.4). Le planning est une configuration modifiable, pas une contrainte.

### 19.4 Profil de progression

```ts
type Profile = {
  tier: 1 | 2 | 3;
  tierHistory: { tier: number; from: string }[];
  placement: { date: string; tier: number; priorities: string[]; levels: Record<string, string> }[];
  weekPlan: Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", string[]>;
};
```

### 19.5 Réécriture (« second jet »)

- Après chaque correction de sujet écrit, bouton **« Réécrire ma copie »** : l'élève reprend son texte en anglais et corrige seul les erreurs signalées, sans voir la version modèle.
- Correction rapide par le LLM : erreurs corrigées, erreurs restantes, nouvelles erreurs éventuelles. Pas de nouvelle note, seulement un taux d'erreurs corrigées.
- Pédagogiquement, corriger soi-même ses erreurs ancre beaucoup mieux que lire une correction.

### 19.6 Bilan hebdomadaire (pour le suivi)

- Chaque dimanche soir, un court résumé (e-mail ou notification) : tâches faites, notes, erreurs récurrentes, points de grammaire en difficulté, mots acquis.
- Objectif : savoir quoi travailler dans la simulation d'oral de la semaine, sans avoir à ouvrir l'appli.

---

## 20. Autres idées (à évaluer, non planifiées)

- **Oral enregistré léger** : après un sujet ou une écoute, l'élève présente le document en 1 minute à voix haute ; l'enregistrement est transcrit (WhisperX) et le LLM commente grammaire, vocabulaire et structure (pas la prononciation). Préparation de la présentation de l'E22, en complément des simulations orales.
- **PWA / hors ligne** pour la révision du vocabulaire et la grammaire dans les transports.
- **Boîte à outils de l'écrit** : fiches de formules (ouverture et clôture de courriel, connecteurs, expression de l'opinion) avec exercices de réemploi.

Garder en tête le risque de dispersion : chaque nouveau module doit être utilisé régulièrement pour justifier son développement. Prioriser après 3-4 semaines d'usage réel.
