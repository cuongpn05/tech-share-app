# TechShare mobile client

Ứng dụng dùng Expo SDK 58, React Native 0.88 và React 19.3.
Mở bằng Expo Go hỗ trợ SDK 58.

## Cài và chạy

Trong thư mục `client`, dùng Node.js 24 LTS (từ 24.3):

```powershell
npm.cmd ci
npm.cmd run start:clear
```

Dừng Metro cũ bằng Ctrl+C trước khi chạy lại. Quét mã QR mới bằng Expo Go.
Từ thư mục gốc có thể chạy `npm.cmd run client:clear`.

## Kiểm tra dependency

```powershell
npm.cmd run check:expo
npm.cmd run doctor
npx.cmd tsc --noEmit
```

Commit `package.json` và `package-lock.json` cùng nhau; các máy khác dùng `npm.cmd ci`.
Khi nâng SDK tiếp theo, cài phiên bản Expo mục tiêu rồi chạy
`npx.cmd expo install --fix` và các lệnh kiểm tra ở trên.
Chỉ cập nhật bản vá SDK 57 không giải quyết được lỗi Expo Go SDK 58.

Expo Go thay đổi SDK theo bản phát hành. Để chủ động giữ môi trường native lâu dài,
dùng development build riêng của dự án; build lại khi thay SDK hoặc thư viện native.

Hướng dẫn chính thức: https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/
