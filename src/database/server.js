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
import mentionsRoutes from './routes/mentions.js';
import marketplaceRoutes from './routes/marketplace.js';
import eventRoutes from './routes/events.js';
import reportRoutes from './routes/reports.js';
import { authenticateToken } from './middleware/auth.js';
import multer from 'multer';
import rateLimit from 'express-rate-limit';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log('__dirname:', __dirname);

// Initialize Express app
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Short-term limiter: 100 requests per 15 minutes per IP
const shortTermLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 100 requests per window
  message: "Too many requests from this IP, please try again after 15 minutes."
});
app.use(shortTermLimiter);

// Daily limiter: 10,000 requests per day per IP using the default memory store
const dailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 10000, // maximum of 10,000 requests per IP per day
  message: "Daily API limit exceeded. Please try again tomorrow."
});
app.use(dailyLimiter);

// Mount routes
app.use('/auth', authRoutes);
app.use('/marketplace', marketplaceRoutes);
app.use('/users', userRoutes);
app.use('/feed', feedRoutes);
app.use('/comments', commentRoutes);
app.use('/groups', groupRoutes);
app.use('/friends', friendRoutes);
app.use('/messages', messageRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/mentions', mentionsRoutes);
app.use('/events', eventRoutes);
app.use('/reports', reportRoutes);

// Use your absolute path for uploads (profile pics & event images)
const uploadsDir = "C:\\Users\\rever\\react-app\\src\\database\\uploads";

// Ensure the uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory at', uploadsDir);
}

// Serve static files from the uploads directory at /uploads
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
      const oldFilePath = path.join(uploadsDir, path.basename(results[0].profile_picture_url));
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
app.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadsDir, filename);
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error("Error sending file:", err);
      res.status(404).send("File not found");
    }
  });
});



// Start the server
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
