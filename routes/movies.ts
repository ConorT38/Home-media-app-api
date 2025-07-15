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
            videos.title as name,
            images.cdn_path as thumbnail_cdn_path
            FROM movies
            INNER JOIN videos ON movies.video_id = videos.id
            LEFT JOIN images ON videos.thumbnail_id = images.id
            WHERE videos.browser_friendly = TRUE
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
            WHERE movies.id = ?
            AND videos.browser_friendly = TRUE`;
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

router.put("/:id", async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id;
        const { genre, name, thumbnailId } = req.body;

        if (name === undefined) {
            res.status(400).json({ error: "Missing 'name' in request body" });
            return;
        }

        let sql: string;
        let params: any[];

        if (thumbnailId !== undefined) {
            sql = `
                UPDATE movies
                INNER JOIN videos ON movies.video_id = videos.id
                SET videos.title = ?, movies.genre = ?, videos.thumbnail_id = ?
                WHERE movies.id = ?`;
            params = [name, genre, thumbnailId, id];
        } else {
            sql = `
                UPDATE movies
                INNER JOIN videos ON movies.video_id = videos.id
                SET videos.title = ?, movies.genre = ?
                WHERE movies.id = ?`;
            params = [name, genre, id];
        }

        const result = await executeQuery<OkPacket>(sql, params);
        console.log(`${result.affectedRows} record(s) updated`);

        if (result.affectedRows === 0) {
            res.status(404).json({ error: "Movie not found" });
            return;
        }

        res.send(req.body);
    } catch (error: any) {
        console.error(error);
        res
            .status(error.status || 500)
            .json({ error: error.message || "An unexpected error occurred" });
    }
});
export default router;