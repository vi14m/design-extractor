// extractors/layout.js
// Layout tree walker, scroll/sticky/snap mapping, component fingerprinting
window.__DDNA_extractLayout = function (opts = {}) {
  const isVisible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    return true;
  };

  const absUrl = (u) => { try { return new URL(u, location.href).href; } catch { return u || ''; } };
  const urlFromCss = (v) => {
    const m = v?.match(/url\(["']?(.*?)["']?\)/);
    return m ? absUrl(m[1]) : '';
  };
  const sel = (el) => {
    if (!el) return '';
    const id = el.id ? `#${el.id}` : '';
    const cls = [...(el.classList || [])].slice(0, 3).map(c => `.${c}`).join('');
    return (id || cls || el.tagName?.toLowerCase() || '').slice(0, 100);
  };

  // ─── Palette collection ───
  const palette = new Map();
  const collectColor = (c) => {
    if (!c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent') return;
    palette.set(c, (palette.get(c) || 0) + 1);
  };

  // ─── Component fingerprinting ───
  const fingerprintMap = new Map();
  const fingerprint = (s, tag) => [
    tag, s.display, s.position, s.padding, s.margin, s.borderRadius,
    s.backgroundColor, s.color, s.fontSize, s.fontWeight,
    s.boxShadow, s.border, s.flexDirection, s.gridTemplateColumns,
  ].join('|');

  // ─── Scroll mapping ───
  const scrollContainers = [];
  const stickyEls = [];
  const snapContainers = [];

  // ─── Process node ───
  const processNode = (el, depth = 0, isShadow = false) => {
    if (!el || depth > 14 || el.nodeType !== 1) return null;
    if (['SCRIPT','STYLE','NOSCRIPT','META','LINK','TEMPLATE'].includes(el.tagName)) return null;
    if (!isVisible(el)) return null;

    const s = getComputedStyle(el);
    const tag = el.tagName.toLowerCase();
    const rect = el.getBoundingClientRect();

    collectColor(s.backgroundColor);
    collectColor(s.color);
    if (s.borderColor && s.borderWidth !== '0px') collectColor(s.borderColor);

    if (opts.fingerprint) {
      const fp = fingerprint(s, tag);
      fingerprintMap.set(fp, (fingerprintMap.get(fp) || 0) + 1);
    }

    if (s.position === 'sticky') stickyEls.push({ selector: sel(el), top: s.top });
    if (s.scrollSnapType !== 'none') snapContainers.push({ selector: sel(el), type: s.scrollSnapType });
    if (s.overflow === 'auto' || s.overflow === 'scroll' || s.overflowY === 'auto' || s.overflowY === 'scroll') {
      scrollContainers.push({ selector: sel(el), overflow: s.overflow, overflowY: s.overflowY });
    }

    const node = {
      tag, id: el.id || '', classes: [...el.classList].join(' '),
      selector: sel(el),
      shadow: isShadow,
      box: {
        rect: { x: rect.x | 0, y: rect.y | 0, w: rect.width | 0, h: rect.height | 0 },
        width: s.width, height: s.height,
        minWidth: s.minWidth !== 'auto' ? s.minWidth : '',
        maxWidth: s.maxWidth !== 'none' ? s.maxWidth : '',
        minHeight: s.minHeight !== 'auto' ? s.minHeight : '',
                maxHeight: s.maxHeight !== 'none' ? s.maxHeight : '',
        padding: s.padding,
        margin: s.margin,
        boxSizing: s.boxSizing,
        aspectRatio: s.aspectRatio !== 'auto' ? s.aspectRatio : '',
      },
      layout: (() => {
        const l = {
          display: s.display,
          position: s.position,
          top: s.top, left: s.left, right: s.right, bottom: s.bottom,
          zIndex: s.zIndex,
          transform: s.transform !== 'none' ? s.transform : '',
          transformOrigin: s.transformOrigin,
          transformStyle: s.transformStyle !== 'flat' ? s.transformStyle : '',
          perspective: s.perspective !== 'none' ? s.perspective : '',
          willChange: s.willChange !== 'auto' ? s.willChange : '',
          contain: s.contain !== 'none' ? s.contain : '',
          containerType: s.containerType !== 'normal' ? s.containerType : '',
          containerName: s.containerName,
          contentVisibility: s.contentVisibility !== 'visible' ? s.contentVisibility : '',
          isolation: s.isolation !== 'auto' ? s.isolation : '',
        };
        if (s.display.includes('grid')) {
          Object.assign(l, {
            gridTemplateColumns: s.gridTemplateColumns,
            gridTemplateRows: s.gridTemplateRows,
            gridTemplateAreas: s.gridTemplateAreas !== 'none' ? s.gridTemplateAreas : '',
            gridAutoFlow: s.gridAutoFlow,
            gridAutoColumns: s.gridAutoColumns !== 'auto' ? s.gridAutoColumns : '',
            gridAutoRows: s.gridAutoRows !== 'auto' ? s.gridAutoRows : '',
            gap: s.gap,
            columnGap: s.columnGap,
            rowGap: s.rowGap,
            justifyItems: s.justifyItems,
            alignItems: s.alignItems,
            placeItems: s.placeItems,
          });
        }
        if (s.display.includes('flex')) {
          Object.assign(l, {
            flexDirection: s.flexDirection,
            flexWrap: s.flexWrap,
            justifyContent: s.justifyContent,
            alignItems: s.alignItems,
            alignContent: s.alignContent,
            gap: s.gap,
          });
        }
        if (s.flex !== '0 1 auto') l.flex = s.flex;
        if (s.gridColumn !== 'auto') l.gridColumn = s.gridColumn;
        if (s.gridRow !== 'auto') l.gridRow = s.gridRow;
        if (s.gridArea !== 'auto / auto / auto / auto') l.gridArea = s.gridArea;
        if (s.alignSelf !== 'auto') l.alignSelf = s.alignSelf;
        if (s.justifySelf !== 'auto') l.justifySelf = s.justifySelf;
        if (s.order !== '0') l.order = s.order;
        return l;
      })(),
      background: {
        color: s.backgroundColor !== 'rgba(0, 0, 0, 0)' ? s.backgroundColor : '',
        image: urlFromCss(s.backgroundImage),
        gradient: s.backgroundImage?.includes('gradient') ? s.backgroundImage : '',
        size: s.backgroundSize,
        position: s.backgroundPosition,
        repeat: s.backgroundRepeat,
        attachment: s.backgroundAttachment,
        blendMode: s.backgroundBlendMode !== 'normal' ? s.backgroundBlendMode : '',
        clip: s.backgroundClip !== 'border-box' ? s.backgroundClip : '',
        origin: s.backgroundOrigin !== 'padding-box' ? s.backgroundOrigin : '',
      },
      border: {
        width: s.borderWidth,
        style: s.borderStyle,
        color: s.borderColor,
        radius: s.borderRadius,
        topLeftRadius: s.borderTopLeftRadius,
        topRightRadius: s.borderTopRightRadius,
        bottomLeftRadius: s.borderBottomLeftRadius,
        bottomRightRadius: s.borderBottomRightRadius,
        outline: s.outline !== 'none' ? s.outline : '',
        outlineOffset: s.outlineOffset !== '0px' ? s.outlineOffset : '',
      },
      typography: {
        fontFamily: s.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        fontStyle: s.fontStyle,
        lineHeight: s.lineHeight,
        letterSpacing: s.letterSpacing,
        wordSpacing: s.wordSpacing !== 'normal' ? s.wordSpacing : '',
        textTransform: s.textTransform !== 'none' ? s.textTransform : '',
        textAlign: s.textAlign,
        textDecoration: s.textDecoration,
        textIndent: s.textIndent !== '0px' ? s.textIndent : '',
        color: s.color,
        whiteSpace: s.whiteSpace,
        wordBreak: s.wordBreak !== 'normal' ? s.wordBreak : '',
        overflowWrap: s.overflowWrap !== 'normal' ? s.overflowWrap : '',
        textShadow: s.textShadow !== 'none' ? s.textShadow : '',
        fontVariationSettings: s.fontVariationSettings !== 'normal' ? s.fontVariationSettings : '',
        fontFeatureSettings: s.fontFeatureSettings !== 'normal' ? s.fontFeatureSettings : '',
        textWrap: s.textWrap !== 'wrap' ? s.textWrap : '',
        textRendering: s.textRendering !== 'auto' ? s.textRendering : '',
        writingMode: s.writingMode !== 'horizontal-tb' ? s.writingMode : '',
      },
      visual: {
        opacity: s.opacity !== '1' ? s.opacity : '',
        boxShadow: s.boxShadow !== 'none' ? s.boxShadow : '',
        filter: s.filter !== 'none' ? s.filter : '',
        backdropFilter: s.backdropFilter !== 'none' ? s.backdropFilter : '',
        mixBlendMode: s.mixBlendMode !== 'normal' ? s.mixBlendMode : '',
        clipPath: s.clipPath !== 'none' ? s.clipPath : '',
        maskImage: s.maskImage !== 'none' ? s.maskImage : '',
        maskSize: s.maskSize !== 'auto' ? s.maskSize : '',
        cursor: s.cursor !== 'auto' ? s.cursor : '',
        pointerEvents: s.pointerEvents !== 'auto' ? s.pointerEvents : '',
        userSelect: s.userSelect !== 'auto' ? s.userSelect : '',
        objectFit: (tag === 'img' || tag === 'video') && s.objectFit !== 'fill' ? s.objectFit : '',
        objectPosition: (tag === 'img' || tag === 'video') ? s.objectPosition : '',
        imageRendering: s.imageRendering !== 'auto' ? s.imageRendering : '',
        scrollbarWidth: s.scrollbarWidth !== 'auto' ? s.scrollbarWidth : '',
        scrollbarColor: s.scrollbarColor !== 'auto' ? s.scrollbarColor : '',
      },
      scroll: (() => {
        const sp = {};
        if (s.overflow !== 'visible') sp.overflow = s.overflow;
        if (s.overflowX !== 'visible') sp.overflowX = s.overflowX;
        if (s.overflowY !== 'visible') sp.overflowY = s.overflowY;
        if (s.scrollBehavior !== 'auto') sp.scrollBehavior = s.scrollBehavior;
        if (s.scrollSnapType !== 'none') sp.scrollSnapType = s.scrollSnapType;
        if (s.scrollSnapAlign !== 'none') sp.scrollSnapAlign = s.scrollSnapAlign;
        if (s.scrollSnapStop !== 'normal') sp.scrollSnapStop = s.scrollSnapStop;
        if (s.scrollPaddingTop !== 'auto') sp.scrollPaddingTop = s.scrollPaddingTop;
        if (s.scrollMarginTop !== '0px') sp.scrollMarginTop = s.scrollMarginTop;
        if (s.position === 'sticky') { sp.sticky = true; sp.stickyTop = s.top; }
        if (s.animationTimeline && s.animationTimeline !== 'auto') sp.animationTimeline = s.animationTimeline;
        if (s.viewTimelineName && s.viewTimelineName !== 'none') sp.viewTimelineName = s.viewTimelineName;
        if (s.scrollTimelineName && s.scrollTimelineName !== 'none') sp.scrollTimelineName = s.scrollTimelineName;
        return Object.keys(sp).length ? sp : null;
      })(),
      animation: s.animationName !== 'none' ? {
        name: s.animationName,
        duration: s.animationDuration,
        timing: s.animationTimingFunction,
        delay: s.animationDelay,
        iteration: s.animationIterationCount,
        direction: s.animationDirection,
        fillMode: s.animationFillMode,
        playState: s.animationPlayState,
        timeline: s.animationTimeline !== 'auto' ? s.animationTimeline : '',
      } : null,
      transition: (s.transitionDuration !== '0s' && s.transitionProperty !== 'none') ? {
        property: s.transitionProperty,
        duration: s.transitionDuration,
        timing: s.transitionTimingFunction,
        delay: s.transitionDelay,
      } : null,
      pseudo: (typeof window.__DDNA_extractPseudo === 'function') ? window.__DDNA_extractPseudo(el) : null,
      media: (() => {
        if (tag === 'img') return {
          type: 'img',
          src: el.currentSrc || el.src,
          srcset: el.srcset || '',
          sizes: el.sizes || '',
          alt: el.alt || '',
          loading: el.loading || 'eager',
          decoding: el.decoding || '',
          width: el.naturalWidth, height: el.naturalHeight,
        };
        if (tag === 'video') return {
          type: 'video',
          src: el.currentSrc || el.src,
          poster: el.poster,
          autoplay: el.autoplay, loop: el.loop, muted: el.muted,
          controls: el.controls, playsInline: el.playsInline,
          duration: el.duration || 0,
          dimensions: { w: el.videoWidth, h: el.videoHeight },
          sources: [...el.querySelectorAll('source')].map(src => ({ src: src.src, type: src.type, media: src.media })),
        };
        if (tag === 'audio') return {
          type: 'audio',
          src: el.currentSrc || el.src,
          autoplay: el.autoplay, loop: el.loop, muted: el.muted, controls: el.controls,
        };
        if (tag === 'picture') return {
          type: 'picture',
          sources: [...el.querySelectorAll('source')].map(src => ({
            srcset: src.srcset, media: src.media, type: src.type, sizes: src.sizes,
          })),
        };
        if (tag === 'iframe') return {
          type: 'iframe', src: el.src, title: el.title,
          sandbox: el.sandbox?.toString() || '',
          loading: el.loading,
        };
        if (tag === 'canvas') return {
          type: 'canvas', width: el.width, height: el.height,
          contextLost: false,
        };
        if (tag === 'svg') return {
          type: 'svg-inline',
          viewBox: el.getAttribute('viewBox'),
          width: el.getAttribute('width'),
          height: el.getAttribute('height'),
          html: el.outerHTML.slice(0, 600),
        };
        if (tag === 'lottie-player' || tag === 'dotlottie-player') return {
          type: 'lottie',
          src: el.getAttribute('src') || '',
          autoplay: el.hasAttribute('autoplay'),
          loop: el.hasAttribute('loop'),
        };
        if (tag === 'spline-viewer') return {
          type: 'spline',
          url: el.getAttribute('url') || '',
        };
        return null;
      })(),
      hints: {
        dataAttrs: Object.entries(el.dataset || {}).reduce((a, [k, v]) => {
          if (/speed|lag|scrub|parallax|reveal|stagger|delay|aos|gsap|animate|scroll|inview|tilt|magnetic|cursor|hover|sticky/i.test(k)) {
            a[k] = String(v).slice(0, 80);
          }
          return a;
        }, {}),
        revealClass: [...el.classList].find(c =>
          /(reveal|fade|slide|zoom|parallax|appear|in-view|aos|wow|animate|scroll-trigger|sticky|magnetic|tilt|hover|gsap)/i.test(c)
        ) || '',
        ariaLabel: el.getAttribute('aria-label') || '',
        ariaDescribedBy: el.getAttribute('aria-describedby') || '',
        ariaExpanded: el.getAttribute('aria-expanded') || '',
        ariaHidden: el.getAttribute('aria-hidden') || '',
        role: el.getAttribute('role') || '',
        tabindex: el.getAttribute('tabindex') || '',
        title: el.getAttribute('title') || '',
      },
      content: {
        text: (el.children.length === 0 ? el.textContent : '').trim().slice(0, 200),
        href: tag === 'a' ? el.getAttribute('href') : '',
        target: tag === 'a' ? el.getAttribute('target') : '',
        type: (tag === 'input' || tag === 'button') ? el.type : '',
        name: el.name || '',
        placeholder: el.placeholder || '',
        value: tag === 'input' ? (el.type === 'password' ? '***' : el.value) : '',
        required: el.required || false,
        disabled: el.disabled || false,
        checked: el.checked || false,
      },
      children: [],
    };

    // Recurse into children
    for (const child of el.children) {
      const childNode = processNode(child, depth + 1, isShadow);
      if (childNode) node.children.push(childNode);
    }

    // Shadow DOM traversal
    if (opts.shadow && el.shadowRoot) {
      node.shadowDOM = {
        mode: el.shadowRoot.mode,
        delegatesFocus: el.shadowRoot.delegatesFocus,
        children: [...el.shadowRoot.children]
          .map(c => processNode(c, depth + 1, true))
          .filter(Boolean),
        styles: [...el.shadowRoot.querySelectorAll('style')]
          .map(s => s.textContent.slice(0, 1500)),
      };
    }

    return node;
  };

  // ─── Top-level section walker ───
  const sectionEls = [...document.body.children].filter(el =>
    isVisible(el) && !['SCRIPT', 'STYLE', 'NOSCRIPT', 'META', 'LINK'].includes(el.tagName)
  );
  const tree = sectionEls.map(el => processNode(el)).filter(Boolean);

  // ─── Z-index map ───
  const zLayers = [...document.querySelectorAll('*')]
    .filter(el => {
      const z = getComputedStyle(el).zIndex;
      return z && z !== 'auto' && parseInt(z) !== 0;
    })
    .slice(0, 50)
    .map(el => ({
      selector: sel(el),
      zIndex: parseInt(getComputedStyle(el).zIndex),
      position: getComputedStyle(el).position,
    }))
    .sort((a, b) => b.zIndex - a.zIndex);

  // ─── Fingerprint summary ───
  const fingerprints = opts.fingerprint
    ? [...fingerprintMap.entries()]
        .filter(([, count]) => count >= 3)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([sig, count]) => ({ count, signature: sig.slice(0, 250) }))
    : [];

  return {
    tree,
    palette: [...palette.entries()].sort((a, b) => b[1] - a[1]).map(([color, count]) => ({ color, count })),
    zLayers,
    fingerprints,
    scrollContainers: scrollContainers.slice(0, 30),
    stickyEls: stickyEls.slice(0, 30),
    snapContainers: snapContainers.slice(0, 20),
  };
};

// Helper for typography scale
window.__DDNA_extractTypoScale = function () {
  const isVisible = (el) => {
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) > 0;
  };
  const sample = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,a,button,span,li,blockquote,code,label,small,strong,em')]
    .filter(isVisible)
    .slice(0, 80);

  const seen = new Set();
  const scale = [];
  sample.forEach(el => {
    const s = getComputedStyle(el);
    const family = s.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    const key = `${el.tagName}-${s.fontSize}-${s.fontWeight}-${family}`;
    if (seen.has(key)) return;
    seen.add(key);
    scale.push({
      tag: el.tagName.toLowerCase(),
      fontFamily: family,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      fontStyle: s.fontStyle,
      lineHeight: s.lineHeight,
      letterSpacing: s.letterSpacing,
      color: s.color,
      textTransform: s.textTransform,
      fontVariationSettings: s.fontVariationSettings !== 'normal' ? s.fontVariationSettings : '',
      fontFeatureSettings: s.fontFeatureSettings !== 'normal' ? s.fontFeatureSettings : '',
      textWrap: s.textWrap,
      sample: el.textContent.trim().slice(0, 60),
    });
  });

  const body = getComputedStyle(document.body);
  return {
    base: {
      family: body.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
      size: body.fontSize,
      color: body.color,
      weight: body.fontWeight,
      lineHeight: body.lineHeight,
    },
    scale,
    googleFonts: [...document.querySelectorAll('link[href*="fonts.googleapis"], link[href*="fonts.gstatic"]')]
      .map(l => l.href),
    customFonts: [...document.querySelectorAll('link[rel="preload"][as="font"]')]
      .map(l => ({ href: l.href, type: l.type, crossOrigin: l.crossOrigin })),
  };
};

// SVG / filters
window.__DDNA_extractSVG = function () {
  const filters = [];
  document.querySelectorAll('filter').forEach(f => {
    filters.push({
      id: f.id,
      x: f.getAttribute('x') || '',
      y: f.getAttribute('y') || '',
      width: f.getAttribute('width') || '',
      height: f.getAttribute('height') || '',
      filterUnits: f.getAttribute('filterUnits') || '',
      colorInterpolationFilters: f.getAttribute('color-interpolation-filters') || '',
      primitives: [...f.children].map(c => ({
        type: c.tagName,
        attrs: [...c.attributes].reduce((a, attr) => (a[attr.name] = attr.value, a), {}),
      })),
    });
  });

  const masks = [...document.querySelectorAll('mask, clipPath')].map(m => ({
    type: m.tagName,
    id: m.id,
    childCount: m.children.length,
    sample: m.outerHTML.slice(0, 200),
  }));

  const samples = [...document.querySelectorAll('svg')].slice(0, 25).map(svg => ({
    width: svg.getAttribute('width'),
    height: svg.getAttribute('height'),
    viewBox: svg.getAttribute('viewBox'),
    preserveAspectRatio: svg.getAttribute('preserveAspectRatio'),
    role: svg.getAttribute('role'),
    paths: [...svg.querySelectorAll('path')].slice(0, 12).map(p => ({
      d: p.getAttribute('d')?.slice(0, 250),
      fill: p.getAttribute('fill'),
      stroke: p.getAttribute('stroke'),
      strokeWidth: p.getAttribute('stroke-width'),
      strokeDasharray: p.getAttribute('stroke-dasharray'),
      strokeDashoffset: p.getAttribute('stroke-dashoffset'),
      pathLength: p.getTotalLength?.() || 0,
    })),
    gradients: [...svg.querySelectorAll('linearGradient, radialGradient')].map(g => ({
      type: g.tagName,
      id: g.id,
      x1: g.getAttribute('x1'), y1: g.getAttribute('y1'),
      x2: g.getAttribute('x2'), y2: g.getAttribute('y2'),
      stops: [...g.querySelectorAll('stop')].map(s => ({
        offset: s.getAttribute('offset'),
        color: s.getAttribute('stop-color') || getComputedStyle(s).stopColor,
        opacity: s.getAttribute('stop-opacity'),
      })),
    })),
    animations: [...svg.querySelectorAll('animate, animateTransform, animateMotion, set')].map(a => ({
      type: a.tagName,
      attributeName: a.getAttribute('attributeName'),
      from: a.getAttribute('from'),
      to: a.getAttribute('to'),
      values: a.getAttribute('values')?.slice(0, 200),
      dur: a.getAttribute('dur'),
      repeatCount: a.getAttribute('repeatCount'),
    })),
    symbols: [...svg.querySelectorAll('symbol')].map(s => ({
      id: s.id,
      viewBox: s.getAttribute('viewBox'),
    })),
  }));

  return { filters, masks, samples };
};

// Asset inventory
window.__DDNA_extractAssets = function () {
  const isVisible = (el) => {
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden';
  };
  const absUrl = (u) => { try { return new URL(u, location.href).href; } catch { return u || ''; } };
  const urlFromCss = (v) => {
    const m = v?.match(/url\(["']?(.*?)["']?\)/);
    return m ? absUrl(m[1]) : '';
  };

  const bgs = new Set();
  [...document.querySelectorAll('*')].slice(0, 2000).forEach(el => {
    const url = urlFromCss(getComputedStyle(el).backgroundImage);
    if (url) bgs.add(url);
  });

  return {
    images: [...document.querySelectorAll('img')].slice(0, 150).map(img => ({
      src: img.currentSrc || img.src,
      srcset: img.srcset || '',
      sizes: img.sizes || '',
      alt: img.alt || '',
      width: img.naturalWidth,
      height: img.naturalHeight,
      displayWidth: img.offsetWidth,
      displayHeight: img.offsetHeight,
      loading: img.loading || 'eager',
      decoding: img.decoding || '',
      visible: isVisible(img),
    })),
    videos: [...document.querySelectorAll('video')].map(v => ({
      src: v.currentSrc || v.src,
      poster: v.poster,
      autoplay: v.autoplay, loop: v.loop, muted: v.muted,
      controls: v.controls, playsInline: v.playsInline,
      duration: v.duration,
      dimensions: { w: v.videoWidth, h: v.videoHeight },
      sources: [...v.querySelectorAll('source')].map(s => ({
        src: s.src, type: s.type, media: s.media,
      })),
    })),
    audio: [...document.querySelectorAll('audio')].map(a => ({
      src: a.currentSrc || a.src,
      autoplay: a.autoplay, loop: a.loop, controls: a.controls,
    })),
    backgroundImages: [...bgs],
    fonts: (document.fonts ? [...document.fonts] : []).map(f => ({
      family: f.family,
      weight: f.weight,
      style: f.style,
      stretch: f.stretch,
      unicodeRange: f.unicodeRange,
      status: f.status,
      display: f.display,
    })),
    stylesheets: [...document.styleSheets].map(s => ({
      href: s.href,
      media: s.media?.mediaText || '',
      disabled: s.disabled,
    })).filter(s => s.href),
    scripts: [...document.scripts].filter(s => s.src).map(s => ({
      src: s.src,
      type: s.type,
      async: s.async,
      defer: s.defer,
      module: s.type === 'module',
    })),
    preloads: [...document.querySelectorAll('link[rel="preload"], link[rel="prefetch"], link[rel="preconnect"], link[rel="dns-prefetch"]')].map(l => ({
      rel: l.rel, href: l.href, as: l.as, type: l.type, crossOrigin: l.crossOrigin,
    })),
    icons: [...document.querySelectorAll('link[rel*="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]')].map(l => ({
      rel: l.rel, href: l.href, sizes: l.sizes, type: l.type,
    })),
  };
};

// Meta + accessibility + performance
window.__DDNA_extractMeta = function () {
  return {
    description: document.querySelector('meta[name="description"]')?.content || '',
    keywords: document.querySelector('meta[name="keywords"]')?.content || '',
    viewport: document.querySelector('meta[name="viewport"]')?.content || '',
    themeColor: document.querySelector('meta[name="theme-color"]')?.content || '',
    colorScheme: document.querySelector('meta[name="color-scheme"]')?.content || '',
    author: document.querySelector('meta[name="author"]')?.content || '',
    generator: document.querySelector('meta[name="generator"]')?.content || '',
    robots: document.querySelector('meta[name="robots"]')?.content || '',
    og: [...document.querySelectorAll('meta[property^="og:"]')]
      .reduce((a, m) => (a[m.getAttribute('property')] = m.content, a), {}),
    twitter: [...document.querySelectorAll('meta[name^="twitter:"]')]
      .reduce((a, m) => (a[m.name] = m.content, a), {}),
    favicon: document.querySelector('link[rel*="icon"]')?.href || '',
    canonical: document.querySelector('link[rel="canonical"]')?.href || '',
    manifest: document.querySelector('link[rel="manifest"]')?.href || '',
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    charset: document.characterSet,
  };
};

window.__DDNA_extractA11y = function () {
  return {
    landmarks: [...document.querySelectorAll('[role], main, nav, header, footer, aside, section[aria-label]')]
      .slice(0, 40)
      .map(el => ({
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role') || el.tagName.toLowerCase(),
        label: el.getAttribute('aria-label') ||
               (el.getAttribute('aria-labelledby') ? `→${el.getAttribute('aria-labelledby')}` : ''),
      })),
    skipLinks: [...document.querySelectorAll('a[href^="#"]')]
      .slice(0, 8)
      .map(a => ({ text: a.textContent.trim(), href: a.href })),
    headingOutline: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
      .slice(0, 50)
      .map(h => ({
        level: parseInt(h.tagName[1]),
        text: h.textContent.trim().slice(0, 100),
      })),
    formsCount: document.querySelectorAll('form').length,
    inputsTotal: document.querySelectorAll('input,textarea,select').length,
    inputsWithoutLabels: [...document.querySelectorAll('input,textarea,select')]
      .filter(i => !i.labels?.length && !i.getAttribute('aria-label') && !i.getAttribute('aria-labelledby')).length,
    imagesTotal: document.querySelectorAll('img').length,
    imagesWithoutAlt: [...document.querySelectorAll('img')].filter(i => !i.alt).length,
    buttonsWithoutLabel: [...document.querySelectorAll('button')]
      .filter(b => !b.textContent.trim() && !b.getAttribute('aria-label')).length,
    contrastIssues: 0, // Would need color-contrast lib
    prefersReducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    prefersColorScheme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  };
};

window.__DDNA_extractPerformance = function () {
  if (!window.performance) return null;
  const nav = performance.getEntriesByType('navigation')[0];
  const paint = performance.getEntriesByType('paint');
  const resources = performance.getEntriesByType('resource');

  const byType = resources.reduce((acc, r) => {
    const type = r.initiatorType || 'other';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const totalSize = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);

  let lcp = null;
  try {
    const entries = performance.getEntriesByType('largest-contentful-paint');
    if (entries.length) {
      const last = entries[entries.length - 1];
      lcp = {
        time: last.startTime | 0,
        size: last.size,
        element: last.element?.tagName || '',
        url: last.url || '',
      };
    }
  } catch {}

  return {
    domComplete: nav?.domComplete | 0,
    domContentLoaded: nav?.domContentLoadedEventEnd | 0,
    loadEventEnd: nav?.loadEventEnd | 0,
    transferSize: nav?.transferSize,
    encodedBodySize: nav?.encodedBodySize,
    decodedBodySize: nav?.decodedBodySize,
    firstPaint: paint.find(p => p.name === 'first-paint')?.startTime | 0,
    firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime | 0,
    largestContentfulPaint: lcp,
    resourceCount: resources.length,
    resourcesByType: byType,
    totalTransferSize: totalSize,
    memory: performance.memory ? {
      used: (performance.memory.usedJSHeapSize / 1048576) | 0,
      total: (performance.memory.totalJSHeapSize / 1048576) | 0,
      limit: (performance.memory.jsHeapSizeLimit / 1048576) | 0,
    } : null,
  };
};

window.__DDNA_extractTailwind = function () {
  const allClasses = new Set();
  document.querySelectorAll('[class]').forEach(el => {
    el.classList.forEach(c => allClasses.add(c));
  });
  const twPrefixes = [
    'flex','grid','block','inline','hidden','table','contents',
    'text-','bg-','from-','to-','via-',
    'p-','m-','px-','py-','mx-','my-','pt-','pb-','pl-','pr-','mt-','mb-','ml-','mr-',
    'space-x-','space-y-','gap-',
    'w-','h-','min-w-','min-h-','max-w-','max-h-','size-',
    'rounded','shadow','ring','border',
    'items-','justify-','self-','place-','content-','order-',
    'font-','leading-','tracking-','line-clamp-','indent-',
    'opacity-','z-','top-','left-','right-','bottom-','inset-',
    'absolute','relative','fixed','sticky','static',
    'transition','duration-','ease-','delay-',
    'transform','rotate-','scale-','translate-','skew-','origin-',
    'animate-','blur-','brightness-','contrast-','drop-shadow-','grayscale','saturate-',
    'cursor-','select-','overflow-','overscroll-',
    'aspect-','columns-','break-',
  ];
  const twModifiers = ['hover:','focus:','focus-visible:','focus-within:','active:','disabled:','group-hover:','peer-hover:',
    'sm:','md:','lg:','xl:','2xl:','dark:','print:','motion-safe:','motion-reduce:','rtl:','ltr:','first:','last:','odd:','even:','before:','after:','placeholder:','file:','marker:'];

  const isTw = (c) => {
    const stripped = twModifiers.reduce((s, m) => s.replace(m, ''), c);
    return twPrefixes.some(p => stripped.startsWith(p) || stripped === p.replace('-',''));
  };
  const twClasses = [...allClasses].filter(isTw);
  const arbitraryClasses = twClasses.filter(c => /$$.*?$$/.test(c));
  const usedModifiers = [...new Set(twClasses.flatMap(c =>
    twModifiers.filter(m => c.includes(m))
  ))];

  return {
    likely: twClasses.length > 30,
    utilityClassCount: twClasses.length,
    totalUniqueClasses: allClasses.size,
    arbitraryValueCount: arbitraryClasses.length,
    sampleClasses: twClasses.slice(0, 80),
    arbitrarySamples: arbitraryClasses.slice(0, 20),
    breakpointPrefixes: usedModifiers.filter(m => /^(sm|md|lg|xl|2xl):/.test(m)),
    stateModifiers: usedModifiers.filter(m => !/^(sm|md|lg|xl|2xl|dark|print):/.test(m)),
    darkModeUsed: twClasses.some(c => c.startsWith('dark:')),
    configHint: window.tailwind?.config || null,
  };
};