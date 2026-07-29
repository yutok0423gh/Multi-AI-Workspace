import type { PlatformMessage } from '../shared/types/platform';
import type { AppSettings } from '../shared/types/settings';

const MERMAID_SELECTOR = [
  'pre.mermaid',
  'pre[data-language="mermaid"]',
  'pre[data-lang="mermaid"]',
  'code.language-mermaid',
  'code[data-language="mermaid"]',
  'code[data-lang="mermaid"]',
].join(',');

const FORMULA_SELECTOR = [
  '.katex',
  '.MathJax',
  '.MathJax_Display',
  'mjx-container',
  'math',
  '[data-tex]',
  '[data-latex]',
  '[data-math]',
  '[data-mathml]',
  '[data-math-source]',
  '[data-original-tex]',
  '[data-source-tex]',
  '[data-formula]',
  '[role="math"]',
  'script[type^="math/tex"]',
].join(',');

export interface MermaidTarget {
  id: string;
  element: HTMLElement;
  source: string;
}

export interface FormulaSources {
  latex: string | null;
  mathml: string | null;
  renderedText: string | null;
}

export interface FormulaTarget extends FormulaSources {
  id: string;
  element: HTMLElement;
}

const SUPERSCRIPT_VALUES: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁺': '+',
  '⁻': '-',
  '⁼': '=',
  '⁽': '(',
  '⁾': ')',
  ⁿ: 'n',
};

const SUBSCRIPT_VALUES: Record<string, string> = {
  '₀': '0',
  '₁': '1',
  '₂': '2',
  '₃': '3',
  '₄': '4',
  '₅': '5',
  '₆': '6',
  '₇': '7',
  '₈': '8',
  '₉': '9',
  '₊': '+',
  '₋': '-',
  '₌': '=',
  '₍': '(',
  '₎': ')',
  ₐ: 'a',
  ₑ: 'e',
  ₕ: 'h',
  ᵢ: 'i',
  ⱼ: 'j',
  ₖ: 'k',
  ₗ: 'l',
  ₘ: 'm',
  ₙ: 'n',
  ₒ: 'o',
  ₚ: 'p',
  ᵣ: 'r',
  ₛ: 's',
  ₜ: 't',
  ₓ: 'x',
};

const LATEX_SYMBOLS: Record<string, string> = {
  '−': '-',
  '×': '\\times ',
  '÷': '\\div ',
  '±': '\\pm ',
  '∓': '\\mp ',
  '≤': '\\le ',
  '≥': '\\ge ',
  '≠': '\\ne ',
  '≈': '\\approx ',
  '≡': '\\equiv ',
  '∞': '\\infty ',
  '∑': '\\sum ',
  '∏': '\\prod ',
  '∫': '\\int ',
  '∂': '\\partial ',
  '∇': '\\nabla ',
  '∈': '\\in ',
  '∉': '\\notin ',
  '⊂': '\\subset ',
  '⊆': '\\subseteq ',
  '∪': '\\cup ',
  '∩': '\\cap ',
  '→': '\\to ',
  '←': '\\leftarrow ',
  '↔': '\\leftrightarrow ',
  '⇒': '\\Rightarrow ',
  '⇔': '\\Leftrightarrow ',
  α: '\\alpha ',
  β: '\\beta ',
  γ: '\\gamma ',
  δ: '\\delta ',
  ε: '\\epsilon ',
  θ: '\\theta ',
  λ: '\\lambda ',
  μ: '\\mu ',
  π: '\\pi ',
  ρ: '\\rho ',
  σ: '\\sigma ',
  φ: '\\phi ',
  ω: '\\omega ',
  Δ: '\\Delta ',
  Σ: '\\Sigma ',
  Π: '\\Pi ',
  Ω: '\\Omega ',
  '½': '\\frac{1}{2}',
  '⅓': '\\frac{1}{3}',
  '⅔': '\\frac{2}{3}',
  '¼': '\\frac{1}{4}',
  '¾': '\\frac{3}{4}',
};

function replaceScriptRun(
  value: string,
  pattern: RegExp,
  values: Record<string, string>,
  marker: '^' | '_',
): string {
  return value.replace(
    pattern,
    (run) => `${marker}{${[...run].map((item) => values[item]).join('')}}`,
  );
}

