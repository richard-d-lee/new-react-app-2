import express from 'express';
import mysql from 'mysql2';
import cors from 'cors';
import password from "./password.js";

const app = express();
app.use(cors());
app.use(express.json());

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: password,
  database: 'social_media_app',
});

connection.connect(err => {
  if (err) console.error("Database connection error:", err);
  else console.log("Connected to MySQL");
});

app.get("/data", (req, res) => {
  connection.query("SELECT * FROM POSTS", (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

app.listen(5000, () => console.log("Server running on port 5000"));
