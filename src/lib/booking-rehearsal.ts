import JSZip from "jszip";
import readme from "../../examples/booking-rehearsal/START-HERE.md?raw";
import gitignore from "../../examples/booking-rehearsal/.gitignore?raw";
import manifest from "../../examples/booking-rehearsal/package.json?raw";
import lockfile from "../../examples/booking-rehearsal/package-lock.json?raw";
import page from "../../examples/booking-rehearsal/index.html?raw";
import config from "../../examples/booking-rehearsal/vite.config.mjs?raw";
import service from "../../examples/booking-rehearsal/booking-service.mjs?raw";
import entry from "../../examples/booking-rehearsal/src/main.tsx?raw";
import booking from "../../examples/booking-rehearsal/src/Booking.tsx?raw";
import styles from "../../examples/booking-rehearsal/src/Booking.module.css?raw";

/** Only the owned practice project travels in this archive. */
export async function buildBookingRehearsal() {
  const files = {
    "START-HERE.md": readme,
    ".gitignore": gitignore,
    "package.json": manifest,
    "package-lock.json": lockfile,
    "index.html": page,
    "vite.config.mjs": config,
    "booking-service.mjs": service,
    "src/main.tsx": entry,
    "src/Booking.tsx": booking,
    "src/Booking.module.css": styles,
  };
  const zip = new JSZip();
  // A second download of the same practice project can be checked byte for byte.
  const versionDate = new Date("2026-11-24T00:00:00Z");
  for (const [path, source] of Object.entries(files)) {
    zip.file("river-kiln/" + path, source, { createFolders: false, date: versionDate });
  }
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}
