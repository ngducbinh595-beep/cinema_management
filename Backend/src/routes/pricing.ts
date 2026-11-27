import { Router } from "express";
import {
  initPricingTable,
  getPricingTiers,
  updatePricingTier,
} from "../models/pricing.model.js";
import { authenticateToken, requireManagerOrAdmin } from "./auth.js";

const pricingRouter = Router();

initPricingTable();

const MIN_PRICE = 10000;
const MAX_PRICE = 2000000;

// GET /api/pricing?cinemaId=1 - Bảng giá vé theo khung giờ (công khai)
pricingRouter.get("/", async (req, res) => {
  try {
    const cinemaId = Number(req.query.cinemaId);
    const tiers = await getPricingTiers(Number.isInteger(cinemaId) && cinemaId > 0 ? cinemaId : undefined);
    return res.json({ success: true, data: tiers });
  } catch (error) {
    console.error("Lỗi lấy bảng giá vé:", error);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ khi tải bảng giá vé!" });
  }
});

// PUT /api/pricing/:id (admin/manager) - Body: { regularPrice, vipPrice, applyToShowtimes? }
pricingRouter.put("/:id", authenticateToken, requireManagerOrAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: "ID khung giá không hợp lệ!" });
    }

    const regularPrice = Number(req.body?.regularPrice);
    const vipPrice = Number(req.body?.vipPrice);
    const applyToShowtimes = Boolean(req.body?.applyToShowtimes);

    const valid = (v: number) => Number.isInteger(v) && v >= MIN_PRICE && v <= MAX_PRICE;
    if (!valid(regularPrice) || !valid(vipPrice)) {
      return res.status(400).json({
        success: false,
        message: `Giá vé phải là số nguyên từ ${MIN_PRICE.toLocaleString("vi-VN")} đến ${MAX_PRICE.toLocaleString("vi-VN")} đ!`,
      });
    }
    if (vipPrice < regularPrice) {
      return res.status(400).json({
        success: false,
        message: "Giá ghế VIP không được thấp hơn giá ghế thường!",
      });
    }

    const { tier, updatedShowtimes } = await updatePricingTier(id, regularPrice, vipPrice, applyToShowtimes);
    if (!tier) {
      return res.status(404).json({ success: false, message: "Không tìm thấy khung giá!" });
    }

    return res.json({
      success: true,
      message: applyToShowtimes
        ? `Đã cập nhật giá vé và áp dụng cho ${updatedShowtimes} suất chiếu sắp tới.`
        : "Đã cập nhật bảng giá vé.",
      data: { tier, updatedShowtimes },
    });
  } catch (error) {
    console.error("Lỗi cập nhật giá vé:", error);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ khi cập nhật giá vé!" });
  }
});

export default pricingRouter;
