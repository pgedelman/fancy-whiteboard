// client/src/components/Cursors.jsx
import React, { useEffect, useState } from 'react';
import { socket } from '../socket';

export default function Cursors({ socket: parentSocket }) {
  const [cursors, setCursors] = useState({});

  useEffect(() => {
    const s = parentSocket || socket;
    function onCursor(data) {
      if (!data || !data.userId) return;
      // data.x/y are normalized (0..1) relative positions in CSS pixels; we expect sender to send CSS positions
      setCursors(prev => ({ ...prev, [data.userId]: { x: data.x, y: data.y, color: data.color } }));
      setTimeout(() => {
        setCursors(prev => { const copy = { ...prev }; if (copy[data.userId]) delete copy[data.userId]; return copy; });
      }, 3000);
    }
    s.on('cursor', onCursor);
    return () => s.off('cursor', onCursor);
  }, [parentSocket]);

  return (
    <div className="cursor-layer" aria-hidden>
      {Object.entries(cursors).map(([id, p]) => (
        <div key={id} className="remote-cursor" style={{ left: `${p.x}px`, top: `${p.y}px` }}>
          <div className="dot" style={{ background: p.color || '#000' }} />
        </div>
      ))}
    </div>
  );
}
