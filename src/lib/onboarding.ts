import { REVERIE } from "./reverie";

export const ONBOARDING_KEY = "focus:welcome:v1";

export const ONBOARDING_STEPS = [
  {
    id: "welcome",
    shortTitle: "Meet Focus",
    title: "Welcome to Focus. Let's make something feel like you.",
    reverie: REVERIE.introduction,
    summary:
      "Focus helps you choose a visual direction, review a public page, and prepare a design handoff. You keep control of your project and its release.",
    tasks: [
      "For a new project, explore the Design studio and choose a direction. For a working app or website, follow the existing-project path in this guide.",
      "Your design plan is called Vision. Target helps you prepare a saved design for a real project. Horizon shows project progress and next steps. Telescope holds advanced build inspection and test-planning tools.",
      "You can open the tools as you go and return to this guide. Opening the guide does not replace your current design.",
      "Reading a guide is preparation, not proof that a project is ready. Your own app still needs testing before changes go live.",
    ],
  },
  {
    id: "protect",
    shortTitle: "Protect your work",
    title: "Make a place where it's safe to try.",
    reverie: "Let's keep the original comfortable while we explore.",
    summary:
      "Start with a separate local or staging copy. A branch alone is not enough if it still uses production data or integrations.",
    tasks: [
      "Save a named backup or commit, including uncommitted work. Keep the original project and write down the backup name or commit hash.",
      "In your own host or coding tool, create an isolated preview. Disconnect production credentials, webhooks, email delivery and payment services; use test accounts, sandbox services and test data.",
      "List your routes and important tasks: sign-in, forms, navigation, saving, checkout and role permissions where applicable. Record their working behavior and before screenshots on desktop and phone.",
      "If you already have Focus designs, open My designs and choose Back up library. A Focus library backup does not back up your website's source or database.",
    ],
  },
  {
    id: "review",
    shortTitle: "Review a page",
    title: "Bring your published page into view.",
    reverie: "I can look at the page without moving the furniture.",
    summary:
      "Open Check a live site and paste a public page address you are authorized to review. On the hosted app, sign in first. This reads the page; it does not connect a writable project account.",
    tasks: [
      "Use the normal public address, without passwords, access tokens or private query parameters. Run the measured review and keep the findings as a baseline.",
      "The checker makes bounded public HTML and CSS reads. It does not sign in to the customer app, run its scripts, submit forms, or install changes.",
      "For a private app, skip the URL check. Describe the project in the studio and test it in your own private preview. Do not make private staging public just to use this check.",
      "A public-page score cannot prove that authenticated tasks, interactive behavior or every page works. Keep your original task list for the trial.",
    ],
  },
  {
    id: "design",
    shortTitle: "Choose a direction",
    title: "Give your existing project a clear Vision.",
    reverie: "A little color, a little clarity. Still your project.",
    summary:
      "In the Design studio, under Where will this design go?, choose Restyle my existing site or app. Opening the studio keeps your current work; the guide does not reset it or switch its mode for you.",
    tasks: [
      "Describe the actual business, audience and main visitor task. Keep real customer copy and working functionality in the original app.",
      "Choose a direction, answer the design questions, and review your choices. The preview is a style study; its sample text and navigation are not replacements for customer content.",
      "Continue to Vision. Check that Restyle my existing site or app is still selected before copying instructions or downloading a pack.",
      "If you are editing a different saved design, finish or back up that work before deliberately starting another. Use My designs to reopen a saved design.",
    ],
  },
  {
    id: "pack",
    shortTitle: "Prepare the handoff",
    title: "Take the right pieces with you.",
    reverie: "Packed with care. Let's check the label together.",
    summary:
      "Open Target to choose a saved design and answer a few questions about your project, visitor tasks, backup and trial. You can also download an existing-site pack from Vision, under Design specification & handoff tools.",
    tasks: [
      "In Target, choose Restyle an existing app or website. Describe one visible improvement and the tasks that must keep working. Its project-specific prompts and design pack prepare the trial; they do not apply changes for you.",
      "Extract the ZIP into a new, empty location. It contains a focus-restyle folder. If that folder already exists in the destination project, stop and choose a fresh name; never merge over existing files.",
      "Read START-HERE.md, PRESERVE.md and UNDO.md inside the pack before asking your coding tool to change anything.",
      "Give the tool DESIGN.md and FOCUS-RULES.md, then use What to say to your tool, step by step in Focus. Append any optional rule reminder; never replace existing customer rules or configuration.",
      "Downloading a ZIP does not install it. Focus has no writable connection to your repository, CMS or hosting account. Apply the instructions in your own authorized tool, on the isolated copy.",
    ],
  },
  {
    id: "trial",
    shortTitle: "Try one page",
    title: "One page first. Keep everything that works.",
    reverie: "Small, reversible steps are my favorite kind.",
    summary:
      "Ask your coding tool for a visual-only change to one page in the isolated preview. Review the proposed file changes before accepting them.",
    tasks: [
      "Ask your coding tool to follow START-HERE.md and limit the trial to one page area. Keep the site's global theme unchanged and choose only the styling method compatible with that project's actual code.",
      "Have your developer check every affected text and background color together before turning on the new theme. Mixed or incompatible components need individual review; do not force the theme onto them.",
      "Preserve routes, customer copy, images, auth, data calls, validation, analytics and existing rules. Do not upgrade packages or replace project configuration as part of the visual trial.",
      "Check the diff with the project owner. If the tool changes functionality, stops a task working, or removes customer content, stop and selectively undo those trial edits.",
    ],
    developerDetails: [
      "Follow the pack's bridge instructions for the actual compiled component colors. Add data-focus-restyle to one page wrapper, never html or body; that exposes namespaced design values.",
      'Only add data-focus-theme="semantic" to the same wrapper after reviewing every affected component\'s paired text and background colors. Leave it off for mixed or incompatible components.',
    ],
  },
  {
    id: "verify",
    shortTitle: "Test and undo",
    title: "Prove the trial works—and that you can undo it.",
    reverie: "Let's try the real tasks, not just admire the picture.",
    summary:
      "Use the same isolated preview, test data and sandbox integrations. Record evidence for the same tasks before and after the change.",
    tasks: [
      "Test every recorded task, including sign-in and roles, form errors, navigation, saves and sandbox checkout where present. Check phone and desktop widths, keyboard-only use, focus visibility and readable text contrast.",
      "Inspect dialogs, menus and portals as well as the main page. Watch for console errors, failed requests, unexpected production connections and changes to customer data.",
      "Rehearse UNDO.md: remove only the added markers, imports, links and rule block, and selectively undo any component edits. Preserve pre-existing files and unrelated later work. Never hard-reset the customer's project.",
      "Rerun the original tasks after rollback and compare the original screenshots. If anything fails, keep production unchanged and fix the cause before another trial.",
    ],
  },
  {
    id: "publish",
    shortTitle: "Review and release",
    title: "Publish through your own tool, with evidence in hand.",
    reverie: "A thoughtful finish matters as much as a lovely beginning.",
    summary:
      "The project owner reviews the tested changes, before-and-after evidence and rollback plan before approving a release. Finishing this tour is not release approval.",
    tasks: [
      "Keep the backup and exact tested revision. Deploy only the approved changes through your existing host or coding tool; Focus does not deploy the customer app.",
      "After release, check the published page and essential journeys using an agreed production-safe smoke test. Do not create real payments, emails or data changes just to test a page.",
      "If behavior differs from the approved preview, stop expansion and use the reviewed rollback plan. Investigate before trying another page.",
      "For public pages, use Check a live site again as an additional measured comparison. Continue monitoring your own error logs and user feedback; a good score does not certify the whole app.",
    ],
  },
] as const;

