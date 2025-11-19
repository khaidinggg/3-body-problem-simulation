import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Settings2 } from 'lucide-react';

// --- Constants & Types ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const TRAIL_LENGTH = 100;

// Colors for the three bodies
const COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D'];

// --- Initial State Generators ---

const generateChaoticState = () => {
  return [
    { x: 400, y: 300, vx: 1.5, vy: 0.5, mass: 200, color: COLORS[0] },
    { x: 300, y: 400, vx: -1.0, vy: 0.5, mass: 150, color: COLORS[1] },
    { x: 500, y: 200, vx: 0, vy: -1.0, mass: 300, color: COLORS[2] },
  ];
};

const generateFigure8State = () => {
  // The famous stable figure-8 solution discovered by C. Moore
  return [
    { x: 400 + 97.000436, y: 300 - 24.308753, vx: 0.4662036850, vy: 0.4323657300, mass: 100, color: COLORS[0] },
    { x: 400 - 97.000436, y: 300 + 24.308753, vx: 0.4662036850, vy: 0.4323657300, mass: 100, color: COLORS[1] },
    { x: 400, y: 300, vx: -2 * 0.4662036850, vy: -2 * 0.4323657300, mass: 100, color: COLORS[2] },
  ];
};

const ThreeBodySimulation = () => {
  // --- React State for UI ---
  const [bodies, setBodies] = useState(generateChaoticState());
  const [gravity, setGravity] = useState(0.5);
  const [speed, setSpeed] = useState(1);
  const [isRunning, setIsRunning] = useState(true);
  const [showTrails, setShowTrails] = useState(true);

  // --- Refs for Animation Loop ---
  const canvasRef = useRef(null);
  const requestRef = useRef();
  
  // We use refs for physics state to avoid React re-render overhead during the game loop
  const physicsRef = useRef({
    bodies: generateChaoticState(),
    trails: [[], [], []] // Stores history of positions
  });

  // Sync React state changes to Physics Ref
  useEffect(() => {
    // Only update masses/properties, preserve positions if simulation is running
    physicsRef.current.bodies.forEach((b, i) => {
      b.mass = bodies[i].mass;
    });
  }, [bodies]);

  // --- Physics Engine ---
  const updatePhysics = () => {
    const currentBodies = physicsRef.current.bodies;
    const dt = 0.5 * speed; // Time step

    // 1. Calculate Forces & Accelerations
    const forces = currentBodies.map(() => ({ fx: 0, fy: 0 }));

    for (let i = 0; i < currentBodies.length; i++) {
      for (let j = 0; j < currentBodies.length; j++) {
        if (i === j) continue;

        const dx = currentBodies[j].x - currentBodies[i].x;
        const dy = currentBodies[j].y - currentBodies[i].y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);
        
        // Softening parameter to prevent division by zero / infinity fling
        const softDist = Math.max(dist, 10); 

        const f = (gravity * currentBodies[i].mass * currentBodies[j].mass) / (softDist * softDist);

        const fx = f * (dx / dist);
        const fy = f * (dy / dist);

        forces[i].fx += fx;
        forces[i].fy += fy;
      }
    }

    // 2. Update Velocities and Positions (Semi-Implicit Euler)
    currentBodies.forEach((body, i) => {
      const ax = forces[i].fx / body.mass;
      const ay = forces[i].fy / body.mass;

      body.vx += ax * dt;
      body.vy += ay * dt;

      body.x += body.vx * dt;
      body.y += body.vy * dt;
    });

    // 3. Update Trails
    if (showTrails) {
      physicsRef.current.trails.forEach((trail, i) => {
        trail.push({ x: currentBodies[i].x, y: currentBodies[i].y });
        if (trail.length > TRAIL_LENGTH) trail.shift();
      });
    }
  };

  // --- Rendering Loop ---
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Clear Canvas with trailing effect (optional) or solid clear
    ctx.fillStyle = 'rgba(15, 23, 42, 0.3)'; // Dark blue bg with fade
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const { bodies: currentBodies, trails } = physicsRef.current;

    // Draw Trails
    if (showTrails) {
      trails.forEach((trail, index) => {
        if (trail.length < 2) return;
        ctx.beginPath();
        ctx.strokeStyle = currentBodies[index].color;
        ctx.lineWidth = 2;
        for (let i = 0; i < trail.length - 1; i++) {
          // Opacity fade based on trail age
          ctx.globalAlpha = i / trail.length; 
          ctx.lineTo(trail[i].x, trail[i].y);
          // Tiny optimization: stroke usually better outside loop, but needed here for gradient alpha
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(trail[i].x, trail[i].y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1.0; // Reset alpha
      });
    }

    // Draw Bodies
    currentBodies.forEach((body) => {
      ctx.beginPath();
      ctx.arc(body.x, body.y, Math.sqrt(body.mass) * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = body.color;
      ctx.shadowBlur = 15;
      ctx.shadowColor = body.color;
      ctx.fill();
      ctx.shadowBlur = 0; // Reset shadow
      ctx.closePath();
    });
  };

  const loop = () => {
    if (isRunning) {
      updatePhysics();
    }
    draw();
    requestRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [isRunning, gravity, speed, showTrails]); // Re-bind if these change, though refs handle most

  // --- Interaction Handlers ---

  const resetSimulation = (type = 'chaotic') => {
    const newState = type === 'figure8' ? generateFigure8State() : generateChaoticState();
    setBodies(newState); // Update UI state
    physicsRef.current.bodies = JSON.parse(JSON.stringify(newState)); // Update Physics state
    physicsRef.current.trails = [[], [], []]; // Clear trails
    
    // If figure 8, we usually need higher gravity or specific constants, 
    // but here we keep gravity constant for simplicity or tweak it:
    if(type === 'figure8') setGravity(1.0);
  };

  const handleMassChange = (index, newMass) => {
    const newBodies = [...bodies];
    newBodies[index].mass = Number(newMass);
    setBodies(newBodies);
    physicsRef.current.bodies[index].mass = Number(newMass);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-slate-200 p-4 font-sans">
      <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-pink-500 to-teal-400 bg-clip-text text-transparent">
        3-Body Problem Visualization
      </h1>

      <div className="flex flex-col lg:flex-row gap-6 bg-slate-800 p-4 rounded-xl shadow-2xl border border-slate-700">
        
        {/* Canvas Container */}
        <div className="relative rounded-lg overflow-hidden border border-slate-600 bg-black shadow-inner">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="block cursor-crosshair"
          />
          <div className="absolute top-4 left-4 text-xs text-slate-400 pointer-events-none">
            G = {gravity} <br />
            Speed = {speed}x
          </div>
        </div>

        {/* Controls Panel */}
        <div className="w-full lg:w-72 flex flex-col gap-6">
          
          {/* Main Actions */}
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md font-semibold transition ${
                isRunning ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
              } text-white`}
            >
              {isRunning ? <><Pause size={18} /> Pause</> : <><Play size={18} /> Play</>}
            </button>
            
            <button
              onClick={() => resetSimulation('chaotic')}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-md transition text-white"
              title="Reset Chaotic"
            >
              <RotateCcw size={20} />
            </button>
          </div>

          {/* Presets */}
          <div className="flex flex-col gap-2 p-4 bg-slate-700/50 rounded-lg">
            <span className="text-sm font-bold text-slate-400 flex items-center gap-2">
              <Settings2 size={14}/> Presets
            </span>
            <div className="flex gap-2">
              <button onClick={() => resetSimulation('chaotic')} className="text-xs bg-slate-600 hover:bg-slate-500 px-3 py-1 rounded transition">Chaotic</button>
              <button onClick={() => resetSimulation('figure8')} className="text-xs bg-slate-600 hover:bg-slate-500 px-3 py-1 rounded transition">Figure-8 (Stable)</button>
            </div>
          </div>

          {/* Global Parameters */}
          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 font-bold">Sim Speed</label>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-full accent-teal-400 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 font-bold">Gravity (G)</label>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.1"
                value={gravity}
                onChange={(e) => setGravity(Number(e.target.value))}
                className="w-full accent-purple-400 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  checked={showTrails} 
                  onChange={(e) => setShowTrails(e.target.checked)}
                  className="w-4 h-4 accent-teal-500"
                />
                <label className="text-sm text-slate-300">Show Trails</label>
            </div>
          </div>

          {/* Individual Body Controls */}
          <div className="space-y-4 border-t border-slate-700 pt-4">
            <h3 className="text-sm font-bold text-slate-300">Body Masses</h3>
            {bodies.map((body, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div 
                  className="w-3 h-3 rounded-full shadow-[0_0_8px]" 
                  style={{ backgroundColor: body.color, boxShadow: `0 0 8px ${body.color}` }}
                />
                <input
                  type="range"
                  min="10"
                  max="500"
                  value={body.mass}
                  onChange={(e) => handleMassChange(idx, e.target.value)}
                  className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                  style={{ accentColor: body.color }}
                />
                <span className="text-xs w-8 text-right font-mono text-slate-400">{body.mass}</span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};

export default ThreeBodySimulation;