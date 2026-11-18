import { parse } from "@babel/parser";
import type {
  File,
  FunctionDeclaration,
  ImportDeclaration,
  JSXAttribute,
  JSXElement,
  Node,
} from "@babel/types";
import parseCss from "postcss/lib/parse";
import type { Root } from "postcss";
import {
  classIdentifier,
  hasHiddenSourceText,
  readSourcePair,
  requireSourcePath,
  requireTrial,
  SourceTrialError,
  type SourceTrialFile,
  type SourceTrialInspection,
} from "./source-trial-model";

const NATIVE_TAGS = new Set(
  "main section div article header footer nav aside h1 h2 h3 h4 h5 h6 p small strong em b i span br hr form label fieldset legend input textarea select option button a ul ol li figure figcaption img".split(
    " ",
  ),
);
const WRAPPER_TAGS = ["main", "section", "div"];
const FUNCTION_NODES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
  "ObjectMethod",
  "ClassMethod",
  "ClassPrivateMethod",
]);
const compositing = new Set([
  "opacity",
  "filter",
  "backdrop-filter",
  "mix-blend-mode",
  "-webkit-text-fill-color",
]);
const stateSelector =
  /^\.([A-Za-z_][A-Za-z0-9_]{0,63})(?::(hover|active|focus|focus-visible|focus-within|disabled|visited))?$/;
