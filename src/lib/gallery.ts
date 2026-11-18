import { normalizeTokens, type Content, type Direction } from "./design";
import { STORY_STARTERS } from "./gallery-collection";

// Hand-made starter designs. Tokens still pass normalizeTokens like AI output.
import originals from "./directions.data.json";

export type GalleryExtras = {
  accent2: string | null;
  finish: string;
  touch: string;
  atmosphere: string;
  buttonFinish: string;
};
export type GalleryItem = {
  id: string;
  inspiration: string;
  brief: string;
  direction: Direction;
  content: Content;
  group?: string;
  bestFor?: string;
  risk?: string;
  extras?: GalleryExtras;
};
export const MADE_FOR_YOU = "Made for you";

export type GalleryDraft = Omit<GalleryItem, "direction"> & {
  direction: Omit<Direction, "tokens"> & { tokens: unknown };
};

const raw: GalleryDraft[] = [
  {
    id: "summertime-sadness",
    inspiration: "Lana Del Rey",
    brief:
      "A vintage boutique selling slip dresses, cat-eye sunglasses and old records, with a melancholy, cinematic Americana feel.",
    direction: {
      name: "Summertime Sadness",
      mood: "Faded Americana, film grain, cherry-red lipstick on cream.",
      why: "Elegant serif headlines and wide margins feel like an old movie poster; one red accent carries the drama.",
      tokens: {
        bg: "#f3e9dc",
        surface: "#fbf5ec",
        ink: "#2b1d1f",
        muted: "#6b5052",
        accent: "#9e1b32",
        accentInk: "#ffffff",
        headingFont: "Playfair Display",
        bodyFont: "Literata",
        headingCase: "normal",
        scale: 1.333,
        radius: 2,
        density: "airy",
        heroLayout: "editorial",
        buttonStyle: "outline",
        texture: "grain",
      },
    },
    content: {
      brand: "Blue Jeans Vintage",
      headline: "Pieces with a past, for nights that feel like a film.",
      sub: "Slip dresses, cat-eye frames and records found one at a time across the American West.",
      cta: "Browse the collection",
      features: [
        {
          title: "Found, not made",
          body: "Every piece is one of a kind and photographed in natural light.",
        },
        {
          title: "Mended with care",
          body: "Hems, zips and buttons restored by hand before they ship.",
        },
        {
          title: "Wrapped in tissue",
          body: "Each order arrives with a handwritten note and a pressed flower.",
        },
      ],
      quote: "It's the dress I'd wear in my own movie.",
    },
  },
  {
    id: "unconquerable",
    inspiration: "Invictus (W. E. Henley)",
    brief:
      "A boxing and strength gym for people rebuilding their lives after hardship, with a stoic, classical, unbreakable feel.",
    direction: {
      name: "Unconquerable",
      mood: "Carved stone, iron and bronze; quiet, absolute resolve.",
      why: "Roman capitals and a strict grid feel monumental; near-black and bone white give it gravity, bronze is the single warm note.",
      tokens: {
        bg: "#121110",
        surface: "#1c1a18",
        ink: "#ece6da",
        muted: "#a89f91",
        accent: "#b08d57",
        accentInk: "#121110",
        headingFont: "Cinzel",
        bodyFont: "Literata",
        headingCase: "uppercase",
        scale: 1.414,
        radius: 0,
        density: "balanced",
        heroLayout: "poster",
        buttonStyle: "solid",
        texture: "none",
      },
    },
    content: {
      brand: "Invictus Strength",
      headline: "Bloody, but unbowed.",
      sub: "A gym for people who have been through the fell clutch of circumstance and came here to get stronger.",
      cta: "Book a first session",
      features: [
        {
          title: "Strength first",
          body: "Coached barbell and boxing classes for every starting point.",
        },
        {
          title: "No judgement",
          body: "Small groups, patient coaches, and a room that has seen hard years too.",
        },
        { title: "Built to last", body: "Twelve-week programs that track progress you can feel." },
      ],
      quote: "I am the master of my fate, I am the captain of my soul.",
    },
  },
  {
    id: "straight-from-the-block",
    inspiration: "1980s conscious rap",
    brief:
      "A community nonprofit offering youth music studios, legal aid nights and job training, with a raw, urgent, street-poster feel.",
    direction: {
      name: "Straight From the Block",
      mood: "Concrete, newsprint, warning-yellow; loud because it has to be.",
      why: "Heavy condensed capitals read like a protest flyer; black on yellow is the highest-contrast warning a street knows.",
      tokens: {
        bg: "#d9d6cf",
        surface: "#efede8",
        ink: "#111111",
        muted: "#3f3d39",
        accent: "#f2c200",
        accentInk: "#111111",
        headingFont: "Bebas Neue",
        bodyFont: "Work Sans",
        headingCase: "uppercase",
        scale: 1.5,
        radius: 0,
        density: "compact",
        heroLayout: "poster",
        buttonStyle: "solid",
        texture: "grain",
      },
    },
    content: {
      brand: "The Message Center",
      headline: "Tell the truth about the block. Then change it.",
      sub: "Free studios, legal help and job training for young people the system keeps overlooking.",
      cta: "Get involved",
      features: [
        {
          title: "Studio time",
          body: "Free recording booths and mentors who started where you are.",
        },
        { title: "Know your rights", body: "Monthly legal aid nights with volunteer attorneys." },
        {
          title: "Real work",
          body: "Paid training in sound, video and trades, with placement help.",
        },
      ],
      quote: "This place gave my words somewhere to go.",
    },
  },
  {
    id: "velvet-and-ink",
    inspiration: "A goth girl at heart, with beautiful tattoos",
    brief:
      "A fine-line tattoo studio run by women, dark, romantic and elegant, for clients who want delicate, meaningful work.",
    direction: {
      name: "Velvet & Ink",
      mood: "Black velvet, oxblood and candlelight; romantic, never cheesy.",
      why: "A gothic display face is used only for headlines, with a clean body font so it stays readable; one oxblood accent and a soft glow set the mood.",
      tokens: {
        bg: "#0e0b0d",
        surface: "#1a1418",
        ink: "#efe6e9",
        muted: "#b3a3a9",
        accent: "#8c1c2b",
        accentInk: "#ffffff",
        headingFont: "Pirata One",
        bodyFont: "Karla",
        headingCase: "normal",
        scale: 1.333,
        radius: 4,
        density: "balanced",
        heroLayout: "split",
        buttonStyle: "solid",
        texture: "glow",
      },
    },
    content: {
      brand: "Nightshade Atelier",
      headline: "Fine lines for the stories you carry.",
      sub: "Delicate, custom tattoo work in a quiet, candle-lit studio run by women artists.",
      cta: "Request a consultation",
      features: [
        {
          title: "Drawn for you",
          body: "Every design starts as a private sketch session, never flash off a wall.",
        },
        {
          title: "Gentle hands",
          body: "Fine-line specialists, single-needle detail, unhurried appointments.",
        },
        {
          title: "Healed, then shared",
          body: "Free touch-ups and aftercare check-ins at four weeks.",
        },
      ],
      quote: "She turned a hard year into something beautiful on my skin.",
    },
  },
  {
    id: "plush",
    inspiration: "Stuffed animals",
    brief:
      "A small shop that makes and repairs handmade stuffed animals, cosy, warm and gentle, for kids and grown-ups alike.",
    direction: {
      name: "Plush",
      mood: "Honey, cream and soft corners; a hug you can scroll.",
      why: "A rounded friendly font and very soft corners feel squeezable; warm cream and honey keep it cosy without looking babyish.",
      tokens: {
        bg: "#fbf4e8",
        surface: "#ffffff",
        ink: "#3a2e28",
        muted: "#6e5f55",
        accent: "#f0b35a",
        accentInk: "#2a1d12",
        headingFont: "Fredoka",
        bodyFont: "Figtree",
        headingCase: "normal",
        scale: 1.2,
        radius: 24,
        density: "airy",
        heroLayout: "stacked",
        buttonStyle: "pill",
        texture: "none",
      },
    },
    content: {
      brand: "Button & Bramble",
      headline: "Soft friends, stitched by hand.",
      sub: "Handmade stuffed animals and a gentle hospital for the well-loved ones who need repairs.",
      cta: "Meet the friends",
      features: [
        {
          title: "Made slowly",
          body: "Each friend is cut, stitched and stuffed by hand in small batches.",
        },
        {
          title: "Teddy hospital",
          body: "Loose seams, lost eyes and thin fur mended with matching fabric.",
        },
        {
          title: "Safe for little hands",
          body: "Embroidered faces and natural fillings, tested for toddlers.",
        },
      ],
      quote: "They brought my childhood bear back to life.",
    },
  },
  ...STORY_STARTERS,
];

