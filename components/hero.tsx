import { Sparkles } from "lucide-react"

export function Hero() {
  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-slate-900 to-slate-800 py-16 rounded-2xl mb-12 shadow-xl">
      <div className="absolute inset-0 z-0 opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(#444_1px,transparent_1px)] [background-size:20px_20px]"></div>
      </div>
      <div className="relative z-10 text-center px-6">
        <div className="flex justify-center mb-6">
          <div className="h-24 w-24 rounded-full bg-white/10 backdrop-blur-sm p-2 shadow-xl flex items-center justify-center">
            <Sparkles className="h-12 w-12 text-blue-400" />
          </div>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl bg-clip-text text-transparent bg-gradient-to-r from-blue-200 to-cyan-400">
          Analizador XML
        </h1>
        <p className="mt-6 text-lg leading-8 text-slate-300 max-w-3xl mx-auto">
          Procesa tus archivos CFDI 4.0 y obtén reportes detallados en Excel con todos los complementos de pago
        </p>
      </div>
    </div>
  )
}
