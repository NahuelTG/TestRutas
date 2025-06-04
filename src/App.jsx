// src/App.jsx
import { useState, useCallback, useEffect, useRef } from "react"; // Importar useRef
import { Howl, Howler } from "howler";
import MapView from "./components/Map/MapView";
import ARScene from "./components/AR/ARScene";
import pointsData from "./data/pointsData.json";
import PWABadge from "./PWABadge.jsx";
import "./App.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || "TU_TOKEN_DE_FALLBACK_SI_NO_HAY_ENV";

if (MAPBOX_TOKEN === "TU_TOKEN_DE_FALLBACK_SI_NO_HAY_ENV" || !MAPBOX_TOKEN) {
   console.warn("App.jsx: Mapbox token no configurado...");
}

const LOCAL_STORAGE_ROUTE_STARTED_KEY = "routeHasBeenStarted";

function App() {
   const [currentView, setCurrentView] = useState("map");
   const [pointForPopup, setPointForPopup] = useState(null);
   const [activeActionPoint, setActiveActionPoint] = useState(null);

   const [audioInstance, setAudioInstance] = useState(null);
   const [isPlayingAudioForPointId, setIsPlayingAudioForPointId] = useState(null);

   const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
   const [pendingProximityAudioPoint, setPendingProximityAudioPoint] = useState(null);
   const [hasStartedRoute, setHasStartedRoute] = useState(false);
   const [loadingInitialState, setLoadingInitialState] = useState(true);

   // Ref para evitar múltiples llamadas a playAudio en el ciclo de StrictMode
   const isPlayingRef = useRef(false);

   useEffect(() => {
      console.log("App.jsx (useEffect - Carga Inicial): Leyendo localStorage.");
      // No establecemos hasStartedRoute aquí. El botón siempre aparecerá inicialmente.
      // El texto del botón se basará en localStorage.
      setLoadingInitialState(false);
   }, []);

   const stopAndUnloadAudio = useCallback(
      (notifyPlayingState = true) => {
         if (audioInstance) {
            console.log("App.jsx (stopAndUnloadAudio): Deteniendo y descargando audio.", audioInstance);
            isPlayingRef.current = false; // Marcar que ya no está sonando
            audioInstance.stop();
            audioInstance.unload();
            setAudioInstance(null);
            if (notifyPlayingState) {
               setIsPlayingAudioForPointId(null);
            }
         }
      },
      [audioInstance]
   );

   useEffect(() => {
      return () => {
         console.log("App.jsx (useEffect - Cleanup): Desmontando App, deteniendo audio.");
         if (audioInstance) {
            stopAndUnloadAudio(true);
         }
      };
   }, [audioInstance, stopAndUnloadAudio]);

   const handleMarkerClick = useCallback((point) => {
      console.log("App.jsx (handleMarkerClick): Clic en MARCADOR:", point.id);
      setPointForPopup(point);
   }, []);

   const tryUnlockAudioContext = useCallback(() => {
      console.log("App.jsx (tryUnlockAudioContext): Intentando desbloquear. isAudioUnlocked:", isAudioUnlocked);
      if (isAudioUnlocked) {
         console.log("App.jsx (tryUnlockAudioContext): Audio ya está desbloqueado.");
         return;
      }

      const unlockWithSilentSound = () => {
         console.log("App.jsx (tryUnlockAudioContext): Intentando con sonido silencioso.");
         // Prevenir múltiples sonidos de desbloqueo si ya hay uno en curso (raro, pero por si acaso)
         if (
            Howler._howls.some((h) => h._src === "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA")
         ) {
            console.log("App.jsx (tryUnlockAudioContext): Sonido de desbloqueo ya en progreso o existe.");
            return;
         }
         const unlockSound = new Howl({
            src: ["data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"],
            volume: 0.01,
            html5: true,
            onplay: () => {
               console.log("App.jsx (tryUnlockAudioContext): Sonido de desbloqueo REPRODUCIDO. Estableciendo isAudioUnlocked = true.");
               setIsAudioUnlocked(true);
               unlockSound.unload();
            },
            onplayerror: (id, err) => {
               console.error("App.jsx (tryUnlockAudioContext): ERROR al REPRODUCIR sonido de desbloqueo:", err);
               unlockSound.unload();
            },
            onloaderror: (id, err) => {
               console.error("App.jsx (tryUnlockAudioContext): ERROR al CARGAR sonido de desbloqueo:", err);
               unlockSound.unload();
            },
         });
         unlockSound.play();
      };

      if (Howler.ctx) {
         if (Howler.ctx.state === "suspended") {
            console.log("App.jsx (tryUnlockAudioContext): AudioContext 'suspended'. Intentando resume().");
            Howler.ctx
               .resume()
               .then(() => {
                  console.log("App.jsx (tryUnlockAudioContext): AudioContext RESUMIDO. Estableciendo isAudioUnlocked = true.");
                  setIsAudioUnlocked(true);
               })
               .catch((e) => {
                  console.error("App.jsx (tryUnlockAudioContext): Error al resumir:", e, ". Fallback a sonido silencioso.");
                  unlockWithSilentSound();
               });
         } else if (Howler.ctx.state === "running") {
            console.log("App.jsx (tryUnlockAudioContext): AudioContext 'running'. Estableciendo isAudioUnlocked = true.");
            setIsAudioUnlocked(true);
         } else {
            console.log("App.jsx (tryUnlockAudioContext): Howler.ctx.state es:", Howler.ctx.state, ". Intentando con sonido silencioso.");
            unlockWithSilentSound();
         }
      } else {
         console.log("App.jsx (tryUnlockAudioContext): Howler.ctx no existe. Intentando con sonido silencioso.");
         unlockWithSilentSound();
      }
   }, [isAudioUnlocked]);

   const playAudio = useCallback(
      (point) => {
         console.log(
            `App.jsx (playAudio): Solicitud para punto '${point.name}'. hasStartedRoute: ${hasStartedRoute}, isAudioUnlocked: ${isAudioUnlocked}, isPlayingRef: ${isPlayingRef.current}`
         );

         if (!hasStartedRoute) {
            console.warn(`App.jsx (playAudio): Ruta no iniciada. No se reproduce '${point.name}'.`);
            if (!pendingProximityAudioPoint || pendingProximityAudioPoint.id !== point.id) {
               setPendingProximityAudioPoint(point);
            }
            return;
         }
         if (!isAudioUnlocked) {
            console.warn(`App.jsx (playAudio): Audio bloqueado. No se reproduce '${point.name}'. Guardando como pendiente.`);
            if (!pendingProximityAudioPoint || pendingProximityAudioPoint.id !== point.id) {
               setPendingProximityAudioPoint(point);
            }
            return;
         }

         // Toggle para detener el audio actual
         if (isPlayingAudioForPointId === point.id && audioInstance) {
            console.log("App.jsx (playAudio): Deteniendo audio (toggle) para:", point.name);
            stopAndUnloadAudio(true);
            return;
         }

         // Detener audio anterior si es diferente
         if (audioInstance) {
            console.log("App.jsx (playAudio): Deteniendo audio anterior antes de reproducir:", point.name);
            stopAndUnloadAudio(false); // No actualizar isPlayingAudioForPointId todavía
         }

         // Prevenir que se cree un nuevo Howl si ya estamos en proceso de reproducir este mismo punto (debido a StrictMode)
         if (isPlayingRef.current && isPlayingAudioForPointId === point.id) {
            console.warn(`App.jsx (playAudio): Ya se está intentando reproducir '${point.name}'. Abortando duplicado.`);
            return;
         }

         console.log("App.jsx (playAudio): Creando Howl para:", point.name, "src:", point.audioSrc);
         isPlayingRef.current = true; // Marcar que estamos intentando reproducir

         const sound = new Howl({
            src: [point.audioSrc],
            html5: true,
            volume: 1.0,
            onload: () => {
               console.log(`App.jsx (playAudio): Audio '${point.name}' CARGADO. Intentando play().`);
               sound.play();
            },
            onplay: () => {
               console.log(`App.jsx (playAudio - ONPLAY): Audio '${point.name}' COMENZÓ.`);
               isPlayingRef.current = true; // Confirmar que está sonando
               setIsPlayingAudioForPointId(point.id);
               if (pendingProximityAudioPoint && pendingProximityAudioPoint.id === point.id) {
                  console.log("App.jsx (playAudio - ONPLAY): Limpiando pendiente:", point.name);
                  setPendingProximityAudioPoint(null);
               }
            },
            onplayerror: (id, err) => {
               console.error(`App.jsx (playAudio - ONPLAYERROR): ERROR REPRODUCIENDO '${point.name}' (ID ${id}):`, err);
               isPlayingRef.current = false;
               setIsPlayingAudioForPointId(null);
               setAudioInstance((prev) => (prev === sound ? null : prev)); // Solo limpiar si es esta instancia
               if (pointForPopup?.id === point.id) setPointForPopup(null);
               setActiveActionPoint(null);
            },
            onloaderror: (id, err) => {
               console.error(`App.jsx (playAudio - ONLOADERROR): ERROR CARGANDO '${point.name}' (ID ${id}):`, err);
               isPlayingRef.current = false;
               if (pendingProximityAudioPoint?.id === point.id) setPendingProximityAudioPoint(null);
            },
            onend: () => {
               console.log(`App.jsx (playAudio - ONEND): Audio '${point.name}' finalizado.`);
               isPlayingRef.current = false;
               setIsPlayingAudioForPointId(null);
               setAudioInstance((prev) => (prev === sound ? null : prev));
               if (pointForPopup?.id === point.id) setPointForPopup(null);
               setActiveActionPoint(null);
            },
            onstop: () => {
               // Se llama cuando se usa .stop()
               console.log(`App.jsx (playAudio - ONSTOP): Audio '${point.name}' detenido.`);
               isPlayingRef.current = false;
               // No setear isPlayingAudioForPointId a null aquí, stopAndUnloadAudio lo hace.
            },
         });
         setAudioInstance(sound);
      },
      [
         audioInstance,
         isPlayingAudioForPointId,
         stopAndUnloadAudio,
         isAudioUnlocked,
         pendingProximityAudioPoint,
         pointForPopup,
         hasStartedRoute,
      ]
   );

   const handlePopupAction = useCallback(
      (point, options = {}) => {
         const isProximityTrigger = options.isProximity || false;
         console.log(
            `App.jsx (handlePopupAction): Acción para '${point.name}'. Proximidad: ${isProximityTrigger}, Ruta iniciada: ${hasStartedRoute}, Audio desbloqueado: ${isAudioUnlocked}`
         );

         // Si no es por proximidad (es un clic) e intentamos desbloquear
         if (!isProximityTrigger && !isAudioUnlocked) {
            console.log("App.jsx (handlePopupAction): Clic en popup. Llamando a tryUnlockAudioContext().");
            tryUnlockAudioContext();
         }

         setActiveActionPoint(point);

         if (point.type === "audio") {
            playAudio(point);
         } else if (point.type === "ar") {
            if (audioInstance) stopAndUnloadAudio(true);
            setIsPlayingAudioForPointId(null);
            setPendingProximityAudioPoint(null);
            setCurrentView("ar");
         }
      },
      [
         audioInstance,
         isAudioUnlocked,
         playAudio,
         tryUnlockAudioContext,
         hasStartedRoute,
         stopAndUnloadAudio, // Agregado stopAndUnloadAudio
      ]
   );

   useEffect(() => {
      console.log(
         `App.jsx (useEffect - Audio Pendiente Check): hasStartedRoute: ${hasStartedRoute}, isAudioUnlocked: ${isAudioUnlocked}, Pending: ${
            pendingProximityAudioPoint?.name || "ninguno"
         }, isPlayingRef: ${isPlayingRef.current}`
      );
      if (hasStartedRoute && isAudioUnlocked && pendingProximityAudioPoint && !isPlayingRef.current) {
         console.log(
            "App.jsx (useEffect - Audio Pendiente): Condiciones cumplidas. Intentando reproducir pendiente:",
            pendingProximityAudioPoint.name
         );
         playAudio(pendingProximityAudioPoint);
      }
   }, [hasStartedRoute, isAudioUnlocked, pendingProximityAudioPoint, playAudio]);

   const handleStartOrContinueRoute = useCallback(() => {
      console.log("App.jsx (handleStartOrContinueRoute): Botón presionado.");
      if (!hasStartedRoute) {
         setHasStartedRoute(true); // Esto ocultará el botón
      }
      localStorage.setItem(LOCAL_STORAGE_ROUTE_STARTED_KEY, "true");
      console.log("App.jsx (handleStartOrContinueRoute): Llamando a tryUnlockAudioContext().");
      tryUnlockAudioContext();
      // El useEffect [hasStartedRoute, isAudioUnlocked, pendingProximityAudioPoint] se encargará del audio pendiente
   }, [hasStartedRoute, tryUnlockAudioContext]);

   const handleCloseAR = useCallback(() => {
      /* ... sin cambios ... */
   });

   if (loadingInitialState) {
      return (
         <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontSize: "1.5em" }}>
            Cargando...
         </div>
      );
   }

   if (!MAPBOX_TOKEN || MAPBOX_TOKEN === "TU_TOKEN_DE_FALLBACK_SI_NO_HAY_ENV") {
      console.log("No hay token");
   }

   const routePreviouslyStartedInLocalStorage = localStorage.getItem(LOCAL_STORAGE_ROUTE_STARTED_KEY) === "true";
   const showStartButton = !hasStartedRoute; // El botón se muestra si `hasStartedRoute` es false

   return (
      <div className="App">
         {showStartButton && (
            <div className="start-route-overlay">
               {" "}
               {/* Añade una clase para estilizar el overlay */}
               <div className="start-route-box">
                  {" "}
                  {/* Caja interna para contenido */}
                  <h1>{routePreviouslyStartedInLocalStorage ? "Bienvenido de Nuevo" : "Bienvenido"}</h1>
                  <p>
                     {routePreviouslyStartedInLocalStorage
                        ? "Presiona para continuar tu ruta y habilitar el audio automático."
                        : "Presiona para comenzar tu ruta guiada por audio."}
                  </p>
                  <button onClick={handleStartOrContinueRoute}>
                     {routePreviouslyStartedInLocalStorage ? "Continuar Ruta" : "Comenzar Ruta"}
                  </button>
                  {pendingProximityAudioPoint && !isAudioUnlocked && (
                     <p className="pending-audio-notice">
                        Punto de audio cercano: {pendingProximityAudioPoint.name}.<br /> Se activará al presionar el botón.
                     </p>
                  )}
               </div>
            </div>
         )}

         {hasStartedRoute && pendingProximityAudioPoint && !isAudioUnlocked && (
            <div className="audio-blocked-notice">
               Audio cercano ({pendingProximityAudioPoint.name}). El audio automático podría estar pausado. Intenta hacer clic en
               "Reproducir Sonido&quot; en un punto del mapa.
            </div>
         )}

         {currentView === "map" && (
            <MapView
               mapboxToken={MAPBOX_TOKEN} // Asegúrate que MAPBOX_TOKEN es el correcto
               points={pointsData} // <<--- AÑADE ESTO
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
