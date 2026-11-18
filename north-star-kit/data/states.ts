import type { RuleRecord } from '../types';
import { builder, coga, compositePatterns, dialog, keyboard, reviewed, wcag } from './sources';

export const stateNames = ['rest', 'hover', 'keyboard-focus', 'pressed', 'disabled', 'loading', 'error', 'empty', 'selected'] as const;
export type StateName = typeof stateNames[number];
export type Part = 'button' | 'link' | 'text-field' | 'select' | 'checkbox' | 'radio' | 'switch' | 'tab' | 'menu' | 'dialog' | 'tooltip' | 'notice' | 'table-row' | 'card';
export type StateDescription = { state: StateName; requiredWhen: string; visibleDifference: string };
const differences: Record<StateName, string> = {
  rest: 'Show the purpose or value with enough contrast and a clear label.',
  hover: 'For pointer actions, change a visible cue without moving the target; keep essential information available without hover.',
  'keyboard-focus': 'For keyboard actions, show a clear outline distinct from selection and never cover it with nearby content.',
  pressed: 'For actions, show a brief depressed or filled state immediately while the press is held.',
  disabled: 'Explain why the action is unavailable; distinguish it from rest without hiding its label.',
  loading: 'Keep the final layout space, name the work in progress, and prevent accidental duplicate requests.',
  error: 'Place a plain description and recovery action beside the relevant content; preserve entered values.',
  empty: 'Say what belongs here and give the next useful action; do not display fabricated content.',
  selected: 'Show selection with a persistent shape, marker, or text cue as well as color; keep it distinct from keyboard focus.',
};
const applicability: Record<Part, Partial<Record<StateName, string>>> = {
  button: { rest: 'Always.', hover: 'When enabled.', 'keyboard-focus': 'When enabled or intentionally focusable for an explanation.', pressed: 'When activated.', disabled: 'When the action cannot run.', loading: 'When its action takes time.', error: 'When its action fails.', selected: 'When this is a toggle button.' },
  link: { rest: 'Always.', hover: 'When it navigates.', 'keyboard-focus': 'When it navigates.', pressed: 'During activation.', loading: 'When navigation waits in the current view.', error: 'When navigation fails.' },
  'text-field': { rest: 'Always.', hover: 'When pointer interaction is available.', 'keyboard-focus': 'When editable or readable by keyboard.', disabled: 'When unavailable.', loading: 'When a value is being checked.', error: 'When input is invalid.', empty: 'When no value is entered.', selected: 'When text is selected.' },
  select: { rest: 'Always.', hover: 'When enabled.', 'keyboard-focus': 'When enabled.', pressed: 'When opening choices.', disabled: 'When unavailable.', loading: 'When choices are loading.', error: 'When a required choice is invalid.', empty: 'When no choice exists or is selected.', selected: 'When a value is chosen.' },
  checkbox: { rest: 'Always.', hover: 'When enabled.', 'keyboard-focus': 'When enabled.', pressed: 'During activation.', disabled: 'When unavailable.', error: 'When a required choice is missing.', selected: 'When checked or mixed.' },
  radio: { rest: 'Always.', hover: 'When enabled.', 'keyboard-focus': 'When enabled.', pressed: 'During activation.', disabled: 'When unavailable.', error: 'When a required choice is missing.', selected: 'When this option is checked.' },
  switch: { rest: 'Always.', hover: 'When enabled.', 'keyboard-focus': 'When enabled.', pressed: 'During activation.', disabled: 'When unavailable.', loading: 'When the setting is being saved.', error: 'When saving fails.', selected: 'When the setting is on.' },
  tab: { rest: 'Always.', hover: 'When enabled.', 'keyboard-focus': 'When enabled.', pressed: 'During activation.', disabled: 'When unavailable.', loading: 'When its panel is loading.', error: 'When its panel fails.', selected: 'When its panel is shown.' },
  menu: { rest: 'When opened.', hover: 'For enabled menu items.', 'keyboard-focus': 'For the active menu item.', pressed: 'When an item is activated.', disabled: 'For unavailable items.', loading: 'When items are loading.', error: 'When an item action fails.', empty: 'When no actions are available.', selected: 'For checkable or current items.' },
  dialog: { rest: 'When opened.', 'keyboard-focus': 'On its initial focus target and each action.', loading: 'When its content or action is pending.', error: 'When the task fails.', empty: 'When expected content is absent.' },
  tooltip: { rest: 'When its trigger is hovered or focused.', hover: 'When the pointer moves into the help content.', 'keyboard-focus': 'On the trigger; the tooltip itself should not contain interactive controls.', empty: 'Never show an empty tooltip.' },
  notice: { rest: 'Whenever shown.', 'keyboard-focus': 'On any dismiss or recovery control.', loading: 'When reporting a pending task.', error: 'When reporting failure.' },
  'table-row': { rest: 'Whenever shown.', hover: 'Only if the row contains an action or helps track a row.', 'keyboard-focus': 'On interactive cells or a row in a keyboard grid.', pressed: 'When the row itself is an action.', disabled: 'When a row action is unavailable.', loading: 'When row data is pending.', error: 'When this row could not be loaded or saved.', empty: 'At table level when no rows exist.', selected: 'When row selection is supported.' },
  card: { rest: 'Whenever shown.', hover: 'Only if the card or a contained control is interactive.', 'keyboard-focus': 'On actual links and controls, not a decorative container.', pressed: 'When the card itself is an action.', disabled: 'When a card action is unavailable.', loading: 'When card content is pending.', error: 'When card data failed.', empty: 'When the card represents missing content.', selected: 'When selecting cards is part of the task.' },
};
export const stateSheet: Record<Part, StateDescription[]> = Object.fromEntries(
  (Object.keys(applicability) as Part[]).map(part => [part, stateNames.map(state => ({
    state, requiredWhen: applicability[part][state] ?? 'Not normally applicable; add only when this part exposes that behavior.',
    visibleDifference: differences[state],
  }))]),
) as Record<Part, StateDescription[]>;

