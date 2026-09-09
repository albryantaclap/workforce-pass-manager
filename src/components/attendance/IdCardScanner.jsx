import React, { useState, useRef, useEffect, useCallback } from "react";
import { createWorker } from "tesseract.js";
import { Button } from "@/components/ui/button";
import {
  RefreshCw, Loader2, CreditCard, CheckCircle2, XCircle, ZapIcon, StopCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";

const SCAN_STEP = {
  READY: "ready",
  SCANNING: "scanning",
  PROCESSING: "processing",
  FOUND: "found",
  NOT_FOUND: "not_found",
};

function compressFrame(video, quality = 0.9) {
  const canvas = document.createElement("canvas");
  const maxW = 1280;
  const scale = Math.min(1, maxW / (video.videoWidth || 1280));
  canvas.width = (video.videoWidth || 1280) * scale;
  canvas.height = (video.videoHeight || 720) * scale;
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

// Extract candidate ID tokens from raw OCR text.
function extractIds(text) {
  const ids = new Set();
  // QID: 11-digit number starting with 2 or 3
  (text.match(/[23]\d{10}/g) || []).forEach((id) => ids.add(id));
  // Alphanumeric codes (letters+digits) — PID, staff no, passport no
  (text.match(/[A-Z0-9]{2,5}[-\s]?[0-9]{2,6}/gi) || []).forEach((id) =>
    ids.add(id.replace(/\s/g, ""))
  );
  // Plain numeric IDs: 3–12 digits
  (text.match(/\b\d{3,12}\b/g) || []).forEach((id) => ids.add(id));
  return Array.from(ids);
}

// Match extracted IDs against existing Employee records by qid_no / pid / staff_no / pp_no.
function matchEmployee(extractedIds, employees) {
  for (const scannedId of extractedIds) {
    const clean = scannedId.trim().replace(/[\s-]/g, "").toLowerCase();
    const matched = employees.find((emp) => {
      const fields = [emp.qid_no, emp.pid, emp.staff_no, emp.pp_no];
      return fields.some(
        (f) => f && f.replace(/[\s-]/g, "").toLowerCase() === clean
      );
    });
    if (matched) return matched;
  }
  return null;
}

function CountdownBar({ seconds }) {
  return (
    <div className="absolute bottom-2 left-0 right-0 flex flex-col items-center gap-1 pointer-events-none px-4">
      <p className="text-white text-xs bg-black/60 px-3 py-1 rounded-full">
        Auto-scanning in {seconds}s — align card within frame
      </p>
    </div>
  );
}

export default function IdCardScanner({ employees, onEmployeeFound, onStop }) {
  const { toast } = useToast();
  const [scanStep, setScanStep] = useState(SCAN_STEP.READY);
  const [facingMode, setFacingMode] = useState("environment");
  const [resultMessage, setResultMessage] = useState("");
  const [foundEmployee, setFoundEmployee] = useState(null);
  const [countdown, setCountdown] = useState(3);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const processingRef = useRef(false);
  const countdownRef = useRef(null);
  const countdownValueRef = useRef(3);
  const workerRef = useRef(null);
  const recentlyProcessedRef = useRef(new Map());

  useEffect(() => {
    let cancelled = false;
    const initWorker = async () => {
      try {
        const worker = await createWorker("eng", 1, { logger: () => {} });
        if (!cancelled) workerRef.current = worker;
      } catch (e) {
        if (!cancelled)
          toast({
            title: "OCR engine failed to load",
            description: e.message,
            variant: "destructive",
          });
      }
    };
    initWorker();
    return () => {
      cancelled = true;
      stopCamera();
      clearCountdown();
      workerRef.current?.terminate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const clearCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

  const startScanning = async (mode = facingMode) => {
    try {
      stopCamera();
      clearCountdown();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      setFacingMode(mode);
      setScanStep(SCAN_STEP.SCANNING);
      setFoundEmployee(null);
      setResultMessage("");
      processingRef.current = false;

      countdownValueRef.current = 3;
      setCountdown(3);
      countdownRef.current = setInterval(() => {
        countdownValueRef.current -= 1;
        setCountdown(countdownValueRef.current);
        if (countdownValueRef.current <= 0) {
          clearCountdown();
          scanFrame();
        }
      }, 1000);
    } catch {
      toast({
        title: "Camera access denied",
        description: "Please allow camera permissions in your browser.",
        variant: "destructive",
      });
      setScanStep(SCAN_STEP.READY);
    }
  };

  const videoRefCallback = useCallback((node) => {
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
      videoRef.current = node;
    }
  }, []);

  const switchCamera = async () => {
    const newMode = facingMode === "environment" ? "user" : "environment";
    clearCountdown();
    stopCamera();
    await startScanning(newMode);
  };

  const handleStop = () => {
    stopCamera();
    clearCountdown();
    setScanStep(SCAN_STEP.READY);
    processingRef.current = false;
    if (onStop) onStop();
  };

  const scanFrame = async () => {
    if (processingRef.current) return;
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      countdownValueRef.current = 1;
      setCountdown(1);
      countdownRef.current = setInterval(() => {
        countdownValueRef.current -= 1;
        setCountdown(countdownValueRef.current);
        if (countdownValueRef.current <= 0) {
          clearCountdown();
          scanFrame();
        }
      }, 1000);
      return;
    }

    processingRef.current = true;
    const dataUrl = compressFrame(video);
    setScanStep(SCAN_STEP.PROCESSING);
    stopCamera();
    clearCountdown();

    try {
      if (!workerRef.current) {
        throw new Error("OCR engine not ready yet. Please try again.");
      }
      const {
        data: { text },
      } = await workerRef.current.recognize(dataUrl);
      const extractedIds = extractIds(text);

      if (extractedIds.length === 0) {
        setResultMessage(
          "No ID detected. Please hold the card steady and ensure it's well-lit."
        );
        setScanStep(SCAN_STEP.NOT_FOUND);
        processingRef.current = false;
        return;
      }

      const matched = matchEmployee(extractedIds, employees);
      processingRef.current = false;

      if (matched) {
        const lastScan = recentlyProcessedRef.current.get(matched.id);
        if (lastScan && Date.now() - lastScan < 10000) {
          setResultMessage("");
          await startScanning();
          return;
        }
        recentlyProcessedRef.current.set(matched.id, Date.now());
        setFoundEmployee(matched);
        setScanStep(SCAN_STEP.FOUND);
        onEmployeeFound(matched);
      } else {
        setResultMessage(
          `Detected: ${extractedIds.slice(0, 3).join(", ")} — no matching employee found.`
        );
        setScanStep(SCAN_STEP.NOT_FOUND);
      }
    } catch (err) {
      processingRef.current = false;
      setResultMessage(err.message || "Scan error. Please try again.");
      setScanStep(SCAN_STEP.NOT_FOUND);
    }
  };

  const resumeScanning = async () => {
    setFoundEmployee(null);
    setResultMessage("");
    await startScanning();
  };

  return (
    <div className="w-full" id="id-card-scanner">
      <AnimatePresence mode="wait">
        {scanStep === SCAN_STEP.READY && (
          <motion.div
            key="ready"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-5 py-8"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <CreditCard className="w-8 h-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-bold text-base">ID Card Scanner</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Hold a Project ID or QID card in front of the camera. The scanner
                auto-detects after 3 seconds.
              </p>
            </div>
            <Button
              onClick={() => startScanning()}
              size="lg"
              className="gap-2 w-full max-w-xs"
            >
              <CreditCard className="w-4 h-4" /> Start Scanning
            </Button>
          </motion.div>
        )}

        {scanStep === SCAN_STEP.SCANNING && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2"
          >
            <div
              className="relative bg-black rounded-xl overflow-hidden"
              style={{ minHeight: 270 }}
            >
              <video
                ref={videoRefCallback}
                autoPlay
                playsInline
                muted
                className="w-full object-cover"
                style={{ minHeight: 270 }}
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className="border-2 border-white/60 rounded-xl"
                  style={{
                    width: "80%",
                    height: "50%",
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.50)",
                  }}
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                <div className="relative" style={{ width: "80%", height: "50%" }}>
                  <motion.div
                    className="absolute left-0 right-0 h-0.5 bg-primary/80"
                    initial={{ top: "10%" }}
                    animate={{ top: ["10%", "90%", "10%"] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
                  />
                  <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-primary" />
                  <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-primary" />
                  <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-primary" />
                  <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-primary" />
                </div>
              </div>
              {countdown > 0 && (
                <div className="absolute top-2 left-2 w-9 h-9 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-white font-bold text-sm">{countdown}</span>
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  switchCamera();
                }}
                className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-2 hover:bg-black/70 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <CountdownBar seconds={countdown} />
            </div>
            <div className="flex gap-2">
              <Button onClick={scanFrame} className="flex-1 gap-2">
                <ZapIcon className="w-4 h-4" /> Scan Now
              </Button>
              <Button
                onClick={handleStop}
                variant="outline"
                className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
              >
                <StopCircle className="w-4 h-4" /> Stop
              </Button>
            </div>
          </motion.div>
        )}

        {scanStep === SCAN_STEP.PROCESSING && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center gap-3 py-10"
          >
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <CreditCard className="w-8 h-8 text-primary" />
              </div>
              <Loader2 className="w-5 h-5 animate-spin text-primary absolute -bottom-1 -right-1" />
            </div>
            <p className="text-sm font-semibold">Reading ID card...</p>
            <p className="text-xs text-muted-foreground">Matching against employee records</p>
          </motion.div>
        )}

        {scanStep === SCAN_STEP.FOUND && foundEmployee && (
          <motion.div
            key="found"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-3 py-6"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-emerald-600" />
            </div>
            <div className="text-center">
              <p className="font-bold text-emerald-700 text-lg">Employee Identified</p>
              <p className="text-sm font-semibold mt-0.5">{foundEmployee.name}</p>
              <p className="text-xs text-muted-foreground">
                {[foundEmployee.qid_no, foundEmployee.pid, foundEmployee.company]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </motion.div>
        )}

        {scanStep === SCAN_STEP.NOT_FOUND && (
          <motion.div
            key="notfound"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-3 py-6"
          >
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="w-7 h-7 text-red-500" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-red-600">Not Recognized</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
                {resultMessage}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={resumeScanning} size="sm" className="gap-2">
                <RefreshCw className="w-4 h-4" /> Scan Again
              </Button>
              <Button
                onClick={handleStop}
                size="sm"
                variant="outline"
                className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
              >
                <StopCircle className="w-4 h-4" /> Stop
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}