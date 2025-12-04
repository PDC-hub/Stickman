import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import { Stickman } from './components/Stickman';
import { Pose, Keyframe, INITIAL_POSE, JOINT_CONFIG } from './types';
import { Play, Pause, Plus, Trash2, RotateCcw, Undo2, Video } from 'lucide-react';

// --- Scene Recorder Component ---
// Captures the canvas stream and handles video file download
const SceneRecorder = ({ 
  recording, 
  onStop 
}: { 
  recording: boolean; 
  onStop: () => void;
}) => {
  const { gl } = useThree();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (recording) {
      chunksRef.current = [];
      const canvas = gl.domElement;
      
      // Capture stream at 30 FPS
      const stream = canvas.captureStream(30);
      
      // Prefer VP9 for better compression, fallback to default webm
      const mimeType = MediaRecorder.isTypeSupported("video/webm; codecs=vp9") 
        ? "video/webm; codecs=vp9" 
        : "video/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `stickman-anim-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        onStop(); // Notify parent that file is ready
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
    } else {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    }
  }, [recording, gl, onStop]);

  return null;
};

// --- Animation Runner Component ---
const AnimationRunner = ({ 
  isPlaying, 
  isRecording,
  keyframes, 
  onUpdatePose,
  onLoopEnd
}: { 
  isPlaying: boolean, 
  isRecording: boolean,
  keyframes: Keyframe[], 
  onUpdatePose: (p: Pose) => void,
  onLoopEnd: () => void
}) => {
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);

  useFrame((state) => {
    if (!isPlaying || keyframes.length < 2) return;

    // Calculate total duration of animation loop
    const totalDuration = keyframes.reduce((acc, kf) => acc + kf.duration, 0);
    const now = state.clock.getElapsedTime() * 1000; // ms

    if (startTimeRef.current === 0) {
      startTimeRef.current = now - pausedTimeRef.current;
    }

    const diff = now - startTimeRef.current;

    // If recording, strictly check if we passed total duration to stop exactly at end of loop
    if (isRecording && diff >= totalDuration) {
        onUpdatePose(keyframes[keyframes.length - 1].pose); // Snap to last frame
        onLoopEnd();
        return;
    }

    const elapsed = diff % totalDuration;
    
    // Find current keyframe segment
    let accumulatedTime = 0;
    let startFrameIndex = 0;

    for (let i = 0; i < keyframes.length; i++) {
        if (elapsed < accumulatedTime + keyframes[i].duration) {
            startFrameIndex = i;
            break;
        }
        accumulatedTime += keyframes[i].duration;
    }

    const endFrameIndex = (startFrameIndex + 1) % keyframes.length;
    const startFrame = keyframes[startFrameIndex];
    const endFrame = keyframes[endFrameIndex];
    
    // Interpolation factor (0 to 1)
    const segmentTime = elapsed - accumulatedTime;
    const alpha = segmentTime / startFrame.duration;

    // Linear interpolation of angles (Lerp)
    const newPose: Pose = { ...INITIAL_POSE };
    
    Object.keys(INITIAL_POSE).forEach((key) => {
        const startRot = startFrame.pose[key] || INITIAL_POSE[key];
        const endRot = endFrame.pose[key] || INITIAL_POSE[key];

        newPose[key] = {
            x: startRot.x + (endRot.x - startRot.x) * alpha,
            y: startRot.y + (endRot.y - startRot.y) * alpha,
            z: startRot.z + (endRot.z - startRot.z) * alpha,
        };
    });

    onUpdatePose(newPose);
  });

  // Reset timer logic when play/pause toggles
  useEffect(() => {
    if (!isPlaying) {
       startTimeRef.current = 0; 
    }
  }, [isPlaying]);

  return null;
};

