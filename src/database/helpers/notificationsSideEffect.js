import connection from '../db.js';

export function createNotification({
  user_id,
  notification_type,
  reference_id,
  actor_id,
  reference_type,
  message,
  group_id = null
}) {
  const query = `
    INSERT INTO notifications 
      (user_id, notification_type, reference_id, actor_id, reference_type, group_id, message, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW())
  `;
  const params = [
    user_id,
    notification_type,
    reference_id || null,
    actor_id || null,
    reference_type || null,
    group_id,
    message || ''
  ];
  connection.query(query, params, (err, results) => {
    if (err) {
      console.error("Error creating notification:", err);
    } else {
      console.log("Notification created with ID:", results.insertId);
    }
  });
}
