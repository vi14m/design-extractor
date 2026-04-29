document.getElementById('extractBtn').addEventListener('click', async () => {
  const statusEl = document.getElementById('status');
  const log = (msg) => { statusEl.textContent = msg; };

  log('1/4: Getting active tab...');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab found.');

    log('2/4: Scanning page design...');
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractDesignData,
    });
    const designData = results[0].result;
    if (!designData) throw new Error('Design extraction returned nothing.');

    log('3/4: Generating markdown...');
    const markdown = generateMarkdown(designData);

    log('4/4: Downloading file...');
    downloadMarkdown(markdown, tab.title);
    log('✅ Done! File downloaded.');
  } catch (err) {
    log('❌ Error: ' + err.message);
    console.error(err);
  }
});

// -------------------------------------------------------
// THIS FUNCTION RUNS INSIDE THE WEB PAGE
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
    const match = value.match(/url\(["']?(.*?)["']?\)/);
    return match ? getAbsoluteUrl(match[1]) : '';
  };

  const keyframesMap = new Map();
  const fontFaceRules = [];

  const processStylesheet = async (sheet) => {
    try {
      const rules = sheet.cssRules || sheet.rules;
      for (const rule of rules) {
        if (rule instanceof CSSKeyframesRule) keyframesMap.set(rule.name, rule.cssText);
        else if (rule instanceof CSSFontFaceRule) fontFaceRules.push(rule.cssText);
      }
    } catch {
      if (sheet.href && sheet.href.startsWith('http')) {
        try {
          const resp = await fetch(sheet.href);
          const text = await resp.text();
          for (const match of text.matchAll(/@keyframes\s+([^{\s]+)\s*\{[^}]*\}/g)) {
            keyframesMap.set(match[1], match[0]);
          }
          for (const match of text.matchAll(/@font-face\s*\{[^}]*\}/g)) {
            fontFaceRules.push(match[0]);
          }
        } catch { /* ignore fetch errors */ }
      }
    }
  };

  const palette = new Set();
  const bodyStyle = getComputedStyle(document.body);
  const baseFont = bodyStyle.fontFamily.split(',')[0].trim().replace(/["']/g, '');
  const baseFontSize = bodyStyle.fontSize;
  const baseColor = bodyStyle.color;

  const sectionElements = [...document.body.children].filter(
    el => isVisible(el) && !['SCRIPT','STYLE','NOSCRIPT','META','LINK'].includes(el.tagName)
  );

  const processNode = (el) => {
    if (!isVisible(el)) return null;
    const tag = el.tagName.toLowerCase();
    const style = getComputedStyle(el);
    const classes = [...el.classList].join(' ') || '';

    const bg = style.backgroundColor;
    const color = style.color;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') palette.add(bg);
    if (color && color !== 'rgb(0, 0, 0)') palette.add(color);

    const node = {
      tag,
      classes,
      layout: {
        display: style.display,
        flexDirection: style.display.includes('flex') ? style.flexDirection : '',
        justifyContent: style.justifyContent,
        alignItems: style.alignItems,
        gap: style.gap,
        padding: style.padding,
        margin: style.margin,
        width: style.width,
        height: style.height,
        background: bg,
        backgroundImage: extractUrlFromCSS(style.backgroundImage),
        border: style.border,
        borderRadius: style.borderRadius,
      },
      typography: {
        fontFamily: style.fontFamily.split(',')[0].trim().replace(/["']/g, ''),
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        color: style.color,
        lineHeight: style.lineHeight,
      },
      animation: style.animationName && style.animationName !== 'none' ? {
        name: style.animationName,
        duration: style.animationDuration,
        timing: style.animationTimingFunction,
        delay: style.animationDelay,
        iteration: style.animationIterationCount,
      } : null,
      transition: style.transitionProperty !== 'all 0s ease 0s' ? {
        property: style.transitionProperty,
        duration: style.transitionDuration,
      } : null,
      isImage: tag === 'img' || style.backgroundImage.includes('url('),
      imageSrc: tag === 'img' ? el.src : extractUrlFromCSS(style.backgroundImage),
      text: el.textContent.trim().slice(0, 80),
      children: [],
    };

    for (const child of el.children) {
      const childNode = processNode(child);
      if (childNode) node.children.push(childNode);
    }
    return node;
  };

  const sections = sectionElements.map(el => processNode(el)).filter(Boolean);

  const sheets = [...document.styleSheets];
  await Promise.all(sheets.map(sheet => processStylesheet(sheet).catch(() => {})));

  return {
    pageTitle: document.title,
    baseFont,
    baseFontSize,
    baseColor,
    palette: [...palette],
    sections,
    keyframes: Object.fromEntries(keyframesMap),
    fontFaceRules,
    url: location.href,
  };
}

// -------------------------------------------------------
// MARKDOWN GENERATOR (runs in popup context)
// -------------------------------------------------------
function generateMarkdown(data) {
  let md = `# Design Spec: ${data.pageTitle}\n\n`;
  md += `- **Source URL:** ${data.url}\n`;
  md += `- **Base font:** ${data.baseFont}, ${data.baseFontSize}\n`;
  md += `- **Base text color:** ${data.baseColor}\n\n`;

  // Palette
  md += `## 🎨 Color Palette\n\n`;
  data.palette.forEach(c => {
    md += `- \`${c}\`\n`;
  });

  // Typography
  md += `\n## 🔤 Typography\n\n`;
  md += `- Base: **${data.baseFont}** (${data.baseFontSize})\n`;
  if (data.fontFaceRules.length) {
    md += `\n### @font-face declarations\n`;
    data.fontFaceRules.forEach(ff => {
      md += `\n\`\`\`css\n${ff}\n\`\`\`\n`;
    });
  }

  // Layout tree
  md += `\n## 🧩 Layout & Components\n\n`;
  const renderNode = (node, depth = 0) => {
    const indent = '  '.repeat(depth);
    const tagLabel = node.classes ?
      ` (${node.tag}.${node.classes.replace(/\s+/g, '.')})` : ` (${node.tag})`;
    md += `${indent}- **${node.tag}**${tagLabel}\n`;

    if (node.layout.display) {
      const l = node.layout;
      md += `${indent}  - Layout: \`display:${l.display}\``;
      if (l.flexDirection) md += `, direction: ${l.flexDirection}`;
      if (l.justifyContent) md += `, justify: ${l.justifyContent}`;
      if (l.alignItems) md += `, align: ${l.alignItems}`;
      if (l.gap && l.gap !== 'normal') md += `, gap: ${l.gap}`;
      md += `\n`;
    }
    if (node.layout.background && node.layout.background !== 'rgba(0, 0, 0, 0)') {
      md += `${indent}  - bg: \`${node.layout.background}\`\n`;
    }
    if (node.layout.backgroundImage) {
      md += `${indent}  - background-image: \`${node.layout.backgroundImage}\`\n`;
    }
    if (node.isImage) {
      md += `${indent}  - ![image](${node.imageSrc})\n`;
      md += `${indent}  - URL: \`${node.imageSrc}\`\n`;
    }
    if (node.text.length) {
      md += `${indent}  - Text: "${node.text}"\n`;
    }
    if (node.animation) {
      const a = node.animation;
      md += `${indent}  - Animation: \`${a.name} ${a.duration} ${a.timing} ${a.delay} iteration:${a.iteration}\`\n`;
      const kf = data.keyframes[a.name];
      if (kf) {
        md += `${indent}    \`\`\`css\n${indent}    ${kf.replace(/\n/g, '\n' + indent + '    ')}\n${indent}    \`\`\`\n`;
      }
    }
    if (node.transition) {
      md += `${indent}  - Transition: \`${node.transition.property} ${node.transition.duration}\`\n`;
    }
    node.children.forEach(child => renderNode(child, depth + 1));
  };
  data.sections.forEach(sec => renderNode(sec));

  // Unused keyframes (may be applied dynamically)
  const usedNames = new Set();
  function collectNames(node) {
    if (node.animation) usedNames.add(node.animation.name);
    node.children.forEach(collectNames);
  }
  data.sections.forEach(sec => collectNames(sec));

  const unused = Object.keys(data.keyframes).filter(name => !usedNames.has(name));
  if (unused.length) {
    md += `\n## 🎞️ Unused Keyframes (may be used dynamically)\n\n`;
    unused.forEach(name => {
      md += `### @keyframes ${name}\n\`\`\`css\n${data.keyframes[name]}\n\`\`\`\n\n`;
    });
  }

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