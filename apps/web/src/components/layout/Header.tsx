'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Wallet, Activity } from 'lucide-react'
import { formatAddress } from '@/lib/utils'

function LiveGlyph() {
  const [glyph, setGlyph] = useState('█')
  const glyphs = ['█', '▓', '▒', '░', '¶', '§', 'Δ', 'Ω', 'Σ']
  
  useEffect(() => {
    const interval = setInterval(() => {
      setGlyph(glyphs[Math.floor(Math.random() * glyphs.length)])
    }, 150)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="w-8 h-8 flex items-center justify-center font-mono text-xl text-primary border border-primary/20 rounded-lg bg-primary/5">
      {glyph}
    </div>
  )
}

function FrequencyVisualizer() {
  return (
    <div className="flex items-end gap-0.5 h-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <motion.div
          key={i}
          animate={{ height: [2, 12, 4, 10, 2] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
          className="w-[2px] bg-primary/40"
        />
      ))}
    </div>
  )
}

export default function Header() {
  const [account, setAccount] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const connectWallet = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      alert('MetaMask not detected. Please install MetaMask.')
      return
    }
    try {
      const accounts = (await (window as any).ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[]
      setAccount(accounts[0] || null)
    } catch {
      // User rejected
    }
  }

  const navLinks = [
    { href: 'https://chainbot.animeos.dev/docs', label: 'Docs' },
  ]

  return (
    <header
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-7xl transition-all duration-500 ${
        scrolled
          ? 'bg-black/60 backdrop-blur-2xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]'
          : 'bg-transparent'
      } rounded-2xl overflow-hidden`}
      style={{ height: 72 }}
    >
      {/* Glowing Bottom Line (Restored) */}
      <div className={`absolute bottom-0 left-12 right-12 h-[1px] bg-gradient-to-r from-transparent via-primary/60 to-transparent transition-opacity duration-500 ${scrolled ? 'opacity-100' : 'opacity-0'}`} />

      {/* HUD Corner Decor */}
      <div className="absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-primary/20" />
      <div className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-primary/20" />

      <div className="flex h-full items-center justify-between px-8">
        
        {/* Brand Control */}
        <div className="flex items-center gap-12">
          <Link href="/" className="flex items-center gap-4 group">
            <div className="flex flex-col">
              <span className="font-title text-sm font-bold tracking-[0.3em] text-white uppercase group-hover:text-primary transition-colors">
                ChainBot
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-mono text-white/20 uppercase tracking-[0.5em]">SYSTEM_STABLE</span>
                <FrequencyVisualizer />
              </div>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[10px] font-mono font-bold text-white/40 hover:text-white uppercase tracking-[0.2em] transition-all relative group"
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-primary group-hover:w-full transition-all duration-300" />
              </Link>
            ))}
          </nav>
        </div>

        {/* Right side: Actions & Status */}
        <div className="flex items-center gap-6">
          <div className="hidden lg:flex flex-col items-end gap-0">
            <span className="text-[8px] font-mono text-white/20 uppercase tracking-widest">Protocol_Pulse</span>
            <span className="text-[10px] font-mono font-bold text-primary uppercase tracking-widest">99.98%_SYNC</span>
          </div>

          <motion.button
            onClick={connectWallet}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="group relative flex items-center gap-3 px-6 py-2.5 rounded-xl bg-primary text-black font-title font-bold uppercase tracking-[0.1em] text-[10px] transition-all overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300" />
            <span className="relative z-10">{account ? formatAddress(account) : 'Initiate Session'}</span>
          </motion.button>

          {/* Mobile hamburger */}
          <button
            className="flex items-center justify-center text-white/40 hover:text-white md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-black/95 backdrop-blur-2xl border-t border-white/10 md:hidden overflow-hidden"
          >
            <div className="p-8 space-y-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="block text-xs font-mono font-bold text-white/40 hover:text-primary uppercase tracking-[0.4em]"
                >
                  {link.label}
                </Link>
              ))}
              <button
                onClick={() => { connectWallet(); setMenuOpen(false) }}
                className="w-full flex items-center justify-center gap-3 rounded-xl bg-primary px-6 py-4 text-xs font-bold text-black uppercase tracking-[0.2em]"
              >
                <Wallet className="h-4 w-4" />
                {account ? formatAddress(account) : 'Initiate Session'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

