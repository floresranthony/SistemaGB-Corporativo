/**
 * Utilidades geográficas para cálculo de distancias (Haversine),
 * geocodificación gratuita con OpenStreetMap (Nominatim),
 * diccionario de centroides distritales de Lima/Perú y parser de enlaces de Google Maps.
 */

export interface Coordenadas {
  lat: number;
  lng: number;
}

export interface GeocodingResult {
  lat: number;
  lng: number;
  displayName: string;
  distrito?: string;
  provincia?: string;
  departamento?: string;
}

/**
 * Diccionario de centroides de distritos de Lima Metropolitana, Callao
 * y principales ciudades del Perú para respuesta instantánea (0 ms).
 */
export const DICCIONARIO_DISTRITOS_PERU: Record<string, Coordenadas> = {
  // LIMA METROPOLITANA
  "lima": { lat: -12.046374, lng: -77.042793 },
  "cercado de lima": { lat: -12.046374, lng: -77.042793 },
  "ancon": { lat: -11.773245, lng: -77.176043 },
  "ancón": { lat: -11.773245, lng: -77.176043 },
  "ate": { lat: -12.027622, lng: -76.918933 },
  "ate vitarte": { lat: -12.027622, lng: -76.918933 },
  "barranco": { lat: -12.148889, lng: -77.020556 },
  "breña": { lat: -12.057778, lng: -77.054444 },
  "carabayllo": { lat: -11.879722, lng: -77.034722 },
  "chaclacayo": { lat: -11.973333, lng: -76.768611 },
  "chorrillos": { lat: -12.175556, lng: -77.014722 },
  "cieneguilla": { lat: -12.091389, lng: -76.768889 },
  "comas": { lat: -11.933333, lng: -77.05 },
  "el agustino": { lat: -12.045, lng: -77.001944 },
  "independencia": { lat: -11.993611, lng: -77.053889 },
  "jesus maria": { lat: -12.074722, lng: -77.048889 },
  "jesús maría": { lat: -12.074722, lng: -77.048889 },
  "la molina": { lat: -12.083333, lng: -76.916667 },
  "la victoria": { lat: -12.065278, lng: -77.013611 },
  "lince": { lat: -12.083611, lng: -77.034722 },
  "los olivos": { lat: -11.961389, lng: -77.070556 },
  "lurigancho": { lat: -11.938889, lng: -76.705833 },
  "chosica": { lat: -11.938889, lng: -76.705833 },
  "lurin": { lat: -12.274722, lng: -76.871667 },
  "lurín": { lat: -12.274722, lng: -76.871667 },
  "magdalena del mar": { lat: -12.091389, lng: -77.070833 },
  "magdalena": { lat: -12.091389, lng: -77.070833 },
  "miraflores": { lat: -12.121667, lng: -77.029722 },
  "pachacamac": { lat: -12.229444, lng: -76.861944 },
  "pachacámac": { lat: -12.229444, lng: -76.861944 },
  "pucusana": { lat: -12.477778, lng: -76.797222 },
  "pueblo libre": { lat: -12.077222, lng: -77.063889 },
  "puente piedra": { lat: -11.866667, lng: -77.066667 },
  "punta hermosa": { lat: -12.333333, lng: -76.816667 },
  "punta negra": { lat: -12.366667, lng: -76.783333 },
  "rimac": { lat: -12.031389, lng: -77.029722 },
  "rímac": { lat: -12.031389, lng: -77.029722 },
  "san bartolo": { lat: -12.383333, lng: -76.766667 },
  "san borja": { lat: -12.108333, lng: -77.001667 },
  "san isidro": { lat: -12.097778, lng: -77.034444 },
  "san juan de lurigancho": { lat: -11.979722, lng: -77.006944 },
  "sjl": { lat: -11.979722, lng: -77.006944 },
  "san juan de miraflores": { lat: -12.162778, lng: -76.963889 },
  "sjm": { lat: -12.162778, lng: -76.963889 },
  "san luis": { lat: -12.076389, lng: -76.998333 },
  "san martin de porres": { lat: -12.016667, lng: -77.083333 },
  "san martín de porres": { lat: -12.016667, lng: -77.083333 },
  "smp": { lat: -12.016667, lng: -77.083333 },
  "san miguel": { lat: -12.0775, lng: -77.088611 },
  "santa anita": { lat: -12.045833, lng: -76.969444 },
  "santa maria del mar": { lat: -12.4, lng: -76.766667 },
  "santa rosa": { lat: -11.795, lng: -77.165 },
  "santiago de surco": { lat: -12.138333, lng: -76.991111 },
  "surco": { lat: -12.138333, lng: -76.991111 },
  "surquillo": { lat: -12.1125, lng: -77.018333 },
  "villa el salvador": { lat: -12.210556, lng: -76.938889 },
  "ves": { lat: -12.210556, lng: -76.938889 },
  "villa maria del triunfo": { lat: -12.161111, lng: -76.936111 },
  "vmt": { lat: -12.161111, lng: -76.936111 },

  // CALLAO
  "callao": { lat: -12.0565, lng: -77.1181 },
  "bellavista": { lat: -12.0608, lng: -77.1275 },
  "carmen de la legua": { lat: -12.0436, lng: -77.0906 },
  "la perla": { lat: -12.0683, lng: -77.1147 },
  "la punta": { lat: -12.0733, lng: -77.1603 },
  "ventanilla": { lat: -11.8767, lng: -77.1264 },
  "mi peru": { lat: -11.8592, lng: -77.1228 },
  "mi perú": { lat: -11.8592, lng: -77.1228 },

  // PROVINCIAS PRINCIPALES
  "arequipa": { lat: -16.409047, lng: -71.537451 },
  "trujillo": { lat: -8.11599, lng: -79.02998 },
  "chiclayo": { lat: -6.77137, lng: -79.84088 },
  "piura": { lat: -5.19449, lng: -80.63282 },
  "cusco": { lat: -13.53195, lng: -71.96746 },
  "huancayo": { lat: -12.06513, lng: -75.20486 },
  "ica": { lat: -14.06777, lng: -75.72861 },
  "tacna": { lat: -18.01457, lng: -70.25206 },
  "pucallpa": { lat: -8.37915, lng: -74.55387 },
  "iquitos": { lat: -3.74912, lng: -73.25383 },
  "chimbote": { lat: -9.07639, lng: -78.59278 },
  "huacho": { lat: -11.10667, lng: -77.605 },
  "chincha": { lat: -13.41667, lng: -76.13333 },
  "pisco": { lat: -13.71028, lng: -76.20528 },
  "paracas": { lat: -13.84028, lng: -76.25556 },
  "punta pejerrey": { lat: -13.79972, lng: -76.29778 },
  "nazca": { lat: -14.83083, lng: -74.93889 },
  "nasca": { lat: -14.83083, lng: -74.93889 },
  "marcona": { lat: -15.34583, lng: -75.16111 },
  "canete": { lat: -13.07694, lng: -76.38694 },
  "cañete": { lat: -13.07694, lng: -76.38694 },
  "huanuco": { lat: -9.93062, lng: -76.24223 },
  "huánuco": { lat: -9.93062, lng: -76.24223 },
  "ilo": { lat: -17.63944, lng: -71.3375 },
  "matarani": { lat: -16.99722, lng: -72.10278 },
  "mollendo": { lat: -17.02306, lng: -72.01472 },
  "talara": { lat: -4.57722, lng: -81.27194 },
  "paita": { lat: -5.08917, lng: -81.11444 },
  "sechura": { lat: -5.55694, lng: -80.82222 },
  "cajamarca": { lat: -7.16378, lng: -78.50027 },
  "tarapoto": { lat: -6.48694, lng: -76.36528 },
  "juliaca": { lat: -15.49889, lng: -70.13333 },
  "puno": { lat: -15.84222, lng: -70.01944 },
  "huaraz": { lat: -9.52778, lng: -77.52778 },
  "moquegua": { lat: -17.19833, lng: -70.93556 },
  "tumbes": { lat: -3.56694, lng: -80.45139 },
  "challhuahuacho": { lat: -14.11667, lng: -72.25 },
};

