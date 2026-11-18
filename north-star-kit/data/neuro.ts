import type { RuleRecord } from '../types';
import { builder, coga, reviewed, wcag } from './sources';

export const neuroLimit = 'These rules address known barriers; they do not show that a page works for a person with ADHD, autism, or dyslexia. Test the intended tasks with people who have those experiences.';

export type Choice = { id: string; label: string; what: string; when: string; watch: string };
export type Question = { id: string; question: string; variable: string; choices: Choice[] };
export const neuroQuestions: Question[] = [
  {
    id: 'reading-comfort', question: 'How much breathing room should reading have?', variable: 'reading comfort',
    choices: [
      { id: 'standard', label: 'Comfortable', what: 'A familiar typeface, lines near 60 characters, 1.5 line spacing, and a clear gap between paragraphs.', when: 'Start here for ordinary reading and short forms.', watch: 'Keep alignment at the start edge; do not justify text. Preserve user letter and word spacing.' },
      { id: 'spacious', label: 'More space', what: 'Shorter lines, 1.7 line spacing, larger paragraph gaps, and a familiar typeface with distinct letters.', when: 'Use when readers report losing their place or the page has long explanations.', watch: 'More space adds scrolling. Do not assume one typeface or spacing setting suits everyone with dyslexia.' },
      { id: 'personal', label: 'Let me choose', what: 'Let readers adjust typeface, line length, and line, paragraph, letter, and word spacing independently.', when: 'Use for frequent reading where a saved personal setting is useful.', watch: 'Every setting must preserve labels, controls, and complete text; provide a reset.' },
    ],
  },
  {
    id: 'density', question: 'How much should be visible at once?', variable: 'content density',
    choices: [
      { id: 'quiet', label: 'One main task', what: 'Show the current task and only its next useful actions.', when: 'Use for unfamiliar or stressful tasks.', watch: 'Keep essential context visible instead of hiding everything in menus.' },
      { id: 'balanced', label: 'A little context', what: 'Show the current task with a small amount of related information.', when: 'Use when people need to compare or refer back while working.', watch: 'Do not let notices, moving decorations, or secondary panels compete with the task.' },
      { id: 'dense', label: 'More at a glance', what: 'Group more information into clear sections with an optional simpler view.', when: 'Use for experienced people working repeatedly with tables or dashboards.', watch: 'Keep text readable and pointer targets large; test the simple view with intended users.' },
    ],
  },
  {
    id: 'predictability', question: 'How much guidance should stay visible?', variable: 'visible orientation support',
    choices: [
      { id: 'steady', label: 'Steady navigation', what: 'Keep shared controls in the same order with the same names.', when: 'Use as the baseline on every page.', watch: 'Do not change context merely because someone enters a field or selects a value.' },
      { id: 'guided', label: 'Show my progress', what: 'Add the current step, completed steps, and what comes next.', when: 'Use for tasks that take more than one page or may be interrupted.', watch: 'Steps should help people resume; avoid making optional tasks compulsory.' },
      { id: 'resumable', label: 'Help me return', what: 'Show saved choices and a clear route back to unfinished work.', when: 'Use for long tasks that people may leave and return to.', watch: 'Explain what is actually saved, and never claim a save succeeded before it did.' },
    ],
  },
  {
    id: 'interruptions', question: 'When may optional notices appear?', variable: 'interruption timing',
    choices: [
      { id: 'requested', label: 'Only when I ask', what: 'Put optional messages in a place the person opens themselves.', when: 'Use during reading, forms, and any task needing sustained attention.', watch: 'Urgent safety and task errors still need clear, relevant notice.' },
      { id: 'between', label: 'Between tasks', what: 'Show dismissible optional notices after a task finishes.', when: 'Use for helpful updates that can wait.', watch: 'Do not steal keyboard focus or cover the confirmation of the completed task.' },
      { id: 'chosen', label: 'On my schedule', what: 'Let people choose notice types, timing, and a quiet period.', when: 'Use for collaboration or ongoing work with repeated updates.', watch: 'Honor dismissal and quiet settings across pages; chat bubbles are optional notices too.' },
    ],
  },
];

