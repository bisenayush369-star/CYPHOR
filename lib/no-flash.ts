import { DEFAULT_PALETTE, PALETTE_IDS } from "./scene/palettes"

/**
 * Runs in <head> before the first paint. It copies the saved appearance onto <html>, so a dark-theme visitor never sees
 * a flash of the light theme while the app loads:
 *
 *   theme, reply font, effects   as saved
 *   data-palette                 the colour theme for THIS page load. A fixed choice is used as it is. "rotate" picks a
 *                                random theme that is not the one shown last time, so every refresh looks different.
 *   data-scene                   "city" (the moving city behind the chat) or "off"
 *
 * The appearance is kept once per device under "cyphor:appearance" (lib/store.ts), because each account has its own
 * saved copy and this runs before anyone has signed in. Cyphor is dark unless you chose otherwise.
 * Plain ES5 on purpose: it must work before any bundle does. tests/unit/no-flash.test.ts runs it against a fake page.
 */
export const PALETTE_LAST_KEY = "cyphor:palette-last"

export const NO_FLASH_SCRIPT = `
;(function () {
  try {
    var st = {}
    try { st = JSON.parse(localStorage.getItem("cyphor:appearance") || "null") || {} } catch (e) {}
    var root = document.documentElement
    var pref = st.theme || "dark"
    var dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
    root.classList.toggle("dark", dark)
    root.dataset.theme = dark ? "dark" : "light"
    root.style.colorScheme = dark ? "dark" : "light"
    root.dataset.font = st.chatFont || "sans"
    root.dataset.effects = st.effects || "full"
    root.dataset.scene = st.scene === "off" ? "off" : "city"

    var IDS = ${JSON.stringify(PALETTE_IDS)}
    var id = ${JSON.stringify(DEFAULT_PALETTE)}
    if (IDS.indexOf(st.palette) !== -1) {
      id = st.palette
    } else if (st.palette === "rotate") {
      var last = null
      try { last = localStorage.getItem(${JSON.stringify(PALETTE_LAST_KEY)}) } catch (e) {}
      var pool = IDS.filter(function (x) { return x !== last })
      id = pool[Math.min(pool.length - 1, Math.floor(Math.random() * pool.length))]
    }
    root.dataset.palette = id
    try { localStorage.setItem(${JSON.stringify(PALETTE_LAST_KEY)}, id) } catch (e) {}
  } catch (e) {}
})()
`.trim()
