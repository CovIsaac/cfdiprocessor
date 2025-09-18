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

interface DIOTResult {
  entries: DIOTEntry[]
  totalIVA: number
  totalOperaciones: number
}

/**
 * Genera los datos para la DIOT a partir de los CFDI procesados
 * @param data Datos de CFDI procesados
 * @param startDate Fecha de inicio en formato YYYY-MM-DD
 * @param endDate Fecha de fin en formato YYYY-MM-DD
 * @returns Datos agrupados para la DIOT
 */
export async function generateDIOT(data: any[], startDate: string, endDate: string): Promise<DIOTResult> {
  // Validar que haya datos
  if (!data || data.length === 0) {
    throw new Error("No hay datos para generar la DIOT")
  }

  try {
    // Filtrar solo facturas de gastos (proveedores) del período seleccionado
    const gastos = data.filter(
      (item) =>
        (item.TIPO_DOCUMENTO === "Gasto" || item.TIPO_DOCUMENTO === "ComplementoPagoRecibido") &&
        item.FECHA_CFDI >= startDate &&
        item.FECHA_CFDI <= endDate,
    )

    if (gastos.length === 0) {
      throw new Error(`No se encontraron facturas de gastos para el período ${startDate} al ${endDate}`)
    }

    // Agrupar por RFC de proveedor
    const proveedoresMap = new Map<string, any[]>()

    gastos.forEach((factura) => {
      const rfc = factura.RFC_EMISOR
      if (!proveedoresMap.has(rfc)) {
        proveedoresMap.set(rfc, [])
      }
      proveedoresMap.get(rfc)?.push(factura)
    })

    // Procesar cada proveedor para generar la entrada DIOT
    const diotEntries: DIOTEntry[] = []
    let totalIVA = 0
    let totalOperaciones = 0

    proveedoresMap.forEach((facturas, rfc) => {
      // Obtener el nombre del proveedor de la primera factura
      const nombreProveedor = facturas[0].NOMBRE_EMISOR || "DESCONOCIDO"

      // Calcular totales para este proveedor
      let importeTotal = 0
      let iva16 = 0
      let iva8 = 0
      let iva0 = 0
      let ivaExento = 0
      let ivaRetenido = 0

      facturas.forEach((factura) => {
        // Sumar importes
        importeTotal += factura.TOTAL || 0

        // Clasificar IVA según la tasa
        // Asumimos que IVA es al 16% por defecto
        iva16 += factura.IVA || 0

        // Si hay campo específico para IVA al 8%, sumarlo
        if (factura.IVA_8) {
          iva8 += factura.IVA_8
        }

        // Verificar si hay operaciones con tasa 0%
        if (factura.TASA_IMPUESTO === "0.000000" || factura.TASA_IMPUESTO === "0") {
          iva0 += factura.SUBTOTAL || 0
        }

        // Verificar si hay operaciones exentas
        if (factura.TASA_IMPUESTO === "Exento") {
          ivaExento += factura.SUBTOTAL || 0
        }

        // Sumar retenciones de IVA
        ivaRetenido += factura.RETENCION_IVA || 0
      })

      // Determinar tipo de operación (por defecto es "85" - Otros)
      const tipoOperacion = "85"

      // Determinar tipo de tercero (04 - Proveedor nacional)
      const tipoTercero = "04"

      // Determinar tipo de tasa según los montos
      let tipoTasa = "1" // Por defecto, tasa 16%
      if (iva16 === 0 && iva0 > 0) {
        tipoTasa = "2" // Tasa 0%
      } else if (iva16 === 0 && iva0 === 0 && ivaExento > 0) {
        tipoTasa = "3" // Exento
      }

      // Calcular importe neto (base para IVA)
      const importeNeto = importeTotal - iva16 - iva8 + ivaRetenido

      // Crear entrada DIOT
      const diotEntry: DIOTEntry = {
        rfc,
        nombreProveedor,
        tipoOperacion,
        tipoTercero,
        tipoTasa,
        importeTotal,
        iva16,
        iva8,
        iva0,
        ivaExento,
        ivaRetenido,
        importeNeto,
        facturas: facturas.length,
      }

      diotEntries.push(diotEntry)

      // Acumular totales generales
      totalIVA += iva16 + iva8
      totalOperaciones += importeTotal
    })

    // Ordenar por importe total (de mayor a menor)
    diotEntries.sort((a, b) => b.importeTotal - a.importeTotal)

    return {
      entries: diotEntries,
      totalIVA,
      totalOperaciones,
    }
  } catch (error) {
    console.error("Error al generar DIOT:", error)
    throw error
  }
}

/**
 * Genera el texto en formato DIOT para el SAT
 * @param data Datos de la DIOT
 * @param month Mes (0-11)
 * @param year Año
 * @returns Texto en formato DIOT
 */
export function generateDIOTText(data: DIOTEntry[], month: number, year: number): string {
  // El formato DIOT para el SAT tiene campos específicos en posiciones fijas
  // Referencia: https://www.sat.gob.mx/aplicacion/29162/verifica-el-esquema-de-la-declaracion-informativa-de-operaciones-con-terceros

  let diotText = ""

  data.forEach((entry) => {
    // Formatear valores según especificaciones del SAT
    const rfc = entry.rfc.padEnd(13, " ")
    const tipoTercero = entry.tipoTercero.padStart(2, "0")
    const tipoOperacion = entry.tipoOperacion.padStart(2, "0")

    // Montos en enteros (multiplicados por 100 y sin decimales)
    const importeTotal = Math.round(entry.importeTotal * 100)
      .toString()
      .padStart(14, "0")
    const iva16 = Math.round(entry.iva16 * 100)
      .toString()
      .padStart(14, "0")
    const iva8 = Math.round(entry.iva8 * 100)
      .toString()
      .padStart(14, "0")
    const iva0 = Math.round(entry.iva0 * 100)
      .toString()
      .padStart(14, "0")
    const ivaExento = Math.round(entry.ivaExento * 100)
      .toString()
      .padStart(14, "0")

    // Formato del mes y año
    const periodo = `${year}${(month + 1).toString().padStart(2, "0")}`

    // Construir línea según formato DIOT
    // Formato: RFC|TipoTercero|TipoOperacion|ImporteTotal|IVA16|IVA8|IVA0|IVAExento|Periodo
    const line = `${rfc}|${tipoTercero}|${tipoOperacion}|${importeTotal}|${iva16}|${iva8}|${iva0}|${ivaExento}|${periodo}|\n`

    diotText += line
  })

  return diotText
}
