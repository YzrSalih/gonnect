import { useState, useEffect, useRef } from 'react'
import { 
  Send, 
  Search, 
  MoreVertical, 
  PhoneCall, 
  Video, 
  Smile, 
  Paperclip, 
  Check, 
  CheckCheck,
  Zap
} from 'lucide-react'

// Dummy data for users list
const initialUsers = [
  { id: 1, name: 'General Chat', lastMsg: 'Welcome to Gonnect!', time: 'now', active: true, avatar: 'G', color: 'from-blue-500 to-cyan-400' },
  { id: 2, name: 'Alice', lastMsg: 'Go is insanely fast 🚀', time: '12:45', active: false, avatar: 'A', color: 'from-purple-500 to-pink-500' },
  { id: 3, name: 'Bob', lastMsg: 'React + Go = ❤️', time: '11:30', active: false, avatar: 'B', color: 'from-orange-500 to-red-500' },
  { id: 4, name: 'Charlie', lastMsg: 'Are we doing the deploy today?', time: 'Yesterday', active: false, avatar: 'C', color: 'from-emerald-500 to-teal-400' },
  { id: 5, name: 'System', lastMsg: 'Server update completed.', time: 'Monday', active: false, avatar: 'S', color: 'from-slate-600 to-slate-400' },
];

