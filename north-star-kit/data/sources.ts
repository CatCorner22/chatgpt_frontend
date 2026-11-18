import type { SourceRef } from '../types';

export const reviewed = '2026-11-18';
export const wcag = (section: string): SourceRef => ({
  title: 'Web Content Accessibility Guidelines (WCAG) 2.2',
  url: 'https://www.w3.org/TR/WCAG22/', section, basis: 'read',
});
export const coga = (section: string): SourceRef => ({
  title: 'Making Content Usable for People with Cognitive and Learning Disabilities',
  url: 'https://www.w3.org/TR/coga-usable/', section, basis: 'read',
});
export const keyboard: SourceRef = {
  title: 'ARIA Authoring Practices: Developing a Keyboard Interface',
  url: 'https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/',
  section: 'Keyboard Navigation Inside Components; Focus VS Selection', basis: 'read',
};
export const dialog: SourceRef = {
  title: 'ARIA Authoring Practices: Dialog (Modal) Pattern',
  url: 'https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/',
  section: 'Keyboard Interaction', basis: 'read',
};
export const builder = (section: string): SourceRef => ({
  title: 'Project design judgment', section, basis: 'builder',
});
export const compositePatterns: SourceRef[] = [
  { title: 'ARIA Authoring Practices: Tabs Pattern', url: 'https://www.w3.org/WAI/ARIA/apg/patterns/tabs/', section: 'Keyboard Interaction', basis: 'read' },
  { title: 'ARIA Authoring Practices: Menu and Menubar Pattern', url: 'https://www.w3.org/WAI/ARIA/apg/patterns/menubar/', section: 'Keyboard Interaction', basis: 'read' },
  { title: 'ARIA Authoring Practices: Listbox Pattern', url: 'https://www.w3.org/WAI/ARIA/apg/patterns/listbox/', section: 'Keyboard Interaction', basis: 'read' },
];
