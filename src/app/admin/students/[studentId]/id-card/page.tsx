import IdCardClient from "./IdCardClient";

interface StudentSummary {
  student_id: string;
  code: string;
  student_name: string | null;
}

// Server Component wrapper (Next.js 15)
export default async function StudentIdCardPage(props: any) {
  const p: any = typeof (props as any)?.params?.then === "function" ? await (props as any).params : (props as any).params;
  const studentId = p?.studentId as string;
  return <IdCardClient studentId={studentId} />;
}

/* Legacy client implementation (kept here for reference and type safety; not exported)
function LegacyStudentIdCardPageClient({ params }: any) {
  const { studentId } = params;

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
  const fullName = student?.student_name || "";
  const code = student?.code || "";

  // Canvas refs
  const cardRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);

  const card = {
    width: 720, // good printable quality
    height: 960,
    padding: 40,
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

     
      // QR content
      const qrText = code || "";

      // Offscreen QR canvas
      const qrSize = 420;
      const off = document.createElement("canvas");
      off.width = qrSize;
      off.height = qrSize;
      await QRCode.toCanvas(off, qrText || "", {
        errorCorrectionLevel: "H",
        margin: 1,
        scale: 8,
        color: { dark: "#0b0b0b", light: "#ffffff" },
      });

      // White rounded rectangle container for QR
      const qrContainerW = qrSize + 20;
      const qrContainerH = qrSize + 20;
      const qrContainerX = (card.width - qrContainerW) / 2;
      const qrContainerY = 240;
      roundRect(ctx, qrContainerX, qrContainerY, qrContainerW, qrContainerH, 28);
      ctx.fillStyle = "rgba(255,255,255,0)";
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

      // Name text
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 40px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
      ctx.textAlign = "center";
      ctx.fillText(fullName || " ", card.width / 2, qrContainerY + qrContainerH + 80);

      // Code text (ID number)
      ctx.font = "600 36px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
      ctx.fillStyle = "#d6e1ff";
      ctx.fillText(code || " ", card.width / 2, qrContainerY + qrContainerH + 140);

      setReady(true);
    }
    draw();
    return () => {
      disposed = true;
    };
  }, [student, brandLogoUrl, card.width, card.height, fullName, code]);

  const download = () => {
    if (!cardRef.current) return;
    const url = cardRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(fullName || "student").replace(/\s+/g, "_")}_${code || "id"}.png`;
    a.click();
  };

  const printCard = () => {
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
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Student ID Card</h1>
        <div className="flex gap-2">
          <button className="btn" onClick={download} disabled={!ready}>Download PNG</button>
          <button className="btn btn-primary" onClick={printCard} disabled={!ready}>Print</button>
        </div>
      </div>

      <div className="flex items-center justify-center">
        <canvas ref={cardRef} className="rounded-xl shadow-2xl border border-gray-200"/>
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
*/
