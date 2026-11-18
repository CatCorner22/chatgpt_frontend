/**
 * Editorial guidance for the Garden Path. Navigation is not evidence of work.
 * Keep lessons behind an explicit disclosure; essentials stand on their own.
 * Actions describe existing destinations, not automatic project mutations.
 */
export type GardenStepId = "goal" | "direction" | "plan" | "handoff" | "check";
export type GardenGoal = "existing" | "new";
export type GardenAction = "studio" | "gallery" | "target" | "telescope";

export type GardenChoice = {
  id: string;
  title: string;
  benefit: string;
  tradeoff: string;
};

export type GardenLesson = {
  id: string;
  title: string;
  paragraphs: readonly string[];
  example: { title: string; text: string };
};

export type GardenStep = {
  id: GardenStepId;
  title: string;
  shortTitle: string;
  brand: "Vision" | "Target" | "Telescope";
  intro: string;
  purpose: string;
  essentials: readonly string[];
  action: GardenAction;
  actionLabel: string;
  choices: readonly GardenChoice[];
  lessons: readonly GardenLesson[];
  evidenceNote: string;
};

export const GARDEN_STEPS: readonly GardenStep[] = [
  {
    id: "goal",
    title: "Choose your goal",
    shortTitle: "Choose",
    brand: "Vision",
    intro: "Let’s begin with one thing you want to make better.",
    purpose: "Give the design a clear purpose before choosing its appearance.",
    essentials: [
      "Name the page and the main thing someone should be able to do there.",
      "For an existing app, keep working features and begin with one page.",
    ],
    action: "studio",
    actionLabel: "Open the design studio",
    choices: [
      {
        id: "existing" satisfies GardenGoal,
        title: "Improve an existing app",
        benefit: "Build on the pages and features you already have.",
        tradeoff: "Changes need a separate preview and a way to restore the earlier version.",
      },
      {
        id: "new" satisfies GardenGoal,
        title: "Begin something new",
        benefit: "Choose the structure and visual direction from a fresh start.",
        tradeoff: "Content, working features, and testing still need to be built.",
      },
    ],
    lessons: [
      {
        id: "outcome-before-appearance",
        title: "Describe the result, then the appearance",
        paragraphs: [
          "A useful brief names a person, a task, and an obstacle. ‘Make it modern’ gives a designer very little to judge. ‘Help a first-time visitor compare two plans without losing the price’ suggests decisions about headings, comparison rows, and the location of the next action. Your preferred mood still matters; the task gives that mood a job.",
          "Choose one main action for the page and identify what someone needs to know before taking it. Secondary actions can remain available without receiving equal visual weight. This creates a practical way to review the design later: ask whether the page makes the intended action easier to understand and complete.",
        ],
        example: {
          title: "A more useful brief",
          text: "Instead of ‘a beautiful booking page,’ try ‘help a new client choose a service, understand its price, and request an appointment on a phone.’",
        },
      },
      {
        id: "keep-what-works",
        title: "Give an existing app a small first change",
        paragraphs: [
          "An app contains more than the screen you can see. A button may save data, enforce a permission, or preserve a choice when someone returns. Before changing its appearance, record a few real tasks that work today. These become preservation checks, so a visual improvement does not quietly remove useful behavior.",
          "Begin with one page in a separate preview. Keep a known earlier version and ask the person or coding tool making the changes to identify the exact files it touched. A small change is easier to compare, test, and undo. A new palette does not, by itself, require replacing routes, data storage, or the app’s framework.",
        ],
        example: {
          title: "A manageable first trial",
          text: "Restyle the appointment page while keeping its date selection, validation messages, and booking request intact. Check those tasks before extending the look to other pages.",
        },
      },
    ],
    evidenceNote: "Choosing a goal records an intention; it does not change your app.",
  },
  {
    id: "direction",
    title: "Pick a direction",
    shortTitle: "Explore",
    brand: "Vision",
    intro: "We’ll find a look that feels right and helps people find their way.",
    purpose: "Choose a coherent visual starting point you can refine.",
    essentials: [
      "Look at the size of headings, use of space, and emphasis on the main action.",
      "Choose a direction for your content, then adjust its details in the studio.",
    ],
    action: "gallery",
    actionLabel: "Explore design directions",
    choices: [
      {
        id: "quiet",
        title: "Quiet and focused",
        benefit: "Restrained color and clear spacing give the content room to lead.",
        tradeoff: "The wording and hierarchy must carry more of the personality.",
      },
      {
        id: "expressive",
        title: "Expressive and distinctive",
        benefit: "Stronger type, color, or imagery can make the page more memorable.",
        tradeoff: "Decoration needs restraint so the important actions stay easy to spot.",
      },
    ],
    lessons: [
      {
        id: "space-as-structure",
        title: "Let space explain the page",
        paragraphs: [
          "Open space is useful when it shows relationships. A label placed close to its field belongs to that field; a larger gap can separate one task from the next. Repeating these distances helps people understand a page before they read every word. Calm comes from predictable structure as much as from a quiet palette.",
          "More empty space is not automatically better. A comparison table may need compact rows so readers can compare items together. A long gap that separates a price from its explanation makes the task harder. Give related items enough closeness to read as a group, and reserve larger pauses for genuine changes of subject.",
        ],
        example: {
          title: "A useful pause",
          text: "Keep a service name, price, and short description together. Add more space before the next service, rather than placing the same large gap between every line.",
        },
      },
      {
        id: "coherent-personality",
        title: "Choose a few distinctive decisions",
        paragraphs: [
          "A recognizable design does not need every element to demand attention. One expressive heading style, a well-chosen accent color, and consistent imagery can establish a personality. Repeating those decisions across buttons, cards, and navigation makes the page feel deliberate.",
          "Compare directions using similar content and the same task. Otherwise, a strong photograph or unusually short headline may win the comparison for reasons that will not survive your real page. Look at the small text and secondary controls too: a direction needs to work beyond its largest, most attractive section.",
        ],
        example: {
          title: "Compare the same problem",
          text: "Try the same long service name and two-line description in each direction. Check whether the booking action remains easy to recognize in both.",
        },
      },
    ],
    evidenceNote:
      "A direction is a starting point; its preview does not establish how your finished app will behave.",
  },
  {
    id: "plan",
    title: "Plan the page",
    shortTitle: "Shape",
    brand: "Vision",
    intro: "Let’s turn your chosen look into a plan someone can build from.",
    purpose: "Refine and save the design decisions for the page you want to make.",
    essentials: [
      "Use real wording where possible and check the preview at narrow widths.",
      "Save the design you intend to use before preparing its handoff.",
    ],
    action: "studio",
    actionLabel: "Refine the design",
    choices: [
      {
        id: "one-page",
        title: "Refine one page first",
        benefit: "A smaller trial makes visual and behavior changes easier to judge.",
        tradeoff: "Other pages may keep their current appearance during the trial.",
      },
      {
        id: "connected-pages",
        title: "Plan a connected set",
        benefit: "Shared decisions can keep a multi-page task consistent.",
        tradeoff: "Each page and the transitions between them need separate review.",
      },
    ],
    lessons: [
      {
        id: "design-real-content",
        title: "Give the design realistic material",
        paragraphs: [
          "Short placeholder text can make almost any layout look orderly. Real names, prices, instructions, and error messages reveal whether it has enough room. A useful preview includes a long heading, a paragraph of ordinary length, and the labels people will actually encounter. These are part of the design, not material to squeeze in afterward.",
          "At a narrow width, content should reorganize in a meaningful order rather than simply shrink. Watch for clipped words, controls pushed off screen, and instructions separated from the action they explain. An attractive desktop preview is one view of the plan; the built page still needs review with real content and browser zoom.",
        ],
        example: {
          title: "Try the awkward version",
          text: "Replace ‘Book now’ with the actual action, such as ‘Request a first appointment.’ Use the longest service name you expect and check whether the layout still makes sense on a phone.",
        },
      },
      {
        id: "plan-beyond-happy-path",
        title: "Plan what happens after a click",
        paragraphs: [
          "A polished screen is only one moment in a task. People also encounter loading, empty results, invalid input, and success messages. Describe what they should see and what they can do next in each important state. Clear recovery often matters more than an elaborate transition.",
          "Include keyboard use in the plan. A person should be able to reach an action, recognize where focus is, and activate it without a mouse. Color alone should not explain an error or selection. These requirements guide implementation; a design specification cannot confirm that the finished controls satisfy them.",
        ],
        example: {
          title: "Make an error recoverable",
          text: "If an appointment request has an invalid email address, keep the other answers, identify the email field in words, and explain how to fix it. Do not make the person begin again.",
        },
      },
    ],
    evidenceNote:
      "A saved design preserves your decisions; working interactions still need implementation and testing.",
  },
  {
    id: "handoff",
    title: "Prepare the handoff",
    shortTitle: "Prepare",
    brand: "Target",
    intro: "I’ll help you explain the change clearly to the person or tool building it.",
    purpose: "Prepare the design files and instructions for a controlled first build.",
    essentials: [
      "Target prepares a design ZIP and guided prompts for your chosen project.",
      "For an existing app, name what must keep working, where to preview, and how to undo.",
    ],
    action: "target",
    actionLabel: "Prepare with Target",
    choices: [
      {
        id: "files",
        title: "Begin with the design ZIP",
        benefit: "Keep the specification, starter styling, and instructions together.",
        tradeoff: "Someone still needs to integrate them into the actual project.",
      },
      {
        id: "prompts",
        title: "Begin with guided prompts",
        benefit: "Give a coding assistant a sequence of bounded tasks to follow.",
        tradeoff: "Review each result; a prompt cannot guarantee the tool follows it correctly.",
      },
    ],
    lessons: [
      {
        id: "a-handoff-is-a-contract",
        title: "Explain both the change and its boundaries",
        paragraphs: [
          "A useful handoff names the page to change, the intended improvement, and the behavior to preserve. For an existing React or Next.js app, ask the builder to inspect the project before making edits. Its current components, routing, and styling conventions matter; starting from a familiar template can accidentally replace decisions the app already depends on.",
          "Target’s ZIP packages a design specification and starter styling. Its validation checks the pack before download; it does not build, test, or publish your app. The guided prompts complement the files by asking for inspection, a scoped change, testing, and rollback. You can use both. Focus does not apply these changes to your GitHub repository.",
        ],
        example: {
          title: "A clear boundary",
          text: "‘Restyle the booking page using this design. Preserve its form validation, submission behavior, and confirmation screen. Show the proposed file changes before extending the design elsewhere.’",
        },
      },
      {
        id: "preview-and-rollback",
        title: "Know how you will compare and undo",
        paragraphs: [
          "Use a separate preview to compare the earlier page with the proposed change under the same conditions. Try the same content, screen size, and task. This makes it easier to tell whether a new layout actually improves the experience, rather than simply looking unfamiliar or more decorative.",
          "For an existing app, rollback should remove the trial’s changes while preserving unrelated work. Keep an earlier version and request the exact change list. Extract the design pack into a fresh folder and review it before copying anything into the project: neither a ZIP nor written instructions can prevent another tool from overwriting a file.",
        ],
        example: {
          title: "Ask for a reversible trial",
          text: "‘Show this one-page change in a preview, list the files you changed, and explain how to undo only this trial. Keep my other work and existing booking data.’",
        },
      },
    ],
    evidenceNote:
      "A downloaded handoff is preparation. It does not mean the app was changed, tested, or launched.",
  },
  {
    id: "check",
    title: "Check the result",
    shortTitle: "Review",
    brand: "Telescope",
    intro: "Now we can look at what was built, and what still needs a real try.",
    purpose: "Inspect the built files and prepare meaningful browser checks.",
    essentials: [
      "Bring a built HTML file or built-site ZIP to Telescope for local inspection.",
      "Try the important tasks in a real browser before deciding the page is ready.",
    ],
    action: "telescope",
    actionLabel: "Inspect with Telescope",
    choices: [
      {
        id: "file-inspection",
        title: "Inspect the built files",
        benefit: "Identify the exact file and review the supported static checks.",
        tradeoff: "File inspection cannot show how the page renders or how its controls behave.",
      },
      {
        id: "browser-tasks",
        title: "Try the real tasks",
        benefit: "Observe the appearance, interactions, and recovery in the running page.",
        tradeoff:
          "Results cover the tasks and conditions you actually tried; they are not universal proof.",
      },
    ],
    lessons: [
      {
        id: "match-claims-to-evidence",
        title: "Know what each kind of check can tell you",
        paragraphs: [
          "Telescope inspects local built HTML or ZIP files in your tab and identifies the exact bytes you supplied. Its receipt records supported findings and limitations, and its test plan helps describe what to try next. It does not render the HTML, execute its scripts, visit your site, or install changes.",
          "A browser check answers a different question: what happens when someone uses the running page? Record the build, browser, screen size, action, and observed result. If the code changes afterward, earlier observations may no longer describe the current page. A useful review keeps conclusions as specific as the evidence behind them.",
        ],
        example: {
          title: "A precise observation",
          text: "‘In this preview on a phone-sized screen, I selected a service and submitted a valid request; a confirmation appeared.’ This supports that task in those conditions, not every booking scenario.",
        },
      },
      {
        id: "review-craft-and-behavior",
        title: "Review the craft as well as the mechanics",
        paragraphs: [
          "Start with the main task, then deliberately try a mistake, an empty state, and keyboard navigation. Check a narrow screen and browser zoom. For an existing app, repeat the preservation checks you recorded at the beginning and rehearse the trial’s rollback in the preview. A successful click alone does not establish that the full task works.",
          "Then step back and judge the experience: can someone tell where to begin, read the important information comfortably, and understand the next action? Look for uneven spacing, awkward wrapping, competing emphasis, and unclear feedback. Automated checks can contribute evidence, but visual craft and ease of use also require careful observation and judgment.",
        ],
        example: {
          title: "A small, useful review",
          text: "Try one successful appointment request, one invalid email, and the same flow using only the keyboard. Compare the narrow and wide layouts, then confirm the existing features still behave as expected.",
        },
      },
    ],
    evidenceNote:
      "Opening this stop is a visit. Read the actual inspection findings and browser results to judge readiness.",
  },
];

export function getGardenStep(id: GardenStepId): GardenStep {
  const step = GARDEN_STEPS.find((candidate) => candidate.id === id);
  if (!step) throw new Error(`Unknown Garden Path step: ${id}`);
  return step;
}
