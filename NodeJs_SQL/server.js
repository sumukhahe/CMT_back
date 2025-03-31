const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const app = express();

app.use(cors());
app.use(bodyParser.json());

// MySQL connection
const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "native_blog",
});

connection.connect((err) => {
  if (err) {
    console.error("Error connecting to DB:", err);
    return;
  }
  console.log("Connected to the MySQL database");
});

// Ensure the nativeuploads directory exists
const uploadsDir = path.join(__dirname, "nativeuploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage for image uploads into nativeuploads directory.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const fileExtension = path.extname(file.originalname);
    const fileName = Date.now() + fileExtension;
    cb(null, fileName);
  },
});
const upload = multer({ storage });

// Serve static files from the nativeuploads directory.
app.use("/nativeuploads", express.static(uploadsDir));

// Example endpoint for uploading an avatar.
// It will store the file in nativeuploads and return its relative path.
app.post("/api/upload-avatar", upload.single("avatar"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  const imagePath = `/nativeuploads/${req.file.filename}`;
  res.json({ path: imagePath });
});

// NEW endpoint for retrieving a user's profile from the 'users' table.
app.get("/api/user/get-profile", (req, res) => {
  const userId = req.query.id;
  if (!userId) {
    return res.status(400).json({ error: "User id is required" });
  }
  const query =
    "SELECT username, email, profile_image AS profileImage FROM users WHERE id = ?";
  connection.query(query, [userId], (err, results) => {
    if (err) {
      console.error("DB Error:", err);
      return res.status(500).json({ error: "Error fetching user profile" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    // Return the profileImage as stored (e.g. /nativeuploads/imagename.jpg)
    res.status(200).json(results[0]);
  });
});

// NEW endpoint for updating a user's profile in the 'users' table.
app.post("/api/user/update-profile", (req, res) => {
  const { id, username, profileImage } = req.body;
  if (!id) {
    return res.status(400).json({ error: "User id is required" });
  }
  const query = "UPDATE users SET username = ?, profile_image = ? WHERE id = ?";
  connection.query(query, [username, profileImage, id], (err, result) => {
    if (err) {
      console.error("DB Error:", err);
      return res.status(500).json({ error: "Error updating user profile" });
    }
    res
      .status(200)
      .json({ message: "Profile updated successfully", data: result });
  });
});

// Helper to get next ID for blog-post table.
const getNextId = (table, callback) => {
  const query = `SELECT MAX(\`sl.no\`) AS maxId FROM \`${table}\``;
  connection.query(query, (err, results) => {
    if (err) return callback(err);
    let newId = 1;
    if (results[0].maxId !== null) newId = results[0].maxId + 1;
    callback(null, newId);
  });
};

// -------------------------
// BLOG POST ENDPOINTS
// -------------------------

// POST Method to add a blog post.
app.post("/api/add-post", upload.single("file"), (req, res) => {
  console.log("Received Image upload request.");

  if (!req.file && !req.body.image) {
    return res
      .status(400)
      .json({ error: "No file uploaded or image URL provided" });
  }

  const { pname, aname, img_alt, img_title, pdesc, cname, up_date, stime } =
    req.body;

  // Get scheduled time with IST adjustment.
  let scheduledTime;
  if (stime && stime.trim() !== "") {
    try {
      const dateObj = new Date(stime);
      const utcTime = dateObj.getTime();
      const istTime = new Date(utcTime + 5.5 * 60 * 60 * 1000);
      scheduledTime = istTime.toISOString().slice(0, 19).replace("T", " ");
    } catch (err) {
      console.error("Error converting stime to IST:", err);
      scheduledTime = stime.replace("T", " ").replace("Z", "");
    }
  } else {
    const now = new Date();
    const utcTime = now.getTime();
    const istTime = new Date(utcTime + 5.5 * 60 * 60 * 1000);
    scheduledTime = istTime.toISOString().slice(0, 19).replace("T", " ");
  }

  console.log("Scheduled time in IST:", scheduledTime);

  // Format up_date in IST if provided.
  let formattedUpDate = null;
  if (up_date && up_date.trim() !== "") {
    try {
      const dateObj = new Date(up_date);
      const utcTime = dateObj.getTime();
      const istTime = new Date(utcTime + 5.5 * 60 * 60 * 1000);
      formattedUpDate = istTime.toISOString().slice(0, 19).replace("T", " ");
    } catch (err) {
      console.error("Error converting up_date to IST:", err);
      formattedUpDate = up_date.replace("T", " ").replace("Z", "");
    }
  }

  const imagePath = req.file
    ? `/nativeuploads/${req.file.filename}`
    : req.body.image;

  getNextId("blog-post", (err, newId) => {
    if (err) {
      return res
        .status(500)
        .json({ error: "Database error fetching max sl.no" });
    }
    const query = `
      INSERT INTO \`blog-post\` (\`sl.no\`, pimage, pname, aname, img_alt, img_title, pdesc, cname, up_date, stime) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      newId,
      imagePath,
      pname,
      aname,
      img_alt,
      img_title,
      pdesc,
      cname,
      formattedUpDate,
      scheduledTime,
    ];
    connection.query(query, values, (err, result) => {
      if (err) {
        console.error("DB Error:", err);
        return res
          .status(500)
          .json({ error: "Database error during insertion" });
      }
      res.status(200).json({
        message: "Post file uploaded and data saved successfully",
        data: result,
      });
    });
  });
});

// GET Method to retrieve all blog posts.
app.get("/api/get-posts", (req, res) => {
  const query = `
    SELECT 
      \`sl.no\` AS id, 
      pimage, 
      pname, 
      aname, 
      img_alt, 
      img_title, 
      pdesc, 
      cname, 
      up_date, 
      stime, 
      views 
    FROM \`blog-post\`
    ORDER BY stime DESC
  `;
  connection.query(query, (err, results) => {
    if (err) {
      console.error("DB Error:", err);
      return res
        .status(500)
        .json({ error: "Database error while fetching posts" });
    }
    res.status(200).json(results);
  });
});

// GET single post by id.
app.get("/api/get-posts/:id", (req, res) => {
  const postId = req.params.id;
  const query = "SELECT * FROM `blog-post` WHERE `sl.no` = ? LIMIT 1";
  connection.query(query, [postId], (err, results) => {
    if (err) {
      console.error("DB Error:", err);
      return res
        .status(500)
        .json({ error: "Database error while fetching post details" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }
    res.status(200).json(results[0]);
  });
});

// GET popular posts.
app.get("/api/popular-posts", (req, res) => {
  const query = `
    SELECT \`sl.no\` AS id,
           pimage AS imageUrl,
           pname AS title,
           pdesc AS excerpt,
           stime AS time,
           views AS visits
    FROM \`blog-post\`
    ORDER BY views DESC
    LIMIT 5
  `;
  connection.query(query, (err, results) => {
    if (err) {
      console.error("DB Error:", err);
      return res.status(500).json({
        error: "Database error while fetching popular posts",
      });
    }
    res.status(200).json(results);
  });
});

// PUT update post.
// PUT update post.
app.put("/api/update-post", (req, res) => {
  const {
    id,
    image,
    pname,
    aname,
    img_alt,
    img_title,
    pdesc,
    cname,
    up_date,
    stime,
  } = req.body;

  let formattedUpDate = up_date;
  let formattedStime = stime;

  // Format up_date to IST if provided.
  if (up_date && up_date !== "null" && up_date !== null) {
    try {
      const dateObj = new Date(up_date);
      const utcTime = dateObj.getTime();
      const istTime = new Date(utcTime + 5.5 * 60 * 60 * 1000);
      formattedUpDate = istTime.toISOString().slice(0, 19).replace("T", " ");
    } catch (err) {
      console.error("Error formatting up_date to IST:", err);
      formattedUpDate = up_date.replace("T", " ").replace("Z", "");
    }
  }

  // Format stime to IST if provided.
  if (stime && stime !== "null" && stime !== null) {
    try {
      const dateObj = new Date(stime);
      const utcTime = dateObj.getTime();
      const istTime = new Date(utcTime + 5.5 * 60 * 60 * 1000);
      formattedStime = istTime.toISOString().slice(0, 19).replace("T", " ");
    } catch (err) {
      console.error("Error formatting stime to IST:", err);
      formattedStime = stime.replace("T", " ").replace("Z", "");
    }
  }

  // Declare query and values variables outside the if/else.
  let query;
  let values;

  if (req.file) {
    // If a file is provided, update the image field.
    const imagePath = `/nativeuploads/${req.file.filename}`;
    query = `
      UPDATE \`blog-post\`
      SET pimage = ?, pname = ?, aname = ?, img_alt = ?, img_title = ?, pdesc = ?, cname = ?, up_date = ?, stime = ?
      WHERE \`sl.no\` = ?
    `;
    values = [
      imagePath,
      pname,
      aname,
      img_alt,
      img_title,
      pdesc,
      cname,
      formattedUpDate,
      formattedStime,
      id,
    ];
  } else {
    // If no file is provided, update all fields except the image.
    query = `
      UPDATE \`blog-post\`
      SET pname = ?, aname = ?, img_alt = ?, img_title = ?, pdesc = ?, cname = ?, up_date = ?, stime = ?
      WHERE \`sl.no\` = ?
    `;
    values = [
      pname,
      aname,
      img_alt,
      img_title,
      pdesc,
      cname,
      formattedUpDate,
      formattedStime,
      id,
    ];
  }

  connection.query(query, values, (err, result) => {
    if (err) {
      console.error("DB Error:", err);
      return res
        .status(500)
        .json({ error: `Database error while updating post: ${err.message}` });
    }
    res.status(200).json({
      message: "Post updated successfully",
      data: result,
    });
  });
});

// DELETE post.
app.delete("/api/delete-post", (req, res) => {
  const { id } = req.body;
  const query = "DELETE FROM `blog-post` WHERE `sl.no` = ?";
  connection.query(query, [id], (err, result) => {
    if (err) {
      console.error("DB Error:", err);
      return res
        .status(500)
        .json({ error: "Database error while deleting post" });
    }
    res.status(200).json({ message: "Post deleted successfully" });
  });
});

app.get("/api/notifications", (req, res) => {
  const query = `
    SELECT 
      \`sl.no\` AS id, 
      pimage, 
      pname, 
      aname, 
      img_alt, 
      img_title, 
      pdesc, 
      cname, 
      up_date, 
      stime, 
      views 
    FROM \`blog-post\`
    WHERE stime <= NOW()
    ORDER BY up_date DESC
    LIMIT 10
  `;
  connection.query(query, (err, results) => {
    if (err) {
      console.error("DB Error fetching notifications:", err);
      return res.status(500).json({
        error: "Database error while fetching notifications",
      });
    }
    res.status(200).json(results);
  });
});

// Mark all notifications (posts with stime <= NOW()) as read.
// You might need to add a field (e.g. `read` or `notifications_read`) to your blog-post table.
// Mark a single notification as read
app.post("/api/mark-notification-read", (req, res) => {
  const notificationId = req.body.id;

  // Error checking
  if (!notificationId) {
    return res.status(400).json({ error: "Missing notification ID" });
  }

  const query = `
    UPDATE \`blog-post\`
    SET read = 1
    WHERE \`sl.no\` = ? AND (read IS NULL OR read = 0)
  `;

  connection.query(query, [notificationId], (err, result) => {
    if (err) {
      console.error(
        `Error marking notification ${notificationId} as read:`,
        err
      );
      return res
        .status(500)
        .json({ error: "Database error marking notification as read" });
    }
    res.status(200).json({ message: "Notification marked as read" });
  });
});
// Mark a single notification as read
app.post("/api/mark-notification-read/:id", (req, res) => {
  const notificationId = req.params.id;
  const query = `
    UPDATE \`blog-post\`
    SET read = 1
    WHERE \`sl.no\` = ? AND (read IS NULL OR read = 0)
  `;

  connection.query(query, [notificationId], (err, result) => {
    if (err) {
      console.error(
        `Error marking notification ${notificationId} as read:`,
        err
      );
      return res
        .status(500)
        .json({ error: "Database error marking notification as read" });
    }
    res.status(200).json({ message: "Notification marked as read" });
  });
});

// First, let's update your server.js to get comment notifications for the admin panel

// Add this endpoint to fetch comment notifications
app.get("/api/admin/comment-notifications", (req, res) => {
  const query = `
    SELECT 
      c.id,
      c.comment_text,
      c.created_at,
      c.post_id,
      c.user_id,
      u.username,
      u.profile_image,
      bp.pname as post_name,
      bp.pimage as post_image,
      IFNULL(c.is_read, 0) as is_read
    FROM comments c
    JOIN users u ON c.user_id = u.id
    JOIN \`blog-post\` bp ON c.post_id = bp.\`sl.no\`
    WHERE c.is_read = 0 OR c.is_read IS NULL
    ORDER BY c.created_at DESC
    LIMIT 20
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.error("DB Error fetching comment notifications:", err);
      return res
        .status(500)
        .json({ error: "Database error while fetching comment notifications" });
    }

    res.status(200).json(results);
  });
});

// Add endpoint to mark a comment notification as read
app.post("/api/admin/mark-comment-read/:commentId", (req, res) => {
  const commentId = req.params.commentId;

  const query = `
    UPDATE comments
    SET is_read = 1
    WHERE id = ? AND (is_read IS NULL OR is_read = 0)
  `;

  connection.query(query, [commentId], (err, result) => {
    if (err) {
      console.error(`Error marking comment ${commentId} as read:`, err);
      return res
        .status(500)
        .json({ error: "Database error marking comment as read" });
    }

    res.status(200).json({ message: "Comment marked as read" });
  });
});

// Add endpoint to mark all comments as read
app.post("/api/admin/mark-all-comments-read", (req, res) => {
  const query = `
    UPDATE comments
    SET is_read = 1
    WHERE is_read IS NULL OR is_read = 0
  `;

  connection.query(query, (err, result) => {
    if (err) {
      console.error("Error marking all comments as read:", err);
      return res
        .status(500)
        .json({ error: "Database error marking all comments as read" });
    }

    res.status(200).json({ message: "All comments marked as read" });
  });
});

// SQL to add is_read column to the comments table if it doesn't exist
// ALTER TABLE comments ADD COLUMN is_read TINYINT(1) DEFAULT 0;

// PUT endpoint to increment post views
app.put("/api/increment-views/:id", (req, res) => {
  const postId = req.params.id;

  // First get the current views count
  const getViewsQuery =
    "SELECT views FROM `blog-post` WHERE `sl.no` = ? LIMIT 1";
  connection.query(getViewsQuery, [postId], (err, results) => {
    if (err) {
      console.error("DB Error fetching views:", err);
      return res
        .status(500)
        .json({ error: "Database error while fetching views count" });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Calculate new views count (handle null values)
    const currentViews = results[0].views || 0;
    const newViews = currentViews + 1;

    // Update the views count
    const updateQuery = "UPDATE `blog-post` SET views = ? WHERE `sl.no` = ?";
    connection.query(
      updateQuery,
      [newViews, postId],
      (updateErr, updateResult) => {
        if (updateErr) {
          console.error("DB Error updating views:", updateErr);
          return res
            .status(500)
            .json({ error: "Database error while updating views count" });
        }

        res.status(200).json({
          message: "Post views incremented successfully",
          newViewsCount: newViews,
        });
      }
    );
  });
});

// -------------------------
// CATEGORY ENDPOINTS
// -------------------------

// GET all categories.
app.get("/api/categories", (req, res) => {
  connection.query(
    "SELECT * FROM categories ORDER BY name ASC",
    (err, results) => {
      if (err) {
        console.error("DB Error:", err);
        return res
          .status(500)
          .json({ error: "Database error while fetching categories" });
      }
      res.status(200).json(results);
    }
  );
});

// POST a new category.
app.post("/api/add-category", (req, res) => {
  const { name } = req.body;
  if (!name || name.trim() === "") {
    return res.status(400).json({ error: "Category name is required" });
  }
  const query = "INSERT INTO categories (name) VALUES (?)";
  connection.query(query, [name.trim()], (err, result) => {
    if (err) {
      console.error("DB Error:", err);
      return res
        .status(500)
        .json({ error: "Database error while adding category" });
    }
    res
      .status(200)
      .json({ message: "Category added successfully", data: result });
  });
});

app.get("/api/related-posts/:category/:currentPostId", (req, res) => {
  const category = req.params.category;
  const currentPostId = req.params.currentPostId;

  const query = `
    SELECT 
      \`sl.no\` AS id, 
      pimage, 
      pname, 
      aname, 
      img_alt, 
      img_title, 
      pdesc, 
      cname, 
      up_date, 
      stime, 
      views 
    FROM \`blog-post\`
    WHERE cname = ? AND \`sl.no\` != ?
    ORDER BY stime DESC
    LIMIT 5
  `;

  connection.query(query, [category, currentPostId], (err, results) => {
    if (err) {
      console.error("DB Error:", err);
      return res
        .status(500)
        .json({ error: "Database error while fetching related posts" });
    }
    res.status(200).json(results);
  });
});

// -------------------------
// ACCOUNT ENDPOINTS (using table backusers)
// -------------------------

// Update profile settings (for backusers).
app.post("/api/update-profile", (req, res) => {
  let { id, username, profileImage, darkMode } = req.body;
  if (!id) {
    id = 1;
  }
  const query =
    "UPDATE backusers SET username = ?, profileimage = ?, darkmode = ? WHERE id = ?";
  connection.query(
    query,
    [username, profileImage, darkMode ? 1 : 0, id],
    (err, result) => {
      if (err) {
        console.error("DB Error:", err);
        return res
          .status(500)
          .json({ error: "Database error while updating profile" });
      }
      res
        .status(200)
        .json({ message: "Profile updated successfully", data: result });
    }
  );
});

// Update password (for backusers).
app.post("/api/update-password", (req, res) => {
  const { id, currentPassword, newPassword } = req.body;
  if (!id) {
    return res.status(400).json({ error: "User ID is required" });
  }
  const selectQuery = "SELECT password FROM backusers WHERE id = ?";
  connection.query(selectQuery, [id], (err, results) => {
    if (err) {
      console.error("DB Error (select):", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const storedPassword = results[0].password;
    console.log("Stored password:", storedPassword);
    console.log("Provided currentPassword:", currentPassword);
    if (storedPassword !== currentPassword) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }
    const updateQuery = "UPDATE backusers SET password = ? WHERE id = ?";
    connection.query(updateQuery, [newPassword, id], (err, result) => {
      if (err) {
        console.error("DB Error (update):", err);
        return res
          .status(500)
          .json({ error: "Database error while updating password" });
      }
      console.log("Update result:", result);
      if (result.affectedRows === 0) {
        return res
          .status(400)
          .json({ error: "No rows updated. Check if the user ID is correct." });
      }
      res
        .status(200)
        .json({ message: "Password updated successfully", data: result });
    });
  });
});

// Get profile endpoint (for backusers).
app.get("/api/get-profile", (req, res) => {
  let id = req.query.id || 1; // For demo purposes
  const query =
    "SELECT username, profileimage, darkmode FROM backusers WHERE id = ?";
  connection.query(query, [id], (err, results) => {
    if (err) {
      console.error("DB Error:", err);
      return res
        .status(500)
        .json({ error: "Database error while fetching profile" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(200).json(results[0]);
  });
});

// -------------------------
// NEW USER AUTH ENDPOINTS (using 'users' table)
// -------------------------

// Sign Up - Create new user (for users table).
app.post("/api/user/signup", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ error: "Username, email, and password are required." });
  }
  try {
    // Check if the username or email exists in the 'users' table
    const [rows] = await connection
      .promise()
      .query("SELECT * FROM users WHERE username = ? OR email = ?", [
        username,
        email,
      ]);
    if (rows.length > 0) {
      return res
        .status(400)
        .json({ error: "Username or email already exists." });
    }
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    // Insert new user with username, email, and hashed password
    const [result] = await connection
      .promise()
      .query("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", [
        username,
        email,
        hashedPassword,
      ]);
    // Generate JWT token
    const token = jwt.sign({ id: result.insertId, username }, "mysecret", {
      expiresIn: "1h",
    });
    res.status(200).json({ token, id: result.insertId, username, email });
  } catch (err) {
    console.error("User signup error:", err);
    res.status(500).json({ error: "Server error during signup." });
  }
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Missing credentials" });
  }
  const query = "SELECT * FROM backusers WHERE username = ?";
  connection.query(query, [username], (err, results) => {
    if (err) {
      console.error("DB Error:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (!results || results.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const user = results[0];
    if (user.password !== password) {
      return res.status(400).json({ error: "Invalid credentials" });
    }
    // Generate a JWT token valid for 1 hour.
    const token = jwt.sign(
      { id: user.id, username: user.username },
      "mysecret",
      { expiresIn: "1h" }
    );
    res.status(200).json({ token });
  });
});

// -----------------------------------------------------------------
// JWT Authentication Middleware
// -----------------------------------------------------------------
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "No token provided" });
  }
  // Expect header in the format: "Bearer <token>"
  const token = authHeader.split(" ")[1];
  jwt.verify(token, "mysecret", (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: "Failed to authenticate token" });
    }
    req.user = decoded; // decoded contains user id, username, etc.
    next();
  });
};
// -----------------------------------------------------------------
// User Signin Endpoint
// -----------------------------------------------------------------
app.post("/api/user/signin", async (req, res) => {
  const { username, password } = req.body; // 'username' can be username or email
  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username (or email) and password are required." });
  }
  try {
    // Retrieve user matching username or email
    const [rows] = await connection
      .promise()
      .query("SELECT * FROM users WHERE username = ? OR email = ?", [
        username,
        username,
      ]);
    if (rows.length === 0) {
      return res.status(400).json({ error: "Invalid credentials." });
    }
    const user = rows[0];
    // Compare provided password with stored hashed password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(400).json({ error: "Invalid credentials." });
    }
    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username },
      "mysecret",
      { expiresIn: "1h" }
    );
    res.status(200).json({
      token,
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.profile_image,
    });
  } catch (err) {
    console.error("User signin error:", err);
    res.status(500).json({ error: "Server error during signin." });
  }
});

