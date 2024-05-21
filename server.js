const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000; // Set the port for the server

// Define a route for the homepage
app.get('/', (req, res) => {
  res.send('Hello, world! This is the homepage.');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
