/**
 * Plain-language learning content, researched 2026-11-18.
 * Practice choices explain consequences; they do not apply Studio settings,
 * change a customer project, or supply evidence that a build has passed review.
 * Source scope and reading notes: docs/FIELD-GUIDE-SOURCES.md.
 */
export type FieldGuideSource = {
  id: string;
  title: string;
  url: string;
  publisher: string;
};

export type FieldGuideTerm = {
  id: string;
  term: string;
  plain: string;
  example: string;
  whyItMatters: string;
  sourceIds: readonly string[];
};

export type FieldGuideOption = {
  id: string;
  label: string;
  benefit: string;
  tradeoff: string;
  downstream: readonly [string, ...string[]];
  route?: string;
};

export type FieldGuideChoice = {
  id: string;
  title: string;
  trailLabel: string;
  question: string;
  note?: string;
  termIds: readonly string[];
  options: readonly [FieldGuideOption, FieldGuideOption];
};

export type FieldGuideArea = {
  id: string;
  name: string;
  plain: string;
};

/** Focus product names, not externally sourced technical definitions. */
export const FIELD_GUIDE_AREAS: readonly FieldGuideArea[] = [
  {
    id: "focus",
    name: "Focus",
    plain: "The whole tool: a place to plan, refine, and prepare the frontend you want to build.",
  },
  {
    id: "vision",
    name: "Vision",
    plain: "The design studio, where you explore a direction and save your design decisions.",
  },
  {
    id: "horizon",
    name: "Horizon",
    plain: "Your project progress record, showing the work and evidence recorded in Focus.",
  },
  {
    id: "target",
    name: "Target",
    plain:
      "Prepares a scoped design handoff and guided prompts for a builder to use in your project.",
  },
  {
    id: "telescope",
    name: "Telescope",
    plain:
      "Inspects a local built HTML file or ZIP. It does not run the page or test its live behavior.",
  },
  {
    id: "stratosphere",
    name: "Stratosphere",
    plain:
      "A closer look at design choices, with a map explaining how settings connect to their effects.",
  },
  {
    id: "reverie",
    name: "Reverie",
    plain: "Your cream-and-ginger cat guide, here to explain the choices along the path.",
  },
];

export const FIELD_GUIDE_SOURCES: readonly FieldGuideSource[] = [
  {
    id: "mdn-server",
    title: "Introduction to the server side",
    url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Server-side/First_steps/Introduction",
    publisher: "MDN Web Docs",
  },
  {
    id: "mdn-ui",
    title: "UI",
    url: "https://developer.mozilla.org/en-US/docs/Glossary/UI",
    publisher: "MDN Web Docs",
  },
  {
    id: "mdn-ux",
    title: "UX",
    url: "https://developer.mozilla.org/en-US/docs/Glossary/UX",
    publisher: "MDN Web Docs",
  },
  {
    id: "react-component",
    title: "Your First Component",
    url: "https://react.dev/learn/your-first-component",
    publisher: "React",
  },
  {
    id: "react-state",
    title: "State: A Component’s Memory",
    url: "https://react.dev/learn/state-a-components-memory",
    publisher: "React",
  },
  {
    id: "wai-headings",
    title: "Headings",
    url: "https://www.w3.org/WAI/tutorials/page-structure/headings/",
    publisher: "W3C Web Accessibility Initiative",
  },
  {
    id: "govuk-buttons",
    title: "Button",
    url: "https://design-system.service.gov.uk/components/button/",
    publisher: "GOV.UK Design System",
  },
  {
    id: "mdn-responsive",
    title: "Responsive web design",
    url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Responsive_Design",
    publisher: "MDN Web Docs",
  },
  {
    id: "wai-accessibility",
    title: "Introduction to Web Accessibility",
    url: "https://www.w3.org/WAI/fundamentals/accessibility-intro/",
    publisher: "W3C Web Accessibility Initiative",
  },
  {
    id: "wai-contrast",
    title: "Understanding SC 1.4.3: Contrast (Minimum)",
    url: "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html",
    publisher: "W3C Web Accessibility Initiative",
  },
  {
    id: "dtcg-format",
    title: "Design Tokens Format Module 2025.10",
    url: "https://www.designtokens.org/tr/2025.10/format/",
    publisher: "Design Tokens Community Group",
  },
  {
    id: "govuk-prototypes",
    title: "Making prototypes",
    url: "https://www.gov.uk/service-manual/design/making-prototypes",
    publisher: "GOV.UK Service Manual",
  },
  {
    id: "github-backup",
    title: "Backing up a repository",
    url: "https://docs.github.com/en/repositories/archiving-a-github-repository/backing-up-a-repository",
    publisher: "GitHub Docs",
  },
  {
    id: "github-revert",
    title: "Reverting a commit in GitHub Desktop",
    url: "https://docs.github.com/en/desktop/managing-commits/reverting-a-commit-in-github-desktop",
    publisher: "GitHub Docs",
  },
  {
    id: "github-repository",
    title: "About repositories",
    url: "https://docs.github.com/en/repositories/creating-and-managing-repositories/about-repositories",
    publisher: "GitHub Docs",
  },
  {
    id: "github-branches",
    title: "About branches",
    url: "https://docs.github.com/en/pull-requests/reference/branches",
    publisher: "GitHub Docs",
  },
  {
    id: "github-pull-requests",
    title: "About pull requests",
    url: "https://docs.github.com/en/pull-requests/reference/pull-requests",
    publisher: "GitHub Docs",
  },
  {
    id: "vercel-environments",
    title: "Environments",
    url: "https://vercel.com/docs/deployments/environments",
    publisher: "Vercel Docs",
  },
  {
    id: "mdn-font-family",
    title: "font-family",
    url: "https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-family",
    publisher: "MDN Web Docs",
  },
  {
    id: "sil-ofl",
    title: "SIL Open Font License — official text",
    url: "https://openfontlicense.org/open-font-license-official-text/",
    publisher: "SIL Open Font License",
  },
  {
    id: "wai-alt-tree",
    title: "An alt Decision Tree",
    url: "https://www.w3.org/WAI/tutorials/images/decision-tree/",
    publisher: "W3C Web Accessibility Initiative",
  },
  {
    id: "wai-informative-images",
    title: "Informative Images",
    url: "https://www.w3.org/WAI/tutorials/images/informative/",
    publisher: "W3C Web Accessibility Initiative",
  },
];

