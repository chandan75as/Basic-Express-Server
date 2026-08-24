const express = require("express");
const path = require("path");

const app = express();
const host = "0.0.0.0";
const port = 3000;

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`);
});