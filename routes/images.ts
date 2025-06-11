import { Router, Request, Response } from "express";
import { executeQuery } from "../utils/database.js";
import { OkPacket, RowDataPacket } from "mysql2";
import multer from "multer";
import fs from "fs"; // Import the 'fs' module

const router = Router();

// Define the destination for uploaded files
const UPLOAD_DIR = "/mnt/ext1/images";

// Ensure the upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure Multer for file storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        // Use a unique filename to prevent collisions, e.g., timestamp + original name
        cb(null, Date.now() + "-" + file.originalname);
    },
});

const upload = multer({ storage: storage });

router.get("/", async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1; // Default to page 1 if not provided
        const limit = 20; // Number of items per page
        const offset = (page - 1) * limit;

        const sql = "SELECT * FROM images ORDER BY id LIMIT ? OFFSET ?";
        const result = await executeQuery<RowDataPacket[]>(sql, [limit, offset]);

        const countSql = "SELECT COUNT(*) as total FROM images";
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

router.get("/:id", async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        const sql = "SELECT * FROM images WHERE id = ?";
        const result = await executeQuery<RowDataPacket[]>(sql, [id]);
        console.log(result);
        res.send(result);
    } catch (error: any) {
        res
            .status(error.status || 500)
            .json({ error: error.message || "An unexpected error occurred" });
    }
});

// POST endpoint for file upload
router.post("/upload", upload.single("image"), async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: "No file uploaded." });
        }
        const file = req.file;
        const filename = file?.filename;
        
        const filepath = `/images/${filename}`; // Full path to the uploaded file

        // Optionally, save file information to your database
        // For example, if your 'images' table has columns like 'filename', 'filepath', 'mimetype', 'size'
        const sql = "INSERT INTO images (filename, cdn_path, uploaded) VALUES (?, ?, NOW())";
        const result = await executeQuery<OkPacket>(sql, [filename, filepath]);

        res.status(201).json({
            message: "File uploaded successfully",
            file: {
                id: result.insertId, // The ID of the newly inserted record
                filename,
                filepath,
            },
        });
    } catch (error: any) {
        // If an error occurs during file upload (e.g., disk full, permission denied)
        // or during database insertion
        res.status(error.status || 500).json({ error: error.message || "An unexpected error occurred during file upload." });
    }
});


router.put("/:id",
    async (req: Request, res: Response): Promise<void> => {
        try {
            const id = req.params.id;
            const { title } = req.body;
            if (title === undefined) {
                res.status(400).json({ error: "Missing 'title' in request body" });
                return;
            }
            // Update the images table
            const sql = "UPDATE images SET title = ? WHERE id = ?";
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

router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id;
        // First, retrieve the file path from the database to delete the file from the filesystem
        const selectSql = "SELECT filepath FROM images WHERE id = ?";
        const selectResult = await executeQuery<RowDataPacket[]>(selectSql, [id]);

        if (selectResult.length === 0) {
            res.status(404).json({ error: "Image not found" });
            return;
        }

        const filePathToDelete = selectResult[0].filepath;

        // Delete the record from the database
        const deleteSql = "DELETE FROM images WHERE id = ?";
        const deleteResult = await executeQuery<OkPacket>(deleteSql, [id]);

        if (deleteResult.affectedRows === 0) {
            res.status(404).json({ error: "Image not found" });
            return;
        }

        // Now, delete the file from the filesystem
        if (filePathToDelete && fs.existsSync(filePathToDelete)) {
            fs.unlinkSync(filePathToDelete);
            console.log(`Deleted file: ${filePathToDelete}`);
        } else {
            console.warn(`File not found on disk or path not available: ${filePathToDelete}`);
        }

        res.json({ message: "Image and associated file deleted successfully" });
    } catch (error: any) {
        res
            .status(error.status || 500)
            .json({ error: error.message || "An unexpected error occurred" });
    }
});


export default router;