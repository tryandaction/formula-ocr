/**
 * NotificationSystem组件
 * 显示操作成功/失败通知和错误消息
 */

import React, { useEffect, useState } from 'react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
}

interface NotificationSystemProps {
  /** 通知列表 */
  notifications: Notification[];
  /** 移除通知回调 */
  onRemove?: (id: string) => void;
}

/**
 * 单个通知项组件
 */
const NotificationItem: React.FC<{
  notification: Notification;
  onRemove: (id: string) => void;
}> = ({ notification, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const duration = notification.duration ?? 3000;
    
    // 自动移除
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onRemove(notification.id), 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [notification, onRemove]);

  // 获取通知样式
  const getNotificationStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 16px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      marginBottom: '12px',
      minWidth: '300px',
      maxWidth: '400px',
      fontSize: '14px',
      fontWeight: '500',
      transition: 'all 0.3s ease',
      opacity: isExiting ? 0 : 1,
      transform: isExiting ? 'translateX(100%)' : 'translateX(0)',
    };

    switch (notification.type) {
      case 'success':
        return {
          ...baseStyle,
          backgroundColor: '#d1fae5',
          color: '#065f46',
          border: '1px solid #6ee7b7',
        };
      case 'error':
        return {
          ...baseStyle,
          backgroundColor: '#fee2e2',
          color: '#991b1b',
          border: '1px solid #fca5a5',
        };
      case 'warning':
        return {
          ...baseStyle,
          backgroundColor: '#fef3c7',
          color: '#92400e',
          border: '1px solid #fcd34d',
        };
      case 'info':
        return {
          ...baseStyle,
          backgroundColor: '#dbeafe',
          color: '#1e40af',
          border: '1px solid #93c5fd',
        };
      default:
        return baseStyle;
    }
  };

  // 获取图标
  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '';
    }
  };

  return (
    <div style={getNotificationStyle()}>
      {/* 图标 */}
      <div
        style={{
          fontSize: '18px',
          fontWeight: '700',
          flexShrink: 0,
        }}
      >
        {getIcon()}
      </div>

      {/* 消息 */}
      <div style={{ flex: 1 }}>{notification.message}</div>

      {/* 关闭按钮 */}
      <button
        onClick={() => {
          setIsExiting(true);
          setTimeout(() => onRemove(notification.id), 300);
        }}
        style={{
          border: 'none',
          backgroundColor: 'transparent',
          cursor: 'pointer',
          fontSize: '16px',
          color: 'inherit',
          opacity: 0.6,
          padding: '0',
          width: '20px',
          height: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.6';
        }}
      >
        ×
      </button>
    </div>
  );
};

/**
 * NotificationSystem组件实现
 */
export const NotificationSystem: React.FC<NotificationSystemProps> = ({
  notifications,
  onRemove,
}) => {
  const handleRemove = (id: string) => {
    onRemove?.(id);
  };

  if (notifications.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 3000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
      }}
    >
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onRemove={handleRemove}
        />
      ))}
    </div>
  );
};

/**
 * 通知管理Hook
 */
export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (
    type: NotificationType,
    message: string,
    duration?: number
  ) => {
    const id = `notification-${Date.now()}-${Math.random()}`;
    const notification: Notification = { id, type, message, duration };
    setNotifications((prev) => [...prev, notification]);
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const showSuccess = (message: string, duration?: number) => {
    addNotification('success', message, duration);
  };

  const showError = (message: string, duration?: number) => {
    addNotification('error', message, duration);
  };

  const showWarning = (message: string, duration?: number) => {
    addNotification('warning', message, duration);
  };

  const showInfo = (message: string, duration?: number) => {
    addNotification('info', message, duration);
  };

  return {
    notifications,
    removeNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
};
