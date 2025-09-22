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
  const [pauseOnScan, setPauseOnScan] = useState(true);
  const [quality, setQuality] = useState<'low' | 'med' | 'high'>('med');

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

  const [search, setSearch] = useState("");
  const searchResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [] as StudentSummary[];
    return students
      .filter((s) => [s.code, s.student_name, s.mobile_number, s.mobile_number2].map((v) => (v || "").toLowerCase()).some((v) => v.includes(term)))
      .slice(0, 10);
  }, [students, search]);

  const recent = useQuery({
    queryKey: ["admin", "attendance", "recent"],
    queryFn: async () => {
      const res = await authFetch("/api/admin/attendance/recent?hours=3");
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Load failed");
      return j.items as Array<{ id: string; student_id: string; code: string | null; student_name: string | null; attended_at: string }>;
    },
    refetchInterval: 15_000,
  });

  const markAttendance = useMutation({
    mutationFn: async (payload: { code?: string; studentId?: string }) => {
      const res = await authFetch("/api/admin/attendance/scan", { method: "POST", body: JSON.stringify(payload) });
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
      // Map quality to constraints
      const dims = quality === 'low' ? { w: 480, h: 360, fps: 24 } : quality === 'high' ? { w: 1280, h: 720, fps: 30 } : { w: 640, h: 480, fps: 30 };
      const constraints: MediaStreamConstraints = {
        video: {
          ...(selectedDeviceId !== 'auto' ? { deviceId: { exact: selectedDeviceId } } : { facingMode: { ideal: "environment" } }),
          width: { ideal: dims.w },
          height: { ideal: dims.h },
          frameRate: { ideal: dims.fps }
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
            vibrate();
            beep();
            // Do NOT auto-record. Select the student and wait for admin to click Record.
            const stu = findStudentByCode(text);
            if (stu) {
              setSelectedStudent(stu);
              setAttendance(null);
              setAlreadyAttended(false);
              toast.info({ message: `Scanned: ${stu.student_name || ''} (${stu.code})`, duration: 1800 });
              if (pauseOnScan) {
                // Pause scanning to prevent overwriting selection
                stopScanning();
              }
            } else {
              toast.error({ message: `Student not found for code: ${text}`, duration: 2500 });
            }
          }
        }
      });
      controlsRef.current = controls;
      // Track and torch capability
      try {
        const stream = (videoRef.current as any).srcObject as MediaStream | undefined;
        const track = stream?.getVideoTracks?.()[0] || null;
        trackRef.current = track;
        const caps = (track as any)?.getCapabilities?.() || {};
        const hasTorch = Boolean((caps as any).torch);
        setTorchAvailable(hasTorch);
        setTorchOn(false);
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
      setSelectedStudent(stu);
      setAttendance(null);
      setAlreadyAttended(false);
      toast.info({ message: `Selected: ${stu.student_name || ''} (${stu.code})`, duration: 1600 });
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

  async function generateAndDownloadIdCard(student: StudentSummary) {
    // Lightweight card generator (client-only)
    const width = 640, height = 800;
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#0b2844"); grad.addColorStop(0.5, "#1b2b5a"); grad.addColorStop(1, "#28194b");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);
    // QR
    const qrSize = 480;
    const off = document.createElement("canvas"); off.width = qrSize; off.height = qrSize;
    await QRCode.toCanvas(off, student.code || "", { errorCorrectionLevel: "H", margin: 1, scale: 8, color: { dark: "#0b0b0b", light: "#ffffff" } });
    const qrX = (width - qrSize) / 2; const qrY = 180;
    // White rounded box behind QR
    ctx.fillStyle = "#fff"; roundRect(ctx, qrX - 14, qrY - 14, qrSize + 28, qrSize + 28, 24); ctx.fill();
    ctx.drawImage(off, qrX, qrY, qrSize, qrSize);
    // Name & Code
    ctx.fillStyle = "#ffffff"; ctx.font = "700 46px ui-sans-serif, system-ui"; ctx.textAlign = "center";
    ctx.fillText(student.student_name || " ", width / 2, qrY + qrSize + 80);
    ctx.fillStyle = "#d6e1ff"; ctx.font = "600 40px ui-sans-serif, system-ui";
    ctx.fillText(student.code || " ", width / 2, qrY + qrSize + 140);
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url; a.download = `${(student.student_name || "student").replace(/\s+/g, "_")}_${student.code || "id"}.png`;
    a.click();
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
      await generateAndDownloadIdCard(student);
    } catch {}
    const mobile = formatWhatsappNumber(student.mobile_number);
    if (!mobile) { toast.error("No mobile number"); return; }
    const msg = `اغابي ${student.student_name || ''} دا الكود بتاعك ${student.code || ''}`;
    const url = `https://wa.me/${mobile}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Scanner</h1>
        <p className="text-gray-500">Select a student by scanning their QR or searching. Click Record to mark attendance.</p>
      </div>

      <div className="grid lg:grid-cols-12 gap-4">
        {/* LEFT: Camera */}
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-gray-200 bg-white shadow overflow-hidden">
            <div className="relative aspect-video bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-2/3 h-2/3 border-2 border-emerald-400/70 rounded-xl shadow-[0_0_40px_rgba(16,185,129,0.25)]"></div>
              </div>
              {/* Camera toolbar removed per request */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                {scanning ? (
                  <button className="btn bg-gray-800 text-white/90 hover:bg-gray-700" onClick={stopScanning}>Stop Scanning</button>
                ) : (
                  <button className="btn btn-primary" onClick={startScanning} disabled={!cameraSupported}>{selectedStudent && pauseOnScan ? 'Resume Scanning' : 'Start Scanning'}</button>
                )}
              </div>
            </div>
            {!cameraSupported && (
              <div className="p-3 bg-amber-50 text-amber-700 border-t border-amber-200 text-sm">Camera not supported. Use search to select a user and press Record Attendance.</div>
            )}
            {scanError && (
              <div className="p-3 bg-red-50 text-red-700 border-t border-red-200 text-sm">{scanError}</div>
            )}
          </div>
        </div>

        {/* RIGHT: Details & Actions */}
        <div className="lg:col-span-5 space-y-3">
          {/* Search */}
          <div className="bg-white border border-gray-200 rounded-xl shadow p-3">
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="Search name, mobile or code..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {search && searchResults.length > 0 && (
              <div className="mt-2 bg-white border border-gray-200 rounded-xl divide-y max-h-56 overflow-auto">
                {searchResults.map((s) => (
                  <button key={s.student_id} className="w-full text-left px-4 py-2 hover:bg-gray-50" onClick={() => { setSelectedStudent(s); setAttendance(null); setAlreadyAttended(false); }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{s.student_name || '-'}</div>
                        <div className="text-xs text-gray-500">{s.code}</div>
                      </div>
                      <div className="text-xs text-gray-400">Select</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {/* Manual code */}
          </div>

          {/* Selected student card */}
          {selectedStudent && (
            <div className="bg-white border border-gray-200 rounded-xl shadow p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">{selectedStudent.student_name || '-'}</div>
                  <div className="text-sm text-gray-500">Code: <span className="font-mono">{selectedStudent.code}</span></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn" onClick={() => shareIdCard(selectedStudent)} disabled={!selectedStudent.mobile_number}>Share ID Card</button>
                  <button className="btn bg-green-600 hover:bg-green-700 text-white" onClick={() => sendWhatsApp(selectedStudent)} disabled={!selectedStudent.mobile_number}>WhatsApp</button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 items-center">
                <button className="btn btn-primary" onClick={() => markAttendance.mutate({ studentId: selectedStudent.student_id })} disabled={markAttendance.isPending}>
                  {markAttendance.isPending ? 'Recording...' : 'Record Attendance'}
                </button>
                {attendance && (
                  <div className={`px-3 py-1 rounded-lg text-sm ${alreadyAttended ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {alreadyAttended ? 'Already marked today' : `Marked at ${new Date(attendance.attended_at).toLocaleTimeString()}`}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recent Scans */}
          <div className="bg-white border border-gray-200 rounded-xl shadow">
            <div className="flex items-center justify-between px-3 py-2 gap-2">
              <h2 className="text-sm font-semibold">Recent Scans</h2>
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-500 hidden sm:block">{recent.isFetching ? 'Refreshing...' : `Showing ${recent.data?.length || 0}`}</div>
                <Link href="/admin/scanner/history" className="btn btn-sm">History</Link>
              </div>
            </div>
            <div className="px-2 pb-2">
              {recent.isLoading ? (
                <div className="p-6 text-center text-gray-500">Loading...</div>
              ) : (recent.data && recent.data.length > 0 ? (
                <div className="divide-y">
                  {recent.data.map((r) => (
                    <div key={r.id} className="px-3 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">{r.code}</span>
                        <span className="text-gray-800">{r.student_name || '-'}</span>
                      </div>
                      <div className="text-xs text-gray-500">{new Date(r.attended_at).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-gray-500">No recent scans in the last 3 hours</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
