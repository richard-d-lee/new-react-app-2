import express from 'express';
import mysql from 'mysql2';
import cors from 'cors';
import password from "./password.js";
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const app = express();
app.use(cors());
app.use(bodyParser.json());
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

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  connection.query('SELECT * FROM USERS WHERE EMAIL = ?', [email], (err, results) => {
    if (err) {
      return res.status(500).json(err);
    }
    if (results.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const tempword = results[0].password_hash;
    bcrypt.compare(password, tempword, (err, isMatch) => {
      if (err || !isMatch) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
      const token = jwt.sign({ userId: results[0].id }, 'your_jwt_secret', { expiresIn: '1h' });
      res.json({ message: 'Login successful', token });
    });
  });
});

app.post('/register', (req, res) => {
  const { email, password } = req.body;
  connection.query('SELECT * FROM USERS WHERE EMAIL = ?', [email], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.length > 0) {
      return res.status(400).json({ error: 'Email is already registered' });
    }
    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
        return res.status(500).json({ error: 'Error hashing password' });
      }
      const query = 'INSERT INTO USERS (USERNAME, EMAIL, PASSWORD_HASH) VALUES (?, ?, ?)';
      connection.query(query, [email, email, hashedPassword], (err, result) => {
        if (err) {
          console.log(err)
          return res.status(500).json({ error: 'Error saving user' });
        }
        res.status(200).json({ message: 'Account created successfully' });
      });
    });
  });
});

app.get("/data", (req, res) => {
  connection.query("SELECT * FROM POSTS", (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

app.listen(5000, () => console.log("Server running on port 5000"));
