import React from 'react';
import { NotificationStatus as NotificationStatusType } from '../../types/notification';
import './NotificationStatus.css';

interface NotificationStatusProps {
  status: NotificationStatusType;
}

const NotificationStatus: React.FC<NotificationStatusProps> = ({ status }) => {
  const platforms = ['telegram', 'whatsapp', 'facebook'] as const;

  return (
    <div className="notification-status">
      <div className="status-label">Notifications:</div>
      <div className="platform-statuses">
        {platforms.map(platform => {
          const platformStatus = status.sentTo[platform];
          if (!platformStatus) return null;

          return (
            <span
              key={platform}
              className={`platform-badge ${platformStatus.success ? 'success' : platformStatus.sent ? 'failed' : 'pending'}`}
              title={platformStatus.error || `${platform} notification`}
            >
              {platform === 'telegram' && '📱'}
              {platform === 'whatsapp' && '💬'}
              {platform === 'facebook' && '📘'}
              {platformStatus.success ? '✓' : platformStatus.sent ? '✗' : '-'}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default NotificationStatus;


















