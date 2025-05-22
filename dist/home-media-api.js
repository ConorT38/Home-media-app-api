import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import fs from "fs";
import { createStream } from "rotating-file-stream";
import morgan from "morgan";
const app = express();
app.use(cors());
app.use(express.json());
// Create a rotating write stream
const logDirectory = "/var/log/home-media-api";
if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
}
const accessLogStream = createStream("access.log", {
    size: "5M", // rotate every 5MB
    interval: "1d", // rotate daily
    path: logDirectory,
});
// Middleware to log requests
app.use(morgan("combined", { stream: accessLogStream }));
// Database configuration
const dbConfig = {
    host: "192.168.0.23",
    user: "root",
    password: "raspberry",
    database: "homemedia",
    connectionLimit: 10,
};
const pool = mysql.createPool(dbConfig);
// Utility function to handle database queries
const executeQuery = async (sql, values) => {
    try {
        const [result] = await pool.execute(sql, values);
        return result;
    }
    catch (err) {
        console.error("Database query error:", err);
        throw { status: 500, message: "Database error" };
    }
};
// Routes
app.get("/api/search/:searchTerm", async (req, res) => {
    try {
        const searchTerm = `%${req.params.searchTerm}%`;
        const sql = "SELECT * FROM videos WHERE title LIKE ? OR filename LIKE ?";
        const result = await executeQuery(sql, [searchTerm, searchTerm]);
        console.log(result);
        res.send(result);
    }
    catch (error) {
        res
            .status(error.status || 500)
            .json({ error: error.message || "An unexpected error occurred" });
    }
});
app.get("/api/shows", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Default to page 1 if not provided
        const limit = 20; // Number of items per page
        const offset = (page - 1) * limit;
        const sql = "SELECT * FROM shows ORDER BY id LIMIT ? OFFSET ?";
        const result = await executeQuery(sql, [limit, offset]);
        const countSql = "SELECT COUNT(*) as total FROM shows";
        const countResult = await executeQuery(countSql);
        const total = countResult[0].total;
        res.json({
            page,
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            items: result,
        });
    }
    catch (error) {
        res
            .status(error.status || 500)
            .json({ error: error.message || "An unexpected error occurred" });
    }
});
app.get("/api/top/media", async (req, res) => {
    try {
        const sql = "SELECT * FROM videos ORDER BY id DESC LIMIT 21";
        const result = await executeQuery(sql);
        console.log(result);
        res.send(result);
    }
    catch (error) {
        res
            .status(error.status || 500)
            .json({ error: error.message || "An unexpected error occurred" });
    }
});
app.get("/api/video/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const sql = "SELECT * FROM videos WHERE id = ?";
        const result = await executeQuery(sql, [id]);
        console.log(result);
        res.send(result);
    }
    catch (error) {
        res
            .status(error.status || 500)
            .json({ error: error.message || "An unexpected error occurred" });
    }
});
app.put("/api/video/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const { title } = req.body;
        if (title === undefined) {
            res.status(400).json({ error: "Missing 'title' in request body" });
            return;
        }
        const sql = "UPDATE videos SET title = ? WHERE id = ?";
        const result = await executeQuery(sql, [title, id]);
        console.log(`${result.affectedRows} record(s) updated`);
        res.send(req.body);
    }
    catch (error) {
        res
            .status(error.status || 500)
            .json({ error: error.message || "An unexpected error occurred" });
    }
});
// Start the server
app.listen(8081, () => console.log("Listening on port 8081"));
