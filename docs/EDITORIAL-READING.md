# Looking Room

In Vision, open **Study a two-image editorial example** and download Looking Room. Open **My designs**, choose **Restore backup**, select the downloaded JSON and open its Vision. The sample adds a separate design to the library. It includes both images and their credits.

The lead image accompanies the introduction. **Add a related story** accepts a title and web address, plus an optional second image. The author chooses whether readers see that story immediately after the introduction or after the article. The title is the link. A story placed at the end becomes the final reading suggestion. Its image needs a description and public attribution. Each image has its own framing and small-screen position. Settings follow the existing Studio undo, saved versions, local image storage, and library backup.

The standalone HTML and the editable page ZIP embed the images and carry their public credits. Personal records of image-use agreements belong outside these public captions. The private project snapshot in the ZIP and library backups can contain project history. Only the HTML and its stylesheet belong on the public site.

## Works in the sample

Both images are public-domain woodblock prints by Katsushika Hokusai from _Thirty-six Views of Mount Fuji_, ca. 1830–32. The short reading guide is original Focus example copy.

- _Under the Wave off Kanagawa_, accession JP1847, H. O. Havemeyer Collection, Bequest of Mrs. H. O. Havemeyer, 1929. [Museum record](https://www.metmuseum.org/art/collection/search/45434) · [Image](https://images.metmuseum.org/CRDImages/as/web-large/DP130155.jpg)
- _South Wind, Clear Sky_, accession JP2960, Henry L. Phillips Collection, Bequest of Henry L. Phillips, 1939. [Museum record](https://www.metmuseum.org/art/collection/search/55736) · [Image](https://images.metmuseum.org/CRDImages/as/web-large/DP141053.jpg)

The Metropolitan Museum of Art provides the images through its Open Access program under CC0. [Open Access policy](https://www.metmuseum.org/about-the-met/policies-and-documents/open-access)

## Reproduce the browser rehearsal

Run Focus on a disposable loopback address. Run the following command from the repository, using the port on which Focus is listening.

```sh
FOCUS_TEST_URL=http://127.0.0.1:3000 node scripts/test-editorial-handoff.mjs
```

The rehearsal restores the downloadable library sample through the real editor, changes the reading order, reloads, and downloads both the Editorial and Journal compositions. Fresh browser sessions open the single-file export and the editable HTML with its extracted stylesheet. The checks cover original image bytes, credit, description, framing, real destination, keyboard access, equal preview/export markup and horizontal fit at 320, 760, 761 and 1280 pixels. Downloaded artifacts and screenshots go into `artifacts/editorial-handoff/`. The test isolates external network requests and supplies a local test identity for builds that ask for one. Independent human comparison and production-account acceptance are separate exercises.
