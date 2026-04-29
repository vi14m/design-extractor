// extractors/interaction.js
// Hover, focus, active, drag, magnetic, custom cursor detection
window.__DDNA_extractInteractions = function () {
  const result = {
    hover: [],
    focus: [],
    focusVisible: [],
    focusWithin: [],
    active: [],
    visited: [],
    target: [],
    customCursors: [],
    magneticElements: [],
    parallaxElements: [],
    draggableElements: [],
    tiltElements: [],
  };

  // ─── Walk all stylesheets for interaction pseudo-classes ───
  const walkRules = (rules) => {
    if (!rules) return;
    for (const rule of rules) {
      try {
        if (rule instanceof CSSStyleRule) {
          const sel = rule.selectorText || '';
          const css = rule.style.cssText;
          const item = { selector: sel, css };

          if (sel.includes(':hover')) result.hover.push(item);
          if (sel.includes(':focus-visible')) result.focusVisible.push(item);
          else if (sel.includes(':focus-within')) result.focusWithin.push(item);
          else if (sel.includes(':focus')) result.focus.push(item);
          if (sel.includes(':active')) result.active.push(item);
          if (sel.includes(':visited')) result.visited.push(item);
          if (sel.includes(':target')) result.target.push(item);
        } else if (rule.cssRules) {
          walkRules(rule.cssRules);
        }
      } catch {}
    }
  };
  for (const sheet of document.styleSheets) {
    try { walkRules(sheet.cssRules); } catch {}
  }

  // ─── Detect custom cursors (fixed positioned divs that follow mouse) ───
  document.querySelectorAll('[class*="cursor"], [id*="cursor"], [data-cursor]').forEach(el => {
    const s = getComputedStyle(el);
    if (s.position === 'fixed' || s.position === 'absolute') {
      result.customCursors.push({
        selector: el.id ? `#${el.id}` : `.${[...el.classList].join('.')}`,
        position: s.position,
        size: `${s.width}×${s.height}`,
        zIndex: s.zIndex,
        backgroundColor: s.backgroundColor,
        borderRadius: s.borderRadius,
        mixBlendMode: s.mixBlendMode,
        pointerEvents: s.pointerEvents,
        transform: s.transform,
        transition: s.transition,
      });
    }
  });

  // ─── Magnetic / parallax / tilt detection via class & data-attr hints ───
  document.querySelectorAll('*').forEach(el => {
    const classes = [...(el.classList || [])].join(' ');
    const sel = el.id ? `#${el.id}` : (el.classList[0] ? `.${el.classList[0]}` : el.tagName.toLowerCase());

    if (/magnetic|magnet/i.test(classes) || el.dataset?.magnetic) {
      result.magneticElements.push({ selector: sel, hint: el.dataset?.magnetic || classes });
    }
    if (/parallax/i.test(classes) || el.dataset?.parallax || el.dataset?.speed) {
      result.parallaxElements.push({
        selector: sel,
        speed: el.dataset?.speed || el.dataset?.parallax || '',
        lag: el.dataset?.lag || '',
      });
    }
    if (/\btilt\b|vanilla-tilt/i.test(classes) || el.dataset?.tilt !== undefined) {
      result.tiltElements.push({
        selector: sel,
        maxTilt: el.dataset?.tiltMax || el.dataset?.tilt || '',
        perspective: el.dataset?.tiltPerspective || '',
        speed: el.dataset?.tiltSpeed || '',
      });
    }
    if (el.draggable || el.dataset?.draggable !== undefined || /\bdrag(gable)?\b/i.test(classes)) {
      result.draggableElements.push({ selector: sel, native: el.draggable });
    }
  });

  // Cap arrays
  Object.keys(result).forEach(k => { if (Array.isArray(result[k])) result[k] = result[k].slice(0, 100); });
  return result;
};