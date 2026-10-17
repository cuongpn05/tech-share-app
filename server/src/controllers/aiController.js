const Device = require("../models/Device");
const { GoogleGenAI, Type } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const comparisonCriterionSchema = {
  type: Type.OBJECT,
  properties: {
    device1: { type: Type.STRING },
    device2: { type: Type.STRING },
    winner: { type: Type.STRING },
  },
  required: ["device1", "device2", "winner"],
};

const aiCompareSchema = {
  type: Type.OBJECT,
  properties: {
    power: comparisonCriterionSchema,
    battery: comparisonCriterionSchema,
    weight: comparisonCriterionSchema,
    valueForMoney: comparisonCriterionSchema,
    conclusion: { type: Type.STRING },
    recommendation: { type: Type.STRING },
  },
  required: [
    "power",
    "battery",
    "weight",
    "valueForMoney",
    "conclusion",
    "recommendation",
  ],
};

const compareDevices = async (req, res) => {
  try {
    const { deviceId1, deviceId2 } = req.body || {};
    const isValidId = (id) => typeof id === "string" && /^[a-fA-F0-9]{24}$/.test(id);
    if (!isValidId(deviceId1) || !isValidId(deviceId2)) {
      return res.status(400).json({
        success: false,
        message: "Please provide two valid device IDs",
      });
    }

    if (deviceId1 === deviceId2) {
      return res.status(400).json({
        success: false,
        message: "Please select two different devices",
      });
    }

    const [device1, device2] = await Promise.all([
      Device.findOne({
        _id: deviceId1,
        isDeleted: false,
        status: "available",
        moderationStatus: "approved",
      }),
      Device.findOne({
        _id: deviceId2,
        isDeleted: false,
        status: "available",
        moderationStatus: "approved",
      }),
    ]);

    if (!device1 || !device2) {
      return res.status(404).json({
        success: false,
        message: "Device not found",
      });
    }

    const prompt = `
Bạn là chuyên gia phân tích và so sánh thiết bị công nghệ
cho một ứng dụng cho thuê thiết bị.

Hãy so sánh chi tiết hai thiết bị sau.

THIẾT BỊ 1:

Tên: ${device1.name}
Thương hiệu: ${device1.brand}
Danh mục: ${device1.category}
Năm sản xuất: ${device1.yearOfManufacture}
Tình trạng: ${device1.condition}
Giá thuê mỗi ngày: ${device1.pricePerDay}
Thông số kỹ thuật:
${JSON.stringify(device1.specs || {})}


THIẾT BỊ 2:

Tên: ${device2.name}
Thương hiệu: ${device2.brand}
Danh mục: ${device2.category}
Năm sản xuất: ${device2.yearOfManufacture}
Tình trạng: ${device2.condition}
Giá thuê mỗi ngày: ${device2.pricePerDay}
Thông số kỹ thuật:
${JSON.stringify(device2.specs || {})}


Hãy so sánh hai thiết bị theo 4 tiêu chí:

1. Sức mạnh (power)
2. Pin (battery)
3. Trọng lượng (weight)
4. Hiệu năng trên giá thuê (valueForMoney)

Mỗi tiêu chí cần:
- Nhận xét ngắn gọn cho thiết bị 1.
- Nhận xét ngắn gọn cho thiết bị 2.
- Cho biết thiết bị nào tốt hơn ở tiêu chí đó.

Cuối cùng:
- Đưa ra kết luận tổng thể.
- Đề xuất thiết bị phù hợp hơn để thuê.
- Chỉ dựa trên dữ liệu được cung cấp.
- Nếu thiếu thông số, hãy nói rõ là không đủ dữ liệu.
- Không tự bịa thông số kỹ thuật.
- Trả lời bằng tiếng Việt.
- Ngắn gọn và dễ hiểu.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: aiCompareSchema,
      },
    });

    if (typeof response.text !== "string" || !response.text.trim()) {
      throw new Error("AI returned an empty comparison");
    }
    const comparison = JSON.parse(response.text);
    return res.status(200).json({
      success: true,
      message: "AI comparison generated successfully",
      data: comparison,
    });
  } catch (error) {
    console.error("AI Compare Error:", error);
    const statusCode = error && Number.isInteger(error.status) ? error.status : 500;

    if (statusCode === 503) {
      return res.status(503).json({
        success: false,
        message: "AI đang quá tải, vui lòng thử lại sau.",
      });
    }

    return res.status(statusCode).json({
      success: false,
      message: "AI comparison failed",
    });
  }
};
module.exports = { compareDevices };