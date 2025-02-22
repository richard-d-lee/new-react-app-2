// server.js
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import connection from './db.js'; // Ensure connection is established
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import feedRoutes from './routes/feed.js';
import commentRoutes from './routes/comments.js';
import groupRoutes from './routes/groups.js';
import friendRoutes from './routes/friends.js';
import messageRoutes from './routes/messages.js';
import notificationsRoutes from './routes/notifications.js';
import { authenticateToken } from './middleware/auth.js';
import multer from 'multer';
import mentionsRouter from './routes/mentions.js'; // Ensure correct path


// ... your middleware and setup code


// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log('__dirname:', __dirname);

// Initialize Express app
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/feed', feedRoutes);
app.use('/comments', commentRoutes);
app.use('/groups', groupRoutes);
app.use('/friends', friendRoutes);
app.use('/messages', messageRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/mentions', mentionsRouter);


// Setup static folder for uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory.');
}
app.use('/uploads', express.static(uploadsDir));

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png|gif/;
    const extName = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeType = fileTypes.test(file.mimetype);
    if (extName && mimeType) return cb(null, true);
    cb(new Error('Only image files (jpg, png, gif) are allowed'));
  }
});

// File upload endpoint for profile pictures
app.post('/upload-profile-pic', authenticateToken, upload.single('profilePic'), (req, res) => {
  const userId = req.user.userId;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded or invalid file type.' });
  const newFileUrl = `/uploads/${req.file.filename}`;
  const getPicQuery = 'SELECT profile_picture_url FROM users WHERE user_id = ?';
  connection.query(getPicQuery, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length > 0 && results[0].profile_picture_url) {
      const oldFilePath = path.join(__dirname, results[0].profile_picture_url);
      if (fs.existsSync(oldFilePath)) {
        fs.unlink(oldFilePath, err => {
          if (err) console.error('Error deleting old profile picture:', err);
          else console.log('Old profile picture deleted:', oldFilePath);
        });
      }
    }
    const updateQuery = 'UPDATE users SET profile_picture_url = ? WHERE user_id = ?';
    connection.query(updateQuery, [newFileUrl, userId], (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ message: 'Profile picture updated successfully', fileUrl: newFileUrl });
    });
  });
});

// Mount routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/feed', feedRoutes);
app.use('/comments', commentRoutes);
app.use('/groups', groupRoutes);
app.use('/friends', friendRoutes);
app.use('/messages', messageRoutes);

// Start the server
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
