import { executeQuery } from "../utils/database.js";
import { OkPacket, RowDataPacket } from "mysql2";

export class VideoService {
    private readonly limit = 20;

   public async listVideos(page: number = 1) {
        const offset = (page - 1) * this.limit;
        const sql = `
            SELECT videos.*, images.cdn_path as thumbnail_cdn_path
            FROM videos
            LEFT JOIN images ON videos.thumbnail_id = images.id
            ORDER BY videos.id
            LIMIT ? OFFSET ?
        `;
        const result = await executeQuery<RowDataPacket[]>(sql, [this.limit, offset]);
        const countSql = "SELECT COUNT(*) as total FROM videos";
        const countResult = await executeQuery<RowDataPacket[]>(countSql);
        const total = countResult[0].total;
        return {
            page,
            totalPages: Math.ceil(total / this.limit),
            totalItems: total,
            items: result,
        };
    }

   public async getVideoById(id: string) {
        const updateViewsSql = "UPDATE videos SET views = views + 1 WHERE id = ?";
        await executeQuery<OkPacket>(updateViewsSql, [id]);
        const sql = `SELECT videos.*, images.cdn_path as thumbnail_cdn_path
            FROM videos
            LEFT JOIN images ON videos.thumbnail_id = images.id
            WHERE videos.id = ?`;
        const result = await executeQuery<RowDataPacket[]>(sql, [id]);
        if (result.length === 0) {
            throw { status: 404, message: "Video not found" };
        }
        return result[0];
    }

   public async updateVideo(id: string, title: string, thumbnailId?: number) {
        if (title === undefined) {
            throw { status: 400, message: "Missing 'title' in request body" };
        }
        let sql: string;
        let params: any[];
        if (thumbnailId !== undefined) {
            sql = "UPDATE videos SET title = ?, thumbnail_id = ? WHERE id = ?";
            params = [title, thumbnailId, id];
        } else {
            sql = "UPDATE videos SET title = ? WHERE id = ?";
            params = [title, id];
        }
        const result = await executeQuery<OkPacket>(sql, params);
        return { affectedRows: result.affectedRows };
    }

   public async updateTags(videoId: string, tags: string[]) {
        if (!Array.isArray(tags)) {
            throw { status: 400, message: "'tags' must be an array of strings" };
        }
        // 1. Get all existing tags for the video
        const existingSql = `
            SELECT t.id, t.tag
            FROM media_tags mt
            JOIN tags t ON mt.tag_id = t.id
            WHERE mt.media_type = 'video' AND mt.media_id = ?
        `;
        const existingTags = await executeQuery<RowDataPacket[]>(existingSql, [videoId]);
        const existingTagMap = new Map(existingTags.map((row: any) => [row.tag, row.id]));

        // 2. Ensure all tags exist in tags table, insert if missing
        let tagIds: number[] = [];
        for (const tag of tags) {
            if (existingTagMap.has(tag)) {
                tagIds.push(existingTagMap.get(tag));
                continue;
            }
            const insertTagSql = "INSERT IGNORE INTO tags (tag) VALUES (?)";
            await executeQuery<OkPacket>(insertTagSql, [tag]);
            const getTagIdSql = "SELECT id FROM tags WHERE tag = ?";
            const tagRows = await executeQuery<RowDataPacket[]>(getTagIdSql, [tag]);
            if (tagRows.length > 0) {
                tagIds.push(tagRows[0].id);
            }
        }

        // 3. Remove tags not in the new list
        const tagsToRemove = existingTags
            .filter((row: any) => !tags.includes(row.tag))
            .map((row: any) => row.id);
        if (tagsToRemove.length > 0) {
            const removeSql = `
                DELETE FROM media_tags
                WHERE media_type = 'video' AND media_id = ? AND tag_id IN (${tagsToRemove.map(() => '?').join(',')})
            `;
            await executeQuery<OkPacket>(removeSql, [videoId, ...tagsToRemove]);
        }

        // 4. Add new tags not already present
        const existingTagIds = existingTags.map((row: any) => row.id);
        const tagsToAdd = tagIds.filter(id => !existingTagIds.includes(id));
        if (tagsToAdd.length > 0) {
            const insertValues = tagsToAdd.map(() => "(?, 'video', ?)").join(",");
            const insertParams: any[] = [];
            tagsToAdd.forEach(tagId => {
                insertParams.push(tagId, videoId);
            });
            const insertSql = `
                INSERT INTO media_tags (tag_id, media_type, media_id)
                VALUES ${insertValues}
            `;
            await executeQuery<OkPacket>(insertSql, insertParams);
        }

        return { message: "Tags updated successfully" };
    }

   public async deleteVideo(id: string) {
        const sql = "DELETE FROM videos WHERE id = ?";
        const result = await executeQuery<OkPacket>(sql, [id]);
        if (result.affectedRows === 0) {
            throw { status: 404, message: "Video not found" };
        }
        return { message: "Video deleted successfully" };
    }
}