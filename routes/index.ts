import { Router } from "express";
import showsRouter from "./shows.js";
import videosRouter from "./videos.js";
import searchRouter from "./search.js";
import torrentsRouter from "./torrents.js";
import imagesRouter from "./images.js";
import moviesRouter from "./movies.js";

const router = Router();
router.use("/show", showsRouter);
router.use("/video", videosRouter);
router.use("/search", searchRouter);
router.use("/torrent", torrentsRouter);
router.use("/image", imagesRouter);
router.use("/movie", moviesRouter);

export default router;