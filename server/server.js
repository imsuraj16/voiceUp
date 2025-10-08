const app = require("./src/app");
const connectDb = require("./src/db/db");

// Connect to the database
connectDb();


// Start the server
app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