/**
 * Lista canónica y depurada de distritos de Lima, Callao y provincias principales
 * (sin duplicados, con tildes correctas y ordenados alfabéticamente).
 */
export const LISTA_DISTRITOS_CANONICOS: string[] = [
  // Lima Metropolitana
  "Ancón",
  "Ate Vitarte",
  "Barranco",
  "Breña",
  "Carabayllo",
  "Chaclacayo",
  "Chorrillos",
  "Cieneguilla",
  "Comas",
  "El Agustino",
  "Independencia",
  "Jesús María",
  "La Molina",
  "La Victoria",
  "Lima (Cercado)",
  "Lince",
  "Los Olivos",
  "Lurigancho (Chosica)",
  "Lurín",
  "Magdalena del Mar",
  "Miraflores",
  "Pachacámac",
  "Pucusana",
  "Pueblo Libre",
  "Puente Piedra",
  "Punta Hermosa",
  "Punta Negra",
  "Rímac",
  "San Bartolo",
  "San Borja",
  "San Isidro",
  "San Juan de Lurigancho",
  "San Juan de Miraflores",
  "San Luis",
  "San Martín de Porres",
  "San Miguel",
  "Santa Anita",
  "Santa María del Mar",
  "Santa Rosa",
  "Santiago de Surco",
  "Surquillo",
  "Villa El Salvador",
  "Villa María del Triunfo",

  // Callao
  "Bellavista (Callao)",
  "Callao",
  "Carmen de la Legua",
  "La Perla (Callao)",
  "La Punta (Callao)",
  "Mi Perú",
  "Ventanilla",

  // Provincias y Ciudades
  "Apurímac",
  "Arequipa",
  "Cajamarca",
  "Cañete",
  "Challhuahuacho",
  "Chiclayo",
  "Chimbote",
  "Chincha",
  "Cusco",
  "Huacho",
  "Huancayo",
  "Huánuco",
  "Huaraz",
  "Ica",
  "Ilo",
  "Iquitos",
  "Juliaca",
  "Marcona",
  "Matarani",
  "Mollendo",
  "Moquegua",
  "Nazca",
  "Paita",
  "Paracas",
  "Pisco",
  "Piura",
  "Pucallpa",
  "Punta Pejerrey",
  "Puno",
  "Sechura",
  "Tacna",
  "Talara",
  "Tarapoto",
  "Trujillo",
  "Tumbes"
].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

