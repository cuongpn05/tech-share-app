# TECHSHARE WEB - ANTI-HARDCODING & CLEAN CODE RULES

Bạn là một AI Coding Agent đang làm việc trên dự án TechShare Web (Next.js, Tailwind CSS, TypeScript). Khi tạo mới hoặc chỉnh sửa bất kỳ Component/Page nào, bạn **BẮT BUỘC** phải tuân thủ nghiêm ngặt các quy tắc chống hardcode (No-Hardcoding Rules) dưới đây. Nếu vi phạm, code của bạn sẽ bị từ chối.

## 1. QUY TẮC MÀU SẮC & DESIGN TOKENS (NO HEX CODES)

- **Tuyệt đối không sử dụng mã màu Hex/RGB trực tiếp** (ví dụ: `text-[#67BEC3]`, `bg-[#F8FAFC]`) trong thuộc tính `className` hoặc `style`.
- **Mọi màu sắc phải được truy xuất qua Tailwind Configuration**.
- **Cấu hình Tailwind chuẩn của dự án (Tham chiếu):**
  - Màu chủ đạo (Primary): `bg-brand-500` (đại diện cho `#67BEC3`), `text-brand-600`, `hover:bg-brand-600`.
  - Màu nền (Background): `bg-slate-50`, `bg-white`.
  - Màu chữ (Text): `text-slate-800` (Tiêu đề chính), `text-slate-500` (Chữ phụ).
  - Màu trạng thái (Semantic): `text-emerald-500` (Thành công), `text-red-500` (Lỗi/Từ chối), `text-amber-500` (Cảnh báo).
- **Không hardcode Spacing & Radius:** Chỉ sử dụng các class có sẵn của Tailwind (ví dụ: `p-4`, `gap-6`, `rounded-xl`, `rounded-full`, `shadow-sm`).

## 2. QUY TẮC CHUỖI VĂN BẢN (NO RAW STRINGS)

- **Hạn chế tối đa việc gõ trực tiếp chuỗi văn bản (Tiếng Việt) vào trong thẻ JSX** nếu đó là các đoạn text dùng chung (Global Text).
- Các nhãn (Labels), Tiêu đề (Headings), Tên nút bấm (Buttons), và Thông báo lỗi (Error Messages) nên được định nghĩa trong file `src/constants/strings.ts` hoặc hệ thống `i18n` (nếu có).
- **Ví dụ đúng:** `<button>{STRINGS.COMMON.SUBMIT}</button>`
- **Ví dụ sai:** `<button>Xác nhận gửi</button>`
- _Ngoại lệ:_ Có thể dùng text trực tiếp cho các nội dung đặc thù chỉ xuất hiện 1 lần ở Landing Page, nhưng các Component dùng chung (UI Components) thì tuyệt đối không.

## 3. QUY TẮC BIẾN MÔI TRƯỜNG & ENDPOINT (NO MAGIC URLS)

- **Tuyệt đối không hardcode Base URL hoặc API Endpoints** (ví dụ: `fetch('http://localhost:5000/api/users')`).
- Mọi lời gọi API phải sử dụng HTTP Client (như Axios instance) đã được cấu hình sẵn Base URL thông qua biến môi trường.
- **Biến môi trường bắt buộc:** Phải gọi qua `process.env.NEXT_PUBLIC_API_URL` (với Next.js) hoặc import từ `src/config/appConfig.ts`.

## 4. QUY TẮC MAGIC NUMBERS (NO MAGIC NUMBERS)

- **Không đặt các con số không rõ ý nghĩa (Magic Numbers) trực tiếp trong code.**
- Các giá trị như: số lượng item trên một trang (Pagination Limit = 10), thời gian timeout (5000ms), phí giao dịch cố định... phải được khai báo bằng biến hằng số (CONSTANTS) viết hoa ở đầu file hoặc trong file `constants.ts`.
- **Ví dụ đúng:** `const MAX_UPLOAD_SIZE = 5242880; if (file.size > MAX_UPLOAD_SIZE)...`
- **Ví dụ sai:** `if (file.size > 5242880)...`

## 5. MÔ PHỎNG DỮ LIỆU (MOCK DATA)

- Khi đang dựng UI và chưa có API, **không hardcode dữ liệu mẫu rải rác bên trong Component**.
- Hãy tạo một mảng/đối tượng Mock Data ở ngoài Component hoặc trong thư mục `src/mocks/...` và dùng hàm `.map()` để render. Điều này giúp dễ dàng thay thế bằng dữ liệu thật từ API sau này.
