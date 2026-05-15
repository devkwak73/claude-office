import { useEffect, useRef, useState } from 'react';
import type { NormalizedEvent, SkillEntry } from './types';

export interface Bus {
  on(handler: (e: NormalizedEvent) => void): () => void;
}

interface State {
  connected: boolean;
  skills: SkillEntry[];
  recent: NormalizedEvent[];
  bus: Bus;
}

export function useEvents(): State {
  const [connected, setConnected] = useState(false);
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [recent, setRecent] = useState<NormalizedEvent[]>([]);
  const handlersRef = useRef(new Set<(e: NormalizedEvent) => void>());

  useEffect(() => {
    const bus: Bus = {
      on(h) {
        handlersRef.current.add(h);
        return () => handlersRef.current.delete(h);
      },
    };
    (window as any).__bus = bus;

    let ws: WebSocket | null = null;
    let killed = false;
    let retry = 0;

    function dispatch(ev: NormalizedEvent) {
      setRecent(prev => {
        const next = prev.concat(ev);
        return next.length > 200 ? next.slice(next.length - 200) : next;
      });
      handlersRef.current.forEach(h => { try { h(ev); } catch { /* ignore */ } });
    }

    function open() {
      if (killed) return;
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/ws`);
      ws.onopen = () => { setConnected(true); retry = 0; };
      ws.onclose = () => {
        setConnected(false);
        if (killed) return;
        retry = Math.min(retry + 1, 6);
        setTimeout(open, 500 * retry);
      };
      ws.onerror = () => { try { ws?.close(); } catch {} };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'hello') {
            if (Array.isArray(msg.skills)) setSkills(msg.skills);
            if (Array.isArray(msg.events)) {
              setRecent(msg.events);
              // 마지막 30개는 office.handleEvent에도 흘려서 직전 상태 복원
              const tail = msg.events.slice(-30);
              for (const ev of tail) handlersRef.current.forEach(h => { try { h(ev); } catch {} });
            }
          } else if (msg.type === 'event' && msg.event) {
            dispatch(msg.event);
          }
        } catch { /* ignore */ }
      };
    }
    open();

    return () => { killed = true; try { ws?.close(); } catch {} };
  }, []);

  // bus는 한 번만 만들고 재사용
  const busRef = useRef<Bus>({
    on(h) {
      handlersRef.current.add(h);
      return () => handlersRef.current.delete(h);
    },
  });

  return { connected, skills, recent, bus: busRef.current };
}
