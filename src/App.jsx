import { useState, useCallback, useEffect } from "react";
import { Howl } from "howler";
import MapView from "./components/Map/MapView"; // Ajusta la ruta
import ARScene from "./components/AR/ARScene"; // Ajusta la ruta
import pointsData from "./data/pointsData.json"; // Ajusta la ruta
import PWABadge from "./PWABadge.jsx"; // Si lo usas
import "./App.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || "TU_TOKEN_DE_FALLBACK_SI_NO_HAY_ENV";

if (MAPBOX_TOKEN === "TU_TOKEN_DE_FALLBACK_SI_NO_HAY_ENV" || !MAPBOX_TOKEN) {
   console.warn("App.jsx: Mapbox token no configurado. Por favor, establece VITE_MAPBOX_ACCESS_TOKEN en tu archivo .env");
}

function App() {
   const [currentView, setCurrentView] = useState("map");
   const [pointForPopup, setPointForPopup] = useState(null); // Punto para el cual mostrar el popup
   const [activeActionPoint, setActiveActionPoint] = useState(null); // Punto para el cual ejecutar la acción AR/Audio

   const [audioInstance, setAudioInstance] = useState(null);
   const [isPlayingAudioForPointId, setIsPlayingAudioForPointId] = useState(null);

   const stopAndUnloadAudio = useCallback(
      (notifyPlayingState = true) => {
         if (audioInstance) {
            console.log("App.jsx: Deteniendo y descargando audio.");
            audioInstance.stop();
            audioInstance.unload(); // Importante para liberar recursos
            setAudioInstance(null);
            if (notifyPlayingState) {
               setIsPlayingAudioForPointId(null);
            }
         }
      },
      [audioInstance]
   );

   // Limpieza general del audio si el componente App se desmontara
   useEffect(() => {
      return () => {
         if (audioInstance) {
            stopAndUnloadAudio(true);
         }
      };
   }, [audioInstance, stopAndUnloadAudio]);

   const handleMarkerClick = useCallback((point) => {
      console.log("App.jsx: Clic en MARCADOR, estableciendo pointForPopup:", point.id);
      setPointForPopup(point);
      // No se ejecuta ninguna acción aquí, solo se muestra el popup
   }, []);

   const handlePopupAction = useCallback(
      (point) => {
         console.log("App.jsx: Clic en BOTÓN del POPUP para:", point.id);
         setActiveActionPoint(point); // Marcar este punto para la acción
         // setPointForPopup(point); // Asegurar que el popup correcto sigue activo (ya debería estarlo)

         if (point.type === "audio") {
            if (isPlayingAudioForPointId === point.id && audioInstance) {
               console.log("App.jsx: Deteniendo audio (toggle) para:", point.name);
               stopAndUnloadAudio(true);
               // No cambiamos pointForPopup aquí, para que el popup siga abierto y el texto del botón se actualice.
            } else {
               // Si hay otro audio sonando, detenerlo
               if (audioInstance) {
                  stopAndUnloadAudio(false); // Detener sin afectar isPlayingAudioForPointId inmediatamente
               }
               setCurrentView("map"); // Asegurar que estamos en la vista del mapa
               console.log("App.jsx: Intentando reproducir audio para:", point.name, "src:", point.audioSrc);

               const sound = new Howl({
                  src: [point.audioSrc],
                  html5: true, // Recomendado para compatibilidad web/móvil
                  volume: 1.0,
                  onload: () => {
                     console.log(`App.jsx: Audio ${point.audioSrc} CARGADO.`);
                     sound.play();
                     setIsPlayingAudioForPointId(point.id); // Actualizar estado al reproducir
                  },
                  onplayerror: (id, err) => {
                     console.error(`App.jsx: ERROR AL REPRODUCIR audio ID ${id}:`, err);
                     setIsPlayingAudioForPointId(null);
                     setAudioInstance(null);
                     if (pointForPopup?.id === point.id) setPointForPopup(null); // Cerrar popup si falla
                     setActiveActionPoint(null);
                  },
                  onloaderror: (id, err) => {
                     console.error(`App.jsx: ERROR AL CARGAR audio ID ${id}:`, err);
                     setIsPlayingAudioForPointId(null);
                     setAudioInstance(null);
                     if (pointForPopup?.id === point.id) setPointForPopup(null); // Cerrar popup si falla
                     setActiveActionPoint(null);
                  },
                  onend: () => {
                     console.log(`App.jsx: Audio ${point.audioSrc} finalizado.`);
                     setIsPlayingAudioForPointId(null);
                     setAudioInstance(null);
                     if (pointForPopup?.id === point.id) setPointForPopup(null); // Cerrar popup al finalizar
                     setActiveActionPoint(null);
                  },
                  onstop: () => {
                     // Se llama cuando se usa .stop()
                     console.log(`App.jsx: Audio ${point.audioSrc} detenido (onstop).`);
                     // setIsPlayingAudioForPointId(null) ya se maneja en stopAndUnloadAudio
                  },
               });
               setAudioInstance(sound);
            }
         } else if (point.type === "ar") {
            if (audioInstance) {
               stopAndUnloadAudio(true);
            }
            setIsPlayingAudioForPointId(null);
            setCurrentView("ar"); // Cambia a la vista AR
            // El popup se irá porque MapView se desmonta/oculta.
            // No es necesario setPointForPopup(null) aquí si la vista cambia.
         }
      },
      [audioInstance, isPlayingAudioForPointId, stopAndUnloadAudio, pointForPopup]
   );

   const handleCloseAR = useCallback(() => {
      setCurrentView("map");
      setPointForPopup(null); // Cerrar cualquier popup al volver de AR
      setActiveActionPoint(null); // Limpiar el punto de acción AR
   }, []);

   if (!MAPBOX_TOKEN || MAPBOX_TOKEN === "TU_TOKEN_DE_FALLBACK_SI_NO_HAY_ENV") {
      return (
         <div style={{ padding: "20px", textAlign: "center", fontSize: "1.2em" }}>
            Error: El token de acceso de Mapbox no está configurado correctamente.
            <br />
            Por favor, asegúrate de tener la variable de entorno <code>VITE_MAPBOX_ACCESS_TOKEN</code> definida en tu archivo{" "}
            <code>.env</code>.
         </div>
      );
   }

   return (
      <div className="App">
         {currentView === "map" && (
            <MapView
               mapboxToken={MAPBOX_TOKEN}
               points={pointsData}
               onMarkerClick={handleMarkerClick}
               onPopupAction={handlePopupAction}
               currentlyPlayingAudioPointId={isPlayingAudioForPointId}
               selectedPointForPopup={pointForPopup}
               isPlayingAudioForSelectedPoint={pointForPopup?.type === "audio" && isPlayingAudioForPointId === pointForPopup?.id}
            />
         )}
         {currentView === "ar" && activeActionPoint && activeActionPoint.type === "ar" && (
            <ARScene pointData={activeActionPoint.ar} onClose={handleCloseAR} />
         )}
         <PWABadge />
      </div>
   );
}

export default App;
