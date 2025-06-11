class TorrentService
{
    public async searchTorrents(searchQuery: string, torrentSite: string): Promise<any> {
        const fetchUrl = `http://192.168.0.25:8009/api/v1/search?site=${encodeURIComponent(torrentSite)}&query=${encodeURIComponent(searchQuery)}`;
        const response = await fetch(fetchUrl);
        const data = await response.json();
        return data;
    }
}