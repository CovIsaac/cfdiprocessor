import { NextRequest, NextResponse } from "next/server"
import { processCFDI, generarDIOTTXT } from "@/lib/cfdi-processor"

export const runtime = "edge"

export async function POST(req: NextRequest) {
  try {
    // Espera un form-data con archivos XML y campos month/year
    const contentType = req.headers.get("content-type") || ""
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Se requiere multipart/form-data con archivos XML" }, { status: 400 })
    }

    const formData = await req.formData()
    const files = formData.getAll("files")
    const month = Number(formData.get("month"))
    const year = Number(formData.get("year"))
    const rfcReceptor = formData.get("rfcReceptor")?.toString() || "GOGR810728TV5"

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No se recibieron archivos XML" }, { status: 400 })
    }
    if (isNaN(month) || isNaN(year)) {
      return NextResponse.json({ error: "Mes o año inválido" }, { status: 400 })
    }

    // Procesar todos los XML
    const cfdis = []
    for (const file of files) {
      if (!(file instanceof File)) continue
      const text = await file.text()
      try {
        const parser = new DOMParser()
        const xmlDoc = parser.parseFromString(text, "text/xml")
        const cfdi = processCFDI(xmlDoc, rfcReceptor)
        if (cfdi) cfdis.push(cfdi)
      } catch (e) {
        // Ignorar archivos inválidos
      }
    }

    // Filtrar por periodo seleccionado
    const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`
    const endDate = new Date(year, month + 1, 0)
    const endDateStr = endDate.toISOString().slice(0, 10)
    const cfdisPeriodo = cfdis.filter(
      (c) => c.FECHA_CFDI >= startDate && c.FECHA_CFDI <= endDateStr && c.TIPO_DOCUMENTO === "Gasto"
    )

    if (cfdisPeriodo.length === 0) {
      return NextResponse.json({ error: "No hay CFDIs de gastos en el periodo seleccionado" }, { status: 400 })
    }

    // Generar el archivo DIOT TXT
    const txt = generarDIOTTXT(cfdisPeriodo)
    const encoder = new TextEncoder()
    const buffer = encoder.encode(txt)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename=diot_${year}_${String(month + 1).padStart(2, "0")}.txt`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    return NextResponse.json({ error: "Error al generar el archivo DIOT" }, { status: 500 })
  }
}