/**
 * Normaliza una cadena quitando tildes y caracteres especiales para comparaciones.
 */
export function normalizarTexto(str: string): string {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Busca las coordenadas de un distrito en el diccionario local.
 */
export function obtenerCentroideDistrito(distrito: string): Coordenadas | null {
  if (!distrito) return null;
  const normalizado = normalizarTexto(distrito);
  
  // Coincidencia exacta
  if (DICCIONARIO_DISTRITOS_PERU[normalizado]) {
    return DICCIONARIO_DISTRITOS_PERU[normalizado];
  }
  
  // Coincidencia parcial (ej. "Santiago de Surco" vs "Surco")
  for (const [key, coords] of Object.entries(DICCIONARIO_DISTRITOS_PERU)) {
    if (normalizado.includes(key) || key.includes(normalizado)) {
      return coords;
    }
  }
  
  return null;
}

/**
 * Calcula la distancia en kilómetros entre dos puntos geográficos
 * usando la fórmula matemática del Semiverseno (Haversine).
 */
export function calcularDistanciaKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  
  const R = 6371; // Radio de la Tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10; // Redondear a 1 decimal
}

/**
 * Formatea una distancia en km para visualización amigable
 * (ej. 800 m si es < 1km, o 3.4 km).
 */
export function formatearDistancia(distanciaKm: number): string {
  if (distanciaKm < 1) {
    const metros = Math.round(distanciaKm * 1000);
    return `${metros} m`;
  }
  return `${distanciaKm.toFixed(1)} km`;
}

/**
 * Extrae latitud y longitud si el usuario ingresa o pega un enlace de Google Maps
 * o un string de coordenadas numéricas (ej. "-12.0977, -77.0344").
 */
