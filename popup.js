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

  let currentTheme = { ...DEFAULT_THEME };

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
    const chars = "0123456789abcdefABCDEF";
    for (let index = 1; index < value.length; index += 1) {
      if (!chars.includes(value[index])) {
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

  function getStorageTheme() {
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

  function setStorageTheme(theme) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set(theme, () => {
        const storageError = chrome.runtime.lastError;
        if (storageError) {
          reject(new Error(storageError.message));
          return;
        }
        resolve();
      });
    });
  }

  function updatePreview(previewCard, theme) {
    previewCard.style.backgroundColor = theme.bgColor;
    previewCard.style.color = theme.textColor;
    previewCard.style.borderColor = theme.borderColor;
  }

  function setStatus(statusElement, message, isError) {
    statusElement.textContent = message;
    if (isError) {
      statusElement.classList.add("error");
      return;
    }
    statusElement.classList.remove("error");
  }

  async function saveTheme(statusElement, previewCard, partialTheme) {
    const nextTheme = {
      bgColor: normalizeColor(partialTheme.bgColor ?? currentTheme.bgColor, currentTheme.bgColor),
      textColor: normalizeColor(partialTheme.textColor ?? currentTheme.textColor, currentTheme.textColor),
      borderColor: normalizeColor(partialTheme.borderColor ?? currentTheme.borderColor, currentTheme.borderColor)
    };
    currentTheme = nextTheme;
    updatePreview(previewCard, currentTheme);
    try {
      await setStorageTheme(currentTheme);
      setStatus(statusElement, "Saved", false);
    } catch (error) {
      setStatus(statusElement, "Failed to save theme values", true);
      console.error("Could not save theme values.", error);
    }
  }

  async function init() {
    const bgInput = document.getElementById("bgColor");
    const textInput = document.getElementById("textColor");
    const borderInput = document.getElementById("borderColor");
    const resetButton = document.getElementById("resetButton");
    const previewCard = document.getElementById("previewCard");
    const statusElement = document.getElementById("status");

    if (!bgInput || !textInput || !borderInput || !resetButton || !previewCard || !statusElement) {
      throw new Error("Popup elements were not found.");
    }

    try {
      currentTheme = await getStorageTheme();
    } catch (error) {
      currentTheme = { ...DEFAULT_THEME };
      setStatus(statusElement, "Using default colors", true);
      console.error("Could not read saved theme values.", error);
    }

    bgInput.value = currentTheme.bgColor;
    textInput.value = currentTheme.textColor;
    borderInput.value = currentTheme.borderColor;
    updatePreview(previewCard, currentTheme);

    bgInput.addEventListener("input", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }
      await saveTheme(statusElement, previewCard, { bgColor: target.value });
    });

    textInput.addEventListener("input", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }
      await saveTheme(statusElement, previewCard, { textColor: target.value });
    });

    borderInput.addEventListener("input", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }
      await saveTheme(statusElement, previewCard, { borderColor: target.value });
    });

    resetButton.addEventListener("click", async () => {
      bgInput.value = DEFAULT_THEME.bgColor;
      textInput.value = DEFAULT_THEME.textColor;
      borderInput.value = DEFAULT_THEME.borderColor;
      await saveTheme(statusElement, previewCard, { ...DEFAULT_THEME });
      setStatus(statusElement, "Reset to Dim defaults", false);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      void init().catch((error) => {
        console.error("Popup initialization failed.", error);
      });
    });
  } else {
    void init().catch((error) => {
      console.error("Popup initialization failed.", error);
    });
  }
})();
