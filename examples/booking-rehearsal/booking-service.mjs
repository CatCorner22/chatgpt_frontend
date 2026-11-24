// Only this loopback practice service ever receives the made-up details.
export function createBookingService() {
  const reservations = new Map();
  const requests = new Map();

  return async (req, res, next) => {
    if (req.url !== "/api/practice-bookings") return next();
    const reply = (status, value) => {
      res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify(value));
    };
    if (
      req.method !== "POST" ||
      !/^127\.0\.0\.1(?::[0-9]+)?$/.test(req.headers.host || "") ||
      req.headers.origin !== "http://" + req.headers.host ||
      req.headers["content-type"] !== "application/json"
    )
      return reply(403, { message: "Open the practice page at its local 127.0.0.1 address." });

    const parts = [];
    let total = 0;
    try {
      for await (const chunk of req) {
        total += chunk.length;
        if (total > 2048) return reply(413, { message: "Re-enter the practice details." });
        parts.push(chunk);
      }
    } catch {
      return;
    } // A client may close the connection during upload.
    let data;
    try {
      data = JSON.parse(Buffer.concat(parts).toString("utf8"));
    } catch {
      return reply(400, { message: "Re-enter the practice details." });
    }
    const { email, session, key, scenario } = data ?? {};
    if (
      typeof email !== "string" ||
      email.length > 100 ||
      !/^[a-z\d.+_-]+@example\.test$/i.test(email) ||
      !["wheel", "glaze"].includes(session) ||
      typeof key !== "string" ||
      !/^[\da-f-]{36}$/i.test(key) ||
      !["normal", "lost-response"].includes(scenario)
    )
      return reply(422, {
        message: "Use a made-up address ending in @example.test and choose a class.",
      });

    const identity = session + "/" + email.toLowerCase();
    // Recheck after the simulated service latency. All writes then run synchronously.
    await new Promise((resolve) => setTimeout(resolve, 350));
    const existing = requests.get(key);
    if (existing && existing !== identity)
      return reply(409, { message: "The details changed. Start a fresh request." });
    if (session === "glaze")
      return reply(409, {
        message: "Glaze studio just filled. Choose Wheel basics to keep your details.",
      });
    const reservation = reservations.get(identity);
    if (reservation) return reply(200, reservation);
    if (reservations.size >= 250)
      return reply(503, {
        message: "The practice session is full. Restart the local service to reset it.",
      });
    const receipt = { number: "RK-" + String(reservations.size + 1).padStart(3, "0"), total: 48 };
    reservations.set(identity, receipt);
    requests.set(key, identity);
    if (scenario === "lost-response")
      return reply(503, {
        message: "The confirmation didn’t reach you. Submit again to check the same reservation.",
      });
    return reply(201, receipt);
  };
}
