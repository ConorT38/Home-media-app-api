import { executeQuery } from "../utils/database.js";
import { Show } from "../types";
import { OkPacket, RowDataPacket } from "mysql2/promise";

export class ShowService {
    private readonly limit = 20;

    async getShows(page: number = 1): Promise<{
        page: number;
        totalPages: number;
        totalItems: number;
        items: Show[];
    }> {
        const offset = (page - 1) * this.limit;
        const sql = `
            SELECT shows.*, images.cdn_path as thumbnail_cdn_path
            FROM shows
            LEFT JOIN images ON shows.thumbnail_id = images.id
            ORDER BY id LIMIT ? OFFSET ?`;
        const result = (await executeQuery<RowDataPacket[]>(sql, [this.limit, offset])) as Show[];

        const countSql = "SELECT COUNT(*) as total FROM shows";
        const countResult = await executeQuery<RowDataPacket[]>(countSql);
        const total = countResult[0].total;

        return {
            page,
            totalPages: Math.ceil(total / this.limit),
            totalItems: total,
            items: result,
        };
    }

    async createShow(data: { name: string; description: string; thumbnail_id?: number }): Promise<{
        id: number;
        name: string;
        description: string;
        thumbnail_id?: number;
    }> {
        const { name, description, thumbnail_id } = data;

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

        return {
            id: result.insertId,
            name,
            description,
            ...(thumbnail_id && { thumbnail_id }),
        };
    }

    async getShowById(id: string | number): Promise<Show & { thumbnail_cdn_path?: string } | null> {
        const sql = `
            SELECT shows.*, images.cdn_path as thumbnail_cdn_path
            FROM shows
            LEFT JOIN images ON shows.thumbnail_id = images.id
            WHERE shows.id = ?`;
        const result = await executeQuery<RowDataPacket[]>(sql, [id]);
        if (result.length === 0) {
            return null;
        }
        return result[0] as Show & { thumbnail_cdn_path?: string };
    }

    async updateShow(id: string | number, data: { name: string; description: string }): Promise<{
        id: string | number;
        name: string;
        description: string;
    } | null> {
        const { name, description } = data;
        const sql = "UPDATE shows SET name = ?, description = ? WHERE id = ?";
        const result = await executeQuery<OkPacket>(sql, [name, description, id]);

        if (result.affectedRows === 0) {
            return null;
        }

        return {
            id,
            name,
            description,
        };
    }
}