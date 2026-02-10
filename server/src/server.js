require("dotenv").config();

console.log("CWD:", process.cwd());
console.log(
  "AMAZON_CREATORS_MOCK:",
  JSON.stringify(process.env.AMAZON_CREATORS_MOCK)
);

const app = require("./app");
const mongoose = require("mongoose");

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`🚀 Server running on ${PORT}`);
});
