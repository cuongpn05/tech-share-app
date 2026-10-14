# Tính năng đăng nhập

Tài liệu mô tả luồng đăng nhập hiện tại của ứng dụng TechShare, từ form trên client đến xác thực JWT ở server và điều hướng sau khi đăng nhập.

## Các file liên quan

### Client

| File | Vai trò |
| --- | --- |
| [`client/src/screens/auth/LoginScreen.tsx`](../client/src/screens/auth/LoginScreen.tsx) | Hiển thị form username/email và mật khẩu; kiểm tra dữ liệu bắt buộc; gọi API đăng nhập; đưa token và hồ sơ người dùng vào Redux; hiển thị lỗi hoặc trạng thái đang tải. |
| [`client/src/navigation/RootNavigator.tsx`](../client/src/navigation/RootNavigator.tsx) | Chọn nhóm màn hình theo trạng thái xác thực và role: khách thấy Login/Register/Forgot Password; admin vào `AdminRoot`; owner vào `OwnerRoot`; renter vào `MainTabs`. |
| [`client/src/store/slices/authSlice.ts`](../client/src/store/slices/authSlice.ts) | Quản lý `token`, `user`, `isAuthenticated`; `setAuth` thiết lập token cho API, `clearAuth` xóa phiên đăng nhập. |
| [`client/src/store/index.ts`](../client/src/store/index.ts) | Đăng ký auth slice trong Redux store. |
| [`client/src/config/api.ts`](../client/src/config/api.ts) | Chọn API base URL, tạo Axios client và tự gắn JWT vào header `Authorization` khi có token. |
| [`client/App.tsx`](../client/App.tsx) | Cung cấp Redux store và theo dõi `isAuthenticated`; sau đăng nhập, khởi tạo socket và tải thông báo, wishlist. |
| [`client/src/navigation/MainBottomTabNavigator.tsx`](../client/src/navigation/MainBottomTabNavigator.tsx) | Thực hiện đăng xuất từ Profile bằng cách ngắt socket và dispatch `clearAuth`. |
| [`client/src/screens/auth/RegisterScreen.tsx`](../client/src/screens/auth/RegisterScreen.tsx) | Luồng liền kề tạo tài khoản; gửi thông tin đăng ký và cũng dispatch `setAuth` sau đăng ký thành công. |
| [`client/src/screens/auth/ForgotPasswordScreen.tsx`](../client/src/screens/auth/ForgotPasswordScreen.tsx) | Luồng khôi phục mật khẩu/OTP có thể mở từ màn hình đăng nhập. |

### Server

| File | Vai trò |
| --- | --- |
| [`server/src/index.js`](../server/src/index.js) | Mount router xác thực tại `/api/auth`. |
| [`server/src/routes/authRoutes.js`](../server/src/routes/authRoutes.js) | Xử lý `POST /login`, xác minh thông tin tài khoản, đồng bộ hồ sơ/eKYC, tạo JWT và trả dữ liệu user. File này cũng chứa các endpoint đăng ký và quên mật khẩu. |
| [`server/src/models/Account.js`](../server/src/models/Account.js) | Mô hình collection `accounts`: username, email, password hash, role, user liên kết và trạng thái khóa. |
| [`server/src/models/User.js`](../server/src/models/User.js) | Mô hình hồ sơ người dùng, role và các thông tin hiển thị/trạng thái xác minh. |
| [`server/src/middlewares/authMiddleware.js`](../server/src/middlewares/authMiddleware.js) | Đọc JWT từ header `Authorization` và xác thực token cho các API yêu cầu đăng nhập. |
| [`server/src/routes/profileRoutes.js`](../server/src/routes/profileRoutes.js) | Ví dụ router được bảo vệ: áp dụng `requireAuth` cho toàn bộ endpoint hồ sơ. |

## Luồng hoạt động