function App() {
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);
  const [currentMessage, setCurrentMessage] = useState("");
  const [myId] = useState(() => {
    let savedId = localStorage.getItem("gonnect_myId");
    if (!savedId) {
      savedId = "user_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("gonnect_myId", savedId);
    }
    return savedId;
  });

  const [myName, setMyName] = useState(() => {
    let savedName = localStorage.getItem("gonnect_myName");
    if (!savedName) {
      savedName = "User_" + Math.floor(Math.random() * 1000);
      localStorage.setItem("gonnect_myName", savedName);
    }
    return savedName;
  });

  useEffect(() => {
    localStorage.setItem("gonnect_myName", myName);
  }, [myName]);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Connect to Go Backend
    const newSocket = new WebSocket("ws://localhost:8080/ws");
    
    newSocket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        const incomingMessage = {
          id: msg.timestamp || Date.now() + Math.random(),
          user: msg.type === "system" ? "System" : (msg.senderId === myId ? 'Me' : msg.username), 
          text: msg.content,
          type: msg.type,
          time: new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => {
          // Additional safety check to avoid appending the exact same timestamp message twice just in case
          if (prev.find(m => m.id === incomingMessage.id && incomingMessage.type !== "system")) return prev;
          return [...prev, incomingMessage];
        });
      } catch (err) {
        // Fallback for non-JSON or older raw text while testing
        const incomingMessage = {
          id: Date.now(),
          user: 'Other', 
          text: event.data,
          type: 'chat',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, incomingMessage]);
      }
    };

    setSocket(newSocket);
    return () => newSocket.close();
  }, [myId]);

  const sendMessage = () => {
    if (socket && currentMessage.trim() !== "") {
      const payload = {
        type: "chat",
        senderId: myId,
        username: myName,
        content: currentMessage,
      };
      
      socket.send(JSON.stringify(payload));
      setCurrentMessage("");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') sendMessage();
  };

  return (
    <div className="flex h-screen bg-background text-white font-sans overflow-hidden">
      
      {/* Sidebar Overlay Pattern */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none"></div>
      
      {/* --- Sidebar Layout --- */}
      <div className="w-80 border-r border-[#2a2e37] bg-surface flex flex-col z-10 flex-shrink-0">
        
        {/* Sidebar Header */}
        <div className="h-20 px-6 flex items-center justify-between border-b border-surface-border backdrop-blur-md bg-surface/80 sticky top-0 relative group">
          <div className="flex items-center gap-3 w-full">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
              <Zap size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
			    <h1 className="text-lg font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-100 to-gray-400">Gonnect</h1>
                <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
			  </div>
              <input 
                type="text"
                value={myName}
                onChange={(e) => setMyName(e.target.value)}
                className="w-full bg-transparent text-xs text-primary font-medium focus:outline-none focus:text-white transition-colors"
                title="Click to edit your username"
              />
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="p-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Search or start new chat" 
              className="w-full bg-[#0f1115] border border-surface-border rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all placeholder-gray-500"
            />
          </div>
        </div>

        {/* Chats List */}
        <div className="flex-1 overflow-y-auto px-3 space-y-1 pb-4">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-3 py-2 mb-1">Messages</h2>
          {initialUsers.map(user => (
            <div 
              key={user.id} 
              className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-200 group
                ${user.active 
                  ? 'bg-surface-hover border border-surface-border/50' 
                  : 'hover:bg-[#13151a] border border-transparent'}`}
            >
              <div className="relative">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm bg-gradient-to-br ${user.color}`}>
                  {user.avatar}
                </div>
                {user.active && <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-surface rounded-full"></span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className="font-semibold text-gray-200 truncate pr-2 group-hover:text-white transition-colors">{user.name}</h3>
                  <span className={`text-[11px] font-medium transition-colors ${user.active ? 'text-primary' : 'text-gray-500'}`}>{user.time}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className={`text-sm truncate w-[90%] transition-colors ${user.active ? 'text-gray-300' : 'text-gray-500 group-hover:text-gray-400'}`}>
                    {user.lastMsg}
                  </p>
                  {user.id === 1 && <span className="bg-primary text-[10px] px-1.5 py-0.5 rounded-full font-bold">2</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- Main Chat Area Layout --- */}
      <div className="flex-1 flex flex-col relative bg-background">
        
        {/* Chat Background Pattern */}
        <div className="absolute inset-0 opacity-[0.02] bg-[radial-gradient(circle_at_center,_white_1px,_transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

        {/* Chat Header */}
        <div className="h-20 px-6 border-b border-surface-border bg-surface/40 backdrop-blur-md flex items-center justify-between flex-shrink-0 z-10 sticky top-0 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center font-bold text-lg shadow-md shadow-blue-500/20">
                G
              </div>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-100 leading-tight">General Chat</h2>
              <p className="text-xs text-gray-400 font-medium">12 members 🟢 Online</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-surface transition-all">
              <PhoneCall size={20} />
            </button>
            <button className="p-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-surface transition-all">
              <Video size={20} />
            </button>
            <div className="w-px h-6 bg-surface-border mx-1"></div>
            <button className="p-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-surface transition-all">
              <Search size={20} />
            </button>
          </div>
        </div>

        {/* Messages List Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 z-0">
          
          <div className="flex justify-center my-6">
            <span className="bg-surface px-4 py-1 rounded-full text-xs font-medium text-gray-400 border border-surface-border/50 backdrop-blur-sm shadow-sm">
              Today
            </span>
          </div>

          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-4">
              <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center mb-2 shadow-inner">
                <Zap className="text-primary opacity-50" size={32} />
              </div>
              <p className="text-gray-400 font-medium tracking-wide">No messages yet. Say hello!</p>
            </div>
          )}

          {messages.map((msg, idx) => {
            if (msg.type === "system") {
              return (
                <div key={msg.id} className="flex justify-center my-4 opacity-80">
                  <span className="text-xs font-medium text-gray-400 bg-surface/50 border border-surface-border px-4 py-1.5 rounded-full shadow-sm">
                    {msg.text}
                  </span>
                </div>
              );
            }

            const isMe = msg.user === 'Me';
            const showAvatar = !isMe && (idx === 0 || messages[idx - 1].user !== msg.user || messages[idx - 1].type === "system");

            return (
              <div key={msg.id} className={`flex items-end gap-2 group ${isMe ? 'justify-end' : 'justify-start'}`}>
                
                {/* Avatar for others */}
                {!isMe && (
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs bg-gradient-to-br from-indigo-500 to-purple-500 flex-shrink-0 shadow-sm ${showAvatar ? 'opacity-100' : 'opacity-0'}`}>
                    {msg.user.charAt(0).toUpperCase()}
                  </div>
                )}
                
                {/* Message Bubble */}
                <div className={`max-w-[65%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {showAvatar && (
                    <span className="text-xs text-gray-400 font-medium ml-1 mb-1 block">{msg.user}</span>
                  )}
                  
                  <div className={`relative px-4 py-2.5 shadow-sm text-[15px] leading-relaxed
                    ${isMe 
                      ? 'bg-primary text-white rounded-2xl rounded-br-sm shadow-primary/20' 
                      : 'bg-surface border border-surface-border text-gray-100 rounded-2xl rounded-bl-sm'}
                  `}>
                    <p className="whitespace-pre-wrap word-break">{msg.text}</p>
                    
                    <div className={`flex items-center gap-1 mt-1 justify-end ${isMe ? 'text-primary-100' : 'text-gray-500'}`}>
                      <span className="text-[10px] opacity-70">{msg.time}</span>
                      {isMe && <CheckCheck size={12} className="opacity-70 text-blue-200" />}
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
          <div ref={messagesEndRef} className="h-4" />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-background z-10 pb-6 shrink-0 relative">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-surface-border to-transparent"></div>
          <div className="max-w-4xl mx-auto flex items-end gap-2 bg-surface/50 border border-surface-border rounded-3xl p-1.5 focus-within:ring-2 focus-within:ring-primary/30 focus-within:bg-surface transition-all shadow-lg backdrop-blur-sm">
            
            <button className="p-3 text-gray-400 hover:text-primary transition-colors rounded-full hover:bg-surface-hover shrink-0">
              <Paperclip size={20} />
            </button>
            <button className="p-3 text-gray-400 hover:text-primary transition-colors rounded-full hover:bg-surface-hover shrink-0 hidden sm:block">
              <Smile size={20} />
            </button>

            <textarea
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type a message... (Enter to send)"
              className="flex-1 bg-transparent border-none focus:outline-none text-[15px] p-3 text-gray-100 placeholder-gray-500 resize-none max-h-32 min-h-[44px] custom-scrollbar overflow-y-auto"
              rows={1}
            />

            <button
              onClick={sendMessage}
              disabled={!currentMessage.trim()}
              className="m-1 p-3 bg-primary text-white rounded-full hover:bg-primary-hover disabled:opacity-50 disabled:bg-surface-border disabled:text-gray-500 transition-all shadow-md shrink-0 focus:scale-95 active:scale-90"
            >
              <Send size={18} className={currentMessage.trim() ? "translate-x-0.5 -translate-y-0.5" : ""} />
            </button>

          </div>
        </div>

      </div>
    </div>
  )
}

export default App