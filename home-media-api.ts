import express, { Request, Response } from "express";
import cors from "cors";
import { RowDataPacket } from "mysql2/promise";
import fs from "fs";
import { createStream } from "rotating-file-stream";
import morgan from "morgan";
import routes from "./routes/index.js";
import { executeQuery } from "./utils/database.js";

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

// Redirect console logs to a file
const consoleLogStream = createStream("console.log", {
  size: "5M", // rotate every 5MB
  interval: "1d", // rotate daily
  path: logDirectory,
});

const originalConsoleLog = console.log;
console.log = (...args) => {
  originalConsoleLog(...args);
  consoleLogStream.write(args.map(arg => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" ") + "\n");
};

// Use the routes
app.use("/api", routes);

app.get("/api/top/media", async (req: Request, res: Response) => {
  try {
    const sql = `SELECT videos.*, images.cdn_path as thumbnail_cdn_path 
                 FROM videos 
                 LEFT JOIN images on videos.thumbnail_id = images.id
                 ORDER BY uploaded DESC LIMIT 21`;
    const result = await executeQuery<RowDataPacket[]>(sql);
    console.log(result);

    res.send(result);
  } catch (error: any) {
    res
      .status(error.status || 500)
      .json({ error: error.message || "An unexpected error occurred" });
  }
});

// Start the server
app.listen(8081, () => console.log("Listening on port 8081"));