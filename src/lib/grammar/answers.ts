// Comparaison déterministe des réponses de grammaire (§18.7) : pas de LLM, instantané.

const APOSTROPHES = /[‘’‛ʼ′`´]/g;
const QUOTES = /[“”„«»"]/g;
const DASHES = /[‐-―−]/g;
const SPACES = /[   \s]+/g;
// Ponctuation suivie d'une espace ou en fin de réponse ("3.5" reste intact).
const PUNCTUATION = /[.,!?;:…]+(?=\s|$)/g;

// Hôtes pour lesquels 's est une contraction (is / has) et non un possessif.
const S_HOSTS = new Set(["he", "she", "it", "that", "there", "what", "who", "where", "here", "how", "when", "everything", "everyone", "nobody"]);
const MAX_VARIANTS = 32;

export function normalizeAnswer(raw: string): string {
  return raw
    .normalize("NFC")
    .toLowerCase()
    .replace(APOSTROPHES, "'")
    .replace(QUOTES, "")
    .replace(DASHES, "-")
    .replace(SPACES, " ")
    .replace(PUNCTUATION, "")
    .replace(SPACES, " ")
    .trim()
    .replace(/\bwon't\b/g, "will not")
    .replace(/\bcan't\b/g, "cannot")
    .replace(/\bshan't\b/g, "shall not")
    .replace(/\b(\w+)n't\b/g, "$1 not")
    .replace(/\b(\w+)'m\b/g, "$1 am")
    .replace(/\b(\w+)'re\b/g, "$1 are")
    .replace(/\b(\w+)'ve\b/g, "$1 have")
    .replace(/\b(\w+)'ll\b/g, "$1 will")
    .replace(/\blet's\b/g, "let us")
    .replace(/\bcan not\b/g, "cannot");
}

function tokenOptions(token: string): string[] {
  const s = token.match(/^(\w+)'s$/);
  if (s && S_HOSTS.has(s[1])) return [`${s[1]} is`, `${s[1]} has`];
  const d = token.match(/^(\w+)'d$/);
  if (d) return [`${d[1]} would`, `${d[1]} had`];
  return [token];
}

export function answerVariants(raw: string): string[] {
  const normalized = normalizeAnswer(raw);
  if (!normalized) return [];
  let variants = [""];
  for (const token of normalized.split(" ")) {
    const options = tokenOptions(token);
    variants = variants.flatMap((v) => options.map((o) => (v ? `${v} ${o}` : o))).slice(0, MAX_VARIANTS);
  }
  return variants;
}

export function matchesAccepted(answer: string, accepted: string[]): boolean {
  const mine = new Set(answerVariants(answer));
  if (mine.size === 0) return false;
  return accepted.some((a) => answerVariants(a).some((v) => mine.has(v)));
}
