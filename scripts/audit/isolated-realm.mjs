/** Chromium's isolated world has separate script globals and DOM prototypes. */
export async function createAuditRealm(page, { timeoutMs = 15000, initialScripts = [] } = {}) {
  const session = await page.context().newCDPSession(page);
  const worldName = "north-star-audit";
  const bounded = async (method, params) => {
    let timer;
    try {
      return await Promise.race([
        session.send(method, params),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            const error = new Error(`The isolated browser check exceeded ${timeoutMs} ms.`);
            error.name = "AuditTimeoutError";
            // This protocol interrupt is outside the page's replaceable timer functions.
            void session.send("Runtime.terminateExecution").catch(() => {});
            reject(error);
          }, timeoutMs + 100);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  await bounded("Page.enable", {});
  await bounded("Runtime.enable", {});
  for (const script of initialScripts) {
    await bounded("Page.addScriptToEvaluateOnNewDocument", {
      source: `(${script.toString()})()`,
      worldName,
    });
  }
  return {
    async evaluate(expression) {
      const { frameTree } = await bounded("Page.getFrameTree", {});
      const { executionContextId } = await bounded("Page.createIsolatedWorld", {
        frameId: frameTree.frame.id,
        worldName,
        grantUniveralAccess: false,
      });
      const result = await bounded("Runtime.evaluate", {
        expression,
        contextId: executionContextId,
        returnByValue: true,
        awaitPromise: false,
        timeout: timeoutMs,
        disableBreaks: true,
      });
      if (result.exceptionDetails)
        throw new Error(
          result.exceptionDetails.exception?.description ||
            result.exceptionDetails.text ||
            "Isolated check failed.",
        );
      if (result.result.subtype === "error")
        throw new Error(result.result.description || "Isolated check returned an error.");
      if (
        result.result.type === "object" &&
        !Object.prototype.hasOwnProperty.call(result.result, "value")
      )
        throw new Error("Isolated check did not return serializable data.");
      return result.result.value;
    },
    async call(fn) {
      return this.evaluate(`(${fn.toString()})()`);
    },
    async close() {
      await session.detach().catch(() => {});
    },
  };
}
