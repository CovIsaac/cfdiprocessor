import axios from "axios"
import { XMLParser } from "fast-xml-parser"
import * as crypto from "crypto"
import * as forge from "node-forge"
import { v4 as uuidv4 } from "uuid"

// URLs oficiales de los servicios del SAT
const URLS = {
  AUTENTICACION: "https://cfdidescargamasivasolicitud.clouda.sat.gob.mx/Autenticacion/Autenticacion.svc",
  SOLICITUD: "https://cfdidescargamasivasolicitud.clouda.sat.gob.mx/SolicitaDescargaService.svc",
  VERIFICACION: "https://cfdidescargamasivasolicitud.clouda.sat.gob.mx/VerificaSolicitudDescargaService.svc",
  DESCARGA: "https://cfdidescargamasiva.clouda.sat.gob.mx/DescargaMasivaService.svc",
}

// Configuración de timeouts y reintentos
const CONFIG = {
  TIMEOUT: 60000, // 60 segundos
  MAX_RETRIES: 3,
  RETRY_DELAY: 3000, // 3 segundos
}

// Interfaces para los tipos de datos
export interface SolicitudDescarga {
  idSolicitud: string
  estatus: number
  estatusDescripcion: string
  codigoEstatus: string
  numeroCfdis: number
  mensaje: string
  paquetes: string[]
  // Campos adicionales para la UI
  fechaSolicitud?: string
  rfcSolicitante?: string
  fechaInicial?: string
  fechaFinal?: string
  tipoSolicitud?: string
}

export interface ResultadoAutenticacion {
  token: string
  expira: Date
}

export class SATDescargaMasiva {
  private certificado: Buffer
  private llavePrivada: Buffer
  private contrasenaLlave: string
  private rfcSolicitante: string
  private token: string | null = null
  private tokenExpira: Date | null = null
  private privateKey: forge.pki.PrivateKey | null = null

  constructor(certificado: Buffer, llavePrivada: Buffer, contrasenaLlave: string, rfcSolicitante: string) {
    this.certificado = certificado
    this.llavePrivada = llavePrivada
    this.contrasenaLlave = contrasenaLlave
    this.rfcSolicitante = rfcSolicitante
    this.initializePrivateKey()
  }

