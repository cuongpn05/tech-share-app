# TECHSHARE DESIGN SYSTEM & THEME TOKENS (theme-skill.md)

Tài liệu này quy định toàn bộ Design Tokens (Màu sắc, Không gian, Typography, Bo góc, Đổ bóng) và các nguyên tắc UI/UX cốt lõi cho dự án TechShare (áp dụng cho cả Mobile App React Native và Web Landing Page Next.js).

---

## 1. HỆ THỐNG MÀU SẮC (COLOR PALETTE)

Tuyệt đối không hardcode mã màu Hex (`#...`) tự do trong các file component. Phải sử dụng các token dưới đây.

### 🎨 Brand Colors (Màu chủ đạo - Soft Teal/Cyan)

Dùng cho nút bấm CTA, trạng thái active, biểu đồ, và các điểm nhấn thương hiệu.

- `brand-50` / `primary-50`: `#F0FAF9` (Background siêu nhạt, nền hover/active nhẹ)
- `brand-100` / `primary-100`: `#E8F6F7` (Nền cho icon wrapper, active tab pill)
- `brand-200` / `primary-200`: `#D0EFF1`
- `brand-300` / `primary-300`: `#A4DEE2`
- `brand-500` / `primary-500`: **`#67BEC3` (Core Brand Color)**
- `brand-600` / `primary-600`: `#4CA6AC` (Hover state của nút bấm)
- `brand-700` / `primary-700`: `#388E94`
- `brand-800` / `primary-800`: `#286E74` (Text nhấn mạnh, text giá tiền)

### ⚪ Neutrals & Surfaces (Màu trung tính & Bề mặt)

Dùng cho màu nền, chữ, viền phân cách.

- `background`: `#F8FAFC` (Slate-50) - Nền tổng thể của toàn bộ app/web (tạo không gian thở).
- `surface` / `card`: `#FFFFFF` (White) - Nền của các thẻ, card, modal.
- `border`: `#F1F5F9` (Slate-100) đến `#E2E8F0` (Slate-200) - Chỉ dùng viền siêu mảnh.
- `text-primary`: `#0F172A` (Slate-900) - Tiêu đề chính.
- `text-secondary`: `#64748B` (Slate-500) - Mô tả phụ, placeholder.
- `text-muted`: `#94A3B8` (Slate-400) - Chữ mờ, icon inactive.

### 🚥 Semantic Colors (Màu trạng thái)

- `success`: `#10B981` (Tăng trưởng, giao dịch thành công, hoàn tất)
- `warning`: `#F59E0B` (Tiền ký quỹ, cảnh báo, chờ duyệt)
- `danger`: `#EF4444` (Khóa tài khoản, gỡ bài, từ chối, lỗi)
- `info/ai`: `#6366F1` (Indigo - Dùng riêng cho các tính năng Google Gemini AI)

---

## 2. KHÔNG GIAN & BỐ CỤC (SPACING & GRID)

Sử dụng hệ thống lưới 8-point grid để căn lề và tạo khoảng trống (Whitespace).

- `xs`: 4px
- `sm`: 8px
- `md`: 16px (Padding/Margin tiêu chuẩn)
- `lg`: 24px (Khoảng cách giữa các Section)
- `xl`: 32px
- `2xl`: 48px

---

## 3. BO GÓC (BORDER RADIUS)

Loại bỏ hoàn toàn góc nhọn cứng nhắc. Mọi thành phần UI phải được bo góc.

- `sm`: 6px (Checkbox, badge nhỏ)
- `md`: 12px (Thumbnail ảnh thiết bị, input fields)
- `lg`: 16px (Thẻ Card, Modal, Container chính)
- `xl`: 24px (Hero banners)
- `full`: 9999px (Capsule/Pill buttons, Tabs active, Avatars, Icon wrappers)

---

## 4. ĐỔ BÓNG (ELEVATION & SHADOWS)

Không dùng viền đen (border) để tạo khối. Sử dụng Shadow mềm mại để phân tầng các bề mặt sáng.

- `shadow-sm`: Bóng đổ siêu mờ, dùng cho thẻ con hoặc dropdown. _(Web: `0 1px 2px rgba(0,0,0,0.05)`, Mobile: `elevation: 1`)_
- `shadow-card`: Đổ bóng tiêu chuẩn cho các thẻ KPI, Component nổi. _(Web: `0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)`, Mobile: `shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2`)_

---

## 5. NGUYÊN TẮC UI/UX (SOFT UI PRINCIPLES) - BẮT BUỘC

1. **No Boxy Layouts (Không đóng hộp):** Tránh lạm dụng `borderWidth`. Thẻ card nên có nền trắng nổi bật trên nền xám nhạt (`bg-slate-50`) thay vì dùng viền xám bó chặt.
2. **Pill-shaped Active States (Trạng thái Active dạng viên thuốc):** Bất kỳ Tab nào đang được chọn (Bottom Tab, Sidebar Menu, Filter Tab) đều phải bọc icon/text trong một khối nền hình viên thuốc bo tròn tuyệt đối (`radii.full`), nền nhạt (`brand-100`), icon đậm (`brand-500`).
3. **Typography:** Tiêu đề các mục sử dụng định dạng **Title Case** (Ví dụ: "Chỉ số hoạt động"), tuyệt đối không lạm dụng in hoa toàn bộ (ALL CAPS) gây áp lực thị giác.
4. **Iconography:** Thống nhất sử dụng bộ vector icon nét mảnh (`lucide-react` cho Web, `@expo/vector-icons / Ionicons` cho Mobile). Loại bỏ hoàn toàn emoji hoặc hình ảnh 3D/AI tạp nham trong các thanh điều hướng và danh mục.
