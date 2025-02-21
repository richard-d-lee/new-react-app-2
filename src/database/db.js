// db.js
import mysql from 'mysql2';
import password from './password.js';

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: password,
  database: 'social_media_app'
});

connection.connect(err => {
  if (err) console.error('Database connection error:', err);
  else console.log('Connected to MySQL');
});

export default connection;