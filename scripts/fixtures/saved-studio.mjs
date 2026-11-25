// Local Sites previews need a verified owner before the Studio can read a save.
export async function useLoopbackSession(page, target, owner) {
  const url = new URL(target);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) return false;
  await page.route(new URL("/api/hosted/session", url).href, (route) =>
    route.fulfill({
      json: { mode: "hosted", user: { id: owner, email: null }, storageAvailable: false },
    }),
  );
  return true;
}

export async function openSavedStudio(page, target, state) {
  const url = new URL(target);
  url.searchParams.set("view", "studio");
  url.searchParams.delete("panel");
  url.hash = "";
  const owner = state.libraryId;
  const loopback = await useLoopbackSession(page, url, owner);
  await page.goto(url.href, { waitUntil: "networkidle" });
  const save = JSON.stringify({
    version: 2,
    stage: "rx",
    quick: true,
    picks: [],
    history: [],
    directions: [],
    stepIndex: 3,
    ...state,
  });
  // The portable app migrates the legacy key. The Sites edition reads its owner's copy.
  await page.evaluate(
    ({ save, loopback, owner }) => {
      localStorage.setItem("refraction:v1", save);
      if (loopback)
        localStorage.setItem(
          `focus:owner:v1:${encodeURIComponent("sites:" + owner)}:refraction:v1`,
          save,
        );
    },
    { save, loopback, owner },
  );
  await page.reload({ waitUntil: "networkidle" });
  return url.href;
}
