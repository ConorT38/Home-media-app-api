import express, { Request, Response } from "express";
import cors from "cors";
import mysql, { Pool, RowDataPacket, OkPacket, ResultSetHeader } from "mysql2/promise";
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

const pool: Pool = mysql.createPool(dbConfig);

// Utility function to handle database queries
const executeQuery = async <T extends RowDataPacket[] | RowDataPacket[][] | OkPacket | OkPacket[] | ResultSetHeader>(
  sql: string,
  values?: any[]
): Promise<T> => {
  try {
    const [result] = await pool.execute<T>(sql, values);
    return result;
  } catch (err) {
    console.error("Database query error:", err);
    throw { status: 500, message: "Database error" };
  }
};

// Routes
app.get("/api/search/:searchTerm", async (req: Request, res: Response) => {
  try {
    const searchTerm = `%${req.params.searchTerm}%`;
    const sql = "SELECT * FROM videos WHERE title LIKE ? OR filename LIKE ?";
    const result = await executeQuery<RowDataPacket[]>(sql, [searchTerm, searchTerm]);
    console.log(result);
    res.send(result);
  } catch (error: any) {
    res
      .status(error.status || 500)
      .json({ error: error.message || "An unexpected error occurred" });
  }
});

app.get("/api/shows", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1; // Default to page 1 if not provided
    const limit = 20; // Number of items per page
    const offset = (page - 1) * limit;

    const sql = "SELECT * FROM shows ORDER BY id LIMIT ? OFFSET ?";
    const result = await executeQuery<RowDataPacket[]>(sql, [limit, offset]);

    const countSql = "SELECT COUNT(*) as total FROM shows";
    const countResult = await executeQuery<RowDataPacket[]>(countSql);
    const total = countResult[0].total;

    res.json({
      page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      items: result,
    });
  } catch (error: any) {
    res
      .status(error.status || 500)
      .json({ error: error.message || "An unexpected error occurred" });
  }
});

app.get("/api/top/media", async (req: Request, res: Response) => {
  try {
    const sql = "SELECT * FROM videos ORDER BY id DESC LIMIT 21";
    const result = await executeQuery<RowDataPacket[]>(sql);
    console.log(result);

    res.send(result);
  } catch (error: any) {
    res
      .status(error.status || 500)
      .json({ error: error.message || "An unexpected error occurred" });
  }
});

app.get("/api/video/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const sql = "SELECT * FROM videos WHERE id = ?";
    const result = await executeQuery<RowDataPacket[]>(sql, [id]);
    console.log(result);
    res.send(result);
  } catch (error: any) {
    res
      .status(error.status || 500)
      .json({ error: error.message || "An unexpected error occurred" });
  }
});

app.put(
  "/api/video/:id",
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const id = req.params.id;
      const { title } = req.body;
      if (title === undefined) {
        res.status(400).json({ error: "Missing 'title' in request body" });
        return;
      }
      const sql = "UPDATE videos SET title = ? WHERE id = ?";
      const result = await executeQuery<OkPacket>(sql, [title, id]);
      console.log(`${result.affectedRows} record(s) updated`);
      res.send(req.body);
    } catch (error: any) {
      res
        .status(error.status || 500)
        .json({ error: error.message || "An unexpected error occurred" });
    }
  }
);

// Start the server
app.listen(8081, () => console.log("Listening on port 8081"));