import { useState, useEffect, useRef, useCallback } from 'react';
import type { DashboardState, Session, WsStateUpdate } from '../types/api';

const API_BASE = 'http://localhost:3001';

export function useDashboard() {
  const [agentState, setAgentState]     = useState<DashboardState | null>(null);
  const [connected, setConnected]       = useState(false);
  const [now, setNow]                   = useState(Date.now());
  const [sessions, setSessions]         = useState<Session[]>([]);
  const [notifMuted, setNotifMuted]     = useState(() => {
    try { return localStorage.getItem('dashboard-notif-muted') === 'true'; } catch { return false; }
  });
  const prevStateRef = useRef<DashboardState | null>(null);

  // Live clock
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // WebSocket connection with auto-reconnect
  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl      = `${wsProtocol}//localhost:3001/ws`;
    let socket: WebSocket | null = null;
    let reconnectDelay = 1000;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let intentionalClose = false;

    function connect() {
      socket = new WebSocket(wsUrl);
      socket.onopen = () => { setConnected(true); reconnectDelay = 1000; };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string) as WsStateUpdate;
          if (message.type === 'state_update') setAgentState(message.payload);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };
      socket.onclose = () => {
        setConnected(false);
        if (!intentionalClose) {
          reconnectTimer = setTimeout(() => {
            reconnectDelay = Math.min(reconnectDelay * 2, 15000);
            connect();
          }, reconnectDelay);
        }
      };
      socket.onerror = () => {};
    }

    connect();
    return () => {
      intentionalClose = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) socket.close();
    };
  }, []);

  // Desktop notifications
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!agentState || notifMuted || !('Notification' in window) || Notification.permission !== 'granted') {
      prevStateRef.current = agentState;
      return;
    }
    const prev = prevStateRef.current;
    if (prev?.specialists) {
      const prevSpecs = prev.specialists;
      const newSpecs  = agentState.specialists;
      for (const name of Object.keys(newSpecs)) {
        const prevStatus = prevSpecs[name]?.status;
        const newStatus  = newSpecs[name]?.status;
        if (prevStatus === 'running' && newStatus === 'completed') {
          new Notification('Agent completed', { body: `${name} finished task`, tag: `complete-${name}`, silent: false });
        }
        if (prevStatus === 'running' && newStatus === 'error') {
          new Notification('Agent error', { body: `${name} encountered an error`, tag: `error-${name}`, silent: false });
        }
      }
    }
    prevStateRef.current = agentState;
  }, [agentState, notifMuted]);

  // Favicon + tab title
  useEffect(() => {
    if (!agentState) {
      document.title = 'Agent Monitor';
      return;
    }
    const active = agentState.globalMetrics.activeAgents || 0;
    document.title = active > 0 ? `(${active}) Agent Monitor` : 'Agent Monitor';

    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 32, 32);
    grad.addColorStop(0, '#34d399');
    grad.addColorStop(1, '#22d3ee');
    ctx.fillStyle = grad;
    ctx.beginPath();
    const r = 6, x = 2, y = 2, w = 28, h = 28;
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }
    ctx.fill();

    ctx.fillStyle = '#000';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A', 16, 16);

    if (active > 0) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(24, 8, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(active > 9 ? '9+' : String(active), 24, 8);
    }

    let link = document.querySelector('link[rel="icon"][data-dynamic]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      link.setAttribute('data-dynamic', '1');
      document.head.appendChild(link);
    }
    link.href = canvas.toDataURL('image/png');

    return () => {
      document.title = 'Agent Monitor';
      const dynLink = document.querySelector('link[rel="icon"][data-dynamic]');
      if (dynLink) dynLink.remove();
    };
  }, [agentState]);

  const toggleMute = useCallback(() => {
    setNotifMuted((m) => {
      const next = !m;
      localStorage.setItem('dashboard-notif-muted', String(next));
      return next;
    });
  }, []);

  const fetchSessions = useCallback(() => {
    fetch(`${API_BASE}/api/sessions`)
      .then((r) => r.json())
      .then(setSessions)
      .catch(() => {});
  }, []);

  const archiveSession = useCallback(() => {
    fetch(`${API_BASE}/api/session/archive`, { method: 'POST' })
      .then((r) => r.json())
      .then(() => fetchSessions())
      .catch(() => {});
  }, [fetchSessions]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  return {
    agentState,
    connected,
    now,
    sessions,
    notifMuted,
    toggleMute,
    fetchSessions,
    archiveSession,
  };
}
