// src/components/AR/ARScene.jsx
import React, { useEffect, useRef } from "react";
import "./ARScene.css";

const ARScene = ({ pointData, onClose }) => {
   const sceneRef = useRef(null);
   const arSystemRef = useRef(null); // Para guardar referencia al sistema MindAR

   useEffect(() => {
      const sceneEl = sceneRef.current;
      let mindARSystem = null;

      if (sceneEl && pointData) {
         // Esperar a que la escena esté cargada para acceder a los sistemas
         sceneEl.addEventListener("loaded", () => {
            mindARSystem = sceneEl.systems["mindar-image-system"];
            arSystemRef.current = mindARSystem; // Guardar para cleanup
            // autoStart está en true, así que MindAR debería iniciarse solo.
            // Podrías añadir lógica aquí si necesitas iniciar/pausar manualmente
            console.log("A-Frame scene loaded, MindAR system:", mindARSystem);
         });

         // Si ya está cargada (por ejemplo, si pointData cambia pero la escena persiste)
         if (sceneEl.hasLoaded) {
            mindARSystem = sceneEl.systems["mindar-image-system"];
            arSystemRef.current = mindARSystem;
            // Si el sistema ya estaba corriendo y cambias de target, podrías necesitar reiniciarlo o actualizarlo.
            // Por ahora, asumimos que el cambio de pointData implica un nuevo montaje o que MindAR maneja el cambio de targetSrc.
         }
      }

      return () => {
         // Limpieza cuando el componente se desmonta o pointData cambia (forzando re-render)
         const arSystemToStop = arSystemRef.current || sceneEl?.systems["mindar-image-system"];
         if (arSystemToStop) {
            if (arSystemToStop.running) {
               arSystemToStop.stop(); // Detiene el video y el tracking
               console.log("MindAR system stopped.");
            }
            // También es importante detener el stream de la cámara
            if (arSystemToStop.video) {
               const stream = arSystemToStop.video.srcObject;
               if (stream) {
                  const tracks = stream.getTracks();
                  tracks.forEach((track) => track.stop());
                  console.log("Camera stream stopped by ARScene cleanup.");
               }
            }
         }
         if (sceneEl) {
            // Quitar listeners si los añadiste
            // sceneEl.removeEventListener('loaded', ...);
         }
      };
      // La dependencia de pointData.targetSrc asegura que si el target cambia,
      // el efecto se re-ejecuta.
   }, [pointData?.targetSrc]); // Depender de algo específico de pointData que cambie

   if (!pointData || !pointData.targetSrc) {
      // Asegurarse que hay un target
      console.warn("ARScene: No pointData or targetSrc provided.");
      return (
         <div className="ar-container">
            <p>Error: No se pudo cargar la experiencia AR. Faltan datos.</p>
            <button onClick={onClose} className="ar-close-button">
               Cerrar
            </button>
         </div>
      );
   }

   // Usar una 'key' en a-scene puede ayudar a React a tratarla como una instancia completamente nueva
   // si pointData.targetSrc cambia, lo que puede ser más limpio para A-Frame/MindAR.
   return (
      <div className="ar-container">
         <button onClick={onClose} className="ar-close-button">
            Cerrar AR
         </button>
         <a-scene
            key={pointData.targetSrc} // Fuerza re-montaje si el target cambia
            ref={sceneRef}
            mindar-image={`imageTargetSrc: ${pointData.targetSrc}; autoStart: true; uiScanning: yes; uiLoading: yes; maxTrack: 1;`}
            color-space="sRGB"
            renderer="colorManagement: true, physicallyCorrectLights"
            vr-mode-ui="enabled: false"
            device-orientation-permission-ui="enabled: false"
            embedded // Importante para que no tome toda la pantalla si no quieres
            style={{ width: "100%", height: "100%" }} // Asegura que ocupe el contenedor
         >
            <a-assets>
               <a-asset-item id={`targetModel-${pointData.targetSrc}`} src={pointData.modelSrc}></a-asset-item>
            </a-assets>

            <a-camera position="0 0 0" look-controls="enabled: false" cursor="fuse: false; rayOrigin: mouse;" active="true"></a-camera>

            <a-entity mindar-image-target="targetIndex: 0">
               <a-gltf-model
                  rotation={pointData.rotation || "0 0 0"}
                  position={pointData.position || "0 0 0"}
                  scale={pointData.scale || "1 1 1"}
                  src={`#targetModel-${pointData.targetSrc}`}
                  animation-mixer
               ></a-gltf-model>
            </a-entity>
         </a-scene>
      </div>
   );
};

export default ARScene;
