"use client";

import Link from "next/link";
// 🚀 Variants টাইপটি ইমপোর্ট করা হলো
import { motion, Variants } from "framer-motion"; 
import { 
  ArrowRight, Sparkles, School, BrainCircuit, LineChart, 
  ShieldCheck, Globe, Database, Cpu, MessageSquare, Zap
} from "lucide-react";

export default function LandingPage() {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  // 🚀 Explicitly typed as Variants to fix TypeScript errors
  const fadeUp: Variants = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
  };

  const staggerContainer: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white relative overflow-x-hidden selection:bg-purple-500/30 font-sans">
      
      {/* 🌟 Fixed Ambient Glows (Persists during scroll) */}
      <div className="fixed top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-600/15 blur-[150px] rounded-full pointer-events-none z-0" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-600/10 blur-[150px] rounded-full pointer-events-none z-0" />
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay pointer-events-none z-0"></div>

      {/* ================= HERO SECTION ================= */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 pt-20">
        <motion.div 
          initial="hidden" animate="visible" variants={staggerContainer}
          className="text-center max-w-4xl"
        >
          <motion.div variants={fadeUp} className="inline-flex items-center justify-center p-4 bg-white/5 border border-white/10 rounded-3xl mb-8 shadow-[0_0_30px_rgba(139,92,246,0.15)]">
            <School className="text-purple-400 w-12 h-12" />
          </motion.div>
          
          <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 bg-gradient-to-r from-purple-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent pb-2">
            SchoolOS Vision 2030
          </motion.h1>
          
          <motion.p variants={fadeUp} className="text-lg md:text-xl text-gray-400 mb-12 leading-relaxed max-w-2xl mx-auto">
            The AI-Native Education Operating System. Move beyond GPA-centric systems to discover potential, automate operations, and transform institutions with data-driven intelligence.
          </motion.p>
          
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login" className="flex items-center gap-2 bg-white text-black px-8 py-4 rounded-full font-bold hover:bg-gray-200 transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.3)]">
              Enter SchoolOS
              <ArrowRight size={18} />
            </Link>
            <button 
              onClick={() => scrollToSection('vision')}
              className="flex items-center gap-2 px-8 py-4 rounded-full font-bold border border-white/20 hover:bg-white/10 transition-all text-gray-300"
            >
              <BrainCircuit size={18} />
              Explore AI Vision
            </button>
          </motion.div>
        </motion.div>
      </section>

      {/* ================= THE JOURNEY & VISION ================= */}
      <section id="vision" className="relative z-10 py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeUp}
            className="mb-20 text-center"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-6">A Paradigm Shift in Education</h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">From traditional report cards to real-time competency profiling. SchoolOS acts as a Digital Twin for your entire institution.</p>
          </motion.div>

          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer}
            className="grid md:grid-cols-3 gap-6"
          >
            {/* Bento Box Grid */}
            <motion.div variants={fadeUp} className="md:col-span-2 bg-white/[0.03] border border-white/10 p-10 rounded-[2rem] backdrop-blur-md hover:bg-white/[0.05] transition-colors">
              <LineChart className="text-blue-400 w-10 h-10 mb-6" />
              <h3 className="text-2xl font-bold mb-3">Predictive Analytics</h3>
              <p className="text-gray-400 leading-relaxed">
                Analyze attendance drops, evaluate STEM logic vs Creativity, and predict student trajectories before the mid-terms even begin.
              </p>
            </motion.div>
            
            <motion.div variants={fadeUp} className="bg-white/[0.03] border border-white/10 p-10 rounded-[2rem] backdrop-blur-md hover:bg-white/[0.05] transition-colors">
              <ShieldCheck className="text-teal-400 w-10 h-10 mb-6" />
              <h3 className="text-2xl font-bold mb-3">Gov. Copilot</h3>
              <p className="text-gray-400 leading-relaxed">
                1-click payload generation mapped strictly to Bangladesh IPEMIS & NCTB standards.
              </p>
            </motion.div>

            <motion.div variants={fadeUp} className="bg-white/[0.03] border border-white/10 p-10 rounded-[2rem] backdrop-blur-md hover:bg-white/[0.05] transition-colors">
              <MessageSquare className="text-purple-400 w-10 h-10 mb-6" />
              <h3 className="text-2xl font-bold mb-3">Unified Inbox</h3>
              <p className="text-gray-400 leading-relaxed">
                Omni-channel routing from WhatsApp & Web directly to AI.
              </p>
            </motion.div>

            <motion.div variants={fadeUp} className="md:col-span-2 bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-white/10 p-10 rounded-[2rem] backdrop-blur-md overflow-hidden relative">
              <Sparkles className="absolute top-6 right-6 text-purple-400/50 w-24 h-24 blur-xl" />
              <BrainCircuit className="text-purple-400 w-10 h-10 mb-6 relative z-10" />
              <h3 className="text-2xl font-bold mb-3 relative z-10">AI Action Center (Human-in-the-Loop)</h3>
              <p className="text-gray-400 leading-relaxed max-w-xl relative z-10">
                SchoolOS AI drafts parent notices, flags high-risk behavioral patterns, and creates routines. But it executes nothing without Principal approval.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ================= TECH STACK ================= */}
      <section className="relative z-10 py-32 px-6 bg-black/40 border-t border-white/5">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <h2 className="text-3xl font-bold mb-16">Engineered for Scale</h2>
          </motion.div>
          
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer}
            className="flex flex-wrap justify-center gap-4 md:gap-8"
          >
            {[
              { name: "Next.js 15", icon: Globe },
              { name: "FastAPI", icon: Zap },
              { name: "PostgreSQL", icon: Database },
              { name: "Gemini 2.5 Flash", icon: Cpu },
              { name: "Event Architecture", icon: BrainCircuit }
            ].map((tech, idx) => (
              <motion.div 
                key={idx} variants={fadeUp}
                className="flex items-center gap-3 px-6 py-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm"
              >
                <tech.icon className="text-gray-400" size={20} />
                <span className="font-semibold text-gray-200">{tech.name}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ================= CTA FOOTER ================= */}
      <section className="relative z-10 py-32 px-6 text-center">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="max-w-2xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to upgrade your institution?</h2>
          <p className="text-gray-400 mb-10">Join the closed beta of SchoolOS Vision 2030 and experience the true power of an AI-Native campus.</p>
          <Link href="/login" className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-10 py-5 rounded-full font-bold text-lg hover:shadow-[0_0_40px_rgba(139,92,246,0.4)] transition-all hover:scale-105 active:scale-95">
            Initialize Dashboard
            <ArrowRight size={20} />
          </Link>
        </motion.div>
      </section>

    </div>
  );
}