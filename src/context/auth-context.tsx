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
    currency: string;
    taxConfig: {
      enabled: boolean;
      cgst: number;
      sgst: number;
      igst: number;
      hsnCode: string;
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
  login: (email: string, password: string) => Promise<void>;
  register: (data: { hotelName: string; userName: string; email: string; password: string; address?: string; phone?: string }) => Promise<void>;
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
        setHotel(data.hotel);
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
      setHotel(data.hotel);
    } catch {
      // If refresh fails, might be token expiry
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const data = await api.login(email, password);
      api.setToken(data.token);
      setUser(data.user);
      setHotel(data.hotel);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, []);

  const register = useCallback(async (data: { hotelName: string; userName: string; email: string; password: string; address?: string; phone?: string }) => {
    setError(null);
    try {
      const result = await api.register(data);
      api.setToken(result.token);
      setUser(result.user);
      setHotel(result.hotel);
    } catch (err: any) {
      setError(err.message);
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
    <AuthContext.Provider value={{ user, hotel, isAuthenticated: !!user, isLoading, login, register, logout, refreshUser, error, clearError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
