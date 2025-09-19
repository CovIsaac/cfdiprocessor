"use client"

import type React from "react"

import { useState, useRef, useContext, useEffect } from "react"
import {
  CalendarIcon,
  Download,
  FileText,
  RefreshCw,
  Upload,
  TableIcon,
  AlertCircle,
  Check,
  Settings,
  ListChecks,
  PackageSearch,
} from "lucide-react"
import { FancyLoader } from "@/components/ui/fancy-loader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { format, subMonths } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { SolicitudDescarga } from "@/lib/sat-descarga-masiva"
import { useToast } from "@/hooks/use-toast"
import { ProcessedDataContext } from "@/components/file-uploader"
import { DataTable } from "@/components/data-table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

// Mapeo de estados a texto y color
const estadoSolicitudMap: Record<number, { texto: string; color: string; icon: React.ElementType }> = {
  1: { texto: "Aceptada", color: "bg-blue-50 text-blue-700 border-blue-200", icon: Check },
  2: { texto: "En Proceso", color: "bg-yellow-50 text-yellow-700 border-yellow-200", icon: Settings },
  3: { texto: "Terminada", color: "bg-green-50 text-green-700 border-green-200", icon: Check },
  4: { texto: "Error", color: "bg-red-50 text-red-700 border-red-200", icon: AlertCircle },
  5: { texto: "Rechazada", color: "bg-red-50 text-red-700 border-red-200", icon: AlertCircle },
  6: { texto: "Vencida", color: "bg-gray-50 text-gray-700 border-gray-200", icon: AlertCircle },
}

