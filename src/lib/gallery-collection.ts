import type { GalleryDraft } from "./gallery";

/** Original starter concepts. Copy is editable sample brand language, not customer testimony. */
export const STORY_STARTERS: GalleryDraft[] = [
  {
    id: "purr-and-paper",
    inspiration: "Cats, well-thumbed books, cream paper and neighborhood reading rooms",
    bestFor: "Cat cafés, reading clubs, bookshops and neighborhood communities",
    risk: "Keep the playful character in headings and details; booking and membership tasks stay plain and clear.",
    brief:
      "A welcoming cat café and neighborhood book club with a quiet reading nook, a shared shelf and small community gatherings.",
    direction: {
      name: "Purr & Paper",
      mood: "Cream pages, forest green and soft ginger; a warm cat-filled reading nook.",
      why: "A characterful serif and rounded buttons make the room welcoming. A split first screen gives the invitation and practical visit details equal space.",
      tokens: {
        bg: "#f8f1e4",
        surface: "#fffcf6",
        ink: "#263d30",
        muted: "#596253",
        accent: "#315d44",
        accentInk: "#fffdf7",
        accent2: "#d68a54",
        headingFont: "Fraunces",
        bodyFont: "Karla",
        headingCase: "normal",
        scale: 1.25,
        radius: 20,
        density: "airy",
        heroLayout: "split",
        buttonStyle: "pill",
        texture: "none",
      },
    },
    content: {
      brand: "Purr & Paper",
      headline: "Find a good book. Make a small friend.",
      sub: "A neighborhood reading room with a shared shelf, friendly cats and plenty of room to settle in.",
      cta: "Plan your visit",
      features: [
        {
          title: "Your kind of quiet",
          body: "Choose a reading session, browse the shelf and take the afternoon at your own pace.",
        },
        {
          title: "A little company",
          body: "Meet the resident cats on their terms, with a calm corner for anyone who wants more space.",
        },
        {
          title: "Stories to share",
          body: "Explore book-club evenings, local author conversations and the next community shelf swap.",
        },
      ],
      quote: "Good stories leave room for everyone.",
    },
  },
  {
    id: "velvet-afterglow",
    inspiration: "Vintage cinema, faded Americana and romantic record sleeves",
    bestFor: "Cinematic vintage boutiques, fashion collections, record shops and film clubs",
    risk: "Keep film grain subtle and behind the imagery; product details, prices and navigation need crisp contrast.",
    brief:
      "A cinematic vintage boutique pairing thoughtful clothing finds with records and stories from long summer evenings, romantic and original rather than celebrity-branded.",
    direction: {
      name: "Velvet Afterglow",
      mood: "Dusty rose, warm ivory and deep cherry; vintage cinema after the lights go down.",
      why: "A large, poised serif headline creates a poster-like entrance. Square edges and an outlined invitation keep the nostalgia tailored, while clear sans-serif details carry the shopping tasks.",
      tokens: {
        bg: "#f2dfd2",
        surface: "#fff5e9",
        ink: "#401d29",
        muted: "#70434d",
        accent: "#8c2340",
        accentInk: "#fff7ec",
        headingFont: "DM Serif Display",
        bodyFont: "Instrument Sans",
        headingCase: "normal",
        scale: 1.414,
        radius: 0,
        density: "balanced",
        heroLayout: "poster",
        buttonStyle: "outline",
        texture: "grain",
      },
    },
    content: {
      brand: "Velvet Afterglow",
      headline: "Something lovely for the long way home.",
      sub: "Vintage pieces, favorite records and a few unexpected finds, gathered for the stories still ahead.",
      cta: "Explore the edit",
      features: [
        {
          title: "A considered edit",
          body: "Browse a small collection by era, fabric and the way you want to wear it now.",
        },
        {
          title: "The details, clearly",
          body: "Find measurements, condition notes and close-up views beside each piece.",
        },
        {
          title: "A soundtrack nearby",
          body: "Discover the record shelf and the stories that bring each seasonal edit together.",
        },
      ],
      quote: "A little nostalgia. Plenty of possibility.",
    },
  },
  {
    id: "midnight-muse",
    inspiration: "Gothic libraries, marginal notes and thoughtful conversations after dark",
    bestFor:
      "Gothic literary magazines, independent publishers, essays and mysterious reading journals",
    risk: "Use the ceremonial capitals for short headings only; long essays keep sentence case and generous line spacing.",
    brief:
      "An independent literary magazine for curious readers, with gothic elegance, sharp essays, warm conversation and a subtle sense of mystery.",
    direction: {
      name: "Midnight Muse",
      mood: "Ink-purple, parchment and antique gold; intelligent, gothic and quietly mysterious.",
      why: "Inscription-like headings and bookish body type frame an editorial layout. Compact grouping makes a rich reading index easy to scan without turning the text into decoration.",
      tokens: {
        bg: "#14131d",
        surface: "#22202d",
        ink: "#f3ebdc",
        muted: "#b9afca",
        accent: "#d7b77e",
        accentInk: "#211c25",
        accent2: "#a08eb7",
        headingFont: "Cinzel",
        bodyFont: "Literata",
        headingCase: "uppercase",
        scale: 1.333,
        radius: 2,
        density: "compact",
        heroLayout: "editorial",
        buttonStyle: "solid",
        texture: "none",
      },
    },
    content: {
      brand: "Midnight Muse",
      headline: "For the questions that keep a light on.",
      sub: "Essays, fiction and conversations for readers drawn to the strange, the beautiful and the carefully considered.",
      cta: "Read the current issue",
      features: [
        {
          title: "A closer reading",
          body: "Essays that follow a question beyond the obvious answer, with sources worth exploring.",
        },
        {
          title: "Stories after dark",
          body: "Original fiction with atmosphere, wit and enough space to form your own interpretation.",
        },
        {
          title: "Notes in the margin",
          body: "Reading lists and conversations that welcome curiosity rather than demand agreement.",
        },
      ],
      quote: "Stay curious. Leave a little room for wonder.",
    },
  },
  {
    id: "wildflower-hour",
    inspiration: "Peaceful gardens, field notebooks and unhurried afternoons outdoors",
    bestFor:
      "Peaceful nature journals, garden clubs, walking groups and seasonal community gatherings",
    risk: "Keep the pale palette for backgrounds, not low-contrast text; describe activities without promising health outcomes.",
    brief:
      "A peaceful nature journal and garden community sharing seasonal observations, gentle outdoor gatherings and ways to notice ordinary beauty without wellness or medical promises.",
    direction: {
      name: "Wildflower Hour",
      mood: "Sage, linen and deep leaf green; peaceful, open and close to the seasons.",
      why: "An airy, centered first screen creates a quiet welcome. Newsreader brings the feeling of a field journal, while a straightforward sans serif keeps dates and outing details easy to use.",
      tokens: {
        bg: "#f0f2e7",
        surface: "#fcfbf4",
        ink: "#2d4337",
        muted: "#58654c",
        accent: "#446c42",
        accentInk: "#ffffff",
        headingFont: "Newsreader",
        bodyFont: "Public Sans",
        headingCase: "normal",
        scale: 1.2,
        radius: 10,
        density: "airy",
        heroLayout: "stacked",
        buttonStyle: "solid",
        texture: "none",
      },
    },
    content: {
      brand: "Wildflower Hour",
      headline: "A little time for what is growing.",
      sub: "Field notes, garden gatherings and simple invitations to notice the season around you.",
      cta: "Explore this season",
      features: [
        {
          title: "Notes from outside",
          body: "Read short observations on changing light, familiar paths and the plants along the way.",
        },
        {
          title: "Gather at your pace",
          body: "See upcoming outings with clear details about distance, access, meeting places and weather plans.",
        },
        {
          title: "Small things, kept",
          body: "Browse sketches, seasonal lists and ideas for making a nature notebook of your own.",
        },
      ],
      quote: "There is always something worth noticing.",
    },
  },
  {
    id: "cocoa-atelier",
    inspiration: "Rich brunette palettes, tactile fabrics and warm, confident personal style",
    bestFor:
      "Brunette beauty brands, inclusive fashion boutiques, curve-friendly clothing and personal styling",
    risk: "Keep fit and sizing information practical and inclusive; confidence is an invitation, not a promised result.",
    brief:
      "An inclusive fashion atelier with rich brunette browns, warm light and confident styling, celebrating curves and individual taste through thoughtful fit information.",
    direction: {
      name: "Cocoa Atelier",
      mood: "Espresso, caramel and satin cream; warm, assured and quietly luxurious.",
      why: "A warm Caslon headline and a clean body face balance intimacy with precise product information. The split layout leaves space for fit details, while caramel accents illuminate a deep cocoa ground.",
      tokens: {
        bg: "#2a1c19",
        surface: "#3c2923",
        ink: "#f8e8d6",
        muted: "#d5baa2",
        accent: "#edbf92",
        accentInk: "#33211b",
        headingFont: "Libre Caslon Text",
        bodyFont: "DM Sans",
        headingCase: "normal",
        scale: 1.333,
        radius: 6,
        density: "balanced",
        heroLayout: "split",
        buttonStyle: "solid",
        texture: "grain",
      },
    },
    content: {
      brand: "Cocoa Atelier",
      headline: "Take up space. Dress like yourself.",
      sub: "Expressive layers, warm textures and thoughtful fit details for personal style that belongs to you.",
      cta: "Find your next favorite",
      features: [
        {
          title: "Fit, without the guesswork",
          body: "Start with garment measurements, fabric stretch and clear fit notes for each piece.",
        },
        {
          title: "Style with possibilities",
          body: "Explore outfit ideas across different silhouettes, proportions and ways of moving through the day.",
        },
        {
          title: "Details you can feel",
          body: "Look closely at fabrics, fastenings and care instructions before choosing what comes home.",
        },
      ],
      quote: "Your shape. Your pace. Your point of view.",
    },
  },
  {
    id: "moonlit-mischief",
    inspiration: "Playful cats, midnight sketchbooks and a friendly little mystery",
    bestFor:
      "Playful cat creative studios, illustrator portfolios, stickers and independent art shops",
    risk: "Keep stars and playful flourishes away from long text and forms; motion should remain optional and restrained.",
    brief:
      "A playful cat-inspired illustration studio and tiny art shop with joyful stickers, clever characters and a slightly mysterious moonlit mood.",
    direction: {
      name: "Moonlit Mischief",
      mood: "Lavender dusk, inky plum and little stars; clever, positive and delightfully curious.",
      why: "An expressive modern headline, pill buttons and a bold poster layout bring the fun. Compact sections keep a small art collection lively, with clean geometric body type for the practical details.",
      tokens: {
        bg: "#efeaf7",
        surface: "#fff9f0",
        ink: "#352a4c",
        muted: "#625572",
        accent: "#5d3b81",
        accentInk: "#ffffff",
        accent2: "#cb8959",
        headingFont: "Bricolage Grotesque",
        bodyFont: "Space Grotesk",
        headingCase: "normal",
        scale: 1.5,
        radius: 28,
        density: "compact",
        heroLayout: "poster",
        buttonStyle: "pill",
        texture: "stars",
      },
    },
    content: {
      brand: "Moonlit Mischief",
      headline: "A little odd. A lot to love.",
      sub: "Curious cats, bright ideas and small illustrated things for people who enjoy a delightful surprise.",
      cta: "Meet the collection",
      features: [
        {
          title: "Characters with a wink",
          body: "Browse original prints and stickers, each with its own small story and crooked little smile.",
        },
        {
          title: "Made for your idea",
          body: "Explore illustration projects and see how a playful character can bring a thoughtful brief to life.",
        },
        {
          title: "From the sketchbook",
          body: "Follow new drawings, experiments and the wonderfully imperfect beginnings behind the finished work.",
        },
      ],
      quote: "Follow the curious thought.",
    },
  },
];
