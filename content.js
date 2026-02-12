(() => {
  const DEFAULT_THEME = {
    bgColor: "#15202b",
    textColor: "#e7e9ea",
    borderColor: "#38444d"
  };
  const STORAGE_KEYS = {
    bgColor: "bgColor",
    textColor: "textColor",
    borderColor: "borderColor"
  };
  const STYLE_ID = "x-custom-theme-style";
  const DARK_BACKGROUND_MAX_CHANNEL = 26;
  const DARK_BACKGROUND_MIN_ALPHA = 0.55;
  const DARK_BORDER_MAX_CHANNEL = 90;
  const DARK_BORDER_MIN_ALPHA = 0.35;
  const SKIP_TAGS = new Set(["IMG", "VIDEO", "CANVAS", "SVG", "PATH", "SOURCE"]);
  const queuedRoots = new Set();

  let activeTheme = { ...DEFAULT_THEME };
  let rafToken = 0;
  let observer = null;

  function isHexColor(value) {
    if (typeof value !== "string") {
      return false;
    }
    if (value.length !== 7) {
      return false;
    }
    if (value[0] !== "#") {
      return false;
    }
    const hex = "0123456789abcdefABCDEF";
    for (let index = 1; index < value.length; index += 1) {
      if (!hex.includes(value[index])) {
        return false;
      }
    }
    return true;
  }

  function normalizeColor(value, fallback) {
    if (!isHexColor(value)) {
      return fallback;
    }
    return value.toLowerCase();
  }

  function normalizeComputedColor(value) {
    if (typeof value !== "string") {
      return "";
    }
    const source = value.toLowerCase();
    let result = "";
    for (const char of source) {
      if (char === " " || char === "\n" || char === "\r" || char === "\t" || char === "\f") {
        continue;
      }
      result += char;
    }
    return result;
  }

  function parseColorChannels(value) {
    const normalized = normalizeComputedColor(value);
    const isRgb = normalized.startsWith("rgb(") && normalized.endsWith(")");
    const isRgba = normalized.startsWith("rgba(") && normalized.endsWith(")");
    if (!isRgb && !isRgba) {
      return null;
    }
    const values = [];
    let buffer = "";
    for (const char of normalized) {
      const isDigit = char >= "0" && char <= "9";
      if (isDigit || char === ".") {
        buffer += char;
        continue;
      }
      if (buffer.length === 0) {
        continue;
      }
      values.push(Number(buffer));
      buffer = "";
    }
    if (buffer.length > 0) {
      values.push(Number(buffer));
    }
    if (values.length < 3) {
      return null;
    }
    const [red, green, blue] = values;
    const alpha = values.length >= 4 ? values[3] : 1;
    if (!Number.isFinite(red) || !Number.isFinite(green) || !Number.isFinite(blue) || !Number.isFinite(alpha)) {
      return null;
    }
    return { red, green, blue, alpha };
  }

  function isDarkBackgroundColor(value) {
    const channels = parseColorChannels(value);
    if (!channels) {
      return false;
    }
    if (channels.alpha < DARK_BACKGROUND_MIN_ALPHA) {
      return false;
    }
    return (
      channels.red <= DARK_BACKGROUND_MAX_CHANNEL &&
      channels.green <= DARK_BACKGROUND_MAX_CHANNEL &&
      channels.blue <= DARK_BACKGROUND_MAX_CHANNEL
    );
  }

  function isDarkBorderColor(value) {
    const channels = parseColorChannels(value);
    if (!channels) {
      return false;
    }
    if (channels.alpha < DARK_BORDER_MIN_ALPHA) {
      return false;
    }
    return (
      channels.red <= DARK_BORDER_MAX_CHANNEL &&
      channels.green <= DARK_BORDER_MAX_CHANNEL &&
      channels.blue <= DARK_BORDER_MAX_CHANNEL
    );
  }

  function hasVisibleBorder(computed) {
    const top = Number.parseFloat(computed.borderTopWidth) || 0;
    const right = Number.parseFloat(computed.borderRightWidth) || 0;
    const bottom = Number.parseFloat(computed.borderBottomWidth) || 0;
    const left = Number.parseFloat(computed.borderLeftWidth) || 0;
    return top > 0 || right > 0 || bottom > 0 || left > 0;
  }

  function createThemeCss(theme) {
    const bgSelectors = [
      "html",
      "body",
      "#react-root",
      "main[role='main']",
      "header[role='banner']",
      "[role='navigation']",
      "[data-testid='TopNavBar']",
      "[data-testid='primaryColumn']",
      "[data-testid='sidebarColumn']",
      "[data-testid='DMDrawer']",
      "[data-testid='cellInnerDiv']",
      "[data-testid='tweet']",
      "[data-testid='sheetDialog']",
      "[role='dialog']",
      "[role='menu']",
      "[role='listbox']"
    ];
    const textSelectors = [
      "body",
      "main",
      "header",
      "nav",
      "section",
      "article",
      "aside",
      "p",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "li",
      "ul",
      "ol",
      "[data-testid='tweetText']"
    ];
    const actionTextSelectors = [
      "[data-testid='reply']",
      "[data-testid='retweet']",
      "[data-testid='like']",
      "[data-testid='bookmark']",
      "a[href*='/analytics']",
      "[aria-label='Share post']",
      "[aria-label='Share']"
    ];
    const borderSelectors = [
      "main[role='main']",
      "header[role='banner']",
      "[role='navigation']",
      "[data-testid='TopNavBar']",
      "[data-testid='primaryColumn']",
      "[data-testid='sidebarColumn']",
      "[data-testid='DMDrawer']",
      "[data-testid='cellInnerDiv']",
      "[data-testid='tweet']",
      "[role='dialog']",
      "[role='menu']",
      "[role='listbox']",
      "article",
      "section",
      "aside",
      "button",
      "input",
      "textarea",
      "select",
      "hr"
    ];
    const bgRules = bgSelectors
      .map((selector) => `${selector} { background-color: ${theme.bgColor} !important; }`)
      .join("\n");
    const textRules = textSelectors
      .map((selector) => `${selector} { color: ${theme.textColor} !important; }`)
      .join("\n");
    const actionTextRules = actionTextSelectors
      .map((selector) => `${selector}, ${selector} * { color: ${theme.textColor} !important; }`)
      .join("\n");
    const borderRules = borderSelectors
      .map((selector) => `${selector} { border-color: ${theme.borderColor} !important; }`)
      .join("\n");

    return `${bgRules}\n${textRules}\n${actionTextRules}\n${borderRules}\n`;
  }

  function ensureStyleTag() {
    let styleTag = document.getElementById(STYLE_ID);
    if (styleTag) {
      return styleTag;
    }
    styleTag = document.createElement("style");
    styleTag.id = STYLE_ID;
    const parent = document.head || document.documentElement;
    parent.appendChild(styleTag);
    return styleTag;
  }

  function applyThemeCss(theme) {
    const styleTag = ensureStyleTag();
    styleTag.textContent = createThemeCss(theme);
  }

  function isElement(node) {
    return node instanceof HTMLElement;
  }

  function shouldSkipElement(element) {
    if (SKIP_TAGS.has(element.tagName)) {
      return true;
    }
    if (element.isContentEditable) {
      return true;
    }
    return false;
  }

  function applyInlineBackground(element) {
    if (!isElement(element)) {
      return;
    }
    if (shouldSkipElement(element)) {
      return;
    }
    const computed = window.getComputedStyle(element);
    if (!isDarkBackgroundColor(computed.backgroundColor)) {
      return;
    }
    if (computed.backgroundImage && computed.backgroundImage !== "none") {
      return;
    }
    element.style.setProperty("background-color", activeTheme.bgColor, "important");
  }

  function applyInlineBorderColor(element) {
    if (!isElement(element)) {
      return;
    }
    if (shouldSkipElement(element)) {
      return;
    }
    const computed = window.getComputedStyle(element);
    if (!hasVisibleBorder(computed)) {
      return;
    }
    const borderColors = [
      computed.borderTopColor,
      computed.borderRightColor,
      computed.borderBottomColor,
      computed.borderLeftColor
    ];
    const shouldApply = borderColors.some((borderColor) => isDarkBorderColor(borderColor));
    if (!shouldApply) {
      return;
    }
    element.style.setProperty("border-color", activeTheme.borderColor, "important");
  }

  function processRoot(root) {
    if (!isElement(root)) {
      return;
    }
    applyInlineBackground(root);
    applyInlineBorderColor(root);
    const descendants = root.querySelectorAll("*");
    for (const descendant of descendants) {
      applyInlineBackground(descendant);
      applyInlineBorderColor(descendant);
    }
  }

  function flushQueuedRoots() {
    rafToken = 0;
    if (queuedRoots.size === 0) {
      return;
    }
    const roots = [...queuedRoots];
    queuedRoots.clear();
    for (const root of roots) {
      processRoot(root);
    }
  }

  function queueRoot(root) {
    if (!isElement(root)) {
      return;
    }
    queuedRoots.add(root);
    if (rafToken) {
      return;
    }
    rafToken = window.requestAnimationFrame(flushQueuedRoots);
  }

  function applyTheme(theme) {
    activeTheme = {
      bgColor: normalizeColor(theme.bgColor, DEFAULT_THEME.bgColor),
      textColor: normalizeColor(theme.textColor, DEFAULT_THEME.textColor),
      borderColor: normalizeColor(theme.borderColor, DEFAULT_THEME.borderColor)
    };
    applyThemeCss(activeTheme);
    const root = document.querySelector("#react-root") || document.body;
    if (!root) {
      return;
    }
    queueRoot(root);
  }

  function getThemeFromStorage() {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get([STORAGE_KEYS.bgColor, STORAGE_KEYS.textColor, STORAGE_KEYS.borderColor], (result) => {
        const storageError = chrome.runtime.lastError;
        if (storageError) {
          reject(new Error(storageError.message));
          return;
        }
        resolve({
          bgColor: normalizeColor(result[STORAGE_KEYS.bgColor], DEFAULT_THEME.bgColor),
          textColor: normalizeColor(result[STORAGE_KEYS.textColor], DEFAULT_THEME.textColor),
          borderColor: normalizeColor(result[STORAGE_KEYS.borderColor], DEFAULT_THEME.borderColor)
        });
      });
    });
  }

  function startObserver() {
    if (observer) {
      observer.disconnect();
    }
    const root = document.querySelector("#react-root") || document.body;
    if (!root) {
      return;
    }
    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== "childList") {
          continue;
        }
        for (const node of mutation.addedNodes) {
          if (!isElement(node)) {
            continue;
          }
          queueRoot(node);
        }
      }
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  function listenForStorageChanges() {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync") {
        return;
      }
      const nextTheme = { ...activeTheme };
      let changed = false;
      if (changes[STORAGE_KEYS.bgColor]) {
        nextTheme.bgColor = normalizeColor(changes[STORAGE_KEYS.bgColor].newValue, DEFAULT_THEME.bgColor);
        changed = true;
      }
      if (changes[STORAGE_KEYS.textColor]) {
        nextTheme.textColor = normalizeColor(changes[STORAGE_KEYS.textColor].newValue, DEFAULT_THEME.textColor);
        changed = true;
      }
      if (changes[STORAGE_KEYS.borderColor]) {
        nextTheme.borderColor = normalizeColor(changes[STORAGE_KEYS.borderColor].newValue, DEFAULT_THEME.borderColor);
        changed = true;
      }
      if (!changed) {
        return;
      }
      applyTheme(nextTheme);
    });
  }

  async function init() {
    try {
      const theme = await getThemeFromStorage();
      applyTheme(theme);
    } catch (error) {
      console.error("Failed to load saved theme values.", error);
      applyTheme(DEFAULT_THEME);
    }
    startObserver();
    listenForStorageChanges();
  }

  void init();
})();
