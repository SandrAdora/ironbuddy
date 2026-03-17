import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="w-full mt-12" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🦾</span>
          <span className="text-xs font-black uppercase tracking-widest">
            <span className="text-[--color-iron-gold]">IRON</span>
            <span className="text-white/60">BUDDY</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/terms"   className="text-xs text-gray-600 hover:text-gray-400 transition-colors">Terms of Service</Link>
          <Link to="/privacy" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">Privacy Policy</Link>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <p>© 2026 IronBuddy. All rights reserved.</p>
          <span className="text-gray-700">·</span>
          <p>Created by <span className="text-gray-500 font-semibold">Sandra E.</span></p>
        </div>
      </div>
    </footer>
  );
}
