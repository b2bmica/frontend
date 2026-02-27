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
}

export interface Booking {
  _id: string;
  roomId: any; // populated with room data
  guestId: any; // populated with guest data  
  checkin: string;
  checkout: string;
  adults: number;
  children: number;
  roomPrice: number;
  baseOccupancy: number;
  extraPersonPrice: number;
  advancePayment: number;
  bookingSource: string;
  paymentMethod?: string;
  paymentLogs?: Array<{ _id?: string; amount: number; method: string; date: string; note?: string }>;
  status: 'reserved' | 'checked-in' | 'checked-out' | 'cancelled';
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
  createBooking: (data: any) => Promise<any>;
  updateBooking: (id: string, data: any) => Promise<void>;
  cancelBooking: (id: string) => Promise<void>;
  checkIn: (id: string) => Promise<void>;
  checkOut: (id: string) => Promise<void>;
  createRoom: (data: any) => Promise<any>;
  updateRoom: (id: string, data: any) => Promise<void>;
  updateRoomStatus: (id: string, status: string) => Promise<void>;
  deleteRoom: (id: string) => Promise<void>;
  createGuest: (data: any) => Promise<any>;
  searchGuests: (query: string) => Promise<any[]>;
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
      setRooms(data);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const refreshBookings = useCallback(async () => {
    try {
      const data = await api.getBookings({ limit: 200 });
      setBookings(data.bookings);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const refreshGuests = useCallback(async () => {
    try {
      const data = await api.getGuests();
      setGuests(data.guests);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  // Load data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setLoading(true);
      Promise.all([refreshRooms(), refreshBookings(), refreshGuests()])
        .finally(() => setLoading(false));
    }
  }, [isAuthenticated, refreshRooms, refreshBookings, refreshGuests]);

  const createBookingFn = useCallback(async (data: any) => {
    const result = await api.createBooking(data);
    await refreshBookings();
    await refreshRooms(); // Room status might change
    return result;
  }, [refreshBookings, refreshRooms]);

  const updateBooking = useCallback(async (id: string, data: any) => {
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

  const createRoomFn = useCallback(async (data: any) => {
    const result = await api.createRoom(data);
    await refreshRooms();
    return result;
  }, [refreshRooms]);

  const updateRoomFn = useCallback(async (id: string, data: any) => {
    await api.updateRoom(id, data);
    await refreshRooms();
  }, [refreshRooms]);

  const updateRoomStatusFn = useCallback(async (id: string, status: string) => {
    await api.updateRoomStatus(id, status);
    await refreshRooms();
  }, [refreshRooms]);

  const deleteRoomFn = useCallback(async (id: string) => {
    await api.deleteRoom(id);
    await refreshRooms();
  }, [refreshRooms]);

  const createGuestFn = useCallback(async (data: any) => {
    const result = await api.createGuest(data);
    await refreshGuests();
    return result;
  }, [refreshGuests]);

  const searchGuestsFn = useCallback(async (query: string) => {
    return await api.searchGuests(query);
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
