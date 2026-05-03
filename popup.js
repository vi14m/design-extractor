// popup.js — Design DNA orchestrator (modular ES module)
import { generateMarkdown, generateDesignSpec } from './lib/markdown.js';
import {
  generateJSON,
  generateSummaryJSON,
  generateCSSExport,
  generateDesignTokensJSON,
  generateTailwindConfig,
} from './lib/json-export.js';
import {
  callLLM,
  loadLLMConfig,
  saveLLMConfig,
  PROVIDERS,
} from './lib/llm-engine.js';

// ─────────────────────────────────────────────────────────
// DOM REFERENCES
// ─────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const btn = $('extractBtn');
const statusEl = $('status');
const progress = $('progress');
const fill = document.querySelector('.fill');
const spinner = document.querySelector('.spinner');
const btnText = document.querySelector('.btn-text');

// Settings DOM
const mainView = $('mainView');
const settingsView = $('settingsView');
const settingsLink = $('settingsLink');
const backBtn = $('backBtn');
const saveSettingsBtn = $('saveSettingsBtn');
const settingsStatus = $('settingsStatus');
const aiToggle = $('opt-ai-enhance');
const aiBadge = $('aiBadge');
const providerSelect = $('llm-provider');
const modelSelect = $('llm-model');
const apiKeyInput = $('llm-api-key');
const customUrlField = $('customUrlField');
const customUrlInput = $('llm-custom-url');
const toggleKeyBtn = $('toggleKeyVisibility');

// ─────────────────────────────────────────────────────────
// PROGRESS STEPS
// ─────────────────────────────────────────────────────────
const STEPS = [
  'Initializing scanners',
  'Injecting runtime probes',
  'Waiting for libraries',
  'Loading extractors',
  'Extracting CSS & design tokens',
  'Extracting layout tree',
  'Mining animations',
  'Capturing interactions',
  'Scanning Shadow DOM & iframes',
  'Mining JS bundles',
  'Inventorying assets',
  'Generating output',
];

const setProgress = (i, msg) => {
  fill.style.width = `${((i + 1) / STEPS.length) * 100}%`;
  statusEl.textContent = `${i + 1}/${STEPS.length}: ${msg || STEPS[i]}`;
};

// ─────────────────────────────────────────────────────────
// OPTIONS GETTER
// ─────────────────────────────────────────────────────────
const getOpts = () => ({
  css: $('opt-css').checked,
  typo: $('opt-typo').checked,
  layout: $('opt-layout').checked,
  anim: $('opt-anim').checked,
  scroll: $('opt-scroll').checked,
  hover: $('opt-hover').checked,
  pseudo: $('opt-pseudo').checked,
  shadow: $('opt-shadow').checked,
  iframe: $('opt-iframe').checked,
  svg: $('opt-svg').checked,
  three: $('opt-three').checked,
  tailwind: $('opt-tailwind').checked,
  fingerprint: $('opt-fingerprint').checked,
  external: $('opt-external').checked,
  screenshot: $('opt-screenshot').checked,
  exportFormat: document.querySelector('input[name="exportFormat"]:checked').value,
  aiEnhance: aiToggle.checked,
});

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────
const setBusy = (busy) => {
  btn.disabled = busy;
  spinner.hidden = !busy;
  btnText.textContent = busy ? 'Extracting…' : 'Extract Design';
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const downloadFile = (content, filename, mime) => {
  return new Promise((resolve) => {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({ url, filename, saveAs: false }, () => {
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      resolve();
    });
  });
};

// ─────────────────────────────────────────────────────────
// SETTINGS PANEL
// ─────────────────────────────────────────────────────────
function showSettings() {
  mainView.hidden = true;
  settingsView.hidden = false;
}

function hideSettings() {
  mainView.hidden = false;
  settingsView.hidden = true;
}

function populateModels(provider) {
  const providerConfig = PROVIDERS[provider];
  modelSelect.innerHTML = '<option value="">Default</option>';
  if (providerConfig?.models?.length) {
    providerConfig.models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      modelSelect.appendChild(opt);
    });
  }
  customUrlField.hidden = provider !== 'custom';
}

async function initSettings() {
  const config = await loadLLMConfig();

  providerSelect.value = config.provider || 'groq';
  apiKeyInput.value = config.apiKey || '';
  customUrlInput.value = config.customUrl || '';
  populateModels(config.provider || 'groq');
  if (config.model) modelSelect.value = config.model;

  updateAIBadge(config);
}

