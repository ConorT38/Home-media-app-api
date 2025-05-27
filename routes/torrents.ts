import { Router, Request, Response } from "express";
import { exec } from "child_process";

const router = Router();

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

        if (!magnetLink) {
            res.status(400).json({ error: "Missing required body parameter: magnetLink" });
            return;
        }

        const command = `transmission-remote --auth pi:raspberry -a "${magnetLink}" -w "/mnt/ext1/torrents"`;
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

export default router;