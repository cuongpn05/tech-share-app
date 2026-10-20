# Favi Map trong TechShare Mobile

## Phạm vi và dữ liệu đã kiểm tra

- Trước thay đổi này, source không có MapScreen; tab `map`/Nearby có sẵn nhưng bị disable.
- Home đã có Nearby dạng danh sách, GPS qua `useHomeLocation`, tìm kiếm/category và phân trang. Giữ nguyên luồng này.
- MongoDB thực tế đã được đọc để xác minh `location.type = Point`, `location.coordinates = [longitude, latitude]`, `location.addressText`, `name`, `category`, `pricePerDay` và index `location: 2dsphere`.
- Backend hiện có `GET /api/devices/nearby`: không truyền page/limit thì trả toàn bộ kết quả trong bán kính; có page/limit thì phục vụ danh sách Home. Không thay đổi backend/schema/database.

## File liên quan

| File | Vai trò |
| --- | --- |
| `client/src/screens/map/MapScreen.tsx` (mới) | GPS, lọc category, tải dữ liệu thật, WebView, trạng thái lỗi/loading, chọn marker và mở chi tiết |
| `client/src/components/map/faviMapHtml.ts` (mới) | HTML tải SDK chính thức, lọc tọa độ, giao tiếp JSON và marker |
| `client/src/config/faviMap.ts` (mới) | Đọc khóa public từ Expo environment |
| `client/.env.example` (mới) | Mẫu cấu hình không có khóa thật |
| `client/src/navigation/HomeRoute.tsx` | Bật tab Nearby và gắn MapScreen vào tab hiện có |
| `client/src/services/deviceService.ts` | Bổ sung phương thức gọi API Nearby hiện có, không phân trang bản đồ |
| `client/verify-favi-map.cjs` (mới) | Test bridge, màn hình, service và navigation bằng mock |
| `client/.env` (local, Git ignore) | Đã thêm khóa client được người dùng cung cấp, không ghi khóa vào source |

Các file đã inspect thêm: `HomeScreen.tsx`, `RootNavigator.tsx`, `BottomTabNavigator.tsx`, `CategoryBar.tsx`, `useHomeLocation.ts`, `types/index.ts`, `config/api.ts`, `app.json`, package.json hai phía, `deviceRoutes.js`, `deviceController.js`, `Device.js`.

Không cài thêm thư viện. `react-native-webview@13.16.1` và `expo-location@~57.0.21` đã có và khớp bundledNativeModules của Expo đang cài.

## Luồng hoạt động

1. Chọn Nearby trong Bottom Tab → MapScreen tải HTML nội bộ trong WebView.
2. HTML tải `https://api-map.fastviet.vn/sdk/favimap.js?key=...`, SDK tự tải MapLibre và tài nguyên bản đồ. Không lưu bản sao SDK trong repo.
3. `FaviMap.ready()` → `FaviMap.create()` → sự kiện map load → gửi `ready` về React Native.
4. `useHomeLocation` dùng expo-location để xin quyền và lấy GPS; giữ xử lý GPS tắt, từ chối quyền, timeout, cache và vòng đời hiện có. Vị trí cũ được ghi rõ nếu chưa có GPS mới.
5. MapScreen gọi deviceService → API Nearby hiện có → MongoDB `$geoNear` với bán kính 10.000 mét. Không gọi API bản đồ để tìm thiết bị.
6. React Native gửi vị trí và marker hợp lệ qua `postMessage`. Tọa độ gửi SDK luôn là `[longitude, latitude]`.
7. Chọn marker gửi ID về React Native → kiểm tra ID thuộc danh sách hiện tại → hiển thị tên, giá, category/địa chỉ/khoảng cách nếu có → nút View device mở DeviceDetail hiện có.
8. Nút My location gửi lệnh focus và yêu cầu làm mới GPS. Chọn category cập nhật marker ngay, bỏ qua response cũ. Category ban đầu lấy từ Home; chỉnh trên Map không làm mất bộ lọc của Home. Map không có ô Search và không áp dụng từ khóa Search của Home.

Tên thiết bị được truyền bằng JSON và gán vào thuộc tính DOM bằng setAttribute; không chèn dữ liệu người dùng vào HTML. Bridge kiểm tra JSON, loại message, ID và tọa độ. Chặn điều hướng WebView ra trang khác. Không gửi token backend hoặc dữ liệu chủ sở hữu vào WebView.

## SDK và khóa

SDK được đọc trực tiếp từ URL chính thức, phiên bản trả về khi kiểm tra là 1.1.0. `getCenter()` trên instance bị ghi đè bằng hàm tự gọi lại. Chỉ tránh gọi trực tiếp là chưa đủ vì camera/marker của MapLibre cũng có thể dùng hàm này. Sau create, tích hợp gán lại tham chiếu `maplibregl.Map.prototype.getCenter` trên instance vừa tạo; không sửa source SDK hay prototype toàn cục. Không sử dụng drawRoute/distance của SDK.

Thiếu key: hiện hướng dẫn cấu hình và không tải SDK/GPS. Lỗi SDK/resources, WebGL, timeout, HTTP key/restriction 401/403 hoặc quota 429: hiện lỗi và cho reload thủ công; không tự lặp request. Chưa xác minh key được chấp nhận bởi tile server trên thiết bị thật.

