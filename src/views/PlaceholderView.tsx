import React from "react";

export function PlaceholderView({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
      <div className="h-16 w-16 bg-gray-100 text-gray-400 rounded-2xl flex items-center justify-center transform rotate-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-8 w-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-gray-900">
        Módulo en Construcción
      </h2>
      <p className="text-gray-500 max-w-sm">
        La vista de <span className="font-semibold text-gray-700">{title}</span>{" "}
        está siendo migrada a la nueva interfaz y estará disponible pronto.
      </p>
    </div>
  );
}
