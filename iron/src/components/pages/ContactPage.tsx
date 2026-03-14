import type { JSX } from "react";

export default function Contact(): JSX.Element {
  return (
    <div className="min-h-screen flex flex-col bg-[--color-gym-dark] text-white">
    <main className="flex-grow w-full mt-32">
      <div className="max-w-100 mx-auto text-[--color-iron-gold] drop-shadow-[0_0_10px_rgba(250,204,21,0.8)] animate-coach-breathe">
        <div className="bg-white/5 backdrop-blur-xl p-8 rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <h1 className="text-3xl font-bold mb-4">Contact Us</h1>
          <p className="mb-4">Have questions or need support? Reach out to us!</p>
          <form className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">Name</label>
              <input type="text" id="name" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-yellow-300/60 backdrop-blur-sm transition-all" />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
              <input type="email" id="email" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-yellow-300/60 backdrop-blur-sm transition-all" />
            </div>
            <div>
              <label htmlFor="message" className="block text-sm font-medium mb-1">Message</label>
              <textarea id="message" rows={4} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-yellow-300/60 backdrop-blur-sm transition-all"></textarea>
            </div>
            <button type="submit" className="w-full py-3 font-bold rounded-lg uppercase transition-all duration-300 bg-yellow-300 text-black hover:bg-yellow-200 hover:scale-[1.02] active:scale-95">
              Send Message
            </button>
          </form>
        </div>
      </div>
      </main>
    </div>
  );
}
