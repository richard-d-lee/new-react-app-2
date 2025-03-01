import express from 'express';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import connection from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { createNotification } from '../helpers/notificationsSideEffect.js';

const router = express.Router();

// Configure Multer for marketplace image uploads.
const absoluteUploadsPath = "C:\\Users\\rever\\react-app\\src\\database\\uploads";
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, absoluteUploadsPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = uuidv4() + ext;
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

/**
 * DELETE a single image from a marketplace listing
 * DELETE /marketplace/:id/remove-image?imgPath=/uploads/whatever.jpg
 */
router.delete('/:id/remove-image', authenticateToken, (req, res) => {
  const listingId = req.params.id;
  const userId = req.user.userId;
  const { imgPath } = req.query; // e.g. /uploads/da15c54b-77e1-4dc8-bc43-e65dd9c311a5.jpeg

  if (!imgPath) {
    return res.status(400).json({ error: 'imgPath query parameter is required' });
  }

  // 1) Check that the listing exists and belongs to the user
  const ownershipQuery = 'SELECT user_id FROM listings WHERE id = ? LIMIT 1';
  connection.query(ownershipQuery, [listingId], (err, rows) => {
    if (err) {
      console.error('Database error checking listing ownership:', err);
      return res.status(500).json({ error: 'Database error.' });
    }
    if (!rows.length) {
      return res.status(404).json({ error: 'Listing not found.' });
    }
    if (rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to remove images from this listing.' });
    }

    // 2) Remove the row from listing_images
    const deleteQuery = `
      DELETE FROM listing_images
       WHERE listing_id = ?
         AND image_url = ?
      LIMIT 1
    `;
    connection.query(deleteQuery, [listingId, imgPath], (err2, results) => {
      if (err2) {
        console.error('Database error removing image from listing_images:', err2);
        return res.status(500).json({ error: 'Database error removing image.' });
      }
      if (results.affectedRows === 0) {
        return res.status(404).json({ error: 'Image not found on this listing.' });
      }

      // 3) (Optional) Delete the file from disk if you want to remove it physically
      //    Only do this if you're sure you want the file gone from /uploads/
      try {
        const fileName = path.basename(imgPath); // e.g. da15c54b-77e1-4dc8-bc43-e65dd9c311a5.jpeg
        const absolutePath = path.join(absoluteUploadsPath, fileName);
        if (fs.existsSync(absolutePath)) {
          fs.unlinkSync(absolutePath);
        }
      } catch (unlinkErr) {
        console.error('Error deleting file from disk:', unlinkErr);
        // Not a fatal error, just log it
      }

      // Done
      return res.json({ message: 'Image removed successfully.' });
    });
  });
});

/**
 * GET all marketplace listing types
 * GET /marketplace/marketplace_listing_types
 */
router.get('/marketplace_listing_types', authenticateToken, (req, res) => {
  const query = `SELECT * FROM marketplace_listing_types ORDER BY name ASC`;
  connection.query(query, (err, rows) => {
    if (err) {
      console.error('Error fetching marketplace listing types:', err);
      return res.status(500).json({ error: 'Database error.' });
    }
    res.json(rows || []);
  });
});

/**
 * GET all distinct users who have posted marketplace listings
 * GET /marketplace/users
 */
router.get('/users', authenticateToken, (req, res) => {
  const query = `
    SELECT DISTINCT u.user_id, u.username
      FROM listings l
      JOIN users u ON l.user_id = u.user_id
     WHERE l.listing_type_id = 1
     ORDER BY u.username ASC
  `;
  connection.query(query, (err, rows) => {
    if (err) {
      console.error('Error fetching marketplace users:', err);
      return res.status(500).json({ error: 'Database error.' });
    }
    res.json(rows || []);
  });
});

