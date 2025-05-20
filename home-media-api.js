const express = require("express");
var cors = require("cors");
const app = express();
const mysql = require("mysql2");
const fs = require("fs");
const path = require("path");
const rfs = require("rotating-file-stream");

app.use(cors());
app.use(express.json());
// Create a rotating write stream
const logDirectory = "/var/log/home-media-api";
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory, { recursive: true });

const accessLogStream = rfs.createStream("access.log", {
  size: "5M", // rotate every 5MB
  interval: "1d", // rotate daily
  path: logDirectory,
});

// Middleware to log requests
app.use(require("morgan")("combined", { stream: accessLogStream }));
const dbConfig = {
  host: "192.168.0.23",
  user: "root",
  password: "raspberry",
  database: "homemedia",
  connectionLimit: 10,
};

const pool = mysql.createPool(dbConfig);

// Utility function to handle database queries
const executeQuery = (sql, values) => {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) {
        console.error("Error getting database connection", err);
        return reject({ status: 500, message: "Database error" });
      }

      connection.query(sql, values, (queryErr, result) => {
        connection.release();
        if (queryErr) {
          console.error("Database query error:", queryErr);
          return reject({ status: 500, message: "Database error" });
        }
        resolve(result);
      });
    });
  });
};

app.get("/api/search/:searchTerm", async function (req, res) {
  try {
    const searchTerm = `%${req.params.searchTerm}%`;
    const sql = "SELECT * FROM videos WHERE title LIKE ? OR filename LIKE ?";
    const result = await executeQuery(sql, [searchTerm, searchTerm]);
    console.log(result);
    res.send(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "An unexpected error occurred" });
  }
});

app.get("/api/top/media", async function (req, res) {
  try {
    const sql = "SELECT * FROM videos ORDER BY id DESC LIMIT 21";
    const result = await executeQuery(sql);
    console.log(result);
    res.send(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "An unexpected error occurred" });
  }
});

app.get("/api/video/:id", async function (req, res) {
  try {
    const id = req.params.id;
    const sql = "SELECT * FROM videos WHERE id = ?";
    const result = await executeQuery(sql, [id]);
    console.log(result);
    res.send(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "An unexpected error occurred" });
  }
});

app.post("/api/video/:id", async function (req, res) {
  try {
    const id = req.params.id;
    const { title } = req.body;
    if (title === undefined) {
      return res.status(400).json({ error: "Missing 'title' in request body" });
    }
    const sql = "UPDATE videos SET title = ? WHERE id = ?";
    const result = await executeQuery(sql, [title, id]);
    console.log(`${result.affectedRows} record(s) updated`);
    res.send(req.body);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "An unexpected error occurred" });
  }
});

app.listen(8081, () => console.log("Listening on port 8081"));