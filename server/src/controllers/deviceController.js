const Device = require("../models/Device");
require("../models/User");
const { asyncHandler } = require("../middlewares/asyncHandler");
const positiveInteger = (value, fallback) => {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

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
  const { category, q } = req.query;
  for (const [key, value] of Object.entries({ category, q })) {
    if (value !== undefined && typeof value !== "string") {
      return res.status(400).json({ success: false, message: `${key} must be a single string` });
    }
  }
  const filter = { status: "available", isDeleted: false };
  if (category && category !== "all") filter.category = category.trim().toLowerCase();
  if (q?.trim()) {
    const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");
    filter.$or = [{ name: regex }, { brand: regex }, { description: regex }];
  }
  // Preserve the Map endpoint's existing full-radius result contract.
  if (req.query.page === undefined && req.query.limit === undefined) {
    const devices = await Device.find({ ...filter, location: { $nearSphere: {
      $geometry: { type: "Point", coordinates: [lng, lat] }, $maxDistance: maxDistance,
    } } });
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


module.exports = { getNearbyDevices };
