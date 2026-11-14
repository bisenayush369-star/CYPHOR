import assert from "node:assert/strict"
import { test } from "node:test"
import { parseBackup } from "../../lib/import.ts"

const msg = (id: string, parentId: string | null, role: "user" | "assistant", extra: Record<string, unknown> = {}) => ({
  id,
  parentId,
  role,
  content: `${role} ${id}`,
  createdAt: 1,
  childIds: [],
  activeChildId: null,
  ...extra,
})

const chat = (extra: Record<string, unknown> = {}) => ({
  id: "c1",
  title: "Hello",
  createdAt: 1,
  updatedAt: 2,
  starred: true,
  projectId: null,
  model: "m",
  nodes: {
    u1: msg("u1", null, "user", { childIds: ["a1", "a2"], activeChildId: "a2" }),
    a1: msg("a1", "u1", "assistant", { status: "done" }),
    a2: msg("a2", "u1", "assistant", { status: "done", feedback: "up" }),
  },
  rootChildIds: ["u1"],
  rootActiveId: "u1",
  ...extra,
})

test("keeps a valid chat, its branches and the active branch", () => {
  const { chats } = parseBackup(JSON.stringify({ state: { chats: { c1: chat() }, projects: {} } }))
  const c = chats.c1
  assert.equal(c.title, "Hello")
  assert.equal(c.starred, true)
  assert.deepEqual(c.nodes.u1.childIds, ["a1", "a2"])
  assert.equal(c.nodes.u1.activeChildId, "a2")
  assert.equal(c.nodes.a2.feedback, "up")
  assert.deepEqual(c.rootChildIds, ["u1"])
  assert.equal(c.rootActiveId, "u1")
})

test("accepts a bare { chats, projects } object as well as a persisted state wrapper", () => {
  const r = parseBackup(JSON.stringify({ chats: { c1: chat() }, projects: {} }))
  assert.equal(Object.keys(r.chats).length, 1)
})

test("rejects things that are not backups", () => {
  assert.throws(() => parseBackup("not json"))
  assert.throws(() => parseBackup("[]"))
  assert.throws(() => parseBackup("42"))
  assert.throws(() => parseBackup("{}"))
  assert.throws(() => parseBackup(JSON.stringify({ settings: {} })))
})

test("drops chats with no usable messages and keeps the rest", () => {
  const bad = { id: "bad", nodes: {} }
  const worse = { id: "worse" }
  const odd = chat({ id: "odd", nodes: { x: msg("x", null, "user", { role: "system" }) }, rootChildIds: ["x"] })
  const { chats } = parseBackup(JSON.stringify({ chats: { bad, worse, odd, c1: chat() } }))
  assert.deepEqual(Object.keys(chats), ["c1"])
})

test("rebuilds child lists that are missing or point at nothing", () => {
  const c = chat({
    nodes: {
      u1: msg("u1", null, "user", { childIds: ["ghost"], activeChildId: "ghost" }),
      a1: msg("a1", "u1", "assistant", { createdAt: 5 }),
      a2: msg("a2", "u1", "assistant", { createdAt: 9 }),
    },
    rootChildIds: [],
    rootActiveId: "nope",
  })
  const out = parseBackup(JSON.stringify({ chats: { c1: c } })).chats.c1
  assert.deepEqual(out.nodes.u1.childIds, ["a1", "a2"])
  assert.equal(out.nodes.u1.activeChildId, "a2")
  assert.deepEqual(out.rootChildIds, ["u1"])
  assert.equal(out.rootActiveId, "u1")
})

test("breaks parent loops and unknown parents so walking up always ends", () => {
  const c = chat({
    nodes: {
      u1: msg("u1", null, "user"),
      a: msg("a", "b", "assistant"),
      b: msg("b", "a", "assistant"),
      lost: msg("lost", "missing", "assistant"),
    },
    rootChildIds: ["u1"],
  })
  const out = parseBackup(JSON.stringify({ chats: { c1: c } })).chats.c1
  for (const id of Object.keys(out.nodes)) {
    let cur = out.nodes[id]
    let steps = 0
    while (cur.parentId) {
      cur = out.nodes[cur.parentId]
      assert.ok(cur, "parent exists")
      assert.ok(++steps < 10, "no loop")
    }
  }
  assert.equal(out.nodes.lost.parentId, null)
})

test("never brings back image data, and a streaming reply becomes stopped", () => {
  const c = chat({
    nodes: {
      u1: msg("u1", null, "user", { attachments: [{ id: "f", name: "p.png", kind: "image", mime: "image/png", size: 3, dataUrl: "data:image/png;base64,AAAA" }] }),
      a1: msg("a1", "u1", "assistant", { status: "streaming" }),
    },
  })
  const out = parseBackup(JSON.stringify({ chats: { c1: c } })).chats.c1
  assert.equal(out.nodes.u1.attachments?.[0].dataUrl, undefined)
  assert.equal(out.nodes.u1.attachments?.[0].name, "p.png")
  assert.equal(out.nodes.a1.status, "stopped")
})

test("incognito chats are not restored as incognito", () => {
  const out = parseBackup(JSON.stringify({ chats: { c1: chat({ incognito: true }) } })).chats.c1
  assert.equal((out as { incognito?: boolean }).incognito, undefined)
})

test("fills in missing fields on projects", () => {
  const { projects } = parseBackup(JSON.stringify({ projects: { p1: { id: "p1" }, p2: { name: "  Thesis  ", files: [{ id: "x", name: "a.md", kind: "text", mime: "text/markdown", size: 2, text: "hi" }, 7] } } }))
  assert.equal(projects.p1.name, "Untitled project")
  assert.deepEqual(projects.p1.files, [])
  assert.equal(projects.p2.name, "Thesis")
  assert.equal(projects.p2.files.length, 1)
  assert.equal(projects.p2.files[0].text, "hi")
})

test("ids that could change a prototype are ignored and nothing is polluted", () => {
  const json =
    '{"chats":{"a":{"id":"__proto__","nodes":{"u":{"role":"user"}},"rootChildIds":["u"]},' +
    '"b":{"id":"b","nodes":{"__proto__":{"role":"user"},"u":{"role":"user","parentId":"__proto__"}},"rootChildIds":["__proto__","u"]}},' +
    '"projects":{"c":{"id":"constructor"}}}'
  const r = parseBackup(json)
  assert.equal(r.chats.a, undefined)
  assert.deepEqual(Object.keys(r.projects), [])
  // chat "b" survives: the "__proto__" message is dropped and "u" becomes a root message
  assert.deepEqual(Object.keys(r.chats.b.nodes), ["u"])
  assert.equal(r.chats.b.nodes.u.parentId, null)
  assert.deepEqual(r.chats.b.rootChildIds, ["u"])
  assert.equal(({} as Record<string, unknown>).role, undefined)
})
