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

app.post('/add-friend', (req, res) => {
  const { friendEmail, email } = req.body;
  let myId;
  let theirId;
  let myIdQuery = 'SELECT USER_ID FROM USERS WHERE EMAIL = ?'
  connection.query(myIdQuery, [email], (err, result) => {
    if (err) {
      console.log(err)
      return res.status(500).json({ error: 'Error sending request' });
    }
    myId = result[0].USER_ID;
    let theirIdQuery = 'SELECT USER_ID FROM USERS WHERE EMAIL = ?'
    connection.query(theirIdQuery, [friendEmail], (err, result) => {
      if (err) {
        console.log(err)
        return res.status(500).json({ error: 'Error sending request' });
      }
      theirId = result[0].USER_ID;
      const query = 'INSERT INTO FRIENDS (USER_ID_1, USER_ID_2, STATUS) VALUES (?, ?, ?)';
      connection.query(query, [myId, theirId, 'pending'], (err, result) => {
        if (err) {
          console.log(err)
          return res.status(500).json({ error: 'Error sending request' });
        }
        res.status(200).json({ message: 'Friend Request Sent!' });
      });
    })
  })
});

app.get("/data", (req, res) => {
  connection.query("SELECT * FROM POSTS", (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

app.post("/possible-friends", (req, res) => {
  const { email } = req.body;
  let myId;
  let myIdQuery = 'SELECT USER_ID FROM USERS WHERE EMAIL = ?'
  connection.query(myIdQuery, [email], (err, result) => {
    if (err) {
      console.log(err)
      return res.status(500).json({ error: 'Error sending request' });
    }
    myId = result[0].USER_ID;
    connection.query("SELECT USERNAME, EMAIL, FIRST_NAME, LAST_NAME FROM USERS WHERE USER_ID NOT IN (SELECT USER_ID_2 FROM FRIENDS WHERE USER_ID_1 = ?)", [myId], (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results);
    });
  })
});


app.listen(5000, () => console.log("Server running on port 5000"));
