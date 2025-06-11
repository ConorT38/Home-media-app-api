import { RowDataPacket } from "mysql2";

export interface ImagesDAO
{
  getAllImages(page:number, limit:number): Promise<RowDataPacket>;

  getImageById(imageId:number): Promise<RowDataPacket>;

  deleteImage(imageId:number): Promise<void>;

  createImage(fileName:string, cdnPath:string): Promise<void>;
}

export interface VideosDAO
{
  getAllVideos(page:number, limit:number): Promise<RowDataPacket>;

  getVideoById(videoId:number): Promise<RowDataPacket>;

  deleteVideo(videoId:number): Promise<void>;

  createVideo(fileName:string, cdnPath:string): Promise<void>;
}

export interface MoviesDAO
{
  getAllMovies(page:number, limit:number): Promise<RowDataPacket>;

  getMovieById(movieId:number): Promise<RowDataPacket>;

  deleteMovie(movieId:number): Promise<void>;

  createMovie(fileName:string, cdnPath:string): Promise<void>;
}

export interface SearchDAO
{
    query(searchTerm:string): Promise<RowDataPacket>;
}