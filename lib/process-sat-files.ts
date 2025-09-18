import * as fs from "fs"
import * as path from "path"
import * as AdmZip from "adm-zip"
import { DOMParser } from "@xmldom/xmldom"
import { processCFDI } from "@/lib/cfdi-processor"

/**
 * Procesa un archivo ZIP descargado del SAT
 * @param zipBuffer Buffer con el contenido del archivo ZIP
 * @returns Array con los datos procesados de los CFDI
 */
export async function processSATZipFile(zipBuffer: Buffer): Promise<any[]> {
  try {
    // Crear un objeto AdmZip con el buffer del archivo
    const zip = new AdmZip(zipBuffer)
    const zipEntries = zip.getEntries()

    // Array para almacenar los resultados
    const results: any[] = []

    // Procesar cada archivo XML dentro del ZIP
    for (const entry of zipEntries) {
      if (entry.entryName.toLowerCase().endsWith(".xml")) {
        // Extraer el contenido del archivo XML
        const xmlContent = entry.getData().toString("utf8")

        // Parsear el XML
        const parser = new DOMParser()
        const xmlDoc = parser.parseFromString(xmlContent, "text/xml")

        // Procesar el CFDI
        const cfdiData = processCFDI(xmlDoc)
        if (cfdiData) {
          results.push(cfdiData)
        }
      }
    }

    return results
  } catch (error) {
    console.error("Error al procesar archivo ZIP del SAT:", error)
    throw new Error(`Error al procesar archivo ZIP: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Guarda los archivos XML extraídos de un ZIP en una carpeta
 * @param zipBuffer Buffer con el contenido del archivo ZIP
 * @param outputDir Directorio donde guardar los archivos
 * @returns Número de archivos extraídos
 */
export async function extractSATZipFile(zipBuffer: Buffer, outputDir: string): Promise<number> {
  try {
    // Crear un objeto AdmZip con el buffer del archivo
    const zip = new AdmZip(zipBuffer)
    const zipEntries = zip.getEntries()

    // Asegurarse de que el directorio de salida existe
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Contador de archivos extraídos
    let extractedFiles = 0

    // Extraer cada archivo XML
    for (const entry of zipEntries) {
      if (entry.entryName.toLowerCase().endsWith(".xml")) {
        // Extraer el archivo
        const outputPath = path.join(outputDir, entry.entryName)
        zip.extractEntryTo(entry, outputDir, false, true)
        extractedFiles++
      }
    }

    return extractedFiles
  } catch (error) {
    console.error("Error al extraer archivos del ZIP:", error)
    throw new Error(`Error al extraer archivos: ${error instanceof Error ? error.message : String(error)}`)
  }
}
