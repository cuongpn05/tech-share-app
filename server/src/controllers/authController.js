const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Account = require('../models/Account');
const User = require('../models/User');
const Role = require('../models/Role');
const EkycRequest = require('../models/EkycRequest');
const Otp = require('../models/Otp');
const emailService = require('../services/emailService');

/**
 * Controller đăng nhập người dùng từ collection accounts
 * Phân role: renter, owner, admin
 */
const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên đăng nhập hoặc email và mật khẩu.',
      });
    }

    const trimmedIdentifier = String(identifier).trim().toLowerCase();

    // 1. Tìm bản ghi trong collection accounts theo username hoặc email
    const account = await Account.findOne({
      $or: [{ username: trimmedIdentifier }, { email: trimmedIdentifier }],
    })
      .select('+passwordHash')
      .populate('roleId');

    if (!account) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản hoặc mật khẩu không chính xác.',
      });
    }

    // 2. Xác thực mật khẩu bằng bcrypt
    const isPasswordMatch = await bcrypt.compare(password, account.passwordHash);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản hoặc mật khẩu không chính xác.',
      });
    }

    // 3. Kiểm tra tài khoản bị vô hiệu hóa
    if (account.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn đã bị khóa hoặc tạm ngưng hoạt động. Vui lòng liên hệ hỗ trợ.',
      });
    }

    // 4. Phân role (admin, owner, renter) từ collection roles
    let roleCode = 'renter';
    if (account.roleId && typeof account.roleId === 'object' && account.roleId.code) {
      roleCode = account.roleId.code;
    } else if (account.roleId) {
      const foundRole = await Role.findById(account.roleId);
      if (foundRole && foundRole.code) {
        roleCode = foundRole.code;
      }
    }

    const validRoles = ['renter', 'owner', 'admin'];
    if (!validRoles.includes(roleCode)) {
      roleCode = 'renter';
    }

    // 5. Tìm hoặc đồng bộ hồ sơ User
    let user = await User.findOne({ accountId: account._id });
    if (!user && account.email) {
      user = await User.findOne({ email: account.email });
      if (user && !user.accountId) {
        user.accountId = account._id;
        await User.updateOne({ _id: user._id }, { $set: { accountId: account._id } });
      }
    }

    // Khởi tạo hồ sơ User nếu chưa có
    if (!user) {
      user = await User.create({
        accountId: account._id,
        username: account.username,
        email: account.email,
        name: account.username,
        role: roleCode,
        isVerified: roleCode === 'admin',
      });
    } else {
      if (user.role !== roleCode) {
        user.role = roleCode;
        await User.updateOne({ _id: user._id }, { $set: { role: roleCode } });
      }
    }

    // 6. Kiểm tra trạng thái eKYC
    if (roleCode === 'admin') {
      if (!user.isVerified) {
        user.isVerified = true;
        await User.updateOne({ _id: user._id }, { $set: { isVerified: true } });
      }
    } else {
      const approvedEkyc = await EkycRequest.findOne({
        userId: user._id,
        status: 'approved',
      });
      if (approvedEkyc && !user.isVerified) {
        user.isVerified = true;
        await User.updateOne({ _id: user._id }, { $set: { isVerified: true } });
      }
    }

    // 7. Cập nhật lastLogin
    await Account.updateOne({ _id: account._id }, { $set: { lastLogin: new Date() } });

    // 8. Tạo JWT token thời hạn 7 ngày
    const secret = process.env.JWT_SECRET || 'techshare_mma301_super_secret_jwt_key_2026';
    const payload = {
      id: user._id,
      accountId: account._id,
      email: account.email,
      username: account.username,
      role: roleCode,
      name: user.name,
    };

    const token = jwt.sign(payload, secret, { expiresIn: '7d' });

    // 9. Trả về kết quả đăng nhập thành công
    return res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công',
      token,
      user: {
        _id: user._id,
        accountId: account._id,
        username: account.username,
        email: account.email,
        name: user.name,
        role: roleCode,
        avatar: user.avatar,
        phone: user.phone,
        address: user.address,
        isVerified: user.isVerified,
        trustScore: user.trustScore,
        walletBalance: user.walletBalance,
        walletEscrowBalance: user.walletEscrowBalance,
      },
    });
  } catch (error) {
    console.error('Error in login controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi máy chủ trong quá trình xử lý đăng nhập.',
      error: error.message,
    });
  }
};

/**
 * Lấy thông tin user hiện tại từ token
 */
const getMe = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: req.user,
      account: {
        _id: req.account._id,
        username: req.account.username,
        email: req.account.email,
        role: req.userRole,
        lastLogin: req.account.lastLogin,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi tải thông tin tài khoản.',
      error: error.message,
    });
  }
};

/**
 * Cập nhật thông tin user hiện tại
 */
