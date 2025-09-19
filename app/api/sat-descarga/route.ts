import { type NextRequest, NextResponse } from "next/server"
import { SATDescargaMasiva } from "@/lib/sat-descarga-masiva"
import { processSATZipFile } from "@/lib/process-sat-files"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const accion = formData.get("accion") as string
    const rfc = formData.get("rfc") as string | null

    console.log(`[SAT API] Acción solicitada: ${accion}`)

    if (!accion) {
      return NextResponse.json({ error: "Acción no especificada" }, { status: 400 })
    }

    if (!rfc || !/^[A-Z&Ñ]{3,4}\d{6}[A-Z\d]{3}$/.test(rfc)) {
      return NextResponse.json({ error: "RFC del solicitante inválido." }, { status: 400 })
    }

    // Obtener archivos de e.firma y otros datos
    const certificadoFile = formData.get("certificado") as File | null
    const llavePrivadaFile = formData.get("llavePrivada") as File | null
    const contrasena = formData.get("contrasena") as string | null

    if (accion !== "test" && (!certificadoFile || !llavePrivadaFile || !contrasena)) {
      return NextResponse.json({ error: "Información de e.firma incompleta o no proporcionada." }, { status: 400 })
    }

    // Validar tamaños de archivo
    if (certificadoFile && certificadoFile.size > 10240) {
      // 10KB
      return NextResponse.json(
        { error: "El archivo del certificado excede el tamaño máximo permitido (10KB)." },
        { status: 400 },
      )
    }

    if (llavePrivadaFile && llavePrivadaFile.size > 16384) {
      // 16KB
      return NextResponse.json(
        { error: "El archivo de la llave privada excede el tamaño máximo permitido (16KB)." },
        { status: 400 },
      )
    }

    let satClient: SATDescargaMasiva | null = null
    if (certificadoFile && llavePrivadaFile && contrasena && rfc) {
      try {
        const certificado = Buffer.from(await certificadoFile.arrayBuffer())
        const llavePrivada = Buffer.from(await llavePrivadaFile.arrayBuffer())

        // Validar que los archivos no estén vacíos
        if (certificado.length === 0) {
          throw new Error("El archivo de certificado está vacío")
        }
        if (llavePrivada.length === 0) {
          throw new Error("El archivo de llave privada está vacío")
        }

        satClient = new SATDescargaMasiva(certificado, llavePrivada, contrasena, rfc)
        console.log(`[SAT API] Cliente SAT inicializado para RFC: ${rfc}`)
      } catch (error) {
        console.error("[SAT API] Error al inicializar cliente SAT:", error)
        return NextResponse.json(
          {
            error:
              "Error al procesar los archivos de e.firma. Verifique que sean válidos y la contraseña sea correcta.",
            details: error instanceof Error ? error.message : String(error),
          },
          { status: 400 },
        )
      }
    }

    switch (accion) {
      case "autenticar":
        if (!satClient) return NextResponse.json({ error: "Cliente SAT no inicializado." }, { status: 500 })

        try {
          console.log("[SAT API] Iniciando autenticación...")
          const token = await satClient.autenticar()
          console.log("[SAT API] Autenticación exitosa")
          return NextResponse.json({ token: "Token obtenido exitosamente" })
        } catch (error) {
          console.error("[SAT API] Error en autenticación:", error)
          return NextResponse.json(
            {
              error: "Error de autenticación con el SAT. Verifique su e.firma y contraseña.",
              details: error instanceof Error ? error.message : String(error),
            },
            { status: 401 },
          )
        }

      case "crearSolicitud":
        if (!satClient) return NextResponse.json({ error: "Cliente SAT no inicializado." }, { status: 500 })

        const fechaInicial = formData.get("fechaInicial") as string
        const fechaFinal = formData.get("fechaFinal") as string
        const tipoSolicitud = formData.get("tipoSolicitud") as "CFDI" | "Metadata"
        const rfcEmisor = (formData.get("rfcEmisor") as string) || undefined
        const rfcReceptor = (formData.get("rfcReceptor") as string) || undefined

        if (!fechaInicial || !fechaFinal || !tipoSolicitud) {
          return NextResponse.json({ error: "Parámetros de solicitud incompletos" }, { status: 400 })
        }

        // Validar formato de fechas
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaInicial) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaFinal)) {
          return NextResponse.json({ error: "Formato de fecha inválido. Use AAAA-MM-DD." }, { status: 400 })
        }

        // Validar que las fechas sean lógicas
        const fechaIni = new Date(fechaInicial)
        const fechaFin = new Date(fechaFinal)
        if (fechaIni > fechaFin) {
          return NextResponse.json(
            { error: "La fecha inicial no puede ser mayor que la fecha final." },
            { status: 400 },
          )
        }

        // Validar rango máximo de 31 días
        const diffDays = (fechaFin.getTime() - fechaIni.getTime()) / (1000 * 60 * 60 * 24)
        if (diffDays > 31) {
          return NextResponse.json(
            { error: "El rango de fechas no puede ser mayor a 31 días." },
            { status: 400 },
          )
        }

        try {
          console.log(`[SAT API] Creando solicitud: ${fechaInicial} a ${fechaFinal}, tipo: ${tipoSolicitud}, rfcEmisor: ${rfcEmisor}, rfcReceptor: ${rfcReceptor}`)
          const idSolicitudNueva = await satClient.crearSolicitud(
            fechaInicial,
            fechaFinal,
            tipoSolicitud,
            rfcEmisor,
            rfcReceptor,
          )
          console.log(`[SAT API] Solicitud creada con ID: ${idSolicitudNueva}`)
          return NextResponse.json({
            idSolicitud: idSolicitudNueva,
            mensaje: "Solicitud creada exitosamente",
          })
        } catch (error: any) {
          // Log detallado para producción
          if (error?.response?.data) {
            console.error("[SAT API] Error al crear solicitud - respuesta SAT:", error.response.data)
          }
          console.error("[SAT API] Error al crear solicitud:", error)
          return NextResponse.json(
            {
              error: "Error al crear la solicitud en el SAT. Intente nuevamente.",
              details: error instanceof Error ? error.message : String(error),
              satResponse: error?.response?.data || null,
            },
            { status: 500 },
          )
        }

      case "verificarSolicitud":
        if (!satClient) return NextResponse.json({ error: "Cliente SAT no inicializado." }, { status: 500 })

        const idSolicitud = formData.get("idSolicitud") as string
        if (!idSolicitud) {
          return NextResponse.json({ error: "ID de solicitud no especificado" }, { status: 400 })
        }

        try {
          console.log(`[SAT API] Verificando solicitud: ${idSolicitud}`)
          const solicitud = await satClient.verificarSolicitud(idSolicitud)
          console.log(`[SAT API] Estado de solicitud ${idSolicitud}: ${solicitud.estatus}`)
          return NextResponse.json(solicitud)
        } catch (error) {
          console.error(`[SAT API] Error al verificar solicitud ${idSolicitud}:`, error)
          return NextResponse.json(
            {
              error: "Error al verificar el estado de la solicitud.",
              details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
          )
        }

      case "descargarPaquete":
        if (!satClient) return NextResponse.json({ error: "Cliente SAT no inicializado." }, { status: 500 })

        const idPaquete = formData.get("idPaquete") as string
        if (!idPaquete) {
          return NextResponse.json({ error: "ID de paquete no especificado" }, { status: 400 })
        }

        try {
          console.log(`[SAT API] Descargando paquete: ${idPaquete}`)
          const contenidoZipBuffer = await satClient.descargarPaquete(idPaquete)
          console.log(`[SAT API] Paquete ${idPaquete} descargado, tamaño: ${contenidoZipBuffer.length} bytes`)

          // Procesar el paquete ZIP para extraer y parsear los XML
          const cfdisProcesados = await processSATZipFile(contenidoZipBuffer)
          console.log(`[SAT API] ${cfdisProcesados.length} CFDI procesados del paquete ${idPaquete}`)

          return NextResponse.json({
            paqueteBase64: contenidoZipBuffer.toString("base64"),
            cfdis: cfdisProcesados,
            mensaje: `Paquete ${idPaquete} descargado y ${cfdisProcesados.length} CFDI procesados.`,
          })
        } catch (error) {
          console.error(`[SAT API] Error al descargar paquete ${idPaquete}:`, error)
          return NextResponse.json(
            {
              error: "Error al descargar el paquete del SAT.",
              details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
          )
        }

      default:
        return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 })
    }
  } catch (error) {
    console.error("[SAT API] Error general:", error)

    // Determinar el tipo de error y código de estado apropiado
    let statusCode = 500
    let errorMessage = "Error interno del servidor. Intente más tarde."

    if (error instanceof Error) {
      if (error.message.includes("fetch") || error.message.includes("network")) {
        statusCode = 503
        errorMessage = "Error de conectividad con los servicios del SAT. Verifique su conexión e intente más tarde."
      } else if (error.message.includes("timeout")) {
        statusCode = 504
        errorMessage = "Tiempo de espera agotado. Los servicios del SAT pueden estar sobrecargados."
      } else if (
        error.message.includes("certificate") ||
        error.message.includes("key") ||
        error.message.includes("firma")
      ) {
        statusCode = 400
        errorMessage = "Error en los archivos de e.firma. Verifique que sean válidos y la contraseña sea correcta."
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        timestamp: new Date().toISOString(),
        details: error instanceof Error ? error.message : String(error),
      },
      { status: statusCode },
    )
  }
}