export const FIELD_GUIDE_TERMS: readonly FieldGuideTerm[] = [
  {
    id: "frontend-backend",
    term: "Frontend & backend",
    plain:
      "The frontend is the part of a website people see and operate. The backend handles work on a server, such as checking permissions or storing a booking. They often work together.",
    example:
      "A date picker is part of the frontend. Confirming that its chosen appointment is available may require a backend.",
    whyItMatters:
      "Changing a page’s appearance does not automatically create the service behind its buttons.",
    sourceIds: ["mdn-server"],
  },
  {
    id: "ui-ux",
    term: "UI & UX",
    plain:
      "UI means user interface: the controls and information you use. UX means user experience: how understandable, useful, and manageable the whole task feels.",
    example:
      "The booking button belongs to the UI. Finding a suitable date and knowing whether the request succeeded are part of the UX.",
    whyItMatters:
      "A lovely screen is a good beginning; the task also needs to make sense from start to finish.",
    sourceIds: ["mdn-ui", "mdn-ux"],
  },
  {
    id: "component",
    term: "Component",
    plain:
      "A reusable part of an interface, with its own structure and sometimes its own behavior. Components can be combined to make a page.",
    example:
      "The same service-card component can display a pottery class, a painting class, or a studio visit.",
    whyItMatters:
      "Shared components help related controls behave consistently. A change can affect every place that uses one.",
    sourceIds: ["react-component"],
  },
  {
    id: "state",
    term: "State",
    plain:
      "Information an interface remembers while it responds, such as a selected date or an open menu. State is not automatically saved permanently.",
    example:
      "Choosing Tuesday changes the date picker’s state. A separate save operation may be needed to remember it after a reload.",
    whyItMatters:
      "Plan what changes, what stays, and what happens while a request is waiting or fails.",
    sourceIds: ["react-state"],
  },
  {
    id: "hierarchy",
    term: "Hierarchy",
    plain:
      "The order and grouping that show what matters most and how the information fits together. Headings and emphasis help make those relationships clear.",
    example:
      "A page title introduces the class; smaller headings separate dates, prices, and what to bring.",
    whyItMatters:
      "Readers can find their place without treating every line or button as equally important.",
    sourceIds: ["wai-headings", "govuk-buttons"],
  },
  {
    id: "primary-action",
    term: "Primary action",
    plain:
      "The main next step a page helps someone take. Its label should describe what actually happens; other useful actions can remain available with less emphasis.",
    example:
      "‘Request a place’ is different from ‘Confirm booking.’ Choose the promise the service can actually keep.",
    whyItMatters:
      "A clear main action helps people decide where to go next without removing their alternatives.",
    sourceIds: ["govuk-buttons"],
  },
  {
    id: "responsive",
    term: "Responsive design",
    plain:
      "A design that adapts its arrangement to the available space. It can change columns, spacing, or image size while keeping the content useful.",
    example:
      "Class details and a booking panel sit side by side on a wide screen, then become one readable column on a phone.",
    whyItMatters:
      "A smaller screen needs a usable arrangement, not simply a shrunken desktop page.",
    sourceIds: ["mdn-responsive"],
  },
  {
    id: "breakpoint",
    term: "Breakpoint",
    plain:
      "A point where a layout rule changes, often when the available width crosses a threshold. Choose it around the content’s needs, rather than one particular phone model.",
    example:
      "When two columns become cramped, a breakpoint switches the booking page to one column.",
    whyItMatters: "Check widths around the change as well as your largest and smallest previews.",
    sourceIds: ["mdn-responsive"],
  },
  {
    id: "accessibility",
    term: "Accessibility",
    plain:
      "Designing and building so people with disabilities can understand and use the page, including with a keyboard, a screen reader, or enlarged text.",
    example:
      "A booking form has clear labels, visible keyboard focus, and an error message that explains how to fix the problem.",
    whyItMatters:
      "Accessibility belongs throughout the work. One automated check cannot establish the whole experience.",
    sourceIds: ["wai-accessibility"],
  },
  {
    id: "contrast",
    term: "Contrast",
    plain:
      "How strongly text stands out from its background. WCAG AA generally requires a ratio of at least 4.5:1 for ordinary text, with different requirements and exceptions for some cases.",
    example:
      "A pale button can still have a calm appearance while its label uses a much darker color.",
    whyItMatters:
      "Check the actual text and background together, including hover and other states. A palette alone is not a full-page accessibility result.",
    sourceIds: ["wai-contrast"],
  },
  {
    id: "design-tokens",
    term: "Design tokens",
    plain:
      "Named design values that can be reused, such as the main text color, a heading size, or a spacing distance.",
    example:
      "A ‘main text color’ value can be used by several components instead of choosing a separate color for each one.",
    whyItMatters:
      "Shared values support consistency. Updating one affects the places connected to it, not every part of an unrelated app.",
    sourceIds: ["dtcg-format"],
  },
  {
    id: "prototype-production",
    term: "Prototype & production",
    plain:
      "A prototype helps you try an idea. Production is the real version people rely on. A realistic prototype can still use pretend data or incomplete behavior.",
    example: "A practice booking screen may show a confirmation without reserving an actual place.",
    whyItMatters:
      "A successful demonstration is useful evidence about the idea, but real service behavior still needs implementation and review.",
    sourceIds: ["govuk-prototypes"],
  },
  {
    id: "backup-rollback",
    term: "Backup & rollback",
    plain:
      "A backup is a recoverable copy of work. Rollback is the process of undoing a particular change. Know what each covers before relying on it.",
    example:
      "Keep a known earlier version, then ask how to undo the trial styling without removing later, unrelated work.",
    whyItMatters:
      "A code backup may not include the app’s stored customer data. Check the scope and rehearse recovery in a preview.",
    sourceIds: ["github-backup", "github-revert"],
  },
  {
    id: "static-interactive",
    term: "Static & interactive",
    plain:
      "Static describes pages served as prepared files. Interactive describes how a page responds to a person. A static site can still have working links, disclosures, or browser-side controls.",
    example:
      "A class-information page can link to an existing booking service. Booking directly on the page adds behavior that must be implemented.",
    whyItMatters:
      "Choose the behavior the task needs. A polished form does not by itself save or send anything.",
    sourceIds: ["mdn-server", "react-state"],
  },
  {
    id: "font-fallback",
    term: "Font & fallback",
    plain:
      "A font gives your words their letter shapes. A system font uses a face available on the device; a supplied web font brings a chosen face with the page. A fallback is the next font the browser can try.",
    example:
      "Reverie’s class title can use a familiar device font, or a supplied display font with a readable fallback when it cannot load.",
    whyItMatters:
      "Device fonts can differ across devices. Supplied fonts need suitable files, loading checks and permission to use them. An open font license also has conditions; check the actual license rather than assuming every font is free to bundle.",
    sourceIds: ["mdn-font-family", "sil-ofl"],
  },
  {
    id: "image-alt",
    term: "Image & alt text",
    plain:
      "Alt text gives an image’s useful meaning when it cannot be seen. Its wording depends on the image’s job on the page; a purely decorative image can use an empty text alternative.",
    example:
      "A photograph showing a class technique needs its useful meaning explained. A decorative sparkle beside an already clear heading does not need its own description.",
    whyItMatters:
      "Choose imagery that helps the task, keep the right to use it, and check the crop and text alternative where it appears.",
    sourceIds: ["wai-alt-tree", "wai-informative-images"],
  },
  {
    id: "repository-branch",
    term: "Repository & branch",
    plain:
      "A repository keeps a project’s files and recorded history. A branch is a separate line of work where changes can be prepared before combining them with another version.",
    example:
      "A developer prepares Reverie’s page refresh on a trial branch while the main version remains available for comparison.",
    whyItMatters:
      "A branch separates code changes. It does not automatically isolate customer data, payments or messages; the preview’s services still need checking.",
    sourceIds: ["github-repository", "github-branches"],
  },
  {
    id: "pull-request",
    term: "Pull request",
    plain:
      "A proposal to bring changes into another branch, with a place to review the file differences, discuss them and see checks.",
    example:
      "The developer opens a pull request showing the page refresh, its preview and the tasks they actually tested.",
    whyItMatters:
      "A proposal is not proof of a successful customer release. Hosting automation may create a preview or deploy after a merge, so check the project’s actual workflow.",
    sourceIds: ["github-pull-requests", "vercel-environments"],
  },
  {
    id: "preview-deployment",
    term: "Preview & deployment",
    plain:
      "A preview lets you try a build before it serves the main audience. Deployment makes a build available in an environment, which can be a preview or production.",
    example:
      "Reverie’s refreshed page is deployed to a separate preview for review before anyone decides to publish it for real visitors.",
    whyItMatters:
      "A preview address is not a guarantee of isolated data. Confirm the services it uses and test the real tasks before approving a production release.",
    sourceIds: ["vercel-environments", "govuk-prototypes"],
  },
];