const updateMe = async (req, res) => {
  try {
    const { name, phone, address, avatar, biometricEnabled } = req.body;
    const userId = req.user._id;

    const updateData = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (phone !== undefined) updateData.phone = String(phone).trim();
    if (address !== undefined) updateData.address = String(address).trim();
    if (avatar !== undefined) updateData.avatar = String(avatar).trim();
    if (biometricEnabled !== undefined) {
      updateData['pushConfig.biometricEnabled'] = Boolean(biometricEnabled);
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin thành công',
      user: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi cập nhật thông tin.',
      error: error.message,
    });
  }
};

/**
 * 1. Gửi mã OTP xác thực đăng ký tài khoản qua Email
 */
const sendRegisterOtp = async (req, res) => {
  try {
    const { username, name, email, phone, password } = req.body;

    // Kiểm tra các trường bắt buộc
    if (!username || !name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ các thông tin: Tên đăng nhập, Họ và tên, Email, Số điện thoại và Mật khẩu.',
      });
    }

    const trimmedUsername = String(username).trim().toLowerCase();
    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedName = String(name).trim();
    const trimmedPhone = String(phone).trim();

    // Kiểm tra định dạng username (tối thiểu 3 ký tự, chỉ chứa chữ cái, số hoặc dấu gạch dưới)
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!usernameRegex.test(trimmedUsername)) {
      return res.status(400).json({
        success: false,
        message: 'Tên đăng nhập từ 3-30 ký tự và chỉ chứa chữ cái, số hoặc dấu gạch dưới (_).',
      });
    }

    // Kiểm tra định dạng email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Địa chỉ email không đúng định dạng.',
      });
    }

    // Kiểm tra số điện thoại (tối thiểu 9-11 chữ số)
    const phoneRegex = /^[0-9+]{9,15}$/;
    if (!phoneRegex.test(trimmedPhone.replace(/[\s.-]/g, ''))) {
      return res.status(400).json({
        success: false,
        message: 'Số điện thoại không hợp lệ.',
      });
    }

    // Kiểm tra độ dài mật khẩu (tối thiểu 6 ký tự)
    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu phải có độ dài tối thiểu 6 ký tự.',
      });
    }

    // 1. Kiểm tra username đã tồn tại trong collection accounts chưa
    const existingAccountUsername = await Account.findOne({ username: trimmedUsername });
    if (existingAccountUsername) {
      return res.status(400).json({
        success: false,
        message: 'Tên đăng nhập này đã có người sử dụng. Vui lòng chọn tên khác.',
      });
    }

    // 2. Kiểm tra email đã tồn tại trong collection accounts chưa
    const existingAccountEmail = await Account.findOne({ email: trimmedEmail });
    if (existingAccountEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email này đã được đăng ký tài khoản. Vui lòng đăng nhập hoặc sử dụng email khác.',
      });
    }

    // 3. Kiểm tra số điện thoại đã tồn tại trong collection users chưa
    const existingUserPhone = await User.findOne({ phone: trimmedPhone });
    if (existingUserPhone) {
      return res.status(400).json({
        success: false,
        message: 'Số điện thoại này đã được sử dụng cho một tài khoản khác.',
      });
    }

    // 4. Mã hoá mật khẩu bằng bcrypt trước khi lưu tạm vào OTP
    const passwordHash = await bcrypt.hash(password, 10);

    // 5. Sinh mã OTP 6 chữ số ngẫu nhiên
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 6. Xoá mọi OTP cũ của email này và lưu OTP mới
    await Otp.deleteMany({ email: trimmedEmail });
    await Otp.create({
      email: trimmedEmail,
      otp,
      registrationData: {
        username: trimmedUsername,
        name: trimmedName,
        phone: trimmedPhone,
        passwordHash,
      },
      createdAt: new Date(),
    });

    // 7. Gửi email chứa mã OTP qua Gmail SMTP
    try {
      await emailService.sendRegistrationOtpEmail(trimmedEmail, otp, trimmedName);
    } catch (mailError) {
      console.error('Lỗi gửi email OTP:', mailError);
      return res.status(500).json({
        success: false,
        message: 'Không thể gửi email OTP. Vui lòng kiểm tra lại địa chỉ email hoặc thử lại sau.',
        error: mailError.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Mã xác thực OTP đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư.',
      email: trimmedEmail,
      expiresInSeconds: 300,
    });
  } catch (error) {
    console.error('Lỗi trong sendRegisterOtp:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi hệ thống khi xử lý gửi mã OTP.',
      error: error.message,
    });
  }
};

/**
 * 2. Xác nhận mã OTP và tạo tài khoản trong accounts + users (mặc định role renter)
 */
const verifyRegisterOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ email và mã OTP 6 số.',
      });
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedOtp = String(otp).trim();

    // 1. Tìm bản ghi OTP khớp với email và mã
    const otpDoc = await Otp.findOne({
      email: trimmedEmail,
      otp: trimmedOtp,
    });

    if (!otpDoc) {
      return res.status(400).json({
        success: false,
        message: 'Mã OTP không chính xác hoặc đã hết hạn (quá 5 phút). Vui lòng thử lại.',
      });
    }

    const { registrationData } = otpDoc;

    // 2. Kiểm tra lại lần nữa phòng trường hợp tài khoản đã tạo trước đó
    const duplicateAccount = await Account.findOne({
      $or: [{ username: registrationData.username }, { email: trimmedEmail }],
    });
    if (duplicateAccount) {
      await Otp.deleteMany({ email: trimmedEmail });
      return res.status(400).json({
        success: false,
        message: 'Tài khoản hoặc email này vừa được tạo bởi phiên khác.',
      });
    }

    // 3. Tìm role 'renter' trong collection roles (mặc định cho người dùng đăng ký mới)
    let renterRole = await Role.findOne({ code: 'renter' });
    if (!renterRole) {
      renterRole = await Role.create({
        code: 'renter',
        name: 'Người thuê',
        description: 'Tài khoản người thuê thiết bị',
        permissions: ['rent_device', 'review_device', 'chat'],
      });
    }

    // 4. Tạo tài khoản trong collection accounts
    const newAccount = await Account.create({
      username: registrationData.username,
      email: trimmedEmail,
      passwordHash: registrationData.passwordHash,
      roleId: renterRole._id,
      isActive: true,
      lastLogin: new Date(),
    });

    // 5. Sinh mã giới thiệu duy nhất
    const cleanPrefix = registrationData.username.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const referralCode = `TS${cleanPrefix}${randomSuffix}`;

    // 6. Tạo thông tin hồ sơ tương ứng trong collection users (trùng accountId)
    // Các thông tin như địa chỉ mặc định null, người dùng sẽ tự cập nhật trong profile sau
    const newUser = await User.create({
      accountId: newAccount._id,
      username: newAccount.username,
      name: registrationData.name,
      phone: registrationData.phone,
      address: null,
      avatar: null,
      trust: {
        isVerified: false,
        score: 100,
        badges: [],
      },
      wallet: {
        balance: 0,
        escrowBalance: 0,
      },
      pushConfig: {
        expoPushToken: '',
        fcmTokens: [],
        biometricEnabled: false,
      },
      location: {
        type: 'Point',
        coordinates: [105.7826, 21.0285], // Mặc định Hà Nội, Việt Nam
      },
      wishlist: [],
      referralCode,
      referredBy: null,
      rating: 5.0,
      totalReviews: 0,
      isActive: true,
    });

    // 7. Xoá mã OTP đã sử dụng
    await Otp.deleteMany({ email: trimmedEmail });

    // 8. Tạo JWT token thời hạn 7 ngày
    const secret = process.env.JWT_SECRET || 'techshare_mma301_super_secret_jwt_key_2026';
    const payload = {
      id: newUser._id,
      accountId: newAccount._id,
      email: newAccount.email,
      username: newAccount.username,
      role: 'renter',
      name: newUser.name,
    };
    const token = jwt.sign(payload, secret, { expiresIn: '7d' });

    // 9. Phản hồi thành công kèm token và dữ liệu user
    return res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công!',
      token,
      user: {
        _id: newUser._id,
        accountId: newAccount._id,
        username: newAccount.username,
        email: newAccount.email,
        name: newUser.name,
        role: 'renter',
        avatar: newUser.avatar,
        phone: newUser.phone,
        address: newUser.address,
        isVerified: newUser.isVerified,
        trustScore: newUser.trustScore,
        walletBalance: newUser.walletBalance,
        walletEscrowBalance: newUser.walletEscrowBalance,
      },
    });
  } catch (error) {
    console.error('Lỗi trong verifyRegisterOtp:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi máy chủ trong quá trình xác thực và tạo tài khoản.',
      error: error.message,
    });
  }
};

/**
 * 3. Gửi lại mã OTP cho email đang chờ xác thực
 */
const resendRegisterOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp email cần gửi lại mã OTP.',
      });
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const existingOtpDoc = await Otp.findOne({ email: trimmedEmail });

    if (!existingOtpDoc) {
      return res.status(400).json({
        success: false,
        message: 'Phiên đăng ký đã hết hạn hoặc không tồn tại. Vui lòng nhập lại thông tin đăng ký.',
      });
    }

    // Sinh mã OTP mới
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    existingOtpDoc.otp = newOtp;
    existingOtpDoc.createdAt = new Date();
    await existingOtpDoc.save();

    // Gửi email mới
    await emailService.sendRegistrationOtpEmail(
      trimmedEmail,
      newOtp,
      existingOtpDoc.registrationData?.name || ''
    );

    return res.status(200).json({
      success: true,
      message: 'Mã xác thực mới đã được gửi đến email của bạn.',
      email: trimmedEmail,
      expiresInSeconds: 300,
    });
  } catch (error) {
    console.error('Lỗi trong resendRegisterOtp:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi gửi lại mã OTP.',
      error: error.message,
    });
  }
};

module.exports = {
  login,
  getMe,
  updateMe,
  sendRegisterOtp,
  verifyRegisterOtp,
  resendRegisterOtp,
};

