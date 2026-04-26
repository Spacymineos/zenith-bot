// FILE: apps/web/app/(checkout)/pay/[id]/CheckoutForm.tsx
'use client'
import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { Wallet, CreditCard, Loader2, AlertCircle, Copy, Check, Info, Globe, Lock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CheckoutForm({ payment }: { payment: any }) {
   const [loading, setLoading] = useState(false)
   const [error, setError] = useState<string | null>(null)
   const [copied, setCopied] = useState(false)
   const [method, setMethod] = useState<'wallet' | 'manual'>('wallet')
   const [connectedAddress, setConnectedAddress] = useState<string | null>(null)
   const [selectedToken, setSelectedToken] = useState('ETH')
   const router = useRouter()

   const [ethPrice, setEthPrice] = useState<number | null>(null)
   const [gasPrice, setGasPrice] = useState<string | null>(null)

   useEffect(() => {
      const fetchData = async () => {
         try {
            // Fetch ETH Price
            const priceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
            const priceData = await priceRes.json()
            setEthPrice(priceData.ethereum.usd)

            // Fetch Gas Price (Etherscan or similar API would be better, but let's use a mock for demo if no provider)
            if (window.ethereum) {
               const provider = new ethers.BrowserProvider(window.ethereum)
               const feeData = await provider.getFeeData()
               if (feeData.gasPrice) {
                  const gwei = ethers.formatUnits(feeData.gasPrice, 'gwei')
                  setGasPrice(parseFloat(gwei).toFixed(0))
               }
            } else {
               setGasPrice('24') // Default fallback gwei
            }
         } catch (e) {
            console.error('Failed to fetch data', e)
            setEthPrice(2451)
            setGasPrice('28')
         }
      }
      fetchData()
      const interval = setInterval(fetchData, 30000) // Update every 30s
      return () => clearInterval(interval)
   }, [])

   const usdAmount = parseFloat(payment.amount)
   const ethAmount = ethPrice ? (usdAmount / ethPrice).toFixed(4) : '0.0510'

   const tokens = [
      { symbol: 'ETH', name: 'Ethereum', conversion: ethAmount },
      { symbol: 'USDC', name: 'USD Coin', conversion: usdAmount.toFixed(2) },
      { symbol: 'USDT', name: 'Tether', conversion: usdAmount.toFixed(2) },
   ]

   const currentToken = tokens.find(t => t.symbol === selectedToken) || tokens[0]

   const handlePayWithWallet = async () => {
      setLoading(true)
      setError(null)
      try {
         if (!window.ethereum) throw new Error('Please install MetaMask to continue.')

         const provider = new ethers.BrowserProvider(window.ethereum)
         const signer = await provider.getSigner()
         const address = await signer.getAddress()
         setConnectedAddress(address)

         let tx;
         
         if (selectedToken === 'ETH') {
            tx = await signer.sendTransaction({
               to: payment.recipient_address,
               value: ethers.parseEther(currentToken.conversion.toString())
            })
         } else {
            // Placeholder for token addresses - in a real app these would come from config
            const tokenAddresses: Record<string, string> = {
               'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
               'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7'
            }
            const abi = ["function transfer(address to, uint256 amount) public returns (bool)"];
            const contract = new ethers.Contract(tokenAddresses[selectedToken], abi, signer);
            tx = await contract.transfer(payment.recipient_address, ethers.parseUnits(currentToken.conversion.toString(), selectedToken === 'USDC' || selectedToken === 'USDT' ? 6 : 18));
         }

         await tx.wait()

         await fetch('/api/pay/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: payment.id, txHash: tx.hash, token: selectedToken })
         })

         router.refresh()
      } catch (err: any) {
         setError(err.message || 'Transaction failed. Please try again.')
      } finally {
         setLoading(false)
      }
   }

   const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
   }

   const shortAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

   return (
      <div className="space-y-8 py-2 font-sans text-[#1A1F36]">
         <div className="space-y-6">
            <div className="space-y-4">
               <div className="flex items-center justify-between">
                  <h3 className="text-[14px] font-bold text-[#1A1F36] tracking-[-0.01em] normal-case">Payment method</h3>
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-700 rounded-md border border-green-100">
                     <div className="h-1 w-1 rounded-full bg-green-500 animate-pulse" />
                     <span className="text-[10px] font-bold uppercase tracking-wider">Mainnet</span>
                  </div>
               </div>

               <div className="border border-[#E6EBF1] rounded-xl overflow-hidden bg-white shadow-[0_2px_4px_rgba(0,0,0,0.02)]">
                  <div
                     onClick={() => setMethod('wallet')}
                     className={`p-4 flex items-center gap-3 cursor-pointer transition-colors ${method === 'wallet' ? 'bg-[#F9FAFB]' : 'hover:bg-[#F9FAFB]/50'}`}
                  >
                     <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${method === 'wallet' ? 'border-[#00C9B1]' : 'border-[#E6EBF1]'}`}>
                        {method === 'wallet' && <div className="h-2 w-2 rounded-full bg-[#00C9B1]" />}
                     </div>
                     <Wallet size={18} className="text-[#4F566B]" strokeWidth={2.2} />
                     <div className="flex-1 flex items-center justify-between">
                        <span className="text-[14px] font-semibold text-[#1A1F36] tracking-tight italic">MetaMask or Web3 Wallet</span>
                        {connectedAddress && (
                           <span className="text-[11px] font-mono text-[#00C9B1] bg-[#00C9B1]/5 px-1.5 py-0.5 rounded border border-[#00C9B1]/10 font-bold">
                              {shortAddress(connectedAddress)}
                           </span>
                        )}
                     </div>
                  </div>

                  {method === 'wallet' && (
                     <div className="px-4 pb-4 border-t border-[#E6EBF1] pt-4 animate-in fade-in duration-300 space-y-5">
                        {/* Multi-currency Selector */}
                        <div className="space-y-2">
                           <p className="text-[10px] font-bold text-[#4F566B] uppercase tracking-wider opacity-60 px-1">Select Asset</p>
                           <div className="grid grid-cols-3 gap-2">
                              {tokens.map((token) => (
                                 <button
                                    key={token.symbol}
                                    onClick={() => setSelectedToken(token.symbol)}
                                    className={`flex flex-col items-center py-2 px-1 rounded-lg border transition-all ${selectedToken === token.symbol ? 'border-[#00C9B1] bg-[#00C9B1]/5 ring-1 ring-[#00C9B1]' : 'border-[#E6EBF1] hover:border-[#CBD5E1]'}`}
                                 >
                                    <span className="text-[13px] font-bold text-[#1A1F36]">{token.symbol}</span>
                                    <span className="text-[10px] text-[#4F566B] opacity-60">{token.name}</span>
                                 </button>
                              ))}
                           </div>
                        </div>

                        <div className="space-y-3 pt-2">
                           <div className="flex justify-between text-[13px] font-medium text-[#4F566B]">
                              <span>Network</span>
                              <span className="text-[#1A1F36]">Ethereum Mainnet</span>
                           </div>
                           <div className="flex justify-between text-[13px] font-medium text-[#4F566B]">
                              <span>Gas Estimate</span>
                              <span className="text-[#1A1F36]">
                                 {selectedToken === 'ETH' 
                                    ? `~0.0021 ETH (${gasPrice || '24'} gwei)` 
                                    : `~$${((usdAmount * 0.02) + 5).toFixed(2)} USD`
                                 }
                              </span>
                           </div>
                        </div>
                     </div>
                  )}

                  <div
                     onClick={() => setMethod('manual')}
                     className={`p-4 flex items-center gap-3 cursor-pointer border-t border-[#E6EBF1] transition-colors ${method === 'manual' ? 'bg-[#F9FAFB]' : 'hover:bg-[#F9FAFB]/50'}`}
                  >
                     <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${method === 'manual' ? 'border-[#00C9B1]' : 'border-[#E6EBF1]'}`}>
                        {method === 'manual' && <div className="h-2 w-2 rounded-full bg-[#00C9B1]" />}
                     </div>
                     <Globe size={18} className="text-[#4F566B]" strokeWidth={2.2} />
                     <span className="text-[14px] font-semibold text-[#1A1F36] tracking-tight">Manual Transfer</span>
                  </div>

                  {method === 'manual' && (
                     <div className="px-4 pb-4 border-t border-[#E6EBF1] pt-4 animate-in fade-in duration-300 space-y-4">
                        <div className="p-4 bg-[#F9FAFB] rounded-lg border border-[#E6EBF1] space-y-2">
                           <p className="text-[10px] font-bold text-[#4F566B] uppercase tracking-[0.1em] opacity-60">Recipient ETH Address</p>
                           <div className="flex items-center justify-between gap-3">
                              <code className="text-[12px] text-[#1A1F36] font-mono break-all font-medium leading-relaxed">{payment.recipient_address}</code>
                              <button onClick={() => copyToClipboard(payment.recipient_address)} className="text-[#00C9B1] hover:text-[#007A6E] flex-shrink-0 transition-colors">
                                 {copied ? <Check size={16} /> : <Copy size={16} />}
                              </button>
                           </div>
                        </div>
                     </div>
                  )}
               </div>
            </div>

            <div className="flex gap-4 py-2 items-center">
               <input type="checkbox" className="h-4 w-4 accent-[#00C9B1] rounded cursor-pointer border-[#E6EBF1]" id="save-info" />
               <label htmlFor="save-info" className="text-[13px] text-[#4F566B] font-medium cursor-pointer">
                  Remember this wallet for future payments
               </label>
            </div>

            {method === 'wallet' && !connectedAddress && (
               <button
                  className="w-full h-[52px] bg-[#00C9B1] text-white rounded-lg font-bold text-[16px] hover:bg-[#007A6E] transition-all shadow-[0_4px_12px_rgba(0,201,177,0.15)] mt-4 tracking-tight flex items-center justify-center gap-2"
                  onClick={handlePayWithWallet}
                  disabled={loading}
               >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <Wallet size={18} />}
                  Connect Wallet
               </button>
            )}

            {method === 'wallet' && connectedAddress && (
               <button
                  className="w-full h-[52px] bg-[#1A1F36] text-white rounded-lg font-bold text-[16px] hover:bg-[#000] transition-all shadow-[0_4px_12px_rgba(0,0,0,0.1)] mt-4 tracking-tight"
                  onClick={handlePayWithWallet}
                  disabled={loading}
               >
                  {loading ? <Loader2 size={18} className="animate-spin mx-auto" /> : `Confirm Payment · ${currentToken.conversion} ${selectedToken}`}
               </button>
            )}

            {method === 'manual' && (
               <div className="pt-4 text-center">
                  <p className="text-[12px] text-[#4F566B] font-medium opacity-60">
                     Please send funds to the address above to complete your order.
                  </p>
               </div>
            )}

            <div className="text-center pt-8 space-y-5">
               <div className="flex items-center justify-center gap-6 text-[11px] text-[#4F566B] font-bold opacity-30 uppercase tracking-[0.15em]">
                  <Link 
                     href="https://etherscan.io/address/0x4a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t" 
                     target="_blank" 
                     className="hover:opacity-100 transition-opacity flex items-center gap-1.5 hover:text-[#00C9B1]"
                  >
                     <Globe size={12} />
                     View Contract
                  </Link>
                  <div className="h-1 w-1 rounded-full bg-[#E6EBF1]" />
                  <Link href="#" className="hover:opacity-100 transition-opacity">Terms</Link>
               </div>
            {error && (
               <div className="p-4 bg-[#FFF5F5] border border-[#FAD2D2] rounded-lg flex items-center gap-3 text-[#C53030] text-[13px] font-semibold shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                  <AlertCircle size={18} strokeWidth={2.5} />
                  {error}
               </div>
            )}
         </div>
      </div>
   </div>
   )
}
