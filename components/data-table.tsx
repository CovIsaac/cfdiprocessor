"use client"

import { useState, useMemo, useEffect } from "react"
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  getFilteredRowModel,
  type ColumnFiltersState,
} from "@tanstack/react-table"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  SortAsc,
  SortDesc,
  X,
  Filter,
  FileText,
  FileSearch,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface DataTableProps<TData> {
  data: TData[]
  onFilteredDataChange?: (filteredData: TData[]) => void
}

export function DataTable<TData>({ data, onFilteredDataChange }: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState("")
  const [tipoDocumentoFilter, setTipoDocumentoFilter] = useState<string>("todos")
  const [proveedorFilter, setProveedorFilter] = useState<string>("")
  const [clienteFilter, setClienteFilter] = useState<string>("")
  const [rfcFilter, setRfcFilter] = useState<string>("")
  const [proveedores, setProveedores] = useState<string[]>([])
  const [clientes, setClientes] = useState<string[]>([])
  const [rfcs, setRfcs] = useState<string[]>([])

  // Dynamically create columns based on the first data item
  const createColumns = (): ColumnDef<TData>[] => {
    if (!data.length) return []

    const firstItem = data[0]
    return Object.keys(firstItem as object).map((key) => ({
      accessorKey: key,
      header: ({ column }) => {
        return (
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-3 h-8 data-[state=sorted]:bg-slate-100 data-[state=sorted]:text-slate-900"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              <span className="font-medium">{formatColumnName(key)}</span>
              {column.getIsSorted() === "asc" ? (
                <SortAsc className="ml-1 h-4 w-4" />
              ) : column.getIsSorted() === "desc" ? (
                <SortDesc className="ml-1 h-4 w-4" />
              ) : null}
            </Button>
          </div>
        )
      },
      cell: ({ row }) => {
        const value = row.getValue(key)
        // Format numbers with commas and 2 decimal places
        if (typeof value === "number") {
          return formatCurrency(value)
        }
        // Format dates
        if (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}/)) {
          return formatDate(value)
        }
        return String(value || "")
      },
    }))
  }

  const columns = createColumns()

  // Contar documentos por tipo
  const documentCounts = useMemo(() => {
    const counts = {
      total: data.length,
      ingreso: 0,
      gasto: 0,
      complementoPagoEmitido: 0,
      complementoPagoRecibido: 0,
      desconocido: 0,
    }

    data.forEach((item: any) => {
      switch (item.TIPO_DOCUMENTO) {
        case "Ingreso":
          counts.ingreso++
          break
        case "Gasto":
          counts.gasto++
          break
        case "ComplementoPagoEmitido":
          counts.complementoPagoEmitido++
          break
        case "ComplementoPagoRecibido":
          counts.complementoPagoRecibido++
          break
        default:
          counts.desconocido++
      }
    })

    return counts
  }, [data])

  useEffect(() => {
    if (data.length > 0) {
      // Extraer todos los RFCs únicos (tanto de emisores como de receptores)
      const uniqueRfcs = Array.from(
        new Set(
          [...data.map((item: any) => item.RFC_EMISOR), ...data.map((item: any) => item.RFC_RECEPTOR)].filter(Boolean),
        ),
      ).sort()

      setRfcs(uniqueRfcs)

      // Filtrar los datos según los filtros actuales
      let filteredItems = [...data]

      // Aplicar filtro por tipo de documento si está activo
      if (tipoDocumentoFilter !== "todos") {
        filteredItems = filteredItems.filter((item: any) => item.TIPO_DOCUMENTO === tipoDocumentoFilter)
      }

      // Aplicar filtro por RFC si está activo
      if (rfcFilter) {
        filteredItems = filteredItems.filter(
          (item: any) => item.RFC_EMISOR === rfcFilter || item.RFC_RECEPTOR === rfcFilter,
        )
      }

      // Aplicar filtro por cliente si está activo
      if (clienteFilter) {
        const [_, rfcCliente] = extractNameAndRfc(clienteFilter)
        filteredItems = filteredItems.filter((item: any) => {
          if (item.TIPO_DOCUMENTO === "Ingreso" || item.TIPO_DOCUMENTO === "ComplementoPagoEmitido") {
            return item.RFC_RECEPTOR === rfcCliente
          }
          return true
        })
      }

      // Aplicar filtro por proveedor si está activo
      if (proveedorFilter) {
        const [_, rfcProveedor] = extractNameAndRfc(proveedorFilter)
        filteredItems = filteredItems.filter((item: any) => {
          if (item.TIPO_DOCUMENTO === "Gasto" || item.TIPO_DOCUMENTO === "ComplementoPagoRecibido") {
            return item.RFC_EMISOR === rfcProveedor
          }
          return true
        })
      }

      // Extraer proveedores únicos (emisores en documentos de gasto)
      const uniqueProveedores = Array.from(
        new Set(
          filteredItems
            .filter((item: any) => item.TIPO_DOCUMENTO === "Gasto" || item.TIPO_DOCUMENTO === "ComplementoPagoRecibido")
            .map((item: any) => `${item.NOMBRE_EMISOR} (${item.RFC_EMISOR})`),
        ),
      ).sort()

      // Extraer clientes únicos (receptores en documentos de ingreso)
      const uniqueClientes = Array.from(
        new Set(
          filteredItems
            .filter(
              (item: any) => item.TIPO_DOCUMENTO === "Ingreso" || item.TIPO_DOCUMENTO === "ComplementoPagoEmitido",
            )
            .map((item: any) => `${item.NOMBRE_RECEPTOR} (${item.RFC_RECEPTOR})`),
        ),
      ).sort()

      setProveedores(uniqueProveedores)
      setClientes(uniqueClientes)

      if (onFilteredDataChange) {
        onFilteredDataChange(filteredItems)
      }
    }
  }, [data, tipoDocumentoFilter, proveedorFilter, clienteFilter, rfcFilter, onFilteredDataChange])

  const filteredData = useMemo(() => {
    let result = data

    // Filtrar por tipo de documento
    if (tipoDocumentoFilter !== "todos") {
      result = result.filter((item: any) => item.TIPO_DOCUMENTO === tipoDocumentoFilter)
    }

    // Filtrar por RFC
    if (rfcFilter) {
      result = result.filter((item: any) => item.RFC_EMISOR === rfcFilter || item.RFC_RECEPTOR === rfcFilter)
    }

    // Filtrar por proveedor
    if (proveedorFilter) {
      const [nombre, rfc] = extractNameAndRfc(proveedorFilter)
      result = result.filter((item: any) => {
        // Solo aplicar a documentos donde el emisor es un proveedor
        if (item.TIPO_DOCUMENTO === "Gasto" || item.TIPO_DOCUMENTO === "ComplementoPagoRecibido") {
          return item.RFC_EMISOR === rfc
        }
        return true
      })
    }

    // Filtrar por cliente
    if (clienteFilter) {
      const [nombre, rfc] = extractNameAndRfc(clienteFilter)
      result = result.filter((item: any) => {
        // Solo aplicar a documentos donde el receptor es un cliente
        if (item.TIPO_DOCUMENTO === "Ingreso" || item.TIPO_DOCUMENTO === "ComplementoPagoEmitido") {
          return item.RFC_RECEPTOR === rfc
        }
        return true
      })
    }

    return result
  }, [data, tipoDocumentoFilter, proveedorFilter, clienteFilter, rfcFilter])

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

  // Notificar al componente padre sobre los datos filtrados
  useEffect(() => {
    if (onFilteredDataChange) {
      onFilteredDataChange(filteredData)
    }
  }, [filteredData, onFilteredDataChange])

  // Calcular totales para columnas numéricas
  const totals = useMemo(() => {
    if (!filteredData.length) return {}

    const totals: Record<string, number> = {}

    // Identify numeric columns from the first row
    const firstItem = filteredData[0] as Record<string, any>
    const numericColumns = Object.keys(firstItem).filter((key) => typeof firstItem[key] === "number")

    // Calculate sum for each numeric column
    numericColumns.forEach((column) => {
      totals[column] = filteredData.reduce((sum, row) => {
        const value = (row as Record<string, any>)[column]
        return sum + (typeof value === "number" ? value : 0)
      }, 0)
    })

    return totals
  }, [filteredData])

  function extractNameAndRfc(value: string): [string, string] {
    const match = value.match(/(.+) $$([A-Z0-9]+)$$$/)
    if (match) {
      return [match[1], match[2]]
    }
    return ["", ""]
  }

  function resetFilters() {
    setTipoDocumentoFilter("todos")
    setProveedorFilter("")
    setClienteFilter("")
    setRfcFilter("")
    setGlobalFilter("")
  }

  function formatColumnName(key: string): string {
    return key
      .replace(/_/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ")
  }

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("es-MX", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border-b p-4">
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 px-3 py-1 text-sm">
            <FileText className="h-4 w-4 mr-1" /> Total: {documentCounts.total}
          </Badge>
          {documentCounts.ingreso > 0 && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 px-3 py-1 text-sm">
              Ingresos: {documentCounts.ingreso}
            </Badge>
          )}
          {documentCounts.gasto > 0 && (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 px-3 py-1 text-sm">
              Gastos: {documentCounts.gasto}
            </Badge>
          )}
          {documentCounts.complementoPagoEmitido > 0 && (
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 px-3 py-1 text-sm">
              Comp. Pago Emitidos: {documentCounts.complementoPagoEmitido}
            </Badge>
          )}
          {documentCounts.complementoPagoRecibido > 0 && (
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 px-3 py-1 text-sm">
              Comp. Pago Recibidos: {documentCounts.complementoPagoRecibido}
            </Badge>
          )}
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar en todos los campos..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="h-10 pl-9 pr-9 w-full md:w-[300px] bg-slate-50 border-slate-200 focus:bg-white"
              />
              {globalFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setGlobalFilter("")}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-4 w-full">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Select value={tipoDocumentoFilter} onValueChange={setTipoDocumentoFilter}>
                <SelectTrigger className="w-full sm:w-[180px] md:w-[200px] h-10 bg-slate-50 border-slate-200">
                  <div className="flex items-center">
                    <Filter className="h-4 w-4 mr-2 text-slate-400" />
                    <SelectValue placeholder="Filtrar por tipo" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los documentos</SelectItem>
                  {data.some((item: any) => item.TIPO_DOCUMENTO === "Ingreso") && (
                    <SelectItem value="Ingreso">Ingresos</SelectItem>
                  )}
                  {data.some((item: any) => item.TIPO_DOCUMENTO === "Gasto") && (
                    <SelectItem value="Gasto">Gastos</SelectItem>
                  )}
                  {data.some((item: any) => item.TIPO_DOCUMENTO === "ComplementoPagoEmitido") && (
                    <SelectItem value="ComplementoPagoEmitido">Complementos de Pago Emitidos</SelectItem>
                  )}
                  {data.some((item: any) => item.TIPO_DOCUMENTO === "ComplementoPagoRecibido") && (
                    <SelectItem value="ComplementoPagoRecibido">Complementos de Pago Recibidos</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {rfcs.length > 0 && (
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Select value={rfcFilter} onValueChange={setRfcFilter}>
                  <SelectTrigger className="w-full sm:w-[180px] md:w-[200px] h-10 bg-slate-50 border-slate-200">
                    <div className="flex items-center">
                      <FileSearch className="h-4 w-4 mr-2 text-slate-400" />
                      <SelectValue placeholder="Filtrar por RFC" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los RFCs</SelectItem>
                    <ScrollArea className="h-[200px]">
                      {rfcs.map((rfc) => (
                        <SelectItem key={rfc} value={rfc}>
                          {rfc}
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>
            )}

            {proveedores.length > 0 && (
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Select value={proveedorFilter} onValueChange={setProveedorFilter}>
                  <SelectTrigger className="w-full sm:w-[180px] md:w-[200px] h-10 bg-slate-50 border-slate-200">
                    <div className="flex items-center">
                      <Filter className="h-4 w-4 mr-2 text-slate-400" />
                      <SelectValue placeholder="Filtrar por proveedor" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los proveedores</SelectItem>
                    <ScrollArea className="h-[200px]">
                      {proveedores.map((proveedor) => (
                        <SelectItem key={proveedor} value={proveedor}>
                          {proveedor}
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>
            )}

            {clientes.length > 0 && (
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Select value={clienteFilter} onValueChange={setClienteFilter}>
                  <SelectTrigger className="w-full sm:w-[180px] md:w-[200px] h-10 bg-slate-50 border-slate-200">
                    <div className="flex items-center">
                      <Filter className="h-4 w-4 mr-2 text-slate-400" />
                      <SelectValue placeholder="Filtrar por cliente" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los clientes</SelectItem>
                    <ScrollArea className="h-[200px]">
                      {clientes.map((cliente) => (
                        <SelectItem key={cliente} value={cliente}>
                          {cliente}
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="h-10 w-full md:w-auto"
              disabled={
                tipoDocumentoFilter === "todos" && !proveedorFilter && !clienteFilter && !rfcFilter && !globalFilter
              }
            >
              <X className="h-4 w-4 mr-2" />
              Limpiar filtros
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-md border shadow-sm overflow-hidden w-full">
        <div className="h-[500px] overflow-auto" style={{ overflowX: "auto", overflowY: "auto" }}>
          <div className="min-w-max">
            <Table>
              <TableHeader className="sticky top-0 bg-slate-50 z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="border-b border-slate-200 hover:bg-transparent">
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="whitespace-nowrap bg-slate-50 text-slate-600 py-3">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className={
                        (row.original as any).TIPO_DOCUMENTO === "Ingreso"
                          ? "bg-green-50 hover:bg-green-100"
                          : (row.original as any).TIPO_DOCUMENTO === "Gasto"
                            ? "bg-red-50 hover:bg-red-100"
                            : (row.original as any).TIPO_DOCUMENTO === "ComplementoPagoEmitido"
                              ? "bg-purple-50 hover:bg-purple-100"
                              : (row.original as any).TIPO_DOCUMENTO === "ComplementoPagoRecibido"
                                ? "bg-indigo-50 hover:bg-indigo-100"
                                : ""
                      }
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="whitespace-nowrap py-2">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No hay resultados.
                    </TableCell>
                  </TableRow>
                )}

                {/* Fila de totales */}
                {table.getRowModel().rows?.length > 0 && (
                  <TableRow className="bg-slate-100 font-medium sticky bottom-0">
                    {columns.map((column, index) => {
                      const columnKey = column.accessorKey as string

                      // Para la primera columna, mostrar "TOTALES"
                      if (index === 0) {
                        return (
                          <TableCell key={`total-${columnKey}`} className="whitespace-nowrap font-bold">
                            TOTALES
                          </TableCell>
                        )
                      }

                      // Para columnas numéricas, mostrar el total
                      if (totals[columnKey] !== undefined) {
                        return (
                          <TableCell key={`total-${columnKey}`} className="whitespace-nowrap font-bold">
                            {formatCurrency(totals[columnKey])}
                          </TableCell>
                        )
                      }

                      // Para otras columnas, celda vacía
                      return <TableCell key={`total-${columnKey}`} />
                    })}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 border rounded-md shadow-sm">
        <div className="flex items-center space-x-2">
          <p className="text-sm text-slate-600">
            Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
          </p>
          <Badge variant="outline" className="bg-slate-50">
            {table.getState().pagination.pageSize} por página
          </Badge>
        </div>
        <div className="flex items-center space-x-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                  className="h-8 w-8"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Primera página</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            variant="outline"
            size="icon"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                  className="h-8 w-8"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Última página</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  )
}
