import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from './auth-context';

export interface Room {
  _id: string;
  roomNumber: string;
  roomType: string;
  price: number;
  amenities: string[];
  status: 'clean' | 'dirty' | 'occupied' | 'maintenance' | 'under-maintenance';
  floor?: number;
  baseOccupancy: number;
  maxOccupancy: number;
  extraPersonPrice: number;
  defaultCheckinTime?: string;   // "HH:mm"
  defaultCheckoutTime?: string;  // "HH:mm"
}

export interface Booking {
  _id: string;
  roomId: string | Room; // populated with room data or ID
  guestId: string | Guest; // populated with guest data or ID  
  checkin: string;
  checkout: string;
  checkinTime?: string;   // "HH:mm"
  checkoutTime?: string;  // "HH:mm"
  adults: number;
  children: number;
  roomPrice: number;
  baseOccupancy: number;
  extraPersonPrice: number;
  advancePayment: number;
  bookingSource: string;
  paymentMethod?: string;
  paymentLogs?: Array<{ _id?: string; amount: number; method: string; date: string; note?: string }>;
  status: 'reserved' | 'checked-in' | 'checked-out' | 'cancelled' | 'blocked';
  bookingType?: 'booking' | 'enquiry' | 'block';
  enquiryExpiresAt?: string;  // ISO timestamp for auto-release
  planType?: 'EP' | 'CP' | 'MAP' | 'AP' | 'Custom';
  planCustomText?: string;
  specialRequests?: string;
  blockReason?: string;
  isGroup?: boolean;
  groupId?: string;
  groupName?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: { name: string; email: string };
}

export interface Guest {
  _id: string;
  name: string;
  email: string;
  phone: string;
  nationality: string;
  idProof: {
    idType: string;
    number: string;
  };
}

interface BookingContextType {
  bookings: Booking[];
  rooms: Room[];
  guests: Guest[];
  loading: boolean;
  error: string | null;
  refreshBookings: () => Promise<void>;
  refreshRooms: () => Promise<void>;
  refreshGuests: () => Promise<void>;
  createBooking: (data: Partial<Booking> & { roomId: string; guestId: string; checkin: string; checkout: string }) => Promise<unknown>;
  updateBooking: (id: string, data: Partial<Booking>) => Promise<void>;
  cancelBooking: (id: string) => Promise<void>;
  checkIn: (id: string) => Promise<void>;
  checkOut: (id: string) => Promise<void>;
  createRoom: (data: Omit<Room, '_id'>) => Promise<unknown>;
  updateRoom: (id: string, data: Partial<Room>) => Promise<void>;
  updateRoomStatus: (id: string, status: Room['status']) => Promise<void>;
  deleteRoom: (id: string) => Promise<void>;
  createGuest: (data: Omit<Guest, '_id'>) => Promise<unknown>;
  searchGuests: (query: string) => Promise<Guest[]>;
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export const BookingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshRooms = useCallback(async () => {
    try {
      const data = await api.getRooms();
      setRooms(data as Room[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error refreshing rooms');
    }
  }, []);

  const refreshBookings = useCallback(async () => {
    try {
      const data = await api.getBookings({ limit: 200 });
      setBookings(data.bookings as Booking[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error refreshing bookings');
    }
  }, []);

  const refreshGuests = useCallback(async () => {
    try {
      const data = await api.getGuests();
      setGuests(data.guests as Guest[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error refreshing guests');
    }
  }, []);

  // Load data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setTimeout(() => setLoading(true), 0);
      Promise.all([refreshRooms(), refreshBookings(), refreshGuests()])
        .finally(() => setLoading(false));
    }
  }, [isAuthenticated, refreshRooms, refreshBookings, refreshGuests]);

  const createBookingFn = useCallback(async (data: Partial<Booking> & { roomId: string; guestId: string; checkin: string; checkout: string }) => {
    const result = await api.createBooking(data);
    await refreshBookings();
    await refreshRooms(); // Room status might change
    return result;
  }, [refreshBookings, refreshRooms]);

  const updateBooking = useCallback(async (id: string, data: Partial<Booking>) => {
    await api.updateBooking(id, data);
    await refreshBookings();
    await refreshRooms();
  }, [refreshBookings, refreshRooms]);

  const cancelBookingFn = useCallback(async (id: string) => {
    await api.cancelBooking(id);
    await refreshBookings();
    await refreshRooms();
  }, [refreshBookings, refreshRooms]);

  const checkIn = useCallback(async (id: string) => {
    await api.updateBooking(id, { status: 'checked-in' });
    await refreshBookings();
    await refreshRooms();
  }, [refreshBookings, refreshRooms]);

  const checkOut = useCallback(async (id: string) => {
    await api.updateBooking(id, { status: 'checked-out' });
    await refreshBookings();
    await refreshRooms();
  }, [refreshBookings, refreshRooms]);

  const createRoomFn = useCallback(async (data: Omit<Room, '_id'>) => {
    const result = await api.createRoom(data);
    await refreshRooms();
    return result;
  }, [refreshRooms]);

  const updateRoomFn = useCallback(async (id: string, data: Partial<Room>) => {
    await api.updateRoom(id, data);
    await refreshRooms();
  }, [refreshRooms]);

  const updateRoomStatusFn = useCallback(async (id: string, status: Room['status']) => {
    await api.updateRoomStatus(id, status);
    await refreshRooms();
  }, [refreshRooms]);

  const deleteRoomFn = useCallback(async (id: string) => {
    await api.deleteRoom(id);
    await refreshRooms();
  }, [refreshRooms]);

  const createGuestFn = useCallback(async (data: Omit<Guest, '_id'>) => {
    const result = await api.createGuest(data);
    await refreshGuests();
    return result;
  }, [refreshGuests]);

  const searchGuestsFn = useCallback(async (query: string) => {
    return await api.searchGuests(query) as Guest[];
  }, []);

  return (
    <BookingContext.Provider value={{
      bookings, rooms, guests, loading, error,
      refreshBookings, refreshRooms, refreshGuests,
      createBooking: createBookingFn,
      updateBooking,
      cancelBooking: cancelBookingFn,
      checkIn, checkOut,
      createRoom: createRoomFn,
      updateRoom: updateRoomFn,
      updateRoomStatus: updateRoomStatusFn,
      deleteRoom: deleteRoomFn,
      createGuest: createGuestFn,
      searchGuests: searchGuestsFn,
    }}>
      {children}
    </BookingContext.Provider>
  );
};

export const useBookings = () => {
  const context = useContext(BookingContext);
  if (!context) throw new Error('useBookings must be used within a BookingProvider');
  return context;
};
