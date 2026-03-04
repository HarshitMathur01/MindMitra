import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Personality } from '@/data/personalities'

interface PersonalityPreviewChatProps {
  personality: Personality
  /** Optional custom name the user has given their companion */
  customName?: string
}

export function PersonalityPreviewChat({ personality, customName }: PersonalityPreviewChatProps) {
  const displayName = customName?.trim() || personality.name
  const [messages, setMessages] = useState<{ role: 'bot' | 'user'; text: string }[]>([])
  const [userInput, setUserInput] = useState('')
  const [showSample, setShowSample] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Reset chat when personality or custom name changes
  useEffect(() => {
    // Replace the personality's default name in the greeting with the custom name
    const greeting = displayName !== personality.name
      ? personality.greeting.replace(personality.name, displayName)
      : personality.greeting
    setMessages([{ role: 'bot', text: greeting }])
    setShowSample(false)
    setUserInput('')
  }, [personality.id, displayName])

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    const trimmed = userInput.trim()
    if (!trimmed) return
    setMessages(prev => [...prev, { role: 'user', text: trimmed }])
    setUserInput('')
    // Show sample response after short delay
    setShowSample(true)
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'bot', text: personality.sampleResponse }])
      setShowSample(false)
    }, 800)
  }

  return (
    <motion.div
      key={personality.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-border bg-surface/50 overflow-hidden"
      style={{
        borderColor: `${personality.colorAccent}30`,
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-2.5 text-sm font-medium flex items-center gap-2"
        style={{ backgroundColor: `${personality.colorAccent}10` }}
      >
        <span className="text-base">{personality.emoji}</span>
        <span className="text-text-primary">
          This is how {displayName} will talk to you
        </span>
      </div>

      {/* Chat area */}
      <div
        ref={scrollRef}
        className="px-4 py-3 space-y-3 max-h-52 overflow-y-auto"
      >
        <AnimatePresence mode="popLayout">
          {messages.map((msg, i) => (
            <motion.div
              key={`${personality.id}-${i}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, delay: i === messages.length - 1 ? 0.1 : 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-primary/10 text-text-primary rounded-br-md'
                    : 'rounded-bl-md text-text-primary'
                }`}
                style={
                  msg.role === 'bot'
                    ? { backgroundColor: `${personality.colorAccent}12` }
                    : undefined
                }
              >
                {msg.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {showSample && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div
              className="rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm text-text-secondary"
              style={{ backgroundColor: `${personality.colorAccent}08` }}
            >
              <span className="inline-flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 pb-3 pt-1">
        <div className="flex gap-2">
          <input
            type="text"
            value={userInput}
            onChange={e => setUserInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Try saying something..."
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 transition-shadow"
            style={{ focusRingColor: personality.colorAccent } as any}
            aria-label="Type a test message"
          />
          <button
            onClick={handleSend}
            disabled={!userInput.trim() || showSample}
            className="rounded-xl px-4 py-2 text-sm font-medium text-white transition-all duration-200 disabled:opacity-40"
            style={{ backgroundColor: personality.colorAccent }}
            aria-label="Send test message"
          >
            Send
          </button>
        </div>
        <p className="text-xs text-text-secondary/60 mt-1.5 ml-1">
          Preview only — no data is saved
        </p>
      </div>
    </motion.div>
  )
}
