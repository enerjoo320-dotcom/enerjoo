import React, { useState, useEffect, useRef } from 'react';
import { 
  Zap, 
  X, 
  Send, 
  RotateCcw, 
  Bot, 
  User, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isError?: boolean;
}

interface EnerjooAIChatProps {
  lang?: 'ar' | 'en';
  isOpen?: boolean;
  onClose?: () => void;
  showFloatingTrigger?: boolean;
}

const N8N_WEBHOOK_URL = 'https://enerjoo.app.n8n.cloud/webhook/798b6fd0-317b-47fc-9def-7fcf9dd04509/chat';
const STORAGE_SESSION_KEY = 'enerjoo_ai_chat_session_id';
const STORAGE_MESSAGES_KEY = 'enerjoo_ai_chat_history';

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'init-1',
    sender: 'assistant',
    text: 'أهلاً بيك في Enerjoo 👋',
    timestamp: new Date().toISOString()
  },
  {
    id: 'init-2',
    sender: 'assistant',
    text: 'قولي المشروع عندك بيت، مزرعة، محل، مصنع، ولا طلمبة مياه؟',
    timestamp: new Date().toISOString()
  }
];

const QUICK_PROMPTS = [
  '🏠 محطة طاقة شمسية منزلية (On-Grid)',
  '🌾 منظومة لمزرعة مع بطاريات (Off-Grid)',
  '💧 تشغيل طلمبة مياه ري زراعي',
  '📊 حساب الوفر وفاتورة الكهرباء الشهرية'
];

