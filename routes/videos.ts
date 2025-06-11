import { Router, Request, Response } from "express";
import { executeQuery } from "../utils/database.js";
import { OkPacket, RowDataPacket } from "mysql2";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1; // Default to page 1 if not provided
        const limit = 20; // Number of items per page
        const offset = (page - 1) * limit;

        const sql = `
            SELECT videos.*, images.cdn_path
            FROM videos
            LEFT JOIN images ON videos.thumbnail_image_id = images.id
            ORDER BY videos.id
            LIMIT ? OFFSET ?
        `;
        const result = await executeQuery<RowDataPacket[]>(sql, [limit, offset]);

        const countSql = "SELECT COUNT(*) as total FROM videos";
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

        // Increment the views count
        const updateViewsSql = "UPDATE videos SET views = views + 1 WHERE id = ?";
        await executeQuery<OkPacket>(updateViewsSql, [id]);

        // Fetch the updated video record
        const sql = "SELECT * FROM videos WHERE id = ?";
        const result = await executeQuery<RowDataPacket[]>(sql, [id]);

        if (result.length === 0) {
            res.status(404).json({ error: "Video not found" });
            return;
        }

        res.json(result[0]);
    } catch (error: any) {
        res
            .status(error.status || 500)
            .json({ error: error.message || "An unexpected error occurred" });
    }
});

router.put("/:id",
    async (req: Request, res: Response): Promise<void> => {
        try {
            const id = req.params.id;
            const { title, thumbnailId, filename, filePath, mediaType} = req.body;
            if (title === undefined) {
                res.status(400).json({ error: "Missing 'title' in request body" });
                return;
            }
            let sql: string;
            let params: any[];
            if (thumbnailId !== undefined) {
                sql = "UPDATE videos SET title = ?, thumbnailId = ? WHERE id = ?";
                params = [title, thumbnailId, id];
            } else {
                sql = "UPDATE videos SET title = ? WHERE id = ?";
                params = [title, id];
            }
            const result = await executeQuery<OkPacket>(sql, [title, id]);
            console.log(`${result.affectedRows} record(s) updated`);

            res.send(req.body);
        } catch (error: any) {
            console.error(error);
            res
                .status(error.status || 500)
                .json({ error: error.message || "An unexpected error occurred" });
        }
    }
);

router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id;
        const sql = "DELETE FROM videos WHERE id = ?";
        const result = await executeQuery<OkPacket>(sql, [id]);

        if (result.affectedRows === 0) {
            res.status(404).json({ error: "Video not found" });
            return;
        }

        res.json({ message: "Video deleted successfully" });
    } catch (error: any) {
        res
            .status(error.status || 500)
            .json({ error: error.message || "An unexpected error occurred" });
    }
});

export default router;