export function DescargaMasivaSAT() {
  const { toast } = useToast()
  const { processedData, setProcessedData } = useContext(ProcessedDataContext)
  const [activeTab, setActiveTab] = useState("config")
  const [startDate, setStartDate] = useState<Date | undefined>(subMonths(new Date(), 1))
  const [endDate, setEndDate] = useState<Date | undefined>(new Date())
  const [tipoSolicitud, setTipoSolicitud] = useState<"CFDI" | "Metadata">("CFDI")
  const [rfcEmisor, setRfcEmisor] = useState<string>("")
  const [rfcReceptor, setRfcReceptor] = useState<string>("")
  const [certificado, setCertificado] = useState<File | null>(null)
  const [llavePrivada, setLlavePrivada] = useState<File | null>(null)
  const [contrasena, setContrasena] = useState("")
  const [rfc, setRfc] = useState("")
  const [loading, setLoading] = useState(false)
  const [solicitudes, setSolicitudes] = useState<SolicitudDescarga[]>([])
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState<SolicitudDescarga | null>(null)
  const [verificando, setVerificando] = useState<string | null>(null)
  const [descargando, setDescargando] = useState<string | null>(null)
  const [filteredDataTable, setFilteredDataTable] = useState<any[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const certificadoRef = useRef<HTMLInputElement>(null)
  const llavePrivadaRef = useRef<HTMLInputElement>(null)

  // Efecto para actualizar la DataTable cuando processedData cambie
  useEffect(() => {
    if (processedData && processedData.length > 0) {
      setFilteredDataTable(processedData)
    }
  }, [processedData])

  // Función para limpiar el mensaje de error después de 10 segundos
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => {
        setErrorMessage(null)
      }, 10000)
      return () => clearTimeout(timer)
    }
  }, [errorMessage])

  const handleCrearSolicitud = async () => {
    // Limpiar cualquier mensaje de error previo
    setErrorMessage(null)

    // Validaciones
    if (!startDate || !endDate) {
      toast({
        title: "Error de Validación",
        description: "Debes seleccionar fechas de inicio y fin.",
        variant: "destructive",
      })
      return
    }
    if (!certificado || !llavePrivada || !contrasena || !rfc) {
      toast({
        title: "Error de Validación",
        description: "Completa todos los campos de la e.firma.",
        variant: "destructive",
      })
      return
    }
    if (rfc.length < 12 || rfc.length > 13) {
      toast({
        title: "Error de Validación",
        description: "El RFC del solicitante no es válido.",
        variant: "destructive",
      })
      return
    }
    if (rfcEmisor && (rfcEmisor.length < 12 || rfcEmisor.length > 13)) {
      toast({ title: "Error de Validación", description: "El RFC Emisor no es válido.", variant: "destructive" })
      return
    }
    if (rfcReceptor && (rfcReceptor.length < 12 || rfcReceptor.length > 13)) {
      toast({ title: "Error de Validación", description: "El RFC Receptor no es válido.", variant: "destructive" })
      return
    }

    // Validaciones adicionales de fechas
    if (startDate && endDate && startDate > endDate) {
      toast({
        title: "Error de Validación",
        description: "La fecha inicial no puede ser mayor que la fecha final.",
        variant: "destructive",
      })
      return
    }

    const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    if (diffDays > 365) {
      toast({
        title: "Error de Validación",
        description: "El rango de fechas no puede ser mayor a 365 días.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    toast({ title: "Procesando", description: "Creando solicitud de descarga..." })

    try {
      const formData = new FormData()
      formData.append("accion", "crearSolicitud")
      formData.append("certificado", certificado)
      formData.append("llavePrivada", llavePrivada)
      formData.append("contrasena", contrasena)
      formData.append("rfc", rfc)
      formData.append("fechaInicial", format(startDate, "yyyy-MM-dd"))
      formData.append("fechaFinal", format(endDate, "yyyy-MM-dd"))
      formData.append("tipoSolicitud", tipoSolicitud)
      if (rfcEmisor) formData.append("rfcEmisor", rfcEmisor)
      if (rfcReceptor) formData.append("rfcReceptor", rfcReceptor)

      // Usar un timeout para evitar que la solicitud se quede colgada indefinidamente
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 segundos de timeout

      const response = await fetch("/api/sat-descarga", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Manejar respuestas no-OK
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error desconocido" }))
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      const nuevaSolicitud: SolicitudDescarga = {
        idSolicitud: data.idSolicitud,
        estatus: 1, // Aceptada por defecto al crear
        estatusDescripcion: "Aceptada",
        codigoEstatus: data.codigoEstatus || "",
        numeroCfdis: 0,
        mensaje: data.mensaje || "Solicitud creada correctamente.",
        paquetes: [],
        fechaSolicitud: new Date().toISOString(),
        rfcSolicitante: rfc,
        fechaInicial: format(startDate, "yyyy-MM-dd"),
        fechaFinal: format(endDate, "yyyy-MM-dd"),
        tipoSolicitud: tipoSolicitud,
      }

      setSolicitudes((prev) => [nuevaSolicitud, ...prev])
      toast({ title: "Éxito", description: `Solicitud ${data.idSolicitud} creada. Verifica su estado.` })
      setActiveTab("solicitudes")
    } catch (err) {
      console.error("Error al crear solicitud:", err)

      // Determinar el tipo de error
      let errorMsg = "Error desconocido al crear la solicitud"

      if (err instanceof Error) {
        if (err.name === "AbortError") {
          errorMsg = "La solicitud ha excedido el tiempo de espera. El servicio del SAT puede estar ocupado."
        } else {
          errorMsg = err.message
        }
      }

      // Mostrar el error en la UI
      setErrorMessage(errorMsg)

      toast({
        title: "Error al Crear Solicitud",
        description: errorMsg,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleVerificarSolicitud = async (solicitud: SolicitudDescarga) => {
    setErrorMessage(null)

    if (!certificado || !llavePrivada || !contrasena || !rfc) {
      toast({
        title: "Error de Validación",
        description: "Completa los campos de la e.firma para verificar.",
        variant: "destructive",
      })
      return
    }

    setVerificando(solicitud.idSolicitud)
    toast({ title: "Procesando", description: `Verificando estado de la solicitud ${solicitud.idSolicitud}...` })

    try {
      const formData = new FormData()
      formData.append("accion", "verificarSolicitud")
      formData.append("certificado", certificado)
      formData.append("llavePrivada", llavePrivada)
      formData.append("contrasena", contrasena)
      formData.append("rfc", rfc)
      formData.append("idSolicitud", solicitud.idSolicitud)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)

      const response = await fetch("/api/sat-descarga", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error desconocido" }))
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      const solicitudActualizada: SolicitudDescarga = {
        ...solicitud,
        ...data,
        estatusDescripcion: estadoSolicitudMap[data.estatus]?.texto || "Desconocido",
      }

      setSolicitudes((prev) => prev.map((s) => (s.idSolicitud === solicitud.idSolicitud ? solicitudActualizada : s)))

      if (solicitudSeleccionada?.idSolicitud === solicitud.idSolicitud) {
        setSolicitudSeleccionada(solicitudActualizada)
      }

      toast({
        title: "Éxito",
        description: `Solicitud ${solicitud.idSolicitud}: ${solicitudActualizada.estatusDescripcion}`,
      })
    } catch (err) {
      console.error("Error al verificar solicitud:", err)

      let errorMsg = "Error desconocido al verificar la solicitud"

      if (err instanceof Error) {
        if (err.name === "AbortError") {
          errorMsg = "La verificación ha excedido el tiempo de espera. El servicio del SAT puede estar ocupado."
        } else {
          errorMsg = err.message
        }
      }

      setErrorMessage(errorMsg)

      toast({
        title: "Error al Verificar",
        description: errorMsg,
        variant: "destructive",
      })
    } finally {
      setVerificando(null)
    }
  }

  const handleDescargarPaquete = async (idPaquete: string) => {
    setErrorMessage(null)

    if (!certificado || !llavePrivada || !contrasena || !rfc) {
      toast({
        title: "Error de Validación",
        description: "Completa los campos de la e.firma para descargar.",
        variant: "destructive",
      })
      return
    }

    setDescargando(idPaquete)
    toast({ title: "Procesando", description: `Descargando paquete ${idPaquete}...` })

    try {
      const formData = new FormData()
      formData.append("accion", "descargarPaquete")
      formData.append("certificado", certificado)
      formData.append("llavePrivada", llavePrivada)
      formData.append("contrasena", contrasena)
      formData.append("rfc", rfc)
      formData.append("idPaquete", idPaquete)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 120000) // 2 minutos para descargas

      const response = await fetch("/api/sat-descarga", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error desconocido" }))
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // El backend ahora devuelve los CFDI procesados en data.cfdis
      if (data.cfdis && Array.isArray(data.cfdis)) {
        setProcessedData(data.cfdis)
        toast({
          title: "Éxito",
          description: `Paquete ${idPaquete} descargado y ${data.cfdis.length} CFDI procesados.`,
        })
        setActiveTab("results")
      } else {
        toast({
          title: "Advertencia",
          description: `Paquete ${idPaquete} descargado, pero no se procesaron CFDI.`,
          variant: "default",
        })
      }

      // Opcional: Descargar el ZIP si aún se desea
      if (data.paqueteBase64) {
        const byteCharacters = atob(data.paqueteBase64)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: "application/zip" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `paquete-${idPaquete}.zip`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error("Error al descargar paquete:", err)

      let errorMsg = "Error desconocido al descargar el paquete"

      if (err instanceof Error) {
        if (err.name === "AbortError") {
          errorMsg = "La descarga ha excedido el tiempo de espera. El servicio del SAT puede estar ocupado."
        } else {
          errorMsg = err.message
        }
      }

      setErrorMessage(errorMsg)

      toast({
        title: "Error al Descargar",
        description: errorMsg,
        variant: "destructive",
      })
    } finally {
      setDescargando(null)
    }
  }

  const seleccionarCertificado = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCertificado(e.target.files[0])
      toast({ title: "Archivo Seleccionado", description: `Certificado: ${e.target.files[0].name}` })
    }
  }

  const seleccionarLlavePrivada = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setLlavePrivada(e.target.files[0])
      toast({ title: "Archivo Seleccionado", description: `Llave privada: ${e.target.files[0].name}` })
    }
  }

  const handleSeleccionarSolicitud = (solicitud: SolicitudDescarga) => {
    setSolicitudSeleccionada(solicitud)
    setActiveTab("detalle")
  }

  const renderEstadoBadge = (estatus: number) => {
    const estadoInfo = estadoSolicitudMap[estatus] || {
      texto: "Desconocido",
      color: "bg-gray-50 text-gray-700 border-gray-200",
      icon: AlertCircle,
    }
    const IconComponent = estadoInfo.icon
    return (
      <Badge variant="outline" className={cn("text-xs", estadoInfo.color)}>
        <IconComponent className={cn("mr-1 h-3 w-3", estatus === 2 && "animate-spin")} />
        {estadoInfo.texto}
      </Badge>
    )
  }

  return (
    <div className="space-y-4">
      {errorMessage && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error al Crear Solicitud</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <Card className="w-full shadow-md border-slate-200 overflow-hidden">
        <CardHeader className="bg-slate-50 border-b p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-full">
              <Download className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-xl font-semibold text-slate-800">Descarga Masiva SAT</CardTitle>
              <CardDescription className="text-slate-600">
                Automatiza la obtención de tus CFDI y Metadata directamente desde el portal del SAT.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 rounded-none border-b bg-slate-50 p-0 h-auto">
            <TabsTrigger
              value="config"
              className="flex-1 rounded-none data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 py-3 px-4 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <Settings className="mr-2 h-4 w-4" />
              Configuración
            </TabsTrigger>
            <TabsTrigger
              value="solicitudes"
              className="flex-1 rounded-none data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 py-3 px-4 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <ListChecks className="mr-2 h-4 w-4" />
              Solicitudes
            </TabsTrigger>
            <TabsTrigger
              value="detalle"
              disabled={!solicitudSeleccionada}
              className="flex-1 rounded-none data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 py-3 px-4 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              <PackageSearch className="mr-2 h-4 w-4" />
              Detalle y Descarga
            </TabsTrigger>
            <TabsTrigger
              value="results"
              className="flex-1 rounded-none data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 py-3 px-4 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <TableIcon className="mr-2 h-4 w-4" />
              Resultados CFDI
            </TabsTrigger>
          </TabsList>

          <CardContent className="p-0">
            <TabsContent value="config" className="p-4 md:p-6 bg-white">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  // Solo validar cuando se hace clic en el botón de envío
                  handleCrearSolicitud()
                }}
                className="space-y-6"
              >
                <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-700 border-b pb-2 mb-3">Parámetros de Solicitud</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                    <div className="space-y-1.5">
                      <Label htmlFor="startDate" className="text-sm font-medium text-slate-700">
                        Fecha Inicial
                      </Label>
                      <div className="relative">
                        <Input
                          id="startDate"
                          type="date"
                          value={startDate ? format(startDate, "yyyy-MM-dd") : ""}
                          onChange={(e) => {
                            if (e.target.value) {
                              setStartDate(new Date(e.target.value))
                            }
                          }}
                          className="h-10 border-slate-300 hover:border-slate-400 pr-10"
                          max={format(new Date(), "yyyy-MM-dd")}
                        />
                        <CalendarIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="endDate" className="text-sm font-medium text-slate-700">
                        Fecha Final
                      </Label>
                      <div className="relative">
                        <Input
                          id="endDate"
                          type="date"
                          value={endDate ? format(endDate, "yyyy-MM-dd") : ""}
                          onChange={(e) => {
                            if (e.target.value) {
                              setEndDate(new Date(e.target.value))
                            }
                          }}
                          className="h-10 border-slate-300 hover:border-slate-400 pr-10"
                          min={startDate ? format(startDate, "yyyy-MM-dd") : undefined}
                          max={format(new Date(), "yyyy-MM-dd")}
                        />
                        <CalendarIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="tipoSolicitud" className="text-sm font-medium text-slate-700">
                      Tipo de Solicitud
                    </Label>
                    <Select
                      value={tipoSolicitud}
                      onValueChange={(value: "CFDI" | "Metadata") => setTipoSolicitud(value)}
                    >
                      <SelectTrigger id="tipoSolicitud" className="h-10 border-slate-300 hover:border-slate-400">
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CFDI">CFDI (Comprobantes completos)</SelectItem>
                        <SelectItem value="Metadata">Metadata (Solo información)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="rfcEmisor" className="text-sm font-medium text-slate-700">
                      RFC Emisor (Opcional)
                    </Label>
                    <Input
                      id="rfcEmisor"
                      value={rfcEmisor}
                      onChange={(e) => setRfcEmisor(e.target.value.toUpperCase())}
                      placeholder="Ej: XAXX010101000"
                      className="h-10 border-slate-300 hover:border-slate-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="rfcReceptor" className="text-sm font-medium text-slate-700">
                      RFC Receptor (Opcional)
                    </Label>
                    <Input
                      id="rfcReceptor"
                      value={rfcReceptor}
                      onChange={(e) => setRfcReceptor(e.target.value.toUpperCase())}
                      placeholder="Ej: XAXX010101000"
                      className="h-10 border-slate-300 hover:border-slate-400"
                    />
                    <p className="text-xs text-slate-500 pt-1">
                      Utiliza estos campos para filtrar por un RFC específico. Si ambos se dejan vacíos, se descargarán
                      tanto emitidos como recibidos para el RFC de la e.firma.
                    </p>
                  </div>
                </div>

                <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-700 border-b pb-2 mb-3">Configuración de e.firma</h3>
                  <div className="space-y-1.5">
                    <Label htmlFor="rfc" className="text-sm font-medium text-slate-700">
                      RFC del Solicitante (e.firma)
                    </Label>
                    <Input
                      id="rfc"
                      type="text"
                      value={rfc}
                      onChange={(e) => setRfc(e.target.value.toUpperCase())}
                      placeholder="RFC del titular de la e.firma"
                      className="h-10 border-slate-300 hover:border-slate-400"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="certificadoFile" className="text-sm font-medium text-slate-700">
                      Archivo de Certificado (.cer) <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 border-slate-300 hover:border-slate-400 shrink-0"
                        onClick={() => certificadoRef.current?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2 text-slate-500" />
                        {certificado ? "Cambiar .cer" : "Seleccionar .cer"}
                      </Button>
                      {certificado ? (
                        <span
                          className="text-sm text-slate-600 truncate max-w-[calc(100%-150px)]"
                          title={certificado.name}
                        >
                          {certificado.name}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-500">Ningún archivo seleccionado</span>
                      )}
                      <Input
                        id="certificadoFile"
                        type="file"
                        accept=".cer"
                        ref={certificadoRef}
                        onChange={seleccionarCertificado}
                        className="hidden"
                        required={!certificado}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="llavePrivadaFile" className="text-sm font-medium text-slate-700">
                      Archivo de Llave Privada (.key) <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 border-slate-300 hover:border-slate-400 shrink-0"
                        onClick={() => llavePrivadaRef.current?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2 text-slate-500" />
                        {llavePrivada ? "Cambiar .key" : "Seleccionar .key"}
                      </Button>
                      {llavePrivada ? (
                        <span
                          className="text-sm text-slate-600 truncate max-w-[calc(100%-150px)]"
                          title={llavePrivada.name}
                        >
                          {llavePrivada.name}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-500">Ningún archivo seleccionado</span>
                      )}
                      <Input
                        id="llavePrivadaFile"
                        type="file"
                        accept=".key"
                        ref={llavePrivadaRef}
                        onChange={seleccionarLlavePrivada}
                        className="hidden"
                        required={!llavePrivada}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="contrasena" className="text-sm font-medium text-slate-700">
                      Contraseña de la Llave Privada
                    </Label>
                    <Input
                      id="contrasena"
                      type="password"
                      value={contrasena}
                      onChange={(e) => setContrasena(e.target.value)}
                      placeholder="••••••••"
                      className="h-10 border-slate-300 hover:border-slate-400"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-center pt-2">
                  <Button
                    type="submit"
                    disabled={loading || !startDate || !endDate || !certificado || !llavePrivada || !contrasena || !rfc}
                    className="w-full sm:w-auto min-w-[200px] h-10 text-base bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {loading ? (
                      <span className="w-full flex justify-center"><FancyLoader label="Creando Solicitud..." /></span>
                    ) : (
                      <>
                        <FileText className="mr-2 h-5 w-5" />
                        Crear Solicitud de Descarga
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="solicitudes" className="p-4 md:p-6 bg-white">
              <div className="space-y-4">
                {solicitudes.length > 0 ? (
                  <div className="rounded-lg border border-slate-200 overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="px-4 py-3 text-xs font-medium text-slate-600 uppercase tracking-wider">
                            ID Solicitud
                          </TableHead>
                          <TableHead className="px-4 py-3 text-xs font-medium text-slate-600 uppercase tracking-wider">
                            Fecha Solicitud
                          </TableHead>
                          <TableHead className="px-4 py-3 text-xs font-medium text-slate-600 uppercase tracking-wider">
                            Tipo
                          </TableHead>
                          <TableHead className="px-4 py-3 text-xs font-medium text-slate-600 uppercase tracking-wider">
                            Período
                          </TableHead>
                          <TableHead className="px-4 py-3 text-xs font-medium text-slate-600 uppercase tracking-wider">
                            Estado
                          </TableHead>
                          <TableHead className="px-4 py-3 text-xs font-medium text-slate-600 uppercase tracking-wider text-right">
                            Acciones
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-slate-200">
                        {solicitudes.map((solicitud) => (
                          <TableRow key={solicitud.idSolicitud} className="hover:bg-slate-50 transition-colors">
                            <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-700">
                              {solicitud.idSolicitud}
                            </TableCell>
                            <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                              {format(new Date(solicitud.fechaSolicitud), "dd/MM/yyyy HH:mm", { locale: es })}
                            </TableCell>
                            <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                              {solicitud.tipoSolicitud}
                            </TableCell>
                            <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                              {format(new Date(solicitud.fechaInicial), "dd/MM/yy", { locale: es })} -{" "}
                              {format(new Date(solicitud.fechaFinal), "dd/MM/yy", { locale: es })}
                            </TableCell>
                            <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                              {renderEstadoBadge(solicitud.estatus)}
                            </TableCell>
                            <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-right">
                              <div className="flex justify-end items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0 border-slate-300 hover:bg-slate-100"
                                  onClick={() => handleVerificarSolicitud(solicitud)}
                                  disabled={verificando === solicitud.idSolicitud}
                                  title="Verificar Estado"
                                >
                                  {verificando === solicitud.idSolicitud ? (
                                    <span className="flex items-center justify-center"><FancyLoader label="" /></span>
                                  ) : (
                                    <RefreshCw className="h-4 w-4 text-slate-500" />
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0 border-slate-300 hover:bg-slate-100"
                                  onClick={() => handleSeleccionarSolicitud(solicitud)}
                                  title="Ver Detalle y Descargar"
                                >
                                  <PackageSearch className="h-4 w-4 text-slate-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                    <ListChecks className="mx-auto h-12 w-12 text-slate-400 mb-4" />
                    <p className="text-lg font-medium text-slate-700 mb-2">No hay solicitudes de descarga.</p>
                    <p className="text-sm text-slate-500 mb-6">
                      Crea una nueva solicitud desde la pestaña de configuración.
                    </p>
                    <Button
                      variant="outline"
                      className="border-slate-300 hover:bg-slate-100"
                      onClick={() => setActiveTab("config")}
                    >
                      Ir a Configuración
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="detalle" className="p-4 md:p-6 bg-white">
              {solicitudSeleccionada ? (
                <div className="space-y-6">
                  <Card className="shadow-md border-slate-200">
                    <CardHeader className="bg-slate-50 border-b p-4">
                      <h3 className="text-lg font-semibold text-slate-700">
                        Detalles de la Solicitud: {solicitudSeleccionada.idSolicitud}
                      </h3>
                    </CardHeader>
                    <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                      <div>
                        <strong className="text-slate-600">ID Solicitud:</strong>{" "}
                        <span className="text-slate-800">{solicitudSeleccionada.idSolicitud}</span>
                      </div>
                      <div>
                        <strong className="text-slate-600">Fecha Solicitud:</strong>{" "}
                        <span className="text-slate-800">
                          {format(new Date(solicitudSeleccionada.fechaSolicitud), "dd/MM/yyyy HH:mm", { locale: es })}
                        </span>
                      </div>
                      <div>
                        <strong className="text-slate-600">Tipo:</strong>{" "}
                        <span className="text-slate-800">{solicitudSeleccionada.tipoSolicitud}</span>
                      </div>
                      <div>
                        <strong className="text-slate-600">Período:</strong>{" "}
                        <span className="text-slate-800">
                          {format(new Date(solicitudSeleccionada.fechaInicial), "dd/MM/yy")} -{" "}
                          {format(new Date(solicitudSeleccionada.fechaFinal), "dd/MM/yy")}
                        </span>
                      </div>
                      <div>
                        <strong className="text-slate-600">RFC Solicitante:</strong>{" "}
                        <span className="text-slate-800">{solicitudSeleccionada.rfcSolicitante}</span>
                      </div>
                      <div>
                        <strong className="text-slate-600">Estado:</strong>{" "}
                        {renderEstadoBadge(solicitudSeleccionada.estatus)}
                      </div>
                      <div className="md:col-span-2 lg:col-span-3">
                        <strong className="text-slate-600">Mensaje SAT:</strong>{" "}
                        <span className="text-slate-800">{solicitudSeleccionada.mensaje}</span>
                      </div>
                      {solicitudSeleccionada.numeroCfdis > 0 && (
                        <div>
                          <strong className="text-slate-600"># CFDI:</strong>{" "}
                          <span className="text-slate-800">{solicitudSeleccionada.numeroCfdis}</span>
                        </div>
                      )}
                      {solicitudSeleccionada.codigoEstatus && (
                        <div>
                          <strong className="text-slate-600">Cód. Estado:</strong>{" "}
                          <span className="text-slate-800">{solicitudSeleccionada.codigoEstatus}</span>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="p-4 bg-slate-50 border-t flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 border-slate-300 hover:bg-slate-100"
                        onClick={() => handleVerificarSolicitud(solicitudSeleccionada)}
                        disabled={verificando === solicitudSeleccionada.idSolicitud}
                      >
                        {verificando === solicitudSeleccionada.idSolicitud ? (
                          <span className="flex items-center justify-center"><FancyLoader label="" /></span>
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4 text-slate-500" />
                        )}
                        Actualizar Estado
                      </Button>
                    </CardFooter>
                  </Card>

                  {solicitudSeleccionada.estatus === 3 &&
                  solicitudSeleccionada.paquetes &&
                  solicitudSeleccionada.paquetes.length > 0 ? (
                    <Card className="shadow-md border-slate-200">
                      <CardHeader className="bg-slate-50 border-b p-4">
                        <h3 className="text-lg font-semibold text-slate-700">Paquetes Disponibles para Descarga</h3>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-slate-100">
                                <TableHead className="px-4 py-3 text-xs font-medium text-slate-600 uppercase tracking-wider">
                                  ID Paquete
                                </TableHead>
                                <TableHead className="px-4 py-3 text-xs font-medium text-slate-600 uppercase tracking-wider text-right">
                                  Acciones
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody className="divide-y divide-slate-200">
                              {solicitudSeleccionada.paquetes.map((paqueteId) => (
                                <TableRow key={paqueteId} className="hover:bg-slate-50 transition-colors">
                                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-700">
                                    {paqueteId}
                                  </TableCell>
                                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-right">
                                    <Button
                                      variant="default"
                                      size="sm"
                                      className="h-9 bg-green-600 hover:bg-green-700 text-white"
                                      onClick={() => handleDescargarPaquete(paqueteId)}
                                      disabled={descargando === paqueteId}
                                    >
                                      {descargando === paqueteId ? (
                                        <span className="flex items-center justify-center"><FancyLoader label="Descargando..." /></span>
                                      ) : (
                                        <Download className="mr-2 h-4 w-4" />
                                      )}
                                      Descargar y Procesar
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                      <PackageSearch className="mx-auto h-12 w-12 text-slate-400 mb-4" />
                      <p className="text-lg font-medium text-slate-700 mb-2">
                        {solicitudSeleccionada.estatus === 3
                          ? "No hay paquetes disponibles para esta solicitud."
                          : "La solicitud aún no ha finalizado o no generó paquetes."}
                      </p>
                      <p className="text-sm text-slate-500">
                        Actualiza el estado para ver si hay paquetes disponibles.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                  <PackageSearch className="mx-auto h-12 w-12 text-slate-400 mb-4" />
                  <p className="text-lg font-medium text-slate-700 mb-2">No hay solicitud seleccionada.</p>
                  <p className="text-sm text-slate-500 mb-6">
                    Selecciona una solicitud de la lista para ver sus detalles.
                  </p>
                  <Button
                    variant="outline"
                    className="border-slate-300 hover:bg-slate-100"
                    onClick={() => setActiveTab("solicitudes")}
                  >
                    Ver Lista de Solicitudes
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="results" className="p-4 md:p-6 bg-white">
              {filteredDataTable.length > 0 ? (
                <DataTable data={filteredDataTable} onFilteredDataChange={setFilteredDataTable} />
              ) : (
                <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                  <TableIcon className="mx-auto h-12 w-12 text-slate-400 mb-4" />
                  <p className="text-lg font-medium text-slate-700 mb-2">No hay CFDI procesados para mostrar.</p>
                  <p className="text-sm text-slate-500">
                    Descarga paquetes de una solicitud terminada para ver los resultados aquí.
                  </p>
                </div>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>

        <CardFooter className="bg-slate-50 border-t p-4">
          <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-800">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            <AlertTitle className="font-semibold">Información Importante</AlertTitle>
            <AlertDescription className="text-sm">
              La descarga masiva de CFDI permite obtener los comprobantes emitidos y recibidos directamente desde el
              SAT. Los paquetes descargados suelen estar disponibles por 72 horas después de su generación. Asegúrate de
              tener tu e.firma vigente y la contraseña correcta.
            </AlertDescription>
          </Alert>
        </CardFooter>
      </Card>
    </div>
  )
}
