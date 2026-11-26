import { createRoot } from "react-dom/client";
import { PreparedBookingRoom } from "../../src/components/PreparedBookingRoom";
import "../../src/styles.css";
import { uiFontLicenses } from "../../src/lib/ui-font-licenses";

createRoot(document.getElementById("root")!).render(
  <>
    {uiFontLicenses.map((license) => (
      <link key={license.href} {...license} />
    ))}
    <PreparedBookingRoom />
  </>,
);
