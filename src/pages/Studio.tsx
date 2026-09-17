import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownToDot,
  Cable,
  Check,
  Loader2,
  RotateCcw,
  SlidersVertical,
  Unplug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const CC_MIN = 0;
const CC_MAX = 127;
const BAUD_RATE = 9600;

/** Vertical fader: drag the knob or click the track. Mirrors XUL-config. */
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

  const clamp = useCallback(
    (clientY: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const y = Math.min(Math.max(clientY - rect.top, 0), rect.height);
      onChange(Math.round((1 - y / rect.height) * CC_MAX));
    },
    [onChange],
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => clamp(e.clientY);
    const up = () => setDragging(false);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [dragging, clamp]);

  return (
    <div className="flex flex-1 flex-col items-center gap-3">
      <span className="text-[11px] font-medium tracking-widest text-muted-foreground uppercase">
        CC {channel + 1}
      </span>

      {/* Track + thumb, vertical like a MIDI fader */}
      <div
        ref={trackRef}
        onMouseDown={(e) => {
          e.preventDefault();
          setDragging(true);
          clamp(e.clientY);
        }}
        className="glass relative h-64 w-14 touch-none rounded-full select-none sm:h-80"
        style={{ cursor: dragging ? "grabbing" : "pointer" }}
      >
        {/* Slot */}
        <div className="absolute top-3 bottom-3 left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-foreground/10 shadow-inner" />
        {/* Fill below the thumb, up to knob center */}
        <div
          className="absolute right-1/2 bottom-3 w-1.5 translate-x-1/2 rounded-full bg-gradient-to-t from-primary/70 to-chart-2/80"
          style={{
            height: `calc(1.125rem + ${(value / CC_MAX) * 100}% - ${(value / CC_MAX) * 3.75}rem)`,
          }}
        />
        {/* Thumb */}
        <div
          role="slider"
          aria-label={`Fader CC ${channel + 1}`}
          aria-valuemin={CC_MIN}
          aria-valuemax={CC_MAX}
          aria-valuenow={value}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp")
              onChange(Math.min(CC_MAX, value + 1));
            if (e.key === "ArrowDown")
              onChange(Math.max(CC_MIN, value - 1));
          }}
          className={`absolute left-1/2 flex h-9 w-12 -translate-x-1/2 items-center justify-center rounded-lg glass-strong glass-edge-strong fader-grip transition-[top] duration-75 ${
            dragging ? "" : "transition-transform hover:scale-105"
          }`}
          style={{
            top: `calc(0.75rem + ${1 - value / CC_MAX} * (100% - 3.75rem))`,
          }}
        >
          <div className="h-4 w-8 rounded-sm bg-foreground/70" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-1">
        <Input
          type="number"
          min={CC_MIN}
          max={CC_MAX}
          value={value}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (!Number.isNaN(n)) onChange(Math.min(CC_MAX, Math.max(CC_MIN, n)));
            else if (e.target.value === "") onChange(0);
          }}
          className="glass w-20 rounded-xl border-white/60 text-center font-semibold tabular-nums"
          aria-label={`CC ${channel + 1} value`}
        />
        <span className="text-[10px] text-muted-foreground">0 – 127</span>
      </div>
    </div>
  );
}

type SendState = "idle" | "sending" | "sent";

export default function Studio() {
  const [cc, setCc] = useState([64, 64, 64]);
  const [sendState, setSendState] = useState<SendState>("idle");
  const [serialSupported, setSerialSupported] = useState(true);

  useEffect(() => {
    setSerialSupported(typeof navigator !== "undefined" && "serial" in navigator);
  }, []);

  const setChannel = useCallback((index: number, v: number) => {
    setCc((prev) => prev.map((c, i) => (i === index ? v : c)));
  }, []);

  const payload = useMemo(
    () => JSON.stringify({ cc: cc.map((v) => v) }),
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
      toast.success("Configuration sent to X.U.L");
      setTimeout(() => setSendState("idle"), 2000);
    } catch (error) {
      setSendState("idle");
      toast.error(
        "Failed to connect — make sure the controller is plugged in and try again.",
        { description: error instanceof Error ? error.message : undefined },
      );
    }
  }, [payload, sendState]);

  const handleReset = useCallback(() => setCc([0, 0, 0]), []);

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
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-white/50">
              <SlidersVertical className="size-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">
                X.U.L Config
              </h1>
              <p className="text-xs text-muted-foreground">
                Three fader channels · JSON over serial
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
            <Button variant="outline" size="sm" asChild className="glass rounded-xl">
              <Link to="/">Home</Link>
            </Button>
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
                Drag the knobs or type a value — positions stay in sync.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="glass gap-1.5 rounded-xl"
            >
              <RotateCcw className="size-3.5" /> Zero all
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

          {/* Payload preview */}
          <div className="mt-8 rounded-2xl border border-white/60 bg-white/35 px-5 py-4">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              <ArrowDownToDot className="size-3.5" /> Serial payload
            </div>
            <code className="text-sm font-semibold text-glass tabular-nums">
              {payload}
            </code>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Sent as text at {BAUD_RATE} baud.
            </p>
          </div>

          {/* Send */}
          <div className="mt-6 flex flex-col items-center gap-3">
            <Button
              size="lg"
              className="h-13 w-full max-w-sm rounded-2xl text-base shadow-xl shadow-primary/25"
              disabled={!serialSupported || sendState === "sending"}
              onClick={handleSend}
            >
              {sendState === "sending" ? (
                <>
                  <Loader2 className="size-4.5 animate-spin" /> Sending…
                </>
              ) : sendState === "sent" ? (
                <>
                  <Check className="size-4.5" /> Sent
                </>
              ) : (
                <>
                  <Cable className="size-4.5" /> Send to X.U.L
                </>
              )}
            </Button>

            {!serialSupported && (
              <p className="glass flex items-center gap-2 rounded-xl px-4 py-2 text-center text-xs font-medium text-destructive">
                <AlertTriangle className="size-3.5 shrink-0" />
                Web Serial API is not supported in this browser. Please use
                desktop Chrome, Edge or Opera.
              </p>
            )}
          </div>
        </motion.section>

        <footer className="mt-8 pb-4 text-center text-xs text-muted-foreground">
          Opens a serial port at 9600 baud, writes JSON, closes cleanly.
        </footer>
      </main>
    </div>
  );
}
