// Synthetic customer application: no Focus imports, styles, or backend services.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";

// This fixture is a bundled entry point, not an app hot-refresh module.
// eslint-disable-next-line react-refresh/only-export-components
function CustomerBooking({ portal }: { portal: HTMLElement }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [count, setCount] = useState(0);
  const [route, setRoute] = useState("Booking");
  const [portalCount, setPortalCount] = useState(0);

  return (
    <>
      <main id="trial">
        <h1>Customer booking</h1>
        <a href="#details" onClick={() => setRoute("Details")}>
          Details
        </a>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setStatus(`Booked ${email}`);
          }}
        >
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button type="submit" className="sample">
            Book
          </button>
        </form>
        <p role="status">{status}</p>
        <button id="increment" type="button" onClick={() => setCount((value) => value + 1)}>
          Add item
        </button>
        <output id="count">{count}</output>
        <section id="details">Original words</section>
        <span data-route>{route}</span>
        <p id="muted" className="muted">
          Existing muted surface
        </p>
        <p id="fixed" className="fixed-surface">
          Existing fixed-color surface
        </p>
      </main>
      {createPortal(
        <>
          <p>Existing portal</p>
          <button
            id="portal-action"
            type="button"
            onClick={() => setPortalCount((value) => value + 1)}
          >
            Portal action
          </button>
          <output id="portal-count">{portalCount}</output>
        </>,
        portal,
      )}
    </>
  );
}

const root = document.getElementById("customer-root");
const portal = document.getElementById("portal");
if (!root || !portal) throw new Error("Customer fixture requires #customer-root and #portal.");
createRoot(root).render(<CustomerBooking portal={portal} />);
