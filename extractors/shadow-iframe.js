// extractors/shadow-iframe.js
// Shadow DOM + iframe traversal
window.__DDNA_extractShadow = function (rootEl, depth = 0) {
  if (!rootEl || depth > 6) return null;
  const result = { children: [], styles: [], slots: [] };

  if (rootEl.shadowRoot) {
    const shadow = rootEl.shadowRoot;
    result.mode = shadow.mode;
    result.delegatesFocus = shadow.delegatesFocus;
    result.styles = [...shadow.querySelectorAll('style')]
      .map(s => s.textContent.slice(0, 2000));

    // Walk shadow children (just first level structural info)
    [...shadow.children].forEach(child => {
      if (['STYLE', 'SCRIPT'].includes(child.tagName)) return;
      const s = getComputedStyle(child);
      result.children.push({
        tag: child.tagName.toLowerCase(),
        id: child.id,
        classes: [...child.classList].join(' '),
        text: child.textContent?.trim().slice(0, 80),
        display: s.display,
        position: s.position,
        // Recurse if nested shadow
        shadow: child.shadowRoot ? window.__DDNA_extractShadow(child, depth + 1) : null,
      });
    });

    // Slots
    [...shadow.querySelectorAll('slot')].forEach(slot => {
      result.slots.push({
        name: slot.name || 'default',
        assigned: slot.assignedElements?.().length || 0,
      });
    });
  }
  return result;
};

window.__DDNA_extractIframes = function () {
  return [...document.querySelectorAll('iframe')].map(f => {
    const info = {
      src: f.src,
      title: f.title,
      name: f.name,
      width: f.width || f.offsetWidth,
      height: f.height || f.offsetHeight,
      sandbox: f.sandbox?.toString() || '',
      loading: f.loading,
      allow: f.allow,
      allowFullscreen: f.allowFullscreen,
      crossOrigin: false,
      inner: null,
    };
    try {
      if (f.contentDocument) {
        info.inner = {
          title: f.contentDocument.title,
          url: f.contentDocument.location.href,
          readyState: f.contentDocument.readyState,
          bodyClasses: f.contentDocument.body?.className || '',
          childCount: f.contentDocument.body?.children.length || 0,
          stylesheetCount: f.contentDocument.styleSheets?.length || 0,
          scriptCount: f.contentDocument.scripts?.length || 0,
        };
      }
    } catch {
      info.crossOrigin = true;
    }
    return info;
  });
};

// Walk all shadow hosts on page
window.__DDNA_findShadowHosts = function () {
  const hosts = [];
  const walk = (root) => {
    const tw = (root.querySelectorAll ? root.querySelectorAll('*') : []);
    tw.forEach(el => {
      if (el.shadowRoot) {
        hosts.push({
          tag: el.tagName.toLowerCase(),
          id: el.id,
          classes: [...el.classList].join(' '),
          shadow: window.__DDNA_extractShadow(el),
        });
        walk(el.shadowRoot);
      }
    });
  };
  walk(document);
  return hosts.slice(0, 30);
};