/**
 * Produces an explicitly approximate, local-only LaTeX representation for render-only formulas.
 * It handles common Unicode math symbols and scripts without claiming to reconstruct exact source.
 */
export function deriveApproximateLatex(renderedText: string | null): string | null {
  if (!renderedText) return null;
  const trimmed = renderedText.trim();
  if (!trimmed || trimmed.length > 5000) return null;
  let value = trimmed.replace(/√\s*(\([^()]{1,200}\)|[A-Za-z0-9]+)/g, (_match, operand: string) => {
    const content = operand.startsWith('(') ? operand.slice(1, -1) : operand;
    return `\\sqrt{${content}}`;
  });
  value = replaceScriptRun(value, /[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿ]+/g, SUPERSCRIPT_VALUES, '^');
  value = replaceScriptRun(value, /[₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜₓ]+/g, SUBSCRIPT_VALUES, '_');
  value = [...value].map((character) => LATEX_SYMBOLS[character] ?? character).join('');
  value = value.replaceAll('√', '\\sqrt{}').replace(/\s+/g, ' ').trim();
  return value || null;
}

export function formatApproximateFormula(
  renderedText: string | null,
  format: Exclude<AppSettings['markup']['formulaCopyFormat'], 'mathml'>,
): string | null {
  const latex = deriveApproximateLatex(renderedText);
  if (!latex) return null;
  if (format === 'word') return `$${latex}$`;
  if (format === 'notion') return `$$${latex}$$`;
  return latex;
}

let targetSequence = 0;
const targetIds = new WeakMap<HTMLElement, string>();

function targetId(element: HTMLElement, prefix: string): string {
  const existing = targetIds.get(element);
  if (existing) return existing;
  const id = `${prefix}:${++targetSequence}`;
  targetIds.set(element, id);
  return id;
}

function matchingElements(root: HTMLElement, selector: string): HTMLElement[] {
  return [
    ...(root.matches(selector) ? [root] : []),
    ...Array.from(root.querySelectorAll<HTMLElement>(selector)),
  ];
}

function firstAttribute(element: HTMLElement, names: string[]): string | null {
  for (const name of names) {
    const value = element.getAttribute(name)?.trim();
    if (value) return value;
  }
  return null;
}

function uniqueElements(elements: Array<HTMLElement | null>): HTMLElement[] {
  return elements.filter(
    (element, index): element is HTMLElement =>
      element !== null && elements.indexOf(element) === index,
  );
}

function formulaSourceRoots(element: HTMLElement): HTMLElement[] {
  const surface = formulaSurface(element);
  const closest = surface.closest<HTMLElement>(FORMULA_SELECTOR);
  const adjacentScript =
    surface.previousElementSibling instanceof HTMLScriptElement &&
    surface.previousElementSibling.type.trim().toLocaleLowerCase().startsWith('math/tex')
      ? surface.previousElementSibling
      : null;
  const parentWithSource =
    surface.parentElement?.closest<HTMLElement>(
      '[data-tex],[data-latex],[data-math],[data-mathml],[data-math-source],[data-original-tex],[data-source-tex],[data-formula],[role="math"]',
    ) ?? null;
  return uniqueElements([element, surface, closest, parentWithSource, adjacentScript]);
}

function findTexAnnotation(roots: HTMLElement[]): HTMLElement | null {
  for (const root of roots) {
    const annotations = [
      ...(root.matches('annotation') ? [root] : []),
      ...Array.from(root.querySelectorAll<HTMLElement>('annotation')),
    ];
    const annotation = annotations.find((candidate) => {
      const encoding = candidate.getAttribute('encoding')?.trim().toLocaleLowerCase() ?? '';
      return (
        encoding === 'tex' ||
        encoding === 'text/latex' ||
        encoding === 'application/latex' ||
        encoding === 'application/tex' ||
        encoding === 'text/x-tex' ||
        encoding.startsWith('application/x-tex')
      );
    });
    if (annotation?.textContent?.trim()) return annotation;
  }
  return null;
}

function findFormulaScript(roots: HTMLElement[]): HTMLScriptElement | null {
  for (const root of roots) {
    if (
      root instanceof HTMLScriptElement &&
      root.type.trim().toLocaleLowerCase().startsWith('math/tex')
    ) {
      return root;
    }
    const script = Array.from(root.querySelectorAll<HTMLScriptElement>('script[type]')).find(
      (candidate) => candidate.type.trim().toLocaleLowerCase().startsWith('math/tex'),
    );
    if (script?.textContent?.trim()) return script;
  }
  return null;
}

