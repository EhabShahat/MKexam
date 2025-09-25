"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/authFetch";
import QRCode from "qrcode";

interface StudentSummary {
  student_id: string;
  code: string;
  student_name: string | null;
  mobile_number: string | null;
}

export default function StudentIdCardClient({ studentId }: { studentId: string }) {
  const { data: student } = useQuery({
    queryKey: ["admin", "student", studentId],
    queryFn: async (): Promise<StudentSummary | null> => {
      const res = await authFetch(`/api/admin/students/${studentId}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to load student");
      return j.student as StudentSummary;
    },
  });

  const { data: publicSettings } = useQuery({
    queryKey: ["public", "settings"],
    queryFn: async () => {
      const res = await fetch("/api/public/settings");
      try {
        const j = await res.json();
        return j || {};
      } catch {
        return {};
      }
    },
  });

  const brandLogoUrl = (publicSettings?.brand_logo_url as string) || null;
  const brandName = (publicSettings?.brand_name as string) || "";
  const fullName = student?.student_name || "";
  const code = student?.code || "";

  // Canvas refs
  const cardRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);

  const card = {
    width: 450,
    height: 600,
    padding: 24,
    bg: [
      { color: "#0b2844", y: 0 },
      { color: "#1b2b5a", y: 0.5 },
      { color: "#28194b", y: 1 },
    ],
  } as const;

  // Draw the card on canvas
  useEffect(() => {
    let disposed = false;
    async function draw() {
      if (!cardRef.current || !student) return;
      const canvas = cardRef.current;
      canvas.width = card.width;
      canvas.height = card.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, 0, card.height);
      card.bg.forEach((stop) => grad.addColorStop(stop.y, stop.color));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, card.width, card.height);

      // Decorative stars (simple)
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

      // Calculate vertical centering
      const totalContentHeight = 
        40 + // Arabic text height
        (brandName ? 30 : 0) + // Brand name height (if present)
        60   + // Gap after header text
        340 + 20 + // QR container height
        20 + // Gap after QR
        32 + // Name text height
        10 + // Gap between name and code
        24; // Code text height
      
      const startY = (card.height - totalContentHeight) / 2;
      let currentY = startY;

      // Header text above QR code
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      
      // Arabic cathedral text
      ctx.font = "600 24px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, 'Arabic UI Text', 'Geeza Pro', 'Damascus', 'Al Bayan'";
      ctx.fillText("كاتدرائية مارمينا والبابا كيرلس", card.width / 2, currentY + 30);
      currentY += 40;
      
      // Brand name (if available)
      if (brandName) {
        ctx.font = "500 20px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
        ctx.fillText(brandName, card.width / 2, currentY + 20);
        currentY += 30;
      }

      // Gap after header text
      currentY += 100;

      // QR content
      const qrText = code || "";

      // Offscreen QR canvas
      const qrSize = 340;
      const off = document.createElement("canvas");
      off.width = qrSize;
      off.height = qrSize;
      await QRCode.toCanvas(off, qrText || "", {
        errorCorrectionLevel: "H",
        margin: 1,
        scale: 8,
        color: { dark: "#0b0b0b", light: "#ffffff" },
      });

      // Rounded rectangle container (transparent fill per latest design)
      const qrContainerW = qrSize + 20;
      const qrContainerH = qrSize + 20;
      const qrContainerX = (card.width - qrContainerW) / 2;
      const qrContainerY = currentY;
      roundRect(ctx, qrContainerX, qrContainerY, qrContainerW, qrContainerH, 28);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      // Draw QR centered inside container
      const qrX = (card.width - qrSize) / 2;
      const qrY = qrContainerY + (qrContainerH - qrSize) / 2;
      ctx.drawImage(off, qrX, qrY, qrSize, qrSize);

      // Center logo over QR
      if (brandLogoUrl) {
        try {
          const img = await loadImage(brandLogoUrl);
          if (!disposed) {
            // white circle backdrop
            const logoR = Math.floor(qrSize * 0.16);
            const cx = card.width / 2;
            const cy = qrY + qrSize / 2;
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, logoR + 10, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
            ctx.fill();
            ctx.closePath();
            // draw logo clipped to circle
            ctx.beginPath();
            ctx.arc(cx, cy, logoR, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(img, cx - logoR, cy - logoR, logoR * 2, logoR * 2);
            ctx.restore();
          }
        } catch {}
      }

      // Update currentY after QR container
      currentY += qrContainerH + 20; // Gap after QR

      // Name text
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 32px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
      ctx.textAlign = "center";
      ctx.fillText(fullName || " ", card.width / 2, currentY + 25);
      currentY += 42; // Name height + gap

      // Code text
      ctx.font = "600 24px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
      ctx.fillStyle = "#d6e1ff";
      ctx.fillText(code || " ", card.width / 2, currentY + 18);

      setReady(true);
    }
    draw();
    return () => {
      disposed = true;
    };
  }, [student, brandLogoUrl, brandName, card.width, card.height, fullName, code]);

  const download = () => {
    if (!cardRef.current) return;
    const url = cardRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(fullName || "student").replace(/\s+/g, "_")}_${code || "id"}.png`;
    a.click();
  };

  const sendId = () => {
    if (!cardRef.current || !student) return;
    
    // Download the ID card image
    const url = cardRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(fullName || "student").replace(/\s+/g, "_")}_${code || "id"}.png`;
    a.click();
    
    // Open WhatsApp if mobile number is available
    if (student.mobile_number) {
      const cleanNumber = student.mobile_number.replace(/\D/g, '');
      const mobileNumber = cleanNumber.startsWith('0') 
        ? cleanNumber.substring(1) 
        : cleanNumber;
      
      const message = `اغابي ${fullName || ''}! دا الكرت بتاعك اللي هتحضر به، خليه ديما معاك: ${code}`;
      const whatsappUrl = `https://wa.me/${mobileNumber}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Student ID Card</h1>
        <div className="flex gap-2">
          <button className="btn" onClick={download} disabled={!ready}>Download PNG</button>
          <button className="btn btn-primary" onClick={sendId} disabled={!ready || !student?.mobile_number}>
            Send ID
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center">
        <canvas
          ref={cardRef}
          width={card.width}
          height={card.height}
          style={{
            width: card.width,
            height: card.height,
            minWidth: card.width,
            minHeight: card.height,
            maxWidth: card.width,
            maxHeight: card.height,
            display: "block",
            flex: "0 0 auto",
          }}
          className="rounded-xl shadow-2xl border border-gray-200 shrink-0 grow-0 basis-auto"
        />
      </div>
      <p className="text-sm text-gray-500 mt-4 text-center">QR contains the student's code. Logo is embedded at the center.</p>
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
