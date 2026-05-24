import React, { useState } from 'react';
import { useNotification } from '../../context/NotificationContext';
import './Notifications.css';

const NotificationQueue: React.FC = () => {
  const { notifications, clearAll } = useNotification();
  const [isOpen, setIsOpen] = useState(false);

  if (notifications.length === 0) {
    return null;
  }

  const toggleQueue = () => setIsOpen(!isOpen);

  return (
    <div className={`notification-queue-container ${isOpen ? 'open' : ''}`}>
      <div className="queue-header" onClick={toggleQueue}>
        <div className="queue-title">
          Notifications ({notifications.length})
        </div>
        <button className="queue-toggle-btn">
          {isOpen ? '▼' : '▲'}
        </button>
      </div>

      {isOpen && (
        <div className="queue-body">
          <div className="queue-actions">
            <button className="queue-clear-btn" onClick={clearAll}>
              Clear All
            </button>
          </div>
          <div className="queue-list">
            {notifications.map((notif) => (
              <div key={notif.id} className={`queue-item type-${notif.type}`}>
                <div className="queue-item-header">
                  <span className={`status-dot dot-${notif.type}`}></span>
                  <span className="queue-page">{notif.page}</span>
                  <span className="queue-separator">|</span>
                  <span className="queue-source">{notif.source}</span>
                  <span className="queue-time">
                    {new Date(notif.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="queue-message">{notif.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationQueue;
