const admin = require('firebase-admin');
const { getMessaging } = require('firebase-admin/messaging');

let firebaseAdminApp = null;
let messaging = null;

try {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'tech-share-80539';

  if (admin.getApps().length === 0) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        firebaseAdminApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId,
        });
      } catch (err) {
        console.warn('[FirebaseAdmin] Lỗi parse FIREBASE_SERVICE_ACCOUNT:', err.message);
      }
    }

    if (!firebaseAdminApp) {
      firebaseAdminApp = admin.initializeApp({
        projectId,
      });
    }
  } else {
    firebaseAdminApp = admin.getApps()[0];
  }

  if (firebaseAdminApp) {
    messaging = getMessaging(firebaseAdminApp);
    console.log('[FirebaseAdmin] ✅ Khởi tạo Firebase Admin Messaging thành công cho project:', projectId);
  }
} catch (error) {
  console.warn('[FirebaseAdmin] Cảnh báo khởi tạo Firebase Admin SDK:', error.message);
}

module.exports = {
  admin,
  firebaseAdminApp,
  getMessagingInstance: () => messaging,
};
