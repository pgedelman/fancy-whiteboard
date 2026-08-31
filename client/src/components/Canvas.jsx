// client/src/components/Canvas.jsx
import React, { useRef, useEffect } from 'react';
import throttle from 'lodash.throttle';
import { socket } from '../socket';

// Helper: get device-scaled canvas internal width/height (in pixels)
function setCanvasDPI(canvas, ctx) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  // Reset transforms and scale for drawing in CSS coords
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

// Convert client event to normalized [0..1] coordinates (relative to canvas pixel buffer)
function eventToNormalized(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const cssX = clientX - rect.left;
  const cssY = clientY - rect.top;
  const normX = cssX / rect.width;
  const normY = cssY / rect.height;
  return { normX, normY, cssX, cssY };
}

// Denormalize a stored point back to CSS pixel coordinates (we draw in CSS
// coordinates because the canvas context transform already accounts for DPR)
function denormToCss(p, canvas) {
  const rect = canvas.getBoundingClientRect();
  return { x: p.x * rect.width, y: p.y * rect.height };
}

export default function Canvas({ socket: parentSocket, userId, color, size, tool }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const drawingRef = useRef(false);
  const currentPointsRef = useRef([]); // normalized points
  const historyRef = useRef([]);
  const s = parentSocket || socket;

  // setup canvas DPI scaling
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctxRef.current = ctx;
    function resize() {
      setCanvasDPI(canvas, ctx);
      redrawAll();
    }
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // handle socket events
  useEffect(() => {
    s.emit('join-room', () => {});
    s.on('board-history', (strokes) => {
      historyRef.current = strokes || [];
      redrawAll();
    });
    s.on('stroke', (stroke) => {
      historyRef.current.push(stroke);
      applyStroke(stroke);
    });
    s.on('clear', () => {
      historyRef.current = [];
      clearCanvas();
    });
    return () => {
      s.off('board-history');
      s.off('stroke');
      s.off('clear');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s]);

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
  }

  function redrawAll() {
    clearCanvas();
    const strokes = historyRef.current || [];
    strokes.forEach(s => applyStroke(s));
  }

  // apply a stroke object (type may be 'stroke'|'eraser'|'fill')
  function applyStroke(stroke) {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (!stroke) return;

    if (stroke.type === 'fill') {
      // fill entire canvas with color
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = stroke.color || '#ffffff';
      const rect = canvas.getBoundingClientRect();
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.restore();
      return;
    }

    if (stroke.type === 'eraser') {
      // eraser: use destination-out to clear pixels along points
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = stroke.size;
      ctx.beginPath();
      const pts = stroke.points;
      if (!pts || pts.length < 1) { ctx.restore(); return; }
      const p0 = denormToCss(pts[0], canvas);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < pts.length; i++) {
        const p = denormToCss(pts[i], canvas);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.restore();
      return;
    }

    // normal pen stroke
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = stroke.color || '#000';
    ctx.lineWidth = stroke.size || 4;
    ctx.beginPath();
    const pts = stroke.points;
    if (!pts || pts.length < 1) { ctx.restore(); return; }
    const p0 = denormToCss(pts[0], canvas);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < pts.length; i++) {
      const p = denormToCss(pts[i], canvas);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // throttled cursor emit (send CSS pixel coords to cursor overlay)
  const emitCursor = throttle((payload) => s.emit('cursor', payload), 50);

  // when pointer down: start collecting normalized points
  function pointerDown(e) {
    e.preventDefault();
    const canvas = canvasRef.current;
    const { normX, normY } = eventToNormalized(e, canvas);
    drawingRef.current = true;
    currentPointsRef.current = [{ x: normX, y: normY }];
  }

  function pointerMove(e) {
    const canvas = canvasRef.current;
    const { normX, normY, cssX, cssY } = eventToNormalized(e, canvas);

    // emit cursor in CSS coordinates (for cursor overlay)
    emitCursor({ userId, x: cssX, y: cssY, color });

    if (!drawingRef.current) return;
    const pts = currentPointsRef.current;
    pts.push({ x: normX, y: normY });

    // draw incremental segment locally:
    const ctx = ctxRef.current;
    if (!ctx) return;
    const lastIdx = pts.length - 1;
    if (lastIdx < 1) return;
    const a = denormToCss(pts[lastIdx - 1], canvas);
    const b = denormToCss(pts[lastIdx], canvas);

    ctx.save();
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
    }
    ctx.lineWidth = size;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();

    // emit a throttled, non-final stroke snapshot so peers see live progress
    // (the server broadcasts these but does not persist them)
    throttledEmitSnapshot({ userId, type: tool === 'eraser' ? 'eraser' : 'stroke', color, size, points: pts.slice(), final: false });
  }

  // finalizing pointer up: send final stroke (unthrottled)
  function pointerUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const pts = currentPointsRef.current;
    if (!pts || pts.length < 1) return;

    // send final stroke, which the server persists
    const strokeObj = { id: `${Date.now()}-${Math.random().toString(36).slice(2,9)}`, userId, type: tool === 'eraser' ? 'eraser' : 'stroke', color, size, points: pts.slice(), createdAt: new Date(), final: true };
    s.emit('stroke', strokeObj);
    historyRef.current.push(strokeObj);
    currentPointsRef.current = [];
  }

  // throttled snapshot emitter reduces network spam while drawing
  const throttledEmitSnapshot = throttle((stroke) => {
    // send small snapshot: server persists full strokes when final stroke arrives; snapshots are broadcast for real-time
    s.emit('stroke', stroke);
  }, 120);

  // set up pointer events
  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    window.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerUp);
    return () => {
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      window.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointercancel', pointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, color, size]);


  return (
    <div className="canvas-container">
      <canvas ref={canvasRef} className="board-canvas" style={{ width: '100%', height: '80vh', touchAction: 'none', background: '#fff', cursor: 'crosshair' }} />
    </div>
  );
}
