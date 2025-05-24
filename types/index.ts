/**
 * Represents a video entity with metadata and optional properties.
 */
export interface Video {
    /**
     * The unique identifier for the video.
     */
    id: number;

    /**
     * The title of the video.
     */
    title: string;

    /**
     * The path to the video file on the Content Delivery Network (CDN).
     */
    cdnPath: string;

    /**
     * The date and time when the video was uploaded.
     * This property is optional.
     */
    uploaded?: string;

    /**
     * The number of views the video has received.
     * This property is optional.
     */
    views?: number;

    /**
     * The type of entertainment the video belongs to (e.g., movie, series, etc.).
     * This property is optional and can be null.
     */
    entertainmentType?: string | null;
}

/**
 * Represents a show with its details.
 */
export interface Show {
    /**
     * The unique identifier for the show.
     */
    id: number;

    /**
     * The name of the show.
     */
    name: string;

    /**
     * A brief description of the show. This field is optional and can be null.
     */
    description?: string | null;

    /**
     * The unique identifier for the thumbnail image associated with the show.
     * This field is optional and can be null.
     */
    thumbnailId?: number | null;
}

/**
 * Represents a thumbnail image associated with a show or season.
 */
export interface Thumbnail {
    /**
     * The unique identifier for the thumbnail.
     */
    id: number;

    /**
     * The URL of the thumbnail image.
     */
    cdn_path: string;
}

/**
 * Represents a season of a show.
 */
export interface Season {
    /**
     * The unique identifier for the season.
     */
    id: number;

    /**
     * The name or title of the season.
     */
    name: string;

    /**
     * The season number within the show.
     */
    seasonNumber: number;

    /**
     * The unique identifier for the show this season belongs to.
     */
    showId: number;

    /**
     * A brief description of the season. This field is optional and can be null.
     */
    description?: string | null;

    /**
     * The unique identifier for the thumbnail image associated with the season.
     * This field is optional and can be null.
     */
    thumbnailId?: number | null;
}

/**
 * Represents an episode of a show or series.
 */
export interface Episode {
    /**
     * The unique identifier for the episode.
     */
    id: number;

    /**
     * The title of the episode.
     */
    title: string;

    /**
     * A brief description of the episode.
     * This field is optional and can be null.
     */
    description?: string | null;

    /**
     * The unique identifier of the season to which the episode belongs.
     */
    seasonId: number;

    /**
     * The unique identifier of the video associated with the episode.
     */
    videoId: number;
}