function updateAIBadge(config) {
  if (config.apiKey) {
    aiBadge.textContent = `${PROVIDERS[config.provider]?.name || 'Custom'} ✓`;
    aiBadge.className = 'ai-badge ready';
  } else {
    aiBadge.textContent = 'API key needed';
    aiBadge.className = 'ai-badge';
  }
}

// Settings event listeners
settingsLink.addEventListener('click', (e) => {
  e.preventDefault();
  showSettings();
});

backBtn.addEventListener('click', hideSettings);

providerSelect.addEventListener('change', () => {
  populateModels(providerSelect.value);
});

toggleKeyBtn.addEventListener('click', () => {
  apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
  toggleKeyBtn.textContent = apiKeyInput.type === 'password' ? '👁️' : '🔒';
});

saveSettingsBtn.addEventListener('click', async () => {
  const config = {
    provider: providerSelect.value,
    apiKey: apiKeyInput.value.replace(/^Bearer\s+/i, '').trim(),
    model: modelSelect.value,
    customUrl: customUrlInput.value.trim(),
  };

  await saveLLMConfig(config);
  updateAIBadge(config);
  settingsStatus.textContent = '✅ Settings saved';
  setTimeout(() => { settingsStatus.textContent = ''; }, 2000);
});

// AI toggle validation
aiToggle.addEventListener('change', async () => {
  if (aiToggle.checked) {
    const config = await loadLLMConfig();
    if (!config.apiKey) {
      aiToggle.checked = false;
      showSettings();
      settingsStatus.textContent = '⚠️ Please add an API key first';
    }
  }
});

// Initialize settings on load
initSettings();

// ─────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────
btn.addEventListener('click', async () => {
  const opts = getOpts();
  setBusy(true);
  progress.hidden = false;

  try {
    setProgress(0);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab found');
    if (!/^https?:/.test(tab.url)) {
      throw new Error('Cannot extract from this page (chrome:// or extension page)');
    }

    // ─── 1. Inject runtime probes (must run BEFORE everything) ───
    setProgress(1);
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: opts.iframe },
      files: ['extractors/injector.js'],
      injectImmediately: true,
    });

    // ─── 2. Wait briefly for libraries to register ───
    setProgress(2);
    await sleep(400);

    // ─── 3. Load all extractor modules into the page ───
    setProgress(3);
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: [
        'extractors/css-deep.js',
        'extractors/interaction.js',
        'extractors/scripts.js',
        'extractors/shadow-iframe.js',
        'extractors/layout.js',
      ],
    });

    // ─── 4. Run orchestrated extraction in page context ───
    setProgress(4);
    const [{ result: data }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: orchestrateExtraction,
      args: [opts],
    });

    if (!data) throw new Error('Extraction returned null');

    // ─── 5. Optional screenshot ───
    if (opts.screenshot) {
      setProgress(10, 'Capturing screenshot…');
      try {
        data.screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, {
          format: 'png',
        });
      } catch (e) {
        console.warn('Screenshot failed:', e);
      }
    }

    // ─── 6. Generate & download outputs ───
    setProgress(11);
    const baseName =
      (tab.title || 'design').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80) || 'design';

    const downloads = [];

    if (opts.exportFormat === 'md-spec' || opts.exportFormat === 'both') {
      downloads.push({
        content: generateDesignSpec(data),
        filename: `${baseName}.spec.md`,
        mime: 'text/markdown',
      });
    }
    if (opts.exportFormat === 'md-tech') {
      downloads.push({
        content: generateMarkdown(data),
        filename: `${baseName}.md`,
        mime: 'text/markdown',
      });
    }
    if (opts.exportFormat === 'json' || opts.exportFormat === 'both') {
      downloads.push({
        content: generateJSON(data, { pretty: true }),
        filename: `${baseName}.json`,
        mime: 'application/json',
      });
      downloads.push({
        content: generateSummaryJSON(data),
        filename: `${baseName}.summary.json`,
        mime: 'application/json',
      });
    }

    // Bonus exports
    if (data.css?.variables && Object.keys(data.css.variables).length) {
      downloads.push({
        content: generateDesignTokensJSON(data),
        filename: `${baseName}.tokens.json`,
        mime: 'application/json',
      });
    }
    downloads.push({
      content: generateCSSExport(data),
      filename: `${baseName}.extracted.css`,
      mime: 'text/css',
    });
    if (data.tailwind?.likely) {
      downloads.push({
        content: generateTailwindConfig(data),
        filename: `${baseName}.tailwind.config.js`,
        mime: 'application/javascript',
      });
    }

    // ─── 7. AI-Enhanced DESIGN.md (if enabled) ───
    if (opts.aiEnhance) {
      const config = await loadLLMConfig();
      if (config.apiKey) {
        statusEl.textContent = '🤖 Generating AI-Enhanced DESIGN.md…';
        btnText.textContent = 'AI Processing…';

        try {
          const llmResult = await callLLM(config, data, (msg) => {
            statusEl.textContent = `🤖 ${msg}`;
          });

          downloads.push({
            content: llmResult.markdown,
            filename: `${baseName}.DESIGN.md`,
            mime: 'text/markdown',
          });

          const usage = llmResult.usage;
          if (usage) {
            console.log(`LLM usage — prompt: ${usage.prompt_tokens}, completion: ${usage.completion_tokens}, total: ${usage.total_tokens}, model: ${llmResult.model}`);
          }
        } catch (llmErr) {
          console.error('LLM error:', llmErr);
          statusEl.textContent = `⚠️ AI generation failed: ${llmErr.message}. Other files still downloading.`;
          await sleep(2000);
        }
      }
    }

    // Trigger downloads
    for (const dl of downloads) {
      await downloadFile(dl.content, dl.filename, dl.mime);
    }

    if (data.screenshot) {
      const a = document.createElement('a');
      a.href = data.screenshot;
      a.download = `${baseName}.png`;
      a.click();
    }

    statusEl.textContent = `✅ Complete — ${downloads.length} file${
      downloads.length > 1 ? 's' : ''
    } downloaded.`;
  } catch (err) {
    statusEl.textContent = '❌ ' + err.message;
    console.error(err);
  } finally {
    setBusy(false);
  }
});

