// src/components/Home.jsx
export default function Home({ onStart }) {
  return (
    <div className="min-h-screen bg-[--color-gym-dark] text-white flex flex-col items-center justify-center p-6 overflow-hidden relative">
      
      {/* Hintergrund-Glow Effekt */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-[--color-iron-gold] opacity-10 blur-[120px] rounded-full"></div>
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-green-500 opacity-5 blur-[120px] rounded-full"></div>

      {/* Hero Content */}
      <main className="z-10 max-w-5xl w-full grid md:grid-cols-2 gap-12 items-center">
        
        <div className="space-y-8 text-center md:text-left">
          <div className="inline-block px-3 py-1 rounded-full border border-[--color-iron-gold]/30 bg-[--color-iron-gold]/10 text-[--color-iron-gold] text-xs font-black uppercase tracking-widest animate-pulse">
            v1.0 Alpha Online
          </div>
          
          <h1 className="text-6xl md:text-8xl font-black italic uppercase leading-[0.8] tracking-tighter">
            IRON<br /><span className="text-[--color-iron-gold] drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]">BUDDY</span>
          </h1>

          <p className="text-gray-400 text-xl border-l-4 border-[--color-iron-gold] pl-6 max-w-md mx-auto md:mx-0">
            The first AI coach that doesn't just track your data – <span className="text-white">it evolves with you.</span>
          </p>

          <button 
            onClick={onStart}
            className="group relative px-10 py-5 bg-[--color-iron-gold] text-black font-black uppercase tracking-tighter rounded-xl overflow-hidden transition-all hover:bg-green-500 hover:text-white shadow-[0_0_20px_rgba(250,204,21,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)]"
          >
            <span className="relative z-10 flex items-center gap-3 text-xl">
              Initialize Protocol 🦾
            </span>
            <div className="absolute top-0 -left-full w-full h-full bg-white/20 skew-x-12 transition-all group-hover:left-full duration-500"></div>
          </button>
        </div>

        {/* AI-Visual (Rechts) */}
        <div className="hidden md:flex justify-center items-center relative">
          <div className="w-80 h-80 rounded-full border-4 border-[--color-iron-gold]/20 flex items-center justify-center animate-coach-breathe shadow-[0_0_60px_rgba(250,204,21,0.1)] bg-gray-900/40 backdrop-blur-sm">
             <span className="text-9xl drop-shadow-[0_0_20px_rgba(250,204,21,0.8)]">🤖</span>
          </div>
        </div>
      </main>
    </div>
  );
}
