export async function processFiles(files: File[], progressCallback: (progress: number) => void): Promise<any[]> {
  const formData = new FormData()

  files.forEach((file, index) => {
    formData.append(`files`, file)
  })

  try {
    const response = await fetch("/api/process-cfdi", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || "Error al procesar los archivos")
    }

    // Simular progreso para la demo
    // En producción, se podría usar un stream o websockets para progreso real
    const totalSteps = 100
    for (let i = 0; i <= totalSteps; i++) {
      await new Promise((resolve) => setTimeout(resolve, 30))
      progressCallback((i / totalSteps) * 100)
    }

    // Obtener los datos procesados
    const data = await response.json()
    return data.results
  } catch (error) {
    console.error("Error:", error)
    throw error
  }
}

// Modificar la función exportToExcel para generar archivos separados por tipo de documento
processFiles.exportToExcel = async (
  data: any[],
  selectedColumns?: string[],
  tipoDocumento = "todos",
): Promise<void> => {
  try {
    // Si no se proporcionaron columnas seleccionadas o está vacío, usar todas las columnas
    const columnsToUse =
      selectedColumns && selectedColumns.length > 0 ? selectedColumns : data.length > 0 ? Object.keys(data[0]) : []

    console.log("Columnas a exportar:", columnsToUse)

    // Si se seleccionó un tipo específico, exportar solo ese tipo
    if (tipoDocumento !== "todos") {
      const filteredData = data.filter((item) => item.TIPO_DOCUMENTO === tipoDocumento)

      if (filteredData.length === 0) {
        throw new Error(`No hay documentos de tipo ${tipoDocumento} para exportar`)
      }

      // Generar nombre de archivo según el tipo
      let filenameSuffix = ""
      switch (tipoDocumento) {
        case "Ingreso":
          filenameSuffix = "ingresos"
          break
        case "Gasto":
          filenameSuffix = "gastos"
          break
        case "ComplementoPagoEmitido":
          filenameSuffix = "complementos-pago-emitidos"
          break
        case "ComplementoPagoRecibido":
          filenameSuffix = "complementos-pago-recibidos"
          break
        default:
          filenameSuffix = "documentos"
      }

      // Exportar solo ese tipo
      await exportSingleFile(filteredData, filenameSuffix, columnsToUse)
    } else {
      // Si se seleccionó "todos", exportar un archivo separado para cada tipo
      const ingresos = data.filter((item) => item.TIPO_DOCUMENTO === "Ingreso")
      const gastos = data.filter((item) => item.TIPO_DOCUMENTO === "Gasto")
      const complementosPagoEmitidos = data.filter((item) => item.TIPO_DOCUMENTO === "ComplementoPagoEmitido")
      const complementosPagoRecibidos = data.filter((item) => item.TIPO_DOCUMENTO === "ComplementoPagoRecibido")

      // Exportar cada tipo en un archivo separado
      const exportPromises = []

      if (ingresos.length > 0) {
        exportPromises.push(exportSingleFile(ingresos, "ingresos", columnsToUse))
      }

      if (gastos.length > 0) {
        exportPromises.push(exportSingleFile(gastos, "gastos", columnsToUse))
      }

      if (complementosPagoEmitidos.length > 0) {
        exportPromises.push(exportSingleFile(complementosPagoEmitidos, "complementos-pago-emitidos", columnsToUse))
      }

      if (complementosPagoRecibidos.length > 0) {
        exportPromises.push(exportSingleFile(complementosPagoRecibidos, "complementos-pago-recibidos", columnsToUse))
      }

      // Esperar a que todas las exportaciones terminen
      await Promise.all(exportPromises)
    }
  } catch (error) {
    console.error("Error:", error)
    throw error
  }
}

// Función auxiliar para exportar un solo archivo
async function exportSingleFile(data: any[], filenameSuffix: string, selectedColumns?: string[]): Promise<void> {
  try {
    // Crear una copia de los datos para no modificar los originales
    let dataToExport = [...data]

    // Si hay columnas seleccionadas, filtrar los datos
    if (selectedColumns && selectedColumns.length > 0) {
      dataToExport = data.map((item) => {
        const filteredItem: Record<string, any> = {}
        selectedColumns.forEach((column) => {
          // Asegurarse de que la columna existe en el objeto
          if (Object.prototype.hasOwnProperty.call(item, column)) {
            filteredItem[column] = item[column]
          }
        })
        return filteredItem
      })
    }

    const response = await fetch("/api/export-excel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: dataToExport,
        selectedColumns,
        preserveFormat: true, // Indicar al backend que mantenga el formato de celda
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || "Error al exportar a Excel")
    }

    // Descargar el archivo Excel generado con el nombre apropiado
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `cfdi-${filenameSuffix}-${new Date().toISOString().split("T")[0]}.xlsx`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    a.remove()
  } catch (error) {
    console.error("Error en exportSingleFile:", error)
    throw error
  }
}
