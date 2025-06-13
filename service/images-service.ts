import { OkPacket, RowDataPacket } from "mysql2";
import { executeQuery } from "../utils/database.js";
import fs from "fs";
import path from "path";

const UPLOAD_DIR = "/mnt/ext1/images";

export interface Image {
    id: number;
    filename: string;
    cdn_path: string;
    uploaded: string;
    title?: string;
    [key: string]: any;
}

export class ImageService {
    private uploadDir: string;

    constructor(uploadDir: string = UPLOAD_DIR) {
        this.uploadDir = uploadDir;
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    async listImages(page: number = 1, limit: number = 20) {
        const offset = (page - 1) * limit;
        const sql = "SELECT * FROM images ORDER BY id LIMIT ? OFFSET ?";
        const result = await executeQuery<RowDataPacket[]>(sql, [limit, offset]);

        const countSql = "SELECT COUNT(*) as total FROM images";
        const countResult = await executeQuery<RowDataPacket[]>(countSql);
        const total = countResult[0].total;

        return {
            page,
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            items: result,
        };
    }

    async getImageById(id: string | number): Promise<Image | null> {
        const sql = "SELECT id, cdn_path, uploaded, filename, title FROM images WHERE id = ?";
        const result = await executeQuery<RowDataPacket[]>(sql, [id]);
        if (result.length === 0) return null;
        const image: Image = {
            id: result[0].id,
            cdn_path: result[0].cdn_path,
            uploaded: result[0].uploaded,
            filename: result[0].filename,
            title: result[0].title,
        };
        return image;
    }

    async uploadImage(file: Express.Multer.File): Promise<{ id: number; filename: string; filepath: string }> {
        if (!file) {
            throw new Error("No file uploaded.");
        }
        const filename = file.filename;
        const filepath = `/images/${filename}`;
        const sql = "INSERT INTO images (filename, cdn_path, uploaded) VALUES (?, ?, NOW())";
        const result = await executeQuery<OkPacket>(sql, [filename, filepath]);
        return {
            id: result.insertId,
            filename,
            filepath,
        };
    }

    async updateImageTitle(id: string | number, title: string): Promise<boolean> {
        const sql = "UPDATE images SET title = ? WHERE id = ?";
        const result = await executeQuery<OkPacket>(sql, [title, id]);
        return result.affectedRows > 0;
    }

    async deleteImage(id: string | number): Promise<{ deleted: boolean; fileDeleted: boolean }> {
        // Get file path
        const selectSql = "SELECT filepath FROM images WHERE id = ?";
        const selectResult = await executeQuery<RowDataPacket[]>(selectSql, [id]);
        if (selectResult.length === 0) {
            throw new Error("Image not found");
        }
        const filePathToDelete = selectResult[0].filepath;
        // Delete DB record
        const deleteSql = "DELETE FROM images WHERE id = ?";
        const deleteResult = await executeQuery<OkPacket>(deleteSql, [id]);
        if (deleteResult.affectedRows === 0) {
            throw new Error("Image not found");
        }
        // Delete file from disk
        let fileDeleted = false;
        if (filePathToDelete) {
            // If filepath is relative, resolve to absolute
            let absPath = filePathToDelete.startsWith("/")
                ? filePathToDelete
                : path.join(this.uploadDir, filePathToDelete);
            if (fs.existsSync(absPath)) {
                fs.unlinkSync(absPath);
                fileDeleted = true;
            }
        }
        return { deleted: true, fileDeleted };
    }
}