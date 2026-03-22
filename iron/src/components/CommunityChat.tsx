import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import {
  apiGetUsers, apiGetConversations, apiStartConversation,
  apiGetMessages, apiSendMessage, apiUploadFile, apiToggleReaction,
  apiDeleteConversation, apiDeleteMessage,
  type PublicUser, type ChatConversation, type DirectMessage, type MessageReaction,
} from '../api';
import AddUserModal from './AddUserModal';
import { saveMessages, getMessages as dbGetMessages, addMessage as dbAddMessage, type CachedMessage } from '../services/chatDB';

// Connect to current page origin — Vite proxies /socket.io → socket server :3001
// This works on any device (phone, tablet) without knowing the server's IP.
const SOCKET_URL = window.location.origin;

interface Props {
  token: string;
  currentUserId: number;
  currentUserName?: string;
  onUnreadChange?: (count: number) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const URL_REGEX = /https?:\/\/[^\s<>"]+/gi;

function toCached(msg: DirectMessage, conversationId: number): CachedMessage {
  return {
    id: msg.id,
    conversation_id: conversationId,
    sender_id: msg.sender_id,
    sender_name: msg.sender_name,
    sender_profile_picture: msg.sender_profile_picture,
    content: msg.content,
    file_url: msg.file_url,
    file_type: msg.file_type,
    file_name: msg.file_name,
    created_at: msg.created_at,
    reactions: msg.reactions ?? [],
  };
}

function Avatar({ name, src, size = 'md' }: { name: string; src?: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const cls = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-12 h-12 text-lg' : 'w-10 h-10 text-sm';
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${cls} rounded-full object-cover border-2 border-yellow-300/50 shrink-0`}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div className={`${cls} rounded-full bg-yellow-300/20 border-2 border-yellow-300/50 flex items-center justify-center font-black text-[--color-iron-gold] shrink-0`}>
      {initials || '?'}
    </div>
  );
}


// ── Custom emoji picker ───────────────────────────────────────────────────────

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  { label: '😀', emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢','🫣','🤫','🤔','🫠','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','🫨','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁','☹️','😮','😯','😲','😳','🥺','🫣','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'] },
  { label: '👋', emojis: ['👋','🤚','🖐','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦵','🦿','🦶','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴','👀','👁','👅','👄','🫦','💋','👣'] },
  { label: '🐶', emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🕷','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🦣','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🐓','🦃','🦤','🦚','🦜','🦢','🦩','🕊','🐇','🦝','🦨','🦡','🦫','🦦','🦥','🐁','🐀','🐿','🦔'] },
  { label: '🍎', emojis: ['🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶','🫑','🧄','🧅','🥔','🍠','🫘','🌰','🥜','🍞','🥐','🥖','🫓','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🫔','🌮','🌯','🥙','🧆','🥚','🍜','🍝','🍛','🍣','🍱','🍤','🍙','🍚','🍘','🍥','🥮','🍢','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥛','🍼','🫖','☕','🍵','🧋','🥤','🧃','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾','🧊'] },
  { label: '⚽', emojis: ['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳','🪁','🎣','🤿','🎽','🎿','🛷','🥌','🎯','🪃','🎱','🎮','🕹','🎲','🧩','🧸','🪆','♟','🃏','🀄','🎴','🎭','🎨','🖼','🎰','🚂','🚃','🚄','🚅','🚆','🚇','🚈','🚉','🚊','🚝','🚞','🚋','🚌','🚍','🚎','🚐','🚑','🚒','🚓','🚔','🚕','🚖','🚗','🚘','🚙','🛻','🚚','🚛','🚜','🏎','🏍','🛵','🦽','🦼','🛺','🚲','🛴','🛹','🛼','🚏','🛣','🛤','🛞','⛽','🚨','🚥','🚦','🛑','🚧'] },
  { label: '💡', emojis: ['💡','🔦','🕯','🪔','💰','💴','💵','💶','💷','💸','💳','🪙','💹','📈','📉','📊','📋','📌','📍','📎','🖇','📏','📐','✂️','🗃','🗄','🗑','🔒','🔓','🔏','🔐','🔑','🗝','🔨','🪓','⛏','⚒','🛠','🗡','⚔️','🛡','🪚','🔫','🪃','🏹','🛡','🪝','🔧','🪛','🔩','⚙️','🗜','⚖️','🦯','🔗','⛓','🪤','🧲','🔋','🪫','🔌','💻','🖥','🖨','⌨️','🖱','🖲','💾','💿','📀','🧮','📱','📲','☎️','📞','📟','📠','📺','📻','🧭','⏱','⏰','🕰','⌛','⏳','📡','🔭','🔬','🩺','💊','🩹','🩼','💉','🩸','🩻','🏧','🚮','🚰','♿','🚹','🚺','🚻','🚼','🚾','🛗','⚠️','🚸','⛔','🚫','🚳','🚭','🚯','🚱','🚷','📵','🔞','🔕'] },
  { label: '❤️', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','✅','☑️','✔️','❎','➕','➖','➗','✖️','🔱','📛','🔰','⭕','✅','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔺','🔻','🔷','🔶','🔹','🔸','🔲','🔳','🏁','🚩','🎌','🏴','🏳️','🏳️‍🌈','🏳️‍⚧️','🏴‍☠️'] },
];

function CustomEmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [activeCategory, setActiveCategory] = useState(0);
  const [search, setSearch] = useState('');

  const allEmojis = EMOJI_CATEGORIES.flatMap((c) => c.emojis);
  const displayed = search
    ? allEmojis.filter((e) => e.includes(search))
    : EMOJI_CATEGORIES[activeCategory].emojis;

  return (
    <div
      data-emoji-picker
      className="bg-[#111827] border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      style={{ width: 320, height: 400 }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search emoji…"
          className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-yellow-300/40"
        />
      </div>
      {/* Category tabs */}
      {!search && (
        <div className="flex gap-0.5 px-2 pb-1 overflow-x-auto scrollbar-hide">
          {EMOJI_CATEGORIES.map((cat, i) => (
            <button
              key={i}
              onClick={() => setActiveCategory(i)}
              className={`shrink-0 w-9 h-8 flex items-center justify-center rounded-lg text-base transition-colors ${
                activeCategory === i ? 'bg-yellow-300/20 text-yellow-300' : 'hover:bg-white/10 text-gray-400'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}
      {/* Emoji grid */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-8 gap-0.5">
          {displayed.map((e, i) => (
            <button
              key={i}
              onClick={() => onPick(e)}
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 active:scale-90 transition-all text-xl"
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Portal emoji picker ───────────────────────────────────────────────────────
// Renders the picker via a portal so it escapes overflow:hidden containers.

function PortalPicker({
  anchorRef,
  onPick,
  align = 'right',
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  onPick: (emoji: string) => void;
  align?: 'left' | 'right';
}) {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const pickerH = 400;
    const pickerW = 320;
    // Open above the anchor; clamp so it doesn't go off the top of the screen
    const top = Math.max(8, rect.top - pickerH - 8);
    const left = align === 'right'
      ? Math.max(8, Math.min(rect.right - pickerW, window.innerWidth - pickerW - 8))
      : Math.max(8, rect.left);
    setPos({ top, left });
  }, [anchorRef, align]);

  return createPortal(
    <div style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}>
      <CustomEmojiPicker onPick={onPick} />
    </div>,
    document.body,
  );
}

// ── Shared workout card ────────────────────────────────────────────────────────

function WorkoutShareCard({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  try {
    const data = JSON.parse(content.slice('[WORKOUT_SHARE]'.length));
    return (
      <div className="rounded-xl overflow-hidden border border-yellow-300/25 mt-1" style={{ background: 'rgba(250,204,21,0.05)', minWidth: 220 }}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-yellow-300/15">
          <span className="text-base">🏋️</span>
          <span className="text-[10px] font-black uppercase tracking-widest text-yellow-400/70">Workout Plan</span>
        </div>
        <div className="px-3 py-2.5 space-y-1">
          <p className="text-white font-black text-sm uppercase">{data.name}</p>
          {data.description && <p className="text-gray-400 text-xs">{data.description}</p>}
          <p className="text-gray-500 text-xs">{data.exercises?.length ?? 0} exercises</p>
        </div>
        {data.exercises?.length > 0 && (
          <>
            <button
              onClick={() => setExpanded(v => !v)}
              className="w-full text-left px-3 py-1.5 text-xs text-yellow-400/60 hover:text-yellow-400 transition-colors border-t border-yellow-300/10 font-bold"
            >
              {expanded ? '▲ Hide exercises' : '▼ Show exercises'}
            </button>
            {expanded && (
              <div className="px-3 pb-3 space-y-1.5 border-t border-yellow-300/10 pt-2">
                {data.exercises.map((ex: { name: string; sets: number; reps: string; muscle: string }, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-white font-semibold capitalize">{ex.name}</span>
                    <span className="text-gray-500 ml-2 shrink-0">{ex.sets}×{ex.reps}{ex.muscle ? ` · ${ex.muscle}` : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  } catch {
    return <span className="whitespace-pre-wrap break-words">{content}</span>;
  }
}

// ── Message content renderer ──────────────────────────────────────────────────

function MessageContent({ msg }: { msg: DirectMessage }) {
  const parts: React.ReactNode[] = [];

  // Shared workout plan
  if (msg.content?.startsWith('[WORKOUT_SHARE]')) {
    return <WorkoutShareCard content={msg.content} />;
  }

  // File attachment
  if (msg.file_url) {
    if (msg.file_type === 'image') {
      parts.push(
        <a key="img" href={msg.file_url} target="_blank" rel="noreferrer" className="block">
          <img
            src={msg.file_url}
            alt={msg.file_name ?? 'image'}
            className="max-w-[260px] max-h-[200px] rounded-xl object-cover cursor-pointer hover:opacity-90 transition-opacity"
          />
        </a>
      );
    } else if (msg.file_type === 'video') {
      parts.push(
        <video key="video" src={msg.file_url} controls className="max-w-[260px] rounded-xl" />
      );
    } else {
      const icon = msg.file_type === 'pdf' ? '📄' : '📎';
      parts.push(
        <a
          key="file"
          href={msg.file_url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors text-sm"
        >
          <span className="text-xl">{icon}</span>
          <span className="truncate max-w-[180px]">{msg.file_name ?? 'Download file'}</span>
          <span className="text-[10px] opacity-60 ml-auto">↗</span>
        </a>
      );
    }
  }

  // Text content with URL linkification
  if (msg.content) {
    const segments = msg.content.split(URL_REGEX);
    const urls = msg.content.match(URL_REGEX) ?? [];
    const nodes: React.ReactNode[] = [];
    segments.forEach((seg, i) => {
      if (seg) nodes.push(<span key={`s${i}`}>{seg}</span>);
      if (urls[i]) {
        nodes.push(
          <a
            key={`u${i}`}
            href={urls[i]}
            target="_blank"
            rel="noreferrer"
            className="underline break-all opacity-80 hover:opacity-100"
          >
            {urls[i]}
          </a>
        );
      }
    });
    parts.push(<span key="text" className="whitespace-pre-wrap break-words">{nodes}</span>);
  }

  return <>{parts}</>;
}

// ── File preview thumbnail ────────────────────────────────────────────────────

interface PendingFile {
  file: File;
  previewUrl: string;
  type: 'image' | 'video' | 'pdf' | 'file';
}

function FilePreview({ pending, onRemove }: { pending: PendingFile; onRemove: () => void }) {
  return (
    <div className="relative inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-3 py-2 mr-2 mb-1">
      {pending.type === 'image' ? (
        <img src={pending.previewUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
      ) : (
        <span className="text-2xl">{pending.type === 'pdf' ? '📄' : '📎'}</span>
      )}
      <span className="text-xs text-white/80 max-w-[120px] truncate">{pending.file.name}</span>
      <button
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center hover:bg-red-400 transition-colors"
      >
        ✕
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CommunityChat({ token, currentUserId, currentUserName = 'Athlete', onUnreadChange }: Props) {
  const [conversations, setConversations]   = useState<ChatConversation[]>([]);
  const [activeConvo, setActiveConvo]       = useState<ChatConversation | null>(null);
  const [messages, setMessages]             = useState<DirectMessage[]>([]);
  const [showAddUser, setShowAddUser]       = useState(false);
  const [leftTab, setLeftTab]               = useState<'messages' | 'athletes'>('messages');
  const [users, setUsers]                   = useState<PublicUser[]>([]);
  const [usersLoading, setUsersLoading]     = useState(false);
  const [userSearch, setUserSearch]         = useState('');
  const [startingChat, setStartingChat]     = useState<number | null>(null); // user id being started
  const [startChatError, setStartChatError] = useState('');
  const [input, setInput]                   = useState('');
  const [sending, setSending]               = useState(false);
  const [uploading, setUploading]           = useState(false);
  const [pendingFile, setPendingFile]       = useState<PendingFile | null>(null);
  const [typingUsers, setTypingUsers]       = useState<Set<number>>(new Set());
  const [connected, setConnected]           = useState(false);
  const [mobileView, setMobileView]         = useState<'list' | 'chat'>('list');
  const [loading, setLoading]               = useState(true);
  const [showInputEmoji, setShowInputEmoji] = useState(false);
  const [reactionPickerFor, setReactionPickerFor] = useState<number | null>(null); // message id
  const reactionAnchorRef = useRef<HTMLButtonElement | null>(null);

  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const emojiButtonRef  = useRef<HTMLButtonElement>(null);
  const fileInputRef    = useRef<HTMLInputElement>(null);
  const socketRef       = useRef<Socket | null>(null);
  const typingTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeConvoRef  = useRef<ChatConversation | null>(null);

  // Keep ref in sync so socket event handlers always see the latest activeConvo
  useEffect(() => { activeConvoRef.current = activeConvo; }, [activeConvo]);

  // Close pickers on outside click (skip if click is inside the emoji picker itself)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-emoji-picker]')) return;
      setReactionPickerFor(null);
      setShowInputEmoji(false);
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);

  // ── Socket.io connection ────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      auth: { token },
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    // Incoming message from another user
    socket.on('new_message', ({ conversation_id, message }: { conversation_id: number; message: DirectMessage }) => {
      // Only update messages state if this convo is open
      if (activeConvoRef.current?.id === conversation_id) {
        setMessages((prev) => {
          if (prev.find((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
        dbAddMessage(toCached(message, conversation_id)).catch(() => {});
      }
      // Update conversation list preview + unread count
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversation_id
            ? {
                ...c,
                unread_count: activeConvoRef.current?.id === conversation_id ? 0 : c.unread_count + 1,
                last_message: { content: message.content?.startsWith('[WORKOUT_SHARE]') ? '🏋️ Shared a workout plan' : message.content || (message.file_type ? `Sent a ${message.file_type}` : 'Sent a file'), sender_id: message.sender_id, created_at: message.created_at },
                updated_at: message.created_at,
              }
            : c
        ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      );
    });

    // Reaction updates from other users
    socket.on('reaction_update', ({ message_id, reactions }: { message_id: number; reactions: MessageReaction[] }) => {
      setMessages((prev) =>
        prev.map((m) => m.id === message_id ? { ...m, reactions } : m)
      );
    });

    // Message deleted by sender
    socket.on('message_deleted', ({ message_id }: { conversation_id: number; message_id: number }) => {
      setMessages((prev) => prev.filter((m) => m.id !== message_id));
    });

    // Conversation deleted by the other participant
    socket.on('conversation_deleted', ({ conversation_id }: { conversation_id: number }) => {
      setConversations((prev) => prev.filter((c) => c.id !== conversation_id));
      if (activeConvoRef.current?.id === conversation_id) {
        setActiveConvo(null);
        setMessages([]);
        setMobileView('list');
      }
    });

    // Typing indicators
    socket.on('typing', ({ user_id, conversation_id }: { user_id: number; conversation_id: number }) => {
      if (activeConvoRef.current?.id === conversation_id) {
        setTypingUsers((prev) => new Set(prev).add(user_id));
      }
    });
    socket.on('stop_typing', ({ user_id }: { user_id: number }) => {
      setTypingUsers((prev) => { const s = new Set(prev); s.delete(user_id); return s; });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  // ── Initial conversation load ───────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    apiGetConversations(token)
      .then(setConversations)
      .finally(() => setLoading(false));
  }, [token]);

  // ── Join/leave socket room when active conversation changes ─────────────────
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    if (activeConvo) {
      socket.emit('join_conversation', activeConvo.id);
    }
    return () => {
      if (activeConvo) socket.emit('leave_conversation', activeConvo.id);
    };
  }, [activeConvo?.id]);

  // ── Load messages for active conversation ───────────────────────────────────
  useEffect(() => {
    if (!activeConvo) return;
    const convoId = activeConvo.id;

    // 1. Show cached messages immediately
    dbGetMessages(convoId).then((cached) => {
      if (cached.length > 0) setMessages(cached as unknown as DirectMessage[]);
    });

    // 2. Fetch from server and sync cache
    apiGetMessages(token, convoId).then((msgs) => {
      setMessages(msgs);
      setConversations((prev) =>
        prev.map((c) => (c.id === convoId ? { ...c, unread_count: 0 } : c))
      );
      saveMessages(convoId, msgs.map((m) => toCached(m, convoId))).catch(() => {});
    }).catch(() => {});
  }, [activeConvo?.id, token]);

  // ── Scroll to bottom on new messages ───────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // ── Conversation helpers ────────────────────────────────────────────────────
  const openConversation = (convo: ChatConversation) => {
    setActiveConvo(convo);
    setMobileView('chat');
    setTypingUsers(new Set());
  };

  const handleConversationStarted = (convo: ChatConversation) => {
    setConversations((prev) => {
      const exists = prev.find((c) => c.id === convo.id);
      return exists ? prev : [convo, ...prev];
    });
    openConversation(convo);
  };

  // Load all athletes when switching to that tab
  useEffect(() => {
    if (leftTab !== 'athletes' || users.length > 0) return;
    setUsersLoading(true);
    apiGetUsers(token).then(setUsers).finally(() => setUsersLoading(false));
  }, [leftTab, token]);

  const startChatWithUser = async (user: PublicUser) => {
    setStartingChat(user.id);
    setStartChatError('');
    try {
      const convo = await apiStartConversation(token, user.id);
      handleConversationStarted(convo);
      setLeftTab('messages');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('hidden') || msg.includes('403')) {
        setStartChatError('Your profile is hidden. Make yourself visible in Settings to start new conversations.');
      }
    } finally {
      setStartingChat(null);
    }
  };

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.username.toLowerCase().includes(userSearch.toLowerCase())
  );

  // ── File selection ──────────────────────────────────────────────────────────
  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const type: PendingFile['type'] =
      file.type.startsWith('image/') ? 'image' :
      file.type.startsWith('video/') ? 'video' :
      file.type === 'application/pdf' ? 'pdf' : 'file';

    const allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'txt', 'mp4', 'mov', 'avi'];
    if (!allowedExts.includes(ext)) {
      alert('File type not supported. Allowed: images, video, PDF, TXT.');
      return;
    }

    const previewUrl = type === 'image' ? URL.createObjectURL(file) : '';
    setPendingFile({ file, previewUrl, type });
    e.target.value = ''; // reset so same file can be re-selected
  };

  const removePendingFile = () => {
    if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
    setPendingFile(null);
  };

  // ── Typing indicator emit ───────────────────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (!activeConvo || !socketRef.current) return;
    socketRef.current.emit('typing_start', activeConvo.id);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socketRef.current?.emit('typing_stop', activeConvo.id);
    }, 2000);
  };

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    if ((!input.trim() && !pendingFile) || !activeConvo || sending || uploading) return;
    const text = input.trim();
    setInput('');

    // Stop typing indicator
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    socketRef.current?.emit('typing_stop', activeConvo.id);

    setSending(true);
    try {
      let fileData: { file_url: string; file_type: string; file_name: string } | undefined;

      // Upload file first if attached
      if (pendingFile) {
        setUploading(true);
        const uploaded = await apiUploadFile(pendingFile.file);
        fileData = { file_url: uploaded.file_url, file_type: uploaded.file_type, file_name: uploaded.file_name };
        removePendingFile();
        setUploading(false);
      }

      // Save message via Django REST API
      const msg = await apiSendMessage(token, activeConvo.id, text, fileData);

      // Update local state
      setMessages((prev) => [...prev, msg]);
      dbAddMessage(toCached(msg, activeConvo.id)).catch(() => {});

      // Update conversation list
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConvo.id
            ? {
                ...c,
                last_message: { content: text || (fileData ? `Sent a ${fileData.file_type}` : 'Sent a file'), sender_id: currentUserId, created_at: msg.created_at },
                updated_at: msg.created_at,
              }
            : c
        ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      );

      // Broadcast via socket to other participants
      socketRef.current?.emit('send_message', { conversation_id: activeConvo.id, message: msg });

    } catch (err) {
      setInput(text);
      console.error('Send failed:', err);
    } finally {
      setSending(false);
      setUploading(false);
    }
  }, [input, pendingFile, activeConvo, sending, uploading, token, currentUserId]);

  // ── Delete conversation ─────────────────────────────────────────────────────
  const handleDeleteConversation = useCallback(async (convo: ChatConversation) => {
    if (!window.confirm(`Delete chat with ${convo.other_user?.name ?? 'this user'}? This cannot be undone.`)) return;
    // Optimistic
    setConversations((prev) => prev.filter((c) => c.id !== convo.id));
    if (activeConvo?.id === convo.id) { setActiveConvo(null); setMessages([]); setMobileView('list'); }
    try {
      await apiDeleteConversation(token, convo.id);
      socketRef.current?.emit('conversation_deleted', { conversation_id: convo.id });
    } catch {
      // Restore on failure
      setConversations((prev) => [convo, ...prev]);
    }
  }, [token, activeConvo]);

  // ── Delete message ──────────────────────────────────────────────────────────
  const handleDeleteMessage = useCallback(async (msg: DirectMessage) => {
    // Optimistic
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    try {
      const result = await apiDeleteMessage(token, msg.id);
      socketRef.current?.emit('message_deleted', { conversation_id: result.conversation_id, message_id: msg.id });
    } catch {
      // Restore on failure
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.created_at > msg.created_at);
        const copy = [...prev];
        copy.splice(idx === -1 ? copy.length : idx, 0, msg);
        return copy;
      });
    }
  }, [token]);

  // ── Reaction toggle ─────────────────────────────────────────────────────────
  const handleReaction = useCallback(async (msg: DirectMessage, emoji: string) => {
    setReactionPickerFor(null);
    // Optimistic update
    setMessages((prev) => prev.map((m) => {
      if (m.id !== msg.id) return m;
      const existing = (m.reactions ?? []).find((r) => r.emoji === emoji);
      let updated: MessageReaction[];
      if (existing) {
        const alreadyMine = existing.user_ids.includes(currentUserId);
        if (alreadyMine) {
          const newIds = existing.user_ids.filter((id) => id !== currentUserId);
          updated = newIds.length === 0
            ? (m.reactions ?? []).filter((r) => r.emoji !== emoji)
            : (m.reactions ?? []).map((r) => r.emoji === emoji ? { ...r, count: r.count - 1, user_ids: newIds } : r);
        } else {
          updated = (m.reactions ?? []).map((r) => r.emoji === emoji ? { ...r, count: r.count + 1, user_ids: [...r.user_ids, currentUserId] } : r);
        }
      } else {
        updated = [...(m.reactions ?? []), { emoji, count: 1, user_ids: [currentUserId] }];
      }
      return { ...m, reactions: updated };
    }));
    try {
      const result = await apiToggleReaction(token, msg.id, emoji);
      // Update with server's confirmed state
      setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, reactions: result.reactions } : m));
      // Broadcast to other participant
      if (activeConvo) {
        socketRef.current?.emit('reaction_update', {
          conversation_id: activeConvo.id,
          message_id: msg.id,
          reactions: result.reactions,
        });
      }
    } catch {
      // revert on failure — refetch messages
    }
  }, [token, currentUserId, activeConvo]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const totalUnread = conversations.reduce((s, c) => s + c.unread_count, 0);

  // Notify parent (UserProfile) so the Community tab can show a badge
  useEffect(() => { onUnreadChange?.(totalUnread); }, [totalUnread, onUnreadChange]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[--color-iron-gold] text-xs font-black tracking-[0.3em] uppercase opacity-70">Social</p>
          <h2 className="text-2xl font-black uppercase italic mt-1 flex items-center gap-2">
            💬 Community
            {totalUnread > 0 && (
              <span className="text-sm bg-yellow-300 text-black font-black px-2 py-0.5 rounded-full">{totalUnread}</span>
            )}
            <span className={`w-2 h-2 rounded-full shrink-0 ${connected ? 'bg-green-400' : 'bg-red-500'}`} title={connected ? 'Connected' : 'Reconnecting…'} />
          </h2>
        </div>
        <button
          onClick={() => setShowAddUser(true)}
          className="px-4 py-2 sm:px-5 sm:py-2.5 bg-yellow-300 text-black font-black rounded-xl uppercase text-xs sm:text-sm
            hover:bg-yellow-200 hover:scale-[1.02] active:scale-95 transition-all duration-200"
        >
          + Add Athlete
        </button>
      </div>

      {/* Add user modal */}
      <AnimatePresence>
        {showAddUser && (
          <AddUserModal
            token={token}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            onConversationStarted={handleConversationStarted}
            onClose={() => setShowAddUser(false)}
          />
        )}
      </AnimatePresence>

      {/* Chat layout */}
      <div className="flex gap-4 h-[calc(100svh-18rem)] md:h-[calc(100vh-14rem)] min-h-[400px]">

        {/* Left panel — Messages / Athletes */}
        <div className={`${mobileView === 'chat' ? 'hidden' : 'flex'} md:flex flex-col w-full md:w-72 shrink-0
          bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden`}>

          {/* Tab bar */}
          <div className="flex border-b border-white/10 shrink-0">
            {(['messages', 'athletes'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setLeftTab(tab)}
                className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider transition-colors
                  ${leftTab === tab ? 'text-yellow-300 border-b-2 border-yellow-300' : 'text-gray-500 hover:text-gray-300'}`}
              >
                {tab === 'messages' ? `💬 Messages${totalUnread > 0 ? ` (${totalUnread})` : ''}` : '🏋️ Athletes'}
              </button>
            ))}
          </div>

          {/* Search bar — Athletes tab only */}
          {leftTab === 'athletes' && (
            <div className="px-3 py-2 border-b border-white/10 shrink-0">
              <input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search athletes…"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs
                  focus:border-yellow-300/60 focus:outline-none transition-all placeholder:text-gray-600"
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto">

            {/* ── Messages tab ── */}
            {leftTab === 'messages' && (
              loading ? (
                <div className="space-y-1 p-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-3 animate-pulse">
                      <div className="w-10 h-10 rounded-full bg-white/10 shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 bg-white/10 rounded w-1/2" />
                        <div className="h-2.5 bg-white/5 rounded w-3/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
                  <span className="text-4xl">💬</span>
                  <p className="text-gray-500 text-sm">No messages yet.</p>
                  <button
                    onClick={() => setLeftTab('athletes')}
                    className="text-yellow-300 text-xs font-black uppercase tracking-wider hover:underline"
                  >
                    Browse Athletes →
                  </button>
                </div>
              ) : (
                conversations.map((c) => (
                  <div
                    key={c.id}
                    className={`group/item relative flex items-center border-b border-white/5 transition-colors
                      ${activeConvo?.id === c.id ? 'bg-yellow-300/10' : 'hover:bg-white/5'}`}
                  >
                  <button
                    onClick={() => openConversation(c)}
                    className="flex-1 flex items-center gap-3 px-3 py-3 text-left min-w-0"
                  >
                    <div className="relative">
                      <Avatar name={c.other_user?.name ?? '?'} src={c.other_user?.profile_picture ?? undefined} size="md" />
                      {c.unread_count > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-300 text-black text-[9px] font-black rounded-full flex items-center justify-center">
                          {c.unread_count > 9 ? '9+' : c.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-black uppercase truncate ${c.unread_count > 0 ? 'text-white' : 'text-gray-300'}`}>
                          {c.other_user?.name ?? c.other_user?.username ?? '?'}
                        </p>
                        {c.last_message && (
                          <span className="text-[10px] text-gray-600 shrink-0 ml-1">{timeAgo(c.last_message.created_at)}</span>
                        )}
                      </div>
                      {c.last_message && (
                        <p className={`text-xs truncate mt-0.5 ${c.unread_count > 0 ? 'text-gray-300 font-semibold' : 'text-gray-600'}`}>
                          {c.last_message.sender_id === currentUserId ? 'You: ' : ''}{c.last_message.content?.startsWith('[WORKOUT_SHARE]') ? '🏋️ Shared a workout plan' : c.last_message.content}
                        </p>
                      )}
                    </div>
                  </button>
                  {/* Delete conversation icon — shown on hover */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteConversation(c); }}
                    title="Delete chat"
                    className="opacity-0 group-hover/item:opacity-100 transition-opacity mr-2 p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg shrink-0"
                  >
                    🗑
                  </button>
                  </div>
                ))
              )
            )}

            {/* ── Athletes tab ── */}
            {leftTab === 'athletes' && (
              usersLoading ? (
                <div className="space-y-1 p-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-3 animate-pulse">
                      <div className="w-10 h-10 rounded-full bg-white/10 shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 bg-white/10 rounded w-2/3" />
                        <div className="h-2.5 bg-white/5 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
                  <span className="text-4xl">🏋️</span>
                  <p className="text-gray-500 text-sm">
                    {userSearch ? 'No athletes match your search.' : 'No other athletes yet.'}
                  </p>
                </div>
              ) : (
                <>
                  {startChatError && (
                    <div className="mx-3 mt-3 px-4 py-3 bg-red-500/10 border border-red-400/20 rounded-xl text-xs text-red-300">
                      🫥 {startChatError}
                    </div>
                  )}
                {filteredUsers.map((u) => {
                  const existingConvo = conversations.find((c) => c.other_user?.id === u.id);
                  return (
                    <button
                      key={u.id}
                      onClick={() => startChatWithUser(u)}
                      disabled={startingChat === u.id}
                      className="w-full flex items-center gap-3 px-3 py-3 transition-colors text-left border-b border-white/5 hover:bg-white/5 disabled:opacity-60"
                    >
                      <Avatar name={u.name} src={u.profile_picture ?? undefined} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black uppercase truncate text-gray-200">{u.name}</p>
                        <p className="text-xs text-gray-600 truncate">@{u.username}</p>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg shrink-0 ${
                        existingConvo
                          ? 'bg-yellow-300/10 text-yellow-300'
                          : 'bg-white/10 text-gray-400'
                      }`}>
                        {startingChat === u.id ? '…' : existingConvo ? 'Chat' : 'Message'}
                      </span>
                    </button>
                  );
                })}
                </>
              )
            )}

          </div>
        </div>

        {/* Message thread */}
        <div className={`${mobileView === 'list' ? 'hidden' : 'flex'} md:flex flex-col flex-1
          bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden`}>
          {!activeConvo ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
              <span className="text-5xl">💬</span>
              <p className="text-[--color-iron-gold] font-black uppercase">Select a conversation</p>
              <p className="text-gray-500 text-sm">Choose a chat on the left or start a new one.</p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
                <button
                  onClick={() => setMobileView('list')}
                  className="md:hidden text-gray-400 hover:text-white mr-1"
                >
                  ←
                </button>
                <Avatar name={activeConvo.other_user?.name ?? '?'} src={activeConvo.other_user?.profile_picture ?? undefined} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-black text-sm uppercase">{activeConvo.other_user?.name}</p>
                  <p className="text-gray-600 text-xs">@{activeConvo.other_user?.username}</p>
                </div>
                <button
                  onClick={() => handleDeleteConversation(activeConvo)}
                  title="Delete conversation"
                  className="text-gray-600 hover:text-red-400 text-xs px-2 py-1.5 rounded-lg hover:bg-red-400/10 transition-all font-bold uppercase tracking-wide"
                >
                  🗑 Delete Chat
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-center text-gray-600 text-sm mt-8">No messages yet. Say hi! 👋</p>
                )}
                {messages.map((msg, i) => {
                  const isMe          = msg.sender_id === currentUserId;
                  const isNewGroup    = i === 0 || messages[i - 1].sender_id !== msg.sender_id;
                  const isLastInGroup = i === messages.length - 1 || messages[i + 1].sender_id !== msg.sender_id;
                  const hasReactions  = (msg.reactions ?? []).length > 0;
                  const showPicker    = reactionPickerFor === msg.id;
                  return (
                    <div key={msg.id} className={`flex items-end gap-2 group ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      {/* Avatar — shown for received messages at the bottom of each group */}
                      {!isMe ? (
                        isLastInGroup ? (
                          <Avatar name={msg.sender_name} src={msg.sender_profile_picture ?? undefined} size="sm" />
                        ) : (
                          <div className="w-8 shrink-0" />
                        )
                      ) : null}

                      <div className={`flex flex-col max-w-[72%] ${isMe ? 'items-end' : 'items-start'}`}>
                        {!isMe && isNewGroup && (
                          <p className="text-[10px] text-gray-500 uppercase font-bold mb-1 ml-1">{msg.sender_name}</p>
                        )}

                        {/* Bubble + reaction button row */}
                        <div className={`flex items-center gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div className={`px-3 py-2.5 rounded-2xl text-sm leading-relaxed space-y-1.5 ${
                            isMe
                              ? 'bg-yellow-300 text-black font-semibold rounded-br-sm'
                              : 'bg-white/10 text-white rounded-bl-sm'
                          }`}>
                            <MessageContent msg={msg} />
                          </div>

                          {/* Delete button — own messages only, visible on hover */}
                          {isMe && (
                            <button
                              onClick={() => handleDeleteMessage(msg)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-red-500/30 text-sm"
                              title="Delete message"
                            >
                              🗑
                            </button>
                          )}

                          {/* React button — visible on hover */}
                          <div className="relative">
                            <button
                              onClick={(ev) => {
                                ev.stopPropagation();
                                reactionAnchorRef.current = ev.currentTarget;
                                setReactionPickerFor(showPicker ? null : msg.id);
                                setShowInputEmoji(false);
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-sm"
                              title="React"
                            >
                              😊
                            </button>
                            {showPicker && (
                              <PortalPicker
                                anchorRef={reactionAnchorRef}
                                align={isMe ? 'right' : 'left'}
                                onPick={(e) => handleReaction(msg, e)}
                              />
                            )}
                          </div>
                        </div>

                        {/* Reaction pills */}
                        {hasReactions && (
                          <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            {(msg.reactions ?? []).map((r) => {
                              const iMine = r.user_ids.includes(currentUserId);
                              return (
                                <button
                                  key={r.emoji}
                                  onClick={() => handleReaction(msg, r.emoji)}
                                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold transition-all active:scale-95 ${
                                    iMine
                                      ? 'bg-yellow-300/25 border border-yellow-300/60 text-yellow-200'
                                      : 'bg-white/10 border border-white/10 text-gray-300 hover:bg-white/15'
                                  }`}
                                  title={iMine ? 'Remove reaction' : 'Add reaction'}
                                >
                                  <span>{r.emoji}</span>
                                  <span>{r.count}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        <p className="text-[10px] text-gray-700 mt-0.5 mx-1">{timeAgo(msg.created_at)}</p>
                      </div>
                    </div>
                  );
                })}

                {/* Typing indicator */}
                <AnimatePresence>
                  {typingUsers.size > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className="flex items-start"
                    >
                      <div className="bg-white/10 rounded-2xl rounded-bl-sm px-4 py-2.5 flex gap-1 items-center">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div ref={messagesEndRef} />
              </div>

              {/* File preview bar */}
              {pendingFile && (
                <div className="px-4 pt-2 flex flex-wrap">
                  <FilePreview pending={pendingFile} onRemove={removePendingFile} />
                </div>
              )}

              {/* Input bar */}
              <div className="px-4 py-3 border-t border-white/10 flex gap-2 items-end relative">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,video/mp4,video/mov,video/avi,application/pdf,text/plain"
                  onChange={onFileSelected}
                />

                {/* Attach button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!!pendingFile || uploading}
                  title="Attach image or file"
                  className="p-2.5 text-gray-400 hover:text-yellow-300 hover:bg-white/10 rounded-xl transition-all disabled:opacity-40 shrink-0"
                >
                  📎
                </button>

                {/* Emoji picker for input */}
                <div className="relative shrink-0">
                  <button
                    ref={emojiButtonRef}
                    onClick={(ev) => { ev.stopPropagation(); setShowInputEmoji((v) => !v); setReactionPickerFor(null); }}
                    title="Add emoji"
                    className="p-2.5 text-gray-400 hover:text-yellow-300 hover:bg-white/10 rounded-xl transition-all"
                  >
                    😊
                  </button>
                  {showInputEmoji && (
                    <PortalPicker
                      anchorRef={emojiButtonRef}
                      align="right"
                      onPick={(e) => { setInput((v) => v + e); setShowInputEmoji(false); }}
                    />
                  )}
                </div>

                <input
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder={uploading ? 'Uploading…' : 'Type a message or paste a link…'}
                  disabled={uploading}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm
                    focus:border-yellow-300/60 focus:outline-none transition-all placeholder:text-gray-600 disabled:opacity-50"
                />

                <button
                  onClick={sendMessage}
                  disabled={(!input.trim() && !pendingFile) || sending || uploading}
                  className="px-4 py-2.5 bg-yellow-300 text-black font-black rounded-xl text-sm uppercase
                    hover:bg-yellow-200 active:scale-95 transition-all duration-200 disabled:opacity-40 shrink-0"
                >
                  {uploading ? '⏫' : sending ? '…' : 'Send'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
