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

const consultDevice = async (req, res) => {
  const { message } = req.body || {};
  if (typeof message !== "string" || !message.trim() || message.length > 500) {
    return res.status(400).json({
      success: false,
      message: "Please enter rental requirements of 1 to 500 characters",
    });
  }

  try {
    const devices = await Device.find({
      status: "available",
      isDeleted: false,
      moderationStatus: "approved",
    })
      .select(
        "name brand category pricePerDay depositAmount condition description specs images",
      )
      .limit(50)
      .lean();

    if (devices.length === 0) {
      return res.status(200).json({
        success: true,
        reply: "Hiện chưa có thiết bị phù hợp để giới thiệu.",
        recommendations: [],
      });
    }

    const prompt = `
Bạn là AI tư vấn thuê thiết bị công nghệ của TechShare.

Nhu cầu khách hàng:
${message.trim()}

Danh sách thiết bị hiện có:
${JSON.stringify(devices)}

Nhiệm vụ:
1. Phân tích nhu cầu thuê của khách hàng.
2. Chọn tối đa 3 thiết bị phù hợp nhất trong danh sách được cung cấp.
3. Giải thích vì sao mỗi thiết bị phù hợp.
4. Ưu tiên thiết bị đáp ứng ngân sách khách hàng.
5. Không đề xuất thiết bị ngoài danh sách và không tự bịa thông tin.
6. Nếu không có thiết bị phù hợp, hãy nói rõ.

Chỉ trả về JSON có dạng:
{
  "reply": "Nội dung tư vấn bằng tiếng Việt",
  "recommendations": [
    { "deviceId": "ID thiết bị", "reason": "Lý do đề xuất" }
  ]
}
`;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    if (typeof response.text !== "string" || !response.text.trim()) {
      throw new Error("AI returned an empty consultation");
    }

    const result = JSON.parse(response.text);
    if (
      typeof result.reply !== "string" ||
      !result.reply.trim() ||
      !Array.isArray(result.recommendations)
    ) {
      throw new Error("AI returned an invalid consultation");
    }

    const deviceMap = new Map(
      devices.map((device) => [String(device._id), device]),
    );
    const recommendations = result.recommendations
      .filter(
        (item) =>
          item &&
          typeof item.deviceId === "string" &&
          typeof item.reason === "string" &&
          item.reason.trim() &&
          deviceMap.has(item.deviceId),
      )
      .slice(0, 3)
      .map((item) => ({
        device: deviceMap.get(item.deviceId),
        reason: item.reason.trim(),
      }));

    return res.status(200).json({
      success: true,
      reply: result.reply,
      recommendations,
    });
  } catch (error) {
    console.error("AI Consultation Error:", error);
    const statusCode =
      error && Number.isInteger(error.status) ? error.status : 500;
    return res.status(statusCode).json({
      success: false,
      message:
        statusCode === 503
          ? "AI đang quá tải, vui lòng thử lại sau."
          : "AI consultation failed",
    });
  }
};

const generateDeviceDescription = async (req, res) => {
  const { name, brand, category, pricePerDay, depositAmount, specs } =
    req.body || {};

  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof brand !== "string" ||
    !brand.trim() ||
    typeof category !== "string" ||
    !category.trim()
  ) {
    return res.status(400).json({
      success: false,
      message: "Name, brand, and category are required.",
    });
  }

  if (
    !Number.isFinite(pricePerDay) ||
    pricePerDay <= 0 ||
    !Number.isFinite(depositAmount) ||
    depositAmount <= 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Price per day and deposit must be numbers greater than zero.",
    });
  }

  if (
    specs !== undefined &&
    (typeof specs !== "object" || specs === null || Array.isArray(specs))
  ) {
    return res.status(400).json({
      success: false,
      message: "Specifications must be an object.",
    });
  }

  try {
    const prompt = `
Bạn là chuyên gia viết mô tả thiết bị cho thuê trên TechShare.

Hãy viết mô tả dựa trên thông tin:

Tên thiết bị: ${name.trim()}
Thương hiệu: ${brand.trim()}
Danh mục: ${category.trim()}
Giá thuê: ${pricePerDay} VNĐ/ngày
Tiền đặt cọc: ${depositAmount} VNĐ
Thông số kỹ thuật: ${JSON.stringify(specs || {})}

Yêu cầu:
- Viết bằng tiếng Việt.
- Mô tả hấp dẫn, chuyên nghiệp, dài 80-120 từ.
- Chỉ nêu đặc điểm có trong dữ liệu, không tự bịa thông số hoặc tình trạng.
- Chỉ trả về JSON có thuộc tính description chứa nội dung mô tả.
`;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
          },
          required: ["description"],
        },
      },
    });

    if (typeof response.text !== "string" || !response.text.trim()) {
      throw new Error("AI returned an empty description");
    }

    const result = JSON.parse(response.text);
    if (typeof result.description !== "string" || !result.description.trim()) {
      throw new Error("AI returned an invalid description");
    }

    return res.status(200).json({
      success: true,
      message: "Device description generated successfully",
      description: result.description.trim(),
    });
  } catch (error) {
    console.error("AI Description Error:", error);
    const statusCode =
      error && Number.isInteger(error.status) ? error.status : 500;
    return res.status(statusCode).json({
      success: false,
      message:
        statusCode === 503
          ? "AI đang quá tải, vui lòng thử lại sau."
          : "AI description generation failed",
    });
  }
};

module.exports = {
  compareDevices,
  consultDevice,
  generateDeviceDescription,
};