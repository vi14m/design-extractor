// lib/llm-engine.js — LLM-powered design specification generator
// Transforms raw extracted data into editorial-quality DESIGN.md files
// Supports Groq, OpenAI, and compatible API endpoints

// ─────────────────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a senior design systems architect. You receive raw extracted design data from a website (colors, typography, spacing, components, layout, animations, interactions) and produce a comprehensive, editorial-quality DESIGN.md specification.

## Output Format

Your output MUST follow this exact structure with YAML frontmatter:

\`\`\`
---
version: alpha
name: [Brand Name]
description: [2-3 sentence editorial description of the brand's visual identity, key characteristics, and design philosophy]

colors:
  [semantic-name]: "[hex or rgb value]"
  ...

typography:
  [token-name]:
    fontFamily: [font]
    fontSize: [value]
    fontWeight: [value]
    lineHeight: [value]
    letterSpacing: [value if non-zero]
  ...

rounded:
  [token-name]: [value]
  ...

spacing:
  [token-name]: [value]
  ...

components:
  [component-name]:
    backgroundColor: "{colors.[ref]}"
    textColor: "{colors.[ref]}"
    typography: "{typography.[ref]}"
    rounded: "{rounded.[ref]}"
    padding: "[value]"
    border: "[value if any]"
  ...
---
\`\`\`

## Content Sections (after frontmatter)

1. **Overview** — 2-3 editorial paragraphs describing the brand's visual personality, design philosophy, and key characteristics. Write like a design critic, not a robot. Reference token names inline like \`{colors.primary}\`.

2. **Colors** — Group into: Brand & Accent, Surface, Text, Semantic. For each color, explain its ROLE in the system (e.g., "Carries every primary CTA, the search-button orb, and inline brand links"). Include source page references.

3. **Typography** — Document the font family choice with rationale. Include a hierarchy table with columns: Token, Size, Weight, Line Height, Letter Spacing, Use. Explain principles (tight hero leading, generous body leading, weight discipline).

4. **Layout** — Document spacing system (base unit, tokens, section rhythm, card internal padding). Describe grid & container strategy. Explain whitespace philosophy.

5. **Elevation & Depth** — Table of shadow levels (0-4) with treatment and use. Note decorative depth strategies.

6. **Shapes** — Border radius scale table with token, value, and use. Note photography geometry.

7. **Components** — Document each component with:
   - Semantic name and purpose
   - Visual properties referencing tokens (\`{colors.primary}\`, \`{typography.body-md}\`)
   - State variants (pressed, disabled, active) as separate entries
   - Group into: Buttons, Cards, Inputs & Forms, Tabs, Badges, Navigation, Signature Components

8. **Do's and Don'ts** — Specific, actionable guidelines for maintaining design consistency.

9. **Responsive Behavior** — Breakpoints table, touch targets, collapsing strategy, image behavior.

10. **Iteration Guide** — Numbered workflow steps for maintaining the spec.

11. **Known Gaps** — Honest assessment of what wasn't captured.

## Rules

- Use semantic color names (ink, canvas, surface, muted, brand-coral) NOT hex codes as names
- Reference tokens using \`{colors.name}\`, \`{typography.name}\`, \`{spacing.name}\`, \`{rounded.name}\` syntax
- Component properties MUST reference tokens, not raw values: \`backgroundColor: "{colors.primary}"\` not \`backgroundColor: "#0a0a0a"\`
- Write editorial prose, not bullet dumps. Each section should read like professional design documentation.
- Infer design intent from the data — explain WHY choices were made, not just WHAT they are
- For the YAML frontmatter components section, include ALL significant UI components you can identify
- Derive border-radius tokens from the actual values found in the data
- Derive spacing tokens from padding/margin/gap values found in the data
- Group similar values into a coherent scale (e.g., 4px, 8px, 12px, 16px, 24px, 32px)
- When you see pill-shaped buttons (border-radius: 9999px), note this as a \`full\` token
- Identify the brand's typography personality — is it editorial, technical, playful, corporate?
- Note the relationship between hero/display typography and body typography
- Document the color encoding strategy (do different products/sections have their own colors?)
- Per no-hover policy, describe hover states only if explicitly relevant to brand identity
- Keep component names kebab-case: \`button-primary\`, \`card-feature\`, \`nav-sidebar-item\`
- Include pressed/active/disabled variants as separate component entries with the suffix`;

