// extractors/scripts.js
// Mines inline + external JS for animation/interaction patterns
window.__DDNA_extractScripts = async function (opts = { external: true, maxFiles: 30 }) {
  const intel = {
    libraries: [],
    gsap: [],
    scrollTrigger: [],
    hover: [],
    mousemove: [],
    click: [],
    drag: [],
    intersection: [],
    mutation: [],
    classListMutations: [],
    timelines: [],
    requestAnimationFrame: 0,
    setIntervalCalls: 0,
    setTimeoutCalls: 0,
    fetchCalls: 0,
    externalFiles: [],
    inlineScriptCount: 0,
    totalInlineSize: 0,
  };

  const PATTERNS = [
    [/gsap\.(to|from|fromTo|set|timeline|registerPlugin|matchMedia|context|quickTo|quickSetter|delayedCall)\s*\([^;]{0,500}/g, 'gsap'],
    [/(?:TweenMax|TweenLite|TimelineMax|TimelineLite)\.(to|from|fromTo|set|staggerTo|staggerFrom)\s*\([^;]{0,400}/g, 'gsap'],
    [/ScrollTrigger\.(create|matchMedia|defaults|refresh|batch|saveStyles)\s*\([^;]{0,600}/g, 'scrollTrigger'],
    [/scrollTrigger\s*:\s*\{[^{}]{0,500}\}/g, 'scrollTrigger'],
    [/addEventListener\s*\(\s*['"`]mouse(?:enter|leave|over|out)['"`]\s*,[^)]{0,200}/g, 'hover'],
    [/\.(?:hover|mouseenter|mouseleave)\s*\([^)]{0,200}/g, 'hover'],
    [/addEventListener\s*\(\s*['"`]mousemove['"`]\s*,[^)]{0,250}/g, 'mousemove'],
    [/addEventListener\s*\(\s*['"`]click['"`]\s*,[^)]{0,200}/g, 'click'],
    [/addEventListener\s*\(\s*['"`](?:mousedown|touchstart|pointerdown|dragstart)['"`]\s*,[^)]{0,250}/g, 'drag'],
    [/Draggable\.create\s*\([^;]{0,500}/g, 'drag'],
    [/new\s+Hammer\s*\([^)]{0,200}/g, 'drag'],
    [/new\s+IntersectionObserver\s*\([^;]{0,500}/g, 'intersection'],
    [/new\s+MutationObserver\s*\([^;]{0,300}/g, 'mutation'],
    [/classList\.(add|remove|toggle|replace)\s*\([^)]{0,200}/g, 'classListMutations'],
    [/anime\s*\(\s*\{[^}]{0,500}\}/g, 'timelines'],
  ];

  const LIBRARIES = {
    'GSAP': /\bgsap\b|TweenMax|TweenLite|TimelineMax|TimelineLite/,
    'ScrollTrigger': /ScrollTrigger/,
    'ScrollSmoother': /ScrollSmoother/,
    'SplitText': /new\s+SplitText|SplitText\(|gsap\.utils\.toArray.*split/,
    'Draggable (GSAP)': /Draggable\.create/,
    'Flip (GSAP)': /Flip\.(getState|from|fit)/,
    'MotionPath': /MotionPathPlugin|motionPath\s*:/,
    'DrawSVG': /DrawSVGPlugin|drawSVG\s*:/,
    'MorphSVG': /MorphSVGPlugin|morphSVG\s*:/,
    'Lenis': /\bnew\s+Lenis\b|lenis\.raf|lenis\.scrollTo/,
    'Locomotive Scroll': /new\s+LocomotiveScroll/,
    'Three.js': /THREE\.|new\s+THREE\.|@react-three/,
    'React Three Fiber': /@react-three\/fiber|<Canvas/,
    'Lottie': /lottie\.loadAnimation|bodymovin\.loadAnimation|<lottie-player/,
    'Framer Motion': /framer-motion|motion\.(div|span|button|a|section)|useMotionValue|useTransform/,
    'anime.js': /\banime\s*\(|anime\.timeline|anime\.stagger/,
    'Motion One': /@motionone|motion\(|animate\(/,
    'AOS': /AOS\.init|data-aos=/,
    'WOW.js': /new\s+WOW\(/,
    'Swiper': /new\s+Swiper\(/,
    'Splide': /new\s+Splide\(/,
    'Embla Carousel': /EmblaCarousel/,
    'Barba.js': /barba\.init|@barba/,
    'Highway': /new\s+Highway\.Core/,
    'Hammer.js': /new\s+Hammer\(/,
    'p5.js': /new\s+p5\(/,
    'PixiJS': /new\s+PIXI\.|PIXI\.Application/,
    'Rive': /new\s+rive\.|@rive-app/,
    'Spline': /spline-viewer|@splinetool/,
    'Vanilla Tilt': /VanillaTilt\.init/,
    'Typed.js': /new\s+Typed\(/,
    'GLightbox': /new\s+GLightbox/,
    'Fancybox': /Fancybox\.bind/,
    'Alpine.js': /Alpine\.start|x-data=/,
    'HTMX': /htmx\.|hx-/,
    'jQuery': /jQuery|\$\(document\)\.ready/,
    'React': /React\.createElement|_jsx|useState|useEffect/,
    'Vue': /Vue\.createApp|defineComponent/,
    'Svelte': /__svelte/,
    'Next.js': /__NEXT_DATA__/,
    'Nuxt': /__NUXT__/,
    'Webflow': /Webflow\./,
    'Tailwind': /tailwindcss/,
  };

  const mine = (src, label) => {
    PATTERNS.forEach(([pat, key]) => {
      let count = 0;
      for (const m of src.matchAll(pat)) {
        if (count++ > 50) break;
        intel[key].push({ source: label, snippet: m[0].slice(0, 350).trim() });
      }
    });
    intel.requestAnimationFrame += (src.match(/requestAnimationFrame\s*\(/g) || []).length;
    intel.setIntervalCalls += (src.match(/setInterval\s*\(/g) || []).length;
    intel.setTimeoutCalls += (src.match(/setTimeout\s*\(/g) || []).length;
    intel.fetchCalls += (src.match(/fetch\s*\(/g) || []).length;

    Object.entries(LIBRARIES).forEach(([name, re]) => {
      if (re.test(src) && !intel.libraries.includes(name)) intel.libraries.push(name);
    });
  };

  // Inline scripts
  for (const s of document.scripts) {
    if (s.textContent && !s.src) {
      intel.inlineScriptCount++;
      intel.totalInlineSize += s.textContent.length;
      mine(s.textContent, 'inline');
    }
  }

  // External scripts (CORS-permitting)
  if (opts.external) {
    const externals = [...document.scripts].filter(s => s.src);
    const limited = externals.slice(0, opts.maxFiles || 30);
    const fetched = await Promise.allSettled(limited.map(async s => {
      try {
        const txt = await fetch(s.src, { credentials: 'omit' }).then(r => r.text());
        const fname = s.src.split('/').pop().split('?')[0];
        mine(txt, fname);
        return { url: s.src, size: txt.length, status: 'ok' };
      } catch (e) {
        return { url: s.src, error: e.message, status: 'failed' };
      }
    }));
    intel.externalFiles = fetched.map(f => f.value || f.reason);
  }

  // Cap arrays
  ['gsap','scrollTrigger','hover','mousemove','click','drag','intersection','mutation','classListMutations','timelines']
    .forEach(k => { intel[k] = intel[k].slice(0, 50); });

  return intel;
};