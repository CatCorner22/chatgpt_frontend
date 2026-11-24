import { defineConfig } from "vite";
import { createBookingService } from "./booking-service.mjs";

export default defineConfig({
  server: { host: "127.0.0.1" },
  preview: { host: "127.0.0.1" },
  plugins: [
    {
      name: "local-booking-practice",
      configureServer(server) {
        server.middlewares.use(createBookingService());
      },
      configurePreviewServer(server) {
        server.middlewares.use(createBookingService());
      },
    },
  ],
});
