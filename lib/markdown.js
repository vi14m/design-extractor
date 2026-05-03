// lib/markdown.js
// Generates a comprehensive Markdown report from extracted data
export function generateMarkdown(d) {
  const out = [];
  const push = (s = '') => out.push(s);
  const code = (lang, content) => `\`\`\`${lang}\n${content}\n\`\`\``;
  const h = (level, text) => `${'#'.repeat(level)} ${text}\n`;
  const truncate = (s, n = 200) => (s && s.length > n ? s.slice(0, n) + '…' : s || '');

  // ═══════════════════════════════════════════════════════
  // HEADER
  // ═══════════════════════════════════════════════════════
  push(h(1, `🧬 Design DNA — ${d.meta?.title || 'Untitled'}`));
  push(`> **URL:** ${d.meta?.url}`);
  push(`> **Extracted:** ${d.meta?.timestamp}`);
  push(`> **Viewport:** ${d.meta?.viewport?.width}×${d.meta?.viewport?.height} @ ${d.meta?.viewport?.dpr}× DPR`);
  push();

  // ═══════════════════════════════════════════════════════
  // TABLE OF CONTENTS
  // ═══════════════════════════════════════════════════════
  push(h(2, '📋 Table of Contents'));
  const toc = [
    ['🎨 Color Palette', 'palette'],
    ['🔧 Design Tokens', 'design-tokens'],
    ['🔤 Typography', 'typography'],
    ['📱 Responsive', 'responsive'],
    ['📐 Z-Index Map', 'z-index'],
    ['⚡ GSAP Animations', 'gsap'],
    ['🖱️ ScrollTrigger', 'scrolltrigger'],
    ['🎞️ Lottie / Three / WebGL', 'lottie-three'],
    ['📜 Native Scroll-Driven CSS', 'native-scroll'],
    ['👁️ Observers', 'observers'],
    ['📜 Script Intelligence', 'script-intel'],
    ['✨ Interaction States', 'interactions'],
    ['🪞 Pseudo-Elements', 'pseudo'],
    ['🎭 SVG & Filters', 'svg'],
    ['🌀 Tailwind Detection', 'tailwind'],
    ['🧬 Component Patterns', 'patterns'],
    ['📦 Assets', 'assets'],
    ['🌍 Meta & SEO', 'meta'],
    ['♿ Accessibility', 'a11y'],
    ['⚡ Performance', 'performance'],
    ['🧩 Layout Tree', 'tree'],
  ];
  toc.forEach(([label]) => push(`- ${label}`));
  push();

  // ═══════════════════════════════════════════════════════
  // PALETTE
  // ═══════════════════════════════════════════════════════
  if (d.layout?.palette?.length) {
    push(h(2, '🎨 Color Palette'));
    push('| Color | Preview | Usage |');
    push('|-------|---------|-------|');
    d.layout.palette.slice(0, 50).forEach(p => {
      push(`| \`${p.color}\` | <span style="display:inline-block;width:20px;height:20px;background:${p.color};border:1px solid #ccc"></span> | ${p.count}× |`);
    });
    push();
  }

  // ═══════════════════════════════════════════════════════
  // DESIGN TOKENS
  // ═══════════════════════════════════════════════════════
  if (d.css?.variables && Object.keys(d.css.variables).length) {
    push(h(2, '🔧 Design Tokens (CSS Variables)'));
    const entries = Object.entries(d.css.variables);
    push(`> ${entries.length} custom properties found\n`);
    push(code('css', `:root {\n${entries.map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}`));
    push();
  }

  // @property
  if (d.css?.properties?.length) {
    push(h(3, '@property Definitions'));
    d.css.properties.forEach(p => {
      push(code('css', `@property ${p.name} {\n  syntax: "${p.syntax || '*'}";\n  inherits: ${p.inherits};\n  initial-value: ${p.initialValue || ''};\n}`));
    });
  }

  // @layer
  if (d.css?.layers?.length) {
    push(h(3, '🎚️ CSS Cascade Layers'));
    d.css.layers.forEach(l => {
      push(`- \`@layer ${l.name}\`${l.ruleCount ? ` *(${l.ruleCount} rules)*` : ''} ${l.type ? `· ${l.type}` : ''}`);
    });
    push();
  }

  // @container
  if (d.css?.containerQueries?.length) {
    push(h(3, '📦 @container Queries'));
    d.css.containerQueries.slice(0, 15).forEach(q => {
      push(`- **\`${q.condition}\`**${q.container ? ` (named: ${q.container})` : ''}`);
    });
    push();
  }

  // ═══════════════════════════════════════════════════════
  // TYPOGRAPHY
  // ═══════════════════════════════════════════════════════
  if (d.typography) {
    push(h(2, '🔤 Typography'));
    const b = d.typography.base;
    push(`- **Base font:** \`${b.family}\` ${b.size} / ${b.lineHeight}, weight ${b.weight}, color \`${b.color}\``);
    if (d.typography.googleFonts?.length) {
      push(`- **Google Fonts:**`);
      d.typography.googleFonts.forEach(f => push(`  - ${f}`));
    }
    if (d.typography.customFonts?.length) {
      push(`- **Preloaded fonts:** ${d.typography.customFonts.length}`);
    }

    if (d.typography.scale?.length) {
      push(h(3, 'Type Scale'));
      push('| Tag | Family | Size | Weight | Line | Letter | Color | Sample |');
      push('|-----|--------|------|--------|------|--------|-------|--------|');
      d.typography.scale.forEach(t => {
        push(`| \`${t.tag}\` | ${t.fontFamily} | ${t.fontSize} | ${t.fontWeight} | ${t.lineHeight} | ${t.letterSpacing} | \`${t.color}\` | ${truncate(t.sample, 30)} |`);
      });
      push();
    }
  }

  if (d.css?.fontFace?.length) {
    push(h(3, '@font-face Declarations'));
    d.css.fontFace.slice(0, 25).forEach(ff => push(code('css', ff)));
  }

  // ═══════════════════════════════════════════════════════
  // RESPONSIVE
  // ═══════════════════════════════════════════════════════
  if (d.css?.mediaQueries?.length) {
    push(h(2, '📱 Responsive Breakpoints'));
    const unique = [...new Map(d.css.mediaQueries.map(m => [m.condition, m])).values()].slice(0, 20);
    unique.forEach(m => {
      push(h(3, `\`${m.condition}\` *(${m.ruleCount} rules)*`));
      m.sample?.slice(0, 3).forEach(r => push(code('css', truncate(r, 250))));
    });
  }

  // ═══════════════════════════════════════════════════════
  // Z-INDEX
  // ═══════════════════════════════════════════════════════
  if (d.layout?.zLayers?.length) {
    push(h(2, '📐 Z-Index Layer Map'));
    push('| Selector | z-index | Position |');
    push('|----------|---------|----------|');
    d.layout.zLayers.forEach(z => push(`| \`${z.selector}\` | ${z.zIndex} | ${z.position} |`));
    push();
  }

  // ═══════════════════════════════════════════════════════
  // GSAP RUNTIME
  // ═══════════════════════════════════════════════════════
  const r = d.runtime || {};
  if (r.gsap && !r.gsap.error) {
    push(h(2, '⚡ GSAP Animations (Runtime)'));
    push(`> **Version:** \`${r.gsap.version || 'unknown'}\``);
    if (r.gsap.registeredPlugins?.length) {
      push(`> **Plugins:** ${r.gsap.registeredPlugins.join(', ')}`);
    }
    if (Object.keys(r.gsap.defaults || {}).length) {
      push(`> **Defaults:** ${JSON.stringify(r.gsap.defaults)}`);
    }
    push();

    if (r.gsap.tweens?.length) {
      push(h(3, `Tweens (${r.gsap.tweens.length})`));
      r.gsap.tweens.slice(0, 50).forEach((t, i) => {
        push(`#### Tween ${i + 1}`);
        if (t.targets?.length) push(`- **Targets:** ${t.targets.join(', ')}`);
        push(`- **Duration:** ${t.duration}s · **Delay:** ${t.delay}s · **Ease:** \`${t.ease}\``);
        if (t.repeat) push(`- **Repeat:** ${t.repeat}${t.yoyo ? ' (yoyo)' : ''}`);
        if (t.stagger) push(`- **Stagger:** ${JSON.stringify(t.stagger)}`);
        const plugins = Object.entries(t.plugins || {}).filter(([, v]) => v).map(([k]) => k);
        if (plugins.length) push(`- **Plugins:** ${plugins.join(', ')}`);
        if (Object.keys(t.cssProps || {}).length) {
          push(code('json', JSON.stringify(t.cssProps, null, 2)));
        }
      });
    }

    if (r.gsap.timelines?.length) {
      push(h(3, `Timelines (${r.gsap.timelines.length})`));
      r.gsap.timelines.slice(0, 20).forEach((tl, i) => {
        push(`#### Timeline ${i + 1}`);
        push(`- **Duration:** ${tl.duration}s`);
        if (Object.keys(tl.labels || {}).length) {
          push(`- **Labels:** \`${JSON.stringify(tl.labels)}\``);
        }
      });
    }
  } else if (r.gsap?.error) {
    push(h(2, '⚡ GSAP'));
    push(`> Not detected — ${r.gsap.error}\n`);
  }

  // ═══════════════════════════════════════════════════════
  // SCROLLTRIGGER
  // ═══════════════════════════════════════════════════════
  if (r.scrollTriggers?.length) {
    push(h(2, `🖱️ ScrollTrigger Instances (${r.scrollTriggers.length})`));
    r.scrollTriggers.forEach((s, i) => {
      push(h(3, `ST ${i + 1} → \`${s.trigger}\``));
            push(`- **Range:** \`${s.start}\` → \`${s.end}\``);
      if (s.scrub !== false) push(`- **Scrub:** ${s.scrub}`);
      if (s.pin) push(`- **Pinned:** yes (spacing: ${s.pinSpacing})`);
      if (s.toggleClass) push(`- **Toggle class:** \`${s.toggleClass}\``);
      if (s.toggleActions) push(`- **Toggle actions:** \`${s.toggleActions}\``);
      if (s.snap) push(`- **Snap:** ${typeof s.snap === 'object' ? JSON.stringify(s.snap) : s.snap}`);
      if (s.horizontal) push(`- **Horizontal:** yes`);
      if (s.anticipatePin) push(`- **Anticipate pin:** ${s.anticipatePin}`);
      if (s.animation) {
        push(`- **Animation duration:** ${s.animation.duration}s`);
        push(code('json', truncate(JSON.stringify(s.animation.vars, null, 2), 600)));
      }
    });
  }

  if (r.scrollSmoother) {
    push(h(2, '🌊 ScrollSmoother'));
    Object.entries(r.scrollSmoother).forEach(([k, v]) => push(`- **${k}:** ${v}`));
    push();
  }

  // ═══════════════════════════════════════════════════════
  // LOTTIE / THREE / FRAMER / OTHERS
  // ═══════════════════════════════════════════════════════
  if (r.lottie?.length) {
    push(h(2, `🎞️ Lottie Animations (${r.lottie.length})`));
    r.lottie.forEach((l, i) => {
      push(h(3, `Lottie ${i + 1}`));
      Object.entries(l).forEach(([k, v]) => push(`- **${k}:** \`${v}\``));
    });
  }

  if (r.three?.length) {
    push(h(2, `🌐 WebGL / Three.js (${r.three.length})`));
    r.three.forEach((t, i) => {
      push(h(3, t.library ? `${t.library} v${t.version}` : `Canvas ${i + 1}`));
      Object.entries(t).forEach(([k, v]) => push(`- **${k}:** ${v}`));
    });
  }

  if (r.framer?.length || r.anime?.length || r.motionOne?.length || r.rive?.length || r.splines?.length) {
    push(h(2, '🎯 Other Animation Libraries'));
    if (r.framer?.length) {
      push(`### Framer Motion (${r.framer.length} components)`);
      r.framer.slice(0, 15).forEach(f => push(`- \`${f.selector}\` — ${f.name || f.type}`));
    }
    if (r.anime?.length) push(`- **anime.js** detected — v${r.anime[0]?.version || '?'}, running: ${r.anime[0]?.running}`);
    if (r.motionOne?.length) push(`- **Motion One** detected`);
    if (r.rive?.length) push(`- **Rive** detected (${r.rive.length} instance${r.rive.length > 1 ? 's' : ''})`);
    if (r.splines?.length) {
      push(`### Spline (${r.splines.length})`);
      r.splines.forEach(s => push(`- \`${s.url}\``));
    }
    push();
  }

  // ═══════════════════════════════════════════════════════
  // NATIVE SCROLL-DRIVEN
  // ═══════════════════════════════════════════════════════
  if (r.scrollDriven?.length) {
    push(h(2, '📜 Native Scroll-Driven CSS'));
    r.scrollDriven.slice(0, 15).forEach(s => push(code('css', truncate(s, 400))));
  }

  // ═══════════════════════════════════════════════════════
  // OBSERVERS
  // ═══════════════════════════════════════════════════════
  if (r.intersectionObservers?.length || r.mutationObservers?.length || r.resizeObservers?.length) {
    push(h(2, '👁️ Runtime Observers'));
    if (r.intersectionObservers?.length) {
      push(h(3, `IntersectionObserver (${r.intersectionObservers.length})`));
      r.intersectionObservers.slice(0, 10).forEach((io, i) => {
        push(`#### IO ${i + 1}`);
        push(`- **Options:** \`${JSON.stringify(io.options)}\``);
        if (io.targets?.length) push(`- **Targets:** ${io.targets.slice(0, 8).join(', ')}`);
        push(code('js', truncate(io.callback, 250)));
      });
    }
    if (r.mutationObservers?.length) push(`- **MutationObserver instances:** ${r.mutationObservers.length}`);
    if (r.resizeObservers?.length) push(`- **ResizeObserver instances:** ${r.resizeObservers.length}`);
    if (r.rafCount) push(`- **requestAnimationFrame calls:** ${r.rafCount}`);
    push();
  }

  // ═══════════════════════════════════════════════════════
  // EVENT LISTENERS (from runtime patch)
  // ═══════════════════════════════════════════════════════
  if (r.eventListeners?.length) {
    push(h(2, `🎯 Event Listeners (${r.eventListeners.length})`));
    const grouped = r.eventListeners.reduce((a, e) => {
      a[e.type] = (a[e.type] || 0) + 1;
      return a;
    }, {});
    push('| Event | Count |');
    push('|-------|-------|');
    Object.entries(grouped).sort((a, b) => b[1] - a[1]).forEach(([t, c]) =>
      push(`| \`${t}\` | ${c} |`)
    );
    push();
  }

  // ═══════════════════════════════════════════════════════
  // CLASS TOGGLES (dynamic state changes)
  // ═══════════════════════════════════════════════════════
  if (r.classToggles?.length) {
    push(h(2, `🔀 Dynamic Class Mutations (${r.classToggles.length})`));
    const unique = [...new Map(r.classToggles.map(c => [c.classes.join(','), c])).values()].slice(0, 20);
    push('| Operation | Classes |');
    push('|-----------|---------|');
    unique.forEach(c => push(`| \`${c.op}\` | \`${c.classes.join(', ')}\` |`));
    push();
  }

  // ═══════════════════════════════════════════════════════
  // SCRIPT INTELLIGENCE
  // ═══════════════════════════════════════════════════════
  if (d.scriptIntel) {
    const si = d.scriptIntel;
    push(h(2, '📜 Script Intelligence'));
    if (si.libraries?.length) {
      push(`### Detected Libraries (${si.libraries.length})\n`);
      si.libraries.forEach(l => push(`- ✅ ${l}`));
      push();
    }
    push(`- **Inline scripts:** ${si.inlineScriptCount} (${(si.totalInlineSize / 1024).toFixed(1)} KB)`);
    push(`- **External JS scanned:** ${si.externalFiles?.length || 0}`);
    push(`- **requestAnimationFrame calls:** ${si.requestAnimationFrame}`);
    push(`- **setInterval/setTimeout:** ${si.setIntervalCalls}/${si.setTimeoutCalls}`);
    push(`- **fetch calls:** ${si.fetchCalls}`);
    push();

    const renderCalls = (label, arr, max = 12) => {
      if (!arr?.length) return;
      push(h(3, `${label} (${arr.length})`));
      arr.slice(0, max).forEach((c, i) => {
        push(`**${i + 1}.** _${c.source}_`);
        push(code('js', c.snippet));
      });
    };
    renderCalls('GSAP Source-Mined', si.gsap);
    renderCalls('ScrollTrigger Source-Mined', si.scrollTrigger);
    renderCalls('Hover Listeners', si.hover, 8);
    renderCalls('Mousemove Listeners', si.mousemove, 8);
    renderCalls('Click Listeners', si.click, 8);
    renderCalls('Drag/Touch Listeners', si.drag);
    renderCalls('IntersectionObserver Calls', si.intersection);
    renderCalls('MutationObserver Calls', si.mutation, 5);
    renderCalls('classList Mutations', si.classListMutations, 12);
    renderCalls('anime.js Timelines', si.timelines, 8);

    if (si.externalFiles?.length) {
      push(h(3, 'External JS Files Scanned'));
      push('| URL | Status | Size |');
      push('|-----|--------|------|');
      si.externalFiles.slice(0, 25).forEach(f =>
        push(`| ${truncate(f.url, 70)} | ${f.status || 'failed'} | ${f.size ? (f.size / 1024).toFixed(1) + ' KB' : '—'} |`)
      );
      push();
    }
  }

  // ═══════════════════════════════════════════════════════
  // KEYFRAMES
  // ═══════════════════════════════════════════════════════
  if (d.css?.keyframes && Object.keys(d.css.keyframes).length) {
    push(h(2, `🎞️ CSS @keyframes (${Object.keys(d.css.keyframes).length})`));
    Object.entries(d.css.keyframes).slice(0, 40).forEach(([name, kf]) => {
      push(h(3, `\`${name}\``));
      push(code('css', kf));
    });
  }

  // ═══════════════════════════════════════════════════════
  // INTERACTIONS
  // ═══════════════════════════════════════════════════════
  if (d.interactions) {
    push(h(2, '✨ Interaction States'));
    const renderRules = (label, rules) => {
      if (!rules?.length) return;
      push(h(3, `${label} (${rules.length})`));
      rules.slice(0, 30).forEach(r => {
        push(`**\`${r.selector}\`**`);
        push(code('css', r.css));
      });
    };
    renderRules(':hover', d.interactions.hover);
    renderRules(':focus-visible', d.interactions.focusVisible);
    renderRules(':focus-within', d.interactions.focusWithin);
    renderRules(':focus', d.interactions.focus);
    renderRules(':active', d.interactions.active);
    renderRules(':visited', d.interactions.visited);
    renderRules(':target', d.interactions.target);

    if (d.interactions.customCursors?.length) {
      push(h(3, `🖱️ Custom Cursors (${d.interactions.customCursors.length})`));
      d.interactions.customCursors.forEach(c => {
        push(`- **\`${c.selector}\`** — ${c.size}, z:${c.zIndex}, blend:${c.mixBlendMode}`);
      });
      push();
    }
    if (d.interactions.magneticElements?.length) {
      push(h(3, `🧲 Magnetic Elements (${d.interactions.magneticElements.length})`));
      d.interactions.magneticElements.forEach(m => push(`- \`${m.selector}\` — ${m.hint}`));
      push();
    }
    if (d.interactions.parallaxElements?.length) {
      push(h(3, `🌌 Parallax Elements (${d.interactions.parallaxElements.length})`));
      d.interactions.parallaxElements.forEach(p =>
        push(`- \`${p.selector}\` — speed: \`${p.speed}\` lag: \`${p.lag}\``)
      );
      push();
    }
    if (d.interactions.tiltElements?.length) {
      push(h(3, `🎲 3D Tilt Elements (${d.interactions.tiltElements.length})`));
      d.interactions.tiltElements.forEach(t =>
        push(`- \`${t.selector}\` — max: ${t.maxTilt} perspective: ${t.perspective}`)
      );
      push();
    }
    if (d.interactions.draggableElements?.length) {
      push(h(3, `✋ Draggable Elements (${d.interactions.draggableElements.length})`));
      d.interactions.draggableElements.forEach(dr =>
        push(`- \`${dr.selector}\` ${dr.native ? '*(native draggable)*' : ''}`)
      );
      push();
    }
  }

  // ═══════════════════════════════════════════════════════
  // SVG / FILTERS
  // ═══════════════════════════════════════════════════════
  if (d.svg) {
    if (d.svg.filters?.length) {
      push(h(2, `🎭 SVG Filters (${d.svg.filters.length})`));
      d.svg.filters.forEach(f => {
        push(h(3, `Filter \`#${f.id}\``));
        push(`- Region: ${f.x},${f.y} ${f.width}×${f.height}`);
        push(`- Primitives:`);
        f.primitives.forEach(p =>
          push(`  - **<${p.type}>** ${truncate(JSON.stringify(p.attrs), 200)}`)
        );
      });
      push();
    }
    if (d.svg.masks?.length) {
      push(h(3, `🎭 Masks & Clip Paths (${d.svg.masks.length})`));
      d.svg.masks.forEach(m => push(`- **<${m.type}>** \`#${m.id}\` — ${m.childCount} children`));
      push();
    }
    if (d.svg.samples?.length) {
      push(h(3, `SVG Samples (first ${Math.min(d.svg.samples.length, 5)})`));
      d.svg.samples.slice(0, 5).forEach((s, i) => {
        push(`#### SVG ${i + 1}`);
        push(`- **viewBox:** \`${s.viewBox}\``);
        if (s.paths?.length) push(`- **Paths:** ${s.paths.length}`);
        if (s.gradients?.length) push(`- **Gradients:** ${s.gradients.length}`);
        if (s.animations?.length) {
          push(`- **SMIL Animations:**`);
          s.animations.forEach(a => push(`  - \`<${a.type}>\` ${a.attributeName} ${a.from}→${a.to} (${a.dur})`));
        }
      });
      push();
    }
  }

  // ═══════════════════════════════════════════════════════
  // TAILWIND
  // ═══════════════════════════════════════════════════════
  if (d.tailwind?.likely) {
    push(h(2, '🌀 Tailwind CSS Detected'));
    push(`- **Utility classes:** ${d.tailwind.utilityClassCount}/${d.tailwind.totalUniqueClasses}`);
    push(`- **Arbitrary values:** ${d.tailwind.arbitraryValueCount}`);
    push(`- **Breakpoints used:** ${d.tailwind.breakpointPrefixes.join(', ')}`);
    push(`- **State modifiers:** ${d.tailwind.stateModifiers.slice(0, 12).join(', ')}`);
    push(`- **Dark mode:** ${d.tailwind.darkModeUsed ? '✅ yes' : '❌ no'}`);
    push();
    if (d.tailwind.sampleClasses?.length) {
      push(h(3, 'Sample Utility Classes'));
      push(code('html', d.tailwind.sampleClasses.slice(0, 60).join(' ')));
    }
    if (d.tailwind.arbitrarySamples?.length) {
      push(h(3, 'Arbitrary Value Examples'));
      d.tailwind.arbitrarySamples.forEach(c => push(`- \`${c}\``));
      push();
    }
  }

  // ═══════════════════════════════════════════════════════
  // COMPONENT FINGERPRINTS
  // ═══════════════════════════════════════════════════════
  if (d.layout?.fingerprints?.length) {
    push(h(2, '🧬 Repeated Component Patterns'));
    push(`> Style signatures appearing 3+ times — likely reusable components\n`);
    push('| Count | Tag | Signature |');
    push('|-------|-----|-----------|');
    d.layout.fingerprints.forEach(f => {
      const tag = f.signature.split('|')[0];
      push(`| **${f.count}×** | \`${tag}\` | \`${truncate(f.signature, 140)}\` |`);
    });
    push();
  }

  // ═══════════════════════════════════════════════════════
  // SCROLL CONTAINERS / STICKY / SNAP
  // ═══════════════════════════════════════════════════════
  if (d.layout?.scrollContainers?.length || d.layout?.stickyEls?.length || d.layout?.snapContainers?.length) {
    push(h(2, '📜 Scroll Architecture'));
    if (d.layout.scrollContainers?.length) {
      push(h(3, `Scroll Containers (${d.layout.scrollContainers.length})`));
      d.layout.scrollContainers.forEach(s =>
        push(`- \`${s.selector}\` — overflow: ${s.overflow || s.overflowY}`)
      );
      push();
    }
    if (d.layout.stickyEls?.length) {
      push(h(3, `📌 Sticky Elements (${d.layout.stickyEls.length})`));
      d.layout.stickyEls.forEach(s =>
        push(`- \`${s.selector}\` — top: ${s.top}`)
      );
      push();
    }
    if (d.layout.snapContainers?.length) {
      push(h(3, `📍 Scroll-Snap Containers (${d.layout.snapContainers.length})`));
      d.layout.snapContainers.forEach(s =>
        push(`- \`${s.selector}\` — \`${s.type}\``)
      );
      push();
    }
  }

  // ═══════════════════════════════════════════════════════
  // ASSETS
  // ═══════════════════════════════════════════════════════
  if (d.assets) {
    push(h(2, '📦 Assets Inventory'));
    push(`- **Images:** ${d.assets.images?.length || 0}`);
    push(`- **Videos:** ${d.assets.videos?.length || 0}`);
    push(`- **Audio:** ${d.assets.audio?.length || 0}`);
    push(`- **Background images:** ${d.assets.backgroundImages?.length || 0}`);
    push(`- **Loaded fonts:** ${d.assets.fonts?.length || 0}`);
    push(`- **Stylesheets:** ${d.assets.stylesheets?.length || 0}`);
    push(`- **Scripts (external):** ${d.assets.scripts?.length || 0}`);
    push(`- **Preload/prefetch hints:** ${d.assets.preloads?.length || 0}`);
    push();

    if (d.assets.images?.length) {
      push(h(3, 'Images'));
      push('| Src | Alt | Natural | Display | Loading |');
      push('|-----|-----|---------|---------|---------|');
      d.assets.images.slice(0, 40).forEach(i =>
        push(`| ${truncate(i.src, 60)} | ${truncate(i.alt, 30) || '—'} | ${i.width}×${i.height} | ${i.displayWidth}×${i.displayHeight} | ${i.loading} |`)
      );
      push();
    }

    if (d.assets.videos?.length) {
      push(h(3, 'Videos'));
      d.assets.videos.forEach(v => {
        push(`- **${truncate(v.src, 80)}**`);
        push(`  - Dimensions: ${v.dimensions.w}×${v.dimensions.h} · Duration: ${v.duration?.toFixed(1)}s`);
        push(`  - autoplay: ${v.autoplay} · loop: ${v.loop} · muted: ${v.muted} · playsInline: ${v.playsInline}`);
        if (v.sources?.length) {
          v.sources.forEach(s => push(`  - source: \`${s.src}\` (${s.type})`));
        }
      });
      push();
    }

    if (d.assets.backgroundImages?.length) {
      push(h(3, 'Background Images'));
      d.assets.backgroundImages.slice(0, 30).forEach(bg => push(`- ${truncate(bg, 100)}`));
      push();
    }

    if (d.assets.preloads?.length) {
      push(h(3, 'Resource Hints'));
      push('| Rel | Href | As | Type |');
      push('|-----|------|----|----|');
      d.assets.preloads.slice(0, 30).forEach(p =>
        push(`| ${p.rel} | ${truncate(p.href, 60)} | ${p.as || '—'} | ${p.type || '—'} |`)
      );
      push();
    }
  }

  // ═══════════════════════════════════════════════════════
  // META & SEO
  // ═══════════════════════════════════════════════════════
  if (d.metaTags) {
    push(h(2, '🌍 Meta & SEO'));
    push(`- **Description:** ${d.metaTags.description || '—'}`);
    push(`- **Theme color:** \`${d.metaTags.themeColor || '—'}\``);
    push(`- **Color scheme:** \`${d.metaTags.colorScheme || '—'}\``);
    push(`- **Lang:** ${d.metaTags.lang || '—'} · **Dir:** ${d.metaTags.dir || 'ltr'}`);
    push(`- **Canonical:** ${d.metaTags.canonical || '—'}`);
    push(`- **Generator:** ${d.metaTags.generator || '—'}`);

    if (Object.keys(d.metaTags.og || {}).length) {
      push(h(3, 'Open Graph'));
      Object.entries(d.metaTags.og).forEach(([k, v]) => push(`- **${k}:** ${truncate(v, 120)}`));
    }
    if (Object.keys(d.metaTags.twitter || {}).length) {
      push(h(3, 'Twitter Card'));
      Object.entries(d.metaTags.twitter).forEach(([k, v]) => push(`- **${k}:** ${truncate(v, 120)}`));
    }
    push();
  }

  // ═══════════════════════════════════════════════════════
  // ACCESSIBILITY
  // ═══════════════════════════════════════════════════════
  if (d.a11y) {
    push(h(2, '♿ Accessibility'));
    push(`- **Landmarks:** ${d.a11y.landmarks?.length}`);
    push(`- **Forms:** ${d.a11y.formsCount} · Inputs: ${d.a11y.inputsTotal} (${d.a11y.inputsWithoutLabels} unlabeled)`);
    push(`- **Images:** ${d.a11y.imagesTotal} (${d.a11y.imagesWithoutAlt} missing alt)`);
    push(`- **Buttons w/o label:** ${d.a11y.buttonsWithoutLabel}`);
    push(`- **prefers-reduced-motion:** ${d.a11y.prefersReducedMotion ? '✅' : '❌'}`);
    push(`- **prefers-color-scheme:** ${d.a11y.prefersColorScheme}`);

    if (d.a11y.headingOutline?.length) {
      push(h(3, 'Heading Outline'));
      d.a11y.headingOutline.forEach(hd =>
        push(`${'  '.repeat(hd.level - 1)}- **H${hd.level}:** ${hd.text}`)
      );
      push();
    }

    if (d.a11y.landmarks?.length) {
      push(h(3, 'Landmarks'));
      d.a11y.landmarks.slice(0, 20).forEach(l =>
        push(`- \`<${l.tag}>\` role="${l.role}" ${l.label ? `→ "${l.label}"` : ''}`)
      );
      push();
    }
  }

  // ═══════════════════════════════════════════════════════
  // PERFORMANCE
  // ═══════════════════════════════════════════════════════
  if (d.performance) {
    const p = d.performance;
    push(h(2, '⚡ Performance Metrics'));
    push(`- **DOM Complete:** ${p.domComplete}ms`);
    push(`- **Load Event End:** ${p.loadEventEnd}ms`);
    push(`- **First Paint:** ${p.firstPaint}ms`);
    push(`- **First Contentful Paint:** ${p.firstContentfulPaint}ms`);
    if (p.largestContentfulPaint) {
      push(`- **Largest Contentful Paint:** ${p.largestContentfulPaint.time}ms (${p.largestContentfulPaint.element})`);
    }
    push(`- **Transfer size:** ${(p.transferSize / 1024).toFixed(1)} KB`);
    push(`- **Total resources:** ${p.resourceCount} (${(p.totalTransferSize / 1024).toFixed(1)} KB)`);
    if (p.resourcesByType) {
      push(`- **By type:** ${Object.entries(p.resourcesByType).map(([k, v]) => `${k}:${v}`).join(', ')}`);
    }
    if (p.memory) {
      push(`- **JS Heap:** ${p.memory.used}MB used / ${p.memory.total}MB total / ${p.memory.limit}MB limit`);
    }
    push();
  }

  // ═══════════════════════════════════════════════════════
  // IFRAMES
  // ═══════════════════════════════════════════════════════
  if (d.iframes?.length) {
    push(h(2, `🪟 iframes (${d.iframes.length})`));
    d.iframes.forEach((f, i) => {
      push(h(3, `iframe ${i + 1}`));
      push(`- **src:** ${f.src}`);
      push(`- **size:** ${f.width}×${f.height}`);
      if (f.sandbox) push(`- **sandbox:** \`${f.sandbox}\``);
      if (f.crossOrigin) push(`- **cross-origin:** locked`);
      else if (f.inner) {
        push(`- **inner title:** ${f.inner.title}`);
        push(`- **inner children:** ${f.inner.childCount}`);
      }
    });
  }

  // ═══════════════════════════════════════════════════════
  // SHADOW DOM HOSTS
  // ═══════════════════════════════════════════════════════
  if (d.shadowHosts?.length) {
    push(h(2, `🫥 Shadow DOM Hosts (${d.shadowHosts.length})`));
    d.shadowHosts.forEach(sh => {
      push(`### \`<${sh.tag}>\` ${sh.id ? `#${sh.id}` : ''}`);
      push(`- **Mode:** ${sh.shadow.mode}`);
      push(`- **Children:** ${sh.shadow.children?.length || 0}`);
      if (sh.shadow.slots?.length) {
        push(`- **Slots:** ${sh.shadow.slots.map(s => `${s.name}(${s.assigned})`).join(', ')}`);
      }
      if (sh.shadow.styles?.length) {
        push(`- **Inline styles:** ${sh.shadow.styles.length} block(s)`);
      }
    });
    push();
  }

  // ═══════════════════════════════════════════════════════
  // CUSTOM ELEMENTS
  // ═══════════════════════════════════════════════════════
  if (r.customElements?.length) {
    push(h(2, `🧩 Custom Elements (${r.customElements.length})`));
    push('| Tag | Defined | Count |');
    push('|-----|---------|-------|');
    r.customElements.forEach(c =>
      push(`| \`<${c.tag}>\` | ${c.defined ? '✅' : '❌'} | ${c.count} |`)
    );
    push();
  }

  // ═══════════════════════════════════════════════════════
  // LAYOUT TREE (deep)
  // ═══════════════════════════════════════════════════════
  if (d.layout?.tree?.length) {
    push(h(2, '🧩 Layout & Component Tree'));
    push();
    d.layout.tree.forEach(s => renderNode(s, 0, out, d));
  }

  // ═══════════════════════════════════════════════════════
  // ERRORS
  // ═══════════════════════════════════════════════════════
  if (r.errors?.length) {
    push(h(2, '⚠️ Extraction Errors'));
    r.errors.forEach(e => push(`- **${e.label}:** ${e.error}`));
    push();
  }

  push('---');
  push(`> Generated by **Design DNA v2.0** · ${new Date().toLocaleString()}`);

  return out.join('\n');
}

// ─────────────────────────────────────────────────────────
// Recursive node renderer (used by layout tree)
// ─────────────────────────────────────────────────────────
function renderNode(node, depth, out, ctx) {
  if (!node || depth > 12) return;
  const ind = '  '.repeat(depth);
  const push = (s) => out.push(s);
  const sel = node.id
    ? `#${node.id}`
    : (node.classes
      ? `.${node.classes.split(' ').slice(0, 2).join('.')}`
      : node.tag);

  push(`${ind}- **\`${sel}\`** *(${node.tag})*${node.shadow ? ' 🫥' : ''}`);

  const line = (txt) => push(`${ind}  - ${txt}`);
  const l = node.layout || {};
  const b = node.box || {};
  const bg = node.background || {};
  const v = node.visual || {};

  // Box / dimensions
  if (b.rect?.w && b.rect?.h) line(`📦 ${b.rect.w}×${b.rect.h}px @ (${b.rect.x},${b.rect.y})`);

  // Layout
  if (l.display) {
    let layout = `Display: \`${l.display}\``;
    if (l.gridTemplateColumns) layout += ` · cols: \`${l.gridTemplateColumns}\``;
    if (l.gridTemplateAreas) layout += ` · areas: \`${(l.gridTemplateAreas || '').slice(0, 60)}\``;
    if (l.flexDirection) layout += ` · flex: ${l.flexDirection}/${l.justifyContent}/${l.alignItems}`;
    if (l.gap && l.gap !== 'normal') layout += ` · gap: ${l.gap}`;
    line(layout);
  }
  if (l.position && l.position !== 'static') line(`Position: \`${l.position}\` z:${l.zIndex}`);
  if (l.containerType) line(`Container: \`${l.containerType}\` ${l.containerName ? `name:${l.containerName}` : ''}`);
  if (l.contentVisibility) line(`content-visibility: \`${l.contentVisibility}\``);
  if (l.transform) line(`Transform: \`${(l.transform || '').slice(0, 80)}\``);
  if (l.transformStyle) line(`transform-style: \`${l.transformStyle}\``);
  if (l.perspective) line(`perspective: \`${l.perspective}\``);
  if (l.willChange) line(`will-change: \`${l.willChange}\``);
  if (l.contain) line(`contain: \`${l.contain}\``);
  if (l.isolation) line(`isolation: \`${l.isolation}\``);

  // Background
  if (bg.color) line(`bg: \`${bg.color}\``);
  if (bg.gradient) line(`🌈 gradient: \`${bg.gradient.slice(0, 100)}\``);
  if (bg.image) line(`bg-image: ${bg.image.slice(0, 80)}`);
  if (bg.blendMode) line(`bg-blend: \`${bg.blendMode}\``);
  if (bg.clip) line(`bg-clip: \`${bg.clip}\``);

  // Border
  if (node.border?.radius && node.border.radius !== '0px') line(`radius: \`${node.border.radius}\``);

  // Visual
  if (v.boxShadow) line(`shadow: \`${v.boxShadow.slice(0, 100)}\``);
  if (v.filter) line(`filter: \`${v.filter}\``);
  if (v.backdropFilter) line(`backdrop-filter: \`${v.backdropFilter}\``);
  if (v.clipPath) line(`clip-path: \`${v.clipPath}\``);
  if (v.maskImage) line(`mask: \`${v.maskImage.slice(0, 80)}\``);
  if (v.mixBlendMode) line(`mix-blend: \`${v.mixBlendMode}\``);
  if (v.opacity) line(`opacity: ${v.opacity}`);
  if (v.cursor) line(`cursor: \`${v.cursor}\``);

  // Typography (only if non-default and has text)
  if (node.content?.text) {
    const t = node.typography || {};
    line(`Type: ${t.fontFamily} ${t.fontSize}/${t.lineHeight} ${t.fontWeight}, color \`${t.color}\``);
  }

  // Scroll
  if (node.scroll) {
    const s = node.scroll;
    const parts = [];
    if (s.sticky) parts.push(`📌 sticky top:${s.stickyTop}`);
    if (s.scrollSnapType) parts.push(`snap:\`${s.scrollSnapType}\``);
    if (s.overflow) parts.push(`overflow:${s.overflow}`);
    if (s.animationTimeline) parts.push(`anim-timeline:\`${s.animationTimeline}\``);
    if (s.viewTimelineName) parts.push(`view-timeline:\`${s.viewTimelineName}\``);
    if (parts.length) line(`Scroll: ${parts.join(' · ')}`);
  }

  // Animation
  if (node.animation) {
    const a = node.animation;
    line(`🎞️ Animation: \`${a.name}\` ${a.duration} ${a.timing} ${a.iteration === 'infinite' ? '∞' : `×${a.iteration}`}`);
    const kf = ctx.css?.keyframes?.[a.name];
    if (kf) {
      const kfLines = kf.split('\n').map(ln => `${'  '.repeat(depth + 2)}${ln}`).join('\n');
      push(`${'  '.repeat(depth + 1)}\`\`\`css\n${kfLines}\n${'  '.repeat(depth + 1)}\`\`\``);
    }
  }
  if (node.transition) {
    const t = node.transition;
    line(`⏱️ Transition: \`${t.property} ${t.duration} ${t.timing}\``);
  }

  // Pseudo-elements
  if (node.pseudo) {
    Object.entries(node.pseudo).forEach(([p, ps]) => {
      const summary = [];
      if (ps.content && ps.content !== 'none') summary.push(`content: ${ps.content}`);
      if (ps.background) summary.push(`bg: ${ps.background.slice(0, 40)}`);
      if (ps.transform) summary.push(`xform: ${ps.transform.slice(0, 40)}`);
      if (ps.animation) summary.push(`anim: ${ps.animation.slice(0, 40)}`);
      if (ps.transition) summary.push(`trans: ${ps.transition.slice(0, 40)}`);
      line(`${p} → ${summary.join(' · ')}`);
    });
  }

  // GSAP / animation hints
  if (node.hints?.revealClass) line(`✨ Reveal class: \`${node.hints.revealClass}\``);
  if (Object.keys(node.hints?.dataAttrs || {}).length) {
    line(`🏷️ data-* hints: \`${JSON.stringify(node.hints.dataAttrs)}\``);
  }
  if (node.hints?.role) line(`role: \`${node.hints.role}\``);
  if (node.hints?.ariaLabel) line(`aria-label: "${node.hints.ariaLabel}"`);

  // Media
  if (node.media) {
    const m = node.media;
    if (m.type === 'img') line(`🖼️ img: ${(m.src || '').slice(0, 80)} (${m.width}×${m.height}) ${m.loading}`);
    else if (m.type === 'video') line(`🎬 video: ${(m.src || '').slice(0, 80)} autoplay:${m.autoplay} loop:${m.loop}`);
    else if (m.type === 'audio') line(`🎵 audio: ${(m.src || '').slice(0, 80)}`);
    else if (m.type === 'svg-inline') line(`🎨 inline SVG viewBox:${m.viewBox}`);
    else if (m.type === 'canvas') line(`🖌️ canvas: ${m.width}×${m.height}`);
    else if (m.type === 'iframe') line(`🪟 iframe: ${m.src}`);
    else if (m.type === 'lottie') line(`🎞️ lottie: ${m.src} autoplay:${m.autoplay} loop:${m.loop}`);
    else if (m.type === 'spline') line(`🌐 spline: ${m.url}`);
    else if (m.type === 'picture') line(`🖼️ picture (${m.sources.length} sources)`);
  }

  // Text
  if (node.content?.text && !['div', 'section', 'article', 'main', 'header', 'footer', 'nav', 'ul', 'ol'].includes(node.tag)) {
    line(`📝 "${node.content.text.slice(0, 100)}"`);
  }
  if (node.content?.href) line(`→ \`${node.content.href}\``);
  if (node.content?.placeholder) line(`placeholder: "${node.content.placeholder}"`);

  // Shadow DOM
  if (node.shadowDOM) {
    line(`🫥 **Shadow DOM** (${node.shadowDOM.mode})`);
    node.shadowDOM.children?.forEach(c => renderNode(c, depth + 2, out, ctx));
    if (node.shadowDOM.styles?.length) {
      node.shadowDOM.styles.slice(0, 2).forEach(s => {
        const styleLines = s.slice(0, 600).split('\n').map(ln => `${'  '.repeat(depth + 2)}${ln}`).join('\n');
        out.push(`${'  '.repeat(depth + 1)}\`\`\`css\n${styleLines}\n${'  '.repeat(depth + 1)}\`\`\``);
      });
    }
  }

  // Recurse children
  node.children?.forEach(c => renderNode(c, depth + 1, out, ctx));
}

// ═════════════════════════════════════════════════════════════════════════════
// DESIGN SPEC GENERATOR
// ═════════════════════════════════════════════════════════════════════════════
// Generates a high-fidelity, AI-friendly design specification for recreation
export function generateDesignSpec(d) {
  const out = [];
  const push = (s = '') => out.push(s);
  const code = (lang, content) => `\`\`\`${lang}\n${content}\n\`\`\``;
  const h = (level, text) => `${'#'.repeat(level)} ${text}\n`;
  const truncate = (s, n = 200) => (s && s.length > n ? s.slice(0, n) + '…' : s || '');

  // ─── HEADER ───
  push(h(1, `📐 Design Specification — ${d.meta?.title || 'Untitled'}`));
  push(`**URL:** ${d.meta?.url}`);
  push(`**Viewport:** ${d.meta?.viewport?.width}×${d.meta?.viewport?.height} @ ${d.meta?.viewport?.dpr || 1}× DPR`);
  push(`**Page Height:** ${d.meta?.viewport?.scrollHeight}px`);
  push(`**Captured:** ${d.meta?.timestamp || new Date().toISOString()}`);
  push();

  // ═══════════════════════════════════════════════════════
  // DESIGN SYSTEM
  // ═══════════════════════════════════════════════════════
  push(h(2, '🎨 Design System'));
  push();

  // ─── Color Palette (semantic naming) ───
  if (d.layout?.palette?.length) {
    push(h(3, 'Color Palette'));
    const top = d.layout.palette.slice(0, 30);
    const colorLines = top.map((p, i) => {
      const name = semanticColorName(p.color, i);
      return `  --${name}: ${p.color}; /* ${p.count}× */`;
    });
    push(code('css', `:root {\n${colorLines.join('\n')}\n}`));
    push();
  }

  // ─── CSS Custom Properties (design tokens) ───
  if (d.css?.variables && Object.keys(d.css.variables).length) {
    push(h(3, 'Design Tokens (CSS Custom Properties)'));
    const entries = Object.entries(d.css.variables);
    // Group by prefix for readability
    const grouped = groupTokensByPrefix(entries.slice(0, 60));
    const tokenLines = [];
    for (const [group, items] of Object.entries(grouped)) {
      if (items.length > 1) tokenLines.push(`  /* ${group} */`);
      items.forEach(([k, v]) => tokenLines.push(`  ${k}: ${v};`));
    }
    push(code('css', `:root {\n${tokenLines.join('\n')}\n}`));
    push();
  }

  // ─── Typography ───
  if (d.typography) {
    push(h(3, 'Typography'));
    const b = d.typography.base;
    push(`**Base:** \`${b.family}\` · ${b.size} / ${b.lineHeight} · weight ${b.weight} · color \`${b.color}\``);
    push();

    // Font stack
    if (d.typography.googleFonts?.length) {
      push(`**Google Fonts:** ${d.typography.googleFonts.map(u => `\`${u.split('family=')[1]?.split('&')[0] || u}\``).join(', ')}`);
      push();
    }

    if (d.typography.scale?.length) {
      const tags = ['h1','h2','h3','h4','h5','h6','p','a','button','small','span','li','blockquote','label'];
      const rules = d.typography.scale
        .filter(t => tags.includes(t.tag))
        .slice(0, 18);
      if (rules.length) {
        const cssRules = rules.map(t => {
          const props = [`  font-family: ${t.fontFamily}`, `  font-size: ${t.fontSize}`, `  font-weight: ${t.fontWeight}`, `  line-height: ${t.lineHeight}`, `  color: ${t.color}`];
          if (t.letterSpacing && t.letterSpacing !== 'normal') props.push(`  letter-spacing: ${t.letterSpacing}`);
          if (t.textTransform && t.textTransform !== 'none') props.push(`  text-transform: ${t.textTransform}`);
          if (t.fontVariationSettings) props.push(`  font-variation-settings: ${t.fontVariationSettings}`);
          const sample = t.sample ? ` /* "${t.sample.slice(0, 40)}" */` : '';
          return `${t.tag} {${sample}\n${props.join(';\n')};\n}`;
        });
        push(code('css', cssRules.join('\n\n')));
        push();
      }
    }
  }

  // ─── Spacing (real padding/margin/gap values) ───
  const spacings = extractRealSpacings(d);
  if (spacings.length) {
    push(h(3, 'Spacing Scale'));
    push(code('css', `:root {\n${spacings.map((s, i) => `  --space-${i + 1}: ${s};`).join('\n')}\n}`));
    push();
  }

  // ═══════════════════════════════════════════════════════
  // RESPONSIVE BREAKPOINTS
  // ═══════════════════════════════════════════════════════
  if (d.css?.mediaQueries?.length) {
    push(h(2, '📱 Responsive Breakpoints'));
    push();
    const unique = [...new Map(d.css.mediaQueries.map(m => [m.condition, m])).values()].slice(0, 12);
    unique.forEach(m => {
      push(`- \`${m.condition}\` — ${m.ruleCount} rule${m.ruleCount !== 1 ? 's' : ''}`);
    });
    push();
  }

  // ═══════════════════════════════════════════════════════
  // COMPONENT SPECIFICATIONS
  // ═══════════════════════════════════════════════════════
  if (d.layout?.tree?.length) {
    push(h(2, '🧩 Component Specifications'));
    push();

    const majorComponents = [];
    const collectComponents = (nodes, depth) => {
      if (depth > 5 || majorComponents.length >= 30) return;
      for (const node of nodes) {
        if (majorComponents.length >= 30) break;
        const isComponent =
          ['header','nav','section','main','footer','article','aside','form','dialog'].includes(node.tag) ||
          (node.classes && /hero|container|section|wrapper|banner|card|modal|sidebar|toolbar|menu|grid|slider|carousel|overlay|drawer|panel|block|row|col|navbar|topbar|masthead/i.test(node.classes)) ||
          (node.id && node.id.length > 1) ||
          (node.hints?.role && /navigation|banner|main|contentinfo|complementary|form|dialog|search/i.test(node.hints.role));
        if (isComponent) majorComponents.push(node);
        if (node.children) collectComponents(node.children, depth + 1);
      }
    };
    collectComponents(d.layout.tree, 0);

    majorComponents.forEach((comp, idx) => {
      const name = getComponentName(comp);
      push(h(3, `${idx + 1}. ${name}`));

      // Dimensions & position
      const b = comp.box?.rect;
      if (b) {
        push(`**Dimensions:** ${b.w}×${b.h}px at (${b.x}, ${b.y})`);
      }
      if (comp.box?.padding && comp.box.padding !== '0px') push(`**Padding:** \`${comp.box.padding}\``);

      // Layout CSS
      const l = comp.layout || {};
      if (l.display) {
        const layoutProps = [`display: ${l.display}`];
        if (l.flexDirection) layoutProps.push(`flex-direction: ${l.flexDirection}`);
        if (l.flexWrap && l.flexWrap !== 'nowrap') layoutProps.push(`flex-wrap: ${l.flexWrap}`);
        if (l.justifyContent && l.justifyContent !== 'normal') layoutProps.push(`justify-content: ${l.justifyContent}`);
        if (l.alignItems && l.alignItems !== 'normal') layoutProps.push(`align-items: ${l.alignItems}`);
        if (l.gridTemplateColumns) layoutProps.push(`grid-template-columns: ${l.gridTemplateColumns}`);
        if (l.gridTemplateRows && l.gridTemplateRows !== 'none') layoutProps.push(`grid-template-rows: ${l.gridTemplateRows}`);
        if (l.gap && l.gap !== 'normal' && l.gap !== '0px') layoutProps.push(`gap: ${l.gap}`);
        if (l.position && l.position !== 'static') layoutProps.push(`position: ${l.position}`);
        if (l.zIndex && l.zIndex !== 'auto') layoutProps.push(`z-index: ${l.zIndex}`);
        if (l.transform) layoutProps.push(`transform: ${l.transform}`);
        if (l.willChange) layoutProps.push(`will-change: ${l.willChange}`);
        push(code('css', `.${cssClassName(name)} {\n  ${layoutProps.join(';\n  ')};\n}`));
      }

      // Visual CSS
      const bg = comp.background || {};
      const v = comp.visual || {};
      const styles = [];
      if (bg.color && bg.color !== 'rgba(0, 0, 0, 0)' && bg.color !== 'transparent') styles.push(`background-color: ${bg.color}`);
      if (bg.gradient) styles.push(`background: ${bg.gradient}`);
      if (bg.image) styles.push(`background-image: url(${bg.image.slice(0, 80)})`);
      if (comp.border?.radius && comp.border.radius !== '0px') styles.push(`border-radius: ${comp.border.radius}`);
      if (comp.border?.width && comp.border.width !== '0px') styles.push(`border: ${comp.border.width} ${comp.border.style} ${comp.border.color}`);
      if (v.boxShadow) styles.push(`box-shadow: ${v.boxShadow}`);
      if (v.backdropFilter) styles.push(`backdrop-filter: ${v.backdropFilter}`);
      if (v.filter) styles.push(`filter: ${v.filter}`);
      if (v.opacity && v.opacity !== '1') styles.push(`opacity: ${v.opacity}`);
      if (v.clipPath) styles.push(`clip-path: ${v.clipPath}`);
      if (v.mixBlendMode) styles.push(`mix-blend-mode: ${v.mixBlendMode}`);
      if (v.cursor) styles.push(`cursor: ${v.cursor}`);

      if (styles.length) {
        push(code('css', `.${cssClassName(name)} {\n  ${styles.join(';\n  ')};\n}`));
      }

      // Transition
      if (comp.transition) {
        push(`> ⏱️ Transition: \`${comp.transition.property} ${comp.transition.duration} ${comp.transition.timing}\``);
      }
      // Animation
      if (comp.animation) {
        push(`> 🎞️ Animation: \`${comp.animation.name}\` ${comp.animation.duration} ${comp.animation.timing} ${comp.animation.iteration === 'infinite' ? '∞' : `×${comp.animation.iteration}`}`);
      }

      push();
    });
  }

  // ═══════════════════════════════════════════════════════
  // INTERACTIONS & ANIMATIONS
  // ═══════════════════════════════════════════════════════
  push(h(2, '✨ Interactions & Animations'));
  push();

  // ─── Hover Effects ───
  if (d.interactions?.hover?.length) {
    push(h(3, 'Hover Effects'));
    push();
    d.interactions.hover.slice(0, 15).forEach((rule, idx) => {
      push(`**${idx + 1}. \`${rule.selector}\`**`);
      push(code('css', rule.css));
    });
    push();
  }

  // ─── Focus / Active ───
  const otherStates = [
    ['Focus', d.interactions?.focus],
    ['Focus-Visible', d.interactions?.focusVisible],
    ['Active', d.interactions?.active],
  ].filter(([, rules]) => rules?.length);

  if (otherStates.length) {
    push(h(3, 'Focus & Active States'));
    push();
    let counter = 1;
    otherStates.forEach(([label, rules]) => {
      rules.slice(0, 5).forEach(rule => {
        push(`**${counter++}. ${label} on \`${rule.selector}\`**`);
        push(code('css', rule.css));
      });
    });
    push();
  }

  // ─── CSS Keyframe Animations ───
  if (d.css?.keyframes && Object.keys(d.css.keyframes).length) {
    push(h(3, 'CSS Keyframe Animations'));
    push();
    Object.entries(d.css.keyframes).slice(0, 12).forEach(([name, kf]) => {
      push(`**\`@keyframes ${name}\`**`);
      push(code('css', `@keyframes ${name} { \n${kf.slice(0, 500)}\n}`));
      push();
    });
  }

  // ─── CSS Transitions on elements ───
  if (d.interactions?.transitions?.length || d.interactions?.customCursors?.length) {
    if (d.interactions.customCursors?.length) {
      push(h(3, 'Custom Cursors'));
      d.interactions.customCursors.forEach((c, i) => {
        push(`**${i + 1}. \`${c.selector}\`** — ${c.size}, z:${c.zIndex}, blend:${c.mixBlendMode}`);
      });
      push();
    }
  }

  // ─── GSAP Animations ───
  const r = d.runtime || {};
  if (r.gsap?.tweens?.length || r.gsap?.timelines?.length) {
    push(h(3, 'GSAP Animations'));
    push();
    if (r.gsap.version) push(`> **GSAP** v${r.gsap.version}`);
    if (r.gsap.registeredPlugins?.length) push(`> **Plugins:** ${r.gsap.registeredPlugins.join(', ')}`);
    push();

    // Tweens with narrative descriptions
    r.gsap.tweens.slice(0, 12).forEach((t, idx) => {
      const targetStr = t.targets?.length ? t.targets.join(', ') : 'element';
      const cssEntries = Object.entries(t.cssProps || {});
      // Build narrative
      const narrative = buildTweenNarrative(t, targetStr, cssEntries);
      push(`**${idx + 1}. Tween → \`${targetStr}\`**`);
      if (narrative) push(`> ${narrative}`);
      push();
      const allProps = [];
      cssEntries.forEach(([k, v]) => allProps.push(`  ${k}: ${JSON.stringify(v)}`));
      allProps.push(`  duration: ${t.duration}`);
      if (t.delay) allProps.push(`  delay: ${t.delay}`);
      allProps.push(`  ease: "${t.ease}"`);
      if (t.repeat) allProps.push(`  repeat: ${t.repeat}`);
      if (t.yoyo) allProps.push(`  yoyo: true`);
      if (t.stagger) allProps.push(`  stagger: ${JSON.stringify(t.stagger)}`);
      push(code('javascript', `gsap.to("${targetStr}", {\n${allProps.join(',\n')}\n});`));
      push();
    });

    // Timelines
    if (r.gsap.timelines?.length) {
      push(`**Timelines:** ${r.gsap.timelines.length} detected`);
      r.gsap.timelines.slice(0, 4).forEach((tl, i) => {
        const labels = Object.keys(tl.labels || {});
        push(`- Timeline ${i + 1}: duration ${tl.duration}s${labels.length ? ` · labels: ${labels.join(', ')}` : ''}`);
      });
      push();
    }
  }

  // ─── ScrollTrigger ───
  if (r.scrollTriggers?.length) {
    push(h(3, 'ScrollTrigger Instances'));
    push();
    r.scrollTriggers.slice(0, 10).forEach((s, idx) => {
      const narrative = buildScrollTriggerNarrative(s);
      push(`**${idx + 1}. \`${s.trigger}\`**`);
      if (narrative) push(`> ${narrative}`);
      push();
      const props = [`trigger: "${s.trigger}"`, `start: "${s.start}"`, `end: "${s.end}"`];
      if (s.scrub !== false) props.push(`scrub: ${s.scrub}`);
      if (s.pin) props.push(`pin: true`);
      if (s.pinSpacing !== undefined) props.push(`pinSpacing: ${s.pinSpacing}`);
      if (s.toggleClass) props.push(`toggleClass: "${s.toggleClass}"`);
      if (s.toggleActions) props.push(`toggleActions: "${s.toggleActions}"`);
      if (s.snap) props.push(`snap: ${typeof s.snap === 'object' ? JSON.stringify(s.snap) : s.snap}`);
      if (s.horizontal) props.push(`horizontal: true`);
      if (s.anticipatePin) props.push(`anticipatePin: ${s.anticipatePin}`);
      push(code('javascript', `ScrollTrigger.create({\n  ${props.join(',\n  ')}\n});`));
      push();
    });
  }

  // ─── ScrollSmoother ───
  if (r.scrollSmoother) {
    push(h(3, 'ScrollSmoother'));
    push(`> Smooth scrolling with inertia: smooth=${r.scrollSmoother.smooth}, effects=${r.scrollSmoother.effects}, smoothTouch=${r.scrollSmoother.smoothTouch}`);
    push();
  }

  // ─── Custom Cursors ───
  if (d.interactions?.customCursors?.length) {
    push(h(3, 'Custom Cursors'));
    d.interactions.customCursors.forEach((c, i) => {
      push(`**${i + 1}. \`${c.selector}\`** — ${c.size}, z:${c.zIndex}, blend:\`${c.mixBlendMode}\`, pointer-events:\`${c.pointerEvents}\``);
    });
    push();
  }

  // ─── Parallax / Magnetic / Tilt ───
  const hasAdvancedInteractions = d.interactions?.parallaxElements?.length || d.interactions?.magneticElements?.length || d.interactions?.tiltElements?.length;
  if (hasAdvancedInteractions) {
    push(h(3, 'Advanced Interactions'));
    if (d.interactions.parallaxElements?.length) {
      push(`**Parallax elements:** ${d.interactions.parallaxElements.length}`);
      d.interactions.parallaxElements.slice(0, 8).forEach(p => {
        push(`- \`${p.selector}\` speed:${p.speed || '?'}${p.lag ? ` lag:${p.lag}` : ''}`);
      });
    }
    if (d.interactions.magneticElements?.length) {
      push(`**Magnetic elements:** ${d.interactions.magneticElements.length}`);
      d.interactions.magneticElements.slice(0, 6).forEach(m => push(`- \`${m.selector}\``));
    }
    if (d.interactions.tiltElements?.length) {
      push(`**Tilt elements:** ${d.interactions.tiltElements.length}`);
      d.interactions.tiltElements.slice(0, 6).forEach(t => {
        push(`- \`${t.selector}\` max:${t.maxTilt || '?'}°${t.perspective ? ` perspective:${t.perspective}` : ''}`);
      });
    }
    push();
  }

  // ─── Other animation libraries ───
  if (r.framer?.length || r.anime?.length || r.motionOne?.length || r.rive?.length || r.lottie?.length) {
    push(h(3, 'Other Animation Libraries'));
    if (r.framer?.length) push(`- **Framer Motion** — ${r.framer.length} component(s)`);
    if (r.anime?.length) push(`- **anime.js** — v${r.anime[0]?.version || '?'}`);
    if (r.motionOne?.length) push(`- **Motion One** detected`);
    if (r.rive?.length) push(`- **Rive** — ${r.rive.length} instance(s)`);
    if (r.lottie?.length) push(`- **Lottie** — ${r.lottie.length} animation(s)`);
    push();
  }

  // ═══════════════════════════════════════════════════════
  // LAYOUT STRUCTURE
  // ═══════════════════════════════════════════════════════
  push(h(2, '📊 Layout Structure'));
  push();
  push(h(3, 'DOM Hierarchy'));
  if (d.layout?.tree?.length) {
    // Render all top-level sections, not just the first
    const allLines = [];
    d.layout.tree.forEach(node => {
      allLines.push(...renderHTMLStructure(node, 0));
    });
    push(code('html', allLines.join('\n')));
    push();
  }

  // Z-index layers
  if (d.layout?.zLayers?.length) {
    push(h(3, 'Z-Index Stack'));
    d.layout.zLayers.slice(0, 15).forEach(z => {
      push(`- z:\`${z.zIndex}\` \`${z.selector}\` (${z.position})`);
    });
    push();
  }

  // ═══════════════════════════════════════════════════════
  // ASSETS
  // ═══════════════════════════════════════════════════════
  if (d.assets) {
    push(h(2, '📦 Assets'));
    push();

    if (d.assets.images?.length) {
      push(h(3, `Images (${d.assets.images.length})`));
      d.assets.images.slice(0, 20).forEach(img => {
        const name = (img.src || '').split('/').pop().split('?')[0] || 'unknown';
        push(`- \`${truncate(name, 70)}\` ${img.width}×${img.height} → display ${img.displayWidth || '?'}×${img.displayHeight || '?'} · ${img.loading}`);
      });
      push();
    }

    if (d.assets.videos?.length) {
      push(h(3, `Videos (${d.assets.videos.length})`));
      d.assets.videos.slice(0, 8).forEach(v => {
        const name = (v.src || '').split('/').pop().split('?')[0] || 'unknown';
        push(`- \`${truncate(name, 70)}\` ${v.dimensions?.w}×${v.dimensions?.h} · autoplay:${v.autoplay} loop:${v.loop} muted:${v.muted}`);
      });
      push();
    }

    // ─── FIXED: Fonts are objects, not strings ───
    if (d.assets.fonts?.length) {
      push(h(3, `Fonts (${d.assets.fonts.length})`));
      const seen = new Set();
      d.assets.fonts.forEach(f => {
        if (typeof f === 'object' && f !== null) {
          const key = `${f.family}-${f.weight}-${f.style}`;
          if (seen.has(key)) return;
          seen.add(key);
          push(`- \`${f.family}\` weight:${f.weight} style:${f.style} status:${f.status || '?'}`);
        } else {
          push(`- ${String(f)}`);
        }
      });
      push();
    }

    if (d.assets.backgroundImages?.length) {
      push(h(3, `Background Images (${d.assets.backgroundImages.length})`));
      d.assets.backgroundImages.slice(0, 10).forEach(url => {
        const name = url.split('/').pop().split('?')[0] || 'unknown';
        push(`- \`${truncate(name, 70)}\``);
      });
      push();
    }
  }

  // ═══════════════════════════════════════════════════════
  // TECHNOLOGIES DETECTED
  // ═══════════════════════════════════════════════════════
  if (d.scriptIntel?.libraries?.length) {
    push(h(2, '🛠️ Technologies Detected'));
    push();
    d.scriptIntel.libraries.forEach(l => push(`- ${l}`));
    push();
  }

  push('---');
  push(`> Design Spec generated for AI recreation · ${d.meta?.timestamp || new Date().toISOString()}`);

  return out.join('\n');
}

