import assert from "node:assert/strict";

export async function readPreviewDocument(frame) {
  return exportSourceFromPreview(await frame.getAttribute("srcdoc"));
}

// Preserve a byte comparison with the downloaded file, including owner text and inline images.
// Validate and remove only the two navigation instructions needed by opaque srcdoc previews.
export function exportSourceFromPreview(html) {
  const base = '<base href="about:srcdoc">';
  assert.equal(typeof html, "string", "The preview must contain an HTML document.");
  assert.equal(html.match(/<base\b/gi)?.length, 1, "Expected exactly one preview base element.");
  assert.ok(html.includes("<head>" + base), "Preview fragments must resolve inside this frame.");
  return html.replace("<head>" + base, "<head>").replace(/<a\b[^>]*>/gi, (tag) => {
    const href = tag.match(/\shref="([^"]*)"/i);
    assert.ok(href, "The authored link must retain its destination.");
    const targets = tag.match(/\starget=/gi) ?? [];
    if (href[1].startsWith("#")) {
      assert.equal(targets.length, 0, "Fragment links must stay in this preview.");
      return tag;
    }
    assert.equal(targets.length, 1, "Outbound preview links must use the blocked popup target.");
    assert.ok(tag.includes(' target="_blank" href='), "Unexpected outbound preview target.");
    return tag.replace(' target="_blank" href=', " href=");
  });
}
