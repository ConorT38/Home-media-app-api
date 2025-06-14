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
            shows.*, 
            images.cdn_path as thumbnail_cdn_path,
            (
                SELECT COUNT(*) 
                FROM seasons 
                WHERE seasons.show_id = shows.id
            ) AS total_seasons,
            (
                SELECT COUNT(*) 
                FROM episodes 
                WHERE episodes.show_id = shows.id
            ) AS total_episodes
            FROM shows
            LEFT JOIN images ON shows.thumbnail_id = images.id
            ORDER BY shows.id LIMIT ? OFFSET ?`;
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

router.post("/:showId/season/:seasonId/episodes", async (req: Request, res: Response) => {
    try {
        const { showId, seasonId } = req.params;
        const episodes: { videoId: number; episodeNumber: number }[] = req.body.episodes;

        if (!Array.isArray(episodes) || episodes.length === 0) {
            res.status(400).json({ error: "Request body must contain a non-empty 'episodes' array" });
            return;
        }

        // Optionally, check if the show and season exist
        const seasonCheckSql = "SELECT * FROM seasons WHERE id = ? AND show_id = ?";
        const seasonCheck = await executeQuery<RowDataPacket[]>(seasonCheckSql, [seasonId, showId]);
        if (seasonCheck.length === 0) {
            res.status(404).json({ error: "Season not found for the given show" });
            return;
        }

        const sql = `
            INSERT INTO episodes (video_id, episode_number, season_id, show_id)
            VALUES ${episodes.map(() => "(?, ?, ?, ?)").join(", ")}
        `;
        const values: (string | number)[] = [];
        episodes.forEach(ep => {
            values.push(ep.videoId, ep.episodeNumber, seasonId, showId);
        });

        const result = await executeQuery<OkPacket>(sql, values);

        for (const ep of episodes) {
            await executeQuery<OkPacket>(
                `UPDATE videos
                 JOIN episodes ON videos.id = episodes.video_id
                 JOIN shows ON episodes.show_id = shows.id
                 SET videos.thumbnail_id = shows.thumbnail_id
                 WHERE videos.id = ? AND shows.id = ?`,
                [ep.videoId, showId]
            );
        }

        res.status(201).json({
            inserted: result.affectedRows,
            season_id: seasonId,
            episodes: episodes.map((ep, idx) => ({
                video_id: ep.videoId,
                episode_number: ep.episodeNumber,
                // Optionally, you can return the inserted IDs if needed
            })),
        });
    } catch (error: any) {
        res
            .status(error.status || 500)
            .json({ error: error.message || "An unexpected error occurred" });
    }
});

router.delete("/:seasonId/episodes", async (req: Request, res: Response) => {
    try {
        const { showId, seasonId } = req.params;
        const { episodeIds } = req.body;

        if (!Array.isArray(episodeIds) || episodeIds.length === 0) {
            res.status(400).json({ error: "Request body must contain a non-empty 'episodeIds' array" });
            return;
        }

        // Optionally, check if the season exists for the show
        const seasonCheckSql = "SELECT * FROM seasons WHERE id = ? AND show_id = ?";
        const seasonCheck = await executeQuery<RowDataPacket[]>(seasonCheckSql, [seasonId, showId]);
        if (seasonCheck.length === 0) {
            res.status(404).json({ error: "Season not found for the given show" });
            return;
        }

        const placeholders = episodeIds.map(() => "?").join(", ");
        const sql = `DELETE FROM episodes WHERE season_id = ? AND id IN (${placeholders})`;
        const values = [seasonId, ...episodeIds];

        const result = await executeQuery<OkPacket>(sql, values);

        res.json({ deleted: result.affectedRows, episodeIds });
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message || "An unexpected error occurred" });
    }
});

router.get("/", async (req: Request, res: Response) => {
    try {
        const { showId } = req.params;
        const sql = "SELECT * FROM seasons WHERE show_id = ?";
        const seasons = await executeQuery<RowDataPacket[]>(sql, [showId]);
        res.json(seasons);
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message || "An unexpected error occurred" });
    }
});

router.get("/:seasonId", async (req: Request, res: Response) => {
    try {
        const { showId, seasonId } = req.params;
        const sql = "SELECT * FROM seasons WHERE id = ? AND show_id = ?";
        const seasons = await executeQuery<RowDataPacket[]>(sql, [seasonId, showId]);
        if (seasons.length === 0) {
            res.status(404).json({ error: "Season not found for the given show" });
            return;
        }
        res.json(seasons[0]);
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message || "An unexpected error occurred" });
    }
});

router.post("/", async (req: Request, res: Response) => {
    try {
        const { showId } = req.params;
        console.log(showId);
        const { seasonNumber } = req.body;
        if (typeof seasonNumber !== "number") {
            res.status(400).json({ error: "Missing required fields: seasonNumber" });
            return;
        }
        const sql = "INSERT INTO seasons (show_id, season_number) VALUES (?, ?, ?)";
        const result = await executeQuery<OkPacket>(sql, [showId, seasonNumber]);
        res.status(201).json({ id: result.insertId, show_id: showId, season_number: seasonNumber });
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message || "An unexpected error occurred" });
    }
});

router.put("/:showId/season/:seasonId", async (req: Request, res: Response) => {
    try {
        const { showId, seasonId } = req.params;
        const { seasonNumber } = req.body;
        if (typeof seasonNumber !== "number") {
            res.status(400).json({ error: "'seasonNumber' must be provided" });
            return;
        }
        const fields: string[] = [];
        const values: (string | number)[] = [];

        if (typeof seasonNumber === "number") {
            fields.push("season_number = ?");
            values.push(seasonNumber);
        }
        values.push(seasonId, showId);
        const sql = `UPDATE seasons SET ${fields.join(", ")} WHERE id = ? AND show_id = ?`;
        const result = await executeQuery<OkPacket>(sql, values);
        if (result.affectedRows === 0) {
            res.status(404).json({ error: "Season not found for the given show" });
            return;
        }
        res.json({ updated: result.affectedRows });
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message || "An unexpected error occurred" });
    }
});

router.delete("/:showId/season/:seasonId", async (req: Request, res: Response) => {
    try {
        const { showId, seasonId } = req.params;
        const sql = "DELETE FROM seasons WHERE id = ? AND show_id = ?";
        const result = await executeQuery<OkPacket>(sql, [seasonId, showId]);
        if (result.affectedRows === 0) {
            res.status(404).json({ error: "Season not found for the given show" });
            return;
        }
        res.json({ deleted: result.affectedRows });
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message || "An unexpected error occurred" });
    }
});

///////// Seasons routes ////////

router.post("/:showId/season/:seasonId/episodes", async (req: Request, res: Response) => {
    try {
        const { showId, seasonId } = req.params;
        const episodes: { videoId: number; episodeNumber: number }[] = req.body.episodes;

        if (!Array.isArray(episodes) || episodes.length === 0) {
            res.status(400).json({ error: "Request body must contain a non-empty 'episodes' array" });
            return;
        }

        // Optionally, check if the show and season exist
        const seasonCheckSql = "SELECT * FROM seasons WHERE id = ? AND show_id = ?";
        const seasonCheck = await executeQuery<RowDataPacket[]>(seasonCheckSql, [seasonId, showId]);
        if (seasonCheck.length === 0) {
            res.status(404).json({ error: "Season not found for the given show" });
            return;
        }

        const sql = `
            INSERT INTO episodes (show_id, video_id, episode_number)
            VALUES ${episodes.map(() => "(?, ?, ?)").join(", ")}
        `;
        const values: (string | number)[] = [];
        episodes.forEach(ep => {
            values.push(showId, ep.videoId, ep.episodeNumber);
        });

        const result = await executeQuery<OkPacket>(sql, values);

        res.status(201).json({
            inserted: result.affectedRows,
            season_id: seasonId,
            episodes: episodes.map((ep, idx) => ({
                video_id: ep.videoId,
                episode_number: ep.episodeNumber,
                // Optionally, you can return the inserted IDs if needed
            })),
        });
    } catch (error: any) {
        res
            .status(error.status || 500)
            .json({ error: error.message || "An unexpected error occurred" });
    }
});

router.delete("/:showId/season/:seasonId/episodes", async (req: Request, res: Response) => {
    try {
        const { showId, seasonId } = req.params;
        const { episodeIds } = req.body;

        if (!Array.isArray(episodeIds) || episodeIds.length === 0) {
            res.status(400).json({ error: "Request body must contain a non-empty 'episodeIds' array" });
            return;
        }

        // Optionally, check if the season exists for the show
        const seasonCheckSql = "SELECT * FROM seasons WHERE id = ? AND show_id = ?";
        const seasonCheck = await executeQuery<RowDataPacket[]>(seasonCheckSql, [seasonId, showId]);
        if (seasonCheck.length === 0) {
            res.status(404).json({ error: "Season not found for the given show" });
            return;
        }

        const placeholders = episodeIds.map(() => "?").join(", ");
        const sql = `DELETE FROM episodes WHERE season_id = ? AND id IN (${placeholders})`;
        const values = [seasonId, ...episodeIds];

        const result = await executeQuery<OkPacket>(sql, values);

        res.json({ deleted: result.affectedRows, episodeIds });
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message || "An unexpected error occurred" });
    }
});

router.get("/:showId/season/", async (req: Request, res: Response) => {
    try {
        const { showId } = req.params;
        const sql = `
            SELECT 
            s.*, 
            v.*, 
            e.*, 
            i.cdn_path AS thumbnail_cdn_path
            FROM 
            seasons AS s
            INNER JOIN 
            episodes AS e ON e.show_id = s.show_id
            INNER JOIN 
            videos AS v ON e.video_id = v.id
            LEFT JOIN 
            images AS i ON v.thumbnail_id = i.id
            WHERE 
            s.show_id = ?
        `;
        const seasons = await executeQuery<RowDataPacket[]>(sql, [showId]);
        res.json(seasons);
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message || "An unexpected error occurred" });
    }
});

router.get("/:showId/season/:seasonNumber", async (req: Request, res: Response) => {
    try {
        const { showId, seasonNumber } = req.params;
        const sql = "SELECT * FROM seasons WHERE season_number = ? AND show_id = ?";
        const seasons = await executeQuery<RowDataPacket[]>(sql, [seasonNumber, showId]);
        if (seasons.length === 0) {
            res.status(404).json({ error: "Season not found for the given show" });
            return;
        }
        res.json(seasons[0]);
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message || "An unexpected error occurred" });
    }
});

router.post("/:showId/season", async (req: Request, res: Response) => {
    try {
        const { showId } = req.params;
        console.log(showId);
        const { seasonNumber } = req.body;
        if (typeof seasonNumber !== "number") {
            res.status(400).json({ error: "Missing required fields: seasonNumber" });
            return;
        }
        const sql = "INSERT INTO seasons (show_id, season_number) VALUES (?, ?)";
        const result = await executeQuery<OkPacket>(sql, [showId, seasonNumber]);
        res.status(201).json({ id: result.insertId, show_id: showId, season_number: seasonNumber });
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message || "An unexpected error occurred" });
    }
});

router.put("/:showId/season/:seasonId", async (req: Request, res: Response) => {
    try {
        const { showId, seasonId } = req.params;
        const { seasonNumber } = req.body;
        if (typeof seasonNumber !== "number") {
            res.status(400).json({ error: "'seasonNumber' must be provided" });
            return;
        }
        const fields: string[] = [];
        const values: (string | number)[] = [];

        if (typeof seasonNumber === "number") {
            fields.push("season_number = ?");
            values.push(seasonNumber);
        }
        values.push(seasonId, showId);
        const sql = `UPDATE seasons SET ${fields.join(", ")} WHERE id = ? AND show_id = ?`;
        const result = await executeQuery<OkPacket>(sql, values);
        if (result.affectedRows === 0) {
            res.status(404).json({ error: "Season not found for the given show" });
            return;
        }
        res.json({ updated: result.affectedRows });
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message || "An unexpected error occurred" });
    }
});

router.delete("/:showId/season/:seasonId", async (req: Request, res: Response) => {
    try {
        const { showId, seasonId } = req.params;
        const sql = "DELETE FROM seasons WHERE id = ? AND show_id = ?";
        const result = await executeQuery<OkPacket>(sql, [seasonId, showId]);
        if (result.affectedRows === 0) {
            res.status(404).json({ error: "Season not found for the given show" });
            return;
        }
        res.json({ deleted: result.affectedRows });
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message || "An unexpected error occurred" });
    }
});

router.get("/:id/season/:seasonNumber/episode/:episodeNumber", async (req: Request, res: Response) => {
    try {
        const { id, seasonNumber, episodeNumber } = req.params;
        const sql = `
            SELECT v.*, i.cdn_path AS thumbnail_cdn_path
            FROM shows s
            INNER JOIN seasons se ON se.show_id = s.id
            INNER JOIN episodes e ON e.season_id = se.id AND e.show_id = s.id
            INNER JOIN videos v ON v.id = e.video_id
            LEFT JOIN images i ON v.thumbnail_id = i.id
            WHERE s.id = ? AND se.season_number = ? AND e.episode_number = ?
            LIMIT 1
        `;
        const result = await executeQuery<RowDataPacket[]>(sql, [id, seasonNumber, episodeNumber]);
        if (result.length === 0) {
            res.status(404).json({ error: "Episode not found" });
            return;
        }
        res.json(result[0]);
    } catch (error: any) {
        res.status(error.status || 500).json({ error: error.message || "An unexpected error occurred" });
    }
});
export default router;