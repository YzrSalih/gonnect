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
  Zap,
  ChevronRight,
  UserPlus,
  MessageSquare
} from 'lucide-react'

function App() {
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem("gonnect_myId"));
  const [phoneInput, setPhoneInput] = useState(localStorage.getItem("gonnect_myPhone") || "");
  const [nameInput, setNameInput] = useState(localStorage.getItem("gonnect_myName") || "");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [myId, setMyId] = useState(localStorage.getItem("gonnect_myId") || "");
  const [myName, setMyName] = useState(localStorage.getItem("gonnect_myName") || "");
  const [myPhone, setMyPhone] = useState(localStorage.getItem("gonnect_myPhone") || "");

  const [contacts, setContacts] = useState([]);
  const [activeChat, setActiveChat] = useState(null);

  const normalizePhone = (p) => p ? p.replace(/[\s+\-()]/g, '') : '';

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const invitePhone = urlParams.get('invite');
    const inviteName = urlParams.get('name') || "New Contact";
    
    if (invitePhone && normalizePhone(invitePhone) !== normalizePhone(localStorage.getItem("gonnect_myPhone"))) {
      const newContact = { 
        id: normalizePhone(invitePhone), 
        phone: invitePhone, 
        name: inviteName, 
        active: true, 
        avatar: inviteName.charAt(0).toUpperCase(), 
        color: 'from-emerald-500 to-teal-400' 
      };
      setContacts([newContact]);
      setActiveChat(newContact);
      window.history.replaceState({}, document.title, "/");
    }
  }, []);

  const copyInviteLink = () => {
      const link = `http://${window.location.host}/?invite=${encodeURIComponent(myPhone)}&name=${encodeURIComponent(myName)}`;
      navigator.clipboard.writeText(link);
      alert("Invite link copied to clipboard!");
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const res = await fetch(`http://${window.location.hostname}:8080/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneInput, nickname: nameInput })
      });
      if (!res.ok) throw new Error("Login failed");
      const data = await res.json();
      
      localStorage.setItem("gonnect_myId", data.id);
      localStorage.setItem("gonnect_myName", data.nickname);
      localStorage.setItem("gonnect_myPhone", data.phone_number);
      
      setMyId(data.id);
      setMyName(data.nickname);
      setMyPhone(data.phone_number);
      setIsAuthenticated(true);
    } catch (err) {
      alert("Failed to connect to server. Ensure Backend is running.");
    }
    setIsLoggingIn(false);
  };

  useEffect(() => {
    if (myName) localStorage.setItem("gonnect_myName", myName);
  }, [myName]);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Dynamically extract contacts from incoming or past messages
  useEffect(() => {
    if (!myPhone) return;
    
    setContacts(prevContacts => {
      let updated = [...prevContacts];
      let hasChanges = false;
      
      messages.forEach(msg => {
        if (msg.type === "system") return;
        
        let targetPhone = null;
        let targetName = null;

        const normTarget = normalizePhone(msg.targetId);
        const normSender = normalizePhone(msg.senderId);
        const normMyPhone = normalizePhone(myPhone);

        if (normTarget === normMyPhone && normSender) {
          targetPhone = msg.senderId; // Keep original format for display/reply
          targetName = msg.user && msg.user !== "Me" ? msg.user : "Unknown";
        } 
        else if (normSender === normMyPhone && normTarget) {
          targetPhone = msg.targetId;
          targetName = msg.targetName || ("Contact " + msg.targetId.slice(-4));
        }

        if (targetPhone) {
           let existing = updated.find(c => normalizePhone(c.phone) === normalizePhone(targetPhone));
           
           if (!existing) {
             updated.push({
               id: normalizePhone(targetPhone),
               phone: targetPhone,
               name: targetName,
               active: false,
               avatar: targetName.charAt(0).toUpperCase(),
               color: 'from-blue-500 to-cyan-400'
             });
             hasChanges = true;
           } else if (targetName && targetName !== "Unknown" && !targetName.startsWith("Contact ") && existing.name.startsWith("Contact ")) {
             // If we found their real name and previously had 'Contact 1234', update it!
             existing.name = targetName;
             existing.avatar = targetName.charAt(0).toUpperCase();
             hasChanges = true;
           }
        }
      });
      
      return hasChanges ? updated : prevContacts;
    });
  }, [messages, myPhone]);

  useEffect(() => {
    if (!isAuthenticated) return;
    // Connect to Go Backend (dynamically resolves localhost or container host IP)
    const newSocket = new WebSocket(`ws://${window.location.hostname}:8080/ws`);
    
    newSocket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        const incomingMessage = {
          id: msg.timestamp || Date.now() + Math.random(),
          user: msg.type === "system" ? "System" : (normalizePhone(msg.senderId) === normalizePhone(myPhone) ? 'Me' : msg.username), 
          senderId: msg.senderId,
          targetId: msg.targetId,
          targetName: msg.targetName,
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
    if (socket && currentMessage.trim() !== "" && activeChat) {
      const payload = {
        type: "chat",
        senderId: myPhone,
        username: myName,
        targetId: activeChat.phone,
        content: currentMessage,
      };
      
      socket.send(JSON.stringify(payload));
      setCurrentMessage("");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') sendMessage();
  };

  // ------------------------------------
  // LOGIN SCREEN
  // ------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-white font-sans relative overflow-hidden">
        {/* Background gradient/decoration */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        
        <form onSubmit={handleLogin} className="z-10 bg-surface/50 backdrop-blur-xl border border-surface-border/50 p-10 rounded-[2rem] shadow-2xl w-full max-w-md flex flex-col items-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center shadow-lg shadow-primary/20 mb-6">
              <Zap size={36} className="text-white" />
            </div>
            
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-100 to-gray-400 mb-2 tracking-tight">Gonnect</h1>
            <p className="text-gray-400 text-[15px] mb-8 text-center font-medium">Enter your phone number and nickname to get started.</p>

            <div className="w-full space-y-4">
               <div>
                 <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block ml-1">Phone Number</label>
                 <div className="relative">
                   <PhoneCall size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                   <input 
                     type="tel" 
                     required
                     value={phoneInput} 
                     onChange={(e) => setPhoneInput(e.target.value)}
                     className="w-full bg-[#13151a]/80 border border-surface-border/50 rounded-2xl pl-12 pr-4 py-3.5 text-[15px] text-white focus:outline-none focus:border-primary focus:bg-[#13151a] transition-all shadow-inner"
                     placeholder="+1 (555) 000-0000"
                   />
                 </div>
               </div>
               
               <div>
                 <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block ml-1">Nickname</label>
                 <div className="relative">
                   <Smile size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                   <input 
                     type="text" 
                     required
                     value={nameInput} 
                     onChange={(e) => setNameInput(e.target.value)}
                     className="w-full bg-[#13151a]/80 border border-surface-border/50 rounded-2xl pl-12 pr-4 py-3.5 text-[15px] text-white focus:outline-none focus:border-primary focus:bg-[#13151a] transition-all shadow-inner"
                     placeholder="Your display name"
                   />
                 </div>
               </div>
            </div>

            <button disabled={isLoggingIn} className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-2xl mt-8 transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] flex items-center justify-center gap-2 group">
               <span className="text-[15px] tracking-wide">{isLoggingIn ? "CONNECTING..." : "START MESSAGING"}</span>
               {!isLoggingIn && <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />}
            </button>
            <p className="text-[11px] text-gray-500 mt-6 font-medium">End-to-End Encrypted via Go WebSockets</p>
        </form>
      </div>
    );
  }

  // ------------------------------------
  // MAIN APP UI
  // ------------------------------------
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
          <button 
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }} 
            title="Sign Out" 
            className="p-2 rounded-full hover:bg-surface-hover text-gray-400 hover:text-red-400 transition-colors shrink-0"
          >
            <MoreVertical size={20} />
          </button>
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
          {contacts.length === 0 && (
            <div className="p-4 text-center text-gray-500 text-sm">
              No contacts yet. Invite a friend!
            </div>
          )}
          {contacts.map(contact => (
            <div 
              key={contact.id} 
              onClick={() => setActiveChat(contact)}
              className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-200 group
                ${activeChat?.id === contact.id 
                  ? 'bg-surface-hover border border-surface-border/50' 
                  : 'hover:bg-[#13151a] border border-transparent'}`}
            >
              <div className="relative">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm bg-gradient-to-br ${contact.color}`}>
                  {contact.avatar}
                </div>
                {activeChat?.id === contact.id && <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-surface rounded-full"></span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className="font-semibold text-gray-200 truncate pr-2 group-hover:text-white transition-colors">{contact.name}</h3>
                  <span className={`text-[11px] font-medium transition-colors ${activeChat?.id === contact.id ? 'text-primary' : 'text-gray-500'}`}>{contact.time || 'now'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className={`text-sm truncate w-[90%] transition-colors ${activeChat?.id === contact.id ? 'text-gray-300' : 'text-gray-500 group-hover:text-gray-400'}`}>
                    Select to chat
                  </p>
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

        {!activeChat ? (
          <div className="flex-1 flex flex-col items-center justify-center relative z-10 w-full h-full p-8">
             <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary-hover/20 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(59,130,246,0.15)]">
                <MessageSquare size={48} className="text-primary" />
             </div>
             <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-100 to-gray-400 mb-3 tracking-tight">Welcome to Gonnect</h2>
             <p className="text-gray-500 max-w-sm text-center mb-8 font-medium leading-relaxed">Send and receive messages privately. Invite a friend to start chatting instantly!</p>
             <button onClick={copyInviteLink} className="bg-primary hover:bg-primary-hover text-white font-bold py-3.5 px-8 rounded-2xl transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] flex items-center justify-center gap-2 group focus:scale-95 active:scale-90">
                <UserPlus size={20} className="group-hover:-rotate-12 transition-transform" />
                <span className="tracking-wide">Invite a Friend</span>
             </button>
             <p className="absolute bottom-8 text-xs text-gray-500 font-medium opacity-60">Gonnect Real-Time Engine</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="h-20 px-6 border-b border-surface-border bg-surface/40 backdrop-blur-md flex items-center justify-between flex-shrink-0 z-10 sticky top-0 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${activeChat.color} flex items-center justify-center font-bold text-lg shadow-md shadow-blue-500/20`}>
                    {activeChat.avatar}
                  </div>
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-100 leading-tight">{activeChat.name}</h2>
                  <p className="text-xs text-gray-400 font-medium truncate w-[150px] sm:w-[300px]">+{activeChat.phone}</p>
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
                  Conversation with {activeChat.name}
                </span>
              </div>

              {messages.filter(msg => {
                 if (msg.type === "system") return false;
                 return (normalizePhone(msg.senderId) === normalizePhone(myPhone) && normalizePhone(msg.targetId) === normalizePhone(activeChat.phone)) || 
                        (normalizePhone(msg.senderId) === normalizePhone(activeChat.phone) && normalizePhone(msg.targetId) === normalizePhone(myPhone));
              }).length === 0 && (
                <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-4">
                  <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center mb-2 shadow-inner">
                    <Zap className="text-primary opacity-50" size={32} />
                  </div>
                  <p className="text-gray-400 font-medium tracking-wide">No messages yet. Say hello!</p>
                </div>
              )}

              {messages
                .filter(msg => {
                   if (msg.type === "system") return false; // We can hide system messages in private chats for cleaner look
                   return (normalizePhone(msg.senderId) === normalizePhone(myPhone) && normalizePhone(msg.targetId) === normalizePhone(activeChat.phone)) || 
                          (normalizePhone(msg.senderId) === normalizePhone(activeChat.phone) && normalizePhone(msg.targetId) === normalizePhone(myPhone));
                })
                .map((msg, idx, arr) => {

                const isMe = msg.user === 'Me';
                const showAvatar = !isMe && (idx === 0 || arr[idx - 1].user !== msg.user);

                return (
                  <div key={msg.id} className={`flex items-end gap-2 group ${isMe ? 'justify-end' : 'justify-start'}`}>
                    
                    {/* Avatar for others */}
                    {!isMe && (
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs bg-gradient-to-br ${activeChat.color} flex-shrink-0 shadow-sm ${showAvatar ? 'opacity-100' : 'opacity-0'}`}>
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
          </>
        )}
      </div>
    </div>
  )
}

export default App