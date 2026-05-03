let app;
let loadError;

try {
  app = require("../backend/server");
} catch (err) {
  loadError = err;
}

module.exports = (req, res) => {
  if (loadError) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      error: loadError.message,
      stack: loadError.stack,
    }));
    return;
  }
  app(req, res);
};
