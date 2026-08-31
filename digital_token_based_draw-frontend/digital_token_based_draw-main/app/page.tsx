"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { IconDiamond, IconShieldLock, IconBolt } from "@tabler/icons-react";

const featureIcons = {
  diamond: IconDiamond,
  "shield-lock": IconShieldLock,
  bolt: IconBolt,
} as const;

export default function Home() {
  const router = useRouter();

  const features = [
    {
      icon: "diamond",
      title: "Transparent Draws",
      description:
        "Fully transparent, blockchain-auditable random selection process",
      iconColor: "text-cyan-400",
      iconBackground: "bg-cyan-400/10",
      borderColor: "border-cyan-400/20",
      hoverBorder: "hover:border-cyan-400/50",
      hoverBackground: "hover:bg-cyan-400/5",
    },
    {
      icon: "shield-lock",
      title: "Secure & Verified",
      description:
        "Multi-factor authentication and identity verification for all users",
      iconColor: "text-emerald-400",
      iconBackground: "bg-emerald-400/10",
      borderColor: "border-emerald-400/20",
      hoverBorder: "hover:border-emerald-400/50",
      hoverBackground: "hover:bg-emerald-400/5",
    },
    {
      icon: "bolt",
      title: "Real-time Results",
      description: "Instant winner notification and result transparency",
      iconColor: "text-amber-400",
      iconBackground: "bg-amber-400/10",
      borderColor: "border-amber-400/20",
      hoverBorder: "hover:border-amber-400/50",
      hoverBackground: "hover:bg-amber-400/5",
    },
  ];

  const heroCards = [
    {
      iconColor: "text-cyan-400",
      backgroundColor: "bg-cyan-400/10",
      borderColor: "border-cyan-400/30",
      hoverBorder: "hover:border-cyan-400/60",
      hoverBackground: "hover:bg-cyan-400/15",
      shadow: "hover:shadow-cyan-400/10",
    },
    {
      iconColor: "text-violet-400",
      backgroundColor: "bg-violet-400/10",
      borderColor: "border-violet-400/30",
      hoverBorder: "hover:border-violet-400/60",
      hoverBackground: "hover:bg-violet-400/15",
      shadow: "hover:shadow-violet-400/10",
    },
    {
      iconColor: "text-rose-400",
      backgroundColor: "bg-rose-400/10",
      borderColor: "border-rose-400/30",
      hoverBorder: "hover:border-rose-400/60",
      hoverBackground: "hover:bg-rose-400/15",
      shadow: "hover:shadow-rose-400/10",
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" as const },
    },
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-primary/10 bg-background/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="font-mono font-bold text-lg text-primary">DRAW</div>

          <div className="flex gap-4">
            <Button
              variant="ghost"
              onClick={() => router.push("/auth")}
              className="text-foreground hover:text-primary"
            >
              Sign In
            </Button>

            <Button
              onClick={() => router.push("/auth")}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <motion.section
        className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <motion.div className="text-center space-y-6" variants={itemVariants}>
          <h1 className="text-5xl sm:text-6xl font-bold text-balance leading-tight">
            Fair & Transparent{" "}
            <span className="text-primary">Digital Draws</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Enterprise-grade draw management with complete transparency,
            multi-factor security, and real-time winner verification. Perfect
            for lotteries, raffles, and giveaways.
          </p>

          <div className="flex gap-4 justify-center pt-4">
            <Button
              onClick={() => router.push("/auth")}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-3 text-lg"
            >
              Join as Participant
            </Button>

            <Button
              variant="outline"
              onClick={() => router.push("/auth")}
              className="border-primary/30 hover:bg-primary/10 px-8 py-3 text-lg"
            >
              Run a Draw
            </Button>
          </div>
        </motion.div>

        {/* Hero Visual */}
        <motion.div
          className="mt-16 grid grid-cols-3 gap-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {heroCards.map((card, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className={`
                h-32 rounded border backdrop-blur
                flex items-center justify-center
                transition-all duration-300
                hover:-translate-y-1
                hover:shadow-lg
                ${card.backgroundColor}
                ${card.borderColor}
                ${card.hoverBorder}
                ${card.hoverBackground}
                ${card.shadow}
              `}
            >
              <div
                className={`
                  flex items-center justify-center
                  w-14 h-14 rounded-full
                  bg-background/30
                  ${card.iconColor}
                `}
              >
                <IconDiamond size={32} stroke={1.5} />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.section>

      {/* Features Section */}
      <motion.section
        className="py-20 px-4 sm:px-6 lg:px-8 border-t border-primary/10"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={containerVariants}
      >
        <div className="max-w-7xl mx-auto">
          <motion.h2
            className="text-4xl font-bold text-center mb-16 text-balance"
            variants={itemVariants}
          >
            Built for Trust & Scale
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, idx) => {
              const IconComponent =
                featureIcons[feature.icon as keyof typeof featureIcons];

              return (
                <motion.div
                  key={idx}
                  className={`
                    p-6 rounded-lg border bg-card/50 backdrop-blur
                    transition-all duration-300
                    hover:-translate-y-1
                    hover:shadow-lg
                    ${feature.borderColor}
                    ${feature.hoverBorder}
                    ${feature.hoverBackground}
                  `}
                  variants={itemVariants}
                >
                  <div
                    className={`
                      mb-4 w-12 h-12 rounded-lg
                      flex items-center justify-center
                      ${feature.iconColor}
                      ${feature.iconBackground}
                    `}
                  >
                    <IconComponent size={30} stroke={1.5} />
                  </div>

                  <h3 className="text-xl font-bold text-foreground mb-2">
                    {feature.title}
                  </h3>

                  <p className="text-muted-foreground">{feature.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.section>

      {/* CTA Section */}
      <motion.section
        className="py-20 px-4 sm:px-6 lg:px-8"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={containerVariants}
      >
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <motion.h2 className="text-4xl font-bold" variants={itemVariants}>
            Ready to Get Started?
          </motion.h2>

          <motion.p
            className="text-lg text-muted-foreground"
            variants={itemVariants}
          >
            Create your account in minutes and join thousands of users running
            transparent draws.
          </motion.p>

          <motion.div variants={itemVariants} className="pt-4">
            <Button
              onClick={() => router.push("/auth")}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-3 text-lg"
            >
              Sign Up Now
            </Button>
          </motion.div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="border-t border-primary/10 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center text-sm text-muted-foreground">
          <p>Digital Draw System &copy; 2026. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
