// FILE: apps/web/app/(checkout)/layout.tsx
import '../globals.css'

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div 
      className="min-h-screen bg-white text-[#1A1F36] selection:bg-[#635BFF] selection:text-white antialiased font-sans"
      style={{ 
        backgroundColor: '#FFFFFF', 
        color: '#1A1F36',
        '--color-bg': '#FFFFFF',
        '--color-text': '#1A1F36',
        '--color-border': '#E6EBF1'
      } as any}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        body { background-color: #FFFFFF !important; color: #1A1F36 !important; }
        h1, h2, h3, h4, h5, h6 { text-transform: none !important; letter-spacing: normal !important; font-family: sans-serif !important; }
      `}} />
      {children}
    </div>
  )
}
