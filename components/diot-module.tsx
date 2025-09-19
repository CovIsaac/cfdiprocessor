"use client"

import { useState, useEffect } from "react"
import { CalendarIcon, FileSpreadsheet, AlertCircle, FileText, Check } from "lucide-react"
import { FancyLoader } from "@/components/ui/fancy-loader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
// import { generateDIOT } from "@/lib/diot-generator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Tipos para la DIOT
interface DIOTEntry {
  rfc: string
  nombreProveedor: string
  tipoOperacion: string
  tipoTercero: string
  tipoTasa: string
  importeTotal: number
  iva16: number
  iva8: number
  iva0: number
  ivaExento: number
  ivaRetenido: number
  importeNeto: number
  facturas: number
}
export default function DiotModule() {
  const [activeTab, setActiveTab] = useState("config")
  const [month, setMonth] = useState<number>(new Date().getMonth())
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [xmlFiles, setXmlFiles] = useState<File[]>([])
  const [rfcReceptor, setRfcReceptor] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Generar años para el selector (5 años atrás y 1 adelante)
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 6 }, (_, i) => currentYear - 4 + i)

  // Meses para el selector
  const months = [
    { value: 0, label: "Enero" },
    { value: 1, label: "Febrero" },
    { value: 2, label: "Marzo" },
    { value: 3, label: "Abril" },
    { value: 4, label: "Mayo" },
    { value: 5, label: "Junio" },
    { value: 6, label: "Julio" },
    { value: 7, label: "Agosto" },
    { value: 8, label: "Septiembre" },
    { value: 9, label: "Octubre" },
    { value: 10, label: "Noviembre" },
    { value: 11, label: "Diciembre" },
  ]

  // Actualizar fecha cuando cambia mes o año
  useEffect(() => {
    if (month !== undefined && year !== undefined) {
      setDate(new Date(year, month, 1))
    }
  }, [month, year])

  // Actualizar mes y año cuando cambia la fecha
  useEffect(() => {
    if (date) {
      setMonth(date.getMonth())
      setYear(date.getFullYear())
    }
  }, [date])

  // Subir XMLs y descargar DIOT TXT
  const handleUploadAndDownloadDIOT = async () => {
    if (!xmlFiles || xmlFiles.length === 0) {
      setError("Debes seleccionar al menos un archivo XML")
      return
    }
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const formData = new FormData()
      xmlFiles.forEach((file) => formData.append("files", file))
      formData.append("month", month.toString())
      formData.append("year", year.toString())
      formData.append("rfcReceptor", rfcReceptor.trim())

      const response = await fetch("/api/export-diot", {
        method: "POST",
        body: formData,
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Error al generar la DIOT")
      }
      // Descargar el archivo
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `diot_${year}_${String(month + 1).padStart(2, "0")}.txt`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      a.remove()
      setSuccess(`DIOT generada y descargada correctamente para ${months[month].label} ${year}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar la DIOT")
    } finally {
      setLoading(false)
    }
  }

  // Formatear moneda
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  return (
    <Card className="w-full shadow-lg border-slate-200">
      <CardHeader className="bg-slate-50 border-b">
        <CardTitle className="text-2xl flex items-center gap-2">
          <FileText className="h-6 w-6 text-blue-500" />
          Generador DIOT
        </CardTitle>
        <CardDescription>Genera automáticamente tu Declaración Informativa de Operaciones con Terceros</CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full rounded-none border-b bg-slate-50 p-0">
            <TabsTrigger
              value="config"
              className="flex-1 rounded-none border-r data-[state=active]:bg-white data-[state=active]:shadow-none py-3"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              Configuración
            </TabsTrigger>
                 {/*
                 <TabsTrigger
                   value="preview"
                   disabled={true}
                   className="flex-1 rounded-none data-[state=active]:bg-white data-[state=active]:shadow-none py-3"
                 >
                   <FileText className="mr-2 h-4 w-4" />
                   Vista Previa
                 </TabsTrigger>
                 */}
          </TabsList>

          <TabsContent value="config" className="p-6 bg-white">
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="text-lg font-medium mb-4">Subir XMLs y configurar DIOT</h3>
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Archivos XML</label>
                      <input
                        type="file"
                        accept=".xml"
                        multiple
                        onChange={(e) => setXmlFiles(Array.from(e.target.files || []))}
                        className="block w-full border border-slate-200 rounded px-2 py-1 text-sm"
                      />
                      <div className="text-xs text-slate-500 mt-1">
                        Puedes seleccionar uno o varios archivos XML descargados del SAT.
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Mes</label>
                        <Select value={month.toString()} onValueChange={(value) => setMonth(Number.parseInt(value))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar mes" />
                          </SelectTrigger>
                          <SelectContent>
                            {months.map((m) => (
                              <SelectItem key={m.value} value={m.value.toString()}>
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Año</label>
                        <Select value={year.toString()} onValueChange={(value) => setYear(Number.parseInt(value))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar año" />
                          </SelectTrigger>
                          <SelectContent>
                            {years.map((y) => (
                              <SelectItem key={y} value={y.toString()}>
                                {y}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">RFC Receptor (opcional)</label>
                      <input
                        type="text"
                        value={rfcReceptor}
                        onChange={(e) => setRfcReceptor(e.target.value)}
                        placeholder="RFC para filtrar CFDIs (por defecto tu RFC)"
                        className="block w-full border border-slate-200 rounded px-2 py-1 text-sm"
                        maxLength={13}
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-4">Información</h3>
                  <div className="space-y-4">
                    <p className="text-sm text-slate-600">
                      La DIOT (Declaración Informativa de Operaciones con Terceros) es una obligación fiscal mensual
                      donde se reportan todas las operaciones realizadas con proveedores.
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <p className="text-sm">Agrupa automáticamente por proveedor</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <p className="text-sm">Calcula IVA acreditable, no acreditable y exento</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <p className="text-sm">Exporta en formato compatible con el SAT</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {success && (
                <Alert className="bg-green-50 text-green-800 border-green-200">
                  <Check className="h-4 w-4 text-green-500" />
                  <AlertTitle>Éxito</AlertTitle>
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}
              <div className="flex justify-center pt-2">
                <Button
                  onClick={handleUploadAndDownloadDIOT}
                  disabled={loading || xmlFiles.length === 0}
                  className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
                >
                  {loading ? (
                    <span className="w-full flex justify-center"><FancyLoader label="Generando DIOT..." /></span>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Generar y Descargar DIOT
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>

             {/*
             <TabsContent value="preview" className="p-0 bg-white">
               Vista previa deshabilitada: la DIOT se genera y descarga directamente desde el backend.
             </TabsContent>
             */}
        </Tabs>
      </CardContent>

      <CardFooter className="bg-slate-50 border-t p-4">
        <p className="text-xs text-slate-500">
          La DIOT debe presentarse mensualmente a más tardar el día 17 del mes siguiente al que corresponda. Verifique
          que la información sea correcta antes de presentarla al SAT.
        </p>
      </CardFooter>
    </Card>
  )
}
