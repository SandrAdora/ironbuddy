import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Link } from 'react-router-dom';

const features = [
  {
    icon: '🦾',
    title: 'AI Coach',
    desc: 'Chat with your personal AI fitness coach 24/7. Get custom workout advice, nutrition tips, and motivation tailored to your goals and body.',
  },
  {
    icon: '💪',
    title: 'Workout Plans',
    desc: 'AI-generated training programs built around your equipment, experience level, and goals — from fat loss to muscle building.',
  },
  {
    icon: '🥗',
    title: 'Meal Plans',
    desc: 'Personalised weekly nutrition plans with step-by-step preparation instructions and ingredient scaling for any serving size.',
  },
  {
    icon: '📈',
    title: 'Progress Tracking',
    desc: 'Log your weight, track workout sessions, and visualise your gains with charts showing streaks, volume, and body trends.',
  },
  {
    icon: '💬',
    title: 'Community',
    desc: 'Connect with other athletes, share progress, send direct messages and react to posts — because every champion needs a crew.',
  },
  {
    icon: '🎬',
    title: 'Workout Videos',
    desc: 'Curated exercise video library so you always know exactly how to perform every movement safely and effectively.',
  },
];

const stats = [
  { value: '10+', label: 'AI Features' },
  { value: '∞', label: 'Workout Plans' },
  { value: '24/7', label: 'Coach Access' },
  { value: '100%', label: 'Personalised' },
];

const steps = [
  { step: '01', title: 'Create Your Profile', desc: 'Tell us your goal, experience level, equipment and dietary preferences.' },
  { step: '02', title: 'Get Your Plan', desc: 'Our AI builds a personalised workout and meal plan in seconds.' },
  { step: '03', title: 'Train & Track', desc: 'Log sessions, track weight, and watch your progress compound over time.' },
  { step: '04', title: 'Stay Connected', desc: 'Chat with your AI coach anytime and link up with the community.' },
];