export type OnboardingProgress = { version: 1; step: number; finished: boolean };
export const EMPTY_ONBOARDING: OnboardingProgress = { version: 1, step: 0, finished: false };

export function parseOnboardingProgress(raw: string | null): OnboardingProgress | null {
  if (raw === null) return { ...EMPTY_ONBOARDING };
  if (raw.length > 2048) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const state = value as Record<string, unknown>;
    if (
      state["version"] !== 1 ||
      !Number.isInteger(state["step"]) ||
      typeof state["finished"] !== "boolean"
    )
      return null;
    const step = Math.max(0, Math.min(ONBOARDING_STEPS.length - 1, state["step"] as number));
    // Store no project URLs, credentials, acceptance evidence or other unknown fields.
    return {
      version: 1,
      step,
      finished: state["finished"] && step === ONBOARDING_STEPS.length - 1,
    };
  } catch {
    return null;
  }
}

export function readOnboardingProgress(storage: Pick<Storage, "getItem">): {
  progress: OnboardingProgress;
  issue: "unavailable" | "invalid" | null;
} {
  try {
    const parsed = parseOnboardingProgress(storage.getItem(ONBOARDING_KEY));
    return { progress: parsed ?? { ...EMPTY_ONBOARDING }, issue: parsed ? null : "invalid" };
  } catch {
    return { progress: { ...EMPTY_ONBOARDING }, issue: "unavailable" };
  }
}

export function saveOnboardingProgress(
  storage: Pick<Storage, "setItem">,
  progress: OnboardingProgress,
): boolean {
  const parsed = parseOnboardingProgress(JSON.stringify(progress));
  if (!parsed) return false;
  try {
    storage.setItem(ONBOARDING_KEY, JSON.stringify(parsed));
    return true;
  } catch {
    return false;
  }
}

export function onboardingChecklist(): string {
  return `# Focus: existing-project trial checklist\n\nThis is a blank working guide, not a test result or a release approval. Fill it out separately for each project and trial. Never include passwords or tokens.\n\nProject / owner: ____________________\nIsolated preview: ____________________\nBackup / exact revision: ____________________\nTrial scope: ____________________\n\n${ONBOARDING_STEPS.slice(
    1,
  )
    .map(
      (step) =>
        `## ${step.shortTitle}\n\n${step.summary}\n\n${step.tasks.map((task) => `- [ ] ${task}`).join("\n")}\n${"developerDetails" in step ? `\n### Details for your developer\n\n${step.developerDetails.map((task) => `- [ ] ${task}`).join("\n")}\n` : ""}`,
    )
    .join(
      "\n",
    )}\n## Evidence and decision\n\n| Task / route / role | Before evidence | After evidence | Rollback evidence | Result / issue |\n| --- | --- | --- | --- | --- |\n| | | | | |\n\nUnresolved issues: ____________________\nOwner-reviewed release decision: ____________________\nApproved revision and rollback plan: ____________________\n\nFocus only reads public pages and prepares design files. External coding tools and extractors can overwrite files; follow the fresh-folder and isolated-preview procedure. Public HTML checks do not verify authenticated workflows. Keep production unchanged until the project owner has reviewed the evidence and approved the tested release.\n`;
}
