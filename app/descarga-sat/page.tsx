// This page might now be redundant as its functionality is integrated into app/page.tsx.
// You can choose to keep it for direct access or remove it.
// If kept, ensure it still works independently or redirects.
"use client"

import { DescargaMasivaSAT } from "@/components/descarga-masiva-sat"
import { ProcessedDataProvider } from "@/components/file-uploader"
import { Toaster } from "@/components/ui/sonner"

export default function DescargaSATPage() {
  return (
    <ProcessedDataProvider>
      <div className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 lg:px-8">
        <header className="mb-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-slate-800">Descarga Masiva de CFDI del SAT (Página Dedicada)</h1>
            <p className="mt-2 text-sm text-slate-600">
              Esta es la página dedicada para la descarga masiva. La funcionalidad también está integrada en la página
              principal.
            </p>
          </div>
        </header>
        <main className="max-w-6xl mx-auto">
          <DescargaMasivaSAT />
        </main>
        <Toaster richColors position="top-right" />
      </div>
    </ProcessedDataProvider>
  )
}