export const stateRules: RuleRecord[] = [{
  id: 'state-complete-feedback', group: 'state', plain: 'Give each interactive part a clear appearance for every state it can enter.',
  why: 'Without a visible difference, people cannot tell whether an action started, finished, failed, or is unavailable.',
  check: { kind: 'person', ask: 'Exercise each applicable entry in the state sheet, including loading, empty, and error states; do the labels and visible cues explain what happened?' },
  overridable: true, evidence: 'convention', sources: [coga('4.5.10 Provide Feedback'), builder('The component-by-state sheet is original project guidance.')], reviewed,
}];
const person = (id: string, plain: string, why: string, ask: string, sources: RuleRecord['sources'], floor = false): RuleRecord => ({
  id, group: floor ? 'floor' : 'behavior', plain, why, check: { kind: 'person', ask }, overridable: !floor,
  evidence: sources.every(s => s.basis === 'builder') ? 'expert-opinion' : 'convention', sources, reviewed,
});
export const behaviorRules: RuleRecord[] = [
  person('floor-keyboard-task', 'Make every task operable with a keyboard in a sensible order.', 'A person who cannot use a pointer still needs to reach and operate every action.', 'Complete each main task using Tab, Shift+Tab, Enter, Space, and the relevant arrow keys; check focus order and unexpected traps.', [keyboard, wcag('2.1.1 Keyboard; 2.4.3 Focus Order')], true),
  person('floor-visible-focus', 'Keep a visible keyboard indicator with at least 3:1 contrast against adjacent colors.', 'Without a visible indicator, people lose track of which control their next key press will operate.', 'Move through every keyboard target in every theme; inspect the indicator and measure its contrast against all adjacent colors.', [keyboard, wcag('1.4.11 Non-text Contrast; 2.4.7 Focus Visible')], true),
  person('behavior-dialog', 'Keep keyboard focus inside an open modal, close it on Escape, and return to the opener.', 'An invisible or misplaced keyboard position makes a modal hard to operate and leave.', 'Run the dialog scripted walk with real selectors, test both ends of the tab order, then close and verify the opener regains focus or a justified next task target.', [dialog]),
  person('behavior-composite-keys', 'Use the expected arrow-key behavior inside menus, tab sets, and listboxes.', 'A familiar-looking control becomes confusing if its keys behave differently.', 'Run each applicable scripted walk, including first and last items, disabled options, selection, and horizontal versus vertical orientation.', [keyboard, ...compositePatterns]),
  { id: 'floor-target-size', group: 'floor', plain: 'Give every checked pointer target a box at least 24 by 24 CSS pixels.', why: 'Small targets are easy to miss or activate by mistake.', appliesWhen: 'This strict project floor includes targets that WCAG may exempt for spacing, inline placement, or equivalent controls.', check: { kind: 'page-check', fn: 'checkTargetSize' }, overridable: false, evidence: 'expert-opinion', sources: [wcag('2.5.8 Target Size (Minimum); this project intentionally does not apply its exceptions'), builder('A strict 24 by 24 box is a project policy, not a complete WCAG assessment.')], reviewed },
  person('behavior-comfort-targets', 'Use targets at least 44 by 44 CSS pixels when the design calls for comfort.', 'Extra target area reduces precision needed for repeated or touch actions.', 'Measure the main controls in the comfortable design and check the space between them.', [wcag('2.5.5 Target Size (Enhanced)')]),
  person('behavior-loading-space', 'Reserve the final content’s space while it loads.', 'A moving layout can make a person press the wrong control or lose their reading position.', 'Throttle loading and compare the pending and finished layout; check that placeholders describe loading and do not impersonate real content.', [builder('Stable loading layouts are an engineering and design judgment.')]),
  person('behavior-empty-next-step', 'Explain an empty list and offer its next useful action.', 'A blank area leaves people unsure whether the task worked or where to go next.', 'Open each empty state and verify it names the missing content and gives a relevant action or explanation.', [builder('Empty-state copy and action guidance is a design judgment.')]),
  person('behavior-reversible-actions', 'Allow undo or confirmation before an action permanently removes work.', 'An accidental action should not silently destroy something the person values.', 'Perform destructive actions with representative data; verify confirmation is meaningful or undo restores the removed data.', [wcag('3.3.4 Error Prevention (Legal, Financial, Data)')]),
];

