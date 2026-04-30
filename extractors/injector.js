// extractors/injector.js
// Runs in PAGE context. Sets up runtime hooks BEFORE other scripts run.
(() => {
  if (window.__DDNA_INJECTED) return;
  window.__DDNA_INJECTED = true;

  const store = window.__DDNA = {
    gsap: null,
    scrollTriggers: [],
    lottie: [],
    three: [],
    framer: [],
    anime: [],
    motionOne: [],
    rive: [],
    splines: [],
    intersectionObservers: [],
    mutationObservers: [],
    resizeObservers: [],
    classToggles: [],
    eventListeners: [],
    rafCount: 0,
    scrollDriven: [],
    customElements: [],
    paintWorklets: [],
    errors: [],
  };

  const safe = (label, fn) => { try { return fn(); } catch (e) { store.errors.push({ label, error: e.message }); } };

  // ─── Patch IntersectionObserver ───
  safe('IntersectionObserver', () => {
    const Orig = window.IntersectionObserver;
    if (!Orig || Orig.__ddnaPatched) return;
    const Patched = function (cb, opts) {
      const inst = new Orig(cb, opts);
      store.intersectionObservers.push({
        options: opts || {},
        callback: String(cb).slice(0, 250),
        targets: [],
        _inst: inst,
      });
      const origObserve = inst.observe.bind(inst);
      inst.observe = (el) => {
        const last = store.intersectionObservers[store.intersectionObservers.length - 1];
        if (last && el?.tagName) {
          last.targets.push(
            (el.id ? `#${el.id}` : '') ||
            (el.classList?.length ? `.${[...el.classList][0]}` : '') ||
            el.tagName.toLowerCase()
          );
        }
        return origObserve(el);
      };
      return inst;
    };
    Patched.prototype = Orig.prototype;
    Patched.__ddnaPatched = true;
    window.IntersectionObserver = Patched;
  });
  
    // ─── Capture LCP via PerformanceObserver ───
  safe('LCP observer', () => {
    if (!window.PerformanceObserver) return;
    if (window.__DDNA_lcpObserver) return;
    try {
      const obs = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) {
          window.__DDNA_lcp = {
            startTime: last.startTime,
            size: last.size,
            element: last.element?.tagName || '',
            url: last.url || '',
          };
        }
      });
      obs.observe({ type: 'largest-contentful-paint', buffered: true });
      window.__DDNA_lcpObserver = obs;
    } catch {}
  });

  // ─── Capture CLS via PerformanceObserver ───
  safe('CLS observer', () => {
    if (!window.PerformanceObserver) return;
    if (window.__DDNA_clsObserver) return;
    try {
      window.__DDNA_cls = 0;
      const obs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            window.__DDNA_cls += entry.value;
          }
        }
      });
      obs.observe({ type: 'layout-shift', buffered: true });
      window.__DDNA_clsObserver = obs;
    } catch {}
  });

  // ─── Capture long tasks ───
  safe('Long task observer', () => {
    if (!window.PerformanceObserver) return;
    if (window.__DDNA_longTaskObserver) return;
    try {
      window.__DDNA_longTasks = [];
      const obs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (window.__DDNA_longTasks.length < 50) {
            window.__DDNA_longTasks.push({
              duration: entry.duration | 0,
              startTime: entry.startTime | 0,
              name: entry.name,
            });
          }
        }
      });
      obs.observe({ type: 'longtask', buffered: true });
      window.__DDNA_longTaskObserver = obs;
    } catch {}
  });

  // ─── Patch MutationObserver ───
  safe('MutationObserver', () => {
    const Orig = window.MutationObserver;
    if (!Orig || Orig.__ddnaPatched) return;
    const Patched = function (cb) {
      store.mutationObservers.push({ callback: String(cb).slice(0, 250) });
      return new Orig(cb);
    };
    Patched.prototype = Orig.prototype;
    Patched.__ddnaPatched = true;
    window.MutationObserver = Patched;
  });

  // ─── Patch ResizeObserver ───
  safe('ResizeObserver', () => {
    const Orig = window.ResizeObserver;
    if (!Orig || Orig.__ddnaPatched) return;
    const Patched = function (cb) {
      store.resizeObservers.push({ callback: String(cb).slice(0, 250) });
      return new Orig(cb);
    };
    Patched.prototype = Orig.prototype;
    Patched.__ddnaPatched = true;
    window.ResizeObserver = Patched;
  });

  // ─── Patch requestAnimationFrame counter ───
  safe('rAF counter', () => {
    const orig = window.requestAnimationFrame;
    window.requestAnimationFrame = function (cb) {
      store.rafCount++;
      return orig.call(window, cb);
    };
  });

  // ─── Patch classList.add / toggle / remove ───
  safe('classList patch', () => {
    const proto = DOMTokenList.prototype;
    ['add', 'remove', 'toggle', 'replace'].forEach(op => {
      const orig = proto[op];
      proto[op] = function (...args) {
        if (store.classToggles.length < 200) {
          store.classToggles.push({
            op,
            classes: args.map(String).slice(0, 3),
            element: this.value || '',
            ts: Date.now(),
          });
        }
        return orig.apply(this, args);
      };
    });
  });

  // ─── Patch addEventListener for tracking ───
  safe('addEventListener patch', () => {
    const orig = EventTarget.prototype.addEventListener;
    const tracked = ['mouseenter', 'mouseleave', 'mousemove', 'mousedown', 'mouseup',
      'touchstart', 'touchmove', 'touchend', 'pointerdown', 'pointermove',
      'click', 'dblclick', 'scroll', 'wheel', 'keydown', 'focus', 'blur', 'drag', 'dragstart'];
    EventTarget.prototype.addEventListener = function (type, listener, opts) {
      if (tracked.includes(type) && store.eventListeners.length < 300) {
        const target = this === window ? 'window' :
                       this === document ? 'document' :
                       (this.tagName ? this.tagName.toLowerCase() : 'unknown');
        store.eventListeners.push({
          target,
          type,
          listener: String(listener).slice(0, 200),
        });
      }
      return orig.call(this, type, listener, opts);
    };
  });

  // ─── Wait for libraries to load, then snapshot ───
  const snapshotLibraries = () => {
    // GSAP
    safe('GSAP', () => {
      if (!window.gsap) return;
      const tweens = [], timelines = [];
      const animatable = ['x','y','xPercent','yPercent','rotation','rotationX','rotationY','rotationZ',
        'scale','scaleX','scaleY','opacity','width','height','top','left','right','bottom',
        'backgroundColor','color','borderRadius','skewX','skewY','transformOrigin','transformPerspective',
        'clipPath','filter','autoAlpha','drawSVG','morphSVG','motionPath','text','scrambleText',
        'physics2D','pixi','attr','css'];

      const walk = (tl, depth = 0) => {
        if (!tl || depth > 8) return;
        const children = tl.getChildren ? tl.getChildren(false, true, true) : [];
        for (const c of children) {
          const isTL = c.getChildren !== undefined;
          const targets = (() => {
            try {
              return gsap.utils.toArray(c.targets ? c.targets() : []).map(el => {
                if (!el?.tagName) return String(el).slice(0, 40);
                const id = el.id ? `#${el.id}` : '';
                const cls = [...(el.classList || [])].slice(0, 2).map(x => `.${x}`).join('');
                return (id || cls || el.tagName.toLowerCase()).slice(0, 80);
              });
            } catch { return []; }
          })();
          const cssProps = {};
          animatable.forEach(p => { if (p in (c.vars || {})) cssProps[p] = c.vars[p]; });

          const entry = {
            type: isTL ? 'timeline' : 'tween',
            duration: c.duration?.() ?? 0,
            delay: c.delay?.() ?? 0,
            ease: c.vars?.ease?.toString?.() || c.vars?.ease || '',
            repeat: c.vars?.repeat ?? 0,
            yoyo: c.vars?.yoyo ?? false,
            stagger: c.vars?.stagger,
            paused: c.paused?.() ?? false,
            targets,
            cssProps,
            labels: isTL && c.labels ? c.labels : {},
            plugins: {
              motionPath: !!c.vars?.motionPath,
              drawSVG: !!c.vars?.drawSVG,
              morphSVG: !!c.vars?.morphSVG,
              splitText: !!c.vars?.splitText,
              physics2D: !!c.vars?.physics2D,
              pixi: !!c.vars?.pixi,
              scrambleText: !!c.vars?.scrambleText,
            },
          };
          if (isTL) { timelines.push(entry); walk(c, depth + 1); }
          else tweens.push(entry);
        }
      };
      walk(gsap.globalTimeline);

      store.gsap = {
        version: gsap.version,
        tweens, timelines,
        registeredPlugins: Object.keys(window).filter(k =>
          /^(MotionPath|DrawSVG|MorphSVG|SplitText|ScrollTrigger|ScrollSmoother|Physics|Pixi|CustomEase|CustomBounce|CustomWiggle|Flip|Observer|ScrollTo|Draggable|Inertia|GSDevTools|MotionPathHelper)/.test(k)
        ),
        defaults: gsap.defaults?.() || {},
      };
    });

    // ScrollTrigger
    safe('ScrollTrigger', () => {
      if (!window.ScrollTrigger) return;
      store.scrollTriggers = ScrollTrigger.getAll().map(st => {
        const t = st.trigger;
        const sel = t ? (t.id ? `#${t.id}` : (t.classList?.length ? `.${[...t.classList][0]}` : t.tagName?.toLowerCase())) : '';
        return {
          trigger: sel || '',
          start: st.start, end: st.end,
          scrub: st.vars?.scrub ?? false,
          pin: st.vars?.pin ?? false,
          pinSpacing: st.vars?.pinSpacing ?? false,
          markers: !!st.vars?.markers,
          toggleClass: st.vars?.toggleClass ?? '',
          toggleActions: st.vars?.toggleActions ?? '',
          snap: st.vars?.snap ?? null,
          anticipatePin: st.vars?.anticipatePin ?? 0,
          horizontal: !!st.vars?.horizontal,
          fastScrollEnd: st.vars?.fastScrollEnd ?? false,
          animation: st.animation ? {
            duration: st.animation.duration?.() ?? 0,
            vars: Object.fromEntries(
              Object.entries(st.animation.vars || {})
                .filter(([k, v]) => typeof v !== 'function' && k !== 'scrollTrigger')
                .slice(0, 30)
            ),
          } : null,
        };
      });
    });

    // ScrollSmoother
    safe('ScrollSmoother', () => {
      if (!window.ScrollSmoother) return;
      const ss = ScrollSmoother.get?.();
      if (ss) {
        store.scrollSmoother = {
          smooth: ss.smooth(),
          effects: ss.vars?.effects ?? false,
          smoothTouch: ss.vars?.smoothTouch ?? false,
          normalizeScroll: ss.vars?.normalizeScroll ?? false,
        };
      }
    });

    // Lottie / bodymovin
    safe('Lottie', () => {
      document.querySelectorAll('lottie-player, dotlottie-player, [data-lottie], [data-bodymovin]').forEach(el => {
        store.lottie.push({
          tag: el.tagName.toLowerCase(),
          src: el.getAttribute('src') || el.dataset.lottie || el.dataset.bodymovin || '',
          autoplay: el.hasAttribute('autoplay'),
          loop: el.hasAttribute('loop'),
          speed: el.getAttribute('speed') || '1',
          direction: el.getAttribute('direction') || '1',
          mode: el.getAttribute('mode') || 'normal',
          renderer: el.getAttribute('renderer') || 'svg',
          width: el.offsetWidth,
          height: el.offsetHeight,
        });
      });
      const lib = window.lottie || window.bodymovin;
      if (lib?.registeredAnimations) {
        lib.registeredAnimations.forEach(a => {
          store.lottie.push({
            source: 'bodymovin-runtime',
            path: a.path || '',
            name: a.name || '',
            totalFrames: a.totalFrames,
            frameRate: a.frameRate,
            isLoaded: a.isLoaded,
            playDirection: a.playDirection,
          });
        });
      }
    });

    // Three.js / WebGL
    safe('Three.js', () => {
      document.querySelectorAll('canvas').forEach(canvas => {
        try {
          const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
          if (!gl) return;
          store.three.push({
            id: canvas.id || '',
            classes: [...canvas.classList].join(' '),
            width: canvas.width,
            height: canvas.height,
            cssWidth: canvas.style.width || canvas.offsetWidth + 'px',
            cssHeight: canvas.style.height || canvas.offsetHeight + 'px',
            contextType: gl instanceof WebGL2RenderingContext ? 'webgl2' : 'webgl',
            renderer: gl.getParameter(gl.RENDERER),
            vendor: gl.getParameter(gl.VENDOR),
            version: gl.getParameter(gl.VERSION),
            shadingLanguage: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
            maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
            antialias: gl.getContextAttributes()?.antialias,
            alpha: gl.getContextAttributes()?.alpha,
          });
        } catch {}
      });
      if (window.THREE) {
        store.three.unshift({ library: 'THREE.js', version: window.THREE.REVISION });
      }
    });

    // Framer Motion
    safe('Framer Motion', () => {
      document.querySelectorAll('[data-framer-name], [data-framer-component-type]').forEach(el => {
        store.framer.push({
          name: el.dataset.framerName || '',
          type: el.dataset.framerComponentType || '',
          selector: el.id ? `#${el.id}` : (el.classList[0] ? `.${el.classList[0]}` : el.tagName.toLowerCase()),
        });
      });
    });

    // anime.js
    safe('anime.js', () => {
      if (window.anime) {
        store.anime.push({
          detected: true,
          version: window.anime.version || 'unknown',
          running: window.anime.running?.length || 0,
        });
      }
    });

    // Motion One
    safe('Motion One', () => {
      if (window.Motion || window.motion) {
        store.motionOne.push({ detected: true });
      }
    });

    // Rive
    safe('Rive', () => {
      if (window.rive) store.rive.push({ detected: true });
      document.querySelectorAll('canvas[data-rive], [data-rive-src]').forEach(el => {
        store.rive.push({ src: el.dataset.riveSrc || el.dataset.rive });
      });
    });

    // Spline
    safe('Spline', () => {
      document.querySelectorAll('spline-viewer').forEach(el => {
        store.splines.push({
          url: el.getAttribute('url') || '',
          loadingAnim: el.getAttribute('loading-anim'),
          eventsTarget: el.getAttribute('events-target'),
        });
      });
    });

    // Custom Elements
    safe('CustomElements', () => {
      const allTags = new Set();
      document.querySelectorAll('*').forEach(el => {
        if (el.tagName.includes('-')) allTags.add(el.tagName.toLowerCase());
      });
      store.customElements = [...allTags].map(tag => ({
        tag,
        defined: !!customElements.get(tag),
        count: document.querySelectorAll(tag).length,
      }));
    });

    // Paint Worklets
    safe('PaintWorklet', () => {
      if (CSS?.paintWorklet) {
        store.paintWorklets.push({ supported: true });
      }
    });

    // Native scroll-driven CSS
    safe('ScrollDriven CSS', () => {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules || []) {
            const txt = rule.cssText || '';
            if (/animation-timeline|scroll\(|view\(|@scroll-timeline|@view-transition/.test(txt)) {
              store.scrollDriven.push(txt.slice(0, 400));
            }
          }
        } catch {}
      }
    });
  };

  // Run immediately + again after window load (catches late-loaded libs)
  snapshotLibraries();
  if (document.readyState !== 'complete') {
    window.addEventListener('load', () => setTimeout(snapshotLibraries, 500), { once: true });
  } else {
    setTimeout(snapshotLibraries, 100);
  }
})();