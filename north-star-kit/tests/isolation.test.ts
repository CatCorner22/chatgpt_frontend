import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.name === 'node_modules' || entry.name.startsWith('.') ? [] : entry.isDirectory() ? walk(resolve(dir, entry.name)) : entry.name.endsWith('.ts') ? [resolve(dir, entry.name)] : []);

describe('the folder transfers without app dependencies', () => {
  it('allows only internal imports and the three declared packages', () => {
    for (const file of walk(root)) {
      const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      const inTest = relative(root, file).startsWith(`tests${sep}`) || file.endsWith('vitest.config.ts');
      const visit = (node: ts.Node) => {
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
          const spec = node.moduleSpecifier.text;
          if (spec.startsWith('.')) expect(relative(root, resolve(dirname(file), spec)).startsWith('..'), `${file}: ${spec}`).toBe(false);
          else expect(spec === 'zod' || (inTest && (['vitest', 'vitest/config', 'typescript'].includes(spec) || spec.startsWith('node:'))), `${file}: ${spec}`).toBe(true);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
  });

  it('keeps computation deterministic and excludes executable page text', () => {
    const bannedMembers = ['inner' + 'HTML', 'ev' + 'al', 'fe' + 'tch'];
    const environmentNames = ['docu' + 'ment', 'win' + 'dow'];
    for (const file of walk(root).filter((path) => !path.includes(`${sep}tests${sep}`))) {
      const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      const pure = /[\\/](data|logic)[\\/]/.test(file);
      const visit = (node: ts.Node) => {
        if (ts.isIdentifier(node)) {
          expect(bannedMembers.includes(node.text), `${file}: ${node.text}`).toBe(false);
          if (pure) expect(environmentNames.includes(node.text), `${file}: ${node.text}`).toBe(false);
        }
        if (pure && ts.isCallExpression(node)) {
          const expression = node.expression.getText(source);
          expect(['Math.random', 'Date.now', 'performance.now'].includes(expression), file).toBe(false);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
  });

  it('uses neutral terminology in implementation modules', () => {
    const prohibited = ['Vis' + 'ion', 'Le' + 'ns', 'Watch' + 'tower', 'Prescrip' + 'tion', 'Fo' + 'cus', 'eye' + ' exam'];
    for (const file of walk(root).filter((path) => !path.includes(`${sep}tests${sep}`))) {
      // A standards section title is a citation, not a product term.
      const content = readFileSync(file, 'utf8').replaceAll('Focus Visible', 'Keyboard-visible indicator').replaceAll('Focus Order', 'Keyboard order').replaceAll('Focus VS Selection', 'Keyboard versus selection');
      for (const word of prohibited) expect(new RegExp(`\\b${word}\\b`).test(content), `${file}: ${word}`).toBe(false);
    }
  });
});
