import { GALLERY, type GalleryItem } from "./gallery";

// Pure, measured matcher: scores finished designs against a plain-English business description.
const STOP = new Set(
  "a an and the for of to in on with my our we i is are that this it be by at or from who what want look feel like very more sell shop business company small".split(
    " ",
  ),
);
const SYN: Record<string, string[]> = {
  tattoo: ["tattoo", "piercing", "ink"],
  doctor: ["clinic", "medical", "dental", "care"],
  dentist: ["dental", "clinic"],
  restaurant: ["restaurant", "dining", "bar", "cafe", "food"],
  cafe: ["cafe", "coffee", "restaurant", "bar"],
  coffee: ["cafe", "coffee", "restaurant", "bar"],
  lawyer: ["legal", "law", "professional", "services"],
  attorney: ["legal", "law", "professional"],
  law: ["legal", "professional"],
  app: ["software", "app", "product", "technology"],
  software: ["software", "technology", "app"],
  saas: ["software", "technology"],
  band: ["musician", "music", "venue"],
  music: ["musician", "music", "record"],
  hotel: ["hotel", "hospitality"],
  kid: ["child", "children", "family", "toy"],
  toy: ["toy", "child", "children"],
  wedding: ["wedding", "event", "events"],
  gym: ["fitness", "gym", "strength", "coach"],
  salon: ["salon", "beauty", "spa"],
  bakery: ["bakery", "food", "cafe"],
  shop: ["shop", "store", "retail"],
  store: ["store", "shop", "retail"],
  goth: ["goth", "gothic", "dark", "tattoo"],
};
const stem = (w: string) => w.replace(/(ies)$/, "y").replace(/(es|s)$/, "");
export function words(text: string): string[] {
  return [...new Set(text.toLowerCase().match(/[a-z]+/g) ?? [])]
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map(stem);
}
export type Match = { item: GalleryItem; score: number; because: string[] };
export function matchDirections(brief: string, pool: GalleryItem[] = GALLERY, limit = 3): Match[] {
  // Each word the owner typed counts once; known business types count double.
  const groups = words(brief).map((w) => ({
    w,
    all: [w, ...(SYN[w] ?? []).map(stem)],
    weight: SYN[w] ? 2 : 1,
  }));
  if (!groups.length) return [];
  return pool
    .map((item) => {
      const best = new Set(words(item.bestFor ?? item.brief));
      const mood = new Set(
        words(`${item.direction.name} ${item.direction.mood} ${item.inspiration}`),
      );
      const because: string[] = [];
      const score = groups.reduce((n, g) => {
        const inBest = g.all.filter((x) => best.has(x));
        const inMood = g.all.filter((x) => mood.has(x));
        because.push(...inBest, ...inMood);
        return n + g.weight * (inBest.length ? 3 : inMood.length ? 1 : 0);
      }, 0);
      return { item, score, because: [...new Set(because)] };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || a.item.direction.name.localeCompare(b.item.direction.name))
    .filter((m, _i, all) => m.score * 2 > (all[0]?.score ?? 0)) // drop weak, off-topic matches
    .slice(0, limit);
}