function findMathElement(roots: HTMLElement[]): Element | null {
  for (const root of roots) {
    if (root.tagName.toLocaleLowerCase() === 'math') return root;
    const math = root.querySelector('math');
    if (math) return math;
  }
  return null;
}

function formulaSurface(element: HTMLElement): HTMLElement {
  if (element.tagName === 'SCRIPT') {
    const next = element.nextElementSibling;
    if (next instanceof HTMLElement && next.matches('.MathJax, .MathJax_Display, mjx-container')) {
      return next;
    }
    return element.parentElement ?? element;
  }
  return element;
}

export function extractFormulaSources(element: HTMLElement): FormulaSources {
  const roots = formulaSourceRoots(element);
  const explicitLatex = roots
    .map((root) =>
      firstAttribute(root, [
        'data-tex',
        'data-latex',
        'data-math',
        'data-math-source',
        'data-original-tex',
        'data-source-tex',
        'data-formula',
      ]),
    )
    .find(Boolean);
  const annotation = findTexAnnotation(roots);
  const script = findFormulaScript(roots);
  const math = findMathElement(roots);
  const mathAltText = math?.getAttribute('alttext')?.trim() || null;
  const serializedMathml = roots
    .map((root) => root.getAttribute('data-mathml')?.trim())
    .find((value) => value?.toLocaleLowerCase().startsWith('<math'));
  const latex =
    explicitLatex ??
    annotation?.textContent?.trim() ??
    script?.textContent?.trim() ??
    mathAltText ??
    null;
  const renderedText =
    formulaSurface(element).innerText?.trim() || element.textContent?.trim() || null;
  return {
    latex: latex || null,
    mathml: math?.outerHTML ?? serializedMathml ?? null,
    renderedText,
  };
}

export function discoverMermaidTargets(messages: PlatformMessage[]): MermaidTarget[] {
  const seen = new Set<HTMLElement>();
  const targets: MermaidTarget[] = [];
  for (const message of messages) {
    for (const match of matchingElements(message.element, MERMAID_SELECTOR)) {
      const element =
        match.tagName === 'CODE' && match.closest('pre') instanceof HTMLElement
          ? (match.closest('pre') as HTMLElement)
          : match;
      if (seen.has(element)) continue;
      const sourceElement =
        match.tagName === 'CODE' ? match : (match.querySelector('code') ?? match);
      const source = sourceElement.textContent?.trim() ?? '';
      if (!source) continue;
      seen.add(element);
      targets.push({ id: targetId(element, 'mermaid'), element, source });
    }
  }
  return targets;
}

export function discoverFormulaTargets(messages: PlatformMessage[]): FormulaTarget[] {
  const seen = new Set<HTMLElement>();
  const targets: FormulaTarget[] = [];
  for (const message of messages) {
    for (const match of matchingElements(message.element, FORMULA_SELECTOR)) {
      const element = formulaSurface(match);
      if (
        seen.has(element) ||
        [...seen].some(
          (seenElement) => seenElement.contains(element) || element.contains(seenElement),
        )
      ) {
        continue;
      }
      const sources = extractFormulaSources(match);
      if (!sources.latex && !sources.mathml && !sources.renderedText) continue;
      seen.add(element);
      targets.push({ id: targetId(element, 'formula'), element, ...sources });
    }
  }
  return targets;
}

export function formatFormula(
  target: FormulaSources,
  format: AppSettings['markup']['formulaCopyFormat'],
): string | null {
  if (format === 'mathml') return target.mathml;
  if (!target.latex) return null;
  if (format === 'word') return ['$', target.latex, '$'].join('');
  if (format === 'notion') return ['$$', target.latex, '$$'].join('');
  return target.latex;
}

export interface ResolvedFormulaCopy {
  value: string | null;
  approximate: boolean;
}

export function resolveFormulaCopy(
  target: FormulaSources,
  format: AppSettings['markup']['formulaCopyFormat'],
): ResolvedFormulaCopy {
  const exact = formatFormula(target, format);
  if (exact) return { value: exact, approximate: false };
  if (format === 'mathml') return { value: null, approximate: false };
  return {
    value: formatApproximateFormula(target.renderedText, format),
    approximate: true,
  };
}
