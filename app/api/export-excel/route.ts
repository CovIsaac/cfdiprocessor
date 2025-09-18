import { type NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"

export async function POST(req: NextRequest) {
  try {
    const { data, selectedColumns, preserveFormat } = await req.json()

    if (!data || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ message: "No hay datos para exportar" }, { status: 400 })
    }

    // Crear un nuevo libro de Excel
    const workbook = XLSX.utils.book_new()

    // Verificar si hay datos para procesar
    console.log(`Procesando ${data.length} registros para exportar`)

    // Crear una hoja de cálculo con los datos
    const worksheet = XLSX.utils.json_to_sheet(data)

    // Si se solicita preservar el formato, aplicar formatos específicos
    if (preserveFormat && data.length > 0) {
      // Obtener las columnas del conjunto de datos
      const columns = Object.keys(data[0] || {})
      console.log(`Aplicando formato a ${columns.length} columnas`)

      // Configurar anchos de columna
      const columnWidths: { [key: string]: number } = {}
      columns.forEach((col, index) => {
        // Convertir índice a letra de columna (A, B, C, etc.)
        const colLetter = XLSX.utils.encode_col(index)

        // Establecer ancho basado en el nombre de la columna
        if (col.includes("FECHA") || col.includes("DATE")) {
          columnWidths[colLetter] = 12
        } else if (col.includes("RFC") || col.includes("FOLIO")) {
          columnWidths[colLetter] = 15
        } else if (col.includes("NOMBRE") || col.includes("RAZON")) {
          columnWidths[colLetter] = 30
        } else if (
          col.includes("TOTAL") ||
          col.includes("SUBTOTAL") ||
          col.includes("IMPORTE") ||
          col.includes("MONTO")
        ) {
          columnWidths[colLetter] = 15
        } else {
          columnWidths[colLetter] = 18
        }
      })

      worksheet["!cols"] = Object.keys(columnWidths).map((col) => ({ wch: columnWidths[col] }))

      // Aplicar formatos de celda
      for (let i = 0; i < data.length; i++) {
        const row = data[i]
        columns.forEach((col, j) => {
          const cellRef = XLSX.utils.encode_cell({ r: i + 1, c: j }) // +1 para saltar la fila de encabezado

          // Aplicar formato según el tipo de dato
          if (typeof row[col] === "number") {
            if (col.includes("TOTAL") || col.includes("SUBTOTAL") || col.includes("IMPORTE") || col.includes("MONTO")) {
              // Formato de moneda
              if (!worksheet[cellRef]) worksheet[cellRef] = { v: row[col] }
              worksheet[cellRef].z = '"$"#,##0.00'
            } else {
              // Formato numérico general
              if (!worksheet[cellRef]) worksheet[cellRef] = { v: row[col] }
              worksheet[cellRef].z = "0.00"
            }
          } else if (typeof row[col] === "string" && row[col].match(/^\d{4}-\d{2}-\d{2}/)) {
            // Formato de fecha
            if (!worksheet[cellRef]) worksheet[cellRef] = { v: row[col] }
            worksheet[cellRef].z = "dd/mm/yyyy"
          }
        })
      }
    }

    // Añadir la hoja al libro
    XLSX.utils.book_append_sheet(workbook, worksheet, "CFDI")

    // Convertir el libro a un buffer
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })

    // Devolver el archivo Excel
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="cfdi-export.xlsx"`,
      },
    })
  } catch (error) {
    console.error("Error al exportar a Excel:", error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Error al exportar a Excel" },
      { status: 500 },
    )
  }
}
