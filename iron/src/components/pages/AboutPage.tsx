import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();

  const stats = [
    { value: '10+', label: t('about.stats.features') },
    { value: '∞',   label: t('about.stats.plans') },
    { value: '24/7', label: t('about.stats.access') },
    { value: '100%', label: t('about.stats.personalised') },
  ];

  const features = [
    { icon: '🦾', title: t('about.features.ai_coach_title'),  desc: t('about.features.ai_coach_desc') },
    { icon: '💪', title: t('about.features.workouts_title'),  desc: t('about.features.workouts_desc') },
    { icon: '🥗', title: t('about.features.meals_title'),     desc: t('about.features.meals_desc') },
    { icon: '📈', title: t('about.features.progress_title'),  desc: t('about.features.progress_desc') },
    { icon: '💬', title: t('about.features.community_title'), desc: t('about.features.community_desc') },
    { icon: '🎬', title: t('about.features.videos_title'),    desc: t('about.features.videos_desc') },
  ];

  const missionCards = [
    { icon: '🎯', text: t('about.mission_cards.goals') },
    { icon: '🧠', text: t('about.mission_cards.ai') },
    { icon: '🔄', text: t('about.mission_cards.adapts') },
    { icon: '🤝', text: t('about.mission_cards.community') },
  ];

  const steps = [
    { step: '01', title: t('about.steps.s1_title'), desc: t('about.steps.s1_desc') },
    { step: '02', title: t('about.steps.s2_title'), desc: t('about.steps.s2_desc') },
    { step: '03', title: t('about.steps.s3_title'), desc: t('about.steps.s3_desc') },
    { step: '04', title: t('about.steps.s4_title'), desc: t('about.steps.s4_desc') },
  ];

  return (
    <div className="min-h-screen bg-[--color-gym-dark] text-white overflow-x-hidden">

      {/* ── Hero ── */}
      <section className="relative pt-36 pb-24 px-6 flex flex-col items-center text-center overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-yellow-300/5 rounded-full blur-[120px] pointer-events-none" />

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-[--color-iron-gold] text-xs font-black tracking-[0.4em] uppercase mb-4"
        >
          {t('about.badge')}
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl md:text-7xl font-black uppercase italic leading-none mb-6"
        >
          {t('about.title_pre')}
          <span className="text-[--color-iron-gold] drop-shadow-[0_0_30px_rgba(250,204,21,0.5)]">
            Iron
          </span>
          Buddy{t('about.title_suf')}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-gray-400 text-lg max-w-2xl leading-relaxed"
        >
          {t('about.tagline')}
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
            {t('about.cta_start')}
          </Link>
          <Link to="/contact"
            className="px-8 py-3 bg-white/5 border border-white/10 text-white font-black rounded-xl uppercase text-sm
              hover:bg-white/10 hover:border-white/20 active:scale-95 transition-all duration-200"
          >
            {t('about.cta_contact')}
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
          <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.4em] uppercase mb-3">{t('about.mission.label')}</p>
          <h2 className="text-4xl font-black uppercase italic leading-tight mb-6">
            {t('about.mission.title1')}<br />
            <span className="text-[--color-iron-gold]">{t('about.mission.title2')}</span>
          </h2>
          <p className="text-gray-400 leading-relaxed mb-4">{t('about.mission.p1')}</p>
          <p className="text-gray-400 leading-relaxed">{t('about.mission.p2')}</p>
        </FadeIn>

        <FadeIn delay={0.15}>
          <div className="grid grid-cols-2 gap-4">
            {missionCards.map((item) => (
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
            <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.4em] uppercase mb-3">{t('about.features.label')}</p>
            <h2 className="text-4xl font-black uppercase italic">{t('about.features.title')}</h2>
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
          <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.4em] uppercase mb-3">{t('about.steps.label')}</p>
          <h2 className="text-4xl font-black uppercase italic">{t('about.steps.title')}</h2>
        </FadeIn>

        <div className="relative">
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
              {t('about.cta2.title')}
            </h2>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              {t('about.cta2.desc')}
            </p>
            <Link to="/signup"
              className="inline-block px-10 py-4 bg-yellow-300 !text-black font-black rounded-xl uppercase text-sm
                hover:bg-yellow-200 hover:scale-[1.03] active:scale-95 transition-all duration-200
                shadow-[0_0_40px_rgba(253,224,71,0.3)]"
            >
              {t('about.cta2.btn')}
            </Link>
          </div>
        </section>
      </FadeIn>

    </div>
  );
}
