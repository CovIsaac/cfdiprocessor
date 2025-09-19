"use client"

import { useContext } from "react"
import { FileUploader, ProcessedDataContext, ProcessedDataProvider } from "@/components/file-uploader"
import DiotModule from "@/components/diot-module"
import { DescargaMasivaSAT } from "@/components/descarga-masiva-sat"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, FileSpreadsheet, CloudDownload } from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-900">
      <ProcessedDataProvider>
        {/* Hero Section */}
        <section className="bg-slate-800 py-16">
          <div className="container mx-auto px-6 text-center">
            <h1 className="text-5xl font-bold text-white mb-4">Analizador XML</h1>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Procesa tus archivos CFDI 4.0 y obtén reportes detallados en Excel con todos los complementos de pago.
            </p>
          </div>
        </section>

        {/* Main Content */}
        <div className="container mx-auto px-6 py-8">
          <Tabs defaultValue="cfdi" className="w-full">
            <TabsList className="grid w-full grid-cols-3 max-w-2xl mx-auto mb-8 bg-slate-700 border-slate-600">
              <TabsTrigger
                value="cfdi"
                className="text-slate-300 data-[state=active]:bg-slate-600 data-[state=active]:text-white"
              >
                <FileText className="mr-2 h-4 w-4" />
                Procesar CFDI
              </TabsTrigger>
              <TabsTrigger
                value="diot"
                className="text-slate-300 data-[state=active]:bg-slate-600 data-[state=active]:text-white"
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Generar DIOT
              </TabsTrigger>
              <TabsTrigger
                value="descarga-sat"
                className="text-slate-300 data-[state=active]:bg-slate-600 data-[state=active]:text-white"
              >
                <CloudDownload className="mr-2 h-4 w-4" />
                Descarga Masiva SAT
              </TabsTrigger>
            </TabsList>

            <TabsContent value="cfdi">
              <FileUploader />
            </TabsContent>

            <TabsContent value="diot">
              <DIOTModuleWrapper />
            </TabsContent>

            <TabsContent value="descarga-sat">
              <div className="bg-white rounded-lg shadow-lg">
                <DescargaMasivaSAT />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ProcessedDataProvider>
    </div>
  )
}

function DIOTModuleWrapper() {
  return <DiotModule />
}
