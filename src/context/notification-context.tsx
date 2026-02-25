import React, { createContext, useContext, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { useAuth } from './auth-context';

interface NotificationContextType {
  socket: Socket | null;
}

const NotificationContext = createContext<NotificationContextType>({ socket: null });

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { hotel, isAuthenticated } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize audio for notifications
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    
    if (isAuthenticated && hotel?._id) {
      // Connect to socket
      const socket = io('http://localhost:5000', {
        withCredentials: true,
      });

      socket.on('connect', () => {
        console.log('Connected to notification server');
        socket.emit('join-hotel', hotel._id);
      });

      socket.on('notification', (data) => {
        console.log('Received notification:', data);
        
        // Play sound
        if (audioRef.current) {
          audioRef.current.play().catch(e => console.log('Audio play blocked:', e));
        }

        // Show toast
        toast(data.title || 'System Alert', {
          description: data.message,
          action: data.type === 'new-booking' ? {
            label: 'View',
            onClick: () => console.log('Navigate to booking:', data.booking?._id)
          } : undefined,
        });
      });

      socketRef.current = socket;

      return () => {
        socket.disconnect();
        socketRef.current = null;
      };
    }
  }, [isAuthenticated, hotel?._id]);

  return (
    <NotificationContext.Provider value={{ socket: socketRef.current }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
