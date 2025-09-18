import { type NextRequest, NextResponse } from "next/server"
import { DOMParser } from "@xmldom/xmldom"
import { processCFDI } from "@/lib/cfdi-processor"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll("files") as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ message: "No se proporcionaron archivos" }, { status: 400 })
    }

    // Procesar cada archivo XML
    const results = []
    for (const file of files) {
      const xmlContent = await file.text()
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(xmlContent, "text/xml")

      // Procesar el documento XML
      const cfdiData = processCFDI(xmlDoc)
      if (cfdiData) {
        results.push(cfdiData)
      }
    }

    // Devolver los resultados como JSON
    return NextResponse.json({ results })
  } catch (error) {
    console.error("Error al procesar los archivos:", error)
    return NextResponse.json({ message: "Error al procesar los archivos" }, { status: 500 })
  }
}
