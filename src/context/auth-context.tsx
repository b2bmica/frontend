import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface Hotel {
  _id: string;
  name: string;
  slug: string;
  address?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  settings?: {
    checkinTime: string;
    checkoutTime: string;
    earlyCheckinBuffer?: string;
    lateCheckoutBuffer?: string;
    enquiryHoldTime?: string;
    blockDuration?: string;
    currency: string;
    taxConfig: {
      enabled: boolean;
      cgst: number;
      sgst: number;
      igst: number;
      hsnCode: string;
    };
    mealRates?: {
      CP?: number;
      MAP?: number;
      AP?: number;
    };
  };
  status?: 'active' | 'deleted';
  deletedAt?: string;
}

interface AuthContextType {
  user: User | null;
  hotel: Hotel | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<unknown>;
  register: (data: { hotelName: string; userName: string; email: string; password: string; address?: string; phone?: string }) => Promise<unknown>;
  verifyOtp: (email: string, otp: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, otp: string, newPassword: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore session on mount
  useEffect(() => {
    const restoreSession = async () => {
      const token = api.getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const data = await api.getMe();
        setUser(data.user);
        setHotel(data.hotel as Hotel);
      } catch {
        api.setToken(null);
      } finally {
        setIsLoading(false);
      }
    };
    restoreSession();
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await api.getMe();
      setUser(data.user);
      setHotel(data.hotel as Hotel);
    } catch {
      // If refresh fails, might be token expiry
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const data = await api.login(email, password) as { token: string; user: unknown; hotel: unknown; unverified?: boolean };
      if (!data.unverified) {
        api.setToken(data.token);
        setUser(data.user as User);
        setHotel(data.hotel as Hotel);
      }
      return data;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
      throw err;
    }
  }, []);

  const register = useCallback(async (data: { hotelName: string; userName: string; email: string; password: string; address?: string; phone?: string }) => {
    setError(null);
    try {
      const result = await api.register(data);
      return result;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      throw err;
    }
  }, []);

  const verifyOtp = useCallback(async (email: string, otp: string) => {
    setError(null);
    try {
      const data = await api.verifyOtp(email, otp);
      api.setToken(data.token);
      setUser(data.user as User);
      setHotel(data.hotel as Hotel);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      throw err;
    }
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    setError(null);
    try {
      await api.forgotPassword(email);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send reset code');
      throw err;
    }
  }, []);

  const resetPassword = useCallback(async (email: string, otp: string, newPassword: string) => {
    setError(null);
    try {
      await api.resetPassword({ email, otp, newPassword });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Password reset failed');
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    api.setToken(null);
    setUser(null);
    setHotel(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider value={{
      user,
      hotel,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      verifyOtp,
      forgotPassword,
      resetPassword,
      logout,
      refreshUser,
      error,
      clearError
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const useHotelSettings = () => {
  const { hotel } = useAuth();
  return hotel?.settings || {};
};
