import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import Booking from "./Booking";

export default function Rehearsal() {
  const [loseReply, setLoseReply] = useState(false);
  return (
    <>
      <Booking scenario={loseReply ? "lost-response" : "normal"} />
      <details>
        <summary>Practice conditions</summary>
        <p>Wheel basics has space. Glaze studio fills just before confirmation.</p>
        <label>
          <input
            type="checkbox"
            checked={loseReply}
            onChange={(event) => setLoseReply(event.target.checked)}
          />{" "}
          Lose the first confirmation for a new reservation
        </label>
        <p>All reservations stay in this local practice server until you stop it.</p>
      </details>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<Rehearsal />);
