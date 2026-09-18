import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Cable,
  Check,
  Loader2,
  Moon,
  SlidersVertical,
  Sun,
  TriangleAlert,
  Unplug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const CC_MIN = 0;
const CC_MAX = 127;
const BAUD_RATE = 9600;
/* Track geometry: 0.75rem padding top/bottom (12px), knob is 2.25rem (36px) tall,
   so the knob's *center* can travel between 12+18=30px and H-30px. */
const PAD = 0.75;
const KNOB_HALF = 1.125;
const TRAVEL = 2 * (PAD + KNOB_HALF); // total px (rem) unavailable to knob centers

type SendState = "idle" | "sending" | "sent";

/** Floating droplet blobs behind the glass — theme-aware via CSS vars. */
const BLOBS = [
  { pos: "left-[4%] top-[10%] size-44 sm:size-64", drift: "drift", v: "--blob-1" },
  { pos: "right-[6%] top-[16%] size-36 sm:size-52", drift: "drift-b", v: "--blob-2" },
  { pos: "bottom-[6%] left-[28%] size-52 sm:size-72", drift: "drift-c", v: "--blob-3" },
  { pos: "bottom-[32%] right-[22%] size-28 sm:size-40", drift: "drift-b", v: "--blob-4" },
] as const;

function Blob({ pos, drift, v }: (typeof BLOBS)[number]) {
  const style = {
    "--blob-bg": `var(${v})`,
    "--blob-shadow": `color-mix(in oklab, var(${v}) 45%, transparent)`,
  } as CSSProperties;
  return (
    <div aria-hidden style={style} className={`blob ${drift} absolute ${pos}`}>
      <span className="blob-spec" />
    </div>
  );
}

/** Vertical liquid-glass fader: drag the knob, click the track, arrow keys, or type a value. */
function Fader({
  channel,
  value,
  onChange,
}: {
  channel: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const accent = `--accent-${channel + 1}`;
  const accentStyle = {
    "--liquid": `var(${accent})`,
    "--glow": `color-mix(in oklab, var(${accent}) 30%, transparent)`,
    "--glow-strong": `color-mix(in oklab, var(${accent}) 55%, transparent)`,
  } as CSSProperties;

  const setFromClientY = useCallback(
    (clientY: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      // Knob center from 30px (top, value=127) to rect.height-30px (bottom, value=0)
      const minCenter = PAD + KNOB_HALF;
      const maxCenter = rect.height - minCenter;
      const center = Math.min(Math.max(clientY - rect.top, minCenter), maxCenter);
      const ratio = 1 - (center - minCenter) / (maxCenter - minCenter);
      onChange(Math.round(ratio * CC_MAX));
    },
    [onChange],
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => setFromClientY(e.clientY);
    const up = () => setDragging(false);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [dragging, setFromClientY]);

  const ratio = value / CC_MAX;

  return (
    <div className="flex flex-1 flex-col items-center gap-3">
      <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        Fader {channel + 1}
      </span>

      {/* Track + knob, vertical like a MIDI fader */}
      <div
        ref={trackRef}
        onMouseDown={(e) => {
          e.preventDefault();
          setDragging(true);
          setFromClientY(e.clientY);
        }}
        style={accentStyle}
        className="glass glass-edge relative h-64 w-16 touch-none rounded-full select-none sm:h-80"
      >
        {/* Slot */}
        <div className="absolute top-3 bottom-3 left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-foreground/10 shadow-inner" />
        {/* Liquid fill: bottom of track to knob center, with a breathing glow */}
        <div
          className={`liquid-fill absolute right-1/2 bottom-3 w-1.5 translate-x-1/2 rounded-full ${
            dragging ? "transition-none" : "transition-[height] duration-200 ease-out"
          }`}
          style={{
            height: `calc(${KNOB_HALF}rem + ${ratio} * (100% - ${TRAVEL}rem))`,
          }}
        />
        {/* Glossy liquid knob */}
        <div
          role="slider"
          aria-label={`Fader ${channel + 1}`}
          aria-valuemin={CC_MIN}
          aria-valuemax={CC_MAX}
          aria-valuenow={value}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowRight") {
              e.preventDefault();
              onChange(Math.min(CC_MAX, value + 1));
            }
            if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
              e.preventDefault();
              onChange(Math.max(CC_MIN, value - 1));
            }
          }}
          className={`liquid-knob absolute left-1/2 flex h-9 w-12 -translate-x-1/2 items-center justify-center rounded-full shadow-[0_6px_18px_oklch(0.3_0.05_250/0.28)] ${
            dragging ? "cursor-grabbing scale-105" : "cursor-grab"
          } ${dragging ? "" : "transition-[top,transform] duration-200 ease-out"}`}
          style={{
            top: `calc(${PAD}rem + ${1 - ratio} * (100% - ${TRAVEL}rem))`,
          }}
        >
          <div className="relative z-10 h-1 w-7 rounded-full bg-foreground/45" />
        </div>
      </div>

      <Input
        type="number"
        min={CC_MIN}
        max={CC_MAX}
        value={value}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(0);
            return;
          }
          const n = Number.parseInt(raw, 10);
          if (!Number.isNaN(n)) {
            onChange(Math.min(CC_MAX, Math.max(CC_MIN, n)));
          }
        }}
        style={accentStyle}
        className="glass w-20 rounded-full border-white/60 text-center font-semibold tabular-nums focus-visible:ring-[color-mix(in_oklab,var(--accent-1)_50%,transparent)] dark:border-white/15"
        aria-label={`Fader ${channel + 1} CC value`}
      />
    </div>
  );
}

/** Light/dark liquid-glass theme switch, persisted in localStorage. */
function ThemeToggle() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );

  const toggle = useCallback(() => {
    const next = !dark;
    setDark(next);
    const root = document.documentElement;
    root.classList.toggle("dark", next);
    localStorage.setItem("xul-theme", next ? "dark" : "light");
  }, [dark]);

  return (
    <motion.button
      type="button"
      onClick={toggle}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className="glass glass-edge squish flex size-9 items-center justify-center rounded-full text-foreground"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          key={dark ? "sun" : "moon"}
          initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="flex items-center justify-center"
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

export default function Studio() {
  const [cc, setCc] = useState([64, 64, 64]);
  const [sendState, setSendState] = useState<SendState>("idle");
  const [serialSupported, setSerialSupported] = useState(true);

  useEffect(() => {
    setSerialSupported(
      typeof navigator !== "undefined" && "serial" in navigator,
    );
  }, []);

  const setChannel = useCallback((index: number, v: number) => {
    setCc((prev) => prev.map((c, i) => (i === index ? v : c)));
  }, []);

  const payload = useMemo(() => JSON.stringify({ cc: [...cc] }), [cc]);

  const handleSend = useCallback(async () => {
    if (sendState === "sending") return;
    setSendState("sending");
    try {
      const port = await navigator.serial!.requestPort();
      await port.open({ baudRate: BAUD_RATE });
      const writer = port.writable.getWriter();
      await writer.write(new TextEncoder().encode(payload));
      writer.releaseLock();
      await port.close();
      setSendState("sent");
      toast.success("Settings sent to the controller");
      setTimeout(() => setSendState("idle"), 2000);
    } catch (error) {
      setSendState("idle");
      toast.error(
        "Couldn't reach the controller — make sure it's plugged in and try again.",
        {
          description: error instanceof Error ? error.message : undefined,
        },
      );
    }
  }, [payload, sendState]);

  const sent = sendState === "sent";

  return (
    <div className="glass-backdrop relative flex min-h-screen flex-col">
      {/* Floating liquid droplets */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        {BLOBS.map((b) => (
          <Blob key={b.v} {...b} />
        ))}
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-10">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
          className="glass glass-edge flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-[0_0_18px_var(--glow)] ring-1 ring-white/60 dark:ring-white/15">
              <SlidersVertical className="size-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">
                XUL Config
              </h1>
              <p className="text-xs text-muted-foreground">
                Three faders · MIDI CC over USB
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`glass gap-1.5 rounded-full border-white/60 px-3 py-1 text-[11px] font-medium ${
                serialSupported ? "text-glass" : "text-destructive"
              }`}
            >
              {serialSupported ? (
                <>
                  <Cable className="size-3 text-primary" /> Web Serial ready
                </>
              ) : (
                <>
                  <Unplug className="size-3" /> Web Serial unsupported
                </>
              )}
            </Badge>
            <ThemeToggle />
          </div>
        </motion.header>

        {/* Fader deck */}
        <motion.section
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 18, delay: 0.08 }}
          className="glass-strong glass-edge-strong mt-8 rounded-3xl p-6 sm:p-8"
        >
          <div className="mb-6">
            <h2 className="text-lg font-semibold tracking-tight">Fader deck</h2>
            <p className="text-xs text-muted-foreground">
              Drag a knob, click the track, or type a value from 0 to 127.
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-8 sm:flex-row">
            {[0, 1, 2].map((channel) => (
              <Fader
                key={channel}
                channel={channel}
                value={cc[channel]}
                onChange={(v) => setChannel(channel, v)}
              />
            ))}
          </div>

          {/* Send */}
          <div className="mt-8 flex flex-col items-center gap-3">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 24 }}
              className="w-full max-w-sm"
            >
              <Button
                size="lg"
                className="h-12 w-full rounded-full border-0 text-base shadow-[0_10px_32px_var(--glow-strong),inset_0_1px_0_oklch(1_0_0/35%)] [background-image:linear-gradient(135deg,var(--primary),var(--chart-3))]"
                disabled={!serialSupported || sendState === "sending"}
                onClick={handleSend}
              >
                {sendState === "sending" ? (
                  <>
                    <Loader2 className="size-4.5 animate-spin" /> Sending…
                  </>
                ) : sent ? (
                  <>
                    <Check className="size-4.5" /> Sent
                  </>
                ) : (
                  <>
                    <Cable className="size-4.5" /> Send to controller
                  </>
                )}
              </Button>
            </motion.div>

            {!serialSupported && (
              <p className="glass flex items-center gap-2 rounded-2xl px-4 py-2 text-center text-xs font-medium text-destructive">
                <TriangleAlert className="size-3.5 shrink-0" />
                This browser doesn't support Web Serial. Please use desktop
                Chrome, Edge or Opera.
              </p>
            )}
          </div>
        </motion.section>

        <footer className="mt-8 pb-4 text-center text-xs text-muted-foreground">
          Sends your three CC values to the controller over USB — nothing else.
        </footer>
      </main>
    </div>
  );
}
