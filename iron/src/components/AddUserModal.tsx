import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faQrcode, faCamera } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  apiSearchUserByEmail, apiGetUserById, apiStartConversation,
  type PublicUser, type ChatConversation,
} from '../api';

// QR code payload format: ironbuddy:user:<id>
const QR_PREFIX = 'ironbuddy:user:';

function encodeUserQR(userId: number) {
  return `${QR_PREFIX}${userId}`;
}

function decodeUserQR(data: string): number | null {
  if (!data.startsWith(QR_PREFIX)) return null;
  const id = parseInt(data.slice(QR_PREFIX.length), 10);
  return isNaN(id) ? null : id;
}

interface Props {
  token: string;
  currentUserId: number;
  currentUserName: string;
  onConversationStarted: (convo: ChatConversation) => void;
  onClose: () => void;
}

type Tab = 'email' | 'myqr' | 'scan';

export default function AddUserModal({ token, currentUserId, currentUserName, onConversationStarted, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('email');

  // Email search state
  const [emailInput, setEmailInput]     = useState('');
  const [searching, setSearching]       = useState(false);
  const [foundUser, setFoundUser]       = useState<PublicUser | null>(null);
  const [searchError, setSearchError]   = useState('');
  const [starting, setStarting]         = useState(false);

  // QR scanner state
  const [scanError, setScanError]       = useState('');
  const [scanFoundUser, setScanFoundUser] = useState<PublicUser | null>(null);
  const [scanStarting, setScanStarting] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const scannerMounted = useRef(false);

  // ── Email search ──────────────────────────────────────────────────────────
  const searchByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setSearching(true);
    setFoundUser(null);
    setSearchError('');
    try {
      const user = await apiSearchUserByEmail(token, emailInput.trim());
      setFoundUser(user);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Not found');
    } finally {
      setSearching(false);
    }
  };

  const startChat = async (user: PublicUser, setLoadingFn: (v: boolean) => void) => {
    setLoadingFn(true);
    try {
      const convo = await apiStartConversation(token, user.id);
      onConversationStarted(convo);
      onClose();
    } catch {
      // ignore
    } finally {
      setLoadingFn(false);
    }
  };

  // ── QR scanner lifecycle ──────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'scan') {
      // Clean up scanner if switching away
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
        scannerMounted.current = false;
      }
      return;
    }

    // Small delay to ensure the DOM element is rendered
    const timer = setTimeout(() => {
      if (scannerMounted.current) return;
      scannerMounted.current = true;

      // Include both CAMERA and FILE so mobile users without HTTPS can still
      // scan by picking a photo from their camera roll.
      const scanner = new Html5QrcodeScanner(
        'ironbuddy-qr-reader',
        {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          supportedScanTypes: [
            Html5QrcodeScanType.SCAN_TYPE_CAMERA,
            Html5QrcodeScanType.SCAN_TYPE_FILE,
          ],
          rememberLastUsedCamera: true,
        },
        false
      );

      scanner.render(
        async (decodedText) => {
          // Pause scanning while processing
          scanner.pause(true);
          setScanError('');
          const userId = decodeUserQR(decodedText);
          if (!userId) {
            setScanError('Not a valid IronBuddy QR code.');
            scanner.resume();
            return;
          }
          try {
            const user = await apiGetUserById(token, userId);
            setScanFoundUser(user);
            scanner.clear().catch(() => {});
            scannerRef.current = null;
          } catch (err) {
            setScanError(err instanceof Error ? err.message : 'Could not find user.');
            scanner.resume();
          }
        },
        () => {} // ignore frame-level errors
      );

      scannerRef.current = scanner;
    }, 100);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
        scannerMounted.current = false;
      }
    };
  }, [tab, token]);

  // ── Render ────────────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; icon: IconDefinition }[] = [
    { id: 'email', label: 'By Email',   icon: faEnvelope },
    { id: 'myqr',  label: 'My QR Code', icon: faQrcode },
    { id: 'scan',  label: 'Scan QR',    icon: faCamera },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md add-user-modal border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div>
            <p className="text-[--color-iron-gold] text-[10px] font-black tracking-[0.3em] uppercase opacity-70">Find</p>
            <h3 className="text-lg font-black uppercase italic text-white">Add Athlete</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl transition-colors">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setScanFoundUser(null); setScanError(''); }}
              className={`flex-1 py-2 text-xs font-black uppercase tracking-wider transition-colors flex flex-col items-center gap-0.5
                ${tab === t.id ? 'text-yellow-300 border-b-2 border-yellow-300' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <FontAwesomeIcon icon={t.icon} className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1">

          {/* ── Email search ── */}
          {tab === 'email' && (
            <div className="space-y-4">
              <p className="text-gray-500 text-sm">Enter the athlete's email address to find them.</p>
              <form onSubmit={searchByEmail} className="flex gap-2">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => { setEmailInput(e.target.value); setFoundUser(null); setSearchError(''); }}
                  placeholder="athlete@example.com"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm
                    focus:border-yellow-300/60 focus:outline-none transition-all placeholder:text-gray-600"
                />
                <button
                  type="submit"
                  disabled={searching || !emailInput.trim()}
                  className="px-3 py-2 sm:px-4 sm:py-2.5 bg-yellow-300 text-black font-black rounded-xl text-xs sm:text-sm uppercase
                    hover:bg-yellow-200 active:scale-95 transition-all disabled:opacity-40"
                >
                  {searching ? '…' : 'Find'}
                </button>
              </form>

              {searchError && (
                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">{searchError}</p>
              )}

              <AnimatePresence>
                {foundUser && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 bg-white/5 border border-yellow-300/20 rounded-2xl px-4 py-3"
                  >
                    <UserAvatar name={foundUser.name} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-black text-sm uppercase">{foundUser.name}</p>
                      <p className="text-gray-500 text-xs">@{foundUser.username}</p>
                    </div>
                    <button
                      onClick={() => startChat(foundUser, setStarting)}
                      disabled={starting}
                      className="px-3 py-1.5 bg-yellow-300 text-black font-black rounded-xl text-xs uppercase
                        hover:bg-yellow-200 active:scale-95 transition-all disabled:opacity-40"
                    >
                      {starting ? '…' : 'Chat'}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ── My QR Code ── */}
          {tab === 'myqr' && (
            <div className="flex flex-col items-center gap-4 py-2">
              <p className="text-gray-500 text-sm text-center">
                Show this to other athletes so they can scan and add you instantly.
              </p>
              <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-lg">
                <QRCodeSVG
                  value={encodeUserQR(currentUserId)}
                  size={160}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  level="M"
                />
              </div>
              <div className="text-center">
                <p className="text-white font-black uppercase text-sm">{currentUserName}</p>
                <p className="text-gray-600 text-xs mt-0.5">IronBuddy Athlete ID #{currentUserId}</p>
              </div>
            </div>
          )}

          {/* ── Scan QR ── */}
          {tab === 'scan' && (
            <div className="space-y-4">
              {!scanFoundUser ? (
                <>
                  <p className="text-gray-500 text-sm text-center">
                    Point your camera at another athlete's QR code.<br />
                    <span className="text-xs opacity-70">On mobile: use the <strong className="text-gray-300">File</strong> tab to scan from your camera roll if camera is blocked.</span>
                  </p>
                  {/* html5-qrcode mounts into this div */}
                  <div
                    id="ironbuddy-qr-reader"
                    className="overflow-hidden rounded-xl [&_video]:rounded-xl [&_select]:bg-gray-900 [&_select]:text-white [&_select]:border-white/10 [&_select]:rounded-lg [&_select]:text-xs [&_button]:bg-yellow-300 [&_button]:text-black [&_button]:font-bold [&_button]:rounded-lg [&_button]:text-xs"
                  />
                  {scanError && (
                    <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 text-center">{scanError}</p>
                  )}
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-4 py-4"
                >
                  <div className="w-16 h-16 rounded-full bg-green-400/20 border-2 border-green-400/50 flex items-center justify-center text-3xl">
                    ✓
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Found athlete</p>
                    <p className="text-white font-black text-lg uppercase">{scanFoundUser.name}</p>
                    <p className="text-gray-500 text-sm">@{scanFoundUser.username}</p>
                  </div>
                  <div className="flex gap-3 w-full">
                    <button
                      onClick={() => { setScanFoundUser(null); setScanError(''); }}
                      className="flex-1 py-2.5 border border-white/10 text-gray-400 font-bold rounded-xl text-sm uppercase hover:bg-white/5 transition-colors"
                    >
                      Re-scan
                    </button>
                    <button
                      onClick={() => startChat(scanFoundUser, setScanStarting)}
                      disabled={scanStarting}
                      className="flex-1 py-2 sm:py-2.5 bg-yellow-300 text-black font-black rounded-xl text-xs sm:text-sm uppercase
                        hover:bg-yellow-200 active:scale-95 transition-all disabled:opacity-40"
                    >
                      {scanStarting ? '…' : 'Start Chat'}
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          )}

        </div>
      </motion.div>
    </div>
  );
}

function UserAvatar({ name }: { name: string }) {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="w-10 h-10 rounded-full bg-yellow-300/20 border-2 border-yellow-300/50 flex items-center justify-center font-black text-[--color-iron-gold] text-sm shrink-0">
      {initials || '?'}
    </div>
  );
}
