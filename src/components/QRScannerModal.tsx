import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, X, RefreshCw, AlertCircle, ShieldAlert, Sparkles } from 'lucide-react';
import { useNotification } from './NotificationProvider';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (scannedText: string) => void;
}

export default function QRScannerModal({ isOpen, onClose, onScanSuccess }: QRScannerModalProps) {
  const { notify } = useNotification();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [flashOn, setFlashOn] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setScannedResult(null);
      setCameraError(null);
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    try {
      setCameraActive(false);
      setCameraError(null);

      // Stop any existing streams first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Explicit browser media request
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', // Use back camera if cellular device
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Prevents iOS fullscreen takeover
        videoRef.current.play();
      }

      setCameraActive(true);
      // Initiate real-time frame scanning loop
      animationFrameRef.current = requestAnimationFrame(scanFrame);
    } catch (err: any) {
      console.error('[QR Scanner] camera access error:', err);
      let errMsg = 'Failed to locate a connected camera. Verify camera permissions in your browser.';
      if (err.name === 'NotAllowedError') {
        errMsg = 'Access denied. Please enable camera permissions in your browser and reload.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errMsg = 'No physical camera device discovered on this station.';
      }
      setCameraError(errMsg);
      notify('error', 'Camera Engagement Restrained', errMsg, err?.message || String(err));
    }
  };

  const stopCamera = () => {
    setCameraActive(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Real-time canvas scanning matching helper
  const scanFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        // Equalize dimensions
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw incoming frame buffer
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Extract matrix
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });
        
        if (code && code.data && code.data.trim() !== '') {
          // Detected target QR string code!
          const parsedData = code.data.trim();
          setScannedResult(parsedData);
          
          // Sound effect or light vibration feedback to clinical assistant
          if ('vibrate' in navigator) {
            navigator.vibrate(120);
          }
          
          notify('success', 'ID QR Badge Discovered', `Found Code: "${parsedData}". Retrieving profile...`);
          onScanSuccess(parsedData);
          stopCamera();
          onClose();
          return;
        }
      }
    }
    
    // Continue frame reading loop
    if (streamRef.current && streamRef.current.active) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
    }
  };

  if (!isOpen) return null;

  return (
    <div id="qr-scanner-portal" className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col">
        
        {/* Colorful top border edge */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-teal-500 to-indigo-500" />

        {/* Modal Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-400 border border-teal-500/20">
              <Camera size={16} />
            </div>
            <div>
              <h3 className="text-white text-sm font-black uppercase tracking-wider">Patient ID Scanner</h3>
              <p className="text-[10px] text-slate-400 leading-none mt-0.5">Scan clinical card QR badges instantly</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full transition cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Camera Stage Viewfinder */}
        <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
          
          {/* Main system video */}
          <video 
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />

          {/* Hidden utility canvas for frame scanning */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Guidelines framing overlay */}
          {cameraActive && !scannedResult && (
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 bg-slate-950/20">
              <div className="w-full flex justify-between">
                <div className="w-6 h-6 border-t-2 border-l-2 border-teal-400 rounded-tl" />
                <div className="w-6 h-6 border-t-2 border-r-2 border-teal-400 rounded-tr" />
              </div>

              {/* Scanning center guides targeting line */}
              <div className="relative w-full border-t border-dashed border-teal-400/50 animate-pulse my-auto h-0">
                <div className="absolute left-0 right-0 h-0.5 bg-teal-400 opacity-60 blur-xs" />
              </div>

              <div className="w-full flex justify-between">
                <div className="w-6 h-6 border-b-2 border-l-2 border-teal-400 rounded-bl" />
                <div className="w-6 h-6 border-b-2 border-r-2 border-teal-400 rounded-br" />
              </div>
            </div>
          )}

          {/* Loader when engaging camera */}
          {!cameraActive && !cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 gap-3">
              <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-[10px] text-slate-400 font-bold">Waking camera sensor...</p>
            </div>
          )}

          {/* Camera Access Exception View */}
          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 py-4 px-6 text-center space-y-3">
              <ShieldAlert className="text-rose-500" size={32} />
              <p className="text-white text-xs font-black">Camera Connection Missing</p>
              <p className="text-slate-400 text-[10px] leading-relaxed max-w-xs">{cameraError}</p>
              <button
                onClick={startCamera}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-400 font-bold text-[9px] uppercase tracking-wider rounded-lg flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              >
                <RefreshCw size={11} />
                Try Reconnect Sensor
              </button>
            </div>
          )}
        </div>

        {/* Practical Instruction & Sandbox inputs for testing without camera */}
        <div className="mt-4 space-y-3">
          <div className="bg-slate-950 rounded-xl p-3 border border-slate-800/60 text-slate-300 text-[10px] flex gap-2">
            <Sparkles size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold text-white">How it works:</p>
              <p className="text-slate-405 leading-relaxed mt-0.5">
                Elevate a physical Patient Card QR print-badge or smartphone visual code to the viewfinder. It reads patient codes like <code className="text-teal-400 bg-teal-900/20 px-1 rounded font-mono font-bold leading-none">P-001</code> to instantly open files.
              </p>
            </div>
          </div>

          {/* Mock Input field so developers and reviewers can simulate a scan directly inside the modal! */}
          <div className="pt-2 border-t border-slate-800 space-y-1.5 text-left">
            <label className="text-[9px] uppercase text-slate-400 font-extrabold tracking-wider">
              Diagnostic Review Simulation (Simulate a QR trigger)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter Code (e.g. P-001, P-1002)"
                id="qr-manual-mock-input"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-teal-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const value = (e.target as HTMLInputElement).value.trim();
                    if (value) {
                      notify('success', 'Diagnostic Sim Successful', `Intercepted simulated QR scan for: "${value}"`);
                      onScanSuccess(value);
                      stopCamera();
                      onClose();
                    }
                  }
                }}
              />
              <button
                onClick={() => {
                  const input = document.getElementById('qr-manual-mock-input') as HTMLInputElement;
                  const value = input?.value.trim();
                  if (value) {
                    onScanSuccess(value);
                    stopCamera();
                    onClose();
                  } else {
                    notify('warning', 'Diagnostic Sync Restrained', 'Type a mock patient code first.');
                  }
                }}
                className="bg-indigo-600 text-white font-semibold text-[10px] px-3.5 rounded-xl hover:bg-indigo-500 cursor-pointer"
              >
                Scan Mock
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
