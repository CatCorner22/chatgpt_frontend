// Real React 19 mount/controlled state/portal fixture; not a whole framework build.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
function Booking() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [count, setCount] = useState(0);
  const [route, setRoute] = useState("Booking");
  return <><main><h1>Customer booking</h1><a href="#details" onClick={() => setRoute("Details")}>Details</a><form onSubmit={e => { e.preventDefault(); setStatus(`Booked ${email}`); }}><label>Email<input name="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label><button className="sample bg-primary text-primary-foreground rounded-lg">Book</button></form><p role="status">{status}</p><button id="increment" onClick={() => setCount(n => n + 1)}>Add item</button><output>{count}</output><section id="details">Original words</section><span data-route>{route}</span></main>{createPortal(<span>Existing portal</span>, document.getElementById("portal") ?? document.body)}</>;
}
const root = document.getElementById("customer-root");
if (root) createRoot(root).render(<Booking />);