// NEW endpoint for updating a user's password in the 'users' table.
// NEW endpoint for updating a user's password in the 'users' table.
app.post("/api/user/update-password", async (req, res) => {
  console.log("update-password endpoint hit");
  const { id, currentPassword, newPassword } = req.body;

  // Ensure id is provided and is a number
  if (!id) {
    return res.status(400).json({ error: "User ID is required" });
  }
  const userId = Number(id);
  if (isNaN(userId)) {
    return res.status(400).json({ error: "Invalid User ID" });
  }

  try {
    // Retrieve the user's hashed password from the 'users' table
    const [rows] = await connection
      .promise()
      .query("SELECT password FROM users WHERE id = ?", [userId]);
    if (rows.length === 0) {
      console.log(`User with id ${userId} not found.`);
      return res.status(404).json({ error: "User not found" });
    }
    const storedPassword = rows[0].password;
    console.log("Stored hashed password:", storedPassword);

    // Compare provided currentPassword with stored hashed password
    const isValid = await bcrypt.compare(currentPassword, storedPassword);
    if (!isValid) {
      console.log(`Current password is incorrect for user id ${userId}`);
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    // Update the password in the 'users' table
    const [result] = await connection
      .promise()
      .query("UPDATE users SET password = ? WHERE id = ?", [
        hashedNewPassword,
        userId,
      ]);
    if (result.affectedRows === 0) {
      return res
        .status(400)
        .json({ error: "No rows updated. Check if the user ID is correct." });
    }
    console.log(`Password updated successfully for user id ${userId}`);
    res
      .status(200)
      .json({ message: "Password updated successfully", data: result });
  } catch (err) {
    console.error("Error updating password:", err);
    res.status(500).json({ error: "Server error during password update." });
  }
});
// Updated search endpoint that properly handles category filtering
app.get("/api/search-posts", (req, res) => {
  // Read the search term and filter from query parameters
  const searchTerm = req.query.pname || "";
  const categoryFilter = req.query.filter || "";

  let query;
  let queryParams;

  // Check if we have a category filter (and it's not "All")
  if (categoryFilter && categoryFilter !== "All") {
    // Filter by both search term and category
    query = `
      SELECT 
        \`sl.no\` AS id, 
        pimage AS image, 
        pname AS title, 
        aname AS author, 
        img_alt,
        img_title, 
        pdesc AS excerpt, 
        cname, 
        up_date, 
        stime, 
        views 
      FROM \`blog-post\` 
      WHERE pname LIKE ? AND cname = ? 
      ORDER BY stime DESC
    `;
    queryParams = [`%${searchTerm}%`, categoryFilter];
  } else {
    // Filter by search term only
    query = `
      SELECT 
        \`sl.no\` AS id, 
        pimage AS image, 
        pname AS title, 
        aname AS author, 
        img_alt,
        img_title, 
        pdesc AS excerpt, 
        cname, 
        up_date, 
        stime, 
        views 
      FROM \`blog-post\` 
      WHERE pname LIKE ? 
      ORDER BY stime DESC
    `;
    queryParams = [`%${searchTerm}%`];
  }

  // Execute the query with the appropriate parameters
  connection.query(query, queryParams, (err, results) => {
    if (err) {
      console.error("DB Error:", err);
      return res
        .status(500)
        .json({ error: "Database error while searching posts" });
    }

    // Return the results
    res.status(200).json(results);
  });
});

// -------------------------
// COMMENTS ENDPOINTS
// -------------------------
// -----------------------------------------------------------------
// GET All Comments for a Specific Post
// -----------------------------------------------------------------
app.get("/api/posts/:postId/comments", (req, res) => {
  const postId = req.params.postId;
  const query = `
    SELECT c.id, c.comment_text, c.created_at, c.user_id, u.username, u.profile_image
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
  `;
  connection.query(query, [postId], (err, results) => {
    if (err) {
      console.error("DB Error retrieving comments:", err);
      return res
        .status(500)
        .json({ error: "Database error while fetching comments" });
    }
    res.status(200).json(results);
  });
});
// -----------------------------------------------------------------
// POST a New Comment for a Specific Post (Requires authentication)
// -----------------------------------------------------------------
app.post("/api/posts/:postId/comments", authenticate, (req, res) => {
  const postId = req.params.postId;
  const { comment_text } = req.body;
  // Ensure req.user is defined and has an id
  const user_id = req.user && req.user.id;
  console.log("POST /api/posts/:postId/comments called with:", {
    postId,
    user_id,
    comment_text,
  });

  if (!user_id || !comment_text) {
    console.error("Missing user_id or comment_text", { user_id, comment_text });
    return res
      .status(400)
      .json({ error: "User ID and comment text are required." });
  }

  const query =
    "INSERT INTO comments (post_id, user_id, comment_text) VALUES (?, ?, ?)";
  connection.query(query, [postId, user_id, comment_text], (err, result) => {
    if (err) {
      console.error("DB Error inserting comment:", err);
      return res
        .status(500)
        .json({ error: "Database error while adding comment" });
    }
    const insertedId = result.insertId;
    console.log("Inserted comment with id:", insertedId);

    // Retrieve the newly inserted comment along with user info
    const selectQuery = `
      SELECT c.id, c.comment_text, c.created_at, c.user_id, u.username, u.profile_image
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `;
    connection.query(selectQuery, [insertedId], (err, results) => {
      if (err) {
        console.error("DB Error retrieving comment:", err);
        return res
          .status(500)
          .json({ error: "Database error retrieving added comment" });
      }
      if (results.length === 0) {
        console.error("No comment found after insertion for id:", insertedId);
        return res
          .status(404)
          .json({ error: "Comment not found after insertion" });
      }
      console.log("Retrieved comment:", results[0]);
      res.status(200).json(results[0]);
    });
  });
});

// -----------------------------------------------------------------
// Update (Edit) a Comment (Requires authentication)
// -----------------------------------------------------------------
app.put("/api/comments/:commentId", authenticate, (req, res) => {
  const commentId = req.params.commentId;
  const { comment_text } = req.body;
  const user_id = req.user.id;

  if (!comment_text) {
    return res.status(400).json({ error: "Comment text is required" });
  }

  // Check if the comment belongs to the authenticated user.
  const checkQuery = "SELECT user_id FROM comments WHERE id = ?";
  connection.query(checkQuery, [commentId], (err, results) => {
    if (err) {
      console.error("DB Error checking comment ownership:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Comment not found" });
    }
    if (results[0].user_id !== user_id) {
      return res
        .status(403)
        .json({ error: "Unauthorized to edit this comment" });
    }

    const query = "UPDATE comments SET comment_text = ? WHERE id = ?";
    connection.query(query, [comment_text, commentId], (err, result) => {
      if (err) {
        console.error("DB Error updating comment:", err);
        return res
          .status(500)
          .json({ error: "Database error while updating comment" });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Comment not found" });
      }
      // Retrieve the updated comment.
      const selectQuery = `
        SELECT c.id, c.comment_text, c.created_at, c.user_id, u.username, u.profile_image
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.id = ?
      `;
      connection.query(selectQuery, [commentId], (err, results) => {
        if (err) {
          console.error("DB Error retrieving updated comment:", err);
          return res
            .status(500)
            .json({ error: "Database error retrieving updated comment" });
        }
        res.status(200).json(results[0]);
      });
    });
  });
});

