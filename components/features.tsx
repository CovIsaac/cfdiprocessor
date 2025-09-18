import { CheckCircle, FileSearch, FileSpreadsheet, Database, Clock, BarChart } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function Features() {
  const features = [
    {
      icon: <FileSearch className="h-10 w-10 text-blue-500" />,
      title: "Procesamiento Inteligente",
      description: "Procesa múltiples archivos CFDI 4.0 con búsqueda recursiva en carpetas",
    },
    {
      icon: <Database className="h-10 w-10 text-green-500" />,
      title: "Complementos de Pago",
      description: "Extracción completa de complementos de pago 2.0 con todos los detalles",
    },
    {
      icon: <FileSpreadsheet className="h-10 w-10 text-purple-500" />,
      title: "Exportación Avanzada",
      description: "Exportación a Excel con formato profesional y separación por tipo de documento",
    },
    {
      icon: <Clock className="h-10 w-10 text-amber-500" />,
      title: "Procesamiento Rápido",
      description: "Procesamiento en la nube sin instalaciones y accesible desde cualquier dispositivo",
    },
    {
      icon: <BarChart className="h-10 w-10 text-red-500" />,
      title: "Análisis Detallado",
      description: "Visualización de datos con filtros avanzados y totales automáticos",
    },
    {
      icon: <CheckCircle className="h-10 w-10 text-indigo-500" />,
      title: "Validación Automática",
      description: "Verificación de la estructura y contenido de los archivos CFDI",
    },
  ]

  return (
    <div className="py-16 max-w-6xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold mb-4 text-slate-900">Características</h2>
        <p className="text-slate-600 max-w-2xl mx-auto">
          Nuestro analizador XML ofrece herramientas potentes para procesar y analizar tus archivos CFDI 4.0
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature, index) => (
          <Card key={index} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="mb-4">{feature.icon}</div>
              <CardTitle className="text-xl">{feature.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm text-slate-600">{feature.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
