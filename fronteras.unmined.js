function iniciarFronterasUnmined(instanciaUnmined) {
  // =========================================================================
  // 🎨 CONFIGURACIÓN DE COLORES DE JUGADORES / IMPERIOS (ALTO CONTRASTE)
  // =========================================================================
  
  // 1. OPCIONAL: Asigna aquí un color fijo a jugadores específicos.
  // Escribe el nombre exacto del jugador entre comillas y su color en formato HEX (#RRGGBB).
  const COLORES_PERSONALIZADOS = {
    "Dynatley": "#a11600",
    "Moises00813672": "#353839",
    "Dradvirk5214": "#d60983", 
    "Landedrobgonz": "#00ffff"     // Rojo carmesí
    // "NombreDeTuAmigo": "#00E5FF", // Cian brillante
    // "OtroJugador": "#FFEA00",     // Amarillo oro
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

  const olMap = instanciaUnmined.olMap || instanciaUnmined.map || window.olMap;
  if (!olMap || typeof territoriosData === "undefined") {
    console.warn("Esperando a que uNmINeD cargue completamente...");
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
    let c = hex.replace("#", "").trim();
    if (c.length === 3) {
      c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    }
    const num = parseInt(c, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Registro automático para asignar un color distinto a cada jugador
  const mapaColoresJugadores = {};
  let indicePaleta = 0;

  function colorPorImperio(nombre, alpha) {
    const str = String(nombre || "Imperio").trim();

    // Si ya tiene un color personalizado arriba, usamos ese
    if (COLORES_PERSONALIZADOS[str]) {
      mapaColoresJugadores[str] = COLORES_PERSONALIZADOS[str];
      return hexToRgba(COLORES_PERSONALIZADOS[str], alpha);
    }

    // Si aún no se le ha asignado uno de la paleta, le damos el siguiente disponible
    if (!mapaColoresJugadores[str]) {
      // Evitamos repetir colores que ya estén en COLORES_PERSONALIZADOS
      const usadosManual = Object.values(COLORES_PERSONALIZADOS).map(c => c.toUpperCase());
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
    if (!territoriosData.alianzas) return "";
    const lista = territoriosData.alianzas
      .filter(a => a.p1Id === ownerId || a.p2Id === ownerId)
      .map(a => (a.p1Id === ownerId ? a.p2Name : a.p1Name));
    return lista.length > 0 ? `\n🤝 Aliados: ${lista.join(", ")}` : "";
  }

  const features = [];

  // Pre-registramos primero a los dueños de las capitales para que tengan prioridad en la paleta
  (territoriosData.capitales || []).forEach(cap => {
    if (cap.ownerName) colorPorImperio(cap.ownerName, 1);
  });

  // 1. CAPITALES (Siempre muestran su cuadrado y su nombre en cualquier zoom)
  (territoriosData.capitales || []).forEach(cap => {
    if (cap.dimension && cap.dimension !== "minecraft:overworld") return;
    const r = Number(cap.radio) || 128;
    const feat = new ol.Feature({
      geometry: new ol.geom.Polygon(crearCuadradoUnmined(Number(cap.x), Number(cap.z), r))
    });
    feat.setStyle(new ol.style.Style({
      stroke: new ol.style.Stroke({ color: colorPorImperio(cap.ownerName, 1), width: 3.5 }),
      fill: new ol.style.Fill({ color: colorPorImperio(cap.ownerName, 0.30) }),
      text: new ol.style.Text({
        text: `👑 ${cap.nombre}\nImperio de ${cap.ownerName}${obtenerNombresAliados(cap.ownerId)}`,
        font: "bold 13px sans-serif",
        fill: new ol.style.Fill({ color: "#ffd700" }),
        stroke: new ol.style.Stroke({ color: "#000000", width: 3.5 }),
        overflow: true
      }),
      zIndex: 20
    }));
    features.push(feat);
  });

  // 2. AVANZADAS (Siempre muestran su cuadrado, pero ocultan el nombre al alejar el zoom)
  (territoriosData.avanzadas || []).forEach(av => {
    if (av.dimension && av.dimension !== "minecraft:overworld") return;
    const r = Number(av.radio) || 50;
    const enGuerra = av.estado && av.estado !== "paz";
    const feat = new ol.Feature({
      geometry: new ol.geom.Polygon(crearCuadradoUnmined(Number(av.x), Number(av.z), r))
    });
    const icono = enGuerra ? "⚔️ [EN CONFLICTO] " : (av.escudo ? "🛡️ " : "🚩 ");

    const strokeAv = new ol.style.Stroke({
      color: enGuerra ? "#ff0000" : colorPorImperio(av.ownerName, 0.95),
      width: enGuerra ? 3 : 2.2,
      lineDash: enGuerra ? [8, 6] : undefined
    });

    const fillAv = new ol.style.Fill({
      color: enGuerra ? "rgba(255, 0, 0, 0.40)" : colorPorImperio(av.ownerName, 0.22)
    });

    // Estilo cuando estás CERCA (con texto)
    const estiloConTexto = new ol.style.Style({
      stroke: strokeAv,
      fill: fillAv,
      text: new ol.style.Text({
        text: `${icono}${av.nombre} (Nv.${av.nivel || 1})\nDueño: ${av.ownerName}`,
        font: "bold 12px sans-serif",
        fill: new ol.style.Fill({ color: "#ffffff" }),
        stroke: new ol.style.Stroke({ color: "#000000", width: 3 }),
        overflow: true
      }),
      zIndex: 10
    });

    // Estilo cuando estás LEJOS (solo el cuadrado, sin texto)
    const estiloSinTexto = new ol.style.Style({
      stroke: strokeAv,
      fill: fillAv,
      zIndex: 10
    });

    feat.setStyle(function(feature, resolution) {
      const extent = feature.getGeometry().getExtent();
      const anchoCuadradoEnPantalla = Math.abs(extent[2] - extent[0]) / resolution;
      return anchoCuadradoEnPantalla >= 60 ? estiloConTexto : estiloSinTexto;
    });

    features.push(feat);
  });

  const vectorSource = new ol.source.Vector({ features: features });
  const capaFronteras = new ol.layer.Vector({
    source: vectorSource,
    zIndex: 9999
  });

  olMap.addLayer(capaFronteras);
  console.log(`¡Capa de fronteras agregada con éxito! Se cargaron ${features.length} territorios.`);

  // Generamos la lista visual de jugadores y sus colores para el panel
  const itemsLeyenda = Object.keys(mapaColoresJugadores).map(jugador => {
    const colorHex = mapaColoresJugadores[jugador];
    return `
      <div style="display:flex; align-items:center; gap:6px; font-size:12px;">
        <span style="display:inline-block; width:12px; height:12px; border-radius:3px; background:${colorHex}; border:1px solid #fff;"></span>
        <span>${jugador}</span>
      </div>
    `;
  }).join("");

  // PANEL FLOTANTE CON CASILLA, LEYENDA DE COLORES Y BOTÓN PARA ENFOCAR
  const panel = document.createElement("div");
  panel.style.cssText = "position:absolute; top:12px; right:12px; z-index:10000; background:rgba(20,20,20,0.92); color:#fff; padding:10px 14px; border-radius:8px; font-family:sans-serif; font-size:13px; border:1px solid #555; box-shadow:0 3px 10px rgba(0,0,0,0.5); display:flex; flex-direction:column; gap:8px; max-height:80vh; overflow-y:auto;";
  panel.innerHTML = `
    <label style="cursor:pointer; margin:0; display:flex; align-items:center; gap:8px;">
      <input type="checkbox" id="chkFronteras" checked style="cursor:pointer;">
      <span><b>👑 Capitales y Avanzadas (${features.length})</b></span>
    </label>
    <div style="border-top:1px solid #444; padding-top:6px; display:flex; flex-direction:column; gap:4px;">
      <div style="font-size:11px; color:#aaa; margin-bottom:2px;"><b>Imperios / Jugadores:</b></div>
      ${itemsLeyenda}
    </div>
    <button id="btnIrTerritorios" style="cursor:pointer; background:#2b6cb0; color:#fff; border:none; padding:6px 10px; border-radius:5px; font-weight:bold; font-size:12px; margin-top:2px;">
      🎯 Enfocar todos los territorios
    </button>
  `;
  document.body.appendChild(panel);

  document.getElementById("chkFronteras").addEventListener("change", (e) => {
    capaFronteras.setVisible(e.target.checked);
  });

  document.getElementById("btnIrTerritorios").addEventListener("click", () => {
    if (features.length > 0) {
      const extent = vectorSource.getExtent();
      olMap.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 600 });
    }
  });

  return true;
}

setTimeout(() => {
  if (typeof unmined !== "undefined") iniciarFronterasUnmined(unmined);
}, 500);