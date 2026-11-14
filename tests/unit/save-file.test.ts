/**
 * Saving a file. In the Next.js app, and in a preview opened from disk, it is a plain download link. In the preview
 * published as a web page the frame around it forbids that and offers a `downloads` capability that asks the person.
 * Node has no window, so these tests stand in for the frame with a small object.
 */
import assert from "node:assert/strict"
import { afterEach, describe, test } from "node:test"
import { downloadBlob } from "../../lib/utils.ts"

const g = globalThis as Record<string, unknown>
const NAMES = ["window", "document", "__STANDALONE__", "setTimeout"] as const
const original = Object.fromEntries(NAMES.map((k) => [k, g[k]]))

afterEach(() => {
  for (const k of NAMES) {
    if (original[k] === undefined) delete g[k]
    else g[k] = original[k]
  }
})

/** A frame whose `use("downloads")` answers with `downloads`, or with null when there is none. */
function frame(downloads: { save: (f: { filename: string; data: Blob }) => Promise<unknown> } | null) {
  g.__STANDALONE__ = true
  g.window = { claude: { use: async (name: string) => (name === "downloads" ? downloads : null) } }
}

/** A page with a body to hold a link, where clicking the link is recorded. */
function page() {
  const clicked: { download: string; href: string }[] = []
  g.document = {
    createElement: () => ({
      href: "",
      download: "",
      click() {
        clicked.push({ download: this.download, href: this.href })
      },
      remove() {},
    }),
    body: { appendChild() {} },
  }
  g.setTimeout = () => 0 // the link's address is released after two seconds; do not wait for that here
  return clicked
}

describe("downloadBlob", () => {
  test("outside the preview it clicks a download link, even if a frame object is present", async () => {
    const clicked = page()
    frame({ save: async () => assert.fail("the frame must not be used here") })
    delete g.__STANDALONE__ // the Next.js app has no such flag
    assert.equal(await downloadBlob("chat.md", "# hi", "text/markdown"), "saved")
    assert.equal(clicked.length, 1)
    assert.equal(clicked[0].download, "chat.md")
    assert.match(clicked[0].href, /^blob:/)
  })

  test("in the preview with no frame around it (opened from disk) it clicks a link", async () => {
    const clicked = page()
    g.__STANDALONE__ = true
    assert.equal(await downloadBlob("backup.json", "{}", "application/json"), "saved")
    assert.equal(clicked.length, 1)
  })

  test("in the preview inside a frame it hands the file to the frame and never clicks a link", async () => {
    const clicked = page()
    const seen: { filename: string; text: string }[] = []
    frame({
      save: async ({ filename, data }) => {
        seen.push({ filename, text: await data.text() })
        return { status: "saved" }
      },
    })
    assert.equal(await downloadBlob("chat.md", "# hello", "text/markdown"), "saved")
    assert.deepEqual(seen, [{ filename: "chat.md", text: "# hello" }])
    assert.equal(clicked.length, 0)
  })

  test("a person who says no is reported as declined", async () => {
    frame({ save: async () => Promise.reject({ code: "declined", message: "no" }) })
    assert.equal(await downloadBlob("a.md", "x"), "declined")
  })

  test("a kind of file the frame does not allow is reported as unsupported", async () => {
    frame({ save: async () => Promise.reject({ code: "rejected_extension", message: "no" }) })
    assert.equal(await downloadBlob("code.py", "print(1)"), "unsupported")
    frame({ save: async () => Promise.reject({ code: "extension_not_enabled", message: "no" }) })
    assert.equal(await downloadBlob("clip.mov", "x"), "unsupported")
  })

  test("any other failure is reported as unavailable, and a thrown non-error does not escape", async () => {
    frame({ save: async () => Promise.reject({ code: "rate_limited", message: "wait" }) })
    assert.equal(await downloadBlob("a.md", "x"), "unavailable")
    frame({ save: async () => Promise.reject("boom") })
    assert.equal(await downloadBlob("a.md", "x"), "unavailable")
    frame({ save: async () => Promise.reject(null) })
    assert.equal(await downloadBlob("a.md", "x"), "unavailable")
  })

  test("a frame without the capability is reported as unavailable, and no link is clicked", async () => {
    const clicked = page()
    frame(null)
    assert.equal(await downloadBlob("a.md", "x"), "unavailable")
    assert.equal(clicked.length, 0)
  })

  test("a frame whose lookup throws is reported as unavailable", async () => {
    g.__STANDALONE__ = true
    g.window = {
      claude: {
        use: async () => {
          throw new Error("no answer")
        },
      },
    }
    assert.equal(await downloadBlob("a.md", "x"), "unavailable")
  })

  test("a frame with no use function is reported as unavailable", async () => {
    g.__STANDALONE__ = true
    g.window = { claude: {} }
    assert.equal(await downloadBlob("a.md", "x"), "unavailable")
  })
})