export function parsearCoordenadasGoogleMaps(input: string): Coordenadas | null {
  if (!input) return null;
  const trimmed = input.trim();

  // 1. Formato numérico directo: "-12.0977, -77.0344" o "-12.0977 -77.0344"
  const directRegex = /^(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)$/;
  const directMatch = trimmed.match(directRegex);
  if (directMatch) {
    const lat = parseFloat(directMatch[1]);
    const lng = parseFloat(directMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  // 2. URL de Google Maps con @lat,lng (ej. https://www.google.com/maps/@-12.0977,-77.0344,15z)
  const atRegex = /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/;
  const atMatch = trimmed.match(atRegex);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  }

  // 3. URL con parámetro ?q=lat,lng o &q=lat,lng o destination=lat,lng o query=lat,lng
  const qRegex = /[?&](?:q|destination|query|ll)=(-?\d{1,2}\.\d+)[,%20]+(-?\d{1,3}\.\d+)/i;
  const qMatch = trimmed.match(qRegex);
  if (qMatch) {
    return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  }

  // 4. URL con !3dlat!4dlng (típico de Google Maps embed/place)
  const embedRegex = /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/;
  const embedMatch = trimmed.match(embedRegex);
  if (embedMatch) {
    return { lat: parseFloat(embedMatch[1]), lng: parseFloat(embedMatch[2]) };
  }

  return null;
}

/**
 * Geocodifica una dirección o distrito utilizando el servicio gratuito Nominatim (OpenStreetMap).
 * Incluye almacenamiento en caché de sesión para optimizar las consultas.
 */
const geocodeCache = new Map<string, GeocodingResult[]>();

export async function geocodificarDireccion(
  query: string,
  distritoContexto?: string
): Promise<GeocodingResult[]> {
  if (!query || query.trim().length < 3) return [];

  // Enriquecer la búsqueda con el país y distrito si aplica
  let searchTerms = query.trim();
  if (distritoContexto && !searchTerms.toLowerCase().includes(distritoContexto.toLowerCase())) {
    searchTerms = `${searchTerms}, ${distritoContexto}`;
  }
  if (!searchTerms.toLowerCase().includes("peru") && !searchTerms.toLowerCase().includes("perú")) {
    searchTerms = `${searchTerms}, Perú`;
  }

  const cacheKey = searchTerms.toLowerCase();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      searchTerms
    )}&countrycodes=pe&limit=5&addressdetails=1`;

    const response = await fetch(url, {
      headers: {
        "Accept-Language": "es-PE,es;q=0.9"
      }
    });

    if (!response.ok) {
      throw new Error(`Error en geocodificación: ${response.status}`);
    }

    const data = await response.json();
    const results: GeocodingResult[] = data.map((item: any) => ({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      displayName: item.display_name,
      distrito: item.address?.city_district || item.address?.suburb || item.address?.town || item.address?.city,
      provincia: item.address?.county || item.address?.state_district,
      departamento: item.address?.state
    }));

    geocodeCache.set(cacheKey, results);
    return results;
  } catch (error) {
    console.warn("Fallo geocodificación Nominatim, recurriendo a diccionario local:", error);
    
    // Fallback: Si la consulta remota falla, buscar en diccionario local
    const fallbackCoords = obtenerCentroideDistrito(distritoContexto || query);
    if (fallbackCoords) {
      return [
        {
          lat: fallbackCoords.lat,
          lng: fallbackCoords.lng,
          displayName: `${distritoContexto || query}, Perú (Ubicación aproximada)`,
          distrito: distritoContexto || query
        }
      ];
    }
    return [];
  }
}

/**
 * Resuelve las mejores coordenadas para una sede dada:
 * 1. Prioridad 1: Sede con latitud y longitud explícitas guardadas.
 * 2. Prioridad 2: Centroide del distrito de la sede.
 * 3. Fallback: Centro de Lima.
 */
export function obtenerCoordenadasSede(sede: any): Coordenadas {
  if (
    sede?.latitud != null &&
    sede?.longitud != null &&
    !isNaN(Number(sede.latitud)) &&
    !isNaN(Number(sede.longitud)) &&
    Number(sede.latitud) !== 0 &&
    Number(sede.longitud) !== 0
  ) {
    return {
      lat: Number(sede.latitud),
      lng: Number(sede.longitud)
    };
  }

  // Fallback a distrito
  const distritoCoords = obtenerCentroideDistrito(sede?.distrito);
  if (distritoCoords) {
    return distritoCoords;
  }

  // Fallback por defecto (Lima Centro)
  return { lat: -12.046374, lng: -77.042793 };
}

/**
 * Genera el enlace directo a Google Maps para visualizar la ruta de tránsito/caminata.
 */
export function generarEnlaceRutaGoogleMaps(
  origenLat: number,
  origenLng: number,
  destinoLat: number,
  destinoLng: number,
  destinoNombre?: string
): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${origenLat},${origenLng}&destination=${destinoLat},${destinoLng}&destination_place_id=${encodeURIComponent(
    destinoNombre || "Sede"
  )}&travelmode=transit`;
}