// ─────────────────────────────────────────────────────────
// DATA COMPRESSION
// ─────────────────────────────────────────────────────────
// Compress raw extracted data to fit within LLM context window
function compressForLLM(data) {
  const compressed = {};

  // Meta
  compressed.meta = {
    title: data.meta?.title,
    url: data.meta?.url,
    viewport: `${data.meta?.viewport?.width}×${data.meta?.viewport?.height}`,
  };

  // Colors — top 40 by frequency
  if (data.layout?.palette?.length) {
    compressed.colors = data.layout.palette.slice(0, 40).map(p => ({
      color: p.color,
      count: p.count,
    }));
  }

  // CSS variables (design tokens)
  if (data.css?.variables) {
    const entries = Object.entries(data.css.variables);
    compressed.cssTokens = Object.fromEntries(entries.slice(0, 80));
  }

  // Typography
  if (data.typography) {
    compressed.typography = {
      base: data.typography.base,
      googleFonts: data.typography.googleFonts,
      scale: data.typography.scale
        ?.filter(t => ['h1','h2','h3','h4','h5','h6','p','a','button','small','span','li','blockquote','label','nav'].includes(t.tag))
        .slice(0, 20)
        .map(t => ({
          tag: t.tag,
          family: t.fontFamily,
          size: t.fontSize,
          weight: t.fontWeight,
          lineHeight: t.lineHeight,
          color: t.color,
          letterSpacing: t.letterSpacing,
          textTransform: t.textTransform,
          sample: t.sample?.slice(0, 60),
        })),
    };
  }

  // Components — extract key properties from layout tree
  if (data.layout?.tree?.length) {
    const components = [];
    const collect = (nodes, depth) => {
      if (depth > 5 || components.length >= 40) return;
      for (const node of nodes) {
        if (components.length >= 40) break;
        const isSignificant =
          ['header','nav','section','main','footer','article','aside','form','dialog','button'].includes(node.tag) ||
          (node.classes && /hero|container|section|wrapper|banner|card|modal|sidebar|toolbar|menu|grid|slider|carousel|overlay|drawer|panel|navbar|topbar|tab|badge|pill|input|search|footer|header|btn|button|cta/i.test(node.classes)) ||
          (node.id && node.id.length > 1) ||
          (node.hints?.role);

        if (isSignificant) {
          const comp = { tag: node.tag };
          if (node.id) comp.id = node.id;
          if (node.classes) comp.classes = node.classes.split(' ').filter(c => c && !c.startsWith('_')).slice(0, 5).join(' ');
          if (node.layout?.display) comp.display = node.layout.display;
          if (node.layout?.flexDirection) comp.flexDir = node.layout.flexDirection;
          if (node.layout?.justifyContent && node.layout.justifyContent !== 'normal') comp.justify = node.layout.justifyContent;
          if (node.layout?.alignItems && node.layout.alignItems !== 'normal') comp.align = node.layout.alignItems;
          if (node.layout?.gap && node.layout.gap !== 'normal' && node.layout.gap !== '0px') comp.gap = node.layout.gap;
          if (node.layout?.gridTemplateColumns) comp.gridCols = node.layout.gridTemplateColumns;
          if (node.layout?.position && node.layout.position !== 'static') comp.position = node.layout.position;
          if (node.box?.rect) comp.size = `${node.box.rect.w}×${node.box.rect.h}`;
          if (node.box?.padding && node.box.padding !== '0px') comp.padding = node.box.padding;
          if (node.background?.color && node.background.color !== 'rgba(0, 0, 0, 0)' && node.background.color !== 'transparent') comp.bg = node.background.color;
          if (node.background?.gradient) comp.gradient = node.background.gradient.slice(0, 100);
          if (node.border?.radius && node.border.radius !== '0px') comp.radius = node.border.radius;
          if (node.border?.width && node.border.width !== '0px') comp.border = `${node.border.width} ${node.border.style} ${node.border.color}`;
          if (node.visual?.boxShadow) comp.shadow = node.visual.boxShadow.slice(0, 100);
          if (node.visual?.backdropFilter) comp.backdrop = node.visual.backdropFilter;
          if (node.visual?.opacity && node.visual.opacity !== '1') comp.opacity = node.visual.opacity;
          if (node.typography?.fontFamily) comp.font = node.typography.fontFamily;
          if (node.typography?.fontSize) comp.fontSize = node.typography.fontSize;
          if (node.typography?.fontWeight) comp.fontWeight = node.typography.fontWeight;
          if (node.typography?.color) comp.textColor = node.typography.color;
          if (node.content?.text) comp.text = node.content.text.slice(0, 80);
          if (node.hints?.role) comp.role = node.hints.role;
          components.push(comp);
        }
        if (node.children) collect(node.children, depth + 1);
      }
    };
    collect(data.layout.tree, 0);
    compressed.components = components;
  }

  // Spacing values
  if (data.layout?.tree) {
    const spacings = new Set();
    const collectSpacings = (nodes) => {
      for (const node of nodes) {
        if (node.box?.padding && node.box.padding !== '0px') {
          node.box.padding.split(/\s+/).forEach(v => { if (/^\d/.test(v)) spacings.add(v); });
        }
        if (node.box?.margin) {
          node.box.margin.split(/\s+/).forEach(v => { if (/^\d/.test(v) && v !== '0px') spacings.add(v); });
        }
        if (node.layout?.gap && node.layout.gap !== 'normal' && node.layout.gap !== '0px') spacings.add(node.layout.gap);
        if (node.children) collectSpacings(node.children);
      }
    };
    collectSpacings(data.layout.tree);
    compressed.spacingValues = [...spacings].sort((a, b) => parseFloat(a) - parseFloat(b)).slice(0, 30);
  }

  // Border radius values
  if (data.layout?.tree) {
    const radii = new Set();
    const collectRadii = (nodes) => {
      for (const node of nodes) {
        if (node.border?.radius && node.border.radius !== '0px') radii.add(node.border.radius);
        if (node.children) collectRadii(node.children);
      }
    };
    collectRadii(data.layout.tree);
    compressed.borderRadii = [...radii].sort((a, b) => parseFloat(a) - parseFloat(b));
  }

  // Interactions (condensed)
  if (data.interactions) {
    compressed.interactions = {};
    if (data.interactions.hover?.length) {
      compressed.interactions.hover = data.interactions.hover.slice(0, 10).map(r => ({
        selector: r.selector,
        css: r.css?.slice(0, 150),
      }));
    }
    if (data.interactions.customCursors?.length) {
      compressed.interactions.cursors = data.interactions.customCursors.slice(0, 5);
    }
  }

  // Animations
  const rt = data.runtime || {};
  if (rt.gsap?.tweens?.length || rt.scrollTriggers?.length) {
    compressed.animations = {};
    if (rt.gsap?.version) compressed.animations.gsapVersion = rt.gsap.version;
    if (rt.gsap?.registeredPlugins) compressed.animations.gsapPlugins = rt.gsap.registeredPlugins;
    if (rt.gsap?.tweens?.length) {
      compressed.animations.tweens = rt.gsap.tweens.slice(0, 10).map(t => ({
        targets: t.targets,
        duration: t.duration,
        ease: t.ease,
        props: t.cssProps,
      }));
    }
    if (rt.scrollTriggers?.length) {
      compressed.animations.scrollTriggers = rt.scrollTriggers.slice(0, 8);
    }
  }

  // Assets (condensed)
  if (data.assets) {
    compressed.assets = {};
    if (data.assets.fonts?.length) {
      const seen = new Set();
      compressed.assets.fonts = data.assets.fonts.filter(f => {
        const key = typeof f === 'object' ? `${f.family}-${f.weight}` : f;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 15).map(f => typeof f === 'object' ? `${f.family} ${f.weight} ${f.style}` : f);
    }
    if (data.assets.images?.length) {
      compressed.assets.imageCount = data.assets.images.length;
    }
    if (data.assets.videos?.length) {
      compressed.assets.videoCount = data.assets.videos.length;
    }
  }

  // Technologies
  if (data.scriptIntel?.libraries?.length) {
    compressed.technologies = data.scriptIntel.libraries.slice(0, 15);
  }

  // Media queries
  if (data.css?.mediaQueries?.length) {
    compressed.breakpoints = [...new Map(
      data.css.mediaQueries.map(m => [m.condition, m.ruleCount])
    ).entries()].slice(0, 10).map(([cond, rules]) => `${cond} (${rules} rules)`);
  }

  // Keyframes
  if (data.css?.keyframes) {
    compressed.keyframes = Object.keys(data.css.keyframes).slice(0, 15);
  }

  // Shadows (from components)
  if (compressed.components) {
    const shadows = new Set();
    compressed.components.forEach(c => { if (c.shadow) shadows.add(c.shadow); });
    if (shadows.size) compressed.shadowValues = [...shadows].slice(0, 8);
  }

  return compressed;
}

// ─────────────────────────────────────────────────────────
// API PROVIDERS
// ─────────────────────────────────────────────────────────
const PROVIDERS = {
  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'google/gemma-4-31b-it:free',
    models: [
      'google/gemma-4-31b-it:free',
      'google/gemma-4-26b-a4b-it:free',
      'minimax/minimax-m2.5:free',
      'openai/gpt-oss-120b:free',
      'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      'poolside/laguna-m.1:free',
      'tencent/hy3-preview:free',
      'liquid/lfm-2.5-1.2b-thinking:free',
      'z-ai/glm-4.5-air:free',
    ],
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  },
  custom: {
    name: 'Custom',
    baseUrl: '',
    defaultModel: '',
    models: [],
  },
};

