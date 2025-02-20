// buildCommentTree.js
export function buildCommentTree(comments) {
    // Step 1: Prepare a map of id -> comment object
    const map = {};
    for (const c of comments) {
      c.replies = [];
      map[c.comment_id] = c;
    }
  
    // Step 2: Create an array of top-level comments
    const rootComments = [];
  
    // Step 3: Link replies to their parent
    for (const c of comments) {
      if (c.parent_comment_id) {
        const parent = map[c.parent_comment_id];
        if (parent) {
          parent.replies.push(c);
        }
        // If no parent found, it's an orphan or parent was deleted
      } else {
        // No parent => top-level
        rootComments.push(c);
      }
    }
  
    // Return the top-level comments array
    return rootComments;
  }
  