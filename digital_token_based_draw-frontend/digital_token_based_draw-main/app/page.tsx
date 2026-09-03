"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  IconTicket,
  IconMenu,
  IconX,
  IconStar,
  IconCheck,
  IconArrowRight,
  IconMicrophone,
  IconBuildingStore,
  IconHeartHandshake,
  IconBuilding,
  IconTrophy,
  IconSchool,
  IconBolt,
  IconShieldLock,
  IconSettings,
  IconDiamond,
  IconPigMoney,
  IconCreditCard,
  IconMail,
  IconVideo,
  IconTag,
  IconQrcode,
  IconLink,
  IconSparkles,
  IconPencil,
  IconBell,
  IconPlayerPlay,
  IconChevronRight,
  type TablerIconsProps,
} from "@tabler/icons-react";
import type { ComponentType } from "react";

// ─── Data ────────────────────────────────────────────────────────────────────

const whoUses = [
  { icon: IconMicrophone, title: "Content Creators", desc: "Raffle exclusive prizes and monetise the craft you already love." },
  { icon: IconBuildingStore, title: "Brands", desc: "Run engaging prize draws that drive sales and brand loyalty." },
  { icon: IconHeartHandshake, title: "Charities", desc: "Raise vital funds with raffles supporters are excited to enter." },
  { icon: IconBuilding, title: "Businesses", desc: "Turn everyday prizes and experiences into new revenue streams." },
  { icon: IconTrophy, title: "Sports Clubs", desc: "Raffle signed kit and match access for fans and members." },
  { icon: IconSchool, title: "Schools", desc: "Fund projects with community raffles that bring people together." },
];

const whyChoose = [
  {
    icon: IconBolt,
    color: "text-primary",
    bg: "bg-primary/10",
    title: "Excitement That Engages Your Audience",
    desc: "Create thrilling experiences by offering unique prizes that get your audience excited, engaged, and eager to participate.",
  },
  {
    icon: IconShieldLock,
    color: "text-[#288C1D]",
    bg: "bg-[#3bb82e]/10",
    title: "Credibility You Can Count On",
    desc: "Build trust with independent, cryptographically sealed draws, verified winners, and full transparency at every step.",
  },
  {
    icon: IconSettings,
    color: "text-violet-600",
    bg: "bg-violet-500/10",
    title: "Tools That Make Hosting Simple",
    desc: "From one-click setup to built-in promotional tools, everything you need to run successful draws effortlessly.",
  },
];

const stats = [
  { icon: IconTicket, label: "Raffles hosted", target: 40000, format: (v: number) => `${(v / 1000).toFixed(0)}K+` },
  { icon: IconTrophy, label: "Prizes won", target: 114000, format: (v: number) => `${(v / 1000).toFixed(0)}K+` },
  { icon: IconPigMoney, label: "Revenue generated", target: 41, prefix: "£", suffix: "M+", format: (v: number) => `£${v}M+` },
  { icon: IconStar, label: "Trusted users", target: 6, suffix: "M+", format: (v: number) => `${v}M+` },
];

const tools = [
  { icon: IconCreditCard, title: "Payments", desc: "Simple, risk-free payments portal that holds ticket revenue safely." },
  { icon: IconTicket, title: "Ticket Issuing", desc: "Process tokens and tickets in real time to every winner." },
  { icon: IconMail, title: "Email Invites", desc: "Create and send unlimited campaigns that reach your contacts." },
  { icon: IconVideo, title: "Live Stream", desc: "Build trust and deeper connections by streaming your draw live." },
  { icon: IconTag, title: "Promo Codes", desc: "Boost participation with promo codes that reward invitees." },
  { icon: IconQrcode, title: "QR Codes", desc: "Generate customizable QR prints for posters, social media, or events." },
  { icon: IconLink, title: "Affiliate Sales", desc: "Set affiliate controls and expand the reach of your raffle." },
  { icon: IconSparkles, title: "More Every Day", desc: "A complete toolset, extended constantly for your success." },
];

const steps = [
  {
    icon: IconPencil,
    title: "Create Your Raffle",
    desc: "Pick a prize, set a token price, and launch in minutes with our guided setup.",
  },
  {
    icon: IconBell,
    title: "Sell Tokens & Promote",
    desc: "Share your draw, generate QR codes, and send invites to your entire audience.",
  },
  {
    icon: IconPlayerPlay,
    title: "Draw & Award Winners",
    desc: "Our independent draw picks winners fairly and notifies everyone in real time.",
  },
];

