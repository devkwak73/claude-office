import React, { useEffect, useRef, useState } from 'react';
import { useEvents } from './useEvents';
import { Office } from './game/office';
import { Header } from './ui/Header';
import { SidePanel } from './ui/SidePanel';
import { LogPanel } from './ui/LogPanel';

export default function App() {
  const { connected, skills, recent, bus } = useEvents();
  const stageRef = useRef<HTMLDivElement>(null);
  const officeRef = useRef<Office | null>(null);
  const [active, setActive] = useState<Set<string>>(new Set());

  useEffect(() => {
    const office = new Office();
    officeRef.current = office;
    if (stageRef.current) {
      office.mount(stageRef.current).catch(err => console.error(err));
    }
    return () => {
      try { office.app.destroy(true, { children: true, texture: true }); } catch { /* ignore */ }
    };
  }, []);

  useEffect(() => {
    officeRef.current?.setSkills(skills);
  }, [skills]);

  useEffect(() => {
    const off = bus.on(ev => {
      officeRef.current?.handleEvent(ev);
      if (ev.kind === 'skill_start' && ev.target) {
        setActive(prev => { const next = new Set(prev); next.add(ev.target!); return next; });
      } else if (ev.kind === 'skill_end' && ev.target) {
        setActive(prev => { const next = new Set(prev); next.delete(ev.target!); return next; });
      }
    });
    return off;
  }, [bus]);

  const playDemo = () => {
    fetch('/api/demo', { method: 'POST' }).catch(() => {});
  };

  return (
    <div className="layout">
      <Header connected={connected} recent={recent} onPlayDemo={playDemo} />
      <div className="stage" ref={stageRef} />
      <SidePanel connected={connected} skills={skills} active={active} recent={recent} />
      <LogPanel events={recent} />
    </div>
  );
}
