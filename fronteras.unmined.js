function iniciarFronterasUnmined(instanciaUnmined) {
  // =========================================================================
  // 🎨 CONFIGURACIÓN DE COLORES DE JUGADORES / IMPERIOS (ALTO CONTRASTE)
  // =========================================================================
  
  // 1. OPCIONAL: Asigna aquí un color fijo a jugadores específicos.
  // Escribe el nombre del jugador entre comillas y su color en formato HEX (#RRGGBB).
  const COLORES_PERSONALIZADOS = {
    "Dynatley": "#a11600",
    "Moises00813672": "#353839",
    "Dradvirk5214": "#d60983", 
    "Landedrobgonz": "#00ffff"
    // "NombreDeTuAmigo": "#00E5FF",
    // "OtroJugador": "#FFEA00",
  };

  // 2. PALETA AUTOMÁTICA DE ALTO CONTRASTE:
  // Si un jugador no está en la lista de arriba, tomará automáticamente uno de estos
  // colores en orden (sin repetir), diseñados para distinguirse perfectamente en el mapa.
  const PALETA_ALTO_CONTRASTE = [
    "#00E5FF", // 1. Cian eléctrico
    "#FF9100", // 2. Naranja intenso
    "#76FF03", // 3. Verde lima brillante
    "#D500F9", // 4. Morado neón
    "#FFEA00", // 5. Amarillo vibrante
    "#2979FF", // 6. Azul real
    "#FF4081", // 7. Rosa fuerte / Magenta
    "#00E676", // 8. Verde esmeralda
    "#FF3D00", // 9. Rojo anaranjado
    "#651FFF", // 10. Índigo profundo
    "#1DE9B6", // 11. Turquesa
    "#C6FF00", // 12. Amarillo verdoso
    "#F50057", // 13. Frambuesa
    "#00B0FF", // 14. Azul cielo intenso
    "#FFC400", // 15. Ámbar dorado
    "#E040FB"  // 16. Violeta claro
  ];
  // =========================================================================

  const olMap = instanciaUnmined && (instanciaUnmined.olMap || instanciaUnmined.map || window.olMap);
  if (!olMap || typeof territoriosData === "undefined") {
    return false;
  }

  if (window._fronterasCargadas) return true;
  window._fronterasCargadas = true;

  // Detectamos cómo transforma uNmINeD las coordenadas (X, Z) de Minecraft al mapa
  const dataProj = instanciaUnmined.dataProjection;
  const viewProj = olMap.getView().getProjection();

  function mcToMapCoord(mcX, mcZ) {
    if (dataProj && typeof ol.proj !== "undefined" && ol.proj.transform) {
      return ol.proj.transform([mcX, mcZ], dataProj, viewProj);
    }
    return [mcX, -mcZ];
  }

  // Convierte un color HEX (#RRGGBB) a rgba(r, g, b, alpha)
  function hexToRgba(hex, alpha) {
    let c = String(hex || "#ffffff").replace("#", "").trim();
    if (c.length === 3) {
      c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    }
    const num = parseInt(c, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Mapa normalizado para buscar colores personalizados sin importar mayúsculas/minúsculas
  const personalizadosNormalizados = {};
  Object.keys(COLORES_PERSONALIZADOS).forEach(k => {
    personalizadosNormalizados[k.trim().toLowerCase()] = COLORES_PERSONALIZADOS[k].trim();
  });

  const mapaColoresJugadores = {};
  let indicePaleta = 0;

  function colorPorImperio(nombre, alpha) {
    const str = String(nombre || "Imperio").trim();
    const keyLower = str.toLowerCase();

    // Si tiene un color personalizado, usamos ese
    if (personalizadosNormalizados[keyLower]) {
      mapaColoresJugadores[str] = personalizadosNormalizados[keyLower];
      return hexToRgba(personalizadosNormalizados[keyLower], alpha);
    }

    // Si aún no tiene color asignado, le damos el siguiente disponible de la paleta
    if (!mapaColoresJugadores[str]) {
      const usadosManual = Object.values(COLORES_PERSONALIZADOS).map(c => c.trim().toUpperCase());
      let colorElegido = PALETA_ALTO_CONTRASTE[indicePaleta % PALETA_ALTO_CONTRASTE.length];
      let intentos = 0;
      while (usadosManual.includes(colorElegido.toUpperCase()) && intentos < PALETA_ALTO_CONTRASTE.length) {
        indicePaleta++;
        intentos++;
        colorElegido = PALETA_ALTO_CONTRASTE[indicePaleta % PALETA_ALTO_CONTRASTE.length];
      }
      mapaColoresJugadores[str] = colorElegido;
      indicePaleta++;
    }

    return hexToRgba(mapaColoresJugadores[str], alpha);
  }

  function crearCuadradoUnmined(cx, cz, radio) {
    const p1 = mcToMapCoord(cx - radio, cz - radio);
    const p2 = mcToMapCoord(cx + radio, cz - radio);
    const p3 = mcToMapCoord(cx + radio, cz + radio);
    const p4 = mcToMapCoord(cx - radio, cz + radio);
    return [[p1, p2, p3, p4, p1]];
  }

  function obtenerNombresAliados(ownerId) {
    if (!territoriosData.alianzas || !ownerId) return "";
    const lista = territoriosData.alianzas
      .filter(a => a.p1Id === ownerId || a.p2Id === ownerId)
      .map(a => (a.p1Id === ownerId ? a.p2Name : a.p1Name))
      .filter(Boolean);
    const unicos = [...new Set(lista)];
    return unicos.length > 0 ? `\n🤝 Aliados: ${unicos.join(", ")}` : "";
  }

  const features = [];

  // Pre-registramos primero a los dueños de las capitales para que tengan prioridad en la paleta
  (territoriosData.capitales || []).forEach(cap => {
    if (cap.ownerName) colorPorImperio(cap.ownerName, 1);
  });

  // 1. CAPITALES (De cerca muestran todo; de lejos solo muestran el nombre de la capital)
  (territoriosData.capitales || []).forEach(cap => {
    if (cap.dimension && cap.dimension !== "minecraft:overworld") return;
    const r = Number(cap.radio) || 128;
    const feat = new ol.Feature({
      geometry: new ol.geom.Polygon(crearCuadradoUnmined(Number(cap.x), Number(cap.z), r))
    });

    const strokeCap = new ol.style.Stroke({ color: colorPorImperio(cap.ownerName, 1), width: 3.5 });
    const fillCap = new ol.style.Fill({ color: colorPorImperio(cap.ownerName, 0.30)