// ─────────────────────────────────────────────────────────
// LLM API CALL
// ─────────────────────────────────────────────────────────
async function callLLM(config, extractedData, onProgress) {
  const provider = PROVIDERS[config.provider] || PROVIDERS.openrouter;
  const baseUrl = config.provider === 'custom' ? config.customUrl : provider.baseUrl;
  const model = config.model || provider.defaultModel;

  if (!config.apiKey) throw new Error('API key not configured. Open Settings to add your API key.');
  if (!baseUrl) throw new Error('API endpoint not configured.');

  // Compress data for LLM context
  onProgress?.('Compressing design data for LLM…');
  const compressed = compressForLLM(extractedData);
  const dataPayload = JSON.stringify(compressed, null, 1);

  // Estimate tokens (rough: 4 chars ≈ 1 token)
  const estimatedTokens = Math.round(dataPayload.length / 4);
  onProgress?.(`Sending ${estimatedTokens} tokens to ${provider.name}…`);

  const userPrompt = `Here is the extracted design data from "${extractedData.meta?.title || 'the website'}" (${extractedData.meta?.url || 'unknown URL'}):\n\n\`\`\`json\n${dataPayload}\n\`\`\`\n\nGenerate a comprehensive DESIGN.md specification following the exact format from your instructions. Be thorough — document every color, every typography token, every component you can identify from the data. Write editorial prose that explains design intent and rationale.`;

  const body = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 16000,
  };

  onProgress?.(`Generating DESIGN.md via ${provider.name} (${model})…`);

  // Build headers — OpenRouter requires HTTP-Referer and X-Title
  const cleanKey = config.apiKey.replace(/^Bearer\s+/i, '').trim();
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${cleanKey}`,
  };
  if (config.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://design-dna.dev';
    headers['X-Title'] = 'Design DNA Extractor';
  }

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMsg;
    try {
      const errorJson = JSON.parse(errorText);
      errorMsg = errorJson.error?.message || errorJson.message || errorText;
    } catch {
      errorMsg = errorText;
    }
    throw new Error(`${provider.name} API error (${response.status}): ${errorMsg}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;

  if (!content) throw new Error('LLM returned empty response');

  onProgress?.('DESIGN.md generated successfully');

  return {
    markdown: content,
    usage: result.usage,
    model: result.model,
  };
}

// ─────────────────────────────────────────────────────────
// SETTINGS MANAGEMENT
// ─────────────────────────────────────────────────────────
async function loadLLMConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['llmConfig'], (result) => {
      const config = result.llmConfig || {
        provider: 'openrouter',
        apiKey: '',
        model: '',
        customUrl: '',
      };
      // Migrate stale Groq config to OpenRouter
      if (config.provider === 'groq') {
        config.provider = 'openrouter';
        config.model = '';
        config.apiKey = ''; // Clear Groq key since it won't work with OpenRouter
      }
      
      // Sanitize key just in case they saved it with "Bearer "
      if (config.apiKey && config.apiKey.startsWith('Bearer ')) {
        config.apiKey = config.apiKey.replace('Bearer ', '').trim();
      }
      
      resolve(config);
    });
  });
}

async function saveLLMConfig(config) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ llmConfig: config }, resolve);
  });
}

// ─────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────
export {
  callLLM,
  loadLLMConfig,
  saveLLMConfig,
  compressForLLM,
  PROVIDERS,
};