  /**
   * Inicializa la llave privada desde el archivo .key
   */
  private initializePrivateKey(): void {
    try {
      // Intentar cargar la llave privada en todos los formatos posibles
      let privateKey: forge.pki.PrivateKey | null = null
      const keyBuffer = this.llavePrivada
      const keyUtf8 = keyBuffer.toString("utf8")

      // 1. Intentar como PEM encriptado
      if (keyUtf8.includes("-----BEGIN ENCRYPTED PRIVATE KEY-----")) {
        try {
          privateKey = forge.pki.decryptRsaPrivateKey(keyUtf8, this.contrasenaLlave)
        } catch {}
      }
      // 2. Intentar como PEM sin encriptar
      if (!privateKey && keyUtf8.includes("-----BEGIN PRIVATE KEY-----")) {
        try {
          privateKey = forge.pki.privateKeyFromPem(keyUtf8)
        } catch {}
      }
      // 3. Intentar como PEM PKCS#1
      if (!privateKey && keyUtf8.includes("-----BEGIN RSA PRIVATE KEY-----")) {
        try {
          privateKey = forge.pki.privateKeyFromPem(keyUtf8)
        } catch {}
      }

      // 4. Intentar como DER PKCS#8 (binario, no encriptado)
      if (!privateKey && keyBuffer[0] === 0x30) {
        try {
          const forgeBuffer = forge.util.createBuffer(keyBuffer.toString('binary'));
          const p8 = forge.asn1.fromDer(forgeBuffer)
          privateKey = forge.pki.privateKeyFromAsn1(p8)
        } catch {}
      }
      // 5. Intentar como DER PKCS#8 encriptado (binario)
      if (!privateKey && keyBuffer[0] === 0x30) {
        try {
          const forgeBuffer = forge.util.createBuffer(keyBuffer.toString('binary'));
          const p8 = forge.asn1.fromDer(forgeBuffer)
          let decrypted = forge.pki.decryptPrivateKeyInfo(p8, this.contrasenaLlave)
          // Si el resultado es ASN.1, convertir a PrivateKey
          if (decrypted && typeof decrypted === 'object' && typeof (decrypted as any).sign !== 'function') {
            privateKey = forge.pki.privateKeyFromAsn1(decrypted)
          } else if (decrypted) {
            privateKey = decrypted
          }
        } catch {}
      }

      this.privateKey = privateKey

      if (!this.privateKey) {
        throw new Error("No se pudo cargar la llave privada en ningún formato soportado (PEM/DER, PKCS#1/PKCS#8, encriptado o no encriptado). Verifica el archivo y la contraseña.")
      }
      if (typeof (this.privateKey as any).sign !== 'function') {
        throw new Error("La llave privada fue cargada pero no es válida para firmar (no tiene método .sign). Verifica el formato y la contraseña.")
      }

      console.log("[SAT] Llave privada inicializada correctamente")
    } catch (error) {
      console.error("[SAT] Error al inicializar llave privada:", error)
      throw new Error(`Error al procesar la llave privada: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Calcula el DigestValue según la documentación del SAT
   */
  private calcularDigestValue(created: string, expires: string): string {
    // Crear el nodo Timestamp sin espacios como especifica la documentación
    const timestampXml = `<u:Timestamp u:Id="_0"><u:Created>${created}</u:Created><u:Expires>${expires}</u:Expires></u:Timestamp>`

    // Calcular SHA1 en formato binario
    const hash = crypto.createHash("sha1")
    hash.update(timestampXml, "utf8")
    const digestBytes = hash.digest()

    // Codificar a base64
    return digestBytes.toString("base64")
  }

  /**
   * Calcula el SignatureValue según la documentación del SAT
   */
  private calcularSignatureValue(signedInfoXml: string): string {
    if (!this.privateKey) {
      throw new Error("Llave privada no inicializada")
    }
    // Firmar el SignedInfo XML usando SHA1, como requiere el SAT
    const md = forge.md.sha1.create();
    md.update(signedInfoXml, "utf8");
    const signature = this.privateKey.sign(md);
    return forge.util.encode64(signature);
  }

  /**
   * Realiza una petición HTTP con reintentos automáticos
   */
  private async realizarPeticionConReintentos(
    url: string,
    data: string,
    headers: Record<string, string>,
    responseType: "text" | "arraybuffer" = "text",
  ): Promise<any> {
    let ultimoError: Error | null = null

    for (let intento = 1; intento <= CONFIG.MAX_RETRIES; intento++) {
      try {
        console.log(`[SAT] Intento ${intento}/${CONFIG.MAX_RETRIES} para ${url}`)

        const response = await axios.post(url, data, {
          headers: {
            ...headers,
            "User-Agent": "CFDI-Processor/1.5",
            Accept: "text/xml, application/soap+xml, application/xml",
            "Accept-Encoding": "gzip, deflate",
          },
          timeout: CONFIG.TIMEOUT,
          responseType: responseType as any,
          validateStatus: (status) => status < 500,
          maxRedirects: 0,
        })

        if (response.status >= 400) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        console.log(`[SAT] Petición exitosa en intento ${intento}`)
        return response.data
      } catch (error) {
        ultimoError = error instanceof Error ? error : new Error(String(error))
        console.error(`[SAT] Error en intento ${intento}:`, ultimoError.message)

        if (intento === CONFIG.MAX_RETRIES) {
          break
        }

        console.log(`[SAT] Esperando ${CONFIG.RETRY_DELAY}ms antes del siguiente intento...`)
        await new Promise((resolve) => setTimeout(resolve, CONFIG.RETRY_DELAY))
      }
    }

    throw new Error(`Error después de ${CONFIG.MAX_RETRIES} intentos: ${ultimoError?.message || "Error desconocido"}`)
  }

  /**
   * Autentica con el servicio del SAT y obtiene un token
   */
  public async autenticar(): Promise<string> {
    try {
      // Verificar si ya tenemos un token válido
      if (this.token && this.tokenExpira && this.tokenExpira > new Date()) {
        console.log("[SAT] Usando token existente válido")
        return this.token
      }

      console.log("[SAT] Iniciando proceso de autenticación...")

      // Generar fechas en formato UTC según la documentación
      const now = new Date()
      const created = now.toISOString()
      const expires = new Date(now.getTime() + 300000).toISOString() // 5 minutos después

      // Generar UUID según la documentación
      const uuid = `uuid-${uuidv4()}-4`

      // Convertir certificado a base64
      const certBase64 = this.certificado.toString("base64")

      // Calcular DigestValue según la documentación
      const digestValue = this.calcularDigestValue(created, expires)

      // Calcular SignatureValue según la documentación
  // Crear el SignedInfo XML
  const signedInfoXml = `<SignedInfo><CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/><Reference URI="#_0"><Transforms><Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;
  const signatureValue = this.calcularSignatureValue(signedInfoXml)

      // Crear el XML de autenticación según la documentación oficial
      const soapEnvelope = this.crearSoapEnvelopeAutenticacion(
        created,
        expires,
        uuid,
        certBase64,
        digestValue,
        signatureValue,
      )

      console.log("[SAT] XML de autenticación creado")

      // Enviar la solicitud al servicio de autenticación
      const responseData = await this.realizarPeticionConReintentos(URLS.AUTENTICACION, soapEnvelope, {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://DescargaMasivaTerceros.gob.mx/IAutenticacion/Autentica",
        Host: "cfdidescargamasivasolicitud.clouda.sat.gob.mx",
        Expect: "100-continue",
      })

      // Procesar la respuesta
      const resultado = await this.procesarRespuestaAutenticacion(responseData)

      // Guardar el token y su fecha de expiración
      this.token = resultado.token
      this.tokenExpira = resultado.expira

      console.log("[SAT] Autenticación completada exitosamente")
      return this.token
    } catch (error) {
      console.error("[SAT] Error en autenticación:", error)
      throw new Error(`Error en autenticación con el SAT: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Crea el XML de autenticación según la documentación oficial del SAT v1.5
   */
  private crearSoapEnvelopeAutenticacion(
    created: string,
    expires: string,
    uuid: string,
    certBase64: string,
    digestValue: string,
    signatureValue: string,
  ): string {
    const correlationId = uuidv4()

    return `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" xmlns:u="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
  <s:Header>
    <ActivityId CorrelationId="${correlationId}" xmlns="http://schemas.microsoft.com/2004/09/ServiceModel/Diagnostics">00000000-0000-0000-0000-000000000000</ActivityId>
    <o:Security s:mustUnderstand="1" xmlns:o="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
      <u:Timestamp u:Id="_0">
        <u:Created>${created}</u:Created>
        <u:Expires>${expires}</u:Expires>
      </u:Timestamp>
      <o:BinarySecurityToken u:Id="${uuid}" ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${certBase64}</o:BinarySecurityToken>
      <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
        <SignedInfo>
          <CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
          <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
          <Reference URI="#_0">
            <Transforms>
              <Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
            </Transforms>
            <DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
            <DigestValue>${digestValue}</DigestValue>
          </Reference>
        </SignedInfo>
        <SignatureValue>${signatureValue}</SignatureValue>
        <KeyInfo>
          <o:SecurityTokenReference>
            <o:Reference ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" URI="#${uuid}"/>
          </o:SecurityTokenReference>
        </KeyInfo>
      </Signature>
    </o:Security>
  </s:Header>
  <s:Body>
    <Autentica xmlns="http://DescargaMasivaTerceros.gob.mx"/>
  </s:Body>
</s:Envelope>`
  }

  /**
   * Crea una solicitud de descarga masiva
   */
  public async crearSolicitud(
    fechaInicial: string,
    fechaFinal: string,
    tipoSolicitud: "CFDI" | "Metadata" = "CFDI",
    rfcEmisor?: string,
    rfcReceptor?: string,
  ): Promise<string> {
    try {
      console.log(`[SAT] Creando solicitud de descarga: ${fechaInicial} a ${fechaFinal}`)

      // Asegurarse de tener un token válido
      const token = await this.autenticar()

      // Crear el XML para la solicitud SOAP según la documentación
      const soapEnvelope = this.crearSoapEnvelopeSolicitud(
        this.rfcSolicitante,
        fechaInicial,
        fechaFinal,
        tipoSolicitud,
        rfcEmisor,
        rfcReceptor,
      )

      // Firmar el XML
      const xmlFirmado = this.firmarXmlSolicitud(soapEnvelope)

      // Enviar la solicitud al servicio de solicitud
      const responseData = await this.realizarPeticionConReintentos(URLS.SOLICITUD, xmlFirmado, {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://DescargaMasivaTerceros.sat.gob.mx/ISolicitaDescargaService/SolicitaDescarga",
        Authorization: `WRAP access_token="${token}"`,
      })

      // Procesar la respuesta
      const idSolicitud = this.procesarRespuestaSolicitud(responseData)
      console.log(`[SAT] Solicitud creada con ID: ${idSolicitud}`)
      return idSolicitud
    } catch (error) {
      console.error("[SAT] Error al crear solicitud:", error)
      throw new Error(`Error al crear solicitud en el SAT: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Verifica el estado de una solicitud de descarga
   */
  public async verificarSolicitud(idSolicitud: string): Promise<SolicitudDescarga> {
    try {
      console.log(`[SAT] Verificando estado de solicitud: ${idSolicitud}`)

      // Asegurarse de tener un token válido
      const token = await this.autenticar()

      // Crear el XML para la solicitud SOAP según la documentación
      const soapEnvelope = this.crearSoapEnvelopeVerificacion(this.rfcSolicitante, idSolicitud)

      // Firmar el XML
      const xmlFirmado = this.firmarXmlSolicitud(soapEnvelope)

      // Enviar la solicitud al servicio de verificación
      const responseData = await this.realizarPeticionConReintentos(URLS.VERIFICACION, xmlFirmado, {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction:
          "http://DescargaMasivaTerceros.sat.gob.mx/IVerificaSolicitudDescargaService/VerificaSolicitudDescarga",
        Authorization: `WRAP access_token="${token}"`,
      })

      // Procesar la respuesta
      const solicitud = this.procesarRespuestaVerificacion(responseData)
      solicitud.idSolicitud = idSolicitud
      console.log(`[SAT] Estado de solicitud ${idSolicitud}: ${solicitud.estatus} - ${solicitud.estatusDescripcion}`)
      return solicitud
    } catch (error) {
      console.error(`[SAT] Error al verificar solicitud ${idSolicitud}:`, error)
      throw new Error(
        `Error al verificar solicitud en el SAT: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Descarga un paquete específico
   */
  public async descargarPaquete(idPaquete: string): Promise<Buffer> {
    try {
      console.log(`[SAT] Descargando paquete: ${idPaquete}`)

      // Asegurarse de tener un token válido
      const token = await this.autenticar()

      // Crear el XML para la solicitud SOAP
      const soapEnvelope = this.crearSoapEnvelopeDescarga(this.rfcSolicitante, idPaquete)

      // Firmar el XML
      const xmlFirmado = this.firmarXmlSolicitud(soapEnvelope)

      // Enviar la solicitud al servicio de descarga
      const responseData = await this.realizarPeticionConReintentos(
        URLS.DESCARGA,
        xmlFirmado,
        {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: "http://DescargaMasivaTerceros.sat.gob.mx/IDescargaMasivaTercerosService/Descargar",
          Authorization: `WRAP access_token="${token}"`,
        },
        "arraybuffer",
      )

      // Procesar la respuesta
      const buffer = this.procesarRespuestaDescarga(responseData)
      console.log(`[SAT] Paquete ${idPaquete} descargado exitosamente, tamaño: ${buffer.length} bytes`)
      return buffer
    } catch (error) {
      console.error(`[SAT] Error al descargar paquete ${idPaquete}:`, error)
      throw new Error(`Error al descargar paquete del SAT: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Métodos privados para crear los XML SOAP (resto de solicitudes)
  private crearSoapEnvelopeSolicitud(
    rfcSolicitante: string,
    fechaInicial: string,
    fechaFinal: string,
    tipoSolicitud: "CFDI" | "Metadata",
    rfcEmisor?: string,
    rfcReceptor?: string,
  ): string {
    let solicitudXml = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx" xmlns:xd="http://www.w3.org/2000/09/xmldsig#">
  <soapenv:Header/>
  <soapenv:Body>
    <des:SolicitaDescarga>
      <des:solicitud RfcSolicitante="${rfcSolicitante}" FechaInicial="${fechaInicial}T00:00:00.000" FechaFinal="${fechaFinal}T23:59:59.000" TipoSolicitud="${tipoSolicitud}"`

    if (rfcEmisor) {
      solicitudXml += ` RfcEmisor="${rfcEmisor}"`
    }

    if (rfcReceptor) {
      solicitudXml += ` RfcReceptor="${rfcReceptor}"`
    }

    solicitudXml += `>
      </des:solicitud>
    </des:SolicitaDescarga>
  </soapenv:Body>
</soapenv:Envelope>`

    return solicitudXml
  }

  private crearSoapEnvelopeVerificacion(rfcSolicitante: string, idSolicitud: string): string {
    return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx" xmlns:xd="http://www.w3.org/2000/09/xmldsig#">
  <soapenv:Header/>
  <soapenv:Body>
    <des:VerificaSolicitudDescarga>
      <des:solicitud IdSolicitud="${idSolicitud}" RfcSolicitante="${rfcSolicitante}">
      </des:solicitud>
    </des:VerificaSolicitudDescarga>
  </soapenv:Body>
</soapenv:Envelope>`
  }

  private crearSoapEnvelopeDescarga(rfcSolicitante: string, idPaquete: string): string {
    return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx" xmlns:xd="http://www.w3.org/2000/09/xmldsig#">
  <soapenv:Header/>
  <soapenv:Body>
    <des:Descargar>
      <des:peticionDescarga IdPaquete="${idPaquete}" RfcSolicitante="${rfcSolicitante}">
      </des:peticionDescarga>
    </des:Descargar>
  </soapenv:Body>
</soapenv:Envelope>`
  }

  // Métodos para procesar las respuestas
  private async procesarRespuestaAutenticacion(xmlResponse: string): Promise<ResultadoAutenticacion> {
    try {
      console.log("[SAT] Procesando respuesta de autenticación...")

      const parser = new XMLParser({ ignoreAttributes: false })
      const result = parser.parse(xmlResponse)

      // Verificar si hay un fault SOAP
      if (result["s:envelope"]?.["s:body"]?.["s:fault"] || result["s:Envelope"]?.["s:Body"]?.["s:Fault"]) {
        const fault = result["s:envelope"]?.["s:body"]?.["s:fault"] || result["s:Envelope"]?.["s:Body"]?.["s:Fault"]
        throw new Error(`SOAP Fault: ${fault.faultstring || fault.detail || "Error desconocido en el servicio"}`)
      }

      // Buscar la respuesta de autenticación (case insensitive)
      const body = result["s:envelope"]?.["s:body"] || result["s:Envelope"]?.["s:Body"]
      if (!body) {
        throw new Error("Respuesta SOAP inválida: no se encontró el elemento Body")
      }

      const autenticaResponse = body["autenticaresponse"] || body["AutenticaResponse"]
      if (!autenticaResponse) {
        throw new Error("Respuesta de autenticación inválida: no se encontró AutenticaResponse")
      }

      const autenticaResult = autenticaResponse["autenticaresult"] || autenticaResponse["AutenticaResult"]
      if (!autenticaResult) {
        throw new Error("Respuesta de autenticación inválida: no se encontró AutenticaResult")
      }

      // Extraer el token y la fecha de expiración
      const token = autenticaResult
      const expira = new Date()
      expira.setMinutes(expira.getMinutes() + 4) // 4 minutos para tener margen

      return { token, expira }
    } catch (error) {
      console.error("[SAT] Error al procesar respuesta de autenticación:", error)
      throw new Error(
        `Error al procesar respuesta de autenticación: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  private procesarRespuestaSolicitud(xmlResponse: string): string {
    try {
      console.log("[SAT] Procesando respuesta de solicitud...")

      const parser = new XMLParser({ ignoreAttributes: false })
      const result = parser.parse(xmlResponse)

      // Verificar si hay un fault SOAP
      if (result["s:Envelope"]?.["s:Body"]?.["s:Fault"]) {
        const fault = result["s:Envelope"]["s:Body"]["s:Fault"]
        throw new Error(`SOAP Fault: ${fault.faultstring || fault.detail || "Error desconocido en el servicio"}`)
      }

      // Navegar a través del objeto para encontrar el ID de solicitud
      const body = result["s:Envelope"]?.["s:Body"]
      if (!body) {
        throw new Error("Respuesta SOAP inválida: no se encontró el elemento Body")
      }

      const solicitaDescargaResponse = body["SolicitaDescargaResponse"]
      if (!solicitaDescargaResponse) {
        throw new Error("Respuesta de solicitud inválida: no se encontró SolicitaDescargaResponse")
      }

      const solicitaDescargaResult = solicitaDescargaResponse["SolicitaDescargaResult"]
      if (!solicitaDescargaResult) {
        throw new Error("Respuesta de solicitud inválida: no se encontró SolicitaDescargaResult")
      }

      // Extraer el ID de solicitud
      const idSolicitud = solicitaDescargaResult["@_IdSolicitud"]
      if (!idSolicitud) {
        throw new Error("No se pudo obtener el ID de la solicitud de la respuesta")
      }

      return idSolicitud
    } catch (error) {
      console.error("[SAT] Error al procesar respuesta de solicitud:", error)
      throw new Error(
        `Error al procesar respuesta de solicitud: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  private procesarRespuestaVerificacion(xmlResponse: string): SolicitudDescarga {
    try {
      console.log("[SAT] Procesando respuesta de verificación...")

      const parser = new XMLParser({ ignoreAttributes: false })
      const result = parser.parse(xmlResponse)

      // Verificar si hay un fault SOAP
      if (result["s:Envelope"]?.["s:Body"]?.["s:Fault"]) {
        const fault = result["s:Envelope"]["s:Body"]["s:Fault"]
        throw new Error(`SOAP Fault: ${fault.faultstring || fault.detail || "Error desconocido en el servicio"}`)
      }

      // Navegar a través del objeto para encontrar la información de la solicitud
      const body = result["s:Envelope"]?.["s:Body"]
      if (!body) {
        throw new Error("Respuesta SOAP inválida: no se encontró el elemento Body")
      }

      const verificaSolicitudDescargaResponse = body["VerificaSolicitudDescargaResponse"]
      if (!verificaSolicitudDescargaResponse) {
        throw new Error("Respuesta de verificación inválida: no se encontró VerificaSolicitudDescargaResponse")
      }

      const verificaSolicitudDescargaResult = verificaSolicitudDescargaResponse["VerificaSolicitudDescargaResult"]
      if (!verificaSolicitudDescargaResult) {
        throw new Error("Respuesta de verificación inválida: no se encontró VerificaSolicitudDescargaResult")
      }

      // Extraer la información de la solicitud
      const estatus = Number.parseInt(verificaSolicitudDescargaResult["@_EstadoSolicitud"] || "0")
      const codigoEstatus = verificaSolicitudDescargaResult["@_CodigoEstadoSolicitud"] || ""
      const numeroCfdis = Number.parseInt(verificaSolicitudDescargaResult["@_NumeroCFDIs"] || "0")
      const mensaje = verificaSolicitudDescargaResult["@_Mensaje"] || ""

      // Extraer los IDs de paquetes si existen
      const paquetes: string[] = []
      if (verificaSolicitudDescargaResult["IdsPaquetes"]) {
        const idsPaquetes = verificaSolicitudDescargaResult["IdsPaquetes"]
        if (Array.isArray(idsPaquetes)) {
          paquetes.push(...idsPaquetes)
        } else {
          paquetes.push(idsPaquetes)
        }
      }

      return {
        idSolicitud: "",
        estatus,
        estatusDescripcion: this.obtenerDescripcionEstatus(estatus),
        codigoEstatus,
        numeroCfdis,
        mensaje,
        paquetes,
      }
    } catch (error) {
      console.error("[SAT] Error al procesar respuesta de verificación:", error)
      throw new Error(
        `Error al procesar respuesta de verificación: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  private procesarRespuestaDescarga(data: ArrayBuffer): Buffer {
    try {
      // Convertir ArrayBuffer a Buffer
      const buffer = Buffer.from(data)

      // Verificar que el buffer no esté vacío
      if (buffer.length === 0) {
        throw new Error("El paquete descargado está vacío")
      }

      // Verificar que sea un archivo ZIP válido (comienza con PK)
      if (buffer.length < 4 || buffer.toString("ascii", 0, 2) !== "PK") {
        throw new Error("El archivo descargado no es un ZIP válido")
      }

      return buffer
    } catch (error) {
      console.error("[SAT] Error al procesar respuesta de descarga:", error)
      throw new Error(
        `Error al procesar respuesta de descarga: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  // Métodos de firma XML simplificados para solicitudes (no autenticación)
  private firmarXmlSolicitud(xml: string): string {
    // Para las solicitudes que no son de autenticación, simplemente retornamos el XML
    // ya que la autenticación se maneja por separado con el token
    return xml
  }

  private obtenerDescripcionEstatus(estatus: number): string {
    switch (estatus) {
      case 1:
        return "Aceptada"
      case 2:
        return "En Proceso"
      case 3:
        return "Terminada"
      case 4:
        return "Error"
      case 5:
        return "Rechazada"
      case 6:
        return "Vencida"
      default:
        return "Desconocido"
    }
  }
}