1. `RootNavigator` hiển thị `LoginScreen` khi `auth.isAuthenticated` là `false`. Người dùng nhập username hoặc email cùng mật khẩu.
2. Khi nhấn **SIGN IN**, client kiểm tra username/email không rỗng và mật khẩu đã nhập, rồi gửi:

   ```http
   POST /api/auth/login
   Content-Type: application/json
   ```

   ```json
   {
     "identifier": "username hoặc email",
     "password": "..."
   }
   ```

   URL đầy đủ là `${API_BASE_URL}/auth/login`; `API_BASE_URL` lấy từ `EXPO_PUBLIC_API_URL` nếu được cấu hình, nếu không dùng địa chỉ mặc định theo nền tảng.

3. Server chuẩn hóa `identifier`, tìm bản ghi `Account` theo username hoặc email (email so sánh chữ thường), lấy `passwordHash` và so khớp bằng `bcrypt.compare`.
4. Nếu mật khẩu hợp lệ, server từ chối tài khoản bị vô hiệu hóa (`isActive === false`). Tiếp đó server đọc role từ collection `roles`; role không nhận diện được sẽ mặc định thành `renter`.
5. Server tìm hồ sơ `User` theo `account.userId`, dự phòng tìm theo email. Nếu chưa có hồ sơ, server tạo hồ sơ cơ bản và cập nhật `Account.userId`.
6. Trạng thái eKYC được xác định từ yêu cầu eKYC đã `approved`; admin được xem là đã xác minh. Kết quả này được đồng bộ vào `User.isVerified`.
7. Server ký JWT chứa `id`, `email`, `role`, `name`, thời hạn **7 ngày**, rồi trả HTTP 200 với `{ success, message, token, user }`.
8. Client kiểm tra response có cả `token` và `user`, dispatch `setAuth`. Redux lưu phiên trong bộ nhớ và cập nhật token dùng bởi API client. `RootNavigator` render lại theo role và đưa admin/owner/renter vào vùng màn hình tương ứng.
9. `App.tsx` nhận thấy người dùng đã đăng nhập thì kết nối socket theo user ID, tải notification/unread count và wishlist. Các API được bảo vệ gửi JWT trong header `Authorization`; middleware `requireAuth` xác minh token.
10. Khi đăng xuất, ứng dụng ngắt socket, xóa auth state và token khỏi API client; navigator quay về nhóm màn hình chưa đăng nhập.

## Kết quả và lỗi

| Trường hợp | Kết quả |
| --- | --- |
| Thiếu username/email hoặc mật khẩu ở client | Không gọi API; hiển thị thông báo trên form. |
| Thiếu thông tin ở server | HTTP 400. |
| Không tìm thấy tài khoản hoặc sai mật khẩu | HTTP 401 với thông báo thông tin đăng nhập không hợp lệ. |
| Tài khoản bị khóa | HTTP 403, kèm lý do khóa và địa chỉ hỗ trợ. |
| Lỗi xử lý phía server | HTTP 500; client hiển thị thông báo lỗi trả về nếu có. |
| Không kết nối được server | Client hiển thị hướng dẫn kiểm tra backend và kết nối mạng. |

## Lưu ý về hành vi hiện tại

- Checkbox **Remember me** trong `LoginScreen` chỉ thay đổi state giao diện; hiện chưa được dùng để lưu token hay thay đổi thời hạn phiên.
- Auth state và token chỉ nằm trong Redux/bộ nhớ runtime. Không thấy cơ chế khôi phục token khi khởi động lại app, nên người dùng cần đăng nhập lại sau khi phiên ứng dụng bị tạo mới.
- Callback `onNavigateToHome` hiện được truyền hàm rỗng từ `RootNavigator`. Việc chuyển sang màn hình theo role xảy ra do `setAuth` làm thay đổi state và `RootNavigator` render nhóm route khác, không phải do callback này trực tiếp điều hướng.
- Tài liệu tổng quan [`FEATURES.md`](./FEATURES.md) có nhắc đăng nhập sinh trắc học, nhưng luồng `LoginScreen` được kiểm tra ở đây chưa triển khai biometric login.
