const Device = require("../models/Device");
require("../models/User");
const { asyncHandler } = require("../middlewares/asyncHandler");
const { uploadToCloudinary } = require("../utils/cloudinary");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const positiveInteger = (value, fallback) => {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const publicDeviceFilter = () => ({
  status: "available",
  moderationStatus: { $in: ["approved", null] },
  isDeleted: false,
});

function applyDeviceFilters(query, filter) {
  for (const key of ["category", "q"]) {
    if (query[key] !== undefined && typeof query[key] !== "string") {
      return key + " must be a single string";
    }
  }
  const category = query.category?.trim().toLowerCase();
  if (category && category !== "all") {
    const escaped = category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.category = new RegExp("^" + escaped + "$", "i");
  }
  if (query.q?.trim()) {
    const escaped = query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");
    filter.$or = [{ name: regex }, { brand: regex }, { description: regex }];
  }
}

const getDeviceCategories = asyncHandler(async (req, res) => {
  const categories = await Device.distinct("category", publicDeviceFilter());
  const data = [...new Set(categories.filter(value => typeof value === "string")
    .map(value => value.trim().toLowerCase()).filter(Boolean))].sort();
  res.json({ success: true, data });
});

const getAvailableDevices = asyncHandler(async (req, res) => {
  const rawLimit = req.query.limit;
  const requestedLimit = rawLimit === undefined ? 100 : Number(rawLimit);
  if (rawLimit !== undefined &&
      (typeof rawLimit !== "string" || !/^\d+$/.test(rawLimit) ||
        !Number.isSafeInteger(requestedLimit) || requestedLimit < 1)) {
    return res.status(400).json({ success: false, message: "limit must be a positive integer" });
  }
  const filter = publicDeviceFilter();
  const filterError = applyDeviceFilters(req.query, filter);
  if (filterError) return res.status(400).json({ success: false, message: filterError });
  const limit = Math.min(requestedLimit, 100);
  const requestedPage = positiveInteger(req.query.page, 1);
  const page = Number.isSafeInteger((requestedPage - 1) * limit) ? requestedPage : 1;
  const devices = await Device.find(filter).sort({ createdAt: -1, _id: 1 })
    .skip(req.query.page === undefined ? 0 : (page - 1) * limit).limit(limit);
  const body = { success: true, count: devices.length, data: devices };
  if (req.query.page !== undefined) {
    const totalItems = await Device.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / limit);
    body.pagination = { page, limit, totalItems, totalPages, hasNextPage: page < totalPages };
  }
  return res.status(200).json(body);
});

const getNearbyDevices = asyncHandler(async (req, res) => {
  if (req.query.radius !== undefined && req.query.maxDistance !== undefined &&
      req.query.radius !== req.query.maxDistance) {
    return res.status(400).json({ success: false, message: "radius and maxDistance must agree" });
  }
  const values = {};
  for (const key of ["lat", "lng", "maxDistance"]) {
    const raw = key === "maxDistance" ? (req.query.radius ?? req.query.maxDistance) : req.query[key];
    if (key === "maxDistance" && raw === undefined) { values[key] = 5000; continue; }
    if (typeof raw !== "string" || raw.trim() === "" || !Number.isFinite(Number(raw))) {
      return res.status(400).json({ success: false, message: `${key} must be a single finite number` });
    }
    values[key] = Number(raw);
  }
  const { lat, lng, maxDistance } = values;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || maxDistance <= 0) {
    return res.status(400).json({ success: false, message: "lat/lng must be valid and maxDistance must be greater than 0 meters" });
  }
  const filter = publicDeviceFilter();
  const filterError = applyDeviceFilters(req.query, filter);
  if (filterError) return res.status(400).json({ success: false, message: filterError });
  // Preserve the Map endpoint's existing full-radius result contract.
  if (req.query.page === undefined && req.query.limit === undefined) {
    const records = await Device.aggregate([
      { $geoNear: {
        near: { type: "Point", coordinates: [lng, lat] }, key: "location",
        distanceField: "distanceMeters", spherical: true, maxDistance, query: filter,
      } },
      { $sort: { distanceMeters: 1, _id: 1 } },
    ]);
    const devices = records.map(record => ({
      ...Device.hydrate(record).toJSON(), distanceMeters: record.distanceMeters,
    }));
    return res.status(200).json({ success: true, count: devices.length, data: devices });
  }
  const limit = Math.min(positiveInteger(req.query.limit, 10), 10);
  const requestedPage = positiveInteger(req.query.page, 1);
  const page = Number.isSafeInteger((requestedPage - 1) * limit) ? requestedPage : 1;
  const [result] = await Device.aggregate([
    { $geoNear: {
      near: { type: "Point", coordinates: [lng, lat] }, key: "location",
      distanceField: "distanceMeters", spherical: true, maxDistance, query: filter,
    } },
    { $sort: { distanceMeters: 1, _id: 1 } },
    { $facet: {
      data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
      total: [{ $count: "count" }],
    } },
  ]);
  const documents = result.data.map(record => Device.hydrate(record));
  await Device.populate(documents, { path: "ownerId", select: "name avatar rating isVerified phone email address" });
  const data = documents.map((doc, index) => ({ ...doc.toJSON(), distanceMeters: result.data[index].distanceMeters }));
  const totalItems = result.total[0]?.count || 0;
  const totalPages = Math.ceil(totalItems / limit);
  return res.status(200).json({ success: true, count: data.length, data,
    pagination: { page, limit, totalItems, totalPages, hasNextPage: page < totalPages },
  });
});

