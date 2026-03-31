import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const isExpiredBooking = (booking: any) => {
  const type = booking.reservationType || booking.bookingType;
  if (type !== 'enquiry' && type !== 'block') return false;
  return booking.enquiryExpiresAt && new Date(booking.enquiryExpiresAt) < new Date();
};

export const formatTime = (timeStr?: string) => {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const hour = h % 12 || 12;
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
};