// Helper: Semantic color naming from raw color values
function semanticColorName(color, index) {
  const c = color.toLowerCase().trim();
  // Pure black/white
  if (/^(rgb\(0,\s*0,\s*0\)|#000|black)/.test(c)) return 'color-ink';
  if (/^(rgb\(255,\s*255,\s*255\)|#fff|white)/.test(c)) return 'color-canvas';
  // Near-black
  if (/^rgb\((\d+),\s*\1,\s*\1\)/.test(c)) {
    const m = c.match(/\d+/);
    const v = m ? parseInt(m[0]) : 128;
    if (v < 40) return `color-ink-${index}`;
    if (v < 100) return `color-muted-${index}`;
    if (v > 220) return `color-surface-${index}`;
    if (v > 180) return `color-border-${index}`;
    return `color-gray-${index}`;
  }
  if (/rgba/.test(c)) return `color-alpha-${index}`;
  return `color-${index}`;
}

// Helper: Group tokens by prefix for organized output
function groupTokensByPrefix(entries) {
  const groups = {};
  entries.forEach(([k, v]) => {
    const parts = k.replace('--', '').split('-');
    const prefix = parts.slice(0, Math.min(2, parts.length - 1)).join('-') || 'misc';
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push([k, v]);
  });
  return groups;
}

// Helper: Extract real spacing values from padding/margin/gap
function extractRealSpacings(d) {
  const spacings = new Set();
  const addPx = (val) => {
    if (!val || val === '0px' || val === 'auto' || val === 'normal') return;
    // Split compound values like "16px 24px"
    val.split(/\s+/).forEach(v => {
      if (/^\d+(\.\d+)?px$/.test(v)) {
        const n = parseFloat(v);
        if (n > 0 && n < 500) spacings.add(v);
      } else if (/^\d+(\.\d+)?(rem|em|%)$/.test(v)) {
        spacings.add(v);
      }
    });
  };

  if (d.layout?.tree) {
    const traverse = (node) => {
      if (node.box) {
        addPx(node.box.padding);
        addPx(node.box.margin);
      }
      const l = node.layout || {};
      if (l.gap && l.gap !== 'normal') addPx(l.gap);
      if (l.columnGap) addPx(l.columnGap);
      if (l.rowGap) addPx(l.rowGap);
      node.children?.forEach(traverse);
    };
    d.layout.tree.forEach(traverse);
  }

  // Sort numerically by pixel value
  return [...spacings]
    .sort((a, b) => parseFloat(a) - parseFloat(b))
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 20);
}

// Helper: Get friendly component name
function getComponentName(node) {
  if (node.id) return node.id;
  if (node.classes) {
    const cls = node.classes.split(' ').find(c => c && !c.startsWith('_') && c.length > 1);
    if (cls) return cls;
  }
  return node.tag;
}

// Helper: CSS-safe class name
function cssClassName(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/^-+|-+$/g, '') || 'component';
}

// Helper: Build narrative description for a GSAP tween
function buildTweenNarrative(t, targetStr, cssEntries) {
  const parts = [];
  const props = Object.keys(t.cssProps || {});

  // Describe motion
  if (props.includes('opacity') || props.includes('autoAlpha')) {
    const val = t.cssProps.opacity ?? t.cssProps.autoAlpha;
    parts.push(val == 0 ? 'fades out' : val == 1 ? 'fades in' : `fades to ${val} opacity`);
  }
  if (props.includes('y') || props.includes('yPercent')) {
    const val = t.cssProps.y ?? t.cssProps.yPercent ?? 0;
    parts.push(`translates vertically to ${val}`);
  }
  if (props.includes('x') || props.includes('xPercent')) {
    const val = t.cssProps.x ?? t.cssProps.xPercent ?? 0;
    parts.push(`translates horizontally to ${val}`);
  }
  if (props.includes('scale') || props.includes('scaleX') || props.includes('scaleY')) {
    parts.push(`scales to ${t.cssProps.scale || t.cssProps.scaleX || t.cssProps.scaleY}`);
  }
  if (props.includes('rotation') || props.includes('rotationZ')) {
    parts.push(`rotates ${t.cssProps.rotation || t.cssProps.rotationZ}°`);
  }
  if (props.includes('clipPath')) parts.push('reveals via clip-path');
  if (props.includes('width') || props.includes('height')) parts.push('resizes');

  if (!parts.length) return '';

  let desc = `Animates \`${targetStr}\`: ${parts.join(', ')}`;
  desc += ` over ${t.duration}s`;
  if (t.ease) desc += ` with \`${t.ease}\` easing`;
  if (t.stagger) desc += `, staggered`;
  if (t.repeat === -1) desc += ', looping infinitely';
  else if (t.repeat) desc += `, repeating ${t.repeat}×`;
  if (t.yoyo) desc += ' (yoyo)';
  return desc + '.';
}

// Helper: Build narrative description for ScrollTrigger
function buildScrollTriggerNarrative(s) {
  const parts = [];
  if (s.pin) parts.push('pins the element in viewport');
  if (s.scrub === true) parts.push('scrub-linked to scroll position');
  else if (typeof s.scrub === 'number') parts.push(`scrubs with ${s.scrub}s smooth catch-up`);
  if (s.snap) parts.push('snaps to progress points');
  if (s.toggleClass) parts.push(`toggles class \`${s.toggleClass}\``);
  if (s.toggleActions) parts.push(`actions: ${s.toggleActions}`);
  if (s.horizontal) parts.push('horizontal scroll');

  if (!parts.length) return '';
  return `Triggered by \`${s.trigger}\` (${s.start} → ${s.end}): ${parts.join(', ')}.`;
}

// Helper: Render HTML structure for documentation
function renderHTMLStructure(node, depth) {
  const lines = [];
  const indent = '  '.repeat(depth);
  const id = node.id ? `#${node.id}` : '';
  const cls = node.classes ? `.${node.classes.split(' ').filter(c => c && !c.startsWith('_'))[0] || ''}` : '';
  const sel = id || cls;
  const tag = `<${node.tag}${sel ? ` ${sel}` : ''}>`;
  
  if (depth > 5) return lines;
  
  // Skip trivially empty containers with no meaningful attributes
  const hasContent = node.children?.length || node.content?.text || node.media || node.id || node.classes;
  if (!hasContent && depth > 2) return lines;

  if (node.children?.length) {
    lines.push(`${indent}${tag}`);
    // Show more children at shallow depths
    const maxChildren = depth < 2 ? 12 : depth < 4 ? 8 : 5;
    const children = node.children.slice(0, maxChildren);
    children.forEach(child => {
      lines.push(...renderHTMLStructure(child, depth + 1));
    });
    if (node.children.length > maxChildren) {
      lines.push(`${indent}  <!-- +${node.children.length - maxChildren} more -->`);
    }
    lines.push(`${indent}</${node.tag}>`);
  } else if (node.content?.text) {
    lines.push(`${indent}${tag}${node.content.text.slice(0, 60)}</${node.tag}>`);
  } else {
    lines.push(`${indent}${tag}</${node.tag}>`);
  }
  
  return lines;
}