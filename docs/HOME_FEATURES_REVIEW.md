# Home / Categories / Nearby review — 20/10/2026

Đã inspect source, đọc MongoDB hiện tại, sửa lỗi và chạy kiểm tra. Không seed,
update/delete document hay tạo/sửa index. Không thay đổi `.env`.

## Dữ liệu thực tế

- Collection `devices`: 160 document; 133 thiết bị đáp ứng điều kiện public hiện có:
  `status=available`, `isDeleted=false`, `moderationStatus=approved` hoặc chưa có giá trị.
- Field chuẩn: `name`, `pricePerDay`, `depositAmount`, `images`, `stats.ratingAvg`,
  `stats.ratingCount`, `location.addressText`.
- Location là GeoJSON Point, `coordinates=[longitude, latitude]`.
  Không phát hiện tọa độ không hợp lệ trong 160 document tại thời điểm kiểm tra.
- Index `location_2dsphere` tồn tại thực tế. Backend tắt autoIndex/autoCreate;
  chỉ kiểm tra index đã có, không chạy migration.
- Danh mục public: accessory (13), audio (15), camera (18), drone (11),
  gaming (16), laptop (22), smartphone (26), tablet (12).
- MongoDB đã chứa một số URL ảnh Unsplash. Đây là dữ liệu lưu trong DB;
  frontend không thay ảnh thiếu bằng ảnh thiết bị giả nữa.

## File đã inspect

Frontend:

- `client/src/screens/home/HomeScreen.tsx`
- `client/src/navigation/HomeRoute.tsx`
- `client/src/components/home/CategoryBar.tsx`
- `client/src/components/home/PromoBanner.tsx`
- `client/src/components/device/DeviceCard.tsx`
- `client/src/hooks/useHomeLocation.ts`
- `client/src/services/deviceService.ts`
- `client/src/store/slices/deviceSlice.ts`
- `client/src/types/index.ts`
- `client/src/config/api.ts`
- `client/app.json`, `client/package.json`
- Các script `client/verify-device-*`, `verify-home-*`, `verify-nearby-api.cjs`.

Backend:

- `server/src/routes/deviceRoutes.js`
- `server/src/controllers/deviceController.js`
- `server/src/models/Device.js`
- `server/src/config/db.js`
- `server/src/app.js`, `server/package.json`
- `server/src/utils/verify-iteration-1-readonly.mjs`.

## Lỗi và thay đổi

| Lỗi xác minh | Sửa ở đâu / cách sửa |
| --- | --- |
| Home chỉ gọi Nearby, phụ thuộc quyền/GPS; `/devices` chưa hỗ trợ lọc/phân trang Home | `HomeScreen.tsx`, `deviceService.ts`, `deviceSlice.ts`, `deviceController.js`: dùng lại danh sách và Redux, thêm lựa chọn All devices/Nearby; All tải 10/trang từ `/devices`, không cần GPS. Giữ hợp đồng không phân trang cũ cho client khác. |
| CategoryBar hardcode, thiếu gaming; model thiếu tablet dù DB đã có | `CategoryBar.tsx`, `types/index.ts`, `Device.js`, `deviceRoutes.js`, `deviceController.js`, `deviceService.ts`: thêm GET `/devices/categories` bằng distinct từ thiết bị public; giữ metadata tên/icon tại UI. Bổ sung gaming/tablet tương ứng, chuẩn hóa query trim/case và so khớp category có escape. |
| Card dùng `location.address` trong khi DB dùng `location.addressText`; không hiện khoảng cách; rating 0 thành 5 sao; ảnh thiếu thành ảnh stock | `DeviceCard.tsx`, `types/index.ts`: ưu tiên field chuẩn, giữ alias cũ, hiện category và khoảng cách m/km, giữ rating 0, hiện placeholder rõ ràng khi ảnh thiếu/lỗi; không crash khi thiếu giá/field tùy chọn. |
| Nearby không phân trang chưa trả khoảng cách | `deviceController.js`: dùng `$geoNear` trả `distanceMeters` và sắp xếp tăng dần, giữ dạng response cũ. Nhánh phân trang đã có `$geoNear` đúng; tiếp tục dùng bán kính mét, vị trí `[lng,lat]`, `_id` để ổn định thứ tự khi bằng khoảng cách. |
| Không có validation giới hạn tọa độ khi ghi Device | `Device.js`: chỉ chấp nhận 2 số hữu hạn trong giới hạn lng/lat; không sửa dữ liệu cũ. |
| Thu hồi quyền còn giữ tọa độ/watch; chuyển chế độ có thể giữ mốc query; GPS mới dưới 150m chưa thay query từ cache | `useHomeLocation.ts`, `HomeScreen.tsx`: chỉ bật GPS ở Nearby, xóa watch/tọa độ khi bị từ chối quyền, reset mốc khi tắt; GPS hiện tại thay query cache ngay. Cache/last-known được ghi rõ trên UI. |
| Search input chưa làm mới danh sách | `HomeScreen.tsx`: debounce query, hủy timer khi đổi chế độ/category; giữ bộ lọc mới nhất và cơ chế bỏ response cũ của Redux. Input chỉ hoạt động khi màn hình được truyền callback tìm kiếm như hợp đồng cũ. |

