// FILE: apps/web/app/(checkout)/pay/demo/page.tsx
'use client'
import { CheckCircle2, ArrowLeft, ShieldCheck, Globe } from 'lucide-react'
import CheckoutForm from '../[id]/CheckoutForm'
import Link from 'next/link'

export default function PayDemoPage() {
   const mockPayment = {
      id: 'DEMO-777',
      amount: '125.00',
      token_symbol: 'ETH',
      token_address: null,
      reason: 'ChainBot Pro Node',
      status: 'pending',
      recipient_address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
   }

   return (
      <div className="min-h-screen bg-[#FDFCFB] flex flex-col items-center py-12 md:py-24 px-4 font-sans selection:bg-[#00C9B1]/10 text-[#1A1F36]">
         <div className="max-w-[440px] w-full space-y-12">
            {/* Simple Header */}
            <div className="flex items-center justify-between px-2">
               <Link href="/" className="flex items-center gap-2 text-[#4F566B] hover:text-[#1A1F36] transition-all group">
                  <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                  <span className="text-[13px] font-bold tracking-tight">Back</span>
               </Link>
               <div className="flex items-center gap-2 px-3 py-1 bg-[#F1F5F9] rounded-full">
                  <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Demo Sandbox</span>
               </div>
            </div>

            {/* Order Summary Block */}
            <div className="text-center space-y-6">
            <div className="flex justify-center">
               <div className="h-24 w-24 bg-white rounded-3xl shadow-[0_12px_40px_rgb(0,0,0,0.08)] border border-[#E6EBF1] flex items-center justify-center overflow-hidden p-1">
                  <img src="/logo.png" alt="ChainBot Logo" className="w-full h-full object-cover rounded-2xl" />
               </div>
            </div>
               <div className="space-y-2">
                  <h2 className="text-[22px] font-bold text-[#1A1F36] tracking-tight leading-tight">ChainBot Pro Node</h2>
                  <p className="text-[14px] font-medium text-[#4F566B] opacity-60">High-performance sovereign infrastructure deployment</p>

                  <div className="pt-4 flex flex-col items-center gap-1">
                     <div className="flex items-baseline gap-1.5">
                        <span className="text-[56px] font-extrabold text-[#1A1F36] tracking-[-0.05em] leading-none">
                           ${mockPayment.amount.split('.')[0]}
                           <span className="text-[28px] opacity-30 font-bold">.{mockPayment.amount.split('.')[1] || '00'}</span>
                        </span>
                        <span className="text-[18px] font-bold text-[#4F566B] opacity-20 tracking-tight">USD</span>
                     </div>
                     <p className="text-[12px] font-bold text-[#00C9B1] bg-[#00C9B1]/5 px-2 py-0.5 rounded tracking-tight">
                        ≈ 0.051 ETH at $2,451/ETH
                     </p>
                  </div>
               </div>
            </div>

            {/* The Payment Form */}
            <div className="bg-[#FAFAF8] rounded-[28px] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.08),0_20px_40px_-20px_rgba(0,0,0,0.04)] border border-[#E6EBF1] p-10 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-[#00C9B1]" />
               <CheckoutForm payment={mockPayment} />
            </div>

            {/* Trust Link */}
            <div className="text-center">
               <Link 
                  href="https://etherscan.io/address/0x4a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t" 
                  target="_blank"
                  className="text-[11px] font-bold text-[#4F566B] opacity-40 hover:opacity-100 transition-opacity uppercase tracking-[0.2em] inline-flex items-center gap-2 hover:text-[#00C9B1]"
               >
                  Verified Contract: 0x4a...s9t
                  <Globe size={12} strokeWidth={2.5} />
               </Link>
            </div>
         </div>
      </div>
   )
}
