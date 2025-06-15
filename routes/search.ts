import { Router, Request, Response } from "express";
import { executeQuery } from "../utils/database.js";
import { RowDataPacket } from "mysql2";

const router = Router();

router.get("/:searchTerm", async (req: Request, res: Response) => {
    try {
        const searchTerm = `%${req.params.searchTerm}%`;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 12;
        const offset = (page - 1) * limit;

        // Search for movies
        const moviesSql = `
            SELECT m.*, v.title AS video_title, i.cdn_path AS thumbnail_cdn_path
            FROM movies m
            INNER JOIN videos v ON m.video_id = v.id
            LEFT JOIN images i ON v.thumbnail_id = i.id
            WHERE v.title LIKE ?
            ORDER BY v.title ASC
            LIMIT ? OFFSET ?`;
        const movies = await executeQuery<RowDataPacket[]>(moviesSql, [searchTerm, limit, offset]);

        // Search for shows
        const showsSql = `
            SELECT s.*, i.cdn_path AS thumbnail_cdn_path,
                   COUNT(DISTINCT se.id) AS total_seasons, 
                   COUNT(DISTINCT e.video_id) AS total_episodes
            FROM shows s
            INNER JOIN seasons se ON se.show_id = s.id
            INNER JOIN episodes e ON e.season_id = se.id AND e.show_id = s.id
            LEFT JOIN images i ON s.thumbnail_id = i.id
            WHERE s.name LIKE ?
            GROUP BY s.id
            ORDER BY s.name ASC
            LIMIT ? OFFSET ?`;
        const shows = await executeQuery<RowDataPacket[]>(showsSql, [searchTerm, limit, offset]);

        // Search for individual videos
        const videosSql = `
            SELECT v.*, i.cdn_path AS thumbnail_cdn_path
            FROM videos v
            LEFT JOIN images i ON v.thumbnail_id = i.id
            WHERE v.title LIKE ?
            ORDER BY v.title ASC
            LIMIT ? OFFSET ?`;
        const videos = await executeQuery<RowDataPacket[]>(videosSql, [searchTerm, limit, offset]);

        // Get total counts for pagination
        const countMoviesSql = `
            SELECT COUNT(*) as total
            FROM movies m
            INNER JOIN videos v ON m.video_id = v.id
            WHERE v.title LIKE ?`;
        const countMoviesResult = await executeQuery<RowDataPacket[]>(countMoviesSql, [searchTerm]);
        const totalMovies = countMoviesResult[0]?.total || 0;

        const countShowsSql = `
            SELECT COUNT(DISTINCT s.id) as total
            FROM shows s
            INNER JOIN seasons se ON se.show_id = s.id
            INNER JOIN episodes e ON e.season_id = se.id AND e.show_id = s.id
            WHERE s.name LIKE ?`;
        const countShowsResult = await executeQuery<RowDataPacket[]>(countShowsSql, [searchTerm]);
        const totalShows = countShowsResult[0]?.total || 0;

        const countVideosSql = `
            SELECT COUNT(*) as total
            FROM videos v
            WHERE v.title LIKE ?`;
        const countVideosResult = await executeQuery<RowDataPacket[]>(countVideosSql, [searchTerm]);
        const totalVideos = countVideosResult[0]?.total || 0;

        res.json({
            data: {
                movies,
                shows,
                videos,
            },
            pagination: {
                movies: {
                    total: totalMovies,
                    page,
                    limit,
                    totalPages: Math.ceil(totalMovies / limit),
                },
                shows: {
                    total: totalShows,
                    page,
                    limit,
                    totalPages: Math.ceil(totalShows / limit),
                },
                videos: {
                    total: totalVideos,
                    page,
                    limit,
                    totalPages: Math.ceil(totalVideos / limit),
                },
            },
        });
    } catch (error: any) {
        res
            .status(error.status || 500)
            .json({ error: error.message || "An unexpected error occurred" });
    }
});

export default router;