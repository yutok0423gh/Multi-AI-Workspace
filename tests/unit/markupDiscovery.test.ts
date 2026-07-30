import { describe, expect, it } from 'vitest';

import {
  deriveApproximateLatex,
  discoverFormulaTargets,
  discoverMermaidTargets,
  extractFormulaSources,
  formatApproximateFormula,
  formatFormula,
  resolveFormulaCopy,
} from '../../src/content/markupDiscovery';
import type { PlatformMessage } from '../../src/shared/types/platform';

function message(element: HTMLElement): PlatformMessage {
  return {
    platform: 'custom',
    conversationId: 'conversation',
    messageId: 'message-1',
    runtimeMessageId: 'assistant:0',
    role: 'assistant',
    plainText: element.textContent ?? '',
    html: element.innerHTML,
    timestamp: null,
    timestampSource: 'unknown',
    element,
    order: 0,
  };
}

describe('markup discovery', () => {
  it('detects only explicit Mermaid code blocks inside message content', () => {
    const article = document.createElement('article');
    article.innerHTML = `
      <pre><code class="language-mermaid">graph TD\nA--&gt;B</code></pre>
      <pre><code>graph TD\nThis is ordinary code</code></pre>
    `;
    const sidebar = document.createElement('aside');
    sidebar.innerHTML = '<pre class="mermaid">graph LR\nX--&gt;Y</pre>';
    document.body.append(article, sidebar);

    const targets = discoverMermaidTargets([message(article)]);

    expect(targets).toHaveLength(1);
    expect(targets[0].element.tagName).toBe('PRE');
    expect(targets[0].source).toBe('graph TD\nA-->B');
  });

  it('extracts verified KaTeX and MathML sources without duplicating nested layers', () => {
    const article = document.createElement('article');
    article.innerHTML = `
      <span class="katex">Rendered
        <math><semantics><mi>x</mi><annotation encoding="application/x-tex">x^2</annotation></semantics></math>
      </span>
    `;
    document.body.append(article);

    const targets = discoverFormulaTargets([message(article)]);

    expect(targets).toHaveLength(1);
    expect(targets[0].latex).toBe('x^2');
    expect(targets[0].mathml).toContain('<math>');
  });

  it('does not label rendered text as LaTeX when no exact source exists', () => {
    const formula = document.createElement('span');
    formula.className = 'katex';
    formula.textContent = 'x² + y²';

    expect(extractFormulaSources(formula)).toEqual({
      latex: null,
      mathml: null,
      renderedText: 'x² + y²',
    });
  });

  it('offers a clearly approximate local conversion for common rendered math', () => {
    expect(deriveApproximateLatex('x² + y₁ ≤ √(α + 1)')).toBe(
      'x^{2} + y_{1} \\le \\sqrt{\\alpha + 1}',
    );
    expect(formatApproximateFormula('x² + y²', 'word')).toBe('$x^{2} + y^{2}$');
    expect(formatApproximateFormula('x² + y²', 'notion')).toBe('$$x^{2} + y^{2}$$');
    expect(deriveApproximateLatex('x'.repeat(5001))).toBeNull();
  });

  it('accepts explicit TeX annotations that include a display-mode suffix', () => {
    const formula = document.createElement('span');
    formula.className = 'katex';
    formula.innerHTML =
      '<math><annotation encoding="application/x-tex; mode=display">\\frac{a}{b}</annotation></math>';
    expect(extractFormulaSources(formula).latex).toBe('\\frac{a}{b}');
  });

  it('recognizes common exact TeX and MathML source variants', () => {
    const wrapper = document.createElement('span');
    wrapper.setAttribute('role', 'math');
    wrapper.setAttribute('data-original-tex', '\\int_0^1 x\\,dx');
    wrapper.innerHTML = '<span class="MathJax">Rendered integral</span>';
    expect(extractFormulaSources(wrapper.querySelector('.MathJax') as HTMLElement).latex).toBe(
      '\\int_0^1 x\\,dx',
    );

    const mathml = document.createElement('span');
    mathml.setAttribute('data-mathml', '<math><mi>y</mi></math>');
    expect(extractFormulaSources(mathml).mathml).toBe('<math><mi>y</mi></math>');
  });

  it('uses MathML alttext and standard LaTeX annotation MIME types as verified source', () => {
    const math = document.createElement('math');
    math.setAttribute('alttext', '\\sqrt{x}');
    expect(extractFormulaSources(math).latex).toBe('\\sqrt{x}');

    const annotated = document.createElement('math');
    annotated.innerHTML = '<annotation encoding="text/latex">x_1</annotation>';
    expect(extractFormulaSources(annotated).latex).toBe('x_1');
  });

  it('keeps MathJax script source available when the rendered sibling is opened later', () => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML =
      '<script type="math/tex; mode=display">\\sum_{i=1}^n i</script><span class="MathJax">Rendered sum</span>';
    const rendered = wrapper.querySelector('.MathJax') as HTMLElement;

    expect(extractFormulaSources(rendered).latex).toBe('\\sum_{i=1}^n i');
  });

  it('formats exact LaTeX for plain, Word, and Notion targets', () => {
    const source = { latex: 'x^2', mathml: '<math><msup/></math>', renderedText: 'x²' };
    expect(formatFormula(source, 'latex')).toBe('x^2');
    expect(formatFormula(source, 'word')).toBe('$x^2$');
    expect(formatFormula(source, 'notion')).toBe('$$x^2$$');
    expect(formatFormula(source, 'mathml')).toBe('<math><msup/></math>');
  });

  it('resolves one-click formula copies from the configured format', () => {
    const exact = { latex: 'x^2', mathml: '<math><msup/></math>', renderedText: 'x²' };
    expect(resolveFormulaCopy(exact, 'word')).toEqual({
      value: '$x^2$',
      approximate: false,
      format: 'word',
      usedFallback: false,
    });
    expect(resolveFormulaCopy({ latex: null, mathml: null, renderedText: 'x²' }, 'latex')).toEqual({
      value: 'x^{2}',
      approximate: true,
      format: 'latex',
      usedFallback: false,
    });
    expect(
      resolveFormulaCopy({ latex: 'x^2', mathml: null, renderedText: 'x²' }, 'mathml'),
    ).toEqual({
      value: 'x^2',
      approximate: false,
      format: 'latex',
      usedFallback: true,
    });
    expect(
      resolveFormulaCopy({ latex: null, mathml: null, renderedText: 'x'.repeat(5001) }, 'word'),
    ).toEqual({
      value: 'x'.repeat(5001),
      approximate: false,
      format: 'rendered',
      usedFallback: true,
    });
  });
});