const made: GalleryItem[] = raw.map((g) => ({
  ...g,
  group: MADE_FOR_YOU,
  direction: {
    ...g.direction,
    tokens: normalizeTokens({ ...(g.direction.tokens as object), ...extraTokens(g.extras) }),
  },
}));

// Blake's 38 original Directions, extracted from DESIGN-DIRECTIONS.md (engine output, Advise contrast).
export const ORIGINALS: GalleryItem[] = (originals as unknown as GalleryItem[]).map((g) => ({
  ...g,
  direction: {
    ...g.direction,
    tokens: normalizeTokens({ ...(g.direction.tokens as object), ...extraTokens(g.extras) }),
  },
}));
export const GALLERY: GalleryItem[] = [...made, ...ORIGINALS];
export const GALLERY_GROUPS = [
  MADE_FOR_YOU,
  "Light and calm",
  "Dark and dramatic",
  "Warm and nostalgic",
  "Bold and playful",
];

// The original Directions' frosted cards, glowing/glossy buttons and second colours become tokens.
export function extraTokens(x?: GalleryExtras) {
  return x
    ? {
        accent2: x.accent2 ?? undefined,
        card: x.finish === "glass" ? "glass" : undefined,
        buttonFinish: x.buttonFinish,
      }
    : {};
}
