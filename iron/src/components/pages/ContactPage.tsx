import { useState } from 'react';
import type { JSX } from 'react';

export default function Contact(): JSX.Element {
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus]   = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError]     = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setError('');
    try {
      const res = await fetch('/api/contact/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to send message');
      setStatus('sent');
      setName(''); setEmail(''); setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[--color-gym-dark] text-white">
      <main className="flex-grow w-full mt-32">
        <div className="max-w-100 mx-auto text-[--color-iron-gold] drop-shadow-[0_0_10px_rgba(250,204,21,0.8)] animate-coach-breathe">
          <div className="bg-white/5 backdrop-blur-xl p-8 rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <h1 className="text-3xl font-bold mb-2">Contact Us</h1>
            <p className="mb-6 text-gray-400 text-sm">Have questions or need support? We'll get back to you!</p>

            {status === 'sent' ? (
              <div className="text-center py-10 space-y-3">
                <span className="text-5xl">✅</span>
                <p className="text-green-400 font-black uppercase tracking-wide">Message Sent!</p>
                <p className="text-gray-400 text-sm">We'll be in touch soon.</p>
                <button
                  onClick={() => setStatus('idle')}
                  className="mt-4 px-6 py-2 bg-yellow-300 text-black font-black rounded-xl uppercase text-xs hover:bg-yellow-200 active:scale-95 transition-all"
                >Send Another</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text" id="name" required value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-yellow-300/60 backdrop-blur-sm transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email" id="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-yellow-300/60 backdrop-blur-sm transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium mb-1">Message</label>
                  <textarea
                    id="message" rows={4} required value={message} onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-yellow-300/60 backdrop-blur-sm transition-all resize-none"
                  />
                </div>
                {status === 'error' && (
                  <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-2">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="w-full py-3 font-bold rounded-lg uppercase transition-all duration-300 bg-yellow-300 text-black hover:bg-yellow-200 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  {status === 'sending' ? 'Sending…' : 'Send Message'}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
