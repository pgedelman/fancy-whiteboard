// client/src/App.jsx
import React, { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { socket } from './socket';
import Canvas from './components/Canvas';
import Toolbar from './components/Toolbar';
import Cursors from './components/Cursors';

export default function App() {
  const [color, setColor] = useState('#000000');
  const [tool, setTool] = useState('pen')
  const [size, setSize] = useState(6);
  const [prevColors, setPrevColors] = useState([]);

  let userId = localStorage.getItem('wb_uid');
  if (!userId) {
    userId = uuid();
    localStorage.setItem('wb_uid', userId);
  }
  
  // update prev colors when color changes
  const pushPrevColor = (c) => {
    setPrevColors(prev => {
      const copy = [c, ...prev.filter(x=>x!==c)].slice(0,6);
      return copy;
    });
  };

  return (
    <div className="app">
      <Toolbar
        color={color}
        setColor={(c) => { setColor(c); pushPrevColor(c); }}
        tool={tool}
        setTool={(t) => { setTool(t)} }
        size={size}
        setSize={setSize}
        socket={socket}
        userId={userId}
        prevColors={prevColors}
      />
      <div className="workspace">
        <Canvas socket={socket} userId={userId} color={color} size={size} tool={tool} />
        <Cursors socket={socket} />
      </div>
    </div>
  );
}
