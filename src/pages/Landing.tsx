import { motion } from "framer-motion";
import { Cable, SlidersVertical, Sparkles, Usb, Waves } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

const features = [
  {
    icon: SlidersVertical,
    title: "Three faders",
    description:
      "Drag the glass faders or type exact CC values from 0 to 127. Positions sync instantly, both ways.",
  },
  {
    icon: Cable,
    title: "JSON over serial",
    description:
      "One click writes {\"cc\": [.., .., ..]} to your controller at 9600 baud over Web Serial.",
  },
  {
    icon: Usb,
    title: "No install",
    description:
      "Runs in any Chromium browser. Plug in the X.U.L, open the studio, press send.",
  },
];

export default function Landing() {
  return (
    <div className="glass-backdrop min-h-screen overflow-x-clip">
      <div className="mx-auto flex w-full max-w-5xl flex-col px-6 py-10">
        {/* Nav */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass glass-edge flex items-center justify-between rounded-2xl px-5 py-3"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-white/50">
              <Waves className="size-4.5" />
            </div>
            <span className="text-sm font-semibold tracking-tight">
              X.U.L Config
            </span>
          </div>          <Button asChild size="sm" className="rounded-xl shadow-lg shadow-primary/20">
            <Link to="/studio">Open studio</Link>
          </Button>
        </motion.header>

        {/* Hero */}
        <motion.section
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.08 }}
          className="mt-14 flex flex-col items-center text-center"
        >
          <Badge
            variant="outline"
            className="glass gap-1.5 rounded-full border-white/60 px-3.5 py-1 text-xs font-medium text-glass"
          >
            <Sparkles className="size-3.5 text-primary" />
            Web Serial · MIDI CC over USB
          </Badge>

          <h1 className="mt-6 max-w-2xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Set your CCs.{" "}
            <span className="bg-gradient-to-r from-primary via-chart-2 to-chart-3 bg-clip-text text-transparent">
              Send them to the faders.
            </span>
          </h1>

          <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">
            A minimal configurator for the X.U.L MIDI controller — three fader
            channels, exact CC values, one JSON payload straight to the Arduino.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-2xl px-7 text-base shadow-xl shadow-primary/25"
            >
              <Link to="/studio">Start configuring</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="glass h-12 rounded-2xl px-7 text-base"
            >
              <a
                href="https://github.com/NeoArchCat7/XUL-config"
                target="_blank"
                rel="noreferrer"
              >
                Reference project
              </a>
            </Button>
          </div>
        </motion.section>

        {/* Feature glass cards */}
        <motion.section
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.18 }}
          className="mt-16 grid gap-5 sm:grid-cols-3"
        >
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="glass glass-edge rounded-2xl p-6 transition-transform duration-300 hover:-translate-y-1"
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-white/50">
                <Icon className="size-5" />
              </div>
              <h3 className="mt-4 text-sm font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            </div>
          ))}
        </motion.section>

        {/* Footer */}
        <footer className="mt-16 pb-6 text-center text-xs text-muted-foreground">
          Works with Chrome, Edge and Opera on desktop — Web Serial required.
        </footer>
      </div>
    </div>
  );
}
