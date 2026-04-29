// extractors/css-deep.js
// Deep CSS extraction: variables, keyframes, @layer, @container, @property, pseudo-elements
window.__DDNA_extractCSS = async function () {
  const result = {
    variables: {},
    keyframes: {},
    fontFace: [],
    mediaQueries: [],
    containerQueries: [],
    layers: [],
    properties: [],
    supportsRules: [],
    scrollTimelines: [],
    viewTransitions: [],
    counterStyles: [],
    pageRules: [],
    nestedRules: 0,
  };

  const processSheet = async (sheet) => {
    const walk = (rules, parent = null) => {
      if (!rules) return;
      for (const rule of rules) {
        const ctor = rule.constructor.name;
        try {
          if (rule instanceof CSSKeyframesRule) {
            result.keyframes[rule.name] = rule.cssText;
          } else if (rule instanceof CSSFontFaceRule) {
            result.fontFace.push(rule.cssText);
          } else if (rule instanceof CSSMediaRule) {
            result.mediaQueries.push({
              condition: rule.conditionText,
              ruleCount: rule.cssRules.length,
              sample: [...rule.cssRules].slice(0, 4).map(r => r.cssText?.slice(0, 250)),
            });
            walk(rule.cssRules, 'media');
          } else if (ctor === 'CSSContainerRule') {
            result.containerQueries.push({
              container: rule.containerName || '',
              condition: rule.containerQuery || rule.conditionText,
              sample: rule.cssText.slice(0, 300),
            });
            walk(rule.cssRules, 'container');
          } else if (ctor === 'CSSLayerBlockRule') {
            result.layers.push({ name: rule.name, ruleCount: rule.cssRules?.length || 0, type: 'block' });
            walk(rule.cssRules, 'layer');
          } else if (ctor === 'CSSLayerStatementRule') {
            result.layers.push({ name: rule.nameList?.join(', ') || '', type: 'statement' });
          } else if (ctor === 'CSSPropertyRule') {
            result.properties.push({
              name: rule.name,
              syntax: rule.syntax,
              inherits: rule.inherits,
              initialValue: rule.initialValue,
            });
          } else if (rule instanceof CSSSupportsRule) {
            result.supportsRules.push({ condition: rule.conditionText });
            walk(rule.cssRules, 'supports');
          } else if (ctor === 'CSSScrollTimelineRule') {
            result.scrollTimelines.push(rule.cssText);
          } else if (ctor === 'CSSCounterStyleRule') {
            result.counterStyles.push({ name: rule.name, cssText: rule.cssText });
          } else if (rule instanceof CSSPageRule) {
            result.pageRules.push(rule.cssText);
          } else if (rule instanceof CSSStyleRule) {
            if (parent) result.nestedRules++;
            const sel = rule.selectorText || '';
            if (/^(:root|html|\*|:host)/.test(sel)) {
              for (const prop of rule.style) {
                if (prop.startsWith('--')) {
                  result.variables[prop] = rule.style.getPropertyValue(prop).trim();
                }
              }
            }
            // Nested rules (CSS Nesting)
            if (rule.cssRules?.length) walk(rule.cssRules, 'nested');
          }
        } catch (e) { /* skip rule */ }
      }
    };

    try {
      walk(sheet.cssRules);
    } catch {
      // CORS — fetch + regex fallback
      if (sheet.href?.startsWith('http')) {
        try {
          const text = await fetch(sheet.href).then(r => r.text());
          for (const m of text.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\n\}/g))
            result.keyframes[m[1]] = `@keyframes ${m[1]} {${m[2]}\n}`;
          for (const m of text.matchAll(/@font-face\s*\{[^}]*\}/g))
            result.fontFace.push(m[0]);
          for (const m of text.matchAll(/:root\s*\{([^}]*)\}/g)) {
            for (const v of m[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g))
              result.variables[v[1]] = v[2].trim();
          }
          for (const m of text.matchAll(/@container\s+([^{]+)\{/g))
            result.containerQueries.push({ condition: m[1].trim(), source: 'fetched' });
          for (const m of text.matchAll(/@layer\s+([\w,\s-]+)\s*[{;]/g))
            result.layers.push({ name: m[1].trim(), source: 'fetched' });
          for (const m of text.matchAll(/@property\s+(--[\w-]+)\s*\{([^}]*)\}/g))
            result.properties.push({ name: m[1], body: m[2].trim() });
        } catch {}
      }
    }
  };

  await Promise.all([...document.styleSheets].map(s => processSheet(s).catch(() => {})));
  return result;
};

// Pseudo-element extractor (used inside layout walker)
window.__DDNA_extractPseudo = function (el) {
  const out = {};
  const pseudos = ['::before', '::after', '::marker', '::placeholder', '::selection',
                   '::first-line', '::first-letter', '::backdrop'];
  for (const p of pseudos) {
    try {
      const s = getComputedStyle(el, p);
      const content = s.content;
      if (!content || content === 'none' || content === 'normal') {
        // For ::selection / ::backdrop, content is always 'normal' but other props may apply
        if (!['::selection', '::backdrop', '::placeholder'].includes(p)) continue;
      }
      const data = { content };
      const collect = (k, skip) => {
        const v = s[k];
        if (v && v !== skip && v !== 'none' && v !== 'normal') data[k] = v;
      };
      collect('background', 'rgba(0, 0, 0, 0)');
      collect('backgroundImage', 'none');
      collect('color', '');
      collect('position', 'static');
      collect('top', 'auto'); collect('left', 'auto');
      collect('right', 'auto'); collect('bottom', 'auto');
      collect('width', 'auto'); collect('height', 'auto');
      collect('transform', 'none');
      collect('filter', 'none');
      collect('clipPath', 'none');
      collect('mixBlendMode', 'normal');
      collect('opacity', '1');
      if (s.animationName !== 'none') {
        data.animation = `${s.animationName} ${s.animationDuration} ${s.animationTimingFunction}`;
      }
      if (s.transitionDuration !== '0s') {
        data.transition = `${s.transitionProperty} ${s.transitionDuration} ${s.transitionTimingFunction}`;
      }
      if (Object.keys(data).length > 1) out[p] = data;
    } catch {}
  }
  return Object.keys(out).length ? out : null;
};