import { Router, Request, Response } from "express";
import { exec } from "child_process";
import { mapToJsonArray } from "../utils/mapper.js";
import { executeQuery } from "../utils/database.js";
import { OkPacket } from "mysql2";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
    try {
        const command = `transmission-remote --auth pi:raspberry -l`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing command: ${stderr}`);
                res.status(500).json({ error: "Failed to retrieve torrent status" });
                return;
            }

            res.json(mapToJsonArray(stdout));
        });
    } catch (error: any) {
        res
            .status(error.status || 500)
            .json({ error: error.message || "An unexpected error occurred" });
    }
});

router.get("/search", async (req: Request, res: Response) => {
    try {
        const site = req.query.site as string;
        const query = req.query.query as string;

        if (!site || !query) {
            res.status(400).json({ error: "Missing required query parameters: site and query" });
            return;
        }

        const fetchUrl = `http://192.168.0.25:8009/api/v1/search?site=${encodeURIComponent(site)}&query=${encodeURIComponent(query)}`;
        const response = await fetch(fetchUrl);
        const data = await response.json();

        res.json(data);
    } catch (error: any) {
        res
            .status(error.status || 500)
            .json({ error: error.message || "An unexpected error occurred" });
    }
});

router.post("/download", async (req: Request, res: Response) => {
    try {
        const magnetLink = req.body.magnetUri as string;
        const category = req.body.category as string;
        const name = req.query.name as string;

        if (!magnetLink) {
            res.status(400).json({ error: "Missing required body parameter: magnetLink" });
            return;
        }

        var storageLocation = "/mnt/ext1/torrents";
        switch (category.toLocaleLowerCase()) {
            case "movies":
                storageLocation = "/mnt/ext1/torrents/movies";
                break;
            case "shows":
                storageLocation = "/mnt/ext1/torrents/tv";
                break;
        }

        if (category.toLocaleLowerCase() === "shows") {
            const insertShowSql = `
            INSERT INTO shows (name, description, show_folder)
            VALUES (?, ?, ?)
            `;
            const values = [name, name, storageLocation];

            try {
                const result = await executeQuery<OkPacket>(insertShowSql, values);
                console.debug(`Inserted show with ID: ${result.insertId}`);
            } catch (dbError) {
                console.error(`Database error: ${dbError}`);
                res.status(500).json({ error: "Failed to insert show into database" });
                return;
            }
        }

        const command = `transmission-remote --auth pi:raspberry -a "${magnetLink}" -w "${storageLocation}"`;
        console.log(`Executing command: ${command}`);
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing command: ${stderr}`);
                res.status(500).json({ error: "Failed to add torrent" });
                return;
            }

            res.json({ message: "Torrent added successfully", output: stdout });
        });
    } catch (error: any) {
        res
            .status(error.status || 500)
            .json({ error: error.message || "An unexpected error occurred" });
    }
});
router.post("/stop", async (req: Request, res: Response) => {
    try {
        const id = req.body.id as string;
        if (!id) {
            res.status(400).json({ error: "Missing required body parameter: id" });
            return;
        }
        const command = `transmission-remote --auth pi:raspberry -t ${id} -S`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing command: ${stderr}`);
                res.status(500).json({ error: "Failed to stop torrent" });
                return;
            }
            res.json({ message: "Torrent stopped successfully", output: stdout });
        });
    } catch (error: any) {
        res
            .status(error.status || 500)
            .json({ error: error.message || "An unexpected error occurred" });
    }
});

router.post("/start", async (req: Request, res: Response) => {
    try {
        const id = req.body.id as string;
        if (!id) {
            res.status(400).json({ error: "Missing required body parameter: id" });
            return;
        }
        const command = `transmission-remote --auth pi:raspberry -t ${id} -s`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing command: ${stderr}`);
                res.status(500).json({ error: "Failed to start torrent" });
                return;
            }
            res.json({ message: "Torrent started successfully", output: stdout });
        });
    } catch (error: any) {
        res
            .status(error.status || 500)
            .json({ error: error.message || "An unexpected error occurred" });
    }
});

router.post("/remove", async (req: Request, res: Response) => {
    try {
        const id = req.body.id as string;
        const deleteData = req.body.deleteData === true;
        if (!id) {
            res.status(400).json({ error: "Missing required body parameter: id" });
            return;
        }
        const flag = deleteData ? "-rad" : "-r";
        const command = `transmission-remote --auth pi:raspberry -t ${id} ${flag}`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing command: ${stderr}`);
                res.status(500).json({ error: "Failed to remove torrent" });
                return;
            }
            res.json({ message: "Torrent removed successfully", output: stdout });
        });
    } catch (error: any) {
        res
            .status(error.status || 500)
            .json({ error: error.message || "An unexpected error occurred" });
    }
});

export default router;