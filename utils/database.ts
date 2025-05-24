import mysql, { Pool, RowDataPacket, OkPacket, ResultSetHeader } from "mysql2/promise";

// Database configuration
const dbConfig = {
    host: "192.168.0.23",
    user: "root",
    password: "raspberry",
    database: "homemedia",
    connectionLimit: 10,
};

const pool: Pool = mysql.createPool(dbConfig);

// Utility function to handle database queries
export const executeQuery = async <T extends RowDataPacket[] | RowDataPacket[][] | OkPacket | OkPacket[] | ResultSetHeader>(
    sql: string,
    values?: any[]
): Promise<T> => {
    try {
        const [result] = await pool.execute<T>(sql, values);
        return result;
    } catch (err) {
        console.error("Database query error:", err);
        throw { status: 500, message: "Database error" };
    }
};