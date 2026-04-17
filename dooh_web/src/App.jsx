import { useRef, useEffect, useState } from 'react';
import { useCamera, Camera } from './components/camera/Camera';
import { useDetector } from './components/ai/Detector';
import { drawAROverlay } from './components/ar/AROverlay';

const ORBITRON = "'Orbitron', monospace";
const RAJDHANI = "'Rajdhani', sans-serif";

// ─── Shared layout wrapper ────────────────────────────────────
function Screen({ children, brackets = 'cyan' }) {
  const color = brackets === 'red' ? 'border-red-900' : 'border-cyan-400';
  return (
    <div className="relative min-h-screen bg-black flex flex-col items-center justify-center overflow-hidden ar-grid">
      <div
        className={`absolute top-8 left-8 w-10 h-10 border-t-2 border-l-2 ${color} opacity-40`}
      />
      <div
        className={`absolute top-8 right-8 w-10 h-10 border-t-2 border-r-2 ${color} opacity-40`}
      />
      <div
        className={`absolute bottom-8 left-8 w-10 h-10 border-b-2 border-l-2 ${color} opacity-40`}
      />
      <div
        className={`absolute bottom-8 right-8 w-10 h-10 border-b-2 border-r-2 ${color} opacity-40`}
      />
      {children}
    </div>
  );
}

