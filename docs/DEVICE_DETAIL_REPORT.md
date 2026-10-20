# Device Details & Specifications — 20/10/2026

## Inspect

Đã kiểm tra `DeviceCard.tsx`, `HomeScreen.tsx`, `HomeRoute.tsx`, `RootNavigator.tsx`,
`BookingCreateScreen.tsx`, `deviceService.ts`, `bookingService.ts`, `types/index.ts`,
`deviceRoutes.js`, `deviceController.js`, `Device.js` và dữ liệu MongoDB thật.

Trước đó không có DeviceDetailScreen dành cho người xem thiết bị. Card từ Home/Search
đi thẳng tới BookingCreateScreen, nơi chỉ hiển thị tóm tắt thiết bị và biểu mẫu đặt thuê.
Không có phần description/specs/album/owner dành riêng cho việc xem chi tiết.

API GET `/api/devices/:id` đã hoạt động: kiểm tra ID, loại isDeleted, trả 400/404,
populate `ownerId`. Không cần thêm route/controller hoặc sửa database.
Client service trước đây có thể trả nguyên response envelope làm Device khi thiếu data,
khiến API lỗi/response sai khó phân biệt với dữ liệu thiết bị.

## Dữ liệu thật đã xác minh

- Collection devices có 160 document; 133 thiết bị available public tại lúc kiểm tra.
- Field chuẩn: `name`, `pricePerDay`, `description`, `images`, `category`, `status`,
  `location.addressText`, `ownerId`.
- `specs` là Map string trong schema, trả thành object JSON. Ví dụ từ DB:
  camera có Sensor/Video Recording/Autofocus; laptop có Chipset/Memory/Storage/Display;
  smartphone có Display/Chipset/Storage Capacity. Giá trị được đọc trực tiếp từ DB.
- `ownerId` là object đã populate, có name/address; không dựa vào virtual owner chưa populate.
- Có thiết bị nhiều ảnh. Không sửa URL ảnh hay dữ liệu trong DB, không seed hoặc tạo index.

## Thay đổi

| File | Nội dung |
| --- | --- |
| `client/src/screens/device/DeviceDetailScreen.tsx` — mới | Header Back; album chọn ảnh, placeholder khi URL lỗi/không có ảnh; tên/category/status/giá/ngày/địa chỉ; description; specs lấy động; owner; footer Rent device. Loading/error/retry/not found/invalid ID, chặn response cũ và cập nhật sau unmount. |
| `client/src/navigation/RootNavigator.tsx` | Đăng ký DeviceDetail cho guest và các role, thêm param deviceId; Rent mở BookingCreate cũ. Callback xem thiết bị ở MyBookings mở Detail; callback đặt thuê giữ nguyên. |
| `client/src/navigation/HomeRoute.tsx` | Callback chi tiết từ Home/Search dùng DeviceDetail thay vì BookingCreate. Luồng đặt thuê trực tiếp khác giữ nguyên. |
| `client/src/services/deviceService.ts` | Validate success/data/ID, không coi envelope lỗi là Device. Strict caller nhận lỗi HTTP; caller Booking cũ vẫn nhận null khi lỗi. Hỗ trợ ID uppercase hợp lệ. |
| `client/src/types/index.ts` | Bổ sung ownerId đã populate hoặc string/null, đúng dữ liệu backend. |
| `client/verify-device-detail.cjs` — mới | Test render/lifecycle, album, dữ liệu thiếu, specs an toàn, navigation và Rent đúng ID. |
| `client/verify-device-service.cjs` | Test response chi tiết hợp lệ/sai ID/sai envelope/400/404/500, tương thích caller Booking. |
| `server/src/utils/verify-home-readonly.cjs` | Đối chiếu HTTP detail với MongoDB cho 8 danh mục, thêm 400/404. |

Thay đổi bỏ icon Filter trong Home từ yêu cầu trước được giữ nguyên; Task 3 không sửa thêm HomeScreen.

Không sửa BookingCreateScreen, bookingService hoặc API booking. Không thêm dependency.
Specs được đổi label bằng tách camelCase/underscore và định dạng acronym phổ biến;
không hardcode thông số hay giá trị. Bỏ value null/undefined/object không phù hợp thay vì
ép thành `[object Object]`; không có specs thì hiển thị No specifications available.
Owner/description/giá/ảnh thiếu được thông báo rõ, không điền dữ liệu giả.

Layout dùng ScrollView, flex và safe area; ảnh theo aspect ratio; text không giới hạn
fixed height hoặc numberOfLines. Rent bị disable khi status không available hoặc giá không hợp lệ.
Phần kiểm tra đăng nhập/ngày thuê/thanh toán vẫn do BookingCreate hiện tại thực hiện.

## Kiểm tra

| Nội dung | Kết quả |
| --- | --- |
| Home/Search → Detail → BookingCreate đúng ID | PASS — render navigation wrappers/callbacks trong JS harness. Home/Search dùng chung list/callback. |
| Detail MongoDB thật | PASS — 8 danh mục: accessory, audio, camera, drone, gaming, laptop, smartphone, tablet. Đối chiếu ID, tên, giá, ảnh, description, specs, địa chỉ, ownerId. |
| ID không hợp lệ / không tồn tại | PASS — API thật trả 400/404; UI phân biệt invalid ID, not found và lỗi mạng. |
| Album/ảnh lỗi/relative URL | PASS trong render harness — đổi ảnh, onError ra placeholder, `/uploads` dùng API origin. Chưa xác minh tải từng URL ảnh qua mạng trên điện thoại. |
| Specs/label/dữ liệu thiếu | PASS — CPU Model/RAM/Video Resolution; giữ giá trị 0, bỏ null/undefined/object, empty state rõ ràng. |
| Loading/error/retry/race/unmount | PASS — request cũ không ghi đè thiết bị mới, không set state sau unmount. |
| Booking tương thích | PASS ở navigation/service — cùng BookingCreate và deviceId, giữ null-on-error cho caller cũ. Không gửi booking thật để tránh tạo dữ liệu. |
| Regression Home/Search/Category/Nearby | PASS — các script hiện có và HTTP đọc MongoDB. |
| TypeScript / bundle Android | PASS — tsc noEmit và Expo Android JS/Hermes export; không phải build APK. |
| UI trên điện thoại thật | CHƯA TEST — cần kiểm tra trực tiếp ở màn nhỏ, description/specs dài, nhiều ảnh và footer khi font lớn. |

Từ root:

```powershell
node client/verify-device-detail.cjs
node client/verify-device-service.cjs
node client/verify-search-devices.cjs
node client/verify-home-features.cjs
node client/verify-device-requests.cjs
node client/verify-nearby-api.cjs
```

Trong `server` với `.env` hiện tại, chỉ đọc MongoDB:

```powershell
node src/utils/verify-home-readonly.cjs
```

Trong `client`:

```powershell
npx.cmd tsc --noEmit
npx.cmd expo export --platform android --output-dir .expo/device-detail-review
```
