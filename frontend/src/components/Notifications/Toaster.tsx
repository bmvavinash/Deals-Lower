import React from 'react';
import { useNotification, Notification } from '../../context/NotificationContext';
import './Notifications.css';

const Toast: React.FC<{ notification: Notification; onClose: () => void }> = ({
  notification,
  onClose,
}) => {
  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  return (
    <div className={`toast toast-${notification.type}`}>
      <div className="toast-icon">{getIcon()}</div>
      <div className="toast-content">
        <div className="toast-title">
          {notification.page} - {notification.source}
        </div>
        <div className="toast-message">{notification.message}</div>
      </div>
      <button className="toast-close" onClick={onClose}>
        &times;
      </button>
    </div>
  );
};

const Toaster: React.FC = () => {
  const { activeToasts, removeToast } = useNotification();

  if (activeToasts.length === 0) return null;

  return (
    <div className="toaster-container">
      {activeToasts.map((toast) => (
        <Toast
          key={toast.id}
          notification={toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};

export default Toaster;
