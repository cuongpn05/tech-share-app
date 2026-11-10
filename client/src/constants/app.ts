/**
 * TechShare Application Domain Constants
 * Centralized, type-safe definitions for all domain enums, pagination, network & validation limits.
 */

export const BOOKING_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
} as const;

export type BookingStatusValue = typeof BOOKING_STATUS[keyof typeof BOOKING_STATUS];

export const USER_ROLE = {
  RENTER: 'renter',
  OWNER: 'owner',
  ADMIN: 'admin',
} as const;

export type UserRoleValue = typeof USER_ROLE[keyof typeof USER_ROLE];

export const DEVICE_STATUS = {
  AVAILABLE: 'available',
  RENTED: 'rented',
  MAINTENANCE: 'maintenance',
  INACTIVE: 'inactive',
  PENDING_APPROVAL: 'pending_approval',
} as const;

export type DeviceStatusValue = typeof DEVICE_STATUS[keyof typeof DEVICE_STATUS];

export const MESSAGE_TYPE = {
  TEXT: 'text',
  IMAGE: 'image',
  LOCATION: 'location',
  TEMPLATE: 'template',
} as const;

export type MessageTypeValue = typeof MESSAGE_TYPE[keyof typeof MESSAGE_TYPE];

export const NOTIFICATION_TYPE = {
  BOOKING_REQUEST: 'booking_request',
  BOOKING_APPROVED: 'booking_approved',
  BOOKING_REJECTED: 'booking_rejected',
  BOOKING_COMPLETED: 'booking_completed',
  BOOKING_CANCELLED: 'booking_cancelled',
  HANDOVER_CONFIRMED: 'handover_confirmed',
  RETURN_CONFIRMED: 'return_confirmed',
  PAYMENT_SUCCESS: 'payment_success',
  SYSTEM: 'system',
} as const;

export type NotificationTypeValue = typeof NOTIFICATION_TYPE[keyof typeof NOTIFICATION_TYPE];

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  MODERATION_PAGE_LIMIT: 10,
  USERS_PAGE_LIMIT: 20,
  MAX_PAGE_LIMIT: 50,
} as const;

export const DEBOUNCE_DELAY = {
  SEARCH_MS: 350,
  INPUT_MS: 300,
} as const;

export const NETWORK_CONFIG = {
  API_TIMEOUT_MS: 15000,
  FALLBACK_PORT: 5000,
  DEFAULT_EMULATOR_HOST: '10.0.2.2',
  DEFAULT_LOCALHOST: 'localhost',
} as const;

export const IMAGE_UPLOAD_CONFIG = {
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
  ASPECT_RATIO: [4, 3] as [number, number],
  QUALITY: 0.8,
} as const;
