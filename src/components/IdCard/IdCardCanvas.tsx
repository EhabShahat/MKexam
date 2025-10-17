"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

interface IdCardCanvasProps {
  fullName: string;
  code: string;
  brandLogoUrl?: string | null;
  brandName?: string;
  photoUrl?: string | null;
  onReady?: () => void;
}

export default function IdCardCanvas({
  fullName,
  code,
  brandLogoUrl = null,
  brandName = "",
  photoUrl = null,
  onReady,
}: IdCardCanvasProps) {
  const cardRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);

  const card = {
    width: 583, // 648 * 0.9 (original 720 * 0.81)
    height: 1037, // 1152 * 0.9 (original 1280 * 0.81) - maintaining 9:16 aspect ratio
  };

  useEffect(() => {
    let disposed = false;
    async function draw() {
      if (!cardRef.current) return;
      const canvas = cardRef.current;
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
        const r = Math.random() * 4.05 + 0.81; // Stars (0.81-4.86px) - reduced by 19%
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Calculate vertical centering
      const photoSize = 113; // 126 * 0.9 (original 140 * 0.81)
      const totalContentHeight =
        20 +
        (brandName ? 45 : 0) +
        30 +
        photoSize + 20 +
        20 +
        420 + 20 +
        30 +
        50 +
        15 +
        36;

      const startY = (card.height - totalContentHeight) / 2;
      let currentY = startY;

      // Header text
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.font = "600 42px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, 'Arabic UI Text', 'Geeza Pro', 'Damascus', 'Al Bayan'"; // 47 * 0.9 (original 52 * 0.81)
      ctx.fillText("كاتدرائية مارمينا والبابا كيرلس", card.width / 2, 81); // 90 * 0.9 (original 100 * 0.81)
      currentY += 50;

      if (brandName) {
        ctx.font = "500 32px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto"; // 36 * 0.9 (original 40 * 0.81)
        ctx.fillText(brandName, card.width / 2, 122); // 135 * 0.9 (original 150 * 0.81)
        currentY += 50;
      }

      currentY += 80;

      // Student Photo
      const photoCenterX = card.width / 2;
      const photoCenterY = currentY + photoSize / 2;
      const photoRadius = photoSize / .6;

      // White background circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(photoCenterX, photoCenterY, photoRadius + 6.5, 0, Math.PI * 2); // 7.2 * 0.9 (original 8 * 0.81)
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.closePath();

      // Draw photo or placeholder
      if (photoUrl) {
        try {
          const photoImg = await loadImage(photoUrl);
          if (!disposed) {
            ctx.beginPath();
            ctx.arc(photoCenterX, photoCenterY, photoRadius, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            
            // Calculate scaling to cover the circle
            const scale = Math.max(
              (photoRadius * 2) / photoImg.width,
              (photoRadius * 2) / photoImg.height
            );
            const scaledWidth = photoImg.width * scale;
            const scaledHeight = photoImg.height * scale;
            const imgX = photoCenterX - scaledWidth / 2;
            const imgY = photoCenterY - scaledHeight / 2;
            
            ctx.drawImage(photoImg, imgX, imgY, scaledWidth, scaledHeight);
          }
        } catch {
          // If photo fails to load, draw placeholder
          drawPhotoPlaceholder(ctx, photoCenterX, photoCenterY, photoRadius);
        }
      } else {
        // No photo URL, draw placeholder
        drawPhotoPlaceholder(ctx, photoCenterX, photoCenterY, photoRadius);
      }
      ctx.restore();

      currentY += photoSize + 162; // 180 * 0.9 (original 200 * 0.81)

      // QR code
      const qrSize = 324; // 360 * 0.9 (original 400 * 0.81)
      const off = document.createElement("canvas");
      off.width = qrSize;
      off.height = qrSize;
      await QRCode.toCanvas(off, code || "", {
        errorCorrectionLevel: "H",
        margin: 1,
        scale: 8,
        color: { dark: "#0b0b0b", light: "#ffffff" },
      });

      const qrContainerW = qrSize + 16; // 18 * 0.9 (original 20 * 0.81)
      const qrContainerH = qrSize + 16; // 18 * 0.9 (original 20 * 0.81)
      const qrContainerX = (card.width - qrContainerW) / 2;
      const qrContainerY = currentY;
      roundRect(ctx, qrContainerX, qrContainerY, qrContainerW, qrContainerH, 23); // 25.2 * 0.9 (original 28 * 0.81)
      ctx.fillStyle = "rgba(255,255,255,.8)";
      ctx.fill();

      const qrX = (card.width - qrSize) / 2;
      const qrY = qrContainerY + (qrContainerH - qrSize) / 2;
      ctx.drawImage(off, qrX, qrY, qrSize, qrSize);

      // Logo
      if (brandLogoUrl) {
        try {
          const img = await loadImage(brandLogoUrl);
          if (!disposed) {
            const logoR = Math.floor(qrSize * 0.16);
            const cx = card.width / 2;
            const cy = qrY + qrSize / 2;
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, logoR + 8, 0, Math.PI * 2); // 9 * 0.9 (original 10 * 0.81)
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

      currentY += qrContainerH + 16; // 18 * 0.9 (original 20 * 0.81)

      // Name
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 32px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto"; // 36 * 0.9 (original 40 * 0.81)
      ctx.textAlign = "center";
      ctx.fillText(fullName || " ", card.width / 2, currentY + 28); // 31.5 * 0.9 (original 35 * 0.81)
      currentY += 53; // 58.5 * 0.9 (original 65 * 0.81)

      // Code
      ctx.font = "600 29px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto"; // 32.4 * 0.9 (original 36 * 0.81)
      ctx.fillStyle = "#d6e1ff";
      ctx.fillText(code || " ", card.width / 2, currentY + 20); // 22.5 * 0.9 (original 25 * 0.81)

      setReady(true);
      if (onReady) onReady();
    }
    draw();
    return () => { disposed = true; };
  }, [brandLogoUrl, brandName, fullName, code, photoUrl, onReady]);

  return (
    <canvas
      ref={cardRef}
      width={card.width}
      height={card.height}
      style={{ width: 365, height: 648, maxWidth: "100%" }} // 405 * 0.9, 720 * 0.9 (original 450 * 0.81, 800 * 0.81)
      className="rounded-xl shadow-2xl border border-gray-200"
    />
  );
}

export function getCardRef(canvas: HTMLCanvasElement | null) {
  return canvas;
}

export function downloadCard(canvas: HTMLCanvasElement | null, fullName: string, code: string) {
  if (!canvas) return;
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(fullName || "student").replace(/\s+/g, "_")}_${code || "id"}.png`;
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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawPhotoPlaceholder(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number
) {
  // Gradient background for placeholder
  const grad = ctx.createLinearGradient(centerX - radius, centerY - radius, centerX + radius, centerY + radius);
  grad.addColorStop(0, "#e0e7ff");
  grad.addColorStop(1, "#c7d2fe");
  
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.closePath();

  // Draw user icon
  ctx.fillStyle = "#6366f1";
  ctx.strokeStyle = "#6366f1";
  ctx.lineWidth = 3;

  // Head circle
  const headRadius = radius * 0.25;
  ctx.beginPath();
  ctx.arc(centerX, centerY - radius * 0.15, headRadius, 0, Math.PI * 2);
  ctx.fill();

  // Body (shoulders)
  ctx.beginPath();
  ctx.arc(centerX, centerY + radius * 0.6, radius * 0.5, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
}