// Templates: callers replace selector values with verified selectors for their own page.
// These steps are instructions for a driver, never evidence that the behavior already holds.
export const scriptedWalks = [
  { id: 'dialog', ruleId: 'behavior-dialog', setup: 'Start with the dialog closed and its opener focused; replace the example selectors.', steps: [
    { action: 'press', key: 'Enter' }, { action: 'expect-focus-within', selector: '#example-dialog' },
    { action: 'focus', selector: '#example-dialog-last' }, { action: 'press', key: 'Tab' }, { action: 'expect-focus', selector: '#example-dialog-first' },
    { action: 'press', key: 'Shift+Tab' }, { action: 'expect-focus', selector: '#example-dialog-last' },
    { action: 'press', key: 'Escape' }, { action: 'expect-hidden', selector: '#example-dialog' }, { action: 'expect-focus', selector: '#example-dialog-opener' },
  ] },
  { id: 'tabs', ruleId: 'behavior-composite-keys', setup: 'Use horizontal tabs with manual activation; focus the first tab and replace example selectors. Automatic activation needs its own panel expectation.', steps: [
    { action: 'press', key: 'ArrowRight' }, { action: 'expect-focus', selector: '#example-tab-two' },
    { action: 'press', key: 'Enter' }, { action: 'expect-visible', selector: '#example-panel-two' },
    { action: 'press', key: 'ArrowLeft' }, { action: 'expect-focus', selector: '#example-tab-one' },
  ] },
  { id: 'menu', ruleId: 'behavior-composite-keys', setup: 'Open a vertical menu with at least two enabled items; focus the first item and replace example selectors.', steps: [
    { action: 'press', key: 'ArrowDown' }, { action: 'expect-focus', selector: '#example-menu-item-two' },
    { action: 'press', key: 'ArrowUp' }, { action: 'expect-focus', selector: '#example-menu-item-one' },
    { action: 'press', key: 'Escape' }, { action: 'expect-focus', selector: '#example-menu-opener' },
  ] },
  { id: 'listbox', ruleId: 'behavior-composite-keys', setup: 'Place keyboard focus in a single-select vertical listbox whose first option is active; replace example selectors. Active descendants count as active focus.', steps: [
    { action: 'press', key: 'ArrowDown' }, { action: 'expect-active-option', selector: '#example-option-two' },
    { action: 'press', key: 'ArrowUp' }, { action: 'expect-active-option', selector: '#example-option-one' },
  ] },
] as const;
