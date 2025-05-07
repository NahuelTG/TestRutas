// src/App.jsx
import { useState, useEffect } from "react";
import { Howl } from "howler"; // Importar Howl directamente
import MapView from "./components/Map/MapView";
import ARScene from "./components/AR/ARScene";
import pointsData from "./data/pointsData.json";
import PWABadge from "./PWABadge.jsx";
import "./App.css";

const MAPBOX_TOKEN = "pk.eyJ1IjoibmFodWVsdGciLCJhIjoiY21hZWJlOXA5MDYxdjJpb2NvcGZvdnNuYiJ9.EccHdk-XgOfjB2Yc43obng"; // ¡RECUERDA PONER TU TOKEN!

function App() {
   const [currentView, setCurrentView] = useState("map");
   const [selectedPoint, setSelectedPoint] = useState(null);
   const [audioInstance, setAudioInstance] = useState(null);

   // Detener y descargar audio si está activo
   const stopAndUnloadAudio = () => {
      if (audioInstance) {
         audioInstance.stop();
         audioInstance.unload();
         setAudioInstance(null);
         console.log("Audio detenido y descargado");
      }
   };

   useEffect(() => {
      // Limpieza general del audio al desmontar App (aunque improbable aquí)
      return () => {
         stopAndUnloadAudio();
      };
   }, [audioInstance]); // Se ejecutará si audioInstance cambia

   const handleSelectPoint = (point) => {
      stopAndUnloadAudio(); // Detener cualquier audio anterior

      setSelectedPoint(point); // Establecer el nuevo punto seleccionado

      if (point.type === "ar") {
         setCurrentView("ar");
      } else if (point.type === "audio") {
         setCurrentView("map"); // Asegurarse de estar en la vista de mapa para audio
         const sound = new Howl({
            src: [point.audioSrc],
            html5: true,
            onload: () => console.log(`Audio ${point.audioSrc} cargado`),
            onplay: () => console.log(`Reproduciendo ${point.audioSrc}`),
            onend: () => {
               console.log(`Audio ${point.audioSrc} finalizado`);
               setSelectedPoint((prevPoint) => (prevPoint?.id === point.id ? null : prevPoint)); // Deseleccionar solo si es el mismo punto
               setAudioInstance(null);
            },
            onloaderror: (id, err) => console.error("Error al cargar audio:", err, point.audioSrc),
            onplayerror: (id, err) => console.error("Error al reproducir audio:", err),
         });
         sound.play();
         setAudioInstance(sound);
      }
   };

   const handleCloseAR = () => {
      setCurrentView("map");
      // No necesariamente limpiamos selectedPoint aquí, podría ser útil mantenerlo
      // para mostrar info en el mapa, o sí, dependiendo de la UX deseada.
      // setSelectedPoint(null); // Descomentar si quieres limpiar la selección al cerrar AR

      // La limpieza de MindAR (cámara, etc.) debería ocurrir en ARScene.jsx
   };

   return (
      <div className="App">
         {currentView === "map" && (
            <MapView
               mapboxToken={MAPBOX_TOKEN}
               points={pointsData}
               onSelectPoint={handleSelectPoint}
               currentlyPlayingAudioPointId={audioInstance && selectedPoint?.type === "audio" ? selectedPoint.id : null}
               selectedPointForPopup={selectedPoint} // Para mantener popup abierto o mostrar info
            />
         )}

         {currentView === "ar" && selectedPoint && selectedPoint.type === "ar" && (
            <ARScene
               pointData={selectedPoint.ar} // Pasas selectedPoint.ar
               onClose={handleCloseAR}
            />
         )}
         <PWABadge />
      </div>
   );
}

export default App;
