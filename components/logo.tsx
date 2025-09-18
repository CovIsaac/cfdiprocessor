import Link from "next/link"
import { FileSearch } from "lucide-react"

interface LogoProps {
  className?: string
}

export function Logo({ className }: LogoProps) {
  return (
    <Link href="/" className={`flex items-center gap-2 ${className}`}>
      <div className="relative h-10 w-10 overflow-hidden bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center shadow-md">
        <FileSearch className="h-6 w-6 text-white" />
      </div>
      <div className="flex flex-col">
        <span className="text-lg font-bold leading-tight text-slate-900">Analizador XML</span>
        <span className="text-sm font-medium leading-tight text-slate-600">Capital IDN</span>
      </div>
    </Link>
  )
}
