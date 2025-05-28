import { Torrent } from "../types/index.js";

export function mapToJsonArray(input: string): Torrent[] {
    const lines = input.split('\n').slice(1).filter(line => line.trim() && !line.startsWith('Sum:'));
    const result: Torrent[] = [];

    for (const line of lines) {
        const match = line.match(
            /^\s*(\d+)\s{2,}(\d+%)\s{2,}([\d.]+\s\w+)\s{2,}([\w\s]+)\s{2,}([\d.]+)\s{2,}([\d.]+)\s{2,}([\d.]+)\s{2,}([\w &]+)\s{2,}(.+)$/
        );

        if (match) {
            const [, ID, Done, Have, ETA, Up, Down, Ratio, Status, Name] = match;
            result.push({
                id: parseInt(ID, 10),
                done: Done.replace('%', '').trim(),
                have: Have.trim(),
                eta: ETA.trim(),
                up: parseFloat(Up),
                down: parseFloat(Down),
                ratio: parseFloat(Ratio),
                status: Status.trim(),
                name: Name.trim(),
            });
        }
    }

    return result;
}