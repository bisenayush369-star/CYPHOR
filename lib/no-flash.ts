/**
 * Runs in <head> before the first paint. It copies the saved appearance (theme, reply font, effects)
 * onto <html>, so a dark-theme visitor never sees a flash of the light theme while the app loads.
 * Plain ES5 on purpose: it must work before any bundle does.
 */
export const NO_FLASH_SCRIPT = `
;(function () {
  try {
    var raw = localStorage.getItem("cyphor:v1")
    var st = (raw && JSON.parse(raw).state && JSON.parse(raw).state.settings) || {}
    var root = document.documentElement
    var pref = st.theme || "system"
    var dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
    root.classList.toggle("dark", dark)
    root.dataset.theme = dark ? "dark" : "light"
    root.style.colorScheme = dark ? "dark" : "light"
    root.dataset.font = st.chatFont || "serif"
    root.dataset.effects = st.effects || "full"
  } catch (e) {}
})()
`.trim()