// LIST All Marketplace Listings
router.get('/', authenticateToken, (req, res) => {
  const { minPrice, maxPrice, type, search, users } = req.query;
  let conditions = ['l.listing_type_id = 1'];
  let params = [];

  if (minPrice) {
    conditions.push('l.price >= ?');
    params.push(Number(minPrice));
  }
  if (maxPrice) {
    conditions.push('l.price <= ?');
    params.push(Number(maxPrice));
  }
  if (type) {
    conditions.push('l.marketplace_listing_type_id = ?');
    params.push(Number(type));
  }
  if (search) {
    conditions.push('(l.title LIKE ? OR l.description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (users) {
    const userIds = users.split(',').map(id => Number(id.trim())).filter(Boolean);
    if (userIds.length > 0) {
      const placeholders = userIds.map(() => '?').join(',');
      conditions.push(`l.user_id IN (${placeholders})`);
      params.push(...userIds);
    }
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // NEW: Left join listing_images and group them by listing ID
  const query = `
    SELECT
      l.id,
      l.user_id,
      l.listing_type_id,
      l.marketplace_listing_type_id,
      l.title,
      l.description,
      l.price,
      l.created_at,
      l.updated_at,
      u.username AS poster_username,
      u.profile_picture_url AS poster_profile_pic,
      mlt.name AS marketplace_listing_type_name,
      GROUP_CONCAT(li.image_url) AS images
    FROM listings l
    JOIN users u ON l.user_id = u.user_id
    LEFT JOIN marketplace_listing_types mlt 
           ON l.marketplace_listing_type_id = mlt.id
    LEFT JOIN listing_images li 
           ON l.id = li.listing_id
    ${whereClause}
    GROUP BY l.id
    ORDER BY l.created_at DESC
  `;

  connection.query(query, params, (err, rows) => {
    if (err) {
      console.error('Error listing marketplace listings:', err);
      return res.status(500).json({ error: 'Database error.' });
    }

    // Convert the comma-separated string of images into an array
    rows.forEach((row) => {
      if (row.images) {
        row.images = row.images.split(',');
      } else {
        row.images = [];
      }
    });

    res.json(rows || []);
  });
});


/**
 * CREATE a Marketplace Listing
 * POST /marketplace
 */
router.post('/', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { title, description, price, marketplace_listing_type_id } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required.' });
  if (price == null || isNaN(price)) return res.status(400).json({ error: 'Valid price is required.' });

  // Force the listing_type_id to the "Marketplace" type.
  const MARKETPLACE_LISTING_TYPE_ID = 1; 

  const insertQuery = `
    INSERT INTO listings 
      (user_id, listing_type_id, marketplace_listing_type_id, title, description, price, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;
  connection.query(insertQuery, [
    userId,
    MARKETPLACE_LISTING_TYPE_ID,
    marketplace_listing_type_id || null,
    title,
    description || '',
    price
  ], (err, results) => {
    if (err) {
      console.error('Error creating marketplace listing:', err);
      return res.status(500).json({ error: 'Database error.' });
    }
    const newListingId = results.insertId;
    res.status(201).json({
      listing_id: newListingId,
      message: 'Marketplace listing created successfully.'
    });
  });
});

/**
 * UPLOAD Images for a Marketplace Listing (owner only)
 * POST /marketplace/:id/upload-images
 * Accepts up to 5 images under the field name "images"
 */
router.post('/:id/upload-images', authenticateToken, upload.array('images', 5), (req, res) => {
  const listingId = req.params.id;
  const userId = req.user.userId;
  
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No images uploaded or invalid file types.' });
  }
  
  // Check that the listing exists and belongs to the user.
  const ownershipQuery = 'SELECT user_id FROM listings WHERE id = ? LIMIT 1';
  connection.query(ownershipQuery, [listingId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!rows.length) return res.status(404).json({ error: 'Listing not found' });
    if (rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to upload images for this listing' });
    }

    // Prepare an array of [listing_id, image_url] values.
    const values = req.files.map(file => [listingId, `/uploads/${file.filename}`]);
    const insertImageQuery = 'INSERT INTO listing_images (listing_id, image_url) VALUES ?';
    connection.query(insertImageQuery, [values], (err2, result) => {
      if (err2) {
        console.error('Error inserting listing images:', err2);
        return res.status(500).json({ error: 'Database error while saving images' });
      }
      res.json({ message: 'Images uploaded successfully', images: values.map(v => v[1]) });
    });
  });
});

// GET a Single Marketplace Listing (with images)
// GET /marketplace/:id
router.get('/:id', authenticateToken, (req, res) => {
  const listingId = req.params.id;
  const query = `
    SELECT
      l.id,
      l.user_id,
      l.listing_type_id,
      l.marketplace_listing_type_id,
      l.title,
      l.description,
      l.price,
      l.created_at,
      l.updated_at,
      u.username AS poster_username,
      u.profile_picture_url AS poster_profile_pic,
      mlt.name AS marketplace_listing_type_name,
      GROUP_CONCAT(li.image_url) AS images
    FROM listings l
    JOIN users u ON l.user_id = u.user_id
    LEFT JOIN marketplace_listing_types mlt ON l.marketplace_listing_type_id = mlt.id
    LEFT JOIN listing_images li ON l.id = li.listing_id
    WHERE l.id = ?
    GROUP BY l.id
  `;
  connection.query(query, [listingId], (err, rows) => {
    if (err) {
      console.error('Error fetching listing:', err);
      return res.status(500).json({ error: 'Database error.' });
    }
    if (!rows.length) return res.status(404).json({ error: 'Listing not found' });
    const listing = rows[0];
    listing.images = listing.images ? listing.images.split(',') : [];
    res.json(listing);
  });
});

// UPDATE a Marketplace Listing (owner only)
// PATCH /marketplace/:id
router.patch('/:id', authenticateToken, (req, res) => {
  const listingId = req.params.id;
  const userId = req.user.userId;
  const { title, description, price, marketplace_listing_type_id } = req.body;
  const ownershipQuery = 'SELECT user_id FROM listings WHERE id = ? LIMIT 1';
  connection.query(ownershipQuery, [listingId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error.' });
    if (!rows.length) return res.status(404).json({ error: 'Listing not found.' });
    if (rows[0].user_id !== userId) return res.status(403).json({ error: 'Not authorized.' });

    const updateQuery = `
      UPDATE listings
         SET title = ?,
             description = ?,
             price = ?,
             marketplace_listing_type_id = ?,
             updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?
    `;
    connection.query(updateQuery, [
      title || null,
      description || null,
      price || null,
      marketplace_listing_type_id || null,
      listingId,
      userId
    ], (err2, results) => {
      if (err2) return res.status(500).json({ error: 'Database error.' });
      if (!results.affectedRows) return res.status(404).json({ error: 'Listing not updated.' });
      
      // Return the updated listing
      const query = `
        SELECT
          l.id,
          l.user_id,
          l.listing_type_id,
          l.marketplace_listing_type_id,
          l.title,
          l.description,
          l.price,
          l.created_at,
          l.updated_at,
          u.username AS poster_username,
          u.profile_picture_url AS poster_profile_pic,
          mlt.name AS marketplace_listing_type_name,
          GROUP_CONCAT(li.image_url) AS images
        FROM listings l
        JOIN users u ON l.user_id = u.user_id
        LEFT JOIN marketplace_listing_types mlt ON l.marketplace_listing_type_id = mlt.id
        LEFT JOIN listing_images li ON l.id = li.listing_id
        WHERE l.id = ?
        GROUP BY l.id
      `;
      connection.query(query, [listingId], (err3, rows2) => {
        if (err3) return res.status(500).json({ error: 'Database error fetching updated listing.' });
        if (!rows2.length) return res.status(404).json({ error: 'Listing not found after update.' });
        const listing = rows2[0];
        listing.images = listing.images ? listing.images.split(',') : [];
        res.json(listing);
      });
    });
  });
});

/**
 * DELETE a Marketplace Listing (owner only)
 * DELETE /marketplace/:id
 * Also deletes any notifications associated with this listing (reference_type = 'marketplace_listing')
 */
router.delete('/:id', authenticateToken, (req, res) => {
  const listingId = req.params.id;
  const userId = req.user.userId;
  const ownershipQuery = 'SELECT user_id FROM listings WHERE id = ? LIMIT 1';
  connection.query(ownershipQuery, [listingId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error.' });
    if (!rows.length) return res.status(404).json({ error: 'Listing not found.' });
    if (rows[0].user_id !== userId) return res.status(403).json({ error: 'Not authorized.' });

    const deleteQuery = 'DELETE FROM listings WHERE id = ? AND user_id = ?';
    connection.query(deleteQuery, [listingId, userId], (err2, results) => {
      if (err2) return res.status(500).json({ error: 'Database error deleting listing' });
      if (!results.affectedRows) return res.status(404).json({ error: 'Listing not found or not authorized' });
      // Delete associated notifications for this listing.
      const deleteNotifQuery = `
        DELETE FROM notifications
        WHERE reference_id = ? AND reference_type = 'marketplace_listing'
      `;
      connection.query(deleteNotifQuery, [listingId], (err3) => {
        if (err3) console.error("Error deleting listing notifications:", err3);
        res.json({ message: 'Marketplace listing deleted successfully.' });
      });
    });
  });
});

/**
 * --- Marketplace Posts Endpoints ---
 */

/**
 * GET /marketplace/:id/posts - Retrieve all posts for a marketplace listing
 */
router.get('/:id/posts', authenticateToken, (req, res) => {
  const listingId = req.params.id;
  const userId = req.user.userId;
  const query = `
    SELECT p.post_id, p.user_id, p.content, p.created_at, p.post_type, p.marketplace_id,
           u.username, u.profile_picture_url
      FROM posts p
      JOIN users u ON p.user_id = u.user_id
     WHERE p.marketplace_id = ?
       AND p.post_type = 'marketplace'
       AND p.user_id NOT IN (
         SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
         UNION
         SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
       )
     ORDER BY p.created_at DESC
  `;
  connection.query(query, [listingId, userId, userId], (err, results) => {
    if (err) {
      console.error("Error fetching marketplace posts:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

/**
 * CREATE a POST for a Marketplace Listing
 * POST /marketplace/:id/posts
 */
router.post('/:id/posts', authenticateToken, (req, res) => {
  const listingId = req.params.id;
  const userId = req.user.userId;
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content is required' });
  const insertQuery = `
    INSERT INTO posts (marketplace_id, user_id, content, post_type)
    VALUES (?, ?, ?, 'marketplace')
  `;
  connection.query(insertQuery, [listingId, userId, content], (err, result) => {
    if (err) {
      console.error("Error inserting marketplace post:", err);
      return res.status(500).json({ error: 'Database error inserting post' });
    }
    const newPostId = result.insertId;
    const selectQuery = `
      SELECT p.post_id, p.user_id, p.content, p.created_at, p.post_type, p.marketplace_id,
             u.username, u.profile_picture_url
        FROM posts p
        JOIN users u ON p.user_id = u.user_id
       WHERE p.post_id = ?
         AND p.user_id NOT IN (
           SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
           UNION
           SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
         )
    `;
    connection.query(selectQuery, [newPostId, userId, userId], (err2, rows) => {
      if (err2) {
        console.error("Error selecting new marketplace post:", err2);
        return res.status(500).json({ error: 'Database error selecting new post' });
      }
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'Marketplace post not found after insert' });
      res.json(rows[0]);
    });
  });
});

/**
 * GET a Single Marketplace Post by ID
 * GET /marketplace/:listingId/posts/:postId
 */
router.get('/:listingId/posts/:postId', authenticateToken, (req, res) => {
  const { listingId, postId } = req.params;
  const userId = req.user.userId;
  const query = `
    SELECT p.post_id, p.user_id, p.content, p.created_at, p.post_type, p.marketplace_id,
           u.username, u.profile_picture_url
      FROM posts p
      JOIN users u ON p.user_id = u.user_id
     WHERE p.post_id = ?
       AND p.marketplace_id = ?
       AND p.post_type = 'marketplace'
       AND p.user_id NOT IN (
         SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
         UNION
         SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
       )
     LIMIT 1
  `;
  connection.query(query, [postId, listingId, userId, userId], (err, results) => {
    if (err) {
      console.error("Error fetching single marketplace post:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!results || results.length === 0) return res.status(404).json({ error: 'Marketplace post not found' });
    res.json(results[0]);
  });
});

/**
 * DELETE a Marketplace Post (owner only)
 * DELETE /marketplace/:listingId/posts/:postId
 * Also removes notifications with reference_type 'marketplace_post'
 */
router.delete('/:listingId/posts/:postId', authenticateToken, (req, res) => {
  const { listingId, postId } = req.params;
  const userId = req.user.userId;
  const deleteQuery = `
    DELETE FROM posts
    WHERE post_id = ? AND marketplace_id = ? AND user_id = ? AND post_type = 'marketplace'
  `;
  connection.query(deleteQuery, [postId, listingId, userId], (err, results) => {
    if (err) {
      console.error("Error deleting marketplace post:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.affectedRows === 0) return res.status(404).json({ error: 'Marketplace post not found or not authorized' });
    // Delete notifications attached to this post.
    const deleteNotifQuery = `
      DELETE FROM notifications
      WHERE reference_id = ? AND reference_type = 'marketplace_post'
    `;
    connection.query(deleteNotifQuery, [postId], (err2) => {
      if (err2) console.error("Error deleting post notifications:", err2);
      res.json({ message: 'Marketplace post deleted successfully' });
    });
  });
});

/**
 * LIKE a Marketplace Post
 * POST /marketplace/:listingId/posts/:postId/like
 * Creates a notification for the post owner if they are not the liker.
 */
router.post('/:listingId/posts/:postId/like', authenticateToken, (req, res) => {
  const { listingId, postId } = req.params;
  const userId = req.user.userId;
  const insertLikeQuery = `
    INSERT INTO likes (post_id, user_id)
    VALUES (?, ?)
  `;
  connection.query(insertLikeQuery, [postId, userId], (err) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY')
        return res.status(400).json({ error: 'Post already liked by this user' });
      console.error("Error liking marketplace post:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    const getPostQuery = 'SELECT user_id FROM posts WHERE post_id = ?';
    connection.query(getPostQuery, [postId], (err2, results) => {
      if (err2) console.error("Error fetching post owner:", err2);
      if (results && results.length > 0) {
        const postOwner = results[0].user_id;
        if (postOwner !== userId) {
          createNotification({
            user_id: postOwner,
            notification_type: 'MARKETPLACE_POST_LIKE',
            reference_id: postId,
            actor_id: userId,
            reference_type: 'marketplace_post',
            message: 'liked your marketplace post',
            url: `/marketplace/${listingId}?post=${postId}`
          });
        }
      }
      res.json({ message: 'Marketplace post liked successfully' });
    });
  });
});

/**
 * UNLIKE a Marketplace Post
 * DELETE /marketplace/:listingId/posts/:postId/like
 * Also deletes the notification associated with the like.
 */
router.delete('/:listingId/posts/:postId/like', authenticateToken, (req, res) => {
  const { listingId, postId } = req.params;
  const userId = req.user.userId;
  const query = `
    DELETE FROM likes
    WHERE post_id = ? AND user_id = ?
  `;
  connection.query(query, [postId, userId], (err, results) => {
    if (err) {
      console.error("Error unliking marketplace post:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.affectedRows === 0)
      return res.status(404).json({ error: 'Like not found or already removed' });
    // Delete associated notification.
    const deleteNotifQuery = `
      DELETE FROM notifications
      WHERE reference_id = ? 
        AND notification_type = 'MARKETPLACE_POST_LIKE'
        AND reference_type = 'marketplace_post'
        AND actor_id = ?
    `;
    connection.query(deleteNotifQuery, [postId, userId], (err2) => {
      if (err2) console.error("Error deleting notification for post like:", err2);
      res.json({ message: 'Marketplace post unliked successfully' });
    });
  });
});

/**
 * GET like count for a marketplace post
 * GET /marketplace/:listingId/posts/:postId/likes/count
 */
router.get('/:listingId/posts/:postId/likes/count', authenticateToken, (req, res) => {
  const { postId } = req.params;
  const query = `
    SELECT COUNT(*) AS likeCount
    FROM likes
    WHERE post_id = ?
  `;
  connection.query(query, [postId], (err, results) => {
    if (err) {
      console.error('Error fetching marketplace post like count:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ likeCount: results[0].likeCount });
  });
});

/**
 * Check if a marketplace post is liked by the user
 * GET /marketplace/:listingId/posts/:postId/liked
 */
router.get('/:listingId/posts/:postId/liked', authenticateToken, (req, res) => {
  const { postId } = req.params;
  const userId = req.user.userId;
  const query = `
    SELECT COUNT(*) AS liked
    FROM likes
    WHERE post_id = ? AND user_id = ?
  `;
  connection.query(query, [postId, userId], (err, results) => {
    if (err) {
      console.error("Error checking marketplace post like status:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ liked: results[0].liked > 0 });
  });
});

/**
 * --- Marketplace Comments Endpoints ---
 */

/**
 * CREATE a Comment on a Marketplace Post
 * POST /marketplace/:listingId/posts/:postId/comments
 */
router.post('/:listingId/posts/:postId/comments', authenticateToken, (req, res) => {
  const { listingId, postId } = req.params;
  const userId = req.user.userId;
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content is required' });
  const insertQuery = `
    INSERT INTO comments (post_id, user_id, content)
    VALUES (?, ?, ?)
  `;
  connection.query(insertQuery, [postId, userId, content], (err, result) => {
    if (err) {
      console.error("Error inserting marketplace comment:", err);
      return res.status(500).json({ error: 'Database error during insert' });
    }
    const newCommentId = result.insertId;
    const selectQuery = `
      SELECT c.comment_id, c.post_id, c.user_id, c.content, c.created_at, c.parent_comment_id,
             u.username, u.profile_picture_url
        FROM comments c
        JOIN users u ON c.user_id = u.user_id
       WHERE c.comment_id = ?
         AND c.user_id NOT IN (
           SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
           UNION
           SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
         )
    `;
    connection.query(selectQuery, [newCommentId, userId, userId], (err2, rows) => {
      if (err2) {
        console.error("Error selecting new marketplace comment:", err2);
        return res.status(500).json({ error: 'Database error during select' });
      }
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'Marketplace comment not found after insert' });
      res.json(rows[0]);
    });
  });
});

/**
 * GET a Single Marketplace Post by ID
 * GET /marketplace/:listingId/posts/:postId
 */
router.get('/:listingId/posts/:postId', authenticateToken, (req, res) => {
  const { listingId, postId } = req.params;
  const userId = req.user.userId;
  const query = `
    SELECT p.post_id, p.user_id, p.content, p.created_at, p.post_type, p.marketplace_id,
           u.username, u.profile_picture_url
      FROM posts p
      JOIN users u ON p.user_id = u.user_id
     WHERE p.post_id = ?
       AND p.marketplace_id = ?
       AND p.post_type = 'marketplace'
       AND p.user_id NOT IN (
         SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
         UNION
         SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
       )
     LIMIT 1
  `;
  connection.query(query, [postId, listingId, userId, userId], (err, results) => {
    if (err) {
      console.error("Error fetching single marketplace post:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!results || results.length === 0) return res.status(404).json({ error: 'Marketplace post not found' });
    res.json(results[0]);
  });
});

/**
 * DELETE a Marketplace Post (owner only)
 * DELETE /marketplace/:listingId/posts/:postId
 * Also removes notifications with reference_type 'marketplace_post'
 */
router.delete('/:listingId/posts/:postId', authenticateToken, (req, res) => {
  const { listingId, postId } = req.params;
  const userId = req.user.userId;
  const deleteQuery = `
    DELETE FROM posts
    WHERE post_id = ? AND marketplace_id = ? AND user_id = ? AND post_type = 'marketplace'
  `;
  connection.query(deleteQuery, [postId, listingId, userId], (err, results) => {
    if (err) {
      console.error("Error deleting marketplace post:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.affectedRows === 0) return res.status(404).json({ error: 'Marketplace post not found or not authorized' });
    // Delete notifications attached to this post.
    const deleteNotifQuery = `
      DELETE FROM notifications
      WHERE reference_id = ? AND reference_type = 'marketplace_post'
    `;
    connection.query(deleteNotifQuery, [postId], (err2) => {
      if (err2) console.error("Error deleting post notifications:", err2);
      res.json({ message: 'Marketplace post deleted successfully' });
    });
  });
});

/**
 * LIKE a Marketplace Post
 * POST /marketplace/:listingId/posts/:postId/like
 * Creates a notification for the post owner if they are not the liker.
 */
router.post('/:listingId/posts/:postId/like', authenticateToken, (req, res) => {
  const { listingId, postId } = req.params;
  const userId = req.user.userId;
  const insertLikeQuery = `
    INSERT INTO likes (post_id, user_id)
    VALUES (?, ?)
  `;
  connection.query(insertLikeQuery, [postId, userId], (err) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY')
        return res.status(400).json({ error: 'Post already liked by this user' });
      console.error("Error liking marketplace post:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    const getPostQuery = 'SELECT user_id FROM posts WHERE post_id = ?';
    connection.query(getPostQuery, [postId], (err2, results) => {
      if (err2) console.error("Error fetching post owner:", err2);
      if (results && results.length > 0) {
        const postOwner = results[0].user_id;
        if (postOwner !== userId) {
          createNotification({
            user_id: postOwner,
            notification_type: 'MARKETPLACE_POST_LIKE',
            reference_id: postId,
            actor_id: userId,
            reference_type: 'marketplace_post',
            message: 'liked your marketplace post',
            url: `/marketplace/${listingId}?post=${postId}`
          });
        }
      }
      res.json({ message: 'Marketplace post liked successfully' });
    });
  });
});

/**
 * UNLIKE a Marketplace Post
 * DELETE /marketplace/:listingId/posts/:postId/like
 * Also deletes the notification associated with the like.
 */
router.delete('/:listingId/posts/:postId/like', authenticateToken, (req, res) => {
  const { listingId, postId } = req.params;
  const userId = req.user.userId;
  const query = `
    DELETE FROM likes
    WHERE post_id = ? AND user_id = ?
  `;
  connection.query(query, [postId, userId], (err, results) => {
    if (err) {
      console.error("Error unliking marketplace post:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.affectedRows === 0)
      return res.status(404).json({ error: 'Like not found or already removed' });
    // Delete associated notification.
    const deleteNotifQuery = `
      DELETE FROM notifications
      WHERE reference_id = ? 
        AND notification_type = 'MARKETPLACE_POST_LIKE'
        AND reference_type = 'marketplace_post'
        AND actor_id = ?
    `;
    connection.query(deleteNotifQuery, [postId, userId], (err2) => {
      if (err2) console.error("Error deleting notification for post like:", err2);
      res.json({ message: 'Marketplace post unliked successfully' });
    });
  });
});

/**
 * GET like count for a marketplace post
 * GET /marketplace/:listingId/posts/:postId/likes/count
 */
router.get('/:listingId/posts/:postId/likes/count', authenticateToken, (req, res) => {
  const { postId } = req.params;
  const query = `
    SELECT COUNT(*) AS likeCount
    FROM likes
    WHERE post_id = ?
  `;
  connection.query(query, [postId], (err, results) => {
    if (err) {
      console.error('Error fetching marketplace post like count:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ likeCount: results[0].likeCount });
  });
});

/**
 * Check if a marketplace post is liked by the user
 * GET /marketplace/:listingId/posts/:postId/liked
 */
router.get('/:listingId/posts/:postId/liked', authenticateToken, (req, res) => {
  const { postId } = req.params;
  const userId = req.user.userId;
  const query = `
    SELECT COUNT(*) AS liked
    FROM likes
    WHERE post_id = ? AND user_id = ?
  `;
  connection.query(query, [postId, userId], (err, results) => {
    if (err) {
      console.error("Error checking marketplace post like status:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ liked: results[0].liked > 0 });
  });
});

/**
 * --- Marketplace Comments Endpoints ---
 */

/**
 * CREATE a Comment on a Marketplace Post
 * POST /marketplace/:listingId/posts/:postId/comments
 */
router.post('/:listingId/posts/:postId/comments', authenticateToken, (req, res) => {
  const { listingId, postId } = req.params;
  const userId = req.user.userId;
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content is required' });
  const insertQuery = `
    INSERT INTO comments (post_id, user_id, content)
    VALUES (?, ?, ?)
  `;
  connection.query(insertQuery, [postId, userId, content], (err, result) => {
    if (err) {
      console.error("Error inserting marketplace comment:", err);
      return res.status(500).json({ error: 'Database error during insert' });
    }
    const newCommentId = result.insertId;
    const selectQuery = `
      SELECT c.comment_id, c.post_id, c.user_id, c.content, c.created_at, c.parent_comment_id,
             u.username, u.profile_picture_url
        FROM comments c
        JOIN users u ON c.user_id = u.user_id
       WHERE c.comment_id = ?
         AND c.user_id NOT IN (
           SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
           UNION
           SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
         )
    `;
    connection.query(selectQuery, [newCommentId, userId, userId], (err2, rows) => {
      if (err2) {
        console.error("Error selecting new marketplace comment:", err2);
        return res.status(500).json({ error: 'Database error during select' });
      }
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'Marketplace comment not found after insert' });
      res.json(rows[0]);
    });
  });
});

/**
 * DELETE a Marketplace Comment (owner only)
 * DELETE /marketplace/:listingId/posts/:postId/comments/:commentId
 * Also deletes any notifications with reference_type 'marketplace_comment'
 */
router.delete('/:listingId/posts/:postId/comments/:commentId', authenticateToken, (req, res) => {
  const { listingId, postId, commentId } = req.params;
  const userId = req.user.userId;
  const deleteQuery = `
    DELETE FROM comments
    WHERE comment_id = ? AND post_id = ? AND user_id = ?
  `;
  connection.query(deleteQuery, [commentId, postId, userId], (err, results) => {
    if (err) {
      console.error("Error deleting marketplace comment:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "Marketplace comment not found or not authorized" });
    }
    const notifDeleteQuery = `
      DELETE FROM notifications
      WHERE reference_id = ? AND reference_type = 'marketplace_comment'
    `;
    connection.query(notifDeleteQuery, [commentId], (err2) => {
      if (err2) console.error("Error deleting marketplace comment notifications:", err2);
      res.json({ message: "Marketplace comment deleted successfully" });
    });
  });
});

/**
 * LIKE a Marketplace Comment
 * POST /marketplace/:listingId/posts/:postId/comments/:commentId/like
 * Creates a notification for the comment owner (if they are not the liker)
 */
router.post('/:listingId/posts/:postId/comments/:commentId/like', authenticateToken, (req, res) => {
  const { listingId, postId, commentId } = req.params;
  const userId = req.user.userId;
  const insertLikeQuery = `
    INSERT INTO comment_likes (comment_id, user_id)
    VALUES (?, ?)
  `;
  connection.query(insertLikeQuery, [commentId, userId], (err) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY')
        return res.status(400).json({ error: 'Comment already liked by this user' });
      console.error("Error liking marketplace comment:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    const getCommentQuery = 'SELECT user_id FROM comments WHERE comment_id = ?';
    connection.query(getCommentQuery, [commentId], (err2, results) => {
      if (err2) console.error("Error fetching comment owner:", err2);
      if (results && results.length > 0) {
        const commentOwner = results[0].user_id;
        if (commentOwner !== userId) {
          createNotification({
            user_id: commentOwner,
            notification_type: 'MARKETPLACE_COMMENT_LIKE',
            reference_id: commentId,
            actor_id: userId,
            reference_type: 'marketplace_comment',
            message: 'liked your marketplace comment',
            url: `/marketplace/${listingId}?post=${postId}&comment=${commentId}`
          });
        }
      }
      res.json({ message: 'Marketplace comment liked successfully' });
    });
  });
});

/**
 * Check if a marketplace comment is liked
 * GET /marketplace/:listingId/posts/:postId/comments/:commentId/liked
 */
router.get('/:listingId/posts/:postId/comments/:commentId/liked', authenticateToken, (req, res) => {
  const { commentId } = req.params;
  const userId = req.user.userId;
  const query = `
    SELECT COUNT(*) AS liked
    FROM comment_likes
    WHERE comment_id = ? AND user_id = ?
  `;
  connection.query(query, [commentId, userId], (err, results) => {
    if (err) {
      console.error("Error checking marketplace comment like status:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ liked: results[0].liked > 0 });
  });
});

/**
 * UNLIKE a Marketplace Comment
 * DELETE /marketplace/:listingId/posts/:postId/comments/:commentId/like
 * Also deletes the associated notification.
 */
router.delete('/:listingId/posts/:postId/comments/:commentId/like', authenticateToken, (req, res) => {
  const { commentId } = req.params;
  const userId = req.user.userId;
  const deleteQuery = `
    DELETE FROM comment_likes
    WHERE comment_id = ? AND user_id = ?
  `;
  connection.query(deleteQuery, [commentId, userId], (err, results) => {
    if (err) {
      console.error("Error unliking marketplace comment:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (results.affectedRows === 0)
      return res.status(404).json({ error: 'Like not found or already removed' });
    // Delete associated notification.
    const deleteNotifQuery = `
      DELETE FROM notifications
      WHERE reference_id = ? 
        AND notification_type = 'MARKETPLACE_COMMENT_LIKE'
        AND reference_type = 'marketplace_comment'
        AND actor_id = ?
    `;
    connection.query(deleteNotifQuery, [commentId, userId], (err2) => {
      if (err2) console.error("Error deleting notification for comment like:", err2);
      res.json({ message: 'Marketplace comment unliked successfully' });
    });
  });
});

/**
 * GET all comments for a marketplace post
 * GET /marketplace/:listingId/posts/:postId/comments
 */
router.get('/:listingId/posts/:postId/comments', authenticateToken, (req, res) => {
  const { listingId, postId } = req.params;
  const userId = req.user.userId;
  const query = `
    SELECT c.comment_id, c.post_id, c.user_id, c.content, c.created_at, c.parent_comment_id,
           u.username, u.profile_picture_url
    FROM comments c
    JOIN users u ON c.user_id = u.user_id
    WHERE c.post_id = ? 
      AND c.user_id NOT IN (
         SELECT blocked_id FROM blocked_users WHERE blocker_id = ?
         UNION
         SELECT blocker_id FROM blocked_users WHERE blocked_id = ?
      )
    ORDER BY c.created_at ASC
  `;
  connection.query(query, [postId, userId, userId], (err, results) => {
    if (err) {
      console.error("Error fetching marketplace comments:", err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

/**
 * REPLY to a Marketplace Comment
 * POST /marketplace/:listingId/comments/:commentId/reply
 * Creates a reply comment and notifies the owner of the parent comment.
 */
router.post('/:listingId/comments/:commentId/reply', authenticateToken, (req, res) => {
  const { listingId, commentId } = req.params;
  const userId = req.user.userId;
  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Content is required' });
  }
  const getParentQuery = 'SELECT post_id FROM comments WHERE comment_id = ?';
  connection.query(getParentQuery, [commentId], (err, parentResults) => {
    if (err) {
      console.error("Error fetching parent comment's post_id:", err);
      return res.status(500).json({ error: 'Database error retrieving parent comment' });
    }
    if (!parentResults || parentResults.length === 0) {
      return res.status(404).json({ error: 'Parent comment not found' });
    }
    const parentPostId = parentResults[0].post_id;
    const insertQuery = `
      INSERT INTO comments (post_id, parent_comment_id, user_id, content)
      VALUES (?, ?, ?, ?)
    `;
    connection.query(insertQuery, [parentPostId, commentId, userId, content], (err2, result) => {
      if (err2) {
        console.error("Error inserting marketplace reply:", err2);
        return res.status(500).json({ error: 'Database error during insert' });
      }
      const newCommentId = result.insertId;
      const selectQuery = `
        SELECT c.comment_id, c.post_id, c.parent_comment_id, c.user_id, c.content, c.created_at,
               u.username, u.profile_picture_url
        FROM comments c
        JOIN users u ON c.user_id = u.user_id
        WHERE c.comment_id = ?
      `;
      connection.query(selectQuery, [newCommentId], (err3, rows) => {
        if (err3) {
          console.error("Error selecting new marketplace reply:", err3);
          return res.status(500).json({ error: 'Database error during select' });
        }
        if (!rows || rows.length === 0) {
          return res.status(404).json({ error: 'Reply not found after insert' });
        }
        const getParentAuthorQuery = 'SELECT user_id FROM comments WHERE comment_id = ?';
        connection.query(getParentAuthorQuery, [commentId], (err4, parentAuthorResults) => {
          if (!err4 && parentAuthorResults.length > 0) {
            const parentOwner = parentAuthorResults[0].user_id;
            if (parentOwner !== userId) {
              createNotification({
                user_id: parentOwner,
                notification_type: 'MARKETPLACE_COMMENT_REPLY',
                reference_id: newCommentId,
                actor_id: userId,
                reference_type: 'marketplace_comment',
                message: 'Someone replied to your marketplace comment',
                url: `/marketplace/${listingId}?post=${parentPostId}&comment=${newCommentId}`
              });
            }
          }
        });
        res.json(rows[0]);
      });
    });
  });
});

export default router;
