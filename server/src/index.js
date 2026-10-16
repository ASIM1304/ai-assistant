const { config, validateEnv } = require("./config/env");
const connectDB = require("./config/db");
const { createApp } = require("./app");
const { ensureDefaults } = require("./services/defaults");
const { startScheduler, lifecycleSweep } = require("./services/maintenance");

async function main() {
  validateEnv(); // refuses to start with an unsafe production configuration
  await connectDB();
  await ensureDefaults();
  await lifecycleSweep().catch((e) => console.error("[startup] lifecycle sweep failed:", e.message));

  const app = createApp();
  const server = app.listen(config.port, () => console.log(`Server listening on port ${config.port} (${config.env})`));
  const stopScheduler = startScheduler();

  const shutdown = (sig) => {
    console.log(`${sig} received, shutting down`);
    stopScheduler();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error(err.isConfigError ? err.message : `Startup failed: ${err.message}`);
  process.exit(1);
});
