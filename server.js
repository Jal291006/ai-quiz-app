const express = require('express');
const cors = require('cors');

const app = express();
const port = 3000;

// Middleware
app.use(cors()); 
app.use(express.json()); 

// Tells Express to serve the static files (HTML, JS, CSS) from the 'public' folder
app.use(express.static('public'));

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
    console.log(`Open http://localhost:${port} in your browser to see the quiz!`);
});