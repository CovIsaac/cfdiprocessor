import React from "react"
import "./fancy-loader.css"

export function FancyLoader({ label = "Procesando..." }: { label?: string }) {
  return (
    <div className="fancy-loader flex flex-col items-center justify-center py-8">
      <div className="loader-dots">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
      <span className="mt-4 text-blue-600 font-medium animate-pulse">{label}</span>
    </div>
  )
}