// ─────────────────────────────────────────────────────────
// PAGE-CONTEXT ORCHESTRATOR
// (Runs inside the target page; calls all __DDNA_* extractors)
// ─────────────────────────────────────────────────────────
async function orchestrateExtraction(opts) {
  const result = {
    meta: {
      url: location.href,
      title: document.title,
      timestamp: new Date().toISOString(),
      viewport: {
        width: innerWidth,
        height: innerHeight,
        dpr: devicePixelRatio,
        scrollHeight: document.documentElement.scrollHeight,
        scrollWidth: document.documentElement.scrollWidth,
      },
      userAgent: navigator.userAgent,
      doctype: document.doctype?.name || '',
      readyState: document.readyState,
    },
  };

  const tasks = [];

  if (opts.css && window.__DDNA_extractCSS) {
    tasks.push(window.__DDNA_extractCSS().then((r) => (result.css = r)));
  }

  if (opts.typo && window.__DDNA_extractTypoScale) {
    result.typography = window.__DDNA_extractTypoScale();
  }

  if (opts.layout && window.__DDNA_extractLayout) {
    result.layout = window.__DDNA_extractLayout({
      shadow: opts.shadow,
      fingerprint: opts.fingerprint,
    });
  }

  if (opts.hover && window.__DDNA_extractInteractions) {
    result.interactions = window.__DDNA_extractInteractions();
  }

  if (opts.svg && window.__DDNA_extractSVG) {
    result.svg = window.__DDNA_extractSVG();
  }

  if (window.__DDNA_extractAssets) {
    result.assets = window.__DDNA_extractAssets();
  }

  if (window.__DDNA_extractMeta) {
    result.metaTags = window.__DDNA_extractMeta();
  }

  if (window.__DDNA_extractA11y) {
    result.a11y = window.__DDNA_extractA11y();
  }

  if (window.__DDNA_extractPerformance) {
    result.performance = window.__DDNA_extractPerformance();
  }

  if (opts.tailwind && window.__DDNA_extractTailwind) {
    result.tailwind = window.__DDNA_extractTailwind();
  }

  if (opts.shadow && window.__DDNA_findShadowHosts) {
    result.shadowHosts = window.__DDNA_findShadowHosts();
  }

  if (opts.iframe && window.__DDNA_extractIframes) {
    result.iframes = window.__DDNA_extractIframes();
  }

  if (window.__DDNA_extractScripts) {
    tasks.push(
      window
        .__DDNA_extractScripts({ external: opts.external, maxFiles: 30 })
        .then((r) => (result.scriptIntel = r))
    );
  }

  // Wait for async extractors
  await Promise.all(tasks);

  // Pull runtime data captured by injector
  result.runtime = window.__DDNA || {};

  return result;
}