Thêm vào `client/.env`:

```dotenv
EXPO_PUBLIC_FAVI_MAP_API_KEY=<khóa client của bạn>
EXPO_PUBLIC_API_URL=http://<IP-LAN-của-PC>:5000/api
```

Khởi động lại Expo sau khi đổi env. `EXPO_PUBLIC_*` có thể đọc từ bundle, không giữ được bí mật. Không commit `.env` và không dùng server secret cho biến này.

Portal chính thức tại https://map.fastviet.vn/user/keys có giao diện restriction theo Domain hoặc IP, bật/tắt/xóa key và xem quota sử dụng. Đây là xác minh giao diện công khai, chưa xác minh enforcement/quota của tài khoản được cung cấp. WebView HTML nội bộ có origin/referrer riêng; không giả mạo domain bằng baseUrl của Favi Map để vượt giới hạn. Cần xác nhận với nhà cung cấp cách hạn chế key cho mobile WebView trước khi phát hành. Nếu yêu cầu domain, dùng trang HTTPS thực sự do bạn sở hữu và kiểm tra origin/referrer thực tế. IP cố định không phù hợp cho người dùng mobile đổi mạng. Tách key phát triển/sản xuất, giới hạn phù hợp mà portal hỗ trợ, theo dõi quota tại https://map.fastviet.vn/user và thu hồi/đổi key nếu bị lạm dụng. Không khẳng định key client có thể giấu được.

Không dùng Google Maps API hoặc Google Cloud Billing. Không gọi tile/geocoding/route hàng loạt trong kiểm thử.

## Kết quả kiểm thử

| Kiểm tra thực sự đã chạy | Kết quả |
| --- | --- |
| `npx.cmd tsc --noEmit` | PASS |
| Expo start offline và Android Metro bundle qua HTTP | PASS (HTTP 200) |
| `EXPO_OFFLINE=1` + `expo install --check` | PASS theo metadata cài sẵn; không phải kiểm tra phiên bản online |
| `node verify-favi-map.cjs` | PASS: bridge/SDK mock, marker hợp lệ, chống trùng, XSS, GPS/focus, key/quota/error, request cũ, category/All, không áp dụng Search của Home, loading/empty/retry, ID/Detail, giữ Bottom Tab |
| Test hiện có: `verify-device-detail.cjs`, `verify-home-location.cjs`, `verify-home-location-races.cjs`, `verify-device-service.cjs`, `verify-search-devices.cjs` | PASS |
| Một request qua Express Nearby hiện có với MongoDB thật | PASS: tìm đúng thiết bị, kết hợp category/search, không phân trang, khoảng cách trong 10 km và tăng dần (2 kết quả) |
| Tải SDK chính thức qua HTTP để inspect | PASS HTTP 200; không đồng nghĩa tile authentication thành công |
| SDK/tiles/WebGL thực tế trong Android WebView, key thật/sai, marker và layout trên điện thoại | CHƯA XÁC MINH |
| GPS phần cứng, Android permission dialog, pan/zoom và LDPlayer | CHƯA XÁC MINH; GPS/error test ở trên dùng mock |

Không có adb trong PATH của môi trường kiểm tra. Metro bundle không thay thế native build hay kiểm thử thiết bị. Chưa tạo APK/native build. Không commit/push.

## Chạy trên Expo và LDPlayer

```powershell
# Terminal 1
cd server
npm.cmd run dev

# Terminal 2
cd client
npx.cmd expo start --lan --clear
```

1. Đặt EXPO_PUBLIC_API_URL thành IP LAN của PC, bảo đảm emulator/điện thoại gọi được backend cổng 5000. Android Studio emulator có thể dùng `10.0.2.2`; với LDPlayer ưu tiên IP LAN thực tế, không mặc định localhost là PC.
2. Project hiện dùng Expo SDK 57. Mở bằng Expo Go tương thích SDK 57 hoặc development build tương ứng; Expo Go chỉ hỗ trợ SDK 58 sẽ vẫn báo lỗi không tương thích. Task này không nâng SDK toàn dự án.
3. Mở URL Expo hiển thị trong Expo Go trên LDPlayer/điện thoại. Nếu adb đã cấu hình đúng emulator, có thể nhấn `a` tại Metro. Dùng `adb devices` để xác nhận target trước.
4. Bật GPS/vị trí mô phỏng của LDPlayer, cấp quyền Location cho Expo Go/app. Tọa độ giả lập chỉ đặt trong emulator, không hardcode vào source.
5. Chọn Nearby, kiểm tra street tiles, zoom/pan, My location, marker, View device và quay lại Bottom Tab. Thử từ chối quyền và thử key sai có chủ đích trên môi trường dev, mỗi lần một lần; khôi phục key đúng và restart Expo.

Ví dụ tọa độ đã có thiết bị trong DB lúc kiểm tra: `[105.8544, 21.0285]` (Hà Nội). Đây là tọa độ kiểm thử emulator, ứng dụng luôn lấy GPS thật qua expo-location.
