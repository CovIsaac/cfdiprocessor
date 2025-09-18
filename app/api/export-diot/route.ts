import { type NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { generateDIOTText } from "@/lib/diot-generator"

export async function POST(req: NextRequest) {
  try {
    const { data, month, year, format } = await req.json()

    if (!data || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ message: "No hay datos para exportar" }, { status: 400 })
    }

    // Exportar según el formato solicitado
    if (format === "txt") {
      // Generar texto en formato DIOT
      const diotText = generateDIOTText(data, month, year)

      // Devolver el archivo de texto
      return new NextResponse(diotText, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="DIOT_${year}_${String(month + 1).padStart(2, "0")}.txt"`,
        },
      })
    } else if (format === "excel") {
      // Crear un nuevo libro de Excel
      const workbook = XLSX.utils.book_new()

      // Crear una hoja de cálculo con los datos
      const worksheet = XLSX.utils.json_to_sheet(data)

      // Configurar anchos de columna
      const columnWidths = {
        A: 15, // RFC
        B: 30, // Nombre Proveedor
        C: 15, // Tipo Operación
        D: 15, // Tipo Tercero
        E: 15, // Tipo Tasa
        F: 15, // Importe Total
        G: 15, // IVA 16%
        H: 15, // IVA 8%
        I: 15, // IVA 0%
        J: 15, // IVA Exento
        K: 15, // IVA Retenido
        L: 15, // Importe Neto
        M: 10, // Facturas
      }

      worksheet["!cols"] = Object.keys(columnWidths).map((col) => ({
        wch: columnWidths[col as keyof typeof columnWidths],
      }))

      // Aplicar formatos de celda para montos
      for (let i = 0; i < data.length; i++) {
        const rowIndex = i + 1 // +1 para saltar la fila de encabezado

        // Aplicar formato de moneda a las columnas de montos
        const moneyColumns = ["F", "G", "H", "I", "J", "K", "L"]
        moneyColumns.forEach((col) => {
          const cellRef = `${col}${rowIndex + 1}`
          if (worksheet[cellRef]) {
            worksheet[cellRef].z = '"$"#,##0.00'
          }
        })
      }

      // Añadir la hoja al libro
      XLSX.utils.book_append_sheet(workbook, worksheet, "DIOT")

      // Convertir el libro a un buffer
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })

      // Devolver el archivo Excel
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="DIOT_${year}_${String(month + 1).padStart(2, "0")}.xlsx"`,
        },
      })
    } else {
      return NextResponse.json({ message: "Formato no soportado" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error al exportar DIOT:", error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Error al exportar DIOT" },
      { status: 500 },
    )
  }
}