export default function App() {
  const [currentPose, setCurrentPose] = useState<Pose>(JSON.parse(JSON.stringify(INITIAL_POSE)));
  const [selectedJoint, setSelectedJoint] = useState<string | null>(null);
  
  // Animation State
  const [keyframes, setKeyframes] = useState<Keyframe[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [playbackPose, setPlaybackPose] = useState<Pose | null>(null);

  const handleUpdateJoint = (axis: 'x' | 'y' | 'z', value: number) => {
    if (!selectedJoint) return;
    if (isPlaying) return;

    setCurrentPose(prev => ({
      ...prev,
      [selectedJoint]: {
        ...prev[selectedJoint],
        [axis]: value
      }
    }));
  };

  const handleAddKeyframe = () => {
    const newKeyframe: Keyframe = {
      id: crypto.randomUUID(),
      pose: JSON.parse(JSON.stringify(currentPose)), // Deep copy
      duration: 1000 // Default 1s
    };
    setKeyframes([...keyframes, newKeyframe]);
  };

  const handleUpdateKeyframeDuration = (id: string, duration: number) => {
    setKeyframes(prev => prev.map(kf => kf.id === id ? { ...kf, duration } : kf));
  };

  const handleDeleteKeyframe = (id: string) => {
    setKeyframes(prev => prev.filter(kf => kf.id !== id));
  };

  const handlePlayToggle = () => {
    if (keyframes.length < 1) return;
    setIsPlaying(!isPlaying);
    if (isPlaying) {
        setPlaybackPose(null);
        setIsRecording(false);
    }
  };

  const handleExportVideo = () => {
    if (keyframes.length < 2) {
        alert("Need at least 2 keyframes to record.");
        return;
    }
    // Start recording state
    setIsRecording(true);
    setIsPlaying(true);
  };

  const handleRecordingLoopEnd = () => {
    // Stop playing and recording when loop finishes
    setIsPlaying(false);
    setIsRecording(false);
    setPlaybackPose(null);
    // The Recorder component will handle the file download on cleanup/stop
  };

  const handleLoadPose = (pose: Pose) => {
      if(isPlaying) return;
      setCurrentPose(JSON.parse(JSON.stringify(pose)));
  };

  const renderedPose = isPlaying && playbackPose ? playbackPose : currentPose;
  const selectedJointConfig = JOINT_CONFIG.find(j => j.id === selectedJoint);

  return (
    <div className="flex flex-col w-full h-screen text-slate-200 bg-slate-900 font-sans">
      
      {/* 3D Canvas Area */}
      <div className="flex-grow relative z-0">
        <Canvas shadows camera={{ position: [5, 4, 8], fov: 40 }}>
          <color attach="background" args={['#1e293b']} />
          <Suspense fallback={null}>
            <Environment preset="city" />
            <Stickman 
              pose={renderedPose} 
              selectedJoint={selectedJoint} 
              onSelectJoint={setSelectedJoint} 
            />
            <Grid infiniteGrid sectionSize={3} cellColor="#475569" sectionColor="#64748b" fadeDistance={30} />
            <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 1.8} />
          </Suspense>
          
          <AnimationRunner 
            isPlaying={isPlaying} 
            isRecording={isRecording}
            keyframes={keyframes} 
            onUpdatePose={setPlaybackPose} 
            onLoopEnd={handleRecordingLoopEnd}
          />
          
          <SceneRecorder 
            recording={isRecording} 
            onStop={() => console.log('Video saved')}
          />
        </Canvas>

        {/* HUD: Joint Controls */}
        <div className="absolute top-4 right-4 w-72 bg-slate-800/90 backdrop-blur-md p-4 rounded-xl border border-slate-700 shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-100">
               {selectedJointConfig ? selectedJointConfig.name : 'Select a Joint'}
            </h2>
            {selectedJoint && (
                <button 
                  onClick={() => setCurrentPose(prev => ({...prev, [selectedJoint]: {x:0, y:0, z:0}}))}
                  className="p-1 hover:bg-slate-700 rounded text-xs text-slate-400"
                  title="Reset Joint"
                >
                    <Undo2 size={16} />
                </button>
            )}
          </div>
          
          {selectedJoint ? (
            <div className="space-y-4">
               {['x', 'y', 'z'].map((axis) => (
                 <div key={axis} className="flex items-center gap-3">
                   <span className="uppercase text-slate-400 font-bold w-4">{axis}</span>
                   <input 
                     type="range" 
                     min={-3.14} 
                     max={3.14} 
                     step={0.01}
                     value={currentPose[selectedJoint]?.[axis as 'x'|'y'|'z'] || 0}
                     onChange={(e) => handleUpdateJoint(axis as any, parseFloat(e.target.value))}
                     className="flex-grow h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                     disabled={isPlaying}
                   />
                   <span className="w-10 text-right text-xs font-mono text-slate-400">
                     {(currentPose[selectedJoint]?.[axis as 'x'|'y'|'z'] || 0).toFixed(2)}
                   </span>
                 </div>
               ))}
            </div>
          ) : (
            <div className="text-sm text-slate-400 text-center py-4">
              Click a sphere on the stickman to rotate that joint.
            </div>
          )}
        </div>

        {/* HUD: Help */}
        <div className="absolute top-4 left-4 pointer-events-none">
            <h1 className="text-2xl font-bold text-white drop-shadow-md">3D Animator</h1>
            <p className="text-slate-400 text-sm">Left Click: Rotate Camera | Right Click: Pan | Scroll: Zoom</p>
        </div>
        
        {/* HUD: Recording Indicator */}
        {isRecording && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-red-500/90 text-white px-4 py-2 rounded-full shadow-lg animate-pulse z-50">
                <div className="w-3 h-3 bg-white rounded-full"></div>
                <span className="font-bold text-sm">RECORDING...</span>
            </div>
        )}
      </div>

      {/* Timeline / Animation Controls */}
      <div className="h-48 bg-slate-800 border-t border-slate-700 flex flex-col shadow-2xl z-10">
        
        {/* Toolbar */}
        <div className="h-12 border-b border-slate-700 flex items-center px-4 gap-4 bg-slate-900/50">
           <button 
             onClick={handlePlayToggle}
             disabled={keyframes.length < 1 || isRecording}
             className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-semibold transition-colors
               ${isPlaying 
                 ? 'bg-amber-500 hover:bg-amber-600 text-slate-900' 
                 : 'bg-green-600 hover:bg-green-700 text-white'
               } disabled:opacity-50 disabled:cursor-not-allowed`}
           >
             {isPlaying ? <><Pause size={18} /> Stop</> : <><Play size={18} /> Play Loop</>}
           </button>

           <div className="h-6 w-px bg-slate-700 mx-2"></div>

           <button 
             onClick={handleAddKeyframe}
             disabled={isPlaying}
             className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
           >
             <Plus size={18} /> Add Keyframe
           </button>
           
           <button 
             onClick={handleExportVideo}
             disabled={keyframes.length < 2 || isPlaying}
             className="flex items-center gap-2 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
             title="Record animation as WebM video"
           >
             <Video size={18} /> Export Video
           </button>
           
           <button 
             onClick={() => { setKeyframes([]); setIsPlaying(false); }}
             className="flex items-center gap-2 px-4 py-1.5 bg-slate-700 hover:bg-red-900/50 hover:text-red-400 text-slate-300 rounded-lg transition-colors ml-auto"
           >
             <RotateCcw size={16} /> Clear All
           </button>
        </div>

        {/* Frames Strip */}
        <div className="flex-grow overflow-x-auto p-4 flex gap-4 items-center hide-scrollbar">
            {keyframes.length === 0 && (
                <div className="w-full text-center text-slate-500 italic">
                    No keyframes yet. Pose the stickman and click "Add Keyframe".
                </div>
            )}
            
            {keyframes.map((kf, index) => (
                <div key={kf.id} className="relative group flex-shrink-0">
                    <div 
                        onClick={() => handleLoadPose(kf.pose)}
                        className={`w-32 h-24 rounded-lg border-2 cursor-pointer transition-all flex flex-col items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600
                        ${!isPlaying && JSON.stringify(kf.pose) === JSON.stringify(currentPose) ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-slate-600'}
                        `}
                    >
                       <div className="text-3xl text-slate-500 font-bold opacity-30 select-none">
                          {index + 1}
                       </div>
                       <span className="text-xs text-slate-400 font-mono">
                          Frame {index + 1}
                       </span>
                    </div>
                    
                    {/* Controls Overlay */}
                    <div className="absolute -bottom-8 left-0 right-0 flex justify-between items-center px-1 opacity-100 transition-opacity">
                        <div className="flex items-center gap-1 bg-slate-900 rounded px-1">
                             <span className="text-[10px] text-slate-400">ms:</span>
                             <input 
                                type="number" 
                                className="w-12 bg-transparent text-xs text-center outline-none text-slate-300"
                                value={kf.duration}
                                onChange={(e) => handleUpdateKeyframeDuration(kf.id, Number(e.target.value))}
                                disabled={isPlaying}
                             />
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteKeyframe(kf.id); }}
                            className="p-1 text-slate-500 hover:text-red-500 disabled:opacity-0"
                            disabled={isPlaying}
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>

                    {/* Arrow to next */}
                    {index < keyframes.length - 1 && (
                        <div className="absolute -right-6 top-1/2 -translate-y-1/2 text-slate-600">
                             →
                        </div>
                    )}
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}