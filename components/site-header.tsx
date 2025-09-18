import Link from "next/link"
import { FileJson2 } from "lucide-react"

export function SiteHeader() {
  return (
    <header className="bg-slate-900 text-white">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <FileJson2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold text-white">Analizador XML</span>
                <p className="text-xs text-slate-300">Capital IDN</p>
              </div>
            </Link>
          </div>
          <nav className="hidden md:flex space-x-8">
            <Link href="#" className="text-sm text-slate-300 hover:text-white">
              Inicio
            </Link>
            <Link href="#" className="text-sm text-slate-300 hover:text-white">
              Características
            </Link>
            <Link href="#" className="text-sm text-slate-300 hover:text-white">
              Ayuda
            </Link>
            <Link href="#" className="text-sm text-slate-300 hover:text-white">
              Contacto
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}
