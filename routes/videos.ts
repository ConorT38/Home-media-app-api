import { Router, Request, Response } from "express";
import { executeQuery } from "../utils/database.js";
import { OkPacket, RowDataPacket } from "mysql2";
import fs from "fs/promises";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1; // Default to page 1 if not provided
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // Number of items per page, max 100
        const offset = (page - 1) * limit;

        const sql = `
            SELECT videos.*, images.cdn_path as thumbnail_cdn_path
            FROM videos
            LEFT JOIN images ON videos.thumbnail_id = images.id
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

router.get("/by-ids", async (req: Request, res: Response) => {
    try {
        let ids = req.query.ids;
        if (!ids) {
            res.status(400).json({ error: "'ids' query parameter is required" });
            return;
        }
        if (typeof ids === "string") {
            // Handle both comma-separated and single value
            ids = ids.includes(",") ? ids.split(",") : [ids];
        }
        if (!Array.isArray(ids) || ids.length === 0) {
            res.status(400).json({ error: "'ids' must be a non-empty array or comma-separated string" });
            return;
        }
        // Ensure all ids are numbers
        const idList = ids.map(id => Number(id)).filter(id => !isNaN(id));
        if (idList.length === 0) {
            res.status(400).json({ error: "No valid video ids provided" });
            return;
        }

        const placeholders = idList.map(() => "?").join(",");
        const sql = `
            SELECT videos.*, images.cdn_path as thumbnail_cdn_path
            FROM videos
            LEFT JOIN images ON videos.thumbnail_id = images.id
            WHERE videos.id IN (${placeholders})
        `;
        const result = await executeQuery<RowDataPacket[]>(sql, idList);

        res.json({ items: result });
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
        const sql = `SELECT videos.*, images.cdn_path as thumbnail_cdn_path
            FROM videos
            LEFT JOIN images ON videos.thumbnail_id = images.id
            WHERE videos.id = ?`;
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
            const { title, thumbnailId } = req.body;
            console.log("Updating video with ID:", id, "Title:", title, "Thumbnail ID:", thumbnailId);
            if (title === undefined) {
                res.status(400).json({ error: "Missing 'title' in request body" });
                return;
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
            console.log(`${result.affectedRows} record(s) updated`);

            // Fetch the current filename
            const getFileSql = "SELECT filename FROM videos WHERE id = ?";
            const fileRows = await executeQuery<RowDataPacket[]>(getFileSql, [id]);
            if (fileRows.length === 0) {
                res.status(404).json({ error: "Video not found" });
                return;
            }
            const currentFilename = fileRows[0].filename;

            // Determine the new filename while preserving the directory structure
            const extension = currentFilename.split('.').pop(); // Get the file extension
            const directory = currentFilename.substring(0, currentFilename.lastIndexOf('/')); // Get the directory path
            let scrubbedTitle = title.replace(/ /g, "_"); // Replace spaces with underscores
            const chars = /['`*{}[\]()>#+\-!$]/g; // Characters to remove
            scrubbedTitle = scrubbedTitle.replace(chars, ""); // Remove unwanted characters
            const newFilename = `${directory}/${scrubbedTitle}.${extension}`;

            // Update the filename in the database
            const updateFilenameSql = "UPDATE videos SET filename = ? WHERE id = ?";
            await executeQuery<OkPacket>(updateFilenameSql, [newFilename, id]);

            // Rename the actual file on disk
            try {
                await fs.rename(currentFilename, newFilename);
                console.log(`File renamed from ${currentFilename} to ${newFilename}`);
            } catch (err: any) {
                console.error(`Failed to rename file: ${err.message}`);
                res.status(500).json({ error: "Failed to rename file on disk" });
                return;
            }

            // Update the movies.name where movies.video_id = videos.id
            const updateMoviesSql = "UPDATE movies SET name = ? WHERE video_id = ?";
            await executeQuery<OkPacket>(updateMoviesSql, [title, id]);
            console.log(`Movies table updated with name: ${title} for video_id: ${id}`);

            res.send(req.body);
        } catch (error: any) {
            console.error(error);
            res
                .status(error.status || 500)
                .json({ error: error.message || "An unexpected error occurred" });
        }
    }
);

router.put("/tag/:id", async (req: Request, res: Response): Promise<void> => {
    try {
        const videoId = req.params.id;
        const tags: string[] = req.body.tags;

        if (!Array.isArray(tags)) {
            res.status(400).json({ error: "'tags' must be an array of strings" });
            return;
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
            // Try to insert, ignore duplicate error
            const insertTagSql = "INSERT IGNORE INTO tags (tag) VALUES (?)";
            await executeQuery<OkPacket>(insertTagSql, [tag]);
            // Get tag id
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

        res.json({ message: "Tags updated successfully" });
    } catch (error: any) {
        res
            .status(error.status || 500)
            .json({ error: error.message || "An unexpected error occurred" });
    }
});

router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id;

        console.debug(`Deleting video with ID: ${id}`);
        // 1. Delete from movies table where video_id = id
        const deleteMoviesSql = "DELETE FROM movies WHERE video_id = ?";
        await executeQuery<OkPacket>(deleteMoviesSql, [id]);

        // 2. Get file_path before deleting video
        const getFilePathSql = "SELECT filename FROM videos WHERE id = ?";
        const fileRows = await executeQuery<RowDataPacket[]>(getFilePathSql, [id]);
        let filePath: string | undefined = fileRows.length > 0 ? fileRows[0].filename : undefined;

        console.debug(`File path for video ID ${id}: ${filePath}`);

        // 3. Delete from videos table
        const deleteVideoSql = "DELETE FROM videos WHERE id = ?";
        const result = await executeQuery<OkPacket>(deleteVideoSql, [id]);

        if (result.affectedRows === 0) {
            res.status(404).json({ error: "Video not found" });
            return;
        }

        // 4. Remove the file from disk if it exists
        if (filePath) {
            try {
                console.log(`Attempting to delete file at ${filePath}`);
                await fs.rm(filePath);
            } catch (err: any) {
                // Ignore file not found, but log other errors
                if (err.code !== "ENOENT") {
                    console.error(`Failed to delete file at ${filePath}:`, err);
                }
            }
        }

        res.json({ message: "Video deleted successfully" });
    } catch (error: any) {
        res
            .status(error.status || 500)
            .json({ error: error.message || "An unexpected error occurred" });
    }
});

router.get("/:id/episode-info", async (req: Request, res: Response): Promise<void> => {
    try {
        const videoId = req.params.id;

        const sql = `
            SELECT episodes.show_id, seasons.season_number, episodes.episode_number
            FROM episodes
            INNER JOIN seasons ON episodes.season_id = seasons.id
            WHERE episodes.video_id = ?
        `;
        const result = await executeQuery<RowDataPacket[]>(sql, [videoId]);

        if (result.length === 0) {
            res.status(404).json({ error: "Video is not associated with any episode" });
            return;
        }

        res.json(result[0]);
    } catch (error: any) {
        res
            .status(error.status || 500)
            .json({ error: error.message || "An unexpected error occurred" });
    }
});

export default router;