import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { testConnection } from "./config/db.js";
import aiRouter from "./routes/ai.js";
import authRouter from "./routes/auth.js";
import userRouter from "./routes/user.js";
import bookingRouter from "./routes/booking.js";
import paymentRouter from "./routes/payment.js";
import favoriteRouter from "./routes/favorite.js";
import movieRouter from "./routes/movie.js";
import showtimeRouter from "./routes/showtime.js";
import roomRouter from "./routes/room.js";
import reviewRouter from "./routes/review.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

//Middleware
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));

//Routes
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/ai", aiRouter);
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/booking", bookingRouter);
app.use("/api/payment", paymentRouter);
app.use("/api/favorites", favoriteRouter);
app.use("/api/movies", movieRouter);
app.use("/api/showtimes", showtimeRouter);
app.use("/api/rooms", roomRouter);
app.use("/api/reviews", reviewRouter);

//Khởi động Server
app.listen(PORT, async () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  await testConnection();
});
