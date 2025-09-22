"use client";

import { useState, useEffect, useRef } from "react";
import BrandLogo from "@/components/BrandLogo";
import { useStudentLocale } from "@/components/public/PublicLocaleProvider";

interface StudentSummary {
  student_id: string;
  code: string;
  student_name: string | null;
}

interface PublicSettings {
  brand_logo_url?: string | null;
}

export default function PublicIdPage() {
  const { locale, dir } = useStudentLocale();
  const [nationalId, setNationalId] = useState("");
  const [student, setStudent] = useState<StudentSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<PublicSettings>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/public/settings");
        if (res.ok) {
          const data = await res.json();
          setSettings(data || {});
        }
      } catch {}
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = nationalId.trim();
    if (!n) {
      setError("Please enter a national number");
      return;
    }
    setError(null);
    setLoading(true);
    setStudent(null);
    try {
      const res = await fetch(`/api/public/students/by-national?national_id=${encodeURIComponent(n)}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j?.error || "Not found");
        return;
      }
      const s = j?.student as StudentSummary | null;
      if (!s) {
        setError("Not found");
        return;
      }
      setStudent(s);
    } catch (err: any) {
      setError(err?.message || "Failed to search");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50" dir={dir} lang={locale}>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex flex-col items-center mb-8">
          <BrandLogo useAppSettings={true} size="lg" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Public ID</h1>
          <p className="mt-2 text-gray-600">Enter your national number to view your ID card</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="national-id" className="block text-sm font-semibold text-gray-700 mb-2">National Number</label>
              <input
                id="national-id"
                type="text"
                inputMode="numeric"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value.replace(/[^0-9]/g, ""))}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 bg-gray-50 focus:bg-white"
                placeholder="00000000000000"
                maxLength={20}
                autoComplete="off"
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm">{error}</div>
            )}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 disabled:cursor-not-allowed shadow-lg"
              disabled={loading || nationalId.trim().length === 0}
            >
              {loading ? "Searching..." : "Find ID"}
            </button>
          </form>
        </div>

        {/* Show card when loaded */}
        {student && (
          <div className="mt-8 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
            <IdCardCanvas
              fullName={student.student_name || ""}
              code={student.code}
              brandLogoUrl={(settings?.brand_logo_url as string) || null}
            />
          </div>
        )}
      </div>
    </main>
  );
}

function IdCardCanvas({ fullName, code, brandLogoUrl }: { fullName: string; code: string; brandLogoUrl: string | null }) {
  const cardRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const QRCode = (await import("qrcode")).default;
      if (!cardRef.current) return;
      const canvas = cardRef.current;
      const card = { width: 720, height: 960 };
      canvas.width = card.width;
      canvas.height = card.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, 0, card.height);
      grad.addColorStop(0, "#0b2844");
      grad.addColorStop(0.5, "#1b2b5a");
      grad.addColorStop(1, "#28194b");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, card.width, card.height);

      // Decorative stars
      ctx.globalAlpha = 0.15;
      for (let i = 0; i < 120; i++) {
        const x = Math.random() * card.width;
        const y = Math.random() * card.height;
        const r = Math.random() * 2;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // QR code
      const qrText = code || "";
      const qrSize = 420;
      const off = document.createElement("canvas");
      off.width = qrSize;
      off.height = qrSize;
      await QRCode.toCanvas(off, qrText, {
        errorCorrectionLevel: "H",
        margin: 1,
        scale: 8,
        color: { dark: "#0b0b0b", light: "#ffffff" },
      });

      // QR container
      const qrContainerW = qrSize + 20;
      const qrContainerH = qrSize + 20;
      const qrContainerX = (card.width - qrContainerW) / 2;
      const qrContainerY = 180;
      roundRect(ctx, qrContainerX, qrContainerY, qrContainerW, qrContainerH, 28);
      ctx.fillStyle = "rgba(255,255,255,.8)";
      ctx.fill();

      // Draw QR
      const qrX = (card.width - qrSize) / 2;
      const qrY = qrContainerY + (qrContainerH - qrSize) / 2;
      ctx.drawImage(off, qrX, qrY, qrSize, qrSize);

      // Center logo over QR
      if (brandLogoUrl) {
        try {
          const img = await loadImage(brandLogoUrl);
          if (mounted) {
            const logoR = Math.floor(qrSize * 0.16);
            const cx = card.width / 2;
            const cy = qrY + qrSize / 2;
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, logoR + 10, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.fill();
            ctx.closePath();
            ctx.beginPath();
            ctx.arc(cx, cy, logoR, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(img, cx - logoR, cy - logoR, logoR * 2, logoR * 2.5);
            ctx.restore();
          }
        } catch {}
      }

      // Name and code
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 40px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
      ctx.textAlign = "center";
      ctx.fillText(fullName || " ", card.width / 2, qrContainerY + qrContainerH + 80);

      ctx.font = "600 36px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
      ctx.fillStyle = "#d6e1ff";
      ctx.fillText(code || " ", card.width / 2, qrContainerY + qrContainerH + 140);

      setReady(true);
    })();
    return () => { mounted = false; };
  }, [fullName, code, brandLogoUrl]);

  function download() {
    if (!cardRef.current) return;
    const url = cardRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(fullName || "student").replace(/\s+/g, "_")}_${code || "id"}.png`;
    a.click();
  }

  function printCard() {
    if (!cardRef.current) return;
    const dataUrl = cardRef.current.toDataURL("image/png");
    const w = window.open("");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>ID Card</title><style>
      html,body{margin:0;padding:0}
      .wrap{display:flex;align-items:center;justify-content:center;min-height:100vh;background:#111}
      img{max-width:100%;height:auto;}
      @media print { .noprint{display:none} }
    </style></head><body><div class="wrap"><img src="${dataUrl}"/></div></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
        <h3 className="text-sm font-semibold">ID Card</h3>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={download} disabled={!ready}>Download PNG</button>
        </div>
      </div>
      <div className="flex items-center justify-center p-4">
        <canvas ref={cardRef} className="rounded-xl shadow-2xl border border-gray-200" />
      </div>
    </div>
  );
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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
