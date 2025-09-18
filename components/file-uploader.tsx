"use client"

import type React from "react"

import { useState, useContext, createContext, type ReactNode } from "react"
import { Upload, FileSpreadsheet, Loader2, TableIcon, FolderOpen, FileCheck, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { processFiles } from "@/lib/process-files"
import { DataTable } from "@/components/data-table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { ExportColumnsDialog } from "@/components/export-columns-dialog"
import { useToast } from "@/hooks/use-toast"

// Crear contexto para compartir datos procesados

interface ProcessedDataContextType {
  processedData: any[]
  setProcessedData: React.Dispatch<React.SetStateAction<any[]>>
  // Add other states or functions if needed by consumers
}

export const ProcessedDataContext = createContext<ProcessedDataContextType | undefined>(undefined)

export const ProcessedDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [processedData, setProcessedData] = useState<any[]>([])
  // ... other logic for the provider

  return (
    <ProcessedDataContext.Provider value={{ processedData, setProcessedData }}>
      {children}
    </ProcessedDataContext.Provider>
  )
}

export function FileUploader() {
  const context = useContext(ProcessedDataContext)
  if (!context) {
    throw new Error("FileUploader must be used within a ProcessedDataProvider")
  }
  const { setProcessedData } = context
  // ... rest of FileUploader implementation using setProcessedData
  // For example, after processing files:
  // const data = await processFiles(acceptedFiles, (progress) => { ... });
  // setProcessedData(data);
  const { processedData } = useContext(ProcessedDataContext)
  const [files, setFiles] = useState<File[]>([])
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [showTable, setShowTable] = useState(false)
  const [activeTab, setActiveTab] = useState("upload")
  const [exportTipoDocumento, setExportTipoDocumento] = useState<string>("todos")
  const [filteredData, setFilteredData] = useState<any[]>([])
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [availableColumns, setAvailableColumns] = useState<string[]>([])
  const { toast } = useToast()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter((file) => file.name.toLowerCase().endsWith(".xml"))
      setFiles(selectedFiles)
      setError(selectedFiles.length === 0 ? "No se seleccionaron archivos XML" : null)
      setShowTable(false)
    }
  }

  const handleFolderSelect = async () => {
    try {
      // Verificar si la API de File System Access está disponible
      if (!window.showDirectoryPicker) {
        setError("Tu navegador no soporta la selección de carpetas. Intenta con Chrome, Edge o Safari reciente.")
        return
      }

      setProcessing(true)
      setProgress(0)
      setError(null)

      // Mostrar el selector de carpetas
      const directoryHandle = await window.showDirectoryPicker()

      // Procesar la carpeta seleccionada
      const xmlFiles: File[] = []
      setProgress(10) // Indicar que comenzó el proceso

      // Función recursiva para explorar carpetas
      async function processDirectoryEntries(dirHandle: FileSystemDirectoryHandle, path = "") {
        for await (const entry of dirHandle.values()) {
          // Si es una subcarpeta, procesarla recursivamente
          if (entry.kind === "directory") {
            await processDirectoryEntries(entry, `${path}/${entry.name}`)
          }
          // Si es un archivo XML, añadirlo a la lista
          else if (entry.name.toLowerCase().endsWith(".xml")) {
            try {
              const fileHandle = await entry.getFile()
              xmlFiles.push(fileHandle)
            } catch (err) {
              console.error(`Error al acceder al archivo ${entry.name}:`, err)
            }
          }
        }
      }

      // Iniciar el procesamiento recursivo
      await processDirectoryEntries(directoryHandle)

      // Actualizar el estado con los archivos encontrados
      setFiles(xmlFiles)
      setError(xmlFiles.length === 0 ? "No se encontraron archivos XML en la carpeta seleccionada" : null)
      setShowTable(false)
      setProgress(100) // Completar la barra de progreso
    } catch (err) {
      // Manejar errores (por ejemplo, si el usuario cancela la selección)
      if (err instanceof Error && err.name !== "AbortError") {
        setError(`Error al seleccionar la carpeta: ${err.message}`)
      }
    } finally {
      setProcessing(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (files.length === 0) {
      setError("Por favor selecciona al menos un archivo XML")
      return
    }

    setProcessing(true)
    setProgress(0)
    setError(null)
    setShowTable(false)

    try {
      const data = await processFiles(files, (currentProgress) => {
        setProgress(currentProgress)
      })

      setProcessedData(data)

      // Extraer las columnas disponibles del primer elemento
      if (data.length > 0) {
        setAvailableColumns(Object.keys(data[0]))
      }

      setShowTable(true)
      setActiveTab("results")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar los archivos")
    } finally {
      setProcessing(false)
    }
  }

  const handleExportExcel = async (selectedColumns: string[]) => {
    // Siempre usar los datos filtrados para la exportación
    if (filteredData.length === 0) {
      setError("No hay datos para exportar")
      return
    }

    try {
      setProcessing(true)

      // Filtrar datos por tipo de documento si es necesario
      const finalDataToExport =
        exportTipoDocumento === "todos"
          ? filteredData
          : filteredData.filter((item) => item.TIPO_DOCUMENTO === exportTipoDocumento)

      if (finalDataToExport.length === 0) {
        setError(`No hay documentos de tipo ${exportTipoDocumento} para exportar`)
        setProcessing(false)
        return
      }

      // Mostrar mensaje de cuántos registros se exportarán
      console.log(`Exportando ${finalDataToExport.length} registros filtrados con ${selectedColumns.length} columnas`)

      await processFiles.exportToExcel(finalDataToExport, selectedColumns, exportTipoDocumento)

      // Mostrar notificación de éxito
      toast({
        title: "Exportación completada",
        description: `Se han exportado ${finalDataToExport.length} registros con ${selectedColumns.length} columnas.`,
        duration: 5000,
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error al exportar a Excel"
      setError(errorMessage)

      // Mostrar notificación de error
      toast({
        title: "Error en la exportación",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setProcessing(false)
    }
  }

  const updateFilteredData = (data: any[]) => {
    setFilteredData(data)
  }

  const openExportDialog = () => {
    setShowExportDialog(true)
  }

  // Placeholder for actual FileUploader UI
  return (
    <Card className="w-full shadow-lg border-slate-200">
      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full rounded-none border-b bg-slate-50 p-0">
            <TabsTrigger
              value="upload"
              className="flex-1 rounded-none border-r data-[state=active]:bg-white data-[state=active]:shadow-none py-3"
            >
              <Upload className="mr-2 h-4 w-4" />
              Subir Archivos
            </TabsTrigger>
            <TabsTrigger
              value="results"
              disabled={!showTable}
              className="flex-1 rounded-none data-[state=active]:bg-white data-[state=active]:shadow-none py-3"
            >
              <TableIcon className="mr-2 h-4 w-4" />
              Resultados
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="p-6 bg-white">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid w-full items-center gap-4">
                <div className="flex flex-col space-y-1.5">
                  <label
                    htmlFor="files"
                    className="text-center p-8 border-2 border-dashed rounded-xl cursor-pointer hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex flex-col items-center justify-center py-6">
                      <div className="h-16 w-16 rounded-full bg-blue-50 flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                        <Upload className="h-8 w-8 text-blue-500" />
                      </div>
                      <p className="text-lg font-medium text-slate-700 mb-2">Arrastra archivos XML aquí</p>
                      <p className="text-sm text-slate-500 mb-4">o haz clic para seleccionar</p>
                      <Badge variant="outline" className="bg-slate-100 text-slate-700">
                        Solo archivos CFDI 4.0 (.xml)
                      </Badge>
                    </div>
                    <input
                      id="files"
                      type="file"
                      multiple
                      accept=".xml"
                      className="hidden"
                      onChange={handleFileChange}
                      disabled={processing}
                    />
                  </label>
                </div>

                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleFolderSelect}
                    disabled={processing}
                    className="w-full sm:w-auto"
                  >
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Seleccionar Carpeta
                  </Button>
                </div>
              </div>

              {files.length > 0 && (
                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="flex items-center mb-2">
                    <FileCheck className="h-5 w-5 text-green-500 mr-2" />
                    <p className="font-medium">{files.length} archivo(s) seleccionado(s)</p>
                  </div>
                  <div className="max-h-32 overflow-y-auto border rounded-md bg-white">
                    <ul className="divide-y">
                      {files.slice(0, 5).map((file, index) => (
                        <li key={index} className="px-3 py-2 text-xs text-slate-600 truncate">
                          {file.name}
                        </li>
                      ))}
                      {files.length > 5 && (
                        <li className="px-3 py-2 text-xs text-slate-500 italic">
                          Y {files.length - 5} archivo(s) más...
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {processing && (
                <div className="space-y-2 bg-slate-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Procesando archivos...</span>
                    <span className="text-sm font-medium">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              <div className="flex justify-center pt-2">
                <Button
                  type="submit"
                  disabled={processing || files.length === 0}
                  className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
                >
                  {processing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <TableIcon className="mr-2 h-4 w-4" />
                      Procesar Archivos
                    </>
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="results" className="p-0 bg-white">
            {showTable && processedData.length > 0 ? (
              <div className="space-y-6">
                <DataTable data={processedData} onFilteredDataChange={updateFilteredData} />

                <div className="flex flex-col sm:flex-row justify-center gap-4 p-6 bg-slate-50 border-t">
                  <div className="flex items-center justify-center mb-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 px-3 py-1">
                      {filteredData.length} registro(s) seleccionado(s) para exportar
                    </Badge>
                  </div>
                  <Select value={exportTipoDocumento} onValueChange={setExportTipoDocumento}>
                    <SelectTrigger className="w-[280px]">
                      <SelectValue placeholder="Exportar por tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los tipos (archivos separados)</SelectItem>
                      <SelectItem value="Ingreso">Solo Ingresos</SelectItem>
                      <SelectItem value="Gasto">Solo Gastos</SelectItem>
                      <SelectItem value="ComplementoPagoEmitido">Solo Complementos de Pago Emitidos</SelectItem>
                      <SelectItem value="ComplementoPagoRecibido">Solo Complementos de Pago Recibidos</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    onClick={openExportDialog}
                    disabled={processing || filteredData.length === 0}
                    className="w-full sm:w-auto bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Exportando...
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        Exportar a Excel
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 bg-slate-50">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mb-4">
                  <TableIcon className="h-6 w-6 text-slate-500" />
                </div>
                <p className="text-slate-500 mb-4">No hay datos para mostrar.</p>
                <Button variant="outline" onClick={() => setActiveTab("upload")}>
                  Procesar archivos
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Modal de selección de columnas para exportar */}
      <ExportColumnsDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        columns={availableColumns}
        onExport={handleExportExcel}
      />
    </Card>
  )
}
