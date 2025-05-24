import { Router, Request, Response } from "express";
import { executeQuery } from "../utils/database.js";
import { RowDataPacket } from "mysql2";

const router = Router();

router.get("/:searchTerm", async (req: Request, res: Response) => {
    try {
        const searchTerm = `%${req.params.searchTerm}%`;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;

        const sql = "SELECT * FROM videos WHERE title LIKE ? OR filename LIKE ? LIMIT ? OFFSET ?";
        const result = await executeQuery<RowDataPacket[]>(sql, [searchTerm, searchTerm, limit, offset]);

        const countSql = "SELECT COUNT(*) as total FROM videos WHERE title LIKE ? OR filename LIKE ?";
        const countResult = await executeQuery<RowDataPacket[]>(countSql, [searchTerm, searchTerm]);
        const total = countResult[0]?.total || 0;

        res.json({
            data: result,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error: any) {
        res
            .status(error.status || 500)
            .json({ error: error.message || "An unexpected error occurred" });
    }
});

export default router;