export default function EnerjooAIChat({ 
  lang = 'ar',
  isOpen: controlledIsOpen,
  onClose,
  showFloatingTrigger = false
}: EnerjooAIChatProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

  const handleClose = () => {
    if (isControlled) {
      onClose?.();
    } else {
      setInternalIsOpen(false);
    }
  };

  const handleOpen = () => {
    if (!isControlled) {
      setInternalIsOpen(true);
    }
  };

  // Support global custom event for opening chat seamlessly
  useEffect(() => {
    const handleGlobalOpen = () => {
      if (!isControlled) {
        setInternalIsOpen(true);
      }
    };
    window.addEventListener('open-enerjoo-ai-chat', handleGlobalOpen);
    return () => window.removeEventListener('open-enerjoo-ai-chat', handleGlobalOpen);
  }, [isControlled]);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_MESSAGES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filter out any previous "[object Object]" error messages so the user doesn't see old error artifacts
          const cleaned = parsed.filter(m => typeof m?.text === 'string' && !m.text.includes('[object Object]'));
          if (cleaned.length > 0) {
            return cleaned;
          }
        }
      }
    } catch {
      // Ignore localStorage errors
    }
    return INITIAL_MESSAGES;
  });

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() => {
    try {
      let currentId = localStorage.getItem(STORAGE_SESSION_KEY);
      if (!currentId) {
        currentId = `enerjoo-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem(STORAGE_SESSION_KEY, currentId);
      }
      return currentId;
    } catch {
      return `enerjoo-${Date.now()}`;
    }
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Remove any legacy default n8n DOM elements to guarantee zero duplicate launchers
  useEffect(() => {
    const purgeDefaultN8nElements = () => {
      document.querySelectorAll('#n8n-chat, .chat-window-wrapper, .chat-window-toggle, .chat-window, [class*="chat-window"]').forEach(el => {
        el.remove();
      });
    };
    purgeDefaultN8nElements();
    const interval = setInterval(purgeDefaultN8nElements, 500);
    return () => clearInterval(interval);
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MESSAGES_KEY, JSON.stringify(messages));
    } catch {
      // Ignore storage errors
    }
  }, [messages]);

  // Auto scroll to bottom of chat when new messages arrive or loading state changes
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? inputText).trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: text,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const payload = {
        action: 'sendMessage',
        sessionId: sessionId,
        chatInput: text
      };

      // Send request: Call n8n webhook directly (works on custom domains & Vercel with CORS), fallback to proxy if needed
      let response: Response;
      try {
        response = await fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*'
          },
          body: JSON.stringify(payload)
        });
      } catch (directErr) {
        // Fallback to server proxy if direct browser fetch hits a client network/CORS issue
        try {
          response = await fetch('/api/n8n-chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json, text/plain, */*'
            },
            body: JSON.stringify(payload)
          });
        } catch {
          throw directErr;
        }
      }

      if (!response.ok) {
        let errorMessage = 'نأسف، حدث خطأ أثناء الاتصال بمساعد Enerjoo الذكي.';
        
        try {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const errData = await response.json();
            const hint = typeof errData?.hint === 'string' ? errData.hint : '';
            const rawMsg = typeof errData?.message === 'string' 
              ? errData.message 
              : (typeof errData?.message?.message === 'string' ? errData.message.message : '');
            const rawErr = typeof errData?.error === 'string'
              ? errData.error
              : (typeof errData?.error?.message === 'string' ? errData.error.message : '');

            if (hint.includes('workflow must be active') || rawMsg.includes('not registered')) {
              errorMessage = '⚠️ مسار عمل الذكاء الاصطناعي (n8n Workflow) قيد التفعيل في لوحة التحكم. برجاء تفعيل زر (Active) في أعلى يمين شاشة n8n للاستجابة التلقائية.';
            } else if (rawMsg && rawMsg !== 'NOT_FOUND' && rawMsg !== 'The page could not be found') {
              errorMessage = `⚠️ تنبيه: ${rawMsg}`;
            } else if (rawErr) {
              errorMessage = `⚠️ تنبيه: ${rawErr}`;
            }
          } else {
            const textErr = await response.text();
            if (textErr.includes('workflow must be active') || textErr.includes('not registered')) {
              errorMessage = '⚠️ مسار عمل الذكاء الاصطناعي (n8n Workflow) قيد التفعيل في لوحة التحكم. برجاء تفعيل زر (Active) في أعلى يمين شاشة n8n للاستجابة التلقائية.';
            }
          }
        } catch {
          // If response is not parseable
        }

        const errorReply: ChatMessage = {
          id: `reply-${Date.now()}`,
          sender: 'assistant',
          text: errorMessage,
          timestamp: new Date().toISOString(),
          isError: true
        };
        setMessages(prev => [...prev, errorReply]);
        return;
      }

      // Handle successful n8n response safely
      let botReplyText = '';
      try {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await response.json();
          if (typeof data === 'string') {
            botReplyText = data;
          } else if (typeof data?.output === 'string') {
            botReplyText = data.output;
          } else if (typeof data?.text === 'string') {
            botReplyText = data.text;
          } else if (typeof data?.message === 'string') {
            botReplyText = data.message;
          } else if (typeof data?.message?.text === 'string') {
            botReplyText = data.message.text;
          } else if (typeof data?.message?.output === 'string') {
            botReplyText = data.message.output;
          } else if (Array.isArray(data) && data.length > 0) {
            const first = data[0];
            botReplyText = typeof first === 'string' 
              ? first 
              : (first?.output ?? first?.text ?? first?.message ?? '');
          } else if (data && typeof data === 'object') {
            const firstStringVal = Object.values(data).find(v => typeof v === 'string');
            if (firstStringVal) {
              botReplyText = firstStringVal as string;
            }
          }
        } else {
          botReplyText = await response.text();
        }
      } catch {
        botReplyText = await response.text();
      }

      if (!botReplyText.trim()) {
        botReplyText = 'تم استلام طلبك بنجاح وجارٍ مراجعة تفاصيل المنظومة الشمسية المطلوبة.';
      }

      const botReply: ChatMessage = {
        id: `reply-${Date.now()}`,
        sender: 'assistant',
        text: botReplyText,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, botReply]);
    } catch (err: any) {
      console.warn('Unable to complete request to n8n chat:', err?.message || err);
      const networkErrorReply: ChatMessage = {
        id: `reply-err-${Date.now()}`,
        sender: 'assistant',
        text: 'تعذر الاتصال بالخادم في الوقت الحالي. برجاء التأكد من اتصال الإنترنت ثم المحاولة مرة أخرى.',
        timestamp: new Date().toISOString(),
        isError: true
      };
      setMessages(prev => [...prev, networkErrorReply]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSession = () => {
    const newSessionId = `enerjoo-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setSessionId(newSessionId);
    try {
      localStorage.setItem(STORAGE_SESSION_KEY, newSessionId);
      localStorage.setItem(STORAGE_MESSAGES_KEY, JSON.stringify(INITIAL_MESSAGES));
    } catch {
      // Ignore
    }
    setMessages(INITIAL_MESSAGES);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Helper to format messages with bold text and line breaks cleanly
  const renderMessageContent = (text: string) => {
    return text.split('\n').map((line, lineIdx) => {
      // Handle bold markdown **text**
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <p key={lineIdx} className={lineIdx > 0 ? 'mt-1.5' : ''}>
          {parts.map((part, partIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={partIdx} className="font-bold text-slate-900">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return part;
          })}
        </p>
      );
    });
  };

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isControlled]);

  return (
    <>
      {/* 
        Optional Native Enerjoo AI Assistant Floating Trigger
        - Only rendered if showFloatingTrigger is explicitly true
      */}
      {showFloatingTrigger && !isOpen && (
        <button
          id="enerjoo-ai-trigger-btn"
          type="button"
          onClick={handleOpen}
          aria-label="مساعد Enerjoo AI"
          className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-3 md:px-5 md:py-3.5 rounded-full shadow-2xl hover:shadow-blue-500/30 flex items-center gap-2.5 transition-all transform hover:scale-105 active:scale-95 border-2 border-white/25 backdrop-blur-md cursor-pointer group select-none"
          title="⚡ مساعد Enerjoo AI"
        >
          {/* Animated Glowing Icon */}
          <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-white/20 text-white shrink-0">
            <Zap className="w-4 h-4 fill-amber-300 text-amber-300 animate-pulse" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-blue-600 rounded-full" />
          </div>

          <div className="flex flex-col text-right" dir="rtl">
            <div className="flex items-center gap-1.5">
              <span className="text-xs md:text-sm font-black tracking-wide leading-tight">
                ⚡ مساعد Enerjoo AI
              </span>
              <span className="text-[10px] bg-white/20 text-white/95 px-1.5 py-0.5 rounded-full font-bold hidden sm:inline-block">
                مباشر
              </span>
            </div>
            <span className="text-[10px] text-blue-100 font-bold leading-tight">
              اسأل واستشر فوراً
            </span>
          </div>
        </button>
      )}

      {/* Backdrop for mobile to easily close modal when tapping outside */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-40 sm:hidden transition-opacity"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      {/* 
        Custom Enerjoo AI Chat Panel / Modal
        - Preserves bottom navigation on mobile with bottom-22 gap
        - Clean floating panel on desktop
        - RTL typography and native Enerjoo styling
      */}
      {isOpen && (
        <div
          id="enerjoo-ai-chat-panel"
          dir="rtl"
          className={`fixed z-50 flex flex-col bg-white border border-slate-200/90 shadow-2xl overflow-hidden transition-all duration-300 animate-fade-in
            /* Mobile: Almost full-screen while leaving bottom navigation clearly accessible */
            inset-x-3 top-4 bottom-22 rounded-2xl
            /* Desktop / Tablet: Modern floating panel */
            sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[420px] sm:max-w-[calc(100vw-2rem)] sm:h-[620px] sm:max-h-[calc(100vh-5rem)] sm:rounded-3xl
          `}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white p-4 flex items-center justify-between shadow-md select-none shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-amber-300 shadow-inner">
                <Zap className="w-5 h-5 fill-amber-300 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black tracking-wide leading-none">
                    ⚡ Enerjoo AI
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    متصل
                  </span>
                </div>
                <p className="text-xs text-blue-100 font-medium mt-1 leading-none">
                  مساعدك الذكي في الطاقة الشمسية
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* New Conversation / Reset button */}
              <button
                type="button"
                onClick={handleResetSession}
                title="بدء محادثة جديدة"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white/90 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Close button */}
              <button
                type="button"
                onClick={handleClose}
                title="إغلاق"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white/90 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Subheader Banner */}
          <div className="bg-blue-50/80 border-b border-blue-100/80 px-4 py-2 flex items-center justify-between text-[11px] text-blue-900 font-medium shrink-0">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              مدعوم بمحرك Enerjoo الذكي للحسابات والمواصفات
            </span>
            <span className="text-slate-500 text-[10px]">
              محادثة آمنة
            </span>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/60">
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Avatar Icon */}
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-xs text-xs font-bold ${
                      isUser
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-blue-600 border border-slate-200'
                    }`}
                  >
                    {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-4 h-4 text-blue-600" />}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[82%] sm:max-w-[78%] rounded-2xl px-4 py-3 text-xs sm:text-sm shadow-xs ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-tl-xs'
                        : msg.isError
                        ? 'bg-amber-50 text-amber-950 border border-amber-200 rounded-tr-xs'
                        : 'bg-white text-slate-800 border border-slate-200/80 rounded-tr-xs'
                    }`}
                  >
                    <div className="leading-relaxed whitespace-pre-wrap">
                      {renderMessageContent(msg.text)}
                    </div>
                    <div
                      className={`text-[10px] mt-1.5 font-medium ${
                        isUser ? 'text-blue-200 text-left' : 'text-slate-400 text-right'
                      }`}
                      dir="ltr"
                    >
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing Indicator Bubble */}
            {isLoading && (
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-white text-blue-600 border border-slate-200 flex items-center justify-center shrink-0 shadow-xs">
                  <Bot className="w-4 h-4 text-blue-600" />
                </div>
                <div className="bg-white border border-slate-200/80 rounded-2xl rounded-tr-xs px-4 py-3 shadow-xs flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-slate-500 font-medium mr-1">
                    Enerjoo AI يفكر ويحسب...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions Chips */}
          <div className="px-3 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto scrollbar-hide shrink-0">
            {QUICK_PROMPTS.map((promptText, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(promptText)}
                disabled={isLoading}
                className="text-[11px] whitespace-nowrap px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 active:bg-blue-100 text-slate-700 hover:text-blue-700 border border-slate-200/70 rounded-full transition-colors cursor-pointer disabled:opacity-50"
              >
                {promptText}
              </button>
            ))}
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="اكتب احتياجك هنا..."
                disabled={isLoading}
                className="w-full bg-slate-100/90 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-full px-4 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"
                dir="rtl"
              />
            </div>

            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || isLoading}
              aria-label="إرسال"
              className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-200 text-white disabled:text-slate-400 flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 disabled:hover:scale-100 disabled:cursor-not-allowed shadow-md cursor-pointer shrink-0"
            >
              <Send className="w-4 h-4 transform -rotate-90 rtl:rotate-180" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
