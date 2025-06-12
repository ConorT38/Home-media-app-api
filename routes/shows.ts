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
            SELECT shows.*, images.cdn_path as thumbnail_cdn_path
            FROM shows
            LEFT JOIN images ON shows.thumbnail_id = images.id
            ORDER BY id LIMIT ? OFFSET ?`;
        const result = (await executeQuery<RowDataPacket[]>(sql, [limit, offset])) as Show[];

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

router.post("/", async (req: Request, res: Response) => {
    try {
        const { name, description, thumbnail_id } = req.body;

        if (!name || !description) {
            res.status(400).json({ error: "Missing 'name' or 'description' in request body" });
            return;
        }

        let sql = "INSERT INTO shows (name, description";
        const values: (string | number)[] = [name, description];

        if (thumbnail_id) {
            sql += ", thumbnail_id";
            values.push(thumbnail_id);
        }

        sql += ") VALUES (?, ?";
        if (thumbnail_id) {
            sql += ", ?";
        }
        sql += ")";

        const result = await executeQuery<OkPacket>(sql, values);

        res.status(201).json({
            id: result.insertId,
            name,
            description,
            ...(thumbnail_id && { thumbnail_id }),
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
        const sql = `
            SELECT shows.*, images.cdn_path as thumbnail_cdn_path
            FROM shows
            LEFT JOIN images ON shows.thumbnail_id = images.id
            WHERE shows.id = ?`;
        const result = await executeQuery<RowDataPacket[]>(sql, [id]);
        if (result.length === 0) {
            res.status(404).json({ error: "Show not found" });
            return;
        }
        res.send(result[0]);
    } catch (error: any) {
        res
            .status(error.status || 500)
            .json({ error: error.message || "An unexpected error occurred" });
    }
});

router.put("/:id", async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        const { name, description } = req.body;

        if (!name || !description) {
            res.status(400).json({ error: "Missing 'name' or 'description' in request body" });
            return;
        }

        const sql = "UPDATE shows SET name = ?, description = ? WHERE id = ?";
        const result = await executeQuery<OkPacket>(sql, [name, description, id]);

        if (result.affectedRows === 0) {
            res.status(404).json({ error: "Show not found" });
            return;
        }

        res.json({
            id,
            name,
            description,
        });
    } catch (error: any) {
        res
            .status(error.status || 500)
            .json({ error: error.message || "An unexpected error occurred" });
    }
});

export default router;