// ─── Progress dots ────────────────────────────────────────────
function ProgressDots({ total, current }) {
  return (
    <div className="flex gap-2 mb-10">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
            i === current ? 'bg-cyan-400 w-4' : 'bg-gray-700'
          }`}
        />
      ))}
    </div>
  );
}

// ─── Shared nav buttons ───────────────────────────────────────
function NavButton({ onClick, children, variant = 'primary' }) {
  if (variant === 'ghost') {
    return (
      <button
        onClick={onClick}
        className="text-xs tracking-[0.3em] uppercase text-gray-600 hover:text-gray-400 transition-colors"
        style={{ fontFamily: ORBITRON }}
      >
        {children}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className="group relative px-12 py-3.5 text-xs tracking-[0.35em] uppercase font-bold transition-all duration-300"
      style={{ fontFamily: ORBITRON }}
    >
      <span className="absolute inset-0 border border-cyan-500 group-hover:bg-cyan-500/10 transition-all" />
      <span className="absolute top-0 left-0 w-2 h-2 bg-cyan-500" />
      <span className="absolute top-0 right-0 w-2 h-2 bg-cyan-500" />
      <span className="absolute bottom-0 left-0 w-2 h-2 bg-cyan-500" />
      <span className="absolute bottom-0 right-0 w-2 h-2 bg-cyan-500" />
      <span className="relative text-cyan-400 group-hover:text-white transition-colors">
        {children}
      </span>
    </button>
  );
}

// ─── Screen 1: Welcome ────────────────────────────────────────
function WelcomeScreen({ onStart, onSkip }) {
  return (
    <Screen>
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div
          style={{
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(0,240,255,0.06) 0%, transparent 70%)',
          }}
        />
      </div>
      <div className="relative z-10 text-center px-8 max-w-lg">
        <p
          className="fade-up delay-1 text-xs tracking-[0.4em] text-cyan-500 uppercase mb-5"
          style={{ fontFamily: RAJDHANI }}
        >
          Augmented Reality · NYC Landmarks
        </p>
        <h1
          className="fade-up delay-2 glitch-text text-6xl font-black text-white mb-3"
          style={{ fontFamily: ORBITRON }}
        >
          AR<span className="text-cyan-400">·</span>DOOH
        </h1>
        <p
          className="fade-up delay-2 text-xs tracking-[0.5em] text-gray-600 uppercase mb-8"
          style={{ fontFamily: ORBITRON }}
        >
          Landmark Detection System
        </p>
        <p
          className="fade-up delay-3 text-gray-400 mb-12 leading-relaxed"
          style={{ fontFamily: RAJDHANI, fontSize: '1.1rem', fontWeight: 300 }}
        >
          Discover NYC landmarks through your camera.
          <br />
          Point at a building — the AI does the rest.
        </p>
        <div className="fade-up delay-4 flex flex-col items-center gap-5">
          <NavButton onClick={onStart}>Start Tutorial</NavButton>
          <NavButton onClick={onSkip} variant="ghost">
            Skip → Go straight to scanner
          </NavButton>
        </div>
      </div>
    </Screen>
  );
}

// ─── Screen 2: What You'll Need ───────────────────────────────
function NeedsScreen({ onNext }) {
  const items = [
    {
      icon: '📷',
      title: 'A camera',
      desc: 'Built-in or external — any webcam works',
    },
    {
      icon: '🏙️',
      title: 'A NYC landmark',
      desc: 'The Edge, One WTC, or Empire State Building',
    },
    {
      icon: '☀️',
      title: 'Good lighting',
      desc: 'Works best outdoors or in well-lit spaces',
    },
  ];
  return (
    <Screen>
      <div className="relative z-10 text-center px-8 max-w-lg w-full">
        <ProgressDots total={3} current={0} />
        <p
          className="fade-up delay-1 text-xs tracking-[0.4em] text-cyan-500 uppercase mb-3"
          style={{ fontFamily: RAJDHANI }}
        >
          Step 1 of 3
        </p>
        <h2
          className="fade-up delay-2 text-3xl font-black text-white mb-10"
          style={{ fontFamily: ORBITRON }}
        >
          What You'll Need
        </h2>
        <div className="fade-up delay-3 space-y-4 mb-12 text-left">
          {items.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-4 border border-gray-800 px-5 py-4 hover:border-cyan-900 transition-colors"
            >
              <span className="text-2xl mt-0.5">{item.icon}</span>
              <div>
                <p
                  className="text-white text-sm font-semibold mb-0.5"
                  style={{ fontFamily: ORBITRON }}
                >
                  {item.title}
                </p>
                <p
                  className="text-gray-500 text-sm"
                  style={{ fontFamily: RAJDHANI }}
                >
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="fade-up delay-4">
          <NavButton onClick={onNext}>Next</NavButton>
        </div>
      </div>
    </Screen>
  );
}

// ─── Screen 3: How It Works ───────────────────────────────────
function HowScreen({ onNext }) {
  const steps = [
    {
      num: '01',
      title: 'Point',
      desc: 'Aim your camera at a NYC landmark — The Edge, One WTC, or Empire State Building.',
    },
    {
      num: '02',
      title: 'Detect',
      desc: 'Our AI model identifies the building in real-time using computer vision.',
    },
    {
      num: '03',
      title: 'Explore',
      desc: 'See the building name and confidence score overlaid directly on your screen.',
    },
  ];
  return (
    <Screen>
      <div className="relative z-10 text-center px-8 max-w-lg w-full">
        <ProgressDots total={3} current={1} />
        <p
          className="fade-up delay-1 text-xs tracking-[0.4em] text-cyan-500 uppercase mb-3"
          style={{ fontFamily: RAJDHANI }}
        >
          Step 2 of 3
        </p>
        <h2
          className="fade-up delay-2 text-3xl font-black text-white mb-10"
          style={{ fontFamily: ORBITRON }}
        >
          How It Works
        </h2>
        <div className="fade-up delay-3 space-y-5 mb-12 text-left">
          {steps.map((s, i) => (
            <div key={i} className="flex gap-5 items-start">
              <span
                className="text-cyan-400 font-black text-lg shrink-0 mt-0.5"
                style={{ fontFamily: ORBITRON }}
              >
                {s.num}
              </span>
              <div className="border-l border-gray-800 pl-5">
                <p
                  className="text-white text-sm font-semibold mb-1"
                  style={{ fontFamily: ORBITRON }}
                >
                  {s.title}
                </p>
                <p
                  className="text-gray-500 text-sm leading-relaxed"
                  style={{ fontFamily: RAJDHANI }}
                >
                  {s.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="fade-up delay-4">
          <NavButton onClick={onNext}>Next</NavButton>
        </div>
      </div>
    </Screen>
  );
}

// ─── Screen 4: Camera Permission ─────────────────────────────
function PermissionScreen({ onAllow, loading }) {
  return (
    <Screen>
      <div className="relative z-10 text-center px-8 max-w-lg w-full">
        <ProgressDots total={3} current={2} />
        <p
          className="fade-up delay-1 text-xs tracking-[0.4em] text-cyan-500 uppercase mb-3"
          style={{ fontFamily: RAJDHANI }}
        >
          Step 3 of 3
        </p>
        <h2
          className="fade-up delay-2 text-3xl font-black text-white mb-4"
          style={{ fontFamily: ORBITRON }}
        >
          Camera Access
        </h2>
        <p
          className="fade-up delay-3 text-gray-400 mb-10 leading-relaxed"
          style={{ fontFamily: RAJDHANI, fontSize: '1.05rem', fontWeight: 300 }}
        >
          We need your camera to detect landmarks in real-time.
          <br />
          No footage is recorded or stored.
        </p>

        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-16 h-16">
              <div
                className="absolute inset-0 rounded-full border-t-2 border-cyan-400"
                style={{ animation: 'spin-ring 1s linear infinite' }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
              </div>
            </div>
            <p
              className="text-xs tracking-[0.3em] text-gray-600 uppercase"
              style={{ fontFamily: ORBITRON }}
            >
              Waiting for permission...
            </p>
          </div>
        ) : (
          <div className="fade-up delay-4">
            <NavButton onClick={onAllow}>Allow Camera</NavButton>
          </div>
        )}
      </div>
    </Screen>
  );
}

// ─── Screen 5: Live Scanner ───────────────────────────────────
function ScannerScreen({ canvasRef, detected, modelReady, onExit }) {
  return (
    <div className="relative min-h-screen bg-black flex items-center justify-center overflow-hidden">
      <canvas
        ref={canvasRef}
        style={{ display: 'block', maxWidth: '100vw', maxHeight: '100vh' }}
      />

      {!detected && (
        <div
          className="scan-sweep pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(0,240,255,0.5), transparent)',
          }}
        />
      )}

      {/* HUD corners */}
      <div className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-cyan-400 opacity-50 pointer-events-none" />
      <div className="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-cyan-400 opacity-50 pointer-events-none" />
      <div className="absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 border-cyan-400 opacity-50 pointer-events-none" />
      <div className="absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 border-cyan-400 opacity-50 pointer-events-none" />

      {/* Top status */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-5 pointer-events-none">
        <div className="flex items-center gap-2.5">
          {!modelReady ? (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span
                className="text-xs tracking-[0.3em] uppercase text-amber-400"
                style={{ fontFamily: ORBITRON }}
              >
                Loading model...
              </span>
            </>
          ) : (
            <>
              <span
                className={`w-2 h-2 rounded-full ${detected ? 'bg-green-400' : 'bg-amber-400 animate-pulse'}`}
              />
              <span
                className="text-xs tracking-[0.3em] uppercase"
                style={{
                  fontFamily: ORBITRON,
                  color: detected ? '#4ade80' : '#fbbf24',
                }}
              >
                {detected ? 'Landmark Detected' : 'Scanning...'}
              </span>
            </>
          )}
        </div>
        <span
          className="text-xs text-gray-700 tracking-[0.4em]"
          style={{ fontFamily: ORBITRON }}
        >
          AR·DOOH
        </span>
      </div>

      {/* Landmark legend */}
      <div className="absolute bottom-20 right-8 flex flex-col gap-1.5 pointer-events-none">
        {[
          { label: 'One WTC', color: '#00f0ff' },
          { label: 'The Edge', color: '#ff6b00' },
          { label: 'Empire State', color: '#a855f7' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: color }}
            />
            <span
              className="text-xs text-gray-600"
              style={{ fontFamily: RAJDHANI }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Exit */}
      <button
        onClick={onExit}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 group"
      >
        <span
          className="flex items-center gap-2 px-8 py-3 text-xs tracking-[0.3em] uppercase border border-gray-800 hover:border-red-500 text-gray-600 hover:text-red-400 transition-all"
          style={{ fontFamily: ORBITRON }}
        >
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          Exit
        </span>
      </button>
    </div>
  );
}

// ─── Screen 6: Error ──────────────────────────────────────────
function ErrorScreen({ onRetry, error }) {
  return (
    <Screen brackets="red">
      <div className="text-center px-8 max-w-md">
        <div className="w-16 h-16 border border-red-800 flex items-center justify-center mx-auto mb-8">
          <svg
            className="w-7 h-7 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
        </div>
        <h2
          className="text-2xl font-black text-white mb-3"
          style={{ fontFamily: ORBITRON }}
        >
          Camera Blocked
        </h2>
        <p
          className="text-gray-500 mb-10 leading-relaxed"
          style={{ fontFamily: RAJDHANI, fontSize: '1.05rem', fontWeight: 300 }}
        >
          {error ||
            'Camera access was denied. Please allow camera access in your browser settings and try again.'}
        </p>
        <button
          onClick={onRetry}
          className="group relative px-12 py-3 text-xs tracking-[0.3em] uppercase font-bold"
          style={{ fontFamily: ORBITRON }}
        >
          <span className="absolute inset-0 border border-red-800 group-hover:border-red-500 group-hover:bg-red-500/10 transition-all" />
          <span className="absolute top-0 left-0 w-1.5 h-1.5 bg-red-800 group-hover:bg-red-500 transition-colors" />
          <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-red-800 group-hover:bg-red-500 transition-colors" />
          <span className="absolute bottom-0 left-0 w-1.5 h-1.5 bg-red-800 group-hover:bg-red-500 transition-colors" />
          <span className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-red-800 group-hover:bg-red-500 transition-colors" />
          <span className="relative text-red-600 group-hover:text-red-400 transition-colors">
            Try Again
          </span>
        </button>
      </div>
    </Screen>
  );
}

// ─── Main App ─────────────────────────────────────────────────
function App() {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [step, setStep] = useState('welcome');
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [detected, setDetected] = useState(false);

  const { videoRef, streamRef, isRunning, startWebcam, stopWebcam } =
    useCamera();
  const { session, detect } = useDetector();

  // Request camera and go to scanner
  const requestCamera = () => {
    setPermissionLoading(true);
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => videoRef.current?.play();
        }
        setPermissionLoading(false);
        setStep('scanner');
      })
      .catch((err) => {
        setCameraError(err.message || 'Camera access denied');
        setPermissionLoading(false);
        setStep('error');
      });
  };

  const handleExit = () => {
    stopWebcam();
    setDetected(false);
    setStep('welcome');
  };

  // Detection loop
  useEffect(() => {
    if (step !== 'scanner' || !session || !videoRef.current) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const loopDetection = () => {
      if (!streamRef.current || !videoRef.current) return;
      detect(videoRef.current, canvasRef, drawAROverlay).then((boxes) => {
        setDetected(boxes && boxes.length > 0);
      });
      animationFrameRef.current = requestAnimationFrame(loopDetection);
    };

    loopDetection();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [step, session]);

  useEffect(() => {
    return () => {
      stopWebcam();
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  return (
    <div>
      <Camera videoRef={videoRef} />
      {step === 'welcome' && (
        <WelcomeScreen
          onStart={() => setStep('needs')}
          onSkip={() => setStep('permission')}
        />
      )}
      {step === 'needs' && <NeedsScreen onNext={() => setStep('how')} />}
      {step === 'how' && <HowScreen onNext={() => setStep('permission')} />}
      {step === 'permission' && (
        <PermissionScreen onAllow={requestCamera} loading={permissionLoading} />
      )}
      {step === 'scanner' && (
        <ScannerScreen
          canvasRef={canvasRef}
          detected={detected}
          modelReady={!!session}
          onExit={handleExit}
        />
      )}
      {step === 'error' && (
        <ErrorScreen
          onRetry={() => setStep('permission')}
          error={cameraError}
        />
      )}
    </div>
  );
}
