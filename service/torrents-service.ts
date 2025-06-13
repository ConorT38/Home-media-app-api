import { exec } from "child_process";
import { mapToJsonArray } from "../utils/mapper.js";

export class TorrentService {
    private transmissionAuth = "pi:raspberry";
    private baseStorageLocation = "/mnt/ext1/torrents";
    private searchApiBase = "http://192.168.0.25:8009/api/v1/search";

    public async listTorrents(): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const command = `transmission-remote --auth ${this.transmissionAuth} -l`;
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(stderr || "Failed to retrieve torrent status"));
                } else {
                    resolve(mapToJsonArray(stdout));
                }
            });
        });
    }

    public async searchTorrents(searchQuery: string, torrentSite: string): Promise<any> {
        const fetchUrl = `${this.searchApiBase}?site=${encodeURIComponent(torrentSite)}&query=${encodeURIComponent(searchQuery)}`;
        const response = await fetch(fetchUrl);
        const data = await response.json();
        return data;
    }

    public async addTorrent(magnetUri: string, category: string): Promise<{ message: string; output: string }> {
        if (!magnetUri) {
            throw new Error("Missing required parameter: magnetUri");
        }

        let storageLocation = this.baseStorageLocation;
        switch ((category || "").toLowerCase()) {
            case "movies":
                storageLocation = `${this.baseStorageLocation}/movies`;
                break;
            case "shows":
                storageLocation = `${this.baseStorageLocation}/shows`;
                break;
        }

        return new Promise((resolve, reject) => {
            const command = `transmission-remote --auth ${this.transmissionAuth} -a "${magnetUri}" -w "${storageLocation}"`;
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(stderr || "Failed to add torrent"));
                } else {
                    resolve({ message: "Torrent added successfully", output: stdout });
                }
            });
        });
    }
}