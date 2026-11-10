const mongoose = require("mongoose");
const Device = require("../models/Device");
const Booking = require("../models/Booking");
const Review = require("../models/Review");
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
    filter.name = regex;
  }
}

const getDeviceCategories = asyncHandler(async (req, res) => {
  const categories = await Device.distinct("category", publicDeviceFilter());
  const data = [...new Set(categories.filter(value => typeof value === "string")
    .map(value => value.trim().toLowerCase()).filter(Boolean))].sort();
  res.json({ success: true, data });
});

// Gán số lượt thuê thực tế (từ booking completed) và đánh giá sao thực tế (từ reviews)
async function attachCompletedBookingCounts(deviceObjects) {
  if (!Array.isArray(deviceObjects) || deviceObjects.length === 0) return deviceObjects;
  
  const idSet = new Set();
  const searchIds = [];
  for (const d of deviceObjects) {
    const raw = d._id || d.id;
    if (raw) {
      const str = raw.toString();
      if (!idSet.has(str)) {
        idSet.add(str);
        if (mongoose.Types.ObjectId.isValid(str)) {
          searchIds.push(new mongoose.Types.ObjectId(str));
        }
        searchIds.push(str);
      }
    }
  }
  if (searchIds.length === 0) return deviceObjects;

  try {
    const [counts, reviewStats] = await Promise.all([
      Booking.aggregate([
        { $match: { deviceId: { $in: searchIds }, status: 'completed' } },
        { $group: { _id: '$deviceId', count: { $sum: 1 } } },
      ]),
      Review.aggregate([
        { $match: { deviceId: { $in: searchIds }, targetType: { $ne: 'renter' } } },
        { $group: {
          _id: '$deviceId',
          count: { $sum: 1 },
          avgRating: { $avg: '$rating' },
        } },
      ]),
    ]);

    const countMap = new Map(counts.map(c => [c._id.toString(), c.count]));
    const reviewMap = new Map(reviewStats.map(r => [r._id.toString(), {
      count: r.count,
      avg: Number(r.avgRating.toFixed(1)),
    }]));

    return deviceObjects.map(d => {
      const doc = typeof d.toJSON === 'function' ? d.toJSON() : { ...d };
      const idStr = (doc._id || doc.id)?.toString();
      const completedCount = countMap.get(idStr) !== undefined ? countMap.get(idStr) : (doc.stats?.rentalCount || 0);
      const revData = reviewMap.get(idStr);

      const ratingCount = revData !== undefined ? revData.count : (doc.stats?.ratingCount || doc.reviewCount || 0);
      const ratingAvg = revData !== undefined ? revData.avg : (ratingCount > 0 ? (doc.stats?.ratingAvg || doc.rating || 0) : 0);

      const stats = {
        ...(doc.stats || {}),
        rentalCount: completedCount,
        ratingCount,
        ratingAvg,
      };

      return {
        ...doc,
        rentalCount: completedCount,
        ratingCount,
        ratingAvg,
        rating: ratingAvg,
        reviewCount: ratingCount,
        stats,
      };
    });
  } catch (err) {
    return deviceObjects;
  }
}

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
  const enrichedDevices = await attachCompletedBookingCounts(devices);
  const body = { success: true, count: enrichedDevices.length, data: enrichedDevices };
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
    const enrichedDevices = await attachCompletedBookingCounts(devices);
    return res.status(200).json({ success: true, count: enrichedDevices.length, data: enrichedDevices });
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
  const enrichedData = await attachCompletedBookingCounts(data);
  const totalItems = result.total[0]?.count || 0;
  const totalPages = Math.ceil(totalItems / limit);
  return res.status(200).json({ success: true, count: enrichedData.length, data: enrichedData,
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
    message: "Device list retrieved successfully",
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
    message: "Device created successfully",
    data: device,
  });
});

const updateMyDevice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!/^[a-fA-F0-9]{24}$/.test(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid device ID",
    });
  }

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
  const allowedCategories = [
    "smartphone",
    "laptop",
    "camera",
    "drone",
    "audio",
    "gaming",
    "tablet",
    "accessory",
  ];
  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof brand !== "string" ||
    !brand.trim() ||
    typeof category !== "string" ||
    !allowedCategories.includes(category) ||
    typeof description !== "string" ||
    !description.trim() ||
    !Array.isArray(images) ||
    images.length < 1 ||
    images.length > 8 ||
    images.some((image) => typeof image !== "string" || !image.trim()) ||
    !specs ||
    typeof specs !== "object" ||
    Array.isArray(specs) ||
    typeof addressText !== "string" ||
    !addressText.trim() ||
    !Number.isFinite(pricePerDay) ||
    pricePerDay < 10000 ||
    !Number.isFinite(depositAmount) ||
    depositAmount < 0 ||
    location?.type !== "Point" ||
    !Array.isArray(location.coordinates) ||
    location.coordinates.length !== 2 ||
    !location.coordinates.every(Number.isFinite) ||
    Math.abs(location.coordinates[0]) > 180 ||
    Math.abs(location.coordinates[1]) > 90
  ) {
    return res.status(400).json({
      success: false,
      message: "Please provide valid device information.",
    });
  }

  const userId = req.auth?.userId || req.auth?.id || req.user?._id;
  const device = await Device.findOneAndUpdate(
    {
      _id: id,
      ownerId: userId,
      isDeleted: false,
    },
    {
      $set: {
        name: name.trim(),
        brand: brand.trim(),
        category,
        description: description.trim(),
        images,
        specs,
        pricePerDay,
        depositAmount,
        "location.type": "Point",
        "location.coordinates": location.coordinates,
        "location.addressText": addressText.trim(),
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );
  if (!device) {
    return res.status(404).json({
      success: false,
      message: "Device not found or you do not have permission to update.",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Device updated successfully.",
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
      message: "Invalid device ID",
    });
  }

  const device = await Device.findOne({
    _id: req.params.id,
    isDeleted: false,
  }).populate("ownerId", "name avatar rating isVerified address phone email");

  if (!device) {
    return res.status(404).json({
      success: false,
      message: "Device not found",
    });
  }

  const [enriched] = await attachCompletedBookingCounts([device]);

  res.status(200).json({
    success: true,
    data: enriched,
  });
});

const updateDeviceStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!/^[a-fA-F0-9]{24}$/.test(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid device ID",
    });
  }

  const { status } = req.body || {};
  if (!["available", "maintenance", "hidden"].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid device status",
    });
  }

  const userId = req.auth?.userId || req.auth?.id || req.user?._id;
  const device = await Device.findOneAndUpdate({
    _id: id,
    ownerId: userId,
    isDeleted: false,
    status: { $ne: "rented" },
  }, {
    $set: { status },
  }, {
    new: true,
    runValidators: true,
  });
  if (!device) {
    const rentedDevice = await Device.exists({
      _id: id,
      ownerId: userId,
      isDeleted: false,
      status: "rented",
    });
    if (rentedDevice) {
      return res.status(409).json({
        success: false,
        message: "Cannot change status of an active rented device.",
      });
    }
    return res.status(404).json({
      success: false,
      message: "Device not found or you do not have permission to update.",
    });
  }
  return res.status(200).json({
    success: true,
    message: "Device status updated successfully.",
    data: device,
  });
});

const updateBlockedDates = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!/^[a-fA-F0-9]{24}$/.test(id)) {
    return res.status(400).json({
      success: false,
      message: "ID thiết bị không hợp lệ",
    });
  }

  const { blockedDates } = req.body || {};
  if (
    !Array.isArray(blockedDates) ||
    blockedDates.some((blockedDate) => {
      if (
        !blockedDate ||
        typeof blockedDate.startDate !== "string" ||
        typeof blockedDate.endDate !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(blockedDate.startDate) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(blockedDate.endDate)
      ) {
        return true;
      }
      const startDate = new Date(`${blockedDate.startDate}T00:00:00.000Z`);
      const endDate = new Date(`${blockedDate.endDate}T00:00:00.000Z`);
      return (
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime()) ||
        startDate.toISOString().slice(0, 10) !== blockedDate.startDate ||
        endDate.toISOString().slice(0, 10) !== blockedDate.endDate ||
        startDate > endDate ||
        (blockedDate.reason !== undefined &&
          typeof blockedDate.reason !== "string")
      );
    })
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid blocked dates list.",
    });
  }

  const userId = req.user?._id || req.auth?.id;
  const updatedDevice = await Device.findOneAndUpdate(
    {
      _id: id,
      ownerId: userId,
      isDeleted: false,
    },
    {
      $set: {
        blockedDates: blockedDates.map(({ startDate, endDate, reason }) => ({
          startDate: new Date(`${startDate}T00:00:00.000Z`),
          endDate: new Date(`${endDate}T00:00:00.000Z`),
          reason: reason || "",
        })),
      },
    },
    { new: true, runValidators: true },
  ).select("blockedDates").lean();
  if (!updatedDevice) {
    return res.status(404).json({
      success: false,
      message: "Device not found or you do not have permission to update.",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Blocked calendar updated successfully.",
    data: updatedDevice.blockedDates,
  });
});

const deleteMyDevice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!/^[a-fA-F0-9]{24}$/.test(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid device ID",
    });
  }

  const userId = req.user?._id || req.auth?.id;
  const deviceFilter = {
    _id: id,
    ownerId: userId,
    isDeleted: false,
  };
  const ownedDevice = await Device.exists(deviceFilter);
  if (!ownedDevice) {
    return res.status(404).json({
      success: false,
      message: "Device not found or you do not have permission to delete.",
    });
  }

  const hasActiveBooking = await Booking.exists({
    deviceId: id,
    status: { $in: ["pending", "approved", "active", "disputed"] },
  });
  if (hasActiveBooking) {
    return res.status(409).json({
      success: false,
      message: "Cannot delete device with active or pending bookings.",
    });
  }

  const device = await Device.findOneAndUpdate(
    { ...deviceFilter, status: { $ne: "rented" } },
    { $set: { isDeleted: true } },
    { new: true },
  ).select("_id").lean();
  if (!device) {
    const rentedDevice = await Device.exists({
      ...deviceFilter,
      status: "rented",
    });
    if (rentedDevice) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete device currently on rent.",
      });
    }
    return res.status(404).json({
      success: false,
      message: "Device not found or you do not have permission to delete.",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Device deleted successfully.",
    data: { _id: device._id },
  });
});

module.exports = {
  getDeviceCategories,
  getAvailableDevices,
  getNearbyDevices,
  getMyDevices,
  createDevice,
  updateMyDevice,
  uploadDeviceImage,
  getDeviceById,
  updateDeviceStatus,
  updateBlockedDates,
  deleteMyDevice,
};
