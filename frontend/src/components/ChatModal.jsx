import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { X, Send, MessageSquare, Loader } from "lucide-react";

export default function ChatModal({ candidateId, candidateName, profile, session, onClose, zIndex = "z-50" }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [text, setText]         = useState("");
  const [sending, setSending]   = useState(false);
  const bottomRef               = useRef(null);

  const senderRole = profile?.role === "admin" ? "admin" : "vendor";
  const senderName = session?.user?.email?.split("@")[0] ?? senderRole;

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("candidate_messages")
      .select("*")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!cancelled) { setMessages(data ?? []); setLoading(false); }
      });

    const channel = supabase
      .channel(`chat-${candidateId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "candidate_messages",
          filter: `candidate_id=eq.${candidateId}` },
        (payload) => {
          setMessages(prev =>
            prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new]
          );
        }
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [candidateId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    const { error } = await supabase.from("candidate_messages").insert({
      candidate_id: candidateId,
      sender_id:    session.user.id,
      sender_name:  senderName,
      sender_role:  senderRole,
      content:      trimmed,
    });
    if (!error) setText("");
    setSending(false);
  }

  return (
    <div className={`fixed bottom-4 right-4 w-[360px] h-[520px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col ${zIndex} overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="w-4 h-4 text-white flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">{candidateName}</p>
            <p className="text-white/60 text-[10px]">Recruiter ↔ Vendor</p>
          </div>
        </div>
        <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1 flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading && (
          <div className="flex justify-center mt-8">
            <Loader className="w-5 h-5 text-indigo-400 animate-spin" />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <p className="text-center text-xs text-gray-400 mt-10 px-4">
            No messages yet. Start the conversation about this candidate.
          </p>
        )}
        {messages.map((msg) => {
          const isMe = msg.sender_id === session.user.id;
          const time = new Date(msg.created_at).toLocaleTimeString([], {
            hour: "2-digit", minute: "2-digit",
          });
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`flex flex-col gap-0.5 max-w-[78%] ${isMe ? "items-end" : "items-start"}`}>
                {!isMe && (
                  <span className="text-[10px] text-gray-400 ml-1 flex items-center gap-1">
                    {msg.sender_name}
                    <span className={`px-1.5 py-px rounded-full text-[9px] font-semibold ${
                      msg.sender_role === "admin"
                        ? "bg-purple-100 text-purple-600"
                        : "bg-blue-100 text-blue-600"
                    }`}>
                      {msg.sender_role === "admin" ? "Recruiter" : "Vendor"}
                    </span>
                  </span>
                )}
                <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  isMe
                    ? "bg-indigo-600 text-white rounded-br-md"
                    : "bg-gray-100 text-gray-800 rounded-bl-md"
                }`}>
                  {msg.content}
                </div>
                <span className="text-[10px] text-gray-300 mx-1">{time}</span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend}
        className="flex gap-2 px-3 pb-3 pt-2 border-t border-gray-100 flex-shrink-0">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 bg-gray-50
                     focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700
                     disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