const sixDigitHex = /^#[a-f0-9]{6}$/i;
const simpleBackground = /^(?:#[a-f0-9]{3}|#[a-f0-9]{6}|transparent|none)$/i;
const trialMarkerInSource = /\bfocusTrial_[a-f0-9]{12}\b/;

function parseComponent(source: string): File {
  try {
    return parse(source, {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
      attachComment: false,
      errorRecovery: false,
    });
  } catch {
    throw new SourceTrialError(
      "The selected TSX page could not be parsed as supported React source.",
    );
  }
}

function parseStylesheet(source: string): Root {
  requireTrial(
    !/(?:sourceMappingURL|sourceURL)\s*=/i.test(source),
    "Choose a CSS module without source-map or source-URL directives.",
  );
  try {
    const root = parseCss(source, { map: false });
    requireTrial(root.type === "root", "The selected CSS module could not be parsed.");
    return root;
  } catch {
    throw new SourceTrialError("The selected CSS module could not be parsed.");
  }
}

/** Babel nodes can be nested in arbitrary handler code. Avoid recursive traversal of that input. */
function indexNodes(root: Node): Map<Node, Node | null> {
  const parents = new Map<Node, Node | null>();
  const pending: [Node, Node | null][] = [[root, null]];
  while (pending.length) {
    const [node, parent] = pending.pop()!;
    if (parents.has(node)) continue;
    requireTrial(parents.size < 20_000, "The TSX page is too complex for this source trial.");
    parents.set(node, parent);
    for (const field of Object.values(node)) {
      for (const child of Array.isArray(field) ? field : [field]) {
        if (child && typeof child === "object" && typeof child.type === "string")
          pending.push([child as Node, node]);
      }
    }
  }
  return parents;
}

function nearestFunction(node: Node, parents: Map<Node, Node | null>): Node | null {
  for (let parent = parents.get(node); parent; parent = parents.get(parent)) {
    if (FUNCTION_NODES.has(parent.type)) return parent;
  }
  return null;
}

function readExports(ast: File): { page: FunctionDeclaration; module: ImportDeclaration } {
  const cssImports = ast.program.body.filter(
    (node): node is ImportDeclaration =>
      node.type === "ImportDeclaration" && /\.css(?:[?#]|$)/i.test(node.source.value),
  );
  const pageExport = ast.program.body.find((node) => node.type === "ExportDefaultDeclaration");
  const page = pageExport?.declaration;
  requireTrial(
    page?.type === "FunctionDeclaration" &&
      page.id &&
      classIdentifier.test(page.id.name) &&
      !page.async &&
      !page.generator,
    "Use a named, synchronous default page component with one native JSX return.",
  );
  requireTrial(
    cssImports.length === 1 && cssImports[0]!.source.value.startsWith("./"),
    "The page must import one relative CSS module directly.",
  );
  return { page, module: cssImports[0]! };
}

type NativeElement = {
  node: JSXElement;
  tag: string;
  className: string | null;
  end: number | null;
  inlineStyle: boolean;
  hidden: boolean;
  ancestors: readonly NativeElement[];
  primary: boolean;
};

function readElements(root: JSXElement, alias: string, allowedAliases: Set<Node>): NativeElement[] {
  const elements: NativeElement[] = [];
  const pending: { node: JSXElement; ancestors: NativeElement[] }[] = [
    { node: root, ancestors: [] },
  ];
  while (pending.length) {
    const { node, ancestors } = pending.pop()!;
    requireTrial(
      ancestors.length <= 64,
      "The page JSX is nested too deeply for this source trial.",
    );
    const { name, attributes } = node.openingElement;
    requireTrial(
      name.type === "JSXIdentifier" && NATIVE_TAGS.has(name.name),
      "Use native HTML elements in the selected page. Custom components need developer review.",
    );
    const attrs = new Map<string, JSXAttribute["value"]>();
    for (const attribute of attributes) {
      requireTrial(
        attribute.type === "JSXAttribute" &&
          attribute.name.type === "JSXIdentifier" &&
          !attrs.has(attribute.name.name) &&
          attribute.name.name !== "dangerouslySetInnerHTML",
        "The selected page uses JSX attributes outside the supported source shape.",
      );
      attrs.set(attribute.name.name, attribute.value);
    }
    const classAttribute = attrs.get("className");
    let className: string | null = null;
    let end: number | null = null;
    if (attrs.has("className")) {
      const member =
        classAttribute?.type === "JSXExpressionContainer" ? classAttribute.expression : undefined;
      requireTrial(
        member?.type === "MemberExpression" &&
          !member.computed &&
          member.object.type === "Identifier" &&
          member.object.name === alias &&
          member.property.type === "Identifier" &&
          classIdentifier.test(member.property.name) &&
          typeof member.end === "number",
        "Use a direct CSS module class such as styles.title for each styled element in the page.",
      );
      allowedAliases.add(member.object);
      className = member.property.name;
      end = member.end;
    }
    const buttonType = attrs.get("type");
    const primary =
      (name.name === "a" && attrs.has("href")) ||
      (name.name === "button" &&
        buttonType?.type === "StringLiteral" &&
        buttonType.value === "submit");
    const element = {
      node,
      tag: name.name,
      className,
      end,
      inlineStyle: attrs.has("style"),
      hidden: attrs.has("hidden"),
      ancestors,
      primary,
    };
    elements.push(element);
    for (const child of node.children) {
      if (child.type === "JSXElement")
        pending.push({ node: child, ancestors: [...ancestors, element] });
    }
  }
  const staticElements = new Set(elements.map((element) => element.node));
  for (const node of indexNodes(root).keys()) {
    requireTrial(
      node.type !== "JSXFragment" && (node.type !== "JSXElement" || staticElements.has(node)),
      "Keep the page roles in the native JSX tree. Conditional or repeated JSX needs developer review.",
    );
  }
  return elements;
}

function labelFor(element: NativeElement): string {
  const parts: string[] = [];
  for (const child of element.node.children) {
    if (child.type === "JSXText") parts.push(child.value);
    else if (child.type === "JSXExpressionContainer" && child.expression.type === "StringLiteral")
      parts.push(child.expression.value);
    else if (
      child.type !== "JSXExpressionContainer" ||
      child.expression.type !== "JSXEmptyExpression"
    )
      throw new SourceTrialError("Give the heading, text and action a direct, readable label.");
  }
  const decoded = parts.join("");
  requireTrial(!hasHiddenSourceText(decoded), "A page role label contains hidden or invalid text.");
  const label = decoded.replace(/\s+/g, " ").trim();
  requireTrial(
    label.length > 0 && label.length <= 400,
    "Give the heading, text and action a direct, readable label.",
  );
  return label;
}

function oneRole(elements: NativeElement[], role: string): NativeElement & { className: string } {
  requireTrial(
    elements.length === 1 && elements[0]!.className,
    `The selected page must identify one styled native ${role}.`,
  );
  return elements[0] as NativeElement & { className: string };
}

type Style = { state: boolean; property: string; value: string };

function readStyles(css: string): Map<string, Style[]> {
  const styles = new Map<string, Style[]>();
  let rules = 0;
  let declarations = 0;
  for (const rule of parseStylesheet(css).nodes) {
    if (rule.type === "comment") continue;
    requireTrial(rule.type === "rule", "Use a flat CSS module without at-rules or imports.");
    requireTrial(++rules <= 500, "The CSS module has too many rules for a source trial.");
    const match = stateSelector.exec(rule.selector);
    requireTrial(
      match,
      "Use local class selectors and supported interaction states in the CSS module.",
    );
    const className = match[1]!;
    const entries = styles.get(className) ?? [];
    styles.set(className, entries);
    for (const declaration of rule.nodes) {
      if (declaration.type === "comment") continue;
      requireTrial(
        declaration.type === "decl" && !declaration.important,
        "Nested rules and important CSS declarations need developer review.",
      );
      requireTrial(++declarations <= 2000, "The CSS module has too many style declarations.");
      const property = declaration.prop.toLowerCase();
      requireTrial(
        /^[a-z-][a-z0-9-]*$/.test(property) &&
          !["composes", "compose-with", "all"].includes(property) &&
          !declaration.raws.important,
        "CSS composition or unrecognized declarations need developer review.",
      );
      entries.push({ state: !!match[2], property, value: declaration.value.trim() });
    }
  }
  return styles;
}

function affectsGround(property: string): boolean {
  return (
    property === "background" || property.startsWith("background-") || compositing.has(property)
  );
}

function affectsColorOrFamily(property: string): boolean {
  return property === "color" || property === "font" || property === "font-family";
}

function hidesRole({ property, value }: Style): boolean {
  const normalized = value.toLowerCase();
  return (
    (property === "display" && normalized === "none") ||
    (property === "visibility" && ["hidden", "collapse"].includes(normalized)) ||
    (property === "content-visibility" && normalized === "hidden")
  );
}

function supportsRoleGround({ property, value }: Style, action: boolean): boolean {
  if (compositing.has(property)) return false;
  if (!affectsGround(property)) return true;
  const isColor = property === "background" || property === "background-color";
  return action
    ? (isColor && simpleBackground.test(value)) ||
        (property === "background-image" && value.toLowerCase() === "none")
    : isColor && value.toLowerCase() === "transparent";
}

function validateRoleStyles(
  roles: [
    NativeElement & { className: string },
    NativeElement & { className: string },
    NativeElement & { className: string },
  ],
  wrapper: NativeElement & { className: string },
  styles: Map<string, Style[]>,
): string {
  const wrapperStyles = styles.get(wrapper.className) ?? [];
  const backgrounds = wrapperStyles.filter(({ property }) => affectsGround(property));
  requireTrial(
    backgrounds.length === 1 &&
      !backgrounds[0]!.state &&
      !wrapperStyles.some(
        ({ property, value }) => property === "display" && value.toLowerCase() === "contents",
      ) &&
      ["background", "background-color"].includes(backgrounds[0]!.property) &&
      sixDigitHex.test(backgrounds[0]!.value),
    "The page wrapper needs one explicit, opaque six-digit hex background in its CSS module.",
  );
  roles.forEach((element, index) => {
    const roleStyles = styles.get(element.className) ?? [];
    requireTrial(
      roleStyles.some(({ state }) => !state),
      "Each selected role needs its own ordinary class rule in the CSS module.",
    );
    requireTrial(
      !element.inlineStyle && element.ancestors.every((ancestor) => !ancestor.inlineStyle),
      "An inline style on the page or a selected role needs developer review.",
    );
    requireTrial(
      [element, ...element.ancestors].every(
        (node) => !node.hidden && !(styles.get(node.className ?? "") ?? []).some(hidesRole),
      ),
      "Choose a page with each selected role visible in the supported markup and style states.",
    );
    const action = index === 2;
    const conflictingState = roleStyles.some(
      ({ state, property }) =>
        state &&
        (affectsColorOrFamily(property) ||
          (action && property.startsWith("border-") && property.endsWith("radius")) ||
          (action && affectsGround(property))),
    );
    requireTrial(
      !conflictingState &&
        element.ancestors.every((ancestor) =>
          (styles.get(ancestor.className ?? "") ?? []).every(
            ({ state, property }) => !state || !affectsColorOrFamily(property),
          ),
        ),
      "A selected interaction state changes a property used by this trial. Keep that state for developer review.",
    );
    requireTrial(
      roleStyles.every((style) => supportsRoleGround(style, action)) &&
        element.ancestors
          .filter((ancestor) => ancestor !== wrapper)
          .every((ancestor) =>
            (styles.get(ancestor.className ?? "") ?? []).every(
              ({ property }) => !affectsGround(property),
            ),
          ),
      "A selected role has another background or visual effect that prevents a reliable color pair.",
    );
  });
  return backgrounds[0]!.value.toLowerCase();
}

export function analyzeSourceTrial(files: readonly SourceTrialFile[]) {
  const [component, stylesheet] = readSourcePair(files);
  requireTrial(
    !trialMarkerInSource.test(component.content) && !trialMarkerInSource.test(stylesheet.content),
    "One of the selected files already contains a Focus trial. Review or reverse it before preparing another.",
  );
  const ast = parseComponent(component.content);
  const { page, module } = readExports(ast);
  const importPath = module.source.value.slice(2);
  requireSourcePath(importPath);
  const folder = component.path.slice(0, component.path.lastIndexOf("/") + 1);
  const binding = module.specifiers[0];
  requireTrial(
    stylesheet.path === folder + importPath &&
      module.importKind !== "type" &&
      module.specifiers.length === 1 &&
      binding?.type === "ImportDefaultSpecifier",
    "The selected stylesheet must match the page’s default CSS-module import, including its repository path.",
  );
  const alias = binding.local.name;
  requireTrial(
    classIdentifier.test(alias),
    "Use an ordinary identifier for the CSS module import.",
  );
  const parents = indexNodes(ast);
  const returns = [...parents.keys()].filter(
    (node) => node.type === "ReturnStatement" && nearestFunction(node, parents) === page,
  );
  const directReturn = returns[0];
  requireTrial(
    returns.length === 1 &&
      directReturn?.type === "ReturnStatement" &&
      page.body.body.includes(directReturn) &&
      directReturn.argument?.type === "JSXElement",
    "Use one direct JSX return. Multiple or conditional page layouts need developer review.",
  );
  const allowedAliases = new Set<Node>([binding.local]);
  const elements = readElements(directReturn.argument, alias, allowedAliases);
  for (const node of parents.keys()) {
    requireTrial(
      node.type !== "Identifier" || node.name !== alias || allowedAliases.has(node),
      "The CSS module binding is shadowed, changed or used outside direct page classes.",
    );
  }
  const wrapper = elements[0]!;
  requireTrial(
    WRAPPER_TAGS.includes(wrapper.tag) && wrapper.className && wrapper.end !== null,
    "Use one styled native main, section or div wrapper for the page.",
  );
  const heading = oneRole(
    elements.filter(({ tag }) => tag === "h1"),
    "heading",
  );
  const body = oneRole(
    elements.filter(({ tag, className }) => tag === "p" && className),
    "supporting paragraph",
  );
  const action = oneRole(
    elements.filter(({ primary, className }) => primary && className),
    "primary link or submit button",
  );
  const selected = [wrapper, heading, body, action];
  for (const selectedElement of selected) {
    requireTrial(
      elements.filter(({ className }) => className === selectedElement.className).length === 1,
      "The wrapper and each selected role need a class used by that element alone.",
    );
  }
  const styles = readStyles(stylesheet.content);
  const ground = validateRoleStyles(
    [heading, body, action],
    wrapper as NativeElement & { className: string },
    styles,
  );
  const inspection: SourceTrialInspection = {
    componentName: page.id!.name,
    componentPath: component.path,
    stylesheetPath: stylesheet.path,
    ground,
    roles: {
      heading: { className: heading.className, label: labelFor(heading) },
      body: { className: body.className, label: labelFor(body) },
      action: {
        className: action.className,
        label: labelFor(action),
        element: action.tag === "a" ? "a" : "button",
      },
    },
  };
  return { component, stylesheet, inspection, alias, wrapperClassEnd: wrapper.end, styles };
}

export function validateEditedSyntax(component: string, stylesheet: string) {
  indexNodes(parseComponent(component));
  parseStylesheet(stylesheet);
}