UI giữ component/layout cũ; chỉ thêm lựa chọn phạm vi danh sách và thông tin dữ liệu
cần thiết. Các banner quảng bá tĩnh vẫn tồn tại, không dùng làm kết quả thiết bị.

## Kết quả kiểm tra

| Nội dung | Kết quả | Phạm vi |
| --- | --- | --- |
| Home đọc database mới | PASS | HTTP qua routes/controller/model tới MongoDB thật; đủ 133 ID qua các trang, không trùng, đúng alias và trạng thái public. |
| Categories / All | PASS | Đối chiếu distinct và số lượng của 8 danh mục; query viết hoa và có khoảng trắng; All trả đủ 133 thiết bị. |
| Nearby query | PASS | Tọa độ test lấy từ DB tại `[105.8544,21.0285]`, `[106.7009,10.7769]`, `[105.77,10]`; 1km/10km; mọi category, phân trang, nhánh không phân trang; so sánh ID/thứ tự và Haversine độc lập, sai số khoảng cách dưới 1m. |
| Empty / lỗi request / không có mock che lỗi | PASS | Empty qua MongoDB thật; request sai trả 400; lỗi database mô phỏng trả 500; service không fallback khi offline/response sai. |
| Redux / render callbacks / card | PASS | Bỏ response cũ khi đổi bộ lọc/phạm vi, deduplicate, refresh/phân trang; loading/empty/error; field chuẩn, ảnh thiếu, rating 0, địa chỉ và khoảng cách. Render bằng harness JS, không phải UI native. |
| GPS hook | PASS với mô phỏng | Từ chối/thu hồi quyền, tắt location services, retry, cache, timeout 15s, race/unmount/focus/AppState; GPS hiện tại thay cache; chế độ All không chạy GPS. |
| TypeScript | PASS | `npx.cmd tsc --noEmit`. |
| Android JS/Hermes bundle | PASS | `npx.cmd expo export --platform android --output-dir .expo/home-review-export`; không phải build APK/native. |
| Quyền và GPS Android thật | CHƯA TEST | Cần điện thoại/emulator với Expo Go SDK 58; chưa xác nhận phần cứng GPS hay giao diện permission của Android. |

Chạy lại từ root:

```powershell
node client/verify-home-features.cjs
node client/verify-device-service.cjs
node client/verify-device-requests.cjs
node client/verify-home-location.cjs
node client/verify-home-location-races.cjs
node client/verify-nearby-api.cjs
```

Đọc DB thật, chạy trong `server` với `.env` hiện có:

```powershell
node src/utils/verify-home-readonly.cjs
```

Script mới này chỉ đọc dữ liệu/index và mở HTTP local; không gọi đăng nhập,
seed, create/update/delete hoặc tạo index. Các test request/GPS dùng mock chỉ
trong harness, không đưa dữ liệu test hay tọa độ cố định vào ứng dụng.

## Cần kiểm tra trên điện thoại

Restart backend và Metro. Mở Home ở All: phải tải được dữ liệu dù chưa cấp quyền.
Chọn Gaming/Tablet rồi All. Chuyển Nearby, cấp quyền và bật GPS; xác minh tọa độ,
khoảng cách và thứ tự; thử từ chối quyền, tắt GPS, cấp lại trong Settings, kéo refresh,
chuyển All/Nearby và load more. Không có thiết bị trong bán kính phải là empty state.
