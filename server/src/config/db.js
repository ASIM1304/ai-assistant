const mongoose = require("mongoose");
const { config } = require("./env");

mongoose.set("strictQuery", true);

async function connectDB(uri = config.mongoUri) {
  await mongoose.connect(uri, {
    // Fail fast instead of buffering queries forever when Mongo is unreachable.
    serverSelectionTimeoutMS: 8000,
    maxPoolSize: 20,
  });
  // Build declared indexes (unique constraints are part of our integrity story).
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  return mongoose.connection;
}

module.exports = connectDB;
