# Twitter Background Thing

Twitter (now X) removed the Dim theme. This extension brings it back or lets you set your own colors.

You can customize three things:

- **Background color** — the main surfaces: timeline, sidebar, nav
- **Text color** — timeline text, navigation, action buttons
- **Border color** — separators, cards, panel borders

The defaults are the original Dim theme values. There's a reset button if you want to get back there.

> **Note:** This extension is not perfect. Twitter's UI is dynamic and some elements may not pick up the theme immediately or at all. If you just want Dim back (plus a lot of other features), [Control Panel for Twitter](https://chrome.google.com/webstore/detail/control-panel-for-twitter/kpmjjdhbcfebfjgdnpjagcndoelnidfj) is a more complete solution, although the chat window remains black for me.

## Installation

This extension isn't on the Chrome store, so you'll need to load it manually. I don't plan on submitting it to the Chrome store.

1. Clone or download this repository
2. Go to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked** and select the project folder

The extension icon will appear in your toolbar. Click it to open the color picker.

## How it works

The extension injects a stylesheet into Twitter and walks the DOM to override inline background and border colors. A MutationObserver keeps up with new content as you scroll. Your color choices are saved with `chrome.storage.sync`, so they follow you across Chrome sessions and devices.

## Permissions

- `storage` — to save your color preferences
