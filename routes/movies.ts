import { Router, Request, Response } from "express";
import { executeQuery } from "../utils/database.js";
import { Show } from "../types";
import { OkPacket, RowDataPacket } from "mysql2/promise";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1; // Default to page 1 if not provided
        const limit = 20; // Number of items per page
        const offset = (page - 1) * limit;

        const sql = `
            SELECT 
            movies.id,
            movies.genre,
            videos.title,
            images.cdn_path as thumbnail_cdn_path
            FROM movies
            INNER JOIN videos ON movies.video_id = videos.id
            LEFT JOIN images ON videos.thumbnail_id = images.id
            ORDER BY movies.id LIMIT ? OFFSET ?`;
        const result = (await executeQuery<RowDataPacket[]>(sql, [limit, offset])) as Show[];

        const countSql = "SELECT COUNT(*) as total FROM movies";
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
        const { id } = req.params;

        const sql = `
            SELECT 
            movies.*, 
            videos.*, 
            images.cdn_path as thumbnail_cdn_path
            FROM movies
            INNER JOIN videos ON movies.video_id = videos.id
            LEFT JOIN images ON videos.thumbnail_id = images.id
            WHERE movies.id = ?`;
        const result = await executeQuery<RowDataPacket[]>(sql, [id]);

        if (result.length === 0) {
            res.status(404).json({ error: "Movie not found" });
        }

        res.json(result[0]);
    } catch (error: any) {
        res
            .status(error.status || 500)
            .json({ error: error.message || "An unexpected error occurred" });
    }
});

export default router;