import { RowDataPacket } from "mysql2";
import { executeQuery } from "../utils/database.js";

export interface SearchResult {
    data: RowDataPacket[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export class SearchService {
    async searchVideos(
        searchTerm: string,
        page: number = 1,
        limit: number = 10
    ): Promise<SearchResult> {
        const likeTerm = `%${searchTerm}%`;
        const offset = (page - 1) * limit;

        const sql =
            "SELECT * FROM videos WHERE title LIKE ? OR filename LIKE ? LIMIT ? OFFSET ?";
        const result = await executeQuery<RowDataPacket[]>(
            sql,
            [likeTerm, likeTerm, limit, offset]
        );

        const countSql =
            "SELECT COUNT(*) as total FROM videos WHERE title LIKE ? OR filename LIKE ?";
        const countResult = await executeQuery<RowDataPacket[]>(
            countSql,
            [likeTerm, likeTerm]
        );
        const total = countResult[0]?.total || 0;

        return {
            data: result,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}