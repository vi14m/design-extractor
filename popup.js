document.getElementById('extractBtn').addEventListener('click', async () => {
  const statusEl = document.getElementById('status');
  const log = (msg) => { statusEl.textContent = msg; };

  log('1/6: Getting active tab...');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab found.');

    log('2/6: Injecting GSAP scanner...');

    // Inject GSAP detector script into page first
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: injectGSAPScanner,
    });

    log('3/6: Scanning page design + animations...');
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractDesignData,
    });
    const designData = results[0].result;
    if (!designData) throw new Error('Design extraction returned nothing.');

    log('4/6: Scanning hover effects...');
    const hoverResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractHoverEffects,
    });
    designData.hoverEffects = hoverResults[0].result || [];

    log('5/6: Generating markdown...');
    const markdown = generateMarkdown(designData);

    log('6/6: Downloading file...');
    downloadMarkdown(markdown, tab.title);
    log('✅ Done! File downloaded.');
  } catch (err) {
    log('❌ Error: ' + err.message);
    console.error(err);
  }
});

// -------------------------------------------------------
// INJECTED FIRST: exposes GSAP instance data to window
// -------------------------------------------------------
function injectGSAPScanner() {
  try {
    // Expose GSAP tween/timeline data to a readable property
    if (window.gsap && !window.__gsapExtracted) {
      const tweens = [];
      const timelines = [];

      // Walk the GSAP globalTimeline
      const gt = gsap.globalTimeline;
      const walk = (tl, depth = 0) => {
        if (!tl || depth > 6) return;
        const children = tl.getChildren ? tl.getChildren(false, true, true) : [];
        for (const child of children) {
          const isTimeline = child.getChildren !== undefined;
          const entry = {
            type: isTimeline ? 'timeline' : 'tween',
            duration: child.duration ? child.duration() : 0,
            delay: child.delay ? child.delay() : 0,
            vars: child.vars || {},
            targets: [],
            ease: child.vars?.ease?.toString?.() || (child.vars?.ease ?? ''),
            repeat: child.vars?.repeat ?? 0,
            yoyo: child.vars?.yoyo ?? false,
            paused: child.paused ? child.paused() : false,
            labels: isTimeline && child.labels ? child.labels : {},
          };

          // Resolve target elements to selectors
          try {
            const targets = gsap.utils.toArray(child.targets ? child.targets() : []);
            entry.targets = targets.map(el => {
              if (!el || !el.tagName) return String(el);
              const id = el.id ? `#${el.id}` : '';
              const cls = [...(el.classList || [])].map(c => `.${c}`).join('');
              return (id || cls || el.tagName.toLowerCase()).slice(0, 80);
            });
          } catch { /* ignore */ }

          // Animated CSS properties
          const cssProps = {};
          ['x','y','xPercent','yPercent','rotation','rotationX','rotationY',
           'scale','scaleX','scaleY','opacity','width','height','top','left',
           'right','bottom','backgroundColor','color','borderRadius','skewX',
           'skewY','transformOrigin','clipPath','filter','autoAlpha'].forEach(p => {
            if (p in (child.vars || {})) cssProps[p] = child.vars[p];
          });
          entry.cssProps = cssProps;

          if (isTimeline) timelines.push(entry);
          else tweens.push(entry);

          if (isTimeline) walk(child, depth + 1);
        }
      };

      walk(gt);
      window.__gsapExtracted = { tweens, timelines };
    }

    // ScrollTrigger instances
    if (window.ScrollTrigger && !window.__scrollTriggerExtracted) {
      const sts = ScrollTrigger.getAll ? ScrollTrigger.getAll() : [];
      window.__scrollTriggerExtracted = sts.map(st => {
        const trigger = st.trigger;
        let selector = '';
        if (trigger) {
          const id = trigger.id ? `#${trigger.id}` : '';
          const cls = [...(trigger.classList || [])].map(c => `.${c}`).join('');
          selector = (id || cls || trigger.tagName?.toLowerCase() || 'unknown').slice(0, 80);
        }
        return {
          trigger: selector,
          start: st.start,
          end: st.end,
          scrub: st.vars?.scrub ?? false,
          pin: st.vars?.pin ?? false,
          pinSpacing: st.vars?.pinSpacing ?? false,
          markers: st.vars?.markers ?? false,
          toggleClass: st.vars?.toggleClass ?? '',
          onEnter: st.vars?.onEnter?.toString?.()?.slice(0, 100) ?? '',
          animation: st.animation ? {
            duration: st.animation.duration?.() ?? 0,
            targets: (() => {
              try {
                return gsap.utils.toArray(st.animation.targets()).map(el => {
                  const id = el?.id ? `#${el.id}` : '';
                  const cls = [...(el?.classList || [])].map(c => `.${c}`).join('');
                  return (id || cls || el?.tagName?.toLowerCase() || '?').slice(0, 60);
                });
              } catch { return []; }
            })(),
            vars: st.animation.vars ?? {},
          } : null,
        };
      });
    }
  } catch (e) {
    window.__gsapExtracted = { error: e.message };
  }
}

// -------------------------------------------------------
// MAIN EXTRACTOR — runs inside the web page
// -------------------------------------------------------
async function extractDesignData() {
  const isVisible = (el) => {
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  };

  const getAbsoluteUrl = (relUrl) => {
    if (!relUrl) return '';
    try { return new URL(relUrl, location.href).href; } catch { return relUrl; }
  };

  const extractUrlFromCSS = (value) => {
    const match = value?.match(/url\(["']?(.*?)["']?\)/);
    return match ? getAbsoluteUrl(match[1]) : '';
  };

  const keyframesMap = new Map();
  const fontFaceRules = [];
  const cssVariables = {};
  const mediaQueries = [];

  // ── CSS Rule Processing ──────────────────────────────
  const processStylesheet = async (sheet) => {
    try {
      const rules = sheet.cssRules || sheet.rules;
      for (const rule of rules) {
        if (rule instanceof CSSKeyframesRule) {
          keyframesMap.set(rule.name, rule.cssText);
        } else if (rule instanceof CSSFontFaceRule) {
          fontFaceRules.push(rule.cssText);
        } else if (rule instanceof CSSMediaRule) {
          mediaQueries.push({
            condition: rule.conditionText,
            rules: [...rule.cssRules].slice(0, 5).map(r => r.cssText?.slice(0, 200) || ''),
          });
        } else if (rule instanceof CSSStyleRule) {
          // Extract CSS custom properties from :root
          if (rule.selectorText === ':root' || rule.selectorText?.includes('html')) {
            for (const prop of rule.style) {
              if (prop.startsWith('--')) {
                cssVariables[prop] = rule.style.getPropertyValue(prop).trim();
              }
            }
          }
        }
      }
    } catch {
      if (sheet.href?.startsWith('http')) {
        try {
          const resp = await fetch(sheet.href);
          const text = await resp.text();
          for (const match of text.matchAll(/@keyframes\s+([^{]+)\{([\s\S]*?)\}\s*\}/g)) {
            keyframesMap.set(match[1].trim(), `@keyframes ${match[1].trim()} {${match[2]}}`);
          }
          for (const match of text.matchAll(/@font-face\s*\{[^}]*\}/g)) {
            fontFaceRules.push(match[0]);
          }
          // Extract CSS vars from external sheets too
          for (const match of text.matchAll(/:root\s*\{([^}]*)\}/g)) {
            for (const varMatch of match[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
              cssVariables[varMatch[1]] = varMatch[2].trim();
            }
          }
        } catch { /* ignore */ }
      }
    }
  };

  // ── Inline Script Mining ─────────────────────────────
  const mineScripts = () => {
    const scripts = [...document.scripts];
    const gsapCalls = [];
    const scrollTriggerCalls = [];
    const hoverJSCalls = [];

    const gsapPatterns = [
      /gsap\.(to|from|fromTo|set|timeline|tween)\s*\(([^;]{0,400})/g,
      /TweenMax\.(to|from|fromTo|set)\s*\(([^;]{0,300})/g,
      /TweenLite\.(to|from)\s*\(([^;]{0,300})/g,
    ];
    const stPatterns = [
      /ScrollTrigger\.create\s*\(\s*\{([^}]{0,500})/g,
      /scrollTrigger\s*:\s*\{([^}]{0,400})/g,
    ];
    const hoverPatterns = [
      /addEventListener\s*\(\s*['"]mouse(?:enter|leave|over|out)['"]\s*,([^)]{0,200})/g,
      /\.on\s*\(\s*['"]hover['"]\s*,([^)]{0,200})/g,
      /\.hover\s*\(([^)]{0,200})/g,
    ];

    for (const script of scripts) {
      const src = script.textContent || '';
      if (!src) continue;

      gsapPatterns.forEach(pat => {
        for (const m of src.matchAll(pat)) {
          gsapCalls.push({ call: m[0].slice(0, 300) });
        }
      });
      stPatterns.forEach(pat => {
        for (const m of src.matchAll(pat)) {
          scrollTriggerCalls.push({ call: m[0].slice(0, 300) });
        }
      });
      hoverPatterns.forEach(pat => {
        for (const m of src.matchAll(pat)) {
          hoverJSCalls.push(m[0].slice(0, 200));
        }
      });
    }

    return { gsapCalls, scrollTriggerCalls, hoverJSCalls };
  };

  // ── Color Palette ────────────────────────────────────
  const palette = new Set();
  const bodyStyle = getComputedStyle(document.body);
  const baseFont = bodyStyle.fontFamily.split(',')[0].trim().replace(/["']/g, '');
  const baseFontSize = bodyStyle.fontSize;
  const baseColor = bodyStyle.color;
  const bgColor = bodyStyle.backgroundColor;

  // ── Gradient Extractor ───────────────────────────────
  const extractGradients = (bgImage) => {
    if (!bgImage || bgImage === 'none') return null;
    if (bgImage.includes('gradient')) return bgImage;
    return null;
  };

  // ── Box Shadow / Filter ──────────────────────────────
  const extractShadow = (style) => {
    const shadows = [];
    if (style.boxShadow && style.boxShadow !== 'none') shadows.push({ type: 'box', value: style.boxShadow });
    if (style.textShadow && style.textShadow !== 'none') shadows.push({ type: 'text', value: style.textShadow });
    if (style.filter && style.filter !== 'none') shadows.push({ type: 'filter', value: style.filter });
    return shadows.length ? shadows : null;
  };

  // ── Scroll-related CSS ───────────────────────────────
  const extractScrollProps = (style) => {
    const props = {};
    if (style.overflowY && style.overflowY !== 'visible') props.overflowY = style.overflowY;
    if (style.scrollBehavior) props.scrollBehavior = style.scrollBehavior;
    if (style.scrollSnapType && style.scrollSnapType !== 'none') props.scrollSnapType = style.scrollSnapType;
    if (style.scrollSnapAlign && style.scrollSnapAlign !== 'none') props.scrollSnapAlign = style.scrollSnapAlign;
    if (style.position === 'sticky') props.sticky = true;
    return Object.keys(props).length ? props : null;
  };

  // ── Grid / Flex Layout Extractor ─────────────────────
  const extractLayoutDetails = (style) => {
    const d = style.display;
    const layout = { display: d };

    if (d.includes('grid')) {
      layout.gridTemplateColumns = style.gridTemplateColumns;
      layout.gridTemplateRows = style.gridTemplateRows;
      layout.gridTemplateAreas = style.gridTemplateAreas !== 'none' ? style.gridTemplateAreas : '';
      layout.gridAutoFlow = style.gridAutoFlow;
      layout.gap = style.gap;
      layout.columnGap = style.columnGap;
      layout.rowGap = style.rowGap;
    }
    if (d.includes('flex')) {
      layout.flexDirection = style.flexDirection;
      layout.flexWrap = style.flexWrap;
      layout.justifyContent = style.justifyContent;
      layout.alignItems = style.alignItems;
      layout.alignContent = style.alignContent;
      layout.gap = style.gap;
    }
    if (style.position !== 'static') {
      layout.position = style.position;
      layout.top = style.top;
      layout.left = style.left;
      layout.right = style.right;
      layout.bottom = style.bottom;
      layout.zIndex = style.zIndex;
    }

    layout.padding = style.padding;
    layout.margin = style.margin;
    layout.width = style.width;
    layout.height = style.height;
    layout.maxWidth = style.maxWidth;
    layout.minHeight = style.minHeight;
    layout.overflow = style.overflow !== 'visible' ? style.overflow : '';
    layout.boxSizing = style.boxSizing;
    layout.transform = style.transform !== 'none' ? style.transform : '';
    layout.willChange = style.willChange !== 'auto' ? style.willChange : '';

    return layout;
  };

  // ── CSS Animation on Element ─────────────────────────
  const extractCSSAnimation = (style) => {
    const animName = style.animationName;
    if (!animName || animName === 'none') return null;
    return {
      name: animName,
      duration: style.animationDuration,
      timing: style.animationTimingFunction,
      delay: style.animationDelay,
      iteration: style.animationIterationCount,
      direction: style.animationDirection,
      fillMode: style.animationFillMode,
      playState: style.animationPlayState,
    };
  };

  // ── CSS Transition on Element ────────────────────────
  const extractCSSTransition = (style) => {
    if (!style.transitionProperty || style.transitionProperty === 'all' && style.transitionDuration === '0s') return null;
    return {
      property: style.transitionProperty,
      duration: style.transitionDuration,
      timing: style.transitionTimingFunction,
      delay: style.transitionDelay,
    };
  };

  // ── Node Processor ───────────────────────────────────
  const processNode = (el, depth = 0) => {
    if (!isVisible(el) || depth > 12) return null;
    const tag = el.tagName.toLowerCase();
    const style = getComputedStyle(el);
    const classes = [...el.classList].join(' ') || '';
    const id = el.id || '';

    const bg = style.backgroundColor;
    const color = style.color;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') palette.add(bg);
    if (color && color !== 'rgb(0, 0, 0)' && color !== 'rgba(0, 0, 0, 0)') palette.add(color);

    const node = {
      tag,
      id,
      classes,
      selector: id ? `#${id}` : (classes ? `.${classes.trim().split(' ')[0]}` : tag),
      layout: extractLayoutDetails(style),
      background: {
        color: bg !== 'rgba(0, 0, 0, 0)' ? bg : '',
        image: extractUrlFromCSS(style.backgroundImage),
        gradient: extractGradients(style.backgroundImage),
        size: style.backgroundSize,
        position: style.backgroundPosition,
        repeat: style.backgroundRepeat,
        attachment: style.backgroundAttachment,
        blend: style.backgroundBlendMode !== 'normal' ? style.backgroundBlendMode : '',
        clip: style.backgroundClip !== 'border-box' ? style.backgroundClip : '',
      },
      border: {
        all: style.border,
        radius: style.borderRadius,
        outline: style.outline !== 'none' ? style.outline : '',
      },
      typography: {
        fontFamily: style.fontFamily.split(',')[0].trim().replace(/["']/g, ''),
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        fontStyle: style.fontStyle,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        textTransform: style.textTransform !== 'none' ? style.textTransform : '',
        textDecoration: style.textDecoration,
        textAlign: style.textAlign,
        color: style.color,
        whiteSpace: style.whiteSpace,
      },
      visual: {
        opacity: style.opacity !== '1' ? style.opacity : '',
        mixBlendMode: style.mixBlendMode !== 'normal' ? style.mixBlendMode : '',
        shadows: extractShadow(style),
        cursor: style.cursor !== 'auto' ? style.cursor : '',
        pointerEvents: style.pointerEvents !== 'auto' ? style.pointerEvents : '',
        userSelect: style.userSelect !== 'auto' ? style.userSelect : '',
        clipPath: style.clipPath !== 'none' ? style.clipPath : '',
        maskImage: style.maskImage !== 'none' ? style.maskImage : '',
        imageRendering: style.imageRendering !== 'auto' ? style.imageRendering : '',
        aspectRatio: style.aspectRatio !== 'auto' ? style.aspectRatio : '',
        backdropFilter: style.backdropFilter !== 'none' ? style.backdropFilter : '',
        objectFit: style.objectFit !== 'fill' ? style.objectFit : '',
      },
      scrollProps: extractScrollProps(style),
      animation: extractCSSAnimation(style),
      transition: extractCSSTransition(style),
      isImage: tag === 'img' || !!extractUrlFromCSS(style.backgroundImage),
      imageSrc: tag === 'img' ? el.src : extractUrlFromCSS(style.backgroundImage),
      // GSAP data-attributes and class markers
      gsapAttrs: {
        dataSpeed: el.dataset?.speed || '',
        dataLag: el.dataset?.lag || '',
        dataScrub: el.dataset?.scrub || '',
        dataParallax: el.dataset?.parallax || '',
        gsapClass: classes.includes('gsap') || classes.includes('anim') ? classes : '',
        revealClass: classes.match(/(reveal|fade|slide|zoom|parallax|appear)/i)?.[0] || '',
      },
      // Content
      text: el.textContent.trim().slice(0, 100),
      ariaLabel: el.getAttribute('aria-label') || '',
      role: el.getAttribute('role') || '',
      href: (tag === 'a') ? el.getAttribute('href') || '' : '',
      children: [],
    };

    for (const child of el.children) {
      const childNode = processNode(child, depth + 1);
      if (childNode) node.children.push(childNode);
    }
    return node;
  };

  // ── Section Collection ───────────────────────────────
  const sectionElements = [...document.body.children].filter(
    el => isVisible(el) && !['SCRIPT','STYLE','NOSCRIPT','META','LINK'].includes(el.tagName)
  );

  const sheets = [...document.styleSheets];
  await Promise.all(sheets.map(sheet => processStylesheet(sheet).catch(() => {})));

  const sections = sectionElements.map(el => processNode(el)).filter(Boolean);
  const scriptData = mineScripts();

  // ── GSAP Runtime Data (from injected scanner) ────────
  const gsapRuntime = window.__gsapExtracted || null;
  const scrollTriggerRuntime = window.__scrollTriggerExtracted || null;

  // ── Typography Scale Extractor ───────────────────────
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,button,a,span')]
    .filter(isVisible)
    .slice(0, 30)
    .map(el => {
      const s = getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        lineHeight: s.lineHeight,
        fontFamily: s.fontFamily.split(',')[0].trim().replace(/["']/g, ''),
        color: s.color,
        text: el.textContent.trim().slice(0, 50),
      };
    });

  // ── Z-index layer map ────────────────────────────────
  const zLayers = [...document.querySelectorAll('*')]
    .filter(el => {
      const z = getComputedStyle(el).zIndex;
      return z && z !== 'auto' && parseInt(z) !== 0;
    })
    .slice(0, 20)
    .map(el => {
      const id = el.id ? `#${el.id}` : '';
      const cls = [...el.classList].map(c => `.${c}`).join('').slice(0, 40);
      return { selector: id || cls || el.tagName.toLowerCase(), zIndex: getComputedStyle(el).zIndex };
    });

  return {
    pageTitle: document.title,
    url: location.href,
    baseFont,
    baseFontSize,
    baseColor,
    bgColor,
    palette: [...palette],
    cssVariables,
    sections,
    keyframes: Object.fromEntries(keyframesMap),
    fontFaceRules,
    mediaQueries,
    typographyScale: headings,
    zLayers,
    scriptData,
    gsapRuntime,
    scrollTriggerRuntime,
  };
}

// -------------------------------------------------------
// HOVER EXTRACTOR — separate pass, simulates events
// -------------------------------------------------------
function extractHoverEffects() {
  const results = [];
  const candidates = [...document.querySelectorAll(
    'a, button, [class*="btn"], [class*="card"], [class*="hover"], nav li, .menu-item, [class*="link"], [data-hover]'
  )].slice(0, 40);

  for (const el of candidates) {
    const before = getComputedStyle(el);
    const snap = (style) => ({
      color: style.color,
      backgroundColor: style.backgroundColor,
      transform: style.transform,
      opacity: style.opacity,
      boxShadow: style.boxShadow,
      borderColor: style.borderColor,
      textDecoration: style.textDecoration,
      filter: style.filter,
      outline: style.outline,
      scale: style.scale,
      transition: style.transition,
    });

    const id = el.id ? `#${el.id}` : '';
    const cls = [...el.classList].map(c => `.${c}`).join('').slice(0, 60);
    const selector = id || cls || el.tagName.toLowerCase();

    const beforeSnap = snap(before);

    // Check :hover pseudo-class via stylesheet rules
    const hoverRules = [];
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules || []) {
          if (rule instanceof CSSStyleRule && rule.selectorText?.includes(':hover')) {
            const matches = el.matches(rule.selectorText.replace(/:hover/g, '').trim());
            if (matches) {
              hoverRules.push({
                selector: rule.selectorText,
                styles: rule.style.cssText,
              });
            }
          }
        }
      } catch { /* cross-origin */ }
    }

    // JS event listener inference (duck-typing from event listeners)
    const hasTransition = beforeSnap.transition && beforeSnap.transition !== 'all 0s ease 0s' && beforeSnap.transition !== '';

    if (hoverRules.length || hasTransition) {
      results.push({
        selector,
        tag: el.tagName.toLowerCase(),
        text: el.textContent.trim().slice(0, 50),
        baseStyles: beforeSnap,
        hoverRules,
        hasTransition,
        cursor: before.cursor,
      });
    }
  }

  return results;
}

// -------------------------------------------------------
// MARKDOWN GENERATOR
// -------------------------------------------------------
function generateMarkdown(data) {
  let md = `# Design Spec: ${data.pageTitle}\n\n`;
  md += `- **Source URL:** ${data.url}\n`;
  md += `- **Base font:** ${data.baseFont}, ${data.baseFontSize}\n`;
  md += `- **Base text color:** ${data.baseColor}\n`;
  md += `- **Page background:** ${data.bgColor}\n\n`;

  // ── Color Palette ────────────────────────────────────
  md += `## 🎨 Color Palette\n\n`;
  data.palette.forEach(c => { md += `- \`${c}\`\n`; });

  // ── CSS Variables ────────────────────────────────────
  if (Object.keys(data.cssVariables).length) {
    md += `\n## 🔧 CSS Custom Properties (Design Tokens)\n\n\`\`\`css\n:root {\n`;
    for (const [k, v] of Object.entries(data.cssVariables)) {
      md += `  ${k}: ${v};\n`;
    }
    md += `}\n\`\`\`\n`;
  }

  // ── Typography ────────────────────────────────────────
  md += `\n## 🔤 Typography\n\n`;
  md += `- Base: **${data.baseFont}** (${data.baseFontSize})\n\n`;

  if (data.typographyScale?.length) {
    md += `### Type Scale\n\n| Tag | Font | Size | Weight | Color | Sample |\n|-----|------|------|--------|-------|--------|\n`;
    const seen = new Set();
    data.typographyScale.forEach(t => {
      const key = `${t.tag}-${t.fontSize}-${t.fontWeight}`;
      if (!seen.has(key)) {
        seen.add(key);
        md += `| \`${t.tag}\` | ${t.fontFamily} | ${t.fontSize} | ${t.fontWeight} | \`${t.color}\` | ${t.text.slice(0,30)} |\n`;
      }
    });
  }

  if (data.fontFaceRules?.length) {
    md += `\n### @font-face Declarations\n`;
    data.fontFaceRules.forEach(ff => { md += `\n\`\`\`css\n${ff}\n\`\`\`\n`; });
  }

  // ── Media Queries ────────────────────────────────────
  if (data.mediaQueries?.length) {
    md += `\n## 📱 Responsive Breakpoints\n\n`;
    const uniqueMQ = [...new Map(data.mediaQueries.map(mq => [mq.condition, mq])).values()].slice(0, 10);
    uniqueMQ.forEach(mq => {
      md += `### \`${mq.condition}\`\n`;
      mq.rules.slice(0, 3).forEach(r => {
        md += `\`\`\`css\n${r}\n\`\`\`\n`;
      });
    });
  }

  // ── Z-Index Layers ────────────────────────────────────
  if (data.zLayers?.length) {
    md += `\n## 📐 Z-Index Layer Map\n\n| Selector | z-index |\n|----------|--------|\n`;
    data.zLayers
      .sort((a, b) => parseInt(b.zIndex) - parseInt(a.zIndex))
      .forEach(z => { md += `| \`${z.selector}\` | ${z.zIndex} |\n`; });
  }

  // ── GSAP Runtime Animations ───────────────────────────
  const gsap = data.gsapRuntime;
  if (gsap && !gsap.error) {
    md += `\n## ⚡ GSAP Animations (Runtime)\n\n`;

    if (gsap.tweens?.length) {
      md += `### Tweens (${gsap.tweens.length})\n\n`;
      gsap.tweens.slice(0, 30).forEach((t, i) => {
        md += `#### Tween ${i + 1}\n`;
        if (t.targets?.length) md += `- **Targets:** ${t.targets.join(', ')}\n`;
        md += `- **Duration:** ${t.duration}s | **Delay:** ${t.delay}s\n`;
        if (t.ease) md += `- **Ease:** \`${t.ease}\`\n`;
        if (t.repeat) md += `- **Repeat:** ${t.repeat}${t.yoyo ? ' (yoyo)' : ''}\n`;
        if (Object.keys(t.cssProps).length) {
          md += `- **Animated Props:**\n\`\`\`json\n${JSON.stringify(t.cssProps, null, 2)}\n\`\`\`\n`;
        }
      });
    }

    if (gsap.timelines?.length) {
      md += `\n### Timelines (${gsap.timelines.length})\n\n`;
      gsap.timelines.slice(0, 10).forEach((tl, i) => {
        md += `#### Timeline ${i + 1}\n`;
        if (tl.targets?.length) md += `- **Targets:** ${tl.targets.join(', ')}\n`;
        md += `- **Duration:** ${tl.duration}s\n`;
        if (Object.keys(tl.labels).length) {
          md += `- **Labels:** ${JSON.stringify(tl.labels)}\n`;
        }
      });
    }
  } else if (gsap?.error) {
    md += `\n## ⚡ GSAP\n\n> GSAP not detected or error: ${gsap.error}\n`;
  }

  // ── ScrollTrigger Animations ──────────────────────────
  const st = data.scrollTriggerRuntime;
  if (st?.length) {
    md += `\n## 🖱️ ScrollTrigger Animations (${st.length})\n\n`;
    st.forEach((s, i) => {
      md += `### ST ${i + 1}: \`${s.trigger}\`\n`;
      md += `- **Start/End:** \`${s.start}\` → \`${s.end}\`\n`;
      if (s.scrub) md += `- **Scrub:** ${s.scrub}\n`;
      if (s.pin) md += `- **Pinned:** yes\n`;
      if (s.toggleClass) md += `- **Toggle class:** \`${s.toggleClass}\`\n`;
      if (s.animation) {
        md += `- **Animation:** ${s.animation.duration}s on ${s.animation.targets?.join(', ')}\n`;
        if (Object.keys(s.animation.vars || {}).filter(k => !['scrollTrigger','ease'].includes(k)).length) {
          const cleanVars = Object.fromEntries(
            Object.entries(s.animation.vars).filter(([k]) => !['scrollTrigger'].includes(k))
          );
          md += `\`\`\`json\n${JSON.stringify(cleanVars, null, 2).slice(0, 400)}\n\`\`\`\n`;
        }
      }
    });
  }

  // ── JS-Mined GSAP Calls ──────────────────────────────
  const { gsapCalls, scrollTriggerCalls, hoverJSCalls } = data.scriptData || {};
  if (gsapCalls?.length) {
    md += `\n## 📜 GSAP Calls (Source-Mined)\n\n`;
    gsapCalls.slice(0, 15).forEach((c, i) => {
      md += `${i + 1}. \`\`\`js\n${c.call.trim()}\n\`\`\`\n`;
    });
  }
  if (scrollTriggerCalls?.length) {
    md += `\n## 📜 ScrollTrigger Calls (Source-Mined)\n\n`;
    scrollTriggerCalls.slice(0, 10).forEach((c, i) => {
      md += `${i + 1}. \`\`\`js\n${c.call.trim()}\n\`\`\`\n`;
    });
  }
  if (hoverJSCalls?.length) {
    md += `\n## 🖱️ Hover JS Listeners (Source-Mined)\n\n`;
    hoverJSCalls.slice(0, 10).forEach((c, i) => { md += `${i + 1}. \`\`\`js\n${c.trim()}\n\`\`\`\n`; });
  }

  // ── CSS Keyframes ────────────────────────────────────
  if (Object.keys(data.keyframes).length) {
    md += `\n## 🎞️ CSS @keyframes\n\n`;
    Object.entries(data.keyframes).forEach(([name, kf]) => {
      md += `### @keyframes \`${name}\`\n\`\`\`css\n${kf}\n\`\`\`\n\n`;
    });
  }

  // ── Hover Effects ────────────────────────────────────
  if (data.hoverEffects?.length) {
    md += `\n## ✨ Hover Effects\n\n`;
    data.hoverEffects.forEach(h => {
      md += `### \`${h.selector}\` (${h.tag})\n`;
      if (h.text) md += `- Text: "${h.text}"\n`;
      if (h.cursor) md += `- Cursor: \`${h.cursor}\`\n`;
      if (h.baseStyles?.transition) md += `- Transition: \`${h.baseStyles.transition}\`\n`;
      if (h.hoverRules?.length) {
        md += `- CSS :hover rules:\n`;
        h.hoverRules.forEach(r => {
          md += `  - \`${r.selector}\`\n    \`\`\`css\n    ${r.styles}\n    \`\`\`\n`;
        });
      }
    });
  }

  // ── Layout Tree ────────────────────────────────────────
  md += `\n## 🧩 Layout & Component Tree\n\n`;
  const renderNode = (node, depth = 0) => {
    if (depth > 8) return;
    const indent = '  '.repeat(depth);
    const sel = node.id ? `#${node.id}` : node.classes ? `.${node.classes.trim().split(' ').join('.')}` : node.tag;
    md += `${indent}- **\`${sel}\`** *(${node.tag})*\n`;

    const l = node.layout;
    if (l.display) {
      md += `${indent}  - Display: \`${l.display}\``;
      if (l.gridTemplateColumns) md += ` | Grid cols: \`${l.gridTemplateColumns}\``;
      if (l.gridTemplateAreas) md += ` | Areas: \`${l.gridTemplateAreas.slice(0,60)}\``;
      if (l.flexDirection) md += ` | flex-dir: ${l.flexDirection}`;
      if (l.justifyContent && l.justifyContent !== 'normal') md += ` | justify: ${l.justifyContent}`;
      if (l.alignItems && l.alignItems !== 'normal') md += ` | align: ${l.alignItems}`;
      if (l.gap && l.gap !== 'normal') md += ` | gap: ${l.gap}`;
      md += `\n`;
    }
    if (l.position && l.position !== 'static') {
      md += `${indent}  - Position: \`${l.position}\` z:\`${l.zIndex || 'auto'}\`\n`;
    }
    if (l.willChange) md += `${indent}  - will-change: \`${l.willChange}\`\n`;
    if (l.transform) md += `${indent}  - transform: \`${l.transform.slice(0, 80)}\`\n`;

    const bg = node.background;
    if (bg.color) md += `${indent}  - bg: \`${bg.color}\`\n`;
    if (bg.gradient) md += `${indent}  - gradient: \`${bg.gradient.slice(0, 120)}\`\n`;
    if (bg.image) md += `${indent}  - bg-image: \`${bg.image}\`\n`;
    if (bg.blend) md += `${indent}  - blend-mode: \`${bg.blend}\`\n`;
    if (bg.clip) md += `${indent}  - bg-clip: \`${bg.clip}\`\n`;

    const v = node.visual;
    if (v.shadows?.length) {
      v.shadows.forEach(s => { md += `${indent}  - ${s.type}-shadow: \`${s.value.slice(0, 100)}\`\n`; });
    }
    if (v.clipPath) md += `${indent}  - clip-path: \`${v.clipPath}\`\n`;
    if (v.backdropFilter) md += `${indent}  - backdrop-filter: \`${v.backdropFilter}\`\n`;
    if (v.mixBlendMode) md += `${indent}  - mix-blend: \`${v.mixBlendMode}\`\n`;
    if (v.opacity) md += `${indent}  - opacity: \`${v.opacity}\`\n`;

    if (node.scrollProps) {
      const sp = node.scrollProps;
      md += `${indent}  - Scroll:`;
      if (sp.sticky) md += ` sticky`;
      if (sp.scrollSnapType) md += ` snap-type:\`${sp.scrollSnapType}\``;
      if (sp.overflowY) md += ` overflow-y:\`${sp.overflowY}\``;
      md += `\n`;
    }

    if (node.animation) {
      const a = node.animation;
      md += `${indent}  - CSS Anim: \`${a.name}\` ${a.duration} ${a.timing} delay:${a.delay} iter:${a.iteration}\n`;
      const kf = data.keyframes[a.name];
      if (kf) {
        md += `${indent}    \`\`\`css\n${indent}    ${kf.replace(/\n/g, '\n' + indent + '    ')}\n${indent}    \`\`\`\n`;
      }
    }
    if (node.transition) {
      const t = node.transition;
      md += `${indent}  - Transition: \`${t.property} ${t.duration} ${t.timing}\`\n`;
    }

    if (node.gsapAttrs?.revealClass) {
      md += `${indent}  - GSAP Marker: class \`${node.gsapAttrs.revealClass}\`\n`;
    }
    if (node.gsapAttrs?.dataSpeed) md += `${indent}  - data-speed: \`${node.gsapAttrs.dataSpeed}\`\n`;
    if (node.gsapAttrs?.dataParallax) md += `${indent}  - data-parallax: \`${node.gsapAttrs.dataParallax}\`\n`;

    if (node.isImage && node.imageSrc) {
      md += `${indent}  - ![img](${node.imageSrc.slice(0, 120)})\n`;
    }
    if (node.text && node.tag !== 'div' && node.tag !== 'section') {
      md += `${indent}  - Text: "${node.text.slice(0, 80)}"\n`;
    }

    node.children.forEach(child => renderNode(child, depth + 1));
  };
  data.sections.forEach(sec => renderNode(sec));

  return md;
}

// -------------------------------------------------------
// DOWNLOAD HELPER
// -------------------------------------------------------
function downloadMarkdown(markdown, pageTitle) {
  const filename = (pageTitle || 'design').replace(/[\\/:*?"<>|]/g, '_') + '.md';
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename, saveAs: false });
}