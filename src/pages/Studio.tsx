import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Cable,
  Check,
  Loader2,
  Moon,
  RotateCcw,
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

/** Vertical glass fader: drag the knob, click the track, arrow keys, or type a value. */
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

  const setFromClientY = useCallback(
    (clientY: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      // Knob center from 30px (top, value=127) to rect.height-30px (bottom, value=0)
      const minCenter = PAD + KNOB_HALF; // 30px in rem->px terms handled below
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
        className="glass glass-edge relative h-64 w-16 touch-none rounded-full select-none sm:h-80"
        style={{ cursor: dragging ? "grabbing" : "pointer" }}
      >
        {/* Slot */}
        <div className="absolute top-3 bottom-3 left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-foreground/10 shadow-inner" />
        {/* Fill: bottom of track to knob center */}
        <div
          className="absolute right-1/2 bottom-3 w-1.5 translate-x-1/2 rounded-full bg-gradient-to-t from-primary/70 to-chart-2/80 transition-[height] duration-75"
          style={{
            height: `calc(${KNOB_HALF}rem + ${ratio} * (100% - ${TRAVEL}rem))`,
          }}
        />
        {/* Knob */}
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
          className={`absolute left-1/2 flex h-9 w-12 -translate-x-1/2 items-center justify-center rounded-xl glass-strong glass-edge-strong fader-grip ${
            dragging ? "cursor-grabbing scale-105" : "cursor-grab"
          }`}
          style={{
            top: `calc(${PAD}rem + ${1 - ratio} * (100% - ${TRAVEL}rem))`,
          }}
        >
          <div className="h-4 w-8 rounded-sm bg-foreground/70" />
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
        className="glass w-20 rounded-xl border-white/60 text-center font-semibold tabular-nums"
        aria-label={`Fader ${channel + 1} CC value`}
      />
    </div>
  );
}

/** Light/dark glass theme switch, persisted in localStorage. */
function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      localStorage.getItem("xul-theme") === "dark" ||
      (localStorage.getItem("xul-theme") === null &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    );
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("xul-theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setDark((d) => !d)}
      className="glass rounded-xl"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
    </Button>
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

  const payload = useMemo(
    () => JSON.stringify({ cc: [...cc] }),
    [cc],
  );

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
      setCc([0, 0, 0]);
    } catch (error) {
      setSendState("idle");
      toast.error(
        "Couldn't reach the controller — make sure it's plugged in and try again.",
        {
          description:
            error instanceof Error ? error.message : undefined,
        },
      );
    }
  }, [payload, sendState]);

  const handleReset = useCallback(() => setCc([0, 0, 0]), []);

  const sent = sendState === "sent";

  return (
    <div className="glass-backdrop flex min-h-screen flex-col">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-10">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass glass-edge flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-white/50 dark:ring-white/15">
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
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="glass-strong glass-edge-strong mt-8 rounded-3xl p-6 sm:p-8"
        >
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Fader deck
              </h2>
              <p className="text-xs text-muted-foreground">
                Drag a knob, click the track, or type a value from 0 to 127.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="glass gap-1.5 rounded-xl"
            >
              <RotateCcw className="size-3.5" /> Reset
            </Button>
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
            <Button
              size="lg"
              className="h-12 w-full max-w-sm rounded-2xl text-base shadow-xl shadow-primary/25"
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

            {!serialSupported && (
              <p className="glass flex items-center gap-2 rounded-xl px-4 py-2 text-center text-xs font-medium text-destructive">
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