// -----------------------------------------------------------------
// Delete a Comment (Requires authentication)
// -----------------------------------------------------------------
app.delete("/api/comments/:commentId", authenticate, (req, res) => {
  const commentId = req.params.commentId;
  const user_id = req.user.id;

  // Check if the comment belongs to the authenticated user.
  const checkQuery = "SELECT user_id FROM comments WHERE id = ?";
  connection.query(checkQuery, [commentId], (err, results) => {
    if (err) {
      console.error("DB Error checking comment ownership:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Comment not found" });
    }
    if (results[0].user_id !== user_id) {
      return res
        .status(403)
        .json({ error: "Unauthorized to delete this comment" });
    }

    const query = "DELETE FROM comments WHERE id = ?";
    connection.query(query, [commentId], (err, result) => {
      if (err) {
        console.error("DB Error deleting comment:", err);
        return res
          .status(500)
          .json({ error: "Database error while deleting comment" });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Comment not found" });
      }
      res.status(200).json({ message: "Comment deleted successfully" });
    });
  });
});
app.post("/api/posts/:postId/like", authenticate, (req, res) => {
  const postId = req.params.postId;
  const userId = req.user.id;

  // Check if the user already liked the post.
  const checkQuery =
    "SELECT * FROM user_likes WHERE user_id = ? AND post_id = ?";
  connection.query(checkQuery, [userId, postId], (err, results) => {
    if (err) {
      console.error("DB Error checking like:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.length > 0) {
      // Like already exists. Do not allow modification.
      return res
        .status(400)
        .json({ error: "You have already liked this post." });
    }

    // Increment the like count on the post.
    connection.query(
      "UPDATE `blog-post` SET likes = likes + 1 WHERE `sl.no` = ?",
      [postId],
      (err, updateResult) => {
        if (err) {
          console.error("DB Error updating likes:", err);
          return res
            .status(500)
            .json({ error: "Database error updating likes" });
        }
        if (updateResult.affectedRows === 0) {
          return res.status(404).json({ error: "Post not found" });
        }

        // Retrieve the post name from the blog-post table.
        connection.query(
          "SELECT pname FROM `blog-post` WHERE `sl.no` = ?",
          [postId],
          (err, postResults) => {
            if (err || postResults.length === 0) {
              console.error("DB Error retrieving post details:", err);
              return res
                .status(500)
                .json({ error: "Database error retrieving post details" });
            }
            const postName = postResults[0].pname;

            // Insert the like record into user_likes.
            connection.query(
              "INSERT INTO user_likes (user_id, post_id, post_name) VALUES (?, ?, ?)",
              [userId, postId, postName],
              (err, insertResult) => {
                if (err) {
                  console.error("DB Error inserting like:", err);
                  return res
                    .status(500)
                    .json({ error: "Database error storing like" });
                }
                connection.query(
                  "SELECT likes FROM `blog-post` WHERE `sl.no` = ?",
                  [postId],
                  (err, selectResults) => {
                    if (err) {
                      console.error("DB Error retrieving likes:", err);
                      return res
                        .status(500)
                        .json({ error: "Database error retrieving likes" });
                    }
                    return res
                      .status(200)
                      .json({ liked: true, likes: selectResults[0].likes });
                  }
                );
              }
            );
          }
        );
      }
    );
  });
});

// -----------------------------------------------------------------
// Check if a Post is Liked by the Authenticated User (Requires authentication)
// -----------------------------------------------------------------
app.get("/api/posts/:postId/isLiked", authenticate, (req, res) => {
  const postId = req.params.postId;
  const userId = req.user.id;
  const query = "SELECT * FROM user_likes WHERE user_id = ? AND post_id = ?";
  connection.query(query, [userId, postId], (err, results) => {
    if (err) {
      console.error("DB Error checking like:", err);
      return res
        .status(500)
        .json({ error: "Database error checking like status" });
    }
    const liked = results.length > 0;
    res.status(200).json({ liked });
  });
});

// Updated endpoint for fetching user liked posts
app.get("/api/user/liked-posts", (req, res) => {
  const userId = req.query.user_id;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  // Modified query to not use the created_at column from user_likes
  const query = `
    SELECT p.*
    FROM \`blog-post\` p
    JOIN user_likes l ON p.\`sl.no\` = l.post_id
    WHERE l.user_id = ?
    ORDER BY p.stime DESC
  `;

  connection.query(query, [userId], (err, results) => {
    if (err) {
      console.error("DB Error fetching liked posts:", err);
      return res
        .status(500)
        .json({ error: "Database error while fetching liked posts" });
    }

    // Make sure we're sending valid data
    const safeResults = results.map((post) => ({
      ...post,
      id: post["sl.no"] || post.id, // Ensure id is available
    }));

    res.status(200).json(safeResults);
  });
});

// Similarly, ensure the comments endpoint provides safe data
app.get("/api/user/comments", (req, res) => {
  const userId = req.query.user_id;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  const query = `
    SELECT c.*, p.pname AS post_title, p.\`sl.no\` AS post_id
    FROM comments c
    JOIN \`blog-post\` p ON c.post_id = p.\`sl.no\`
    WHERE c.user_id = ?
    ORDER BY c.created_at DESC
  `;

  connection.query(query, [userId], (err, results) => {
    if (err) {
      console.error("DB Error fetching user comments:", err);
      return res
        .status(500)
        .json({ error: "Database error while fetching user comments" });
    }
    res.status(200).json(results);
  });
});

// -------------------------
// START THE SERVER
// -------------------------
app.listen(5000, () => console.log("Server running on port 5000"));
