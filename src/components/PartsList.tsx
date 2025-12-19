"use client"

import { useState } from "react"
import { PartDetailModal } from "./PartDetailModal"

interface Part {
  id: string
  name: string
  description: string | null
  capacity: number | null
  image: string | null
  parentId: string | null
}

interface PartsListProps {
  parts: Part[]
  sortedParts: Part[]
}

export function PartsList({ parts, sortedParts }: PartsListProps) {
  const [selectedPart, setSelectedPart] = useState<Part | null>(null)

  return (
    <>
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4">
          Kan bookes separat
        </h3>
        <div className="space-y-2">
          {sortedParts.map((part) => {
            const isChild = part.parentId !== null
            const parentPart = parts.find(p => p.id === part.parentId)
            return (
              <div 
                key={part.id} 
                onClick={() => setSelectedPart(part)}
                className={`p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer ${isChild ? 'ml-6 border-l-2 border-gray-300' : ''}`}
              >
                {isChild && parentPart && (
                  <p className="text-xs text-gray-400 mb-1">
                    Underdel av: {parentPart.name}
                  </p>
                )}
                <p className="font-medium text-gray-900">{part.name}</p>
                {part.description && (
                  <p className="text-sm text-gray-500 line-clamp-2">{part.description}</p>
                )}
                {part.capacity && (
                  <p className="text-xs text-gray-400 mt-1">
                    Kapasitet: {part.capacity} personer
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <PartDetailModal 
        part={selectedPart}
        onClose={() => setSelectedPart(null)}
      />
    </>
  )
}

