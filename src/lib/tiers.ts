export type Tier = 1 | 2 | 3;
type Range = readonly [number, number];

export type TierConfig = {
  label: string;
  articleWords: Range;
  paragraphs: string;
  vocab: string;
  crWords: Range | null; // null = compte rendu guidé par questions
  peWords: Range;
  taskTypes: readonly string[];
};

export const ALL_TASK_TYPES = [
  "un courriel professionnel",
  "une note ou un bref rapport à votre responsable",
  "un post LinkedIn pour une marque",
  "un court communiqué de presse",
  "un argumentaire (pour ou contre) à présenter à un client",
] as const;

export const TIERS: Record<Tier, TierConfig> = {
  1: {
    label: "Palier 1 · guidé",
    articleWords: [200, 250],
    paragraphs: "3 to 4",
    vocab: "simple B1, short sentences, no idioms",
    crWords: null,
    peWords: [60, 80],
    taskTypes: ["un courriel professionnel court", "un message court à un collègue ou à un client"],
  },
  2: {
    label: "Palier 2",
    articleWords: [350, 450],
    paragraphs: "4 to 6",
    vocab: "B1+/B2 with a few business expressions",
    crWords: [80, 120],
    peWords: [100, 120],
    taskTypes: ALL_TASK_TYPES,
  },
  3: {
    label: "Palier 3 · format examen",
    articleWords: [450, 600],
    paragraphs: "5 to 7",
    vocab: "B2 with some expressions useful for business and communication",
    crWords: [150, 200],
    peWords: [150, 200],
    taskTypes: ALL_TASK_TYPES,
  },
};
