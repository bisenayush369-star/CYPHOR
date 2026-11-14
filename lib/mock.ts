import type { Attachment } from "./types"
import { formatBytes, sleep } from "./utils"

/**
 * The built-in demo model. It does not reason: it matches the prompt against a few scripted
 * examples so every part of the interface (streaming, thinking, artifacts, code, tables,
 * checklists) can be tried without an API key. Replies say so, and Settings > Model connects
 * a real OpenAI-compatible endpoint.
 */

export interface MockArgs {
  prompt: string
  attachments: Attachment[]
  thinking: boolean
  /** Web search or research is switched on, which the demo model cannot do. */
  noAccess: boolean
  signal: AbortSignal
  /** 1 is normal speed. Automated tests pass more so they do not wait for the typing effect. */
  speed?: number
}

const F = "```"
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

interface Script {
  thinking: string
  body: string
}

/* ------------------------------------------------------------------ */
/* Artifacts                                                           */
/* ------------------------------------------------------------------ */

const CIPHER_TOOL_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Caesar workbench</title>
<style>
  :root { --ink:#1a211f; --paper:#f5f3ee; --teal:#166657; --brass:#b58a3c; --line:#d9d4c6; --card:#fbfaf7; }
  * { box-sizing: border-box; }
  body { margin:0; padding:24px 16px 40px; background:var(--paper); color:var(--ink); font:16px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; }
  main { max-width:560px; margin:0 auto; }
  h1 { font:600 26px/1.2 Georgia,"Times New Roman",serif; margin:0 0 4px; letter-spacing:-0.01em; }
  .sub { margin:0 0 20px; color:#5b635e; }
  svg { display:block; width:min(280px,76vw); margin:0 auto 20px; overflow:visible; }
  .inner { transition:transform .28s cubic-bezier(.34,1.56,.64,1); transform-origin:100px 100px; }
  .panel { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:16px; }
  label { display:block; font-weight:600; font-size:14px; margin:0 0 6px; }
  textarea { width:100%; min-height:88px; padding:10px 12px; border:1px solid var(--line); border-radius:10px; font:inherit; background:#fff; color:inherit; resize:vertical; }
  textarea:focus-visible, button:focus-visible, input:focus-visible { outline:2px solid var(--teal); outline-offset:2px; }
  .row { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:16px 0 6px; flex-wrap:wrap; }
  output { display:block; min-height:88px; padding:10px 12px; border-radius:10px; background:#ebe7dc; font:15px/1.5 ui-monospace,Menlo,Consolas,monospace; overflow-wrap:anywhere; white-space:pre-wrap; }
  input[type=range] { width:100%; accent-color:var(--teal); }
  .seg { display:inline-flex; border:1px solid var(--line); border-radius:999px; overflow:hidden; background:#fff; }
  .seg button { border:0; padding:7px 14px; background:transparent; font:inherit; font-size:14px; color:inherit; cursor:pointer; }
  .seg button[aria-pressed="true"] { background:var(--teal); color:#fff; }
  .shift { font:600 14px ui-monospace,Menlo,monospace; color:var(--teal); }
  .copy { border:1px solid var(--line); background:#fff; border-radius:999px; padding:6px 14px; font:inherit; font-size:14px; cursor:pointer; }
  .copy:active { transform:scale(.96); }
  @media (prefers-reduced-motion: reduce) { .inner { transition:none; } }
</style>
</head>
<body>
<main>
  <h1>Caesar workbench</h1>
  <p class="sub">Shift every letter by a fixed amount. Move the slider and watch the inner ring turn.</p>
  <svg id="disk" viewBox="0 0 200 200" role="img" aria-label="Cipher disk showing the current shift"></svg>
  <div class="panel">
    <label for="msg">Message</label>
    <textarea id="msg" spellcheck="false">Meet me at the library at noon</textarea>
    <div class="row">
      <label for="shift" style="margin:0">Shift <span class="shift" id="shiftVal">3</span></label>
      <div class="seg" role="group" aria-label="Direction">
        <button id="enc" aria-pressed="true">Encode</button>
        <button id="dec" aria-pressed="false">Decode</button>
      </div>
    </div>
    <input id="shift" type="range" min="0" max="25" value="3" aria-label="Shift amount">
    <div class="row"><label style="margin:0">Result</label><button class="copy" id="copy">Copy</button></div>
    <output id="out" aria-live="polite"></output>
  </div>
</main>
<script>
(function () {
  var A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ", NS = "http://www.w3.org/2000/svg";
  var msg = document.getElementById("msg"), sh = document.getElementById("shift"), out = document.getElementById("out");
  var sv = document.getElementById("shiftVal"), disk = document.getElementById("disk");
  var enc = document.getElementById("enc"), dec = document.getElementById("dec"), copy = document.getElementById("copy");
  var mode = "enc", inner;

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function build() {
    el("circle", { cx: 100, cy: 100, r: 97, fill: "#fbfaf7", stroke: "#1a211f", "stroke-width": 1.5 }, disk);
    for (var i = 0; i < 26; i++) {
      var t = el("text", { x: 100, y: 21, "text-anchor": "middle", "font-size": 10, "font-family": "ui-monospace,Menlo,monospace", fill: "#1a211f", transform: "rotate(" + (i * 360 / 26) + " 100 100)" }, disk);
      t.textContent = A[i];
    }
    inner = el("g", { "class": "inner" }, disk);
    el("circle", { cx: 100, cy: 100, r: 72, fill: "#ebe7dc", stroke: "#d9d4c6" }, inner);
    for (var j = 0; j < 26; j++) {
      var u = el("text", { x: 100, y: 40, "text-anchor": "middle", "font-size": 9.5, "font-weight": 600, "font-family": "ui-monospace,Menlo,monospace", fill: "#166657", transform: "rotate(" + (j * 360 / 26) + " 100 100)" }, inner);
      u.textContent = A[j];
    }
    el("circle", { cx: 100, cy: 100, r: 44, fill: "#fbfaf7", stroke: "#d9d4c6" }, inner);
    el("path", { d: "M100 3 L95 -5 L105 -5 Z", fill: "#b58a3c" }, disk);
    el("circle", { cx: 100, cy: 100, r: 5, fill: "#166657" }, disk);
  }

  function shiftChar(ch, s) {
    var c = ch.charCodeAt(0);
    if (c >= 65 && c <= 90) return String.fromCharCode((c - 65 + s) % 26 + 65);
    if (c >= 97 && c <= 122) return String.fromCharCode((c - 97 + s) % 26 + 97);
    return ch;
  }

  function run() {
    var k = +sh.value;
    sv.textContent = k;
    var s = mode === "enc" ? k : (26 - k) % 26;
    inner.style.transform = "rotate(" + (-k * 360 / 26) + "deg)";
    out.textContent = msg.value.split("").map(function (ch) { return shiftChar(ch, s); }).join("");
  }

  function setMode(m) {
    mode = m;
    enc.setAttribute("aria-pressed", m === "enc");
    dec.setAttribute("aria-pressed", m === "dec");
    run();
  }

  copy.addEventListener("click", function () {
    function done(ok) { copy.textContent = ok ? "Copied" : "Press Ctrl+C"; setTimeout(function () { copy.textContent = "Copy"; }, 1400); }
    function fallback() {
      var r = document.createRange(); r.selectNodeContents(out);
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      var ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
      done(ok);
    }
    try { navigator.clipboard.writeText(out.textContent).then(function () { done(true); }, fallback); } catch (e) { fallback(); }
  });

  msg.addEventListener("input", run);
  sh.addEventListener("input", run);
  enc.addEventListener("click", function () { setMode("enc"); });
  dec.addEventListener("click", function () { setMode("dec"); });
  build();
  run();
})();
</script>
</body>
</html>`

const LANDING_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ember &amp; Oak</title>
<style>
  :root { --bark:#1d1511; --cream:#f3e9db; --ember:#d9822b; --smoke:#9a8878; --line:rgba(243,233,219,.16); }
  * { box-sizing: border-box; margin: 0; }
  html { scroll-behavior: smooth; }
  body { background: var(--bark); color: var(--cream); font: 17px/1.55 Georgia, "Times New Roman", serif; }
  a { color: inherit; }
  header { display: flex; justify-content: space-between; align-items: center; padding: 20px clamp(18px,5vw,56px); border-bottom: 1px solid var(--line); }
  .logo { font-size: 20px; letter-spacing: .02em; }
  nav a { margin-left: 22px; text-decoration: none; font: 15px system-ui, sans-serif; color: var(--smoke); }
  nav a:hover { color: var(--cream); }
  .hero { display: grid; grid-template-columns: 1.25fr 1fr; gap: clamp(24px,5vw,72px); align-items: end; padding: clamp(40px,9vw,110px) clamp(18px,5vw,56px) clamp(32px,6vw,72px); }
  h1 { font-size: clamp(40px,7.2vw,92px); line-height: .98; font-weight: 400; letter-spacing: -.025em; }
  .hero p { max-width: 34ch; color: #cdbfae; margin-top: 20px; }
  .btn { display: inline-block; margin-top: 28px; background: var(--ember); color: #1d1511; padding: 13px 22px; border-radius: 999px; text-decoration: none; font: 600 15px system-ui, sans-serif; }
  .btn:focus-visible { outline: 2px solid var(--cream); outline-offset: 3px; }
  .card { border: 1px solid var(--line); border-radius: 18px; padding: 22px; background: linear-gradient(160deg, rgba(217,130,43,.16), transparent 62%); }
  .card small { font: 13px system-ui, sans-serif; color: var(--smoke); }
  .card h2 { font-size: 28px; font-weight: 400; margin: 6px 0 12px; }
  .card dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 16px; font: 14px system-ui, sans-serif; color: #cdbfae; }
  .card dt { color: var(--smoke); }
  .menu { padding: 0 clamp(18px,5vw,56px) 64px; }
  .menu h3 { font: 600 14px system-ui, sans-serif; color: var(--smoke); margin-bottom: 6px; }
  .row { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 18px 0; border-top: 1px solid var(--line); }
  .row b { font-weight: 400; font-size: 22px; }
  .row span { display: block; color: #cdbfae; font: 15px system-ui, sans-serif; }
  .row em { font: normal 15px system-ui, sans-serif; white-space: nowrap; }
  footer { padding: 28px clamp(18px,5vw,56px); border-top: 1px solid var(--line); font: 14px system-ui, sans-serif; color: var(--smoke); display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  @media (max-width: 720px) { .hero { grid-template-columns: 1fr; } nav { display: none; } }
</style>
</head>
<body>
<header>
  <div class="logo">Ember &amp; Oak</div>
  <nav><a href="#beans">Beans</a><a href="#visit">Visit</a></nav>
</header>
<section class="hero">
  <div>
    <h1>Roasted on Tuesday. Gone by Friday.</h1>
    <p>Small batches from a single drum, shipped the day they cool. No warehouse, no stale bags.</p>
    <a class="btn" href="#beans">See this week's beans</a>
  </div>
  <aside class="card">
    <small>This week's roast</small>
    <h2>Huila Pink Bourbon</h2>
    <dl>
      <dt>Notes</dt><dd>Red plum, cacao nib, orange peel</dd>
      <dt>Roast</dt><dd>Medium, 11 min 40 s</dd>
      <dt>Altitude</dt><dd>1,850 m</dd>
    </dl>
  </aside>
</section>
<section class="menu" id="beans">
  <h3>On the shelf</h3>
  <div class="row"><div><b>Huila Pink Bourbon</b><span>Colombia, washed</span></div><em>&#8377; 780 / 250 g</em></div>
  <div class="row"><div><b>Yirgacheffe Kochere</b><span>Ethiopia, natural</span></div><em>&#8377; 820 / 250 g</em></div>
  <div class="row"><div><b>Monsoon Malabar</b><span>India, monsooned</span></div><em>&#8377; 640 / 250 g</em></div>
</section>
<footer id="visit"><span>Roastery open Wed&ndash;Sun, 8 am to 4 pm</span><span>hello@emberandoak.example</span></footer>
</body>
</html>`

function cipherBadgeSvg() {
  let outer = ""
  let ticks = ""
  let inner = ""
  for (let i = 0; i < 26; i++) {
    const a = ((i * 360) / 26).toFixed(3)
    outer += `<text x="120" y="38" transform="rotate(${a} 120 120)">${ALPHABET[i]}</text>`
    inner += `<text x="120" y="64" transform="rotate(${a} 120 120)">${ALPHABET[(i + 5) % 26]}</text>`
    const edge = ((i * 360) / 26 + 360 / 52).toFixed(3)
    ticks += `<line x1="120" y1="44" x2="120" y2="${i % 2 ? 49 : 52}" transform="rotate(${edge} 120 120)"/>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240" role="img" aria-labelledby="t">
  <title id="t">Cipher wheel badge</title>
  <circle cx="120" cy="120" r="116" fill="#12302b"/>
  <circle cx="120" cy="120" r="110" fill="none" stroke="#d2a85a" stroke-width="1.5"/>
  <g font-family="ui-monospace,Menlo,Consolas,monospace" font-size="12" font-weight="600" fill="#f5f3ee" text-anchor="middle">${outer}</g>
  <circle cx="120" cy="120" r="76" fill="#166657"/>
  <g stroke="#f5f3ee" stroke-opacity=".65" stroke-width="1.3">${ticks}</g>
  <g font-family="ui-monospace,Menlo,Consolas,monospace" font-size="9" font-weight="600" fill="#12302b" text-anchor="middle">${inner}</g>
  <circle cx="120" cy="120" r="38" fill="#12302b" stroke="#d2a85a" stroke-width="1.5"/>
  <text x="120" y="130" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="30" fill="#f5f3ee">C</text>
  <path d="M120 6 L114 -2 L126 -2 Z" transform="translate(0 4)" fill="#d2a85a"/>
</svg>`
}

function artifact(id: string, type: string, title: string, content: string, language?: string) {
  const lang = language ? ` language="${language}"` : ""
  return `<artifact identifier="${id}" type="${type}"${lang} title="${title}">\n${content}\n</artifact>`
}

/* ------------------------------------------------------------------ */
/* Scripts                                                             */
/* ------------------------------------------------------------------ */

const SCRIPTS: Record<string, Script> = {
  hello: {
    thinking: "A greeting. Keep it short, say plainly what this build is, and point to prompts that show off the interface.",
    body: `Hello. I'm the built-in demo model, so my answers are scripted examples rather than real reasoning. Everything around me is live though: streaming, thinking, artifacts, branching, projects and settings.

Try one of these:

- **Build a small Caesar cipher tool I can try in the browser** opens an interactive artifact beside the chat
- **Compare Caesar and Vigenère in a table** shows Markdown tables
- **Write a TypeScript debounce function** shows code blocks with a copy button

To connect your own model, open **Settings → Model**.`,
  },

  cipherTool: {
    thinking:
      "A Caesar cipher shifts each letter by a fixed amount. A useful demo needs a message box, a shift control, a result that updates live, and a way to decode. A rotating ring makes the shift visible. One self-contained file, no dependencies, and it has to work at phone width.",
    body: `Here's a small Caesar workbench. Move the slider and the inner ring turns, so you can see what the shift does before you read the result.

${artifact("caesar-workbench", "html", "Caesar workbench", CIPHER_TOOL_HTML)}

It's one HTML file with no dependencies. **Encode** shifts letters forward by the slider value and **Decode** shifts them back. Anything that isn't a letter passes through unchanged. Ask me to add a brute-force view that lists all 26 shifts and I'll revise the same artifact.`,
  },

  landing: {
    thinking:
      "A coffee roaster. The page should open with something specific to roasting, not a generic hero: the weekly roast cycle. Dark roasted-bean palette with one warm accent, a serif for the headline, a price list instead of cards.",
    body: `Here's a first pass for a small coffee roaster. It leads with the weekly roast cycle, since fresh roasting is the thing that sets a roaster apart, and lists beans as a plain price list instead of a grid of cards.

${artifact("ember-and-oak", "html", "Ember & Oak landing page", LANDING_HTML)}

The page is responsive: the hero stacks below 720 px. Tell me the real roaster's name, location and beans and I'll swap the placeholder copy.`,
  },

  svg: {
    thinking: "An SVG badge with a cipher wheel: outer alphabet ring, an inner ring offset by five, tick marks between letters, a centre monogram. Generate the letter positions with rotations so they sit evenly on the circle.",
    body: `Here's a cipher wheel badge. The inner alphabet is offset by five letters, so A on the outer ring sits over F on the inner one.

${artifact("cipher-wheel-badge", "svg", "Cipher wheel badge", cipherBadgeSvg())}

It's plain SVG, so it scales to any size and you can download it from the panel. I can make a version in one colour for stamping or embossing.`,
  },

  debounce: {
    thinking: "Debounce: delay a call until input has been quiet for a while. Needs typed arguments, a cancel method, and a note about trailing versus leading edge.",
    body: `A debounce delays a function until calls have stopped arriving for a set time. It's what you want for search-as-you-type or window resize handlers.

${F}ts
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  wait = 250
) {
  let timer: ReturnType<typeof setTimeout> | undefined

  const debounced = (...args: A) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), wait)
  }

  debounced.cancel = () => clearTimeout(timer)
  return debounced
}
${F}

**How it works**

1. Each call clears the pending timer, so only the last call in a burst survives.
2. A new timer starts for \`wait\` milliseconds, then runs \`fn\` with that last call's arguments.
3. \`cancel()\` drops the pending call, which matters when a component unmounts.

**Usage**

${F}ts
const search = debounce((query: string) => {
  fetch(\`/api/search?q=\${encodeURIComponent(query)}\`)
}, 300)

input.addEventListener("input", (e) => search((e.target as HTMLInputElement).value))
${F}

This is the *trailing-edge* version: it fires after the quiet period. If you need the first call to fire immediately, you want a *leading-edge* option; I can add one.`,
  },

  sql: {
    thinking: "SQL joins for a beginner. Two tiny tables, the inner join first, then left join to show unmatched rows, then a compact table of the join types.",
    body: `A join combines rows from two tables where a column matches. Take two small tables:

- \`customers\`: \`id\`, \`name\`
- \`orders\`: \`id\`, \`customer_id\`, \`total\`

**Inner join** keeps only customers who have orders:

${F}sql
SELECT c.name, o.total
FROM customers AS c
INNER JOIN orders AS o ON o.customer_id = c.id;
${F}

**Left join** keeps every customer, with \`NULL\` where there is no order:

${F}sql
SELECT c.name, o.total
FROM customers AS c
LEFT JOIN orders AS o ON o.customer_id = c.id;
${F}

| Join | Keeps |
| --- | --- |
| \`INNER\` | Rows with a match in both tables |
| \`LEFT\` | All rows from the left table, matches from the right |
| \`RIGHT\` | All rows from the right table, matches from the left |
| \`FULL\` | All rows from both tables |

A handy check: after a \`LEFT JOIN\`, \`WHERE o.id IS NULL\` finds customers with no orders at all.`,
  },

  table: {
    thinking: "A comparison, so a table. Rows: key, alphabets, frequency analysis, how it is broken, strength. Keep the claims to well-established facts.",
    body: `Both are substitution ciphers, but they differ in how many alphabets they use.

| Property | Caesar | Vigenère |
| --- | --- | --- |
| **Key** | One number from 1 to 25 | A word or phrase |
| **Alphabets used** | One, shifted by the key | One per key letter, cycling |
| **Letter frequencies** | Preserved, only shifted | Flattened across the text |
| **Usual attack** | Try all 25 shifts | Find the key length, then solve each column as a Caesar |
| **Strength today** | None, it is a puzzle | Weak, but a step toward modern ciphers |

The key idea: a Vigenère cipher is a set of Caesar ciphers applied in rotation. Once an attacker finds the key length, each position is just a Caesar cipher again.

> Neither should protect real data. Use a vetted library for actual encryption.

If you'd like to see the difference, ask me to **build a small Caesar cipher tool** and I'll open one beside the chat.`,
  },

  explain: {
    thinking: "Public-key encryption. A physical analogy first (padlock and key), then the actual roles of the two keys, then where it is used. Mention signatures and the hybrid approach, since that is how TLS works.",
    body: `## The idea in one picture

Imagine a mailbox with a slot. Anyone can drop a letter in, but only the owner has the key to open it. In public-key encryption, the slot is the **public key** and the key to the box is the **private key**.

## How it works

1. You generate a **key pair**. The two keys are mathematically linked.
2. You publish the public key and keep the private key to yourself.
3. Someone encrypts a message with your public key.
4. Only your private key can decrypt it, so a stranger who intercepts the message learns nothing.

The linking math is easy to compute in one direction and impractical to reverse. RSA relies on how hard it is to factor a very large product of two primes.

## Reverse the roles and you get signatures

If you transform a message with your *private* key, anyone can check it with your *public* key. Only you could have produced it, which is what a **digital signature** proves.

## Where you meet it

- **HTTPS**: your browser and a site use public-key methods to agree on a shared secret
- **SSH keys**: the server holds your public key, you keep the private one
- **Signed software updates**: your device checks the publisher's signature

In practice, public-key math is slow, so systems use it only to agree on a fast **symmetric key**, then encrypt the real traffic with that. Ask me to go deeper on any step.`,
  },

  plan: {
    thinking: "A four-week launch plan for a small side project. Weekly themes, concrete checkable tasks, and a final week focused on the actual launch. Task-list formatting so it can be ticked off.",
    body: `Here's a four-week plan. Each week has one theme so you're never juggling everything at once.

## Week 1: Make it usable

- [x] Write down who it's for in one sentence
- [ ] Cut the feature list to what a first user needs
- [ ] Get one person to try it while you watch

## Week 2: Make it clear

- [ ] Rewrite the landing page headline around the problem, not the product
- [ ] Add a short demo or screenshots
- [ ] Set up a simple way to collect feedback

## Week 3: Make it findable

- [ ] Draft a launch post and two shorter versions
- [ ] Line up five people to tell, personally
- [ ] Choose where to launch and read the community rules first

## Week 4: Launch and listen

- [ ] Launch on a weekday morning
- [ ] Reply to every comment on day one
- [ ] Write down what people actually asked for

**One rule for the whole month:** if a task doesn't help someone use, understand or find the project, it waits.`,
  },

  email: {
    thinking: "A short, polite follow-up to a supplier. Specific about what is needed and by when, no blame, easy to answer in one line.",
    body: `Here's a draft you can send as is:

**Subject:** Quick check on order delivery

Hi [Name],

I'm following up on order [number], which was due on [date]. Could you let me know the current delivery date? If anything is holding it up, I'd like to plan around it.

A one-line reply is plenty. Thanks for your help.

Best,
[Your name]

**Two variations**

- *Firmer:* add "We need it by [date] to meet our own commitments. Please confirm today if that isn't possible."
- *Warmer:* open with "Hope the week is going well" and end with "Happy to jump on a quick call if that's easier."

Tell me the order details and the relationship, and I'll fill in the blanks.`,
  },

  decide: {
    thinking: "A decision between two options with no details yet. The most useful thing is a way to compare, plus the questions that usually decide it. Ask for specifics at the end.",
    body: `I don't know the offers yet, so here's a way to compare them that holds up whatever the details are.

**1. Decide what matters most.** Rank these for yourself, then check the offers against your top three:

| Factor | Question to ask |
| --- | --- |
| Growth | Will I learn something in two years that I can't learn elsewhere? |
| Money | What is the total, including bonus, equity and benefits? |
| People | Do I want to work for my likely manager? |
| Life | What does a normal week look like, including commute and hours? |
| Risk | What happens if this company is in trouble in a year? |

**2. Ask about the gaps.** Anything you can't answer from the offer is worth a question before you decide.

**3. Run the regret test.** Imagine telling a friend you took each job. Which sentence is easier to say?

Share the two offers (role, pay, location, anything that nags you) and I'll compare them directly.`,
  },

  needsInput: {
    thinking: "The request depends on text the user hasn't shared. Ask for it, and ask the one question that changes the result.",
    body: `Happy to help, but I need the text first. Paste it here and tell me one thing: **who is going to read it?** That decides the tone more than anything else.

If it helps, I can work in any of these ways:

- **Light edit:** fix errors and tighten, keep your voice
- **Rewrite:** same points, cleaner structure
- **Shorten:** cut to a target length`,
  },

  fallback: {
    thinking: "Not one of the scripted examples. Be upfront that this is a demo model, then suggest prompts that exercise the interface.",
    body: `That's outside what the demo model can answer, since its replies are scripted examples. To get real answers, connect your model in **Settings → Model**; any OpenAI-compatible endpoint works.

In the meantime, these prompts show off the interface:

- *Build a small Caesar cipher tool I can try in the browser* opens an interactive artifact
- *Draw an SVG badge with a cipher wheel* renders an SVG artifact
- *Compare Caesar and Vigenère in a table* shows Markdown tables
- *Create a four-week launch plan for a small side project* shows headings and checklists`,
  },
}

function pickScript(prompt: string): string {
  const p = prompt.toLowerCase().trim()
  if (!p) return "fallback"
  if (/^(hi|hello|hey|hola|namaste|good (morning|afternoon|evening))\b/.test(p) && p.length < 40) return "hello"
  if (/\bsvg\b|badge|\blogo\b|\bdraw\b/.test(p)) return "svg"
  if (/landing page|web ?site|web page|homepage/.test(p)) return "landing"
  if (/(build|make|create|write)\b.*\b(cipher|caesar|encrypt\w*|decod\w*)\b.*\b(tool|app|widget|calculator|demo)\b|\bcipher tool\b/.test(p)) return "cipherTool"
  if (/difference|compare|comparison|versus|\bvs\.?\b/.test(p)) return "table"
  if (/\bsql\b|\bjoins?\b/.test(p)) return "sql"
  if (/\bplan\b|roadmap|milestone|itinerary|schedule|meal plan/.test(p)) return "plan"
  if (/debounce|typescript|javascript|python|function|snippet|regex/.test(p)) return "debounce"
  if (/\bemail\b|e-mail|supplier|follow[- ]?up/.test(p)) return "email"
  if (/decide|decision|choose|between two|job offer/.test(p)) return "decide"
  if (/explain|how does|how do|what is|what are|teach|encryption|public[- ]key|analogy/.test(p)) return "explain"
  if (/tighten|paragraph|rough notes|rewrite|proofread|outline|announcement|draft|write/.test(p)) return "needsInput"
  return "fallback"
}

function attachmentNote(files: Attachment[]) {
  if (!files.length) return ""
  const lines = files.map((f) => {
    if (f.kind === "image") return `- **${f.name}** (${formatBytes(f.size)}): an image`
    if (f.kind === "text") {
      const n = (f.text ?? "").split("\n").length
      return `- **${f.name}** (${formatBytes(f.size)}): ${n} line${n === 1 ? "" : "s"} of text`
    }
    return `- **${f.name}** (${formatBytes(f.size)}): a file type Cyphor can't read yet`
  })
  return (
    `I received ${files.length === 1 ? "your attachment" : `${files.length} attachments`}:\n\n${lines.join("\n")}\n\n` +
    `The demo model can't analyze files or images, but they reach the request exactly as a real model would receive them: text files inline, images as image parts.\n\n`
  )
}

/* ------------------------------------------------------------------ */
/* Streaming                                                           */
/* ------------------------------------------------------------------ */

function* pieces(text: string): Generator<{ s: string; ms: number }> {
  let i = 0
  let inArtifact = false
  while (i < text.length) {
    if (!inArtifact && text.startsWith("<artifact", i)) inArtifact = true
    const size = inArtifact ? 30 + Math.floor(Math.random() * 40) : 2 + Math.floor(Math.random() * 5)
    let s = text.slice(i, i + size)
    if (inArtifact) {
      const close = text.indexOf("</artifact>", i)
      if (close !== -1 && close < i + size) {
        s = text.slice(i, close + "</artifact>".length)
        inArtifact = false
      }
    }
    i += s.length
    const last = s[s.length - 1]
    const ms = inArtifact ? 8 : last === "\n" ? 70 : /[.!?:]/.test(last) ? 55 : 13
    yield { s, ms }
  }
}

export async function* mockReply(a: MockArgs): AsyncGenerator<string> {
  const script = SCRIPTS[a.attachments.length && a.prompt.trim().length < 3 ? "fallback" : pickScript(a.prompt)]
  const speed = a.speed && a.speed >= 1 && a.speed <= 50 ? a.speed : 1
  const nap = (ms: number) => sleep(ms / speed, a.signal)

  if (a.thinking) {
    await nap(380)
    yield "<thinking>"
    for (const { s } of pieces(script.thinking)) {
      yield s
      await nap(9)
    }
    yield "</thinking>\n\n"
    await nap(260)
  } else {
    await nap(420)
  }

  let intro = attachmentNote(a.attachments)
  if (a.noAccess) {
    intro =
      "> Web search and research are switched on, but the demo model has no internet access. This answer comes from built-in examples.\n\n" +
      intro
  }
  const text = intro + script.body

  for (const { s, ms } of pieces(text)) {
    yield s
    await nap(ms)
  }
}
