import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  source: string;
  page: string;
  timestamp: number;
  read: boolean;
}

export interface NotificationInput {
  type: NotificationType;
  message: string;
  source: string;
  page: string;
}

interface NotificationContextType {
  notifications: Notification[];
  activeToasts: Notification[];
  addNotification: (notification: NotificationInput) => void;
  removeToast: (id: string) => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeToasts, setActiveToasts] = useState<Notification[]>([]);

  const addNotification = useCallback((input: NotificationInput) => {
    const newNotification: Notification = {
      id: Math.random().toString(36).substring(2, 9),
      ...input,
      timestamp: Date.now(),
      read: false,
    };

    setNotifications((prev) => [newNotification, ...prev]);
    setActiveToasts((prev) => [newNotification, ...prev].slice(0, 3)); // Max 3 toasts

    // Auto remove from toasts after 5 seconds
    setTimeout(() => {
      removeToast(newNotification.id);
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setActiveToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((notif) => (notif.id === id ? { ...notif, read: true } : notif))
    );
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setActiveToasts([]);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        activeToasts,
        addNotification,
        removeToast,
        markAsRead,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