const getMyDevices = asyncHandler(async (req, res) => {
  const devices = await Device.find({
    ownerId: req.user._id,
    isDeleted: false,
  }).sort({ createdAt: -1 });
  return res.status(200).json({
    success: true,
    message: "Lấy danh sách thiết bị thành công",
    data: devices,
  });
});

const createDevice = asyncHandler(async (req, res) => {
  const {
    name,
    brand,
    category,
    description,
    images,
    specs,
    pricePerDay,
    depositAmount,
    location,
    addressText,
  } = req.body || {};

  if (images !== undefined && (!Array.isArray(images) || images.some(image => typeof image !== "string"))) {
    return res.status(400).json({ success: false, message: "images must be an array of strings" });
  }
  if (specs !== undefined && (!specs || typeof specs !== "object" || Array.isArray(specs))) {
    return res.status(400).json({ success: false, message: "specs must be an object" });
  }

  const device = await Device.create({
    ownerId: req.user._id,
    name,
    brand,
    category,
    description,
    images,
    specs,
    pricePerDay,
    depositAmount,
    location,
    addressText,
  });

  return res.status(201).json({
    success: true,
    message: "Đăng thiết bị thành công",
    data: device,
  });
});

const uploadDeviceImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "Please upload a JPEG, PNG, or WebP image." });
  }

  // Tải ảnh trực tiếp lên Cloudinary với preset và cloud_name từ file .env
  const secureUrl = await uploadToCloudinary(req.file, "techshare/devices");
  if (secureUrl) {
    return res.status(201).json({
      success: true,
      data: { url: secureUrl },
    });
  }

  // Dự phòng lưu trữ local nếu Cloudinary tạm thời mất kết nối
  const uploadDir = path.resolve(__dirname, "../../uploads");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const filename = `${crypto.randomUUID()}-${req.file.originalname || "device.jpg"}`;
  const filepath = path.join(uploadDir, filename);
  if (req.file.buffer) {
    fs.writeFileSync(filepath, req.file.buffer);
  }
  return res.status(201).json({
    success: true,
    data: { url: `/uploads/${filename}` },
  });
});

const getDeviceById = asyncHandler(async (req, res) => {
  if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "ID thiết bị không hợp lệ",
    });
  }

  const device = await Device.findOne({
    _id: req.params.id,
    isDeleted: false,
  }).populate("ownerId", "name avatar rating isVerified address phone email");

  if (!device) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy thiết bị",
    });
  }

  res.status(200).json({
    success: true,
    data: device,
  });
});

module.exports = {
  getDeviceCategories,
  getAvailableDevices,
  getNearbyDevices,
  getMyDevices,
  createDevice,
  uploadDeviceImage,
  getDeviceById,
};