function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function About() {
  return (
    <div className="min-h-screen bg-[--color-gym-dark] text-white overflow-x-hidden">

      {/* ── Hero ── */}
      <section className="relative pt-36 pb-24 px-6 flex flex-col items-center text-center overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-yellow-300/5 rounded-full blur-[120px] pointer-events-none" />

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-[--color-iron-gold] text-xs font-black tracking-[0.4em] uppercase mb-4"
        >
          Your AI Fitness Companion
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl md:text-7xl font-black uppercase italic leading-none mb-6"
        >
          About{' '}
          <span className="text-[--color-iron-gold] drop-shadow-[0_0_30px_rgba(250,204,21,0.5)]">
            Iron
          </span>
          Buddy
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-gray-400 text-lg max-w-2xl leading-relaxed"
        >
          IronBuddy is a next-generation fitness platform powered by AI. We combine smart coaching,
          personalised nutrition, and community to help every athlete — beginner or elite — unlock
          their full potential.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="mt-10 flex gap-4 flex-wrap justify-center"
        >
          <Link to="/signup"
            className="px-8 py-3 bg-yellow-300 !text-black font-black rounded-xl uppercase text-sm
              hover:bg-yellow-200 hover:scale-[1.03] active:scale-95 transition-all duration-200
              shadow-[0_0_30px_rgba(253,224,71,0.3)]"
          >
            Get Started
          </Link>
          <Link to="/contact"
            className="px-8 py-3 bg-white/5 border border-white/10 text-white font-black rounded-xl uppercase text-sm
              hover:bg-white/10 hover:border-white/20 active:scale-95 transition-all duration-200"
          >
            Contact Us
          </Link>
        </motion.div>
      </section>

      {/* ── Stats bar ── */}
      <FadeIn>
        <section className="border-y border-white/10 bg-white/3 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <p className="text-4xl font-black text-[--color-iron-gold]">{s.value}</p>
                <p className="text-gray-400 text-sm uppercase font-bold tracking-wide mt-1">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </section>
      </FadeIn>

      {/* ── Mission ── */}
      <section className="max-w-5xl mx-auto px-6 py-24 grid md:grid-cols-2 gap-16 items-center">
        <FadeIn>
          <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.4em] uppercase mb-3">Our Mission</p>
          <h2 className="text-4xl font-black uppercase italic leading-tight mb-6">
            Fitness for<br />
            <span className="text-[--color-iron-gold]">Everyone.</span>
          </h2>
          <p className="text-gray-400 leading-relaxed mb-4">
            We believe world-class fitness coaching shouldn't be reserved for people who can afford
            a personal trainer. IronBuddy puts an expert AI coach, a nutritionist, and a training
            partner in your pocket — completely free.
          </p>
          <p className="text-gray-400 leading-relaxed">
            Whether you're picking up a barbell for the first time or chasing a new PR, IRON adapts
            to where you are and builds a path to where you want to be.
          </p>
        </FadeIn>

        <FadeIn delay={0.15}>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: '🎯', text: 'Goal-driven plans' },
              { icon: '🧠', text: 'AI-powered advice' },
              { icon: '🔄', text: 'Adapts over time' },
              { icon: '🤝', text: 'Community support' },
            ].map((item) => (
              <div key={item.text}
                className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-2
                  hover:border-yellow-300/30 hover:bg-yellow-300/5 transition-all duration-300"
              >
                <span className="text-3xl">{item.icon}</span>
                <p className="text-sm font-bold text-white">{item.text}</p>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ── Features grid ── */}
      <section className="bg-white/3 border-y border-white/10 py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-16">
            <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.4em] uppercase mb-3">What's Inside</p>
            <h2 className="text-4xl font-black uppercase italic">Everything You Need</h2>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <FadeIn key={f.title} delay={i * 0.08}>
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 h-full
                  hover:border-yellow-300/30 hover:shadow-[0_0_30px_rgba(253,224,71,0.08)]
                  hover:-translate-y-1 transition-all duration-300 group">
                  <span className="text-4xl mb-4 block group-hover:scale-110 transition-transform duration-300">{f.icon}</span>
                  <h3 className="text-white font-black uppercase text-sm tracking-wide mb-2">{f.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="max-w-4xl mx-auto px-6 py-24">
        <FadeIn className="text-center mb-16">
          <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.4em] uppercase mb-3">Simple Process</p>
          <h2 className="text-4xl font-black uppercase italic">How It Works</h2>
        </FadeIn>

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 top-0 bottom-0 w-px bg-white/10 hidden md:block" />

          <div className="space-y-10">
            {steps.map((s, i) => (
              <FadeIn key={s.step} delay={i * 0.12}>
                <div className="flex gap-6 items-start">
                  <div className="w-12 h-12 rounded-full bg-yellow-300/10 border border-yellow-300/30 flex items-center justify-center shrink-0 z-10">
                    <span className="text-[--color-iron-gold] font-black text-xs">{s.step}</span>
                  </div>
                  <div className="pt-2">
                    <h3 className="text-white font-black uppercase text-sm tracking-wide mb-1">{s.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <FadeIn>
        <section className="px-6 pb-24">
          <div className="max-w-3xl mx-auto bg-gradient-to-br from-yellow-300/10 to-transparent border border-yellow-300/20
            rounded-3xl p-12 text-center shadow-[0_0_80px_rgba(253,224,71,0.08)]">
            <motion.span
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              className="text-6xl block mb-6"
            >
              🦾
            </motion.span>
            <h2 className="text-3xl font-black uppercase italic mb-4">
              Ready to Start Training?
            </h2>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              Join IronBuddy today and get a personalised AI workout plan, meal plan, and coach — all in one place.
            </p>
            <Link to="/signup"
              className="inline-block px-10 py-4 bg-yellow-300 !text-black font-black rounded-xl uppercase text-sm
                hover:bg-yellow-200 hover:scale-[1.03] active:scale-95 transition-all duration-200
                shadow-[0_0_40px_rgba(253,224,71,0.3)]"
            >
              Create Free Account
            </Link>
          </div>
        </section>
      </FadeIn>

    </div>
  );
}
