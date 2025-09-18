"use client"

import { useState, useEffect } from "react"
import { CalendarIcon, FileSpreadsheet, Loader2, AlertCircle, FileText, Check } from "lucide-react"
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
import { generateDIOT } from "@/lib/diot-generator"
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

export function DIOTModule({ processedData }: { processedData: any[] }) {
  const [activeTab, setActiveTab] = useState("config")
  const [month, setMonth] = useState<number>(new Date().getMonth())
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [diotData, setDiotData] = useState<DIOTEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [totalProveedores, setTotalProveedores] = useState(0)
  const [totalIVA, setTotalIVA] = useState(0)
  const [totalOperaciones, setTotalOperaciones] = useState(0)

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

  // Generar DIOT
  const handleGenerateDIOT = async () => {
    if (!processedData || processedData.length === 0) {
      setError("No hay datos procesados para generar la DIOT")
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // Filtrar facturas del mes seleccionado
      const startDate = new Date(year, month, 1)
      const endDate = new Date(year, month + 1, 0) // Último día del mes

      // Formatear fechas para comparación
      const startDateStr = format(startDate, "yyyy-MM-dd")
      const endDateStr = format(endDate, "yyyy-MM-dd")

      // Generar datos DIOT
      const result = await generateDIOT(processedData, startDateStr, endDateStr)

      setDiotData(result.entries)
      setTotalProveedores(result.entries.length)
      setTotalIVA(result.totalIVA)
      setTotalOperaciones(result.totalOperaciones)

      setSuccess(`DIOT generada correctamente para ${months[month].label} ${year}`)
      setActiveTab("preview")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar la DIOT")
    } finally {
      setLoading(false)
    }
  }

  // Exportar DIOT
  const handleExportDIOT = async (format: "txt" | "excel") => {
    if (diotData.length === 0) {
      setError("No hay datos para exportar")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/export-diot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: diotData,
          month,
          year,
          format,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Error al exportar la DIOT")
      }

      // Descargar el archivo
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url

      // Nombre del archivo según el formato
      const fileName =
        format === "txt"
          ? `DIOT_${year}_${String(month + 1).padStart(2, "0")}.txt`
          : `DIOT_${year}_${String(month + 1).padStart(2, "0")}.xlsx`

      a.download = fileName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      a.remove()

      setSuccess(`DIOT exportada correctamente en formato ${format.toUpperCase()}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al exportar la DIOT")
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
            <TabsTrigger
              value="preview"
              disabled={diotData.length === 0}
              className="flex-1 rounded-none data-[state=active]:bg-white data-[state=active]:shadow-none py-3"
            >
              <FileText className="mr-2 h-4 w-4" />
              Vista Previa
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="p-6 bg-white">
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="text-lg font-medium mb-4">Período de la DIOT</h3>
                  <div className="grid gap-4">
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
                      <label className="text-sm font-medium">Seleccionar en calendario</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !date && "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date ? format(date, "MMMM yyyy", { locale: es }) : <span>Seleccionar mes</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={date}
                            onSelect={setDate}
                            initialFocus
                            locale={es}
                            captionLayout="dropdown-buttons"
                            fromYear={currentYear - 4}
                            toYear={currentYear + 1}
                          />
                        </PopoverContent>
                      </Popover>
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
                  onClick={handleGenerateDIOT}
                  disabled={loading || !processedData || processedData.length === 0}
                  className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Generar DIOT
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="p-0 bg-white">
            {diotData.length > 0 ? (
              <div className="space-y-6">
                <div className="p-4 bg-slate-50 border-b">
                  <div className="flex flex-wrap gap-3 mb-4">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 px-3 py-1 text-sm">
                      <FileText className="h-4 w-4 mr-1" />
                      Período: {months[month].label} {year}
                    </Badge>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 px-3 py-1 text-sm">
                      Proveedores: {totalProveedores}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="bg-purple-50 text-purple-700 border-purple-200 px-3 py-1 text-sm"
                    >
                      Total IVA: {formatCurrency(totalIVA)}
                    </Badge>
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 px-3 py-1 text-sm">
                      Total Operaciones: {formatCurrency(totalOperaciones)}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => handleExportDIOT("txt")}
                            disabled={loading}
                            variant="outline"
                            className="bg-white"
                          >
                            {loading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <FileText className="h-4 w-4 mr-2" />
                            )}
                            Exportar TXT
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Formato para importar al sistema del SAT</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={() => handleExportDIOT("excel")}
                            disabled={loading}
                            className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600"
                          >
                            {loading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <FileSpreadsheet className="h-4 w-4 mr-2" />
                            )}
                            Exportar Excel
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Formato detallado para revisión</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>

                <div className="px-4">
                  <ScrollArea className="h-[500px] w-full rounded-md border">
                    <Table>
                      <TableHeader className="sticky top-0 bg-slate-50 z-10">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-[150px]">RFC</TableHead>
                          <TableHead>Proveedor</TableHead>
                          <TableHead>Tipo Operación</TableHead>
                          <TableHead>Tipo Tercero</TableHead>
                          <TableHead className="text-right">IVA 16%</TableHead>
                          <TableHead className="text-right">IVA 0%</TableHead>
                          <TableHead className="text-right">Exento</TableHead>
                          <TableHead className="text-right">IVA Retenido</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-center">Facturas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {diotData.map((entry, index) => (
                          <TableRow key={index} className="hover:bg-slate-50">
                            <TableCell className="font-medium">{entry.rfc}</TableCell>
                            <TableCell>{entry.nombreProveedor}</TableCell>
                            <TableCell>{entry.tipoOperacion}</TableCell>
                            <TableCell>{entry.tipoTercero}</TableCell>
                            <TableCell className="text-right">{formatCurrency(entry.iva16)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(entry.iva0)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(entry.ivaExento)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(entry.ivaRetenido)}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(entry.importeTotal)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                {entry.facturas}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>

                {error && (
                  <Alert variant="destructive" className="mx-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <div className="text-center py-16 bg-slate-50">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mb-4">
                  <FileText className="h-6 w-6 text-slate-500" />
                </div>
                <p className="text-slate-500 mb-4">No hay datos DIOT para mostrar.</p>
                <Button variant="outline" onClick={() => setActiveTab("config")}>
                  Configurar DIOT
                </Button>
              </div>
            )}
          </TabsContent>
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
