const nodemailer = require('nodemailer');

// Cấu hình transporter Gmail SMTP từ .env
const getTransporter = () => {
  const user = process.env.EMAIL_USER;
  const rawPass = process.env.EMAIL_PASS || '';
  const pass = rawPass.replace(/\s+/g, ''); // Loại bỏ khoảng trắng của Google App Password

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user,
      pass,
    },
  });
};

/**
 * Gửi email chứa mã OTP 6 số xác thực đăng ký
 * @param {string} toEmail Email người nhận
 * @param {string} otp Mã OTP 6 chữ số
 * @param {string} name Họ tên người đăng ký
 */
const sendRegistrationOtpEmail = async (toEmail, otp, name = '') => {
  const transporter = getTransporter();

  const displayName = name ? name : 'Bạn';
  const mailOptions = {
    from: `"TechShare Platform" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `[TechShare] Mã xác thực OTP đăng ký tài khoản: ${otp}`,
    html: `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f8fafc;
            margin: 0;
            padding: 0;
            color: #1e293b;
          }
          .email-container {
            max-width: 520px;
            margin: 30px auto;
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            border: 1px solid #e2e8f0;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          }
          .header {
            background-color: #67BEC3;
            padding: 24px;
            text-align: center;
          }
          .header h1 {
            color: #ffffff;
            font-size: 24px;
            margin: 0;
            letter-spacing: 0.5px;
          }
          .content {
            padding: 32px 24px;
            line-height: 1.6;
          }
          .greeting {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 12px;
          }
          .otp-box {
            text-align: center;
            background-color: #f0faf9;
            border: 2px dashed #67BEC3;
            border-radius: 12px;
            padding: 18px;
            margin: 24px 0;
          }
          .otp-code {
            font-size: 36px;
            font-weight: 800;
            letter-spacing: 8px;
            color: #286E74;
            display: inline-block;
          }
          .otp-note {
            font-size: 13px;
            color: #64748b;
            margin-top: 8px;
          }
          .warning {
            background-color: #fff7ed;
            border-left: 4px solid #f97316;
            padding: 12px 16px;
            font-size: 13px;
            color: #9a3412;
            border-radius: 4px;
            margin-top: 20px;
          }
          .footer {
            border-top: 1px solid #f1f5f9;
            padding: 18px 24px;
            font-size: 12px;
            color: #94a3b8;
            text-align: center;
            background-color: #f8fafc;
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>TechShare</h1>
          </div>
          <div class="content">
            <div class="greeting">Xin chào ${displayName},</div>
            <p>Cảm ơn bạn đã đăng ký tài khoản tại nền tảng chia sẻ thiết bị công nghệ <strong>TechShare</strong>.</p>
            <p>Để hoàn tất quá trình tạo tài khoản, vui lòng nhập mã xác thực OTP gồm 6 chữ số dưới đây vào ứng dụng:</p>
            
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
              <div class="otp-note">Mã xác thực có hiệu lực trong vòng <strong>5 phút</strong>.</div>
            </div>

            <div class="warning">
              <strong>Lưu ý bảo mật:</strong> Tuyệt đối không chia sẻ mã OTP này cho bất kỳ ai, kể cả nhân viên TechShare, để bảo đảm an toàn cho tài khoản của bạn.
            </div>
          </div>
          <div class="footer">
            Đây là email tự động, vui lòng không trả lời thư này.<br>
            © 2026 TechShare Team. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `,
  };

  return await transporter.sendMail(mailOptions);
};

/**
 * Gửi email chứa mã OTP xác thực khôi phục / đặt lại mật khẩu
 * @param {string} toEmail Email người nhận
 * @param {string} otp Mã OTP 6 chữ số
 * @param {string} name Tên hoặc Username người nhận
 */
const sendForgotPasswordOtpEmail = async (toEmail, otp, name = '') => {
  const transporter = getTransporter();

  const displayName = name ? name : 'there';
  const mailOptions = {
    from: `"TechShare Security" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `[TechShare] Password Reset OTP Code: ${otp}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f8fafc;
            margin: 0;
            padding: 0;
            color: #1e293b;
          }
          .email-container {
            max-width: 520px;
            margin: 30px auto;
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            border: 1px solid #e2e8f0;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          }
          .header {
            background-color: #67BEC3;
            padding: 24px;
            text-align: center;
          }
          .header h1 {
            color: #ffffff;
            font-size: 24px;
            margin: 0;
            letter-spacing: 0.5px;
          }
          .content {
            padding: 32px 24px;
            line-height: 1.6;
          }
          .greeting {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 12px;
          }
          .otp-box {
            text-align: center;
            background-color: #f0faf9;
            border: 2px dashed #67BEC3;
            border-radius: 12px;
            padding: 18px;
            margin: 24px 0;
          }
          .otp-code {
            font-size: 36px;
            font-weight: 800;
            letter-spacing: 8px;
            color: #286E74;
            display: inline-block;
          }
          .otp-note {
            font-size: 13px;
            color: #64748b;
            margin-top: 8px;
          }
          .warning {
            background-color: #fef2f2;
            border-left: 4px solid #ef4444;
            padding: 12px 16px;
            font-size: 13px;
            color: #991b1b;
            border-radius: 4px;
            margin-top: 20px;
          }
          .footer {
            border-top: 1px solid #f1f5f9;
            padding: 18px 24px;
            font-size: 12px;
            color: #94a3b8;
            text-align: center;
            background-color: #f8fafc;
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>TechShare Security</h1>
          </div>
          <div class="content">
            <div class="greeting">Hello ${displayName},</div>
            <p>We received a request to <strong>reset your password</strong> for your TechShare account.</p>
            <p>Please enter the following 6-digit verification OTP into the app to set your new password:</p>
            
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
              <div class="otp-note">This OTP code is valid for <strong>5 minutes</strong>.</div>
            </div>

            <div class="warning">
              <strong>Security Notice:</strong> Never share this code with anyone. If you did not make this request, you can safely ignore this email or update your password to protect your account.
            </div>
          </div>
          <div class="footer">
            This is an automated security email from TechShare. Please do not reply.<br>
            © 2026 TechShare Team. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `,
  };

  return await transporter.sendMail(mailOptions);
};

module.exports = {
  sendRegistrationOtpEmail,
  sendForgotPasswordOtpEmail,
};
