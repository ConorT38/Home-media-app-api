import { Router } from "express";
import showsRouter from "./shows.js";
import videosRouter from "./videos.js";
import searchRouter from "./search.js";

const router = Router();

router.use("/shows", showsRouter);
router.use("/videos", videosRouter);
router.use("/search", searchRouter);

export default router;