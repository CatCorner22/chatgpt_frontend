/**
 * Editorial guidance for the Garden Path. Navigation is not evidence of work.
 * Keep lessons behind an explicit disclosure; essentials stand on their own.
 * Actions describe existing destinations, not automatic project mutations.
 */
export type GardenStepId =
  | "goal"
  | "content"
  | "plan"
  | "direction"
  | "craft"
  | "behavior"
  | "responsive"
  | "handoff"
  | "check";
export type GardenGoal = "existing" | "new";
export type GardenAction =
  "studio" | "gallery" | "stratosphere" | "quality" | "target" | "telescope";

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
  brand: "Vision" | "Stratosphere" | "Quality" | "Target" | "Telescope";
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
    id: "content",
    title: "Gather your content",
    shortTitle: "Gather",
    brand: "Vision",
    intro: "Let’s give the page something useful and truthful to say.",
    purpose: "Identify the words, images, and main action the design needs to support.",
    essentials: [
      "Gather the headline, key details, images, and one clear next action.",
      "Mark missing information instead of filling it with invented claims.",
    ],
    action: "studio",
    actionLabel: "Work on the page content",
    choices: [
      {
        id: "reuse-content",
        title: "Start with existing content",
        benefit: "Keep familiar wording and details that already serve your audience.",
        tradeoff: "Check that prices, claims, links, and instructions are still accurate.",
      },
      {
        id: "draft-content",
        title: "Draft a focused first version",
        benefit: "Write around the task without carrying over unnecessary material.",
        tradeoff: "New wording and supporting claims need review before publication.",
      },
    ],
    lessons: [
      {
        id: "inventory-before-layout",
        title: "Find the material the decision depends on",
        paragraphs: [
          "Begin with the information someone needs to act: what is offered, who it is for, what it costs or requires, and what happens next. Add supporting images or evidence only when they help answer a real question. A content inventory separates material you have from material you still need; it prevents an attractive layout from hiding an incomplete offer.",
          "Use real names and realistic text lengths early. A long service title, several prices, or a necessary explanation may change the layout. Keep missing facts visibly marked in your working notes. Sample testimonials, invented statistics, and decorative claims should not become published evidence just because they fit the design.",
        ],
        example: {
          title: "A practical inventory",
          text: "For a booking page: collect the service names, duration, price, availability explanation, cancellation terms, and destination for the booking action. Mark anything still awaiting confirmation.",
        },
      },
      {
        id: "make-the-action-specific",
        title: "Make the next action a clear promise",
        paragraphs: [
          "An action label should tell someone what will happen. ‘Request an appointment’ and ‘Confirm booking’ make different promises: the first may await a response, while the second suggests a reservation is complete. Match the words to the real destination or behavior, and place any essential commitment or cost nearby.",
          "Give the page one main action, while keeping useful alternatives available with less emphasis. This is a hierarchy decision, not a reason to remove existing capabilities. In an existing-app restyle, preserve current labels and destinations unless a separate content or behavior change has been agreed. Record proposed improvements for the builder rather than silently substituting them.",
        ],
        example: {
          title: "Say what happens next",
          text: "If a form only sends an enquiry, use ‘Send appointment request’ and explain when a reply is expected. Reserve ‘Booking confirmed’ for a reservation that has actually succeeded.",
        },
      },
    ],
    evidenceNote:
      "Content entered in a design is a draft; Focus cannot confirm the truth of your business claims.",
  },
  {
    id: "plan",
    title: "Arrange the page",
    shortTitle: "Arrange",
    brand: "Vision",
    intro: "Let’s put the information in the order someone will need it.",
    purpose: "Plan the reading order, grouping, and routes through your content.",
    essentials: [
      "Group related details and give each section a useful heading.",
      "If visitors choose between options, decide which details they need to compare first.",
    ],
    action: "studio",
    actionLabel: "Explore page structure",
    choices: [
      {
        id: "guided-sequence",
        title: "Guide a clear sequence",
        benefit: "Explain the essentials in order before asking someone to act.",
        tradeoff: "Returning visitors may need a direct link to a later section.",
      },
      {
        id: "scannable-sections",
        title: "Make sections easy to scan",
        benefit: "Clear headings and section links help people find a specific answer.",
        tradeoff: "Each section needs enough context to make sense when read on its own.",
      },
      {
        id: "compare-options",
        title: "Show options together before choosing",
        benefit: "Visitors can compare a name, time and total without memorizing the last option.",
        tradeoff: "A visible choice for each option takes more room, especially on a phone.",
      },
    ],
    lessons: [
      {
        id: "structure-before-decoration",
        title: "Give the page a readable outline",
        paragraphs: [
          "Read just the proposed headings, in order. They should describe the page’s argument or task without relying on decorative cards. Put the information needed for a decision before that decision, keep related details together, and avoid repeating a section simply because a template has room for it.",
          "The visual order should agree with the underlying reading order. Moving blocks around with styling can make a desktop screen look convincing while leaving keyboard and screen-reader users with a confusing sequence. On a new page, choose a composition that follows the intended content order. For an existing app, record the structure you want in your journey brief. In Target, a recognized class picker lets you preview its class names, times and totals in either layout before preparing a proposal.",
        ],
        example: {
          title: "An outline with a purpose",
          text: "‘Choose a service → Understand the price → Know what to expect → Request an appointment’ gives each section a job. The same sequence should remain understandable in one narrow column.",
        },
      },
      {
        id: "navigation-and-disclosure",
        title: "Keep the route through the page visible",
        paragraphs: [
          "Navigation labels should name recognizable destinations. Visible section links work well when there are only a few places to go; a compact menu saves space but adds an interaction before people can see their choices. A drawn menu is not a working menu: the actual build needs an accessible button, an understandable open state, and sensible focus behavior.",
          "Disclosure can keep optional detail out of the main path. Use a clear label for the hidden material and keep the summary useful on its own. Prices, required instructions, and the next action should not depend on discovering an obscure tooltip. A long page benefits from helpful grouping; it does not automatically need more navigation controls.",
        ],
        example: {
          title: "Keep detail optional",
          text: "Show a service’s name, price, and booking action immediately. Put a longer explanation under ‘What happens during this appointment?’ so readers can choose whether to open it.",
        },
      },
    ],
    evidenceNote:
      "A composition preview shows a proposed arrangement; it does not restructure your existing app.",
  },
  {
    id: "direction",
    title: "Pick a visual direction",
    shortTitle: "Explore",
    brand: "Vision",
    intro: "We’ll find a look that feels right and helps people find their way.",
    purpose: "Choose a coherent visual starting point for your content.",
    essentials: [
      "Compare directions using the same words and main action.",
      "Look at headings, spacing, and emphasis as well as color.",
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
    id: "craft",
    title: "Refine the details",
    shortTitle: "Refine",
    brand: "Stratosphere",
    intro: "Let’s make the small decisions work together.",
    purpose: "Use Stratosphere to refine the design and explore how its choices connect.",
    essentials: [
      "Adjust composition, color, type, spacing, and form in the studio.",
      "Open the choice map when you want to understand what a decision affects.",
    ],
    action: "stratosphere",
    actionLabel: "Open Stratosphere",
    choices: [
      {
        id: "keep-coordinated",
        title: "Keep the coordinated direction",
        benefit: "Preserve a consistent starting point while concentrating on real content.",
        tradeoff: "Some details may need adjustment to fit your particular page.",
      },
      {
        id: "tune-decisions",
        title: "Tune individual decisions",
        benefit: "Shape the type, spacing, color, and form around your content.",
        tradeoff: "Review related choices after each change so the result stays coherent.",
      },
    ],
    lessons: [
      {
        id: "craft-is-coordination",
        title: "Polish comes from relationships",
        paragraphs: [
          "A font, a color, or a rounded corner is rarely the whole reason a page feels accomplished. The relationships matter: headings distinguish sections, spacing reveals groups, color identifies actions, and repeated forms help people recognize similar controls. Refine a decision because of the job it performs, rather than adding an effect simply because it is available.",
          "Change one family of decisions at a time and compare using your actual content. Larger headings may change wrapping; wider spacing may push a related action farther away; a new background changes the contrast of text placed on it. Keep the main action recognizable and inspect both large display text and ordinary body copy.",
        ],
        example: {
          title: "A useful refinement",
          text: "If the service description competes with the page title, first adjust their type hierarchy and spacing. Adding another accent color may create more competition instead of resolving it.",
        },
      },
      {
        id: "read-the-choice-map",
        title: "Read connections as explanations, not scores",
        paragraphs: [
          "Stratosphere’s choice map follows defined rules connecting settings to their effects. It helps explain which parts of the design a change touches. A preference such as a more restrained heading is different from a constraint such as readable text against a particular background. Neither a neat graph nor a recommendation proves that a page is easy to use.",
          "Read the scope of the output as carefully as the choice. A composition can arrange a new authored page, while an existing-app restyle must preserve the host page’s structure. Some handoff preferences are instructions for a builder rather than finished behavior. Fonts also need checking in the delivered environment, where an unavailable face may be replaced by its fallback.",
        ],
        example: {
          title: "Follow the consequence",
          text: "After increasing the heading scale, inspect the long title in a narrow preview and in the delivered page. The setting changed; its suitability still depends on the wording, available font, and actual screen.",
        },
      },
    ],
    evidenceNote:
      "Stratosphere edits design choices; its map does not verify a finished app or change your repository.",
  },
  {
    id: "behavior",
    title: "Plan how it responds",
    shortTitle: "Respond",
    brand: "Stratosphere",
    intro: "Let’s think about the moments after someone presses a button.",
    purpose: "Explore sample controls and feedback, then plan what your own app needs.",
    essentials: [
      "In Stratosphere, open ‘Try the interaction lab’ below your design for buttons, form feedback, and example states.",
      "Use the examples to plan controls that work with a keyboard and without hovering.",
    ],
    action: "stratosphere",
    actionLabel: "Try buttons and feedback",
    choices: [
      {
        id: "inline-help",
        title: "Show essential help beside the task",
        benefit: "People see required instructions before they make a choice.",
        tradeoff: "Keep the wording concise so it does not bury the controls.",
      },
      {
        id: "optional-help",
        title: "Offer extra detail on request",
        benefit: "Explanations stay available without filling the main path.",
        tradeoff: "The label and trigger must be easy to find and work without hover.",
      },
    ],
    lessons: [
      {
        id: "controls-and-focus",
        title: "Make controls understandable before activation",
        paragraphs: [
          "Use a link to navigate and a button to perform an action. Give each a label that describes the result, and make the keyboard focus indicator easy to see against its surroundings. Someone using Tab should encounter controls in a sensible order and be able to activate them without moving to a mouse. Visual resemblance alone does not give an element the correct behavior.",
          "Tooltips can explain an unfamiliar term, but they should not contain the only label, a required instruction, or a critical action. Any tooltip used in the real app needs keyboard access as well as hover, a way to dismiss it, and enough persistence to read. Longer explanations usually fit better in an explicitly opened disclosure with a clear title.",
        ],
        example: {
          title: "Make the quiet version usable",
          text: "Keep ‘Request appointment’ visible on the button. Put a longer explanation under ‘What happens after I send this?’ instead of hiding the submission rules behind an unlabelled information icon.",
        },
      },
      {
        id: "states-and-recovery",
        title: "Design the waiting and the recovery",
        paragraphs: [
          "Define what someone sees while a task is running, after it succeeds, and when it fails. A loading state should make the ongoing action clear; it should not announce success early. An empty result should explain whether there is no data yet or whether the current search found nothing, then offer a useful next step when one exists.",
          "When input is invalid, keep the other answers, identify the affected field in words, and explain how to recover. Avoid using color as the only signal. Important asynchronous status changes may need an accessible announcement in the built app. Writing down these states is a specification; the running implementation still needs testing, including repeated clicks and unsuccessful requests.",
        ],
        example: {
          title: "Tell the truth about a request",
          text: "Show ‘Sending request…’ while submission is pending. If it fails, keep the form entries and offer a retry. Show confirmation only after the operation actually succeeds.",
        },
      },
    ],
    evidenceNote:
      "Interaction Lab is a local demonstration. It does not test your app or implement its behavior.",
  },
  {
    id: "responsive",
    title: "Make room for everyone",
    shortTitle: "Adapt",
    brand: "Quality",
    intro: "Let’s make sure the page still makes sense when the way it is used changes.",
    purpose: "Explore checks and sample pages, then plan a browser review of your own build.",
    essentials: [
      "Check a narrow screen, enlarged text, and the complete keyboard path.",
      "Keep essential content available and respect reduced-motion preferences.",
    ],
    action: "quality",
    actionLabel: "Explore checks and sample pages",
    choices: [
      {
        id: "stack-groups",
        title: "Stack related groups",
        benefit: "A clear reading order can become one comfortable column.",
        tradeoff:
          "Keep related labels, explanations, and actions together as the page grows longer.",
      },
      {
        id: "preserve-comparison",
        title: "Keep a comparison together",
        benefit: "People can still compare corresponding values across items.",
        tradeoff: "Wide content needs a deliberate small-screen treatment and usable labels.",
      },
    ],
    lessons: [
      {
        id: "reflow-and-zoom",
        title: "Adapt the arrangement, not just the size",
        paragraphs: [
          "A narrow screen usually needs a new arrangement of the same information, not smaller text squeezed into the desktop layout. Stack related groups in a meaningful order and keep labels attached to the values they explain. Avoid hiding the content that makes a decision possible simply to make the first screen look cleaner.",
          "Try browser zoom and enlarged text as well as a phone-sized viewport. Watch for clipped controls, overlapping labels, fixed bars covering content, and focus moving outside the visible area. A genuine two-dimensional comparison may need its own horizontal scrolling region; the surrounding page should remain easy to read and navigate. A preview at one width cannot establish every case.",
        ],
        example: {
          title: "Keep the task intact",
          text: "At a narrow width, place the service details above the booking form. At increased zoom, confirm that the price, field labels, and submit button remain readable and reachable without being covered by a fixed header.",
        },
      },
      {
        id: "motion-and-accessibility",
        title: "Keep meaning when effects are removed",
        paragraphs: [
          "Motion can help connect an action to its result, but it should not be the only way to understand what changed. Respect the device’s reduced-motion preference by removing or simplifying nonessential movement. A static state still needs to communicate selection, progress, and errors. Avoid making a task depend on watching an animation finish.",
          "Accessibility also depends on semantics, text alternatives, focus order, readable contrast in each state, and practical control spacing. These work together across the page. Use descriptive alternative text for informative images, keep instructions available without hover, and try assistive technology on the real build where possible. Static checks can identify some issues; they cannot establish a complete accessible experience.",
        ],
        example: {
          title: "An equally clear still state",
          text: "With reduced motion enabled, replace a sliding confirmation panel with an immediate visible confirmation. Keep its message and next action available, and check that keyboard focus remains in a sensible place.",
        },
      },
    ],
    evidenceNote:
      "A review plan is not an accessibility pass; record what you observed in the actual browser and build.",
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