// ─── Helpers / Sub-components ────────────────────────────────────────────────

function useCountUp(target: number, active: boolean, duration = 1.6) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);
  return value;
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="max-w-2xl mx-auto text-center space-y-3 mb-14">
      <p className="text-sm font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>
      <h2 className="text-3xl sm:text-4xl font-bold text-foreground text-balance">{title}</h2>
      {subtitle && <p className="text-muted-foreground text-lg">{subtitle}</p>}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();

  const [mobileOpen, setMobileOpen] = useState(false);

  const statsRef = useRef<HTMLDivElement>(null);
  const statsInView = useInView(statsRef, { once: true, margin: "-80px" });

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ── Navigation ── */}
      <header className="fixed top-0 w-full z-50 border-b border-primary/10 bg-white/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <button onClick={() => router.push("/")} className="flex items-center gap-2.5 shrink-0">
            <span className="w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center shadow-sm">
              <IconTicket size={20} stroke={1.8} />
            </span>
            <span className="font-bold text-lg tracking-tight text-foreground">
              Digital<span className="text-primary">Draws</span>
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-foreground/80">
            <a href="#for-hosts" className="hover:text-primary transition-colors">For Hosts</a>
            <a href="#for-entrants" className="hover:text-primary transition-colors">For Entrants</a>
            <a href="#tools" className="hover:text-primary transition-colors">Features</a>
            <a href="#how" className="hover:text-primary transition-colors">How It Works</a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" className="text-foreground hover:text-primary" onClick={() => router.push("/auth")}>
              Sign In
            </Button>
            <Button
              className="bg-[#3bb82e] text-white hover:bg-[#288C1D] rounded-full shadow-sm"
              onClick={() => router.push("/auth")}
            >
              Get Started <IconArrowRight size={16} stroke={2} />
            </Button>
          </div>

          <button className="md:hidden text-foreground p-2" onClick={() => setMobileOpen(o => !o)} aria-label="Menu">
            {mobileOpen ? <IconX size={24} stroke={1.5} /> : <IconMenu size={24} stroke={1.5} />}
          </button>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-t border-primary/10 overflow-hidden"
            >
              <div className="px-6 py-4 flex flex-col gap-4 text-sm font-medium">
                {[
                  { label: "For Hosts", href: "#for-hosts" },
                  { label: "For Entrants", href: "#for-entrants" },
                  { label: "Features", href: "#tools" },
                  { label: "How It Works", href: "#how" },
                ].map(l => (
                  <a key={l.label} href={l.href} onClick={() => setMobileOpen(false)} className="text-foreground/80 hover:text-primary transition-colors">
                    {l.label}
                  </a>
                ))}
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => router.push("/auth")}>Sign In</Button>
                  <Button className="flex-1 bg-[#3bb82e] text-white hover:bg-[#288C1D] rounded-full" onClick={() => router.push("/auth")}>Get Started</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Hero ── */}
      <section id="for-hosts" className="relative overflow-hidden bg-slate-200">
        {/* Background video — casino play loop */}
        <div className="absolute inset-0">
          <video
            autoPlay
            muted
            loop
            playsInline
            disablePictureInPicture
            className="h-full w-full object-cover"
            poster="/placeholder-logo.svg"
          >
            <source src="/casino-people.mp4" type="video/mp4" />
          </video>
          {/* Soft neutral overlay keeps white text readable while letting the video show through */}
          <div className="absolute inset-0 bg-slate-500/35" />
          <div className="absolute right-0 top-1/4 w-[600px] h-[600px] rounded-full bg-white/5 blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-28 text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="space-y-7"
          >
            <div className="inline-flex items-center gap-2 bg-white/15 border border-white/25 rounded-full px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-sm shadow-sm mx-auto">
              <IconStar size={14} stroke={2} className="text-amber-300" />
              Trusted by 6 Million+ users worldwide
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.08] text-balance text-white">
              Host Raffles That Give Back to{" "}
              <span className="text-white/90">Fans</span> and Help You{" "}
              <span className="text-amber-300">Earn</span>
            </h1>

            <p className="text-lg text-white/85 max-w-2xl mx-auto">
              Whether you're raising funds as a creator, engaging fans as a brand, or
              rallying supporters for a cause — Digital Draws runs fair, secure,
              token-based raffles that turn excitement into real results.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button
                className="bg-white text-[#288C1D] hover:bg-white/90 px-8 py-3.5 text-base rounded-full shadow-lg"
                onClick={() => router.push("/auth")}
              >
                Start a Raffle Today <IconArrowRight size={18} stroke={2} />
              </Button>
              <Button
                variant="outline"
                className="px-8 py-3.5 text-base rounded-full border-white/50 text-white hover:bg-white/10"
                onClick={() => router.push("/auth")}
              >
                Join as Participant
              </Button>
            </div>

            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {["Independent Draws", "Token-Based Entry", "Real-Time Results"].map(f => (
                <span key={f} className="inline-flex items-center gap-1.5 text-xs text-white/90 bg-white/15 border border-white/20 rounded-full px-3 py-1.5 backdrop-blur-sm">
                  <IconCheck size={12} stroke={2.5} /> {f}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Trusted by logo strip ── */}
      <section className="border-y border-primary/10 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-6">
            Hosting Raffles for people at
          </p>
          <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-4">
            {[
              { icon: IconMicrophone, label: "Creators" },
              { icon: IconBuildingStore, label: "Brands" },
              { icon: IconHeartHandshake, label: "Charities" },
              { icon: IconTrophy, label: "Clubs" },
              { icon: IconSchool, label: "Schools" },
              { icon: IconBuilding, label: "Businesses" },
            ].map(({ icon: Ic, label }) => (
              <div key={label} className="flex items-center gap-2 text-foreground/50">
                <Ic size={20} stroke={1.5} />
                <span className="font-semibold text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who Uses Digital Draws ── */}
      <section id="for-entrants" className="py-20 px-4 sm:px-6 lg:px-8 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <SectionHeading
            eyebrow="Who Uses Digital Draws"
            title="From Creators to Charities, Everyone Runs Raffles"
            subtitle="Whether you're hosting for fun, profit, or fundraising, anyone can run fair, secure, and profitable prize draws."
          />
          <div className="marquee-mask">
            <div className="marquee-track gap-6 pr-6">
              {[...whoUses, ...whoUses].map((c, i) => (
                <div
                  key={`${c.title}-${i}`}
                  className="group bg-white rounded-2xl border border-primary/10 hover:border-primary/40 hover:shadow-xl transition-all duration-300 w-80 min-h-[300px] shrink-0 flex flex-col items-start justify-center p-8"
                >
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    <c.icon size={28} stroke={1.6} />
                  </div>
                  <h3 className="font-semibold text-foreground text-xl mb-2">{c.title}</h3>
                  <p className="text-base text-muted-foreground leading-relaxed">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <SectionHeading
            eyebrow="How It Works"
            title="Go Live in Three Simple Steps"
            subtitle="No technical skills required — launch your first draw in under five minutes."
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {steps.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: i * 0.12 }}
                className="relative text-center space-y-4"
              >
                <div className="relative inline-flex">
                  <div className="w-16 h-16 rounded-2xl bg-[#3bb82e] text-white flex items-center justify-center shadow-lg">
                    <s.icon size={28} stroke={1.6} />
                  </div>
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-foreground text-white text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>
                <h3 className="font-bold text-foreground text-lg">{s.title}</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">{s.desc}</p>
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[calc(50%+3.5rem)] w-[calc(100%-7rem)] text-primary/50">
                    <IconChevronRight size={24} stroke={2} className="mx-auto" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Choose ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#f2f9f1]">
        <div className="max-w-7xl mx-auto">
          <SectionHeading
            eyebrow="Why Hosts Choose Digital Draws"
            title="Built for Trust, Engagement, and Simplicity"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {whyChoose.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: i * 0.1 }}
                className="bg-white rounded-2xl border border-primary/10 p-8 hover:border-primary/40 hover:shadow-xl transition-all duration-300"
              >
                <div className={`w-14 h-14 rounded-2xl ${f.bg} ${f.color} flex items-center justify-center mb-5`}>
                  <f.icon size={28} stroke={1.6} />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2.5 text-balance">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="relative overflow-hidden py-20 px-4 sm:px-6 lg:px-8 bg-slate-200 text-white">
        <div className="absolute inset-0">
          <video autoPlay muted loop playsInline disablePictureInPicture className="h-full w-full object-cover" poster="/placeholder-logo.svg">
            <source src="/casino-people.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-slate-500/45" />
        </div>
        <div ref={statsRef} className="relative max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map(s => (
            <StatCard key={s.label} icon={s.icon} label={s.label} target={s.target} format={s.format} active={statsInView} />
          ))}
        </div>
      </section>

      {/* ── Tools ── */}
      <section id="tools" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <SectionHeading
            eyebrow="Tools Built for Results"
            title="Everything You Need to Succeed"
            subtitle="A complete toolkit designed to make hosting simple and selling effortless."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {tools.map((t, i) => (
              <motion.div
                key={t.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.4, delay: (i % 4) * 0.07 }}
                className="group bg-white rounded-2xl border border-primary/10 p-6 hover:border-primary/40 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
                  <t.icon size={22} stroke={1.6} />
                </div>
                <h3 className="font-semibold text-foreground mb-1">{t.title}</h3>
                <p className="text-sm text-muted-foreground">{t.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto rounded-3xl bg-[#3bb82e] p-12 sm:p-16 text-center text-white shadow-2xl relative overflow-hidden"
        >
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-black/10 blur-2xl" />
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-balance relative">
            Ready to Host Your First Raffle?
          </h2>
          <p className="text-white/85 text-lg mb-9 relative">
            Join millions of hosts and entrants who trust Digital Draws for fair, secure, and exciting competitions.
          </p>
          <div className="flex flex-wrap justify-center gap-4 relative">
            <Button
              className="bg-white text-primary hover:bg-white/90 px-9 py-3.5 text-base rounded-xl shadow-lg font-semibold"
              onClick={() => router.push("/auth")}
            >
              Start Hosting Today <IconArrowRight size={18} stroke={2} />
            </Button>
            <Button
              variant="outline"
              className="px-9 py-3.5 text-base rounded-xl border-white/40 text-white hover:bg-white/10"
              onClick={() => router.push("/auth")}
            >
              Learn How It Works
            </Button>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-foreground text-white/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 pb-10 border-b border-white/10">
            <div className="col-span-2 md:col-span-1 space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center">
                  <IconTicket size={20} stroke={1.8} />
                </span>
                <span className="font-bold text-lg text-white">Digital<span className="text-primary">Draws</span></span>
              </div>
              <p className="text-sm text-white/50 max-w-xs">
                The fairest way to run raffles, giveaways, and sweepstakes — powered by independent, token-based draws.
              </p>
            </div>
            {[
              {
                title: "Product",
                links: ["Features", "Pricing", "How It Works", "Success Toolkit"],
              },
              {
                title: "Company",
                links: ["About Us", "Success Stories", "Careers", "Contact"],
              },
              {
                title: "Legal",
                links: ["Terms of Service", "Privacy Policy", "Responsible Play", "Cookie Policy"],
              },
            ].map(col => (
              <div key={col.title}>
                <p className="text-white font-semibold mb-4">{col.title}</p>
                <ul className="space-y-2.5 text-sm">
                  {col.links.map(l => (
                    <li key={l}>
                      <a className="text-white/50 hover:text-primary transition-colors cursor-pointer">{l}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8">
            <p className="text-xs text-white/40">
              Digital Draw System &copy; 2026. All rights reserved.
            </p>
            <div className="flex items-center gap-3 text-xs text-white/50">
              <span className="inline-flex items-center gap-1.5">
                <IconShieldLock size={14} stroke={1.6} /> Independent & Secure
              </span>
              <span className="inline-flex items-center gap-1.5">
                <IconCheck size={14} stroke={2} /> Fair Draw Guarantee
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  target,
  format,
  active,
}: {
  icon: ComponentType<TablerIconsProps>;
  label: string;
  target: number;
  format: (v: number) => string;
  active: boolean;
}) {
  const value = useCountUp(target, active);
  return (
    <div className="space-y-2">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center">
        <Icon size={26} stroke={1.6} />
      </div>
      <p className="text-3xl sm:text-4xl font-bold text-white">{format(value)}</p>
      <p className="text-sm text-white/75">{label}</p>
    </div>
  );
}