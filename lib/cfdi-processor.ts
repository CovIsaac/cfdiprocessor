// Modificar el tipo para incluir los complementos de pago emitidos y recibidos
export type TipoDocumento = "Ingreso" | "Gasto" | "ComplementoPagoEmitido" | "ComplementoPagoRecibido" | "Desconocido"

// Modificar la interfaz CFDIData para incluir el tipo de documento
interface CFDIData {
  VERSION_CFDI: string // Añadido para identificar la versión
  TIPO_DOCUMENTO: TipoDocumento
  FOLIO: string
  FOLIO_FISCAL: string
  FECHA_CFDI: string
  NOMBRE_EMISOR: string
  RFC_EMISOR: string
  FORMA_DE_PAGO: string
  METODO_DE_PAGO: string
  REGIMEN_RECEPTOR: string
  CONCEPTO: string
  SUBTOTAL: number
  DESCUENTO: number
  IVA: number
  IEPS: number
  IMPUESTO_LOCAL: number
  RETENCION_ISR: number
  RETENCION_IVA: number
  TOTAL: number
  MONEDA: string
  TIPO_DE_CAMBIO: number
  USO_DE_CFDI: string
  NOMBRE_RECEPTOR: string
  RFC_RECEPTOR: string
  REGIMEN_EMISOR: string
  // Campos adicionales para complementos de pago
  VERSION_PAGOS?: string
  TOTAL_RETENCIONES_IVA?: number
  TOTAL_RETENCIONES_ISR?: number
  TOTAL_TRASLADOS_BASE_IVA16?: number
  TOTAL_TRASLADOS_IMPUESTO_IVA16?: number
  // ... más campos de complementos
  [key: string]: any // Para permitir campos dinámicos
}

interface PagoData {
  FECHA_PAGO: string
  FORMA_DE_PAGO: string
  MONEDA_PAGO: string
  MONTO_PAGO: number
  TIPO_CAMBIO_PAGO: number
  NUM_OPERACION?: string
  RFC_EMISOR_CTA_ORD?: string
  NOMBRE_BANCO_ORD_EXT?: string
  CTA_ORDENANTE?: string
  RFC_EMISOR_CTA_BEN?: string
  CTA_BENEFICIARIO?: string
  // ... más campos de pago
}

interface DoctoRelacionadoData {
  ID_DOCUMENTO: string
  SERIE_DR: string
  FOLIO_DR: string
  IMP_SALDO_ANT: number
  IMP_PAGADO: number
  IMP_SALDO_INSOLUTO: number
  OBJETO_IMP_DR?: string
  EQUIVALENCIA_DR?: number
  // ... más campos de documento relacionado
}

// Función para detectar la versión del CFDI
function detectarVersionCFDI(xmlDoc: Document): string {
  try {
    const comprobante = xmlDoc.getElementsByTagName("cfdi:Comprobante")[0]
    if (!comprobante) return "desconocido"

    const version = comprobante.getAttribute("Version") || comprobante.getAttribute("version")
    return version || "desconocido"
  } catch (error) {
    console.error("Error al detectar versión del CFDI:", error)
    return "desconocido"
  }
}

// Función para detectar la versión del complemento de pagos
function detectarVersionPagos(xmlDoc: Document): string {
  try {
    // Intentar con Pagos 2.0 (CFDI 4.0)
    const pagos20 = xmlDoc.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos20", "Pagos")[0]
    if (pagos20) {
      return pagos20.getAttribute("Version") || "2.0"
    }

    // Intentar con Pagos 1.0 (CFDI 3.3)
    const pagos10 = xmlDoc.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos", "Pagos")[0]
    if (pagos10) {
      return pagos10.getAttribute("Version") || "1.0"
    }

    return "desconocido"
  } catch (error) {
    console.error("Error al detectar versión del complemento de pagos:", error)
    return "desconocido"
  }
}

// Modificar la función clasificarXML para identificar correctamente los complementos de pago emitidos y recibidos
function clasificarXML(xmlDoc: Document, rfcReceptor: string): TipoDocumento {
  try {
    const comprobante = xmlDoc.getElementsByTagName("cfdi:Comprobante")[0]
    if (!comprobante) return "Desconocido"

    const tipoComprobante =
      comprobante.getAttribute("TipoDeComprobante") || comprobante.getAttribute("tipoDeComprobante")

    // Verificar si es un complemento de pago (tanto para 3.3 como 4.0)
    const pagos20Node = xmlDoc.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos20", "Pagos")[0]
    const pagos10Node = xmlDoc.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos", "Pagos")[0]

    if (pagos20Node || pagos10Node || tipoComprobante === "P") {
      // Obtener el RFC del emisor y receptor del XML
      const emisor = xmlDoc.getElementsByTagName("cfdi:Emisor")[0]
      const receptor = xmlDoc.getElementsByTagName("cfdi:Receptor")[0]
      const rfcEmisorXML = emisor ? emisor.getAttribute("Rfc") || emisor.getAttribute("rfc") : ""
      const rfcReceptorXML = receptor ? receptor.getAttribute("Rfc") || receptor.getAttribute("rfc") : ""

      // Si el RFC del receptor en el XML coincide con el RFC proporcionado,
      // entonces es un complemento de pago recibido
      if (rfcReceptorXML === rfcReceptor) {
        return "ComplementoPagoRecibido"
      }

      // Si el RFC del emisor en el XML coincide con el RFC proporcionado,
      // entonces es un complemento de pago emitido
      if (rfcEmisorXML === rfcReceptor) {
        return "ComplementoPagoEmitido"
      }

      // Si no podemos determinar, asumimos que es un complemento de pago recibido
      return "ComplementoPagoRecibido"
    }

    // Obtener el RFC del receptor del XML
    const receptor = xmlDoc.getElementsByTagName("cfdi:Receptor")[0]
    const rfcReceptorXML = receptor ? receptor.getAttribute("Rfc") || receptor.getAttribute("rfc") : ""

    // Si el RFC del receptor en el XML coincide con el RFC proporcionado,
    // entonces es un gasto (factura recibida)
    if (rfcReceptorXML === rfcReceptor && tipoComprobante === "I") {
      return "Gasto"
    }

    // Si el RFC del emisor en el XML coincide con el RFC proporcionado,
    // entonces es un ingreso (factura emitida)
    if (tipoComprobante === "I") {
      return "Ingreso"
    }

    return "Desconocido"
  } catch (error) {
    console.error("Error al clasificar XML:", error)
    return "Desconocido"
  }
}

// Modificar la función processCFDI para incluir el RFC del receptor y soportar ambas versiones
export function processCFDI(xmlDoc: Document, rfcReceptor = "GOGR810728TV5"): CFDIData | null {
  try {
    // Detectar la versión del CFDI
    const versionCFDI = detectarVersionCFDI(xmlDoc)

    // Verificar que sea un CFDI 3.3 o 4.0
    if (versionCFDI !== "3.3" && versionCFDI !== "4.0") {
      console.warn(`El documento no es un CFDI 3.3 o 4.0 válido. Versión detectada: ${versionCFDI}`)
      return null
    }

    const comprobante = xmlDoc.getElementsByTagName("cfdi:Comprobante")[0]
    if (!comprobante) {
      console.warn("No se encontró el nodo cfdi:Comprobante")
      return null
    }

    // Clasificar el documento usando el RFC del receptor
    const tipoDocumento = clasificarXML(xmlDoc, rfcReceptor)

    // Extraer datos básicos del CFDI (compatibles con ambas versiones)
    const cfdiData: CFDIData = {
      VERSION_CFDI: versionCFDI,
      TIPO_DOCUMENTO: tipoDocumento,
      FOLIO: comprobante.getAttribute("Folio") || comprobante.getAttribute("folio") || "",
      FOLIO_FISCAL: extractUUID(xmlDoc),
      FECHA_CFDI: (comprobante.getAttribute("Fecha") || comprobante.getAttribute("fecha") || "").substring(0, 10),
      NOMBRE_EMISOR: extractEmisorAttribute(xmlDoc, "Nombre", "nombre"),
      RFC_EMISOR: extractEmisorAttribute(xmlDoc, "Rfc", "rfc"),
      FORMA_DE_PAGO: comprobante.getAttribute("FormaPago") || comprobante.getAttribute("formaPago") || "",
      METODO_DE_PAGO: comprobante.getAttribute("MetodoPago") || comprobante.getAttribute("metodoPago") || "",
      REGIMEN_RECEPTOR:
        versionCFDI === "4.0" ? translateRegimenFiscal(extractReceptorAttribute(xmlDoc, "RegimenFiscalReceptor")) : "", // En 3.3 no existe este atributo
      CONCEPTO: extractConceptos(xmlDoc),
      SUBTOTAL: Number.parseFloat(comprobante.getAttribute("SubTotal") || comprobante.getAttribute("subTotal") || "0"),
      DESCUENTO: Number.parseFloat(
        comprobante.getAttribute("Descuento") || comprobante.getAttribute("descuento") || "0",
      ),
      IVA: extractImpuestos(xmlDoc, "traslados", "002", versionCFDI),
      IEPS: extractImpuestos(xmlDoc, "traslados", "003", versionCFDI),
      IMPUESTO_LOCAL: extractImpuestosLocales(xmlDoc),
      RETENCION_ISR: extractImpuestos(xmlDoc, "retenciones", "001", versionCFDI),
      RETENCION_IVA: extractImpuestos(xmlDoc, "retenciones", "002", versionCFDI),
      TOTAL: Number.parseFloat(comprobante.getAttribute("Total") || comprobante.getAttribute("total") || "0"),
      MONEDA: comprobante.getAttribute("Moneda") || comprobante.getAttribute("moneda") || "",
      TIPO_DE_CAMBIO: Number.parseFloat(
        comprobante.getAttribute("TipoCambio") || comprobante.getAttribute("tipoCambio") || "1",
      ),
      USO_DE_CFDI: extractReceptorAttribute(xmlDoc, "UsoCFDI", "usoCFDI"),
      NOMBRE_RECEPTOR: extractReceptorAttribute(xmlDoc, "Nombre", "nombre"),
      RFC_RECEPTOR: extractReceptorAttribute(xmlDoc, "Rfc", "rfc"),
      REGIMEN_EMISOR: translateRegimenFiscal(extractEmisorAttribute(xmlDoc, "RegimenFiscal", "regimenFiscal")),
    }

    // Detectar versión del complemento de pagos
    const versionPagos = detectarVersionPagos(xmlDoc)

    // Extraer datos del complemento de pagos (si existe)
    if (versionPagos === "2.0") {
      // Procesar Pagos 2.0 (CFDI 4.0)
      procesarPagos20(xmlDoc, cfdiData)
    } else if (versionPagos === "1.0") {
      // Procesar Pagos 1.0 (CFDI 3.3)
      procesarPagos10(xmlDoc, cfdiData)
    }

    return cfdiData
  } catch (error) {
    console.error("Error al procesar CFDI:", error)
    return null
  }
}

// Función para procesar complemento de Pagos 2.0 (CFDI 4.0)
function procesarPagos20(xmlDoc: Document, cfdiData: CFDIData): void {
  const pagosNode = xmlDoc.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos20", "Pagos")[0]
  if (!pagosNode) return

  // Datos del nodo principal Pagos
  cfdiData.VERSION_PAGOS = pagosNode.getAttribute("Version") || "2.0"
  cfdiData.TOTAL_RETENCIONES_IVA = Number.parseFloat(pagosNode.getAttribute("TotalRetencionesIVA") || "0")
  cfdiData.TOTAL_RETENCIONES_ISR = Number.parseFloat(pagosNode.getAttribute("TotalRetencionesISR") || "0")
  cfdiData.TOTAL_TRASLADOS_BASE_IVA16 = Number.parseFloat(pagosNode.getAttribute("TotalTrasladosBaseIVA16") || "0")
  cfdiData.TOTAL_TRASLADOS_IMPUESTO_IVA16 = Number.parseFloat(
    pagosNode.getAttribute("TotalTrasladosImpuestoIVA16") || "0",
  )

  // Procesar nodos de pago
  const pagos = pagosNode.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos20", "Pago")
  for (let i = 0; i < pagos.length; i++) {
    const pago = pagos[i]
    const pagoData: PagoData = {
      FECHA_PAGO: pago.getAttribute("FechaPago") || "",
      FORMA_DE_PAGO: pago.getAttribute("FormaDePagoP") || "",
      MONEDA_PAGO: pago.getAttribute("MonedaP") || "",
      MONTO_PAGO: Number.parseFloat(pago.getAttribute("Monto") || "0"),
      TIPO_CAMBIO_PAGO: Number.parseFloat(pago.getAttribute("TipoCambioP") || "1"),
      NUM_OPERACION: pago.getAttribute("NumOperacion") || "",
      RFC_EMISOR_CTA_ORD: pago.getAttribute("RfcEmisorCtaOrd") || "",
      NOMBRE_BANCO_ORD_EXT: pago.getAttribute("NomBancoOrdExt") || "",
      CTA_ORDENANTE: pago.getAttribute("CtaOrdenante") || "",
      RFC_EMISOR_CTA_BEN: pago.getAttribute("RfcEmisorCtaBen") || "",
      CTA_BENEFICIARIO: pago.getAttribute("CtaBeneficiario") || "",
    }

    // Añadir datos de pago al objeto principal con índice
    cfdiData[`FECHA_PAGO_${i + 1}`] = pagoData.FECHA_PAGO
    cfdiData[`FORMA_DE_PAGO_${i + 1}`] = pagoData.FORMA_DE_PAGO
    cfdiData[`MONEDA_PAGO_${i + 1}`] = pagoData.MONEDA_PAGO
    cfdiData[`MONTO_PAGO_${i + 1}`] = pagoData.MONTO_PAGO
    cfdiData[`TIPO_CAMBIO_PAGO_${i + 1}`] = pagoData.TIPO_CAMBIO_PAGO
    cfdiData[`NUM_OPERACION_${i + 1}`] = pagoData.NUM_OPERACION
    cfdiData[`RFC_EMISOR_CTA_ORD_${i + 1}`] = pagoData.RFC_EMISOR_CTA_ORD
    cfdiData[`NOMBRE_BANCO_ORD_EXT_${i + 1}`] = pagoData.NOMBRE_BANCO_ORD_EXT
    cfdiData[`CTA_ORDENANTE_${i + 1}`] = pagoData.CTA_ORDENANTE
    cfdiData[`RFC_EMISOR_CTA_BEN_${i + 1}`] = pagoData.RFC_EMISOR_CTA_BEN
    cfdiData[`CTA_BENEFICIARIO_${i + 1}`] = pagoData.CTA_BENEFICIARIO

    // Extraer impuestos del pago
    const impuestosPNode = pago.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos20", "ImpuestosP")[0]
    if (impuestosPNode) {
      // Procesar retenciones y traslados del pago
      extractImpuestosPago20(impuestosPNode, i + 1, cfdiData)
    }

    // Procesar documentos relacionados
    const doctos = pago.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos20", "DoctoRelacionado")
    for (let j = 0; j < doctos.length; j++) {
      const docto = doctos[j]
      const doctoData: DoctoRelacionadoData = {
        ID_DOCUMENTO: docto.getAttribute("IdDocumento") || "",
        SERIE_DR: docto.getAttribute("Serie") || "",
        FOLIO_DR: docto.getAttribute("Folio") || "",
        IMP_SALDO_ANT: Number.parseFloat(docto.getAttribute("ImpSaldoAnt") || "0"),
        IMP_PAGADO: Number.parseFloat(docto.getAttribute("ImpPagado") || "0"),
        IMP_SALDO_INSOLUTO: Number.parseFloat(docto.getAttribute("ImpSaldoInsoluto") || "0"),
        OBJETO_IMP_DR: docto.getAttribute("ObjetoImpDR") || "",
        EQUIVALENCIA_DR: Number.parseFloat(docto.getAttribute("EquivalenciaDR") || "1"),
      }

      // Añadir datos de documento relacionado al objeto principal con índices
      const docIndex = `${i + 1}_${j + 1}`
      cfdiData[`ID_DOCUMENTO_${docIndex}`] = doctoData.ID_DOCUMENTO
      cfdiData[`SERIE_DR_${docIndex}`] = doctoData.SERIE_DR
      cfdiData[`FOLIO_DR_${docIndex}`] = doctoData.FOLIO_DR
      cfdiData[`IMP_SALDO_ANT_${docIndex}`] = doctoData.IMP_SALDO_ANT
      cfdiData[`IMP_PAGADO_${docIndex}`] = doctoData.IMP_PAGADO
      cfdiData[`IMP_SALDO_INSOLUTO_${docIndex}`] = doctoData.IMP_SALDO_INSOLUTO
      cfdiData[`OBJETO_IMP_DR_${docIndex}`] = doctoData.OBJETO_IMP_DR
      cfdiData[`EQUIVALENCIA_DR_${docIndex}`] = doctoData.EQUIVALENCIA_DR

      // Extraer impuestos del documento relacionado
      const impuestosDRNode = docto.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos20", "ImpuestosDR")[0]
      if (impuestosDRNode) {
        // Procesar retenciones y traslados del documento relacionado
        extractImpuestosDR20(impuestosDRNode, docIndex, cfdiData)
      }
    }
  }
}

// Función para procesar complemento de Pagos 1.0 (CFDI 3.3)
function procesarPagos10(xmlDoc: Document, cfdiData: CFDIData): void {
  const pagosNode = xmlDoc.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos", "Pagos")[0]
  if (!pagosNode) return

  // Datos del nodo principal Pagos
  cfdiData.VERSION_PAGOS = pagosNode.getAttribute("Version") || "1.0"

  // En Pagos 1.0 no hay totales a nivel Pagos como en 2.0
  cfdiData.TOTAL_RETENCIONES_IVA = 0
  cfdiData.TOTAL_RETENCIONES_ISR = 0
  cfdiData.TOTAL_TRASLADOS_BASE_IVA16 = 0
  cfdiData.TOTAL_TRASLADOS_IMPUESTO_IVA16 = 0

  // Procesar nodos de pago
  const pagos = pagosNode.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos", "Pago")
  for (let i = 0; i < pagos.length; i++) {
    const pago = pagos[i]
    const pagoData: PagoData = {
      FECHA_PAGO: pago.getAttribute("FechaPago") || "",
      FORMA_DE_PAGO: pago.getAttribute("FormaDePagoP") || "",
      MONEDA_PAGO: pago.getAttribute("MonedaP") || "",
      MONTO_PAGO: Number.parseFloat(pago.getAttribute("Monto") || "0"),
      TIPO_CAMBIO_PAGO: Number.parseFloat(pago.getAttribute("TipoCambioP") || "1"),
      NUM_OPERACION: pago.getAttribute("NumOperacion") || "",
      RFC_EMISOR_CTA_ORD: pago.getAttribute("RfcEmisorCtaOrd") || "",
      NOMBRE_BANCO_ORD_EXT: pago.getAttribute("NomBancoOrdExt") || "",
      CTA_ORDENANTE: pago.getAttribute("CtaOrdenante") || "",
      RFC_EMISOR_CTA_BEN: pago.getAttribute("RfcEmisorCtaBen") || "",
      CTA_BENEFICIARIO: pago.getAttribute("CtaBeneficiario") || "",
    }

    // Añadir datos de pago al objeto principal con índice
    cfdiData[`FECHA_PAGO_${i + 1}`] = pagoData.FECHA_PAGO
    cfdiData[`FORMA_DE_PAGO_${i + 1}`] = pagoData.FORMA_DE_PAGO
    cfdiData[`MONEDA_PAGO_${i + 1}`] = pagoData.MONEDA_PAGO
    cfdiData[`MONTO_PAGO_${i + 1}`] = pagoData.MONTO_PAGO
    cfdiData[`TIPO_CAMBIO_PAGO_${i + 1}`] = pagoData.TIPO_CAMBIO_PAGO
    cfdiData[`NUM_OPERACION_${i + 1}`] = pagoData.NUM_OPERACION
    cfdiData[`RFC_EMISOR_CTA_ORD_${i + 1}`] = pagoData.RFC_EMISOR_CTA_ORD
    cfdiData[`NOMBRE_BANCO_ORD_EXT_${i + 1}`] = pagoData.NOMBRE_BANCO_ORD_EXT
    cfdiData[`CTA_ORDENANTE_${i + 1}`] = pagoData.CTA_ORDENANTE
    cfdiData[`RFC_EMISOR_CTA_BEN_${i + 1}`] = pagoData.RFC_EMISOR_CTA_BEN
    cfdiData[`CTA_BENEFICIARIO_${i + 1}`] = pagoData.CTA_BENEFICIARIO

    // En Pagos 1.0 no hay nodo de impuestos a nivel de pago

    // Procesar documentos relacionados
    const doctos = pago.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos", "DoctoRelacionado")
    for (let j = 0; j < doctos.length; j++) {
      const docto = doctos[j]
      const doctoData: DoctoRelacionadoData = {
        ID_DOCUMENTO: docto.getAttribute("IdDocumento") || "",
        SERIE_DR: docto.getAttribute("Serie") || "",
        FOLIO_DR: docto.getAttribute("Folio") || "",
        IMP_SALDO_ANT: Number.parseFloat(docto.getAttribute("ImpSaldoAnt") || "0"),
        IMP_PAGADO: Number.parseFloat(docto.getAttribute("ImpPagado") || "0"),
        IMP_SALDO_INSOLUTO: Number.parseFloat(docto.getAttribute("ImpSaldoInsoluto") || "0"),
        // En Pagos 1.0 no existe ObjetoImpDR ni EquivalenciaDR
        OBJETO_IMP_DR: "",
        EQUIVALENCIA_DR: 1,
      }

      // Añadir datos de documento relacionado al objeto principal con índices
      const docIndex = `${i + 1}_${j + 1}`
      cfdiData[`ID_DOCUMENTO_${docIndex}`] = doctoData.ID_DOCUMENTO
      cfdiData[`SERIE_DR_${docIndex}`] = doctoData.SERIE_DR
      cfdiData[`FOLIO_DR_${docIndex}`] = doctoData.FOLIO_DR
      cfdiData[`IMP_SALDO_ANT_${docIndex}`] = doctoData.IMP_SALDO_ANT
      cfdiData[`IMP_PAGADO_${docIndex}`] = doctoData.IMP_PAGADO
      cfdiData[`IMP_SALDO_INSOLUTO_${docIndex}`] = doctoData.IMP_SALDO_INSOLUTO
      cfdiData[`OBJETO_IMP_DR_${docIndex}`] = doctoData.OBJETO_IMP_DR
      cfdiData[`EQUIVALENCIA_DR_${docIndex}`] = doctoData.EQUIVALENCIA_DR

      // En Pagos 1.0 no hay nodo de impuestos a nivel de documento relacionado
    }
  }
}

// Funciones auxiliares para extracción de datos
function extractUUID(xmlDoc: Document): string {
  try {
    // Intentar con el namespace de TimbreFiscalDigital
    const timbreFiscal = xmlDoc.getElementsByTagNameNS(
      "http://www.sat.gob.mx/TimbreFiscalDigital",
      "TimbreFiscalDigital",
    )[0]

    if (timbreFiscal) {
      return timbreFiscal.getAttribute("UUID") || timbreFiscal.getAttribute("uuid") || ""
    }

    // Si no se encuentra, intentar con getElementsByTagName
    const timbreFiscalAlt = xmlDoc.getElementsByTagName("tfd:TimbreFiscalDigital")[0]
    if (timbreFiscalAlt) {
      return timbreFiscalAlt.getAttribute("UUID") || timbreFiscalAlt.getAttribute("uuid") || ""
    }

    return ""
  } catch (error) {
    console.error("Error al extraer UUID:", error)
    return ""
  }
}

function extractEmisorAttribute(xmlDoc: Document, attribute: string, altAttribute?: string): string {
  try {
    const emisor = xmlDoc.getElementsByTagName("cfdi:Emisor")[0]
    if (!emisor) return ""

    return emisor.getAttribute(attribute) || (altAttribute ? emisor.getAttribute(altAttribute) : "") || ""
  } catch (error) {
    console.error(`Error al extraer atributo ${attribute} del emisor:`, error)
    return ""
  }
}

function extractReceptorAttribute(xmlDoc: Document, attribute: string, altAttribute?: string): string {
  try {
    const receptor = xmlDoc.getElementsByTagName("cfdi:Receptor")[0]
    if (!receptor) return ""

    return receptor.getAttribute(attribute) || (altAttribute ? receptor.getAttribute(altAttribute) : "") || ""
  } catch (error) {
    console.error(`Error al extraer atributo ${attribute} del receptor:`, error)
    return ""
  }
}

function extractConceptos(xmlDoc: Document): string {
  try {
    const conceptos = xmlDoc.getElementsByTagName("cfdi:Concepto")
    const descripciones = []

    for (let i = 0; i < conceptos.length; i++) {
      const descripcion = conceptos[i].getAttribute("Descripcion") || conceptos[i].getAttribute("descripcion")
      if (descripcion) {
        descripciones.push(descripcion)
      }
    }

    return descripciones.join(" | ")
  } catch (error) {
    console.error("Error al extraer conceptos:", error)
    return ""
  }
}

function extractImpuestos(
  xmlDoc: Document,
  tipo: "traslados" | "retenciones",
  impuesto: string,
  versionCFDI: string,
): number {
  try {
    let total = 0

    // Extraer impuestos a nivel de concepto
    const conceptos = xmlDoc.getElementsByTagName("cfdi:Concepto")
    for (let i = 0; i < conceptos.length; i++) {
      const concepto = conceptos[i]
      const impuestosNode = concepto.getElementsByTagName("cfdi:Impuestos")[0]

      if (impuestosNode) {
        const nodeName = tipo === "traslados" ? "cfdi:Traslado" : "cfdi:Retencion"
        const impuestosItems = concepto.getElementsByTagName(nodeName)

        for (let j = 0; j < impuestosItems.length; j++) {
          const item = impuestosItems[j]
          const impuestoAttr = item.getAttribute("Impuesto") || item.getAttribute("impuesto")
          if (impuestoAttr === impuesto) {
            const importe = item.getAttribute("Importe") || item.getAttribute("importe") || "0"
            total += Number.parseFloat(importe)
          }
        }
      }
    }

    // Extraer impuestos a nivel de comprobante (para CFDI 3.3)
    if (versionCFDI === "3.3") {
      const impuestosNode = xmlDoc.getElementsByTagName("cfdi:Impuestos")[0]
      if (impuestosNode) {
        const nodeName = tipo === "traslados" ? "cfdi:Traslados" : "cfdi:Retenciones"
        const impuestosGroup = impuestosNode.getElementsByTagName(nodeName)[0]

        if (impuestosGroup) {
          const itemName = tipo === "traslados" ? "cfdi:Traslado" : "cfdi:Retencion"
          const items = impuestosGroup.getElementsByTagName(itemName)

          for (let i = 0; i < items.length; i++) {
            const item = items[i]
            const impuestoAttr = item.getAttribute("Impuesto") || item.getAttribute("impuesto")
            if (impuestoAttr === impuesto) {
              const importe = item.getAttribute("Importe") || item.getAttribute("importe") || "0"
              // No sumamos directamente para evitar duplicar, ya que en 3.3 los impuestos
              // pueden estar tanto a nivel concepto como a nivel comprobante
              if (total === 0) {
                total = Number.parseFloat(importe)
              }
            }
          }
        }
      }
    }

    return total
  } catch (error) {
    console.error(`Error al extraer impuestos (${tipo}, ${impuesto}):`, error)
    return 0
  }
}

function extractImpuestosLocales(xmlDoc: Document): number {
  try {
    let total = 0
    const impuestosLocales = xmlDoc.getElementsByTagNameNS("http://www.sat.gob.mx/implocal", "TrasladosLocales")

    for (let i = 0; i < impuestosLocales.length; i++) {
      const importe = impuestosLocales[i].getAttribute("Importe") || impuestosLocales[i].getAttribute("importe") || "0"
      total += Number.parseFloat(importe)
    }

    return total
  } catch (error) {
    console.error("Error al extraer impuestos locales:", error)
    return 0
  }
}

// Funciones para extraer impuestos de Pagos 2.0
function extractImpuestosPago20(impuestosNode: Element, pagoIndex: number, cfdiData: any): void {
  try {
    // Extraer retenciones del pago
    const retencionesNode = impuestosNode.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos20", "RetencionesP")[0]
    if (retencionesNode) {
      const retenciones = retencionesNode.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos20", "RetencionP")
      for (let i = 0; i < retenciones.length; i++) {
        const retencion = retenciones[i]
        const impuesto = retencion.getAttribute("ImpuestoP") || ""
        const importe = Number.parseFloat(retencion.getAttribute("ImporteP") || "0")

        cfdiData[`RETENCION_${impuesto}_PAGO_${pagoIndex}`] = importe
      }
    }

    // Extraer traslados del pago
    const trasladosNode = impuestosNode.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos20", "TrasladosP")[0]
    if (trasladosNode) {
      const traslados = trasladosNode.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos20", "TrasladoP")
      for (let i = 0; i < traslados.length; i++) {
        const traslado = traslados[i]
        const impuesto = traslado.getAttribute("ImpuestoP") || ""
        const importe = Number.parseFloat(traslado.getAttribute("ImporteP") || "0")
        const base = Number.parseFloat(traslado.getAttribute("BaseP") || "0")
        const tasaOCuota = traslado.getAttribute("TasaOCuotaP") || ""

        cfdiData[`TRASLADO_${impuesto}_BASE_PAGO_${pagoIndex}`] = base
        cfdiData[`TRASLADO_${impuesto}_TASA_PAGO_${pagoIndex}`] = tasaOCuota
        cfdiData[`TRASLADO_${impuesto}_IMPORTE_PAGO_${pagoIndex}`] = importe
      }
    }
  } catch (error) {
    console.error(`Error al extraer impuestos del pago ${pagoIndex}:`, error)
  }
}

function extractImpuestosDR20(impuestosNode: Element, docIndex: string, cfdiData: any): void {
  try {
    // Extraer retenciones del documento relacionado
    const retencionesNode = impuestosNode.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos20", "RetencionesDR")[0]
    if (retencionesNode) {
      const retenciones = retencionesNode.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos20", "RetencionDR")
      for (let i = 0; i < retenciones.length; i++) {
        const retencion = retenciones[i]
        const impuesto = retencion.getAttribute("ImpuestoDR") || ""
        const importe = Number.parseFloat(retencion.getAttribute("ImporteDR") || "0")

        cfdiData[`RETENCION_${impuesto}_DR_${docIndex}`] = importe
      }
    }

    // Extraer traslados del documento relacionado
    const trasladosNode = impuestosNode.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos20", "TrasladosDR")[0]
    if (trasladosNode) {
      const traslados = trasladosNode.getElementsByTagNameNS("http://www.sat.gob.mx/Pagos20", "TrasladoDR")
      for (let i = 0; i < traslados.length; i++) {
        const traslado = traslados[i]
        const impuesto = traslado.getAttribute("ImpuestoDR") || ""
        const importe = Number.parseFloat(traslado.getAttribute("ImporteDR") || "0")
        const base = Number.parseFloat(traslado.getAttribute("BaseDR") || "0")
        const tasaOCuota = traslado.getAttribute("TasaOCuotaDR") || ""

        cfdiData[`TRASLADO_${impuesto}_BASE_DR_${docIndex}`] = base
        cfdiData[`TRASLADO_${impuesto}_TASA_DR_${docIndex}`] = tasaOCuota
        cfdiData[`TRASLADO_${impuesto}_IMPORTE_DR_${docIndex}`] = importe
      }
    }
  } catch (error) {
    console.error(`Error al extraer impuestos del documento relacionado ${docIndex}:`, error)
  }
}

function translateRegimenFiscal(regimenCode: string): string {
  const regimenes: { [key: string]: string } = {
    "601": "General de Ley Personas Morales",
    "603": "Personas Morales con Fines no Lucrativos",
    "605": "Sueldos y Salarios e Ingresos Asimilados a Salarios",
    "606": "Arrendamiento",
    "608": "Demás ingresos",
    "609": "Consolidación",
    "610": "Residentes en el Extranjero sin Establecimiento Permanente en México",
    "611": "Ingresos por Dividendos (socios y accionistas)",
    "612": "Personas Físicas con Actividades Empresariales y Profesionales",
    "614": "Ingresos por intereses",
    "616": "Sin obligaciones fiscales",
    "620": "Sociedades Cooperativas de Producción que optan por diferir sus ingresos",
    "621": "Incorporación Fiscal",
    "622": "Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras",
    "623": "Opcional para Grupos de Sociedades",
    "624": "Coordinados",
    "625": "Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas",
    "626": "Régimen Simplificado de Confianza",
  }

  return regimenes[regimenCode] || `Régimen no identificado: ${regimenCode}`
}
