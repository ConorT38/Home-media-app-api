import { Router, Request, Response } from "express";
import { executeQuery } from "../utils/database.js";
import { OkPacket, RowDataPacket } from "mysql2";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1; // Default to page 1 if not provided
        const limit = 20; // Number of items per page
        const offset = (page - 1) * limit;

        const sql = "SELECT * FROM videos ORDER BY id LIMIT ? OFFSET ?";
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

router.put("/:id",
    async (req: Request, res: Response): Promise<void> => {
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