'use client';

import React, { useState, useEffect } from 'react';
import { Bell, Heart, Mic, CheckCircle2, MessageSquare, AlertCircle } from 'lucide-react';
import type { D1Notification } from '@/lib/d1-database';
import { useAuth } from '@/lib/auth-context';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationsModal({ isOpen, onClose }: NotificationsModalProps) {
  const { user, token } = useAuth();
  const [notifications, setNotifications] = useState<D1Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadNotifications = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch (e) {
      console.error('Failed to load notifications', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isOpen && token) {
      loadNotifications();
    }
  }, [isOpen, token, loadNotifications]);

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: 1 })));
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="notifications-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="notifications-card"
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">Activity Notifications</h2>
              <p className="text-xs text-zinc-400">Interactions on your questions & Ruts</p>
            </div>
          </div>
          <button
            id="close-notifications-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 flex items-center justify-center text-sm transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Action bar */}
        <div className="px-5 py-2.5 border-b border-zinc-800/80 bg-zinc-950/40 flex items-center justify-between text-xs text-zinc-400">
          <span>Logged in as {user?.display_name || 'Guest'}</span>
          {notifications.some((n) => n.read === 0) && (
            <button
              id="mark-all-notifications-read-btn"
              onClick={markAllRead}
              className="text-amber-400 hover:text-amber-300 font-medium transition-colors"
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* List */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
          {loading ? (
            <div className="py-12 text-center text-xs text-zinc-500">Checking activity...</div>
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 space-y-2">
              <CheckCircle2 className="w-8 h-8 mx-auto text-zinc-600" />
              <p className="text-xs font-medium text-zinc-300">No activity yet</p>
              <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                When someone likes your Voice Rut or answers one of your street questions, you will receive an alert here!
              </p>
            </div>
          ) : (
            notifications.map((n) => {
              const isUnread = n.read === 0;
              return (
                <div
                  key={n.id}
                  id={`notification-item-${n.id}`}
                  className={`p-3 rounded-xl border transition-all flex items-start gap-3 ${
                    isUnread
                      ? 'bg-amber-500/10 border-amber-500/30 text-zinc-100'
                      : 'bg-zinc-850/50 border-zinc-800 text-zinc-300'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {n.type === 'like' ? (
                      <Heart className="w-4 h-4 text-rose-400 fill-rose-400/30" />
                    ) : (
                      <Mic className="w-4 h-4 text-amber-400" />
                    )}
                  </div>

                  <div className="flex-1 text-xs">
                    <p className="leading-snug">{n.message}</p>
                    <span className="text-[10px] text-zinc-500 mt-1 block">
                      {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {isUnread && <span className="w-2 h-2 rounded-full bg-amber-400 mt-1.5" />}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
