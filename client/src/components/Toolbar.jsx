// client/src/components/Toolbar.jsx
import React from 'react';

export default function Toolbar({ color, setColor, tool, setTool, size, setSize, socket, userId, prevColors }) {
  const handleClear = () => socket.emit('clear');
  const handleUndo = () => socket.emit('undo', { userId });
  const handleEraseLast = () => socket.emit('erase-last');
  const handleFill = () => socket.emit('fill', { color, userId });

  return (
    <div className="toolbar">
      <label>
        Color:
        <input type="color" value={color} onChange={e => setColor(e.target.value)} />
      </label>

      <label>
        Tool:
        <select value={tool} onChange={e=>setTool(e.target.value)}>
          <option value="pen">Pen</option>
          <option value="eraser">Eraser</option>
        </select>
      </label>

      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <button onClick={() => setSize(3)}>Small</button>
        <button onClick={() => setSize(6)}>Medium</button>
        <button onClick={() => setSize(12)}>Large</button>
      </div>

      <label>
        Size: {size}
        <input type="range" min="1" max="30" value={size} onChange={e => setSize(Number(e.target.value))} />
      </label>

      <button onClick={handleUndo}>Undo (yours)</button>
      <button onClick={handleEraseLast}>Erase Last (global)</button>
      <button onClick={handleClear}>Clear</button>
      <button onClick={handleFill}>Fill Canvas</button>
      

      <div style={{ display:'flex', gap:6 }}>
        {prevColors.map((c) => (
          <button key={c} onClick={() => setColor(c)} style={{ background: c, width: 28, height: 28, borderRadius:6, border:'1px solid #ccc' }} />
        ))}
      </div>
    </div>
  );
}