export const FIELD_GUIDE_CHOICES: readonly FieldGuideChoice[] = [
  {
    id: "scope",
    title: "Choose a starting path",
    trailLabel: "Starting point",
    question: "Reverie has a little studio to share with the world. Where are we beginning?",
    termIds: ["frontend-backend", "component", "backup-rollback", "prototype-production"],
    options: [
      {
        id: "existing",
        label: "Refresh a page that already works",
        benefit: "Keep the useful features, familiar routes, and work already invested.",
        tradeoff:
          "The first styling trial fits the current structure; larger redesign ideas need their own scope.",
        downstream: [
          "List the tasks and content that must stay intact.",
          "Keep a recoverable version and compare a small change in a separate preview.",
          "Target can prepare scoped styling and instructions for a builder to apply.",
        ],
        route: "/target",
      },
      {
        id: "new",
        label: "Begin with an empty project",
        benefit: "Choose the structure and content around the task from the beginning.",
        tradeoff:
          "The page’s real features and any data services still need to be built and tested.",
        downstream: [
          "Decide what the visitor needs to know and do before choosing a layout.",
          "Choose whether an existing service can handle the main action or new behavior is needed.",
          "Target’s new-project handoff supplies design guidance and starter styling, not a finished app.",
        ],
        route: "/target",
      },
    ],
  },
  {
    id: "emphasis",
    title: "Place the first signpost",
    trailLabel: "First impression",
    question: "What should visitors to Reverie’s pottery class notice first?",
    termIds: ["ui-ux", "hierarchy", "primary-action", "design-tokens", "contrast"],
    options: [
      {
        id: "action-first",
        label: "Help them find and book a class",
        benefit: "People with a clear intention can quickly find the practical details.",
        tradeoff:
          "The opening has less room for a long story, so supporting context needs careful placement.",
        downstream: [
          "Bring the class, price, date information, and main action close together.",
          "Give the booking action clear emphasis while leaving other useful links available.",
          "Check that its label and destination describe the same next step.",
        ],
        route: "/?view=studio",
      },
      {
        id: "story-first",
        label: "Help them picture the experience",
        benefit:
          "Real work and a short story can help an unfamiliar visitor decide if the class fits.",
        tradeoff: "Visitors ready to book still need a clear route to the practical details.",
        downstream: [
          "Lead with an informative image and a concise explanation of the experience.",
          "Keep the class details and booking action easy to reach rather than hiding them in decoration.",
          "Check the image description, text hierarchy, and reading order on a narrow screen.",
        ],
        route: "/?view=studio",
      },
    ],
  },
  {
    id: "behavior",
    title: "Decide what happens next",
    trailLabel: "What happens next",
    question: "A visitor is interested. How will the page help them take the next step?",
    termIds: ["static-interactive", "state", "responsive", "breakpoint", "accessibility"],
    options: [
      {
        id: "static",
        label: "Link to an existing booking service",
        benefit:
          "A focused information page can hand the booking task to a service that already exists.",
        tradeoff:
          "The visitor moves to that service, so its availability and experience also matter.",
        downstream: [
          "Provide a real destination and explain that booking continues there.",
          "Check the link, keyboard access, and readable layout in the delivered page.",
          "Try the receiving service too; a working link alone does not prove the booking flow works.",
        ],
        route: "/quality",
      },
      {
        id: "interactive",
        label: "Request a booking on this page",
        benefit: "Keep the task in one place and tailor its feedback to the visitor.",
        tradeoff:
          "The builder must implement the form, its real submission service, and its recovery states.",
        downstream: [
          "Define what is selected, what is being sent, and what an actual success means.",
          "Plan loading, invalid-input, failure, and empty-availability messages; preserve useful answers.",
          "Test the real flow with a keyboard, narrow screens, and unsuccessful requests. Focus guidance does not implement it for you.",
        ],
        route: "/quality",
      },
    ],
  },
  {
    id: "visual-details",
    title: "Pack the visual details",
    trailLabel: "Fonts & images",
    question: "How will Reverie’s lettering and class pictures travel with the page?",
    note: "These are example plans. In a real project, you can mix device fonts, distinctive fonts, one image or several images to suit the task.",
    termIds: ["font-fallback", "image-alt", "responsive", "contrast"],
    options: [
      {
        id: "lightweight",
        label: "Start with device fonts and one useful image",
        benefit: "Keep the first page light and concentrate on readable words and a clear task.",
        tradeoff:
          "The font can look different across devices, and one image has to earn its place.",
        downstream: [
          "Check the actual heading and button wrapping with the available fonts on different screens.",
          "Use an image you have permission to share, with an appropriate crop and text alternative.",
          "Keep readable contrast and a useful layout even when the image cannot load.",
        ],
        route: "/?view=studio",
      },
      {
        id: "distinctive",
        label: "Plan distinctive fonts and a coordinated image set",
        benefit:
          "Build a more recognizable visual personality with deliberate lettering and imagery.",
        tradeoff:
          "The builder needs the correct licensed files, responsive crops and dependable fallbacks.",
        downstream: [
          "List the actual font files, weights and image assets the builder needs; a style name does not supply them.",
          "Check permissions, font loading, missing characters and readable fallbacks before release.",
          "Test image sizes, crops and meaningful alternatives on the delivered page. This practice choice does not supply the files or implement the asset plan.",
        ],
        route: "/target",
      },
    ],
  },
  {
    id: "handoff",
    title: "Cross the preview bridge",
    trailLabel: "Careful handoff",
    question: "The direction feels right. How should the builder introduce it to the working site?",
    termIds: ["repository-branch", "pull-request", "preview-deployment", "backup-rollback"],
    options: [
      {
        id: "one-page",
        label: "Try one useful page first",
        benefit: "Keep the first change small enough to compare, test and undo clearly.",
        tradeoff:
          "The rest of the site keeps its earlier appearance until later changes are reviewed.",
        downstream: [
          "Name the page, the tasks to preserve and a recoverable starting version before editing.",
          "Review the exact changes in an isolated preview with test data, including unsuccessful tasks.",
          "Demonstrate selective rollback and review the result before approving a release through the project’s own workflow.",
        ],
        route: "/target",
      },
      {
        id: "phased",
        label: "Plan a coordinated refresh in small stages",
        benefit:
          "Give several related pages a consistent direction while introducing the change gradually.",
        tradeoff:
          "Shared components and cross-page journeys need coordination and checks at every stage.",
        downstream: [
          "Map the pages and shared components, then agree the first bounded trial with the builder.",
          "Give each stage its own preview, preservation checks and selective rollback plan.",
          "Review the connected journey after each stage. Target prepares a one-page trial; it does not automatically coordinate or deploy the full refresh.",
        ],
        route: "/target",
      },
    ],
  },
];