const floor = (id: string, plain: string, why: string, ask: string, section: string): RuleRecord => ({
  id, group: 'floor', plain, why, check: { kind: 'person', ask }, overridable: false,
  evidence: 'convention', sources: [wcag(section)], reviewed,
});
export const neuroRules: RuleRecord[] = [
  { ...floor('floor-no-autoplay', 'Start sound, video, and advancing slides only when the person asks.', 'Unrequested changes can interrupt reading and cause loss of place.', 'Observe first load and every interactive state for media or slides that start without a request.', '1.4.2 Audio Control; 2.2.2 Pause, Stop, Hide'), check: { kind: 'page-check', fn: 'checkAutoplay' }, evidence: 'expert-opinion', sources: [wcag('1.4.2 Audio Control; 2.2.2 Pause, Stop, Hide'), builder('Stricter project policy: no autoplay, including muted video. Static media checks cannot establish script or carousel behavior.')] },
  floor('floor-flashing', 'Do not flash content more than three times in one second.', 'Rapid flashing can cause seizures and distress.', 'Review recordings of every moving state with a suitable flash-analysis tool; a still page cannot establish flash frequency.', '2.3.2 Three Flashes (AAA; stricter than 2.3.1 threshold exceptions)'),
  floor('floor-motion-control', 'Give movement lasting more than five seconds a visible pause or stop control.', 'Uncontrolled movement can prevent a person from reading other content.', 'Observe movement over time and operate its pause or stop control with pointer and keyboard.', '2.2.2 Pause, Stop, Hide; project policy also covers requested non-essential movement'),
  floor('floor-reduced-motion', 'Remove non-essential motion when the person requests reduced motion.', 'Motion can make a task uncomfortable or difficult to follow.', 'Enable reduced motion, then run each task and confirm non-essential animation stops while useful state feedback remains.', '2.3.3 Animation from Interactions; reduced-motion is the project mechanism'),
  { ...floor('floor-contrast-modes', 'Keep controls and their states visible in contrast preference and forced-colors modes.', 'A control can disappear when its only visible cue is a removed color or shadow.', 'Enable more contrast and forced colors in a real browser and check every control, selected state, and keyboard indicator.', '1.4.11 Non-text Contrast'), evidence: 'expert-opinion', sources: [wcag('1.4.11 Non-text Contrast'), builder('Explicit testing of preference modes is a project verification policy.')] },
  floor('floor-task-time', 'Let people complete tasks without a time limit or extend the time before it ends.', 'People may need more time to read, decide, or recover after an interruption.', 'Exercise sessions, forms, and expiring steps; verify warning and extension preserve entered work, and record any essential real-time exception.', '2.2.1 Timing Adjustable; project policy prefers no limit'),
  floor('floor-text-spacing', 'Keep all content and controls usable when reading spacing is increased.', 'Fixed boxes can cut off text when someone changes spacing to read comfortably.', 'Override line height to 1.5, paragraph gap to 2em, letter spacing to .12em, and word spacing to .16em; inspect every state for clipping and overlap.', '1.4.12 Text Spacing'),
  { ...floor('floor-reflow', 'Keep content available without page-wide sideways scrolling at 320 CSS pixels.', 'Sideways scrolling makes reading and following a task harder.', 'At 320 CSS pixels inspect for lost content; separately test browser zoom at 200%, including open menus and errors.', '1.4.10 Reflow; 1.4.4 Resize Text'), check: { kind: 'page-check', fn: 'checkReflow' }, sources: [wcag('1.4.10 Reflow; 1.4.4 Resize Text'), builder('Page-width check is narrower than complete reflow evaluation; two-dimensional content exceptions require review.')] },
  floor('floor-zoom-content', 'Keep every task usable when browser zoom is set to 200 percent.', 'Enlarging text must not hide the action or information a person needs.', 'Set actual browser zoom to 200 percent and complete the main task; inspect popovers, sticky areas, and validation errors for clipping.', '1.4.4 Resize Text'),
  { ...floor('floor-error-recovery', 'Name the field, explain the error, offer a correction, and keep the person’s input.', 'Vague errors and lost work make a small mistake expensive to recover from.', 'Submit invalid and interrupted forms; verify the error names the field and recovery, and previously entered values remain.', '3.3.1 Error Identification; 3.3.3 Error Suggestion'), sources: [wcag('3.3.1 Error Identification; 3.3.3 Error Suggestion'), coga('4.5.10 Provide Feedback; 4.4.1 Use Clear Words')] },
  { ...floor('floor-visible-labels', 'Keep a visible label beside every field while the person types.', 'A disappearing placeholder forces people to remember what the field asks for.', 'Check that every field has a visible persistent label.', '3.3.2 Labels or Instructions'), check: { kind: 'page-check', fn: 'checkVisibleLabels' } },
  { ...floor('floor-text-contrast', 'Give ordinary text at least 4.5:1 contrast and large text at least 3:1.', 'Low contrast makes letter shapes harder to distinguish.', 'Measure text against its actual background in all states.', '1.4.3 Contrast (Minimum)'), check: { kind: 'page-check', fn: 'checkTextContrast' }, appliesWhen: 'Visible text; logos, inactive controls, images, and complex backgrounds need separate review.' },
  { id: 'neuro-no-justification', group: 'neuro', plain: 'Align prose to its start edge instead of stretching it to both edges.', why: 'Uneven gaps between words can make a line harder to follow.', check: { kind: 'page-check', fn: 'checkJustification' }, overridable: true, evidence: 'convention', sources: [wcag('1.4.8 Visual Presentation (AAA; default start alignment is a project choice)')], reviewed },
  { id: 'neuro-readable-layout', group: 'neuro', plain: 'Use a clear reading order, short sections, and descriptive headings.', why: 'A clear structure helps people find the relevant information after an interruption.', check: { kind: 'person', ask: 'Can intended readers find the current task and resume it without rereading the whole page?' }, overridable: true, evidence: 'convention', sources: [coga('4.3.3 Use a Clear and Understandable Page Structure; 4.2.4 Make Each Step Clear')], reviewed },
  { id: 'neuro-interruptions', group: 'neuro', plain: 'Let people choose when optional notices interrupt their work.', why: 'An interruption can break concentration and cause someone to abandon a task.', check: { kind: 'person', ask: 'Complete the main task; do optional pop-ups, notices, banners, and chat bubbles respect the interruption choice and dismissal?' }, overridable: true, evidence: 'convention', sources: [coga('4.6.1 Limit Interruptions')], reviewed },
  { id: 'neuro-density', group: 'neuro', plain: 'Keep the main task clear and move optional detail out of its way.', why: 'Competing choices and content can make the next action difficult to locate.', check: { kind: 'person', ask: 'Ask intended users to find the next action and distinguish required work from optional detail.' }, overridable: true, evidence: 'convention', sources: [coga('4.6.2 Make Short Critical Paths; 4.6.3 Avoid Too Much Content')], reviewed },
  { id: 'neuro-predictability', group: 'neuro', plain: 'Keep shared controls in consistent places with consistent names.', why: 'Unexpected changes require a person to relearn a familiar task.', check: { kind: 'person', ask: 'Compare all main pages and revisit a task; do shared actions keep their name, relative order, and behavior?' }, overridable: true, evidence: 'convention', sources: [coga('4.3.3 Use a Clear and Understandable Page Structure')], reviewed },
];
