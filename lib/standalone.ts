/** True in the single-file preview, where there is no server: replies then come from the demo model in the page, and nobody signs in. */
export const STANDALONE = typeof __STANDALONE__ !== "undefined" && __STANDALONE__
