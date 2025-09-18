"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"

interface ExportColumnsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  columns: string[]
  onExport: (selectedColumns: string[]) => void
}

export function ExportColumnsDialog({ open, onOpenChange, columns, onExport }: ExportColumnsDialogProps) {
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")

  // Cargar la última configuración guardada al abrir el modal
  useEffect(() => {
    if (open) {
      try {
        const savedColumns = localStorage.getItem("cfdiExportColumns")
        if (savedColumns) {
          // Filtrar para asegurarse que solo se incluyan columnas que existen actualmente
          const parsedColumns = JSON.parse(savedColumns)
          const validColumns = parsedColumns.filter((col: string) => columns.includes(col))
          setSelectedColumns(validColumns.length > 0 ? validColumns : [...columns])
        } else {
          // Si no hay configuración guardada, seleccionar todas las columnas
          setSelectedColumns([...columns])
        }
      } catch (error) {
        console.error("Error al cargar la configuración guardada:", error)
        setSelectedColumns([...columns])
      }
    }
  }, [open, columns])

  const handleSelectAll = () => {
    setSelectedColumns([...columns])
  }

  const handleDeselectAll = () => {
    setSelectedColumns([])
  }

  const handleColumnToggle = (column: string) => {
    if (selectedColumns.includes(column)) {
      setSelectedColumns(selectedColumns.filter((col) => col !== column))
    } else {
      setSelectedColumns([...selectedColumns, column])
    }
  }

  const handleExport = () => {
    // Asegurarse de que haya al menos una columna seleccionada
    if (selectedColumns.length === 0) {
      // Si no hay columnas seleccionadas, seleccionar todas
      const allColumns = [...columns]
      localStorage.setItem("cfdiExportColumns", JSON.stringify(allColumns))
      onExport(allColumns)
    } else {
      // Guardar la configuración actual
      localStorage.setItem("cfdiExportColumns", JSON.stringify(selectedColumns))
      // Llamar a la función de exportación con las columnas seleccionadas
      onExport(selectedColumns)
    }

    // Cerrar el modal
    onOpenChange(false)
  }

  // Filtrar columnas según la búsqueda
  const filteredColumns = columns.filter((column) => column.toLowerCase().includes(searchQuery.toLowerCase()))

  const formatColumnName = (key: string): string => {
    return key
      .replace(/_/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md md:max-w-lg">
        <DialogHeader>
          <DialogTitle>Seleccionar columnas para exportar</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              Seleccionar todo
            </Button>
            <Button variant="outline" size="sm" onClick={handleDeselectAll}>
              Deseleccionar todo
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar columnas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4"
            />
          </div>

          <ScrollArea className="h-[300px] border rounded-md p-4">
            <div className="space-y-3">
              {filteredColumns.map((column) => (
                <div key={column} className="flex items-center space-x-2">
                  <Checkbox
                    id={`column-${column}`}
                    checked={selectedColumns.includes(column)}
                    onCheckedChange={() => handleColumnToggle(column)}
                  />
                  <Label
                    htmlFor={`column-${column}`}
                    className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {formatColumnName(column)}
                  </Label>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="text-sm text-slate-500">
            {selectedColumns.length} de {columns.length} columnas seleccionadas
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleExport}
            className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600"
          >
            Exportar {selectedColumns.length > 0 ? selectedColumns.length : columns.length} columnas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
