"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/components/ToastProvider";
import QRCode from "qrcode";

interface StudentSummary {
  student_id: string;
  code: string;
  student_name: string | null;
  mobile_number?: string | null;
  mobile_number2?: string | null;
  address?: string | null;
  national_id?: string | null;
  student_created_at?: string;
}

interface AttendanceRec {
  id: string;
  attended_at: string;
  session_date: string;
}

export default function ScannerPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const [scanning, setScanning] = useState(false);
  const [lastScanAt, setLastScanAt] = useState<number>(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentSummary | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRec | null>(null);
  const [alreadyAttended, setAlreadyAttended] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<any | null>(null);
  const readerRef = useRef<any | null>(null);
  const [cameraSupported, setCameraSupported] = useState(true);
  const beepCtxRef = useRef<any | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const [devices, setDevices] = useState<Array<{ deviceId: string; label: string }>>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | 'auto'>('auto');
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [typedCode, setTypedCode] = useState("");
  const [pauseOnScan, setPauseOnScan] = useState(false); // Changed to false for continuous scanning
  const [quality, setQuality] = useState<'low' | 'med' | 'high'>('med');
  const [showAllRecords, setShowAllRecords] = useState(false);
  const [cameraResolution, setCameraResolution] = useState<string>("");
  const [scanQueue, setScanQueue] = useState<StudentSummary[]>([]); // Queue for batch recording

  useEffect(() => {
    const hasLegacy = typeof navigator !== 'undefined' && (
      (navigator as any).getUserMedia || (navigator as any).webkitGetUserMedia || (navigator as any).mozGetUserMedia
    );
    const ok = typeof navigator !== 'undefined' && !!(navigator.mediaDevices && (navigator.mediaDevices as any).getUserMedia) || !!hasLegacy;
    setCameraSupported(Boolean(ok));
  }, []);
  
  useEffect(() => { refreshCameras(); }, []);

  // If camera/quality changes while scanning, restart with new constraints
  useEffect(() => {
    if (scanning) {
      startScanning();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeviceId, quality]);

  async function refreshCameras() {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const list = await navigator.mediaDevices.enumerateDevices();
      const vids = list.filter((d) => d.kind === 'videoinput').map((d) => ({ deviceId: d.deviceId, label: d.label || 'Camera' }));
      setDevices(vids);
    } catch {}
  }

  // Load students for search
  const { data: studentsData } = useQuery({
    queryKey: ["admin", "students", "global"],
    queryFn: async () => {
      const res = await authFetch("/api/admin/students");
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Load failed");
      return (j.students as StudentSummary[]) || [];
    },
  });
  const students = studentsData || [];

  // Public settings for brand logo and name in ID Card
  const { data: publicSettings } = useQuery({
    queryKey: ["public", "settings"],
    queryFn: async () => {
      const res = await fetch("/api/public/settings");
      try {
        const j = await res.json();
        return j || {};
      } catch {
        return {} as any;
      }
    },
  });

  const [search, setSearch] = useState("");
  const searchResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [] as StudentSummary[];
    return students
      .filter((s) => [s.code, s.student_name, s.mobile_number, s.mobile_number2].map((v) => (v || "").toLowerCase()).some((v) => v.includes(term)))
      .slice(0, 10);
  }, [students, search]);

  const recent = useQuery({
    queryKey: ["admin", "attendance", "recent", showAllRecords],
    queryFn: async () => {
      const hours = showAllRecords ? 24 * 7 : 3; // Show last week when expanded, last 3 hours otherwise
      const res = await authFetch(`/api/admin/attendance?action=recent&hours=${hours}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Load failed");
      return j.items as Array<{ id: string; student_id: string; code: string | null; student_name: string | null; attended_at: string }>;
    },
    refetchInterval: 15_000,
  });

  const deleteAttendance = useMutation({
    mutationFn: async (recordId: string) => {
      const res = await authFetch("/api/admin/attendance", { 
        method: "DELETE", 
        body: JSON.stringify({ id: recordId }) 
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Delete failed");
      return j;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin", "attendance", "recent"] });
      toast.success(`Deleted attendance record for ${data.deleted_record?.student_name || 'student'}`);
    },
    onError: (e: any) => {
      toast.error(e?.message || "Failed to delete attendance record");
    },
  });

  const markAttendance = useMutation({
    mutationFn: async (payload: { code?: string; studentId?: string }) => {
      const res = await authFetch("/api/admin/attendance?action=scan", { method: "POST", body: JSON.stringify(payload) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Record failed");
      return j as { student: StudentSummary; attendance: AttendanceRec; already_attended?: boolean };
    },
    onSuccess: (j) => {
      setSelectedStudent(j.student);
      setAttendance(j.attendance);
      setAlreadyAttended(Boolean(j.already_attended));
      qc.invalidateQueries({ queryKey: ["admin", "attendance", "recent"] });
      toast.success(j.already_attended ? "Already marked today" : "Attendance recorded");
    },
    onError: (e: any) => {
      toast.error(e?.message || "Failed to record attendance");
    },
  });

  // Batch record all students in queue
  const batchRecordMutation = useMutation({
    mutationFn: async (students: StudentSummary[]) => {
      const results = { success: 0, already: 0, failed: 0 };
      
      for (const student of students) {
        try {
          const res = await authFetch("/api/admin/attendance?action=scan", { 
            method: "POST", 
            body: JSON.stringify({ studentId: student.student_id }) 
          });
          const j = await res.json();
          if (res.ok) {
            if (j.already_attended) {
              results.already++;
            } else {
              results.success++;
            }
          } else {
            results.failed++;
          }
        } catch {
          results.failed++;
        }
      }
      
      return results;
    },
    onSuccess: (results) => {
      qc.invalidateQueries({ queryKey: ["admin", "attendance", "recent"] });
      setScanQueue([]); // Clear queue after recording
      setSelectedStudent(null);
      setAttendance(null);
      
      const total = results.success + results.already + results.failed;
      let message = `Recorded ${results.success} student${results.success !== 1 ? 's' : ''}`;
      if (results.already > 0) message += `, ${results.already} already marked`;
      if (results.failed > 0) message += `, ${results.failed} failed`;
      
      toast.success({ title: "Batch Recording Complete", message });
    },
    onError: (e: any) => {
      toast.error({ title: "Batch Recording Failed", message: e?.message || "Unknown error" });
    },
  });

  function findStudentByCode(code: string): StudentSummary | null {
    const c = code.trim();
    if (!c) return null;
    const s = students.find((s) => (s.code || "").trim() === c);
    return s || null;
  }

  function beep() {
    try {
      if (!beepCtxRef.current) return;
      const ctx = beepCtxRef.current as AudioContext;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square"; o.frequency.value = 1000; // snappier beep
      o.connect(g); g.connect(ctx.destination);
      g.gain.value = 0.04; // quiet but audible
      o.start();
      const t = ctx.currentTime;
      g.gain.exponentialRampToValueAtTime(0.00001, t + 0.12);
      o.stop(t + 0.14);
    } catch {}
  }

  function vibrate() {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        (navigator as any).vibrate([40, 30, 40]);
      }
    } catch {}
  }

  async function startScanning() {
    if (!videoRef.current) return;
    setScanError(null);
    try {
      // stop previous instance if any (when switching camera)
      if (scanning) {
        try { controlsRef.current?.stop(); } catch {}
        controlsRef.current = null;
        trackRef.current = null;
        setTorchAvailable(false); setTorchOn(false);
        setScanning(false);
      }
      // Prewarm/reuse a single AudioContext for quick beeps (required on iOS after a user gesture)
      if (!beepCtxRef.current) {
        const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AC) {
          beepCtxRef.current = new AC();
          try { await (beepCtxRef.current as AudioContext).resume(); } catch {}
        }
      }
      // Require HTTPS except on localhost for camera access
      if (typeof window !== 'undefined') {
        const insecure = window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
        if (insecure) {
          setScanError('Camera requires HTTPS (or localhost). Please use a secure origin.');
          return;
        }
      }
      // Check support
      const hasLegacy = typeof navigator !== 'undefined' && ((navigator as any).getUserMedia || (navigator as any).webkitGetUserMedia || (navigator as any).mozGetUserMedia);
      if (!((navigator.mediaDevices && (navigator.mediaDevices as any).getUserMedia) || hasLegacy)) {
        setScanError('Camera not supported in this browser/device. Use the search box to select a user.');
        setCameraSupported(false);
        return;
      }

      if (!readerRef.current) {
        const mod = await import("@zxing/browser");
        readerRef.current = new mod.BrowserQRCodeReader();
      }
      // Map quality to smarter constraints with higher maximums
      const dims = quality === 'low' 
        ? { idealW: 640, idealH: 480, maxW: 1280, maxH: 720, fps: 24 } 
        : quality === 'high' 
        ? { idealW: 1920, idealH: 1080, maxW: 3840, maxH: 2160, fps: 30 } 
        : { idealW: 1280, idealH: 720, maxW: 1920, maxH: 1080, fps: 30 };
      
      const constraints: MediaStreamConstraints = {
        video: {
          ...(selectedDeviceId !== 'auto' 
            ? { deviceId: { exact: selectedDeviceId } } 
            : { 
                facingMode: { ideal: "environment" },
                // Request highest available resolution for rear camera
                aspectRatio: { ideal: 16/9 }
              }
          ),
          width: { ideal: dims.idealW, max: dims.maxW },
          height: { ideal: dims.idealH, max: dims.maxH },
          frameRate: { ideal: dims.fps },
          // Advanced constraints for better camera selection
          advanced: [
            { focusMode: "continuous" } as any,
            { torch: true } as any,
            { zoom: 1.0 } as any
          ]
        },
        audio: false
      } as any;

      const controls = await readerRef.current.decodeFromConstraints(constraints, videoRef.current, (result: any) => {
        if (result) {
          const now = Date.now();
          // Debounce: ignore duplicate scans within 1.5s
          if (now - lastScanAt < 800) return;
          setLastScanAt(now);
          const text = String(result.getText()).trim();
          if (text) {
            const stu = findStudentByCode(text);
            if (stu) {
              // Check if already in queue
              setScanQueue(prev => {
                const exists = prev.find(s => s.student_id === stu.student_id);
                if (exists) {
                  // Already in queue - visual feedback only
                  toast.info({ message: `Already in queue: ${stu.student_name || stu.code}`, duration: 1000 });
                  return prev;
                } else {
                  // Add to queue
                  vibrate();
                  beep();
                  toast.success({ message: `Added to queue: ${stu.student_name || stu.code}`, duration: 1200 });
                  return [...prev, stu];
                }
              });
            } else {
              toast.error({ message: `Student not found: ${text}`, duration: 1500 });
            }
          }
        }
      });
      controlsRef.current = controls;
      // Track and torch capability + capture actual resolution
      try {
        const stream = (videoRef.current as any).srcObject as MediaStream | undefined;
        const track = stream?.getVideoTracks?.()[0] || null;
        trackRef.current = track;
        const caps = (track as any)?.getCapabilities?.() || {};
        const settings = (track as any)?.getSettings?.() || {};
        const hasTorch = Boolean((caps as any).torch);
        setTorchAvailable(hasTorch);
        setTorchOn(false);
        
        // Display actual camera resolution
        if (settings.width && settings.height) {
          const deviceLabel = devices.find(d => d.deviceId === selectedDeviceId)?.label || 
                             (selectedDeviceId === 'auto' ? 'Auto (Rear)' : 'Camera');
          setCameraResolution(`${settings.width}x${settings.height} @ ${settings.frameRate || 30}fps - ${deviceLabel}`);
        }
      } catch {}
      // List cameras (labels often populate after permission)
      refreshCameras();
      setScanning(true);
    } catch (e: any) {
      setScanError(e?.message || "Failed to start camera");
    }
  }

  function stopScanning() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    trackRef.current = null;
    setTorchAvailable(false); setTorchOn(false);
    setScanning(false);
    setCameraResolution("");
  }

  // Stop scanner on unmount
  useEffect(() => {
    return () => {
      try { controlsRef.current?.stop(); } catch {}
      controlsRef.current = null;
    };
  }, []);

  async function toggleTorch() {
    try {
      const track = trackRef.current as any;
      if (!track) return;
      const caps = track.getCapabilities?.() || {};
      if (!caps.torch) return;
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {}
  }

  function applyTypedCode() {
    const stu = findStudentByCode(typedCode);
    if (stu) {
      setScanQueue(prev => {
        const exists = prev.find(s => s.student_id === stu.student_id);
        if (!exists) {
          beep();
          vibrate();
          toast.success({ message: `Added to queue: ${stu.student_name || stu.code}`, duration: 1200 });
          return [...prev, stu];
        } else {
          toast.info({ message: `Already in queue: ${stu.student_name || stu.code}`, duration: 1000 });
          return prev;
        }
      });
      setTypedCode("");
    } else {
      toast.error({ message: `Not found: ${typedCode}`, duration: 2000 });
    }
  }

  function formatWhatsappNumber(raw?: string | null): string | null {
    if (!raw) return null;
    const digits = String(raw).replace(/\D/g, "");
    if (!digits) return null;
    // WhatsApp expects international format without '+'; we leave as-is if already looks international
    return digits;
  }

  function sendWhatsApp(student: StudentSummary) {
    const mobile = formatWhatsappNumber(student.mobile_number);
    if (!mobile) { toast.error("No mobile number"); return; }
    const url = `https://wa.me/${mobile}`; // no message
    window.open(url, "_blank");
  }

  async function generateAndDownloadIdCard(student: StudentSummary, publicSettings?: any) {
    // Match the exact design from admin students page
    const width = 720, height = 960;
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#0b2844"); 
    grad.addColorStop(0.5, "#1b2b5a"); 
    grad.addColorStop(1, "#28194b");
    ctx.fillStyle = grad; 
    ctx.fillRect(0, 0, width, height);

    // Decorative stars
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < 120; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const r = Math.random() * 2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Header text above QR code
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    
    // Arabic cathedral text
    ctx.font = "600 42px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, 'Arabic UI Text', 'Geeza Pro', 'Damascus', 'Al Bayan'";
    ctx.fillText("كاتدرائية مارمينا والبابا كيرلس", width / 2, 100);
    
    // Brand name (if available)
    const brandName = publicSettings?.brand_name || "";
    if (brandName) {
      ctx.font = "500 32px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
      ctx.fillText(brandName, width / 2, 150);
    }

    // QR code (with gap after header text)
    const qrSize = 420;
    const off = document.createElement("canvas"); 
    off.width = qrSize; 
    off.height = qrSize;
    await QRCode.toCanvas(off, student.code || "", { 
      errorCorrectionLevel: "H", 
      margin: 1, 
      scale: 8, 
      color: { dark: "#0b0b0b", light: "#ffffff" } 
    });

    // Rounded rectangle container (with increased gap)
    const qrContainerW = qrSize + 20;
    const qrContainerH = qrSize + 20;
    const qrContainerX = (width - qrContainerW) / 2;
    const qrContainerY = brandName ? 280 : 250; // More gap if brand name exists
    roundRect(ctx, qrContainerX, qrContainerY, qrContainerW, qrContainerH, 28);
    ctx.fillStyle = "rgba(255,255,255,.8)";
    ctx.fill();

    // Draw QR centered inside container
    const qrX = (width - qrSize) / 2;
    const qrY = qrContainerY + (qrContainerH - qrSize) / 2;
    ctx.drawImage(off, qrX, qrY, qrSize, qrSize);

    // Center logo over QR (if brand logo available)
    const brandLogoUrl = publicSettings?.brand_logo_url;
    if (brandLogoUrl) {
      try {
        const img = await loadImage(brandLogoUrl);
        const logoR = Math.floor(qrSize * 0.16);
        const cx = width / 2;
        const cy = qrY + qrSize / 2;
        ctx.save();
        // white circle backdrop
        ctx.beginPath();
        ctx.arc(cx, cy, logoR + 10, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.closePath();
        // draw logo clipped to circle
        ctx.beginPath();
        ctx.arc(cx, cy, logoR, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, cx - logoR, cy - logoR, logoR * 2, logoR * 2.5);
        ctx.restore();
      } catch {}
    }

    // Name text
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 40px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
    ctx.textAlign = "center";
    ctx.fillText(student.student_name || " ", width / 2, qrContainerY + qrContainerH + 80);

    // Code text
    ctx.font = "600 36px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillStyle = "#d6e1ff";
    ctx.fillText(student.code || " ", width / 2, qrContainerY + qrContainerH + 140);

    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url; 
    a.download = `${(student.student_name || "student").replace(/\s+/g, "_")}_${student.code || "id"}.png`;
    a.click();
  }

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  async function shareIdCard(student: StudentSummary) {
    try {
      // Download the ID card image with the same design as admin students
      await generateAndDownloadIdCard(student, publicSettings);
    } catch {}
    
    // Open WhatsApp with the exact same message as admin students
    const mobile = formatWhatsappNumber(student.mobile_number);
    if (!mobile) { toast.error("No mobile number"); return; }
    
    // Use the exact same message format as admin students page
    const message = `اغابي ${student.student_name || ''}! دا الكرت بتاعك اللي هتحضر به، خليه ديما معاك: ${student.code}`;
    const url = `https://wa.me/${mobile}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 ">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                QR Scanner
              </h1></div>
            <div className="flex items-center gap-3">
              {scanQueue.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-full shadow-lg animate-pulse">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span className="text-sm font-bold">{scanQueue.length} in Queue</span>
                </div>
              )}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full">
                <div className={`w-2 h-2 rounded-full ${scanning ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></div>
                <span className="text-sm font-medium text-emerald-700">
                  {scanning ? 'Scanning Active' : 'Scanner Idle'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-5 gap-6">
          {/* LEFT: Camera */}
          <div className="">
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl border border-gray-200/50 shadow-xl overflow-hidden">
              {/* Camera Header */}
              <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-800">Camera Scanner</h2>
                  <div className="flex items-center gap-2">
                    {torchAvailable && (
                      <button 
                        onClick={toggleTorch}
                        className={`p-2 rounded-lg transition-all ${torchOn ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        title="Toggle Flashlight"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Camera View */}
              <div className="relative aspect-video bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
                
                {/* Scanning Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="relative">
                    <div className="w-[30vw] h-[30vw] border-2 border-emerald-400/70 rounded-2xl shadow-[0_0_40px_rgba(16,185,129,0.25)]"></div>
                    {/* Corner decorations */}
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg"></div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg"></div>
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg"></div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg"></div>
                  </div>
                </div>

                {/* Scanning Animation */}
                {scanning && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-64 h-64 relative">
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse"></div>
                      <div className="absolute top-4 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent animate-pulse" style={{animationDelay: '0.5s'}}></div>
                    </div>
                  </div>
                )}

              </div>

              {/* Control Button - Always visible */}
              <div className="p-4 bg-gray-50 border-t border-gray-200">
                <div className="flex flex-col items-center justify-center gap-3">
                  {scanning ? (
                    <button 
                      className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-full shadow-lg transition-all transform hover:scale-105 flex items-center gap-2"
                      onClick={stopScanning}
                    >
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      Stop Scanning
                    </button>
                  ) : (
                    <button 
                      className={`px-6 py-3 font-semibold rounded-full shadow-lg transition-all transform hover:scale-105 flex items-center gap-2 ${
                        cameraSupported 
                          ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white'
                          : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      }`}
                      onClick={cameraSupported ? startScanning : undefined} 
                      disabled={!cameraSupported}
                      title={!cameraSupported ? 'Camera not supported - use search to select students manually' : ''}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M12 12h-.01M12 12v4h1m1 0h.01" />
                      </svg>
                      {!cameraSupported ? 'Camera Not Supported' : (selectedStudent && pauseOnScan ? 'Resume Scanning' : 'Start Scanning')}
                    </button>
                  )}
                  
                  {/* Camera Resolution Info */}
                  {scanning && cameraResolution && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs font-medium text-blue-700">{cameraResolution}</span>
                    </div>
                  )}
                </div>
              </div>
              {scanError && (
                <div className="p-4 bg-red-50 border-t border-red-200 flex items-center gap-3">
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-red-800 font-medium">Scanner Error</p>
                    <p className="text-red-700 text-sm">{scanError}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Details & Actions */}
          <div className="mt-5 space-y-4">
            {/* Search */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h3 className="font-semibold text-gray-800">Search Students</h3>
              </div>
              <div className="relative">
                <input 
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-500" 
                  placeholder="Search by name, mobile, or code..." 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                />
                {search && (
                  <button 
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              
              {search && searchResults.length > 0 && (
                <div className="mt-3 bg-white border border-gray-100 rounded-xl divide-y max-h-64 overflow-auto shadow-inner">
                  {searchResults.map((s) => (
                    <button 
                      key={s.student_id} 
                      className="w-full text-left px-4 py-3 hover:bg-emerald-50 transition-colors group" 
                      onClick={() => {
                        setScanQueue(prev => {
                          const exists = prev.find(st => st.student_id === s.student_id);
                          if (!exists) {
                            beep();
                            vibrate();
                            toast.success({ message: `Added to queue: ${s.student_name || s.code}`, duration: 1000 });
                            return [...prev, s];
                          } else {
                            toast.info({ message: `Already in queue: ${s.student_name || s.code}`, duration: 1000 });
                            return prev;
                          }
                        });
                        setSearch("");
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 group-hover:text-blue-700">{s.student_name || 'Unknown'}</div>
                          <div className="text-sm text-gray-500 mt-0.5">Code: {s.code}</div>
                          {s.mobile_number && (
                            <div className="text-xs text-gray-400 mt-0.5">{s.mobile_number}</div>
                          )}
                        </div>
                        <div className="flex items-center text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {search && searchResults.length === 0 && (
                <div className="mt-3 p-4 text-center text-gray-500 bg-gray-50 rounded-xl">
                  <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm">No students found matching "{search}"</p>
                </div>
              )}
            </div>

          {/* Scan Queue */}
          {scanQueue.length > 0 && (
            <div className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-300 rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-600 to-green-600 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg">Scan Queue</h3>
                      <p className="text-emerald-100 text-sm">{scanQueue.length} student{scanQueue.length !== 1 ? 's' : ''} ready to record</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setScanQueue([])}
                      className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Clear All
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Queue List */}
              <div className="p-4 max-h-96 overflow-y-auto space-y-2">
                {scanQueue.map((student, index) => (
                  <div 
                    key={student.student_id} 
                    className="bg-white rounded-xl p-3 border border-emerald-200 shadow-sm hover:shadow-md transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{student.student_name || 'Unknown'}</div>
                        <div className="text-sm text-gray-500">Code: {student.code}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setScanQueue(prev => prev.filter(s => s.student_id !== student.student_id))}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                      title="Remove from queue"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              
              {/* Record All Button */}
              <div className="p-4 bg-white border-t-2 border-emerald-200">
                <button
                  onClick={() => batchRecordMutation.mutate(scanQueue)}
                  disabled={batchRecordMutation.isPending}
                  className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] disabled:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {batchRecordMutation.isPending ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Recording {scanQueue.length} Students...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Record All ({scanQueue.length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Selected student card */}
          {selectedStudent && (
            <div className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-2xl shadow-lg overflow-hidden">
              {/* Header with student info */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white">{selectedStudent.student_name || 'Not Found'}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-blue-100 text-sm">code:</span>
                      <span className="bg-white/20 px-2 py-0.5 rounded-md font-mono text-sm font-semibold backdrop-blur-sm">
                        {selectedStudent.code}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                {/* Student Details */}
                <div className="grid grid-cols-1 gap-3">
                  {selectedStudent.mobile_number && (
                    <div className="flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span className="text-gray-600">Mobile:</span>
                      <span className="font-mono text-gray-800">{selectedStudent.mobile_number}</span>
                    </div>
                  )}
                  
                </div>

                {/* Attendance Status */}
                {attendance && (
                  <div className={`p-3 rounded-xl border-2 ${
                    alreadyAttended 
                      ? 'bg-amber-50 border-amber-200 text-amber-800' 
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}>
                    <div className="flex items-center gap-2">
                      <svg className={`w-5 h-5 ${alreadyAttended ? 'text-amber-600' : 'text-emerald-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={alreadyAttended ? "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"} />
                      </svg>
                      <div className="flex-1">
                        <div className="font-semibold">
                          {alreadyAttended ? 'no duplicate allowed' : 'recorded successfully'}
                        </div>
                        <div className="text-sm opacity-80">
                          {alreadyAttended ? 'student already attended' : `at: ${new Date(attendance.attended_at).toLocaleTimeString('ar-EG')}`}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-3">
                  {/* Secondary Actions */}
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      className={`py-2.5 px-3 rounded-lg font-medium transition-all duration-200 ${
                        selectedStudent.mobile_number
                          ? 'bg-white border-2 border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                          : 'bg-gray-100 border-2 border-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                      onClick={() => shareIdCard(selectedStudent)} 
                      disabled={!selectedStudent.mobile_number}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                        </svg>
                        <span className="text-sm">share id card</span>
                      </div>
                    </button>
                    
                    <button 
                      className={`py-2.5 px-3 rounded-lg font-medium transition-all duration-200 ${
                        selectedStudent.mobile_number
                          ? 'bg-green-600 text-white hover:bg-green-700 shadow-md hover:shadow-lg'
                          : 'bg-gray-100 border-2 border-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                      onClick={() => sendWhatsApp(selectedStudent)} 
                      disabled={!selectedStudent.mobile_number}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488z"/>
                        </svg>
                        <span className="text-sm">whatsapp</span>
                      </div>
                    </button>
                  </div>
                  {/* Primary Action */}
                  <button 
                    className={`w-full py-3 px-4 mt-2 rounded-xl font-semibold text-white transition-all duration-200 ${
                      markAttendance.isPending 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : attendance
                          ? 'bg-gray-500 hover:bg-gray-600'
                          : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                    }`}
                    onClick={() => markAttendance.mutate({ studentId: selectedStudent.student_id })} 
                    disabled={markAttendance.isPending}
                  >
                    <div className="flex items-center justify-center gap-2">
                      {markAttendance.isPending ? (
                        <>
                          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          recording...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {attendance ? 'recorded' : 'record attendance'}
                        </>
                      )}
                    </div>
                  </button>

                  
                </div>
              </div>
            </div>
          )}

            {/* Recent Scans */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-lg">
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h2 className="font-semibold text-gray-800">Recent  </h2>
                  </div>
                  <div className="flex items-center gap-3">
                    {recent.isFetching && (
                      <div className="flex items-center gap-2 text-xs text-blue-600">
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        ...
                      </div>
                    )}
                    <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                      {recent.data?.length || 0}
                    </div>
                    <button
                      onClick={() => setShowAllRecords(!showAllRecords)}
                      className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                      title={showAllRecords ? "Show recent only" : "Show all records"}
                    >
                      <svg className={`w-3 h-3 transition-transform ${showAllRecords ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      {showAllRecords ? '' : ''}
                    </button>
                    <Link 
                      href="/admin/scanner/history" 
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      ➡️
                    </Link>
                  </div>
                </div>
              </div>
              
              <div className={`${showAllRecords ? 'max-h-96' : 'max-h-64'} overflow-auto transition-all duration-300`}>
                {recent.isLoading ? (
                  <div className="p-8 text-center">
                    <svg className="w-8 h-8 mx-auto mb-3 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-gray-500 text-sm">Loading recent activity...</p>
                  </div>
                ) : (recent.data && recent.data.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {recent.data.map((r) => (
                      <div key={r.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{r.student_name || 'Unknown'}</div>
                              <div className="text-sm text-gray-500">Code: {r.code}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <div className="text-xs text-gray-500">
                                {new Date(r.attended_at).toLocaleTimeString('en-US', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </div>
                              <div className="text-xs text-gray-400">
                                {new Date(r.attended_at).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric' 
                                })}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                if (confirm(`Delete attendance record for ${r.student_name}?`)) {
                                  deleteAttendance.mutate(r.id);
                                }
                              }}
                              disabled={deleteAttendance.isPending}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete attendance record"
                            >
                              {deleteAttendance.isPending ? (
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-gray-500 text-sm font-medium">No recent activity</p>
                    <p className="text-gray-400 text-xs mt-1">
                      {showAllRecords ? 'No scans from the last week' : 'Scans from the last 3 hours will appear here'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
