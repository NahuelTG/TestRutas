// src/components/AR/ARScene.jsx
import React, { useEffect, useRef } from "react";
import "./ARScene.css";

const ARScene = ({ pointData, onClose }) => {
   const sceneRef = useRef(null);
   const arSystemRef = useRef(null); // Para guardar referencia al sistema MindAR

   useEffect(() => {
      const sceneEl = sceneRef.current;
      let mindARSystem = null;

      const initializeMindAR = () => {
         if (sceneEl?.systems && sceneEl.systems["mindar-image-system"]) {
            mindARSystem = sceneEl.systems["mindar-image-system"];
            arSystemRef.current = mindARSystem;
            console.log("ARScene: MindAR system initialized/found:", mindARSystem);
            // autoStart: true debería manejar el inicio.
            // Si uiLoading/uiScanning sigue visible, podrías intentar ocultarlo aquí después de un breve delay
            // o cuando el target sea detectado por primera vez.
         } else if (sceneEl) {
            // Si el sistema no está listo inmediatamente, reintentar o esperar 'loaded'
            console.warn("ARScene: MindAR system not immediately available. Waiting for 'loaded' or re-check.");
         }
      };

      if (sceneEl && pointData) {
         if (sceneEl.hasLoaded) {
            initializeMindAR();
         } else {
            sceneEl.addEventListener("loaded", initializeMindAR, { once: true });
         }

         // Para ocultar la UI de MindAR una vez que el tracking comienza (opcional)
         const targetFoundListener = () => {
            console.log("ARScene: Target found, attempting to hide MindAR UI.");
            const uiLoading = document.querySelector(".mindar-ui-overlay.mindar-ui-loading");
            const uiScanning = document.querySelector(".mindar-ui-overlay.mindar-ui-scanning");
            if (uiLoading) uiLoading.style.display = "none";
            if (uiScanning) uiScanning.style.display = "none";
         };
         sceneEl.addEventListener("mindar-image-target-found", targetFoundListener);

         // Manejo de errores de MindAR
         const handleARError = (event) => {
            console.error("ARScene: MindAR Error:", event.detail);
         };
         sceneEl.addEventListener("mindar-image-target-error", handleARError);

         return () => {
            console.log("ARScene: Cleanup initiated.");
            sceneEl.removeEventListener("loaded", initializeMindAR);
            sceneEl.removeEventListener("mindar-image-target-found", targetFoundListener);
            sceneEl.removeEventListener("mindar-image-target-error", handleARError);

            const arSystemToStop = arSystemRef.current || sceneEl?.systems["mindar-image-system"];
            if (arSystemToStop) {
               if (arSystemToStop.running) {
                  console.log("ARScene: Stopping MindAR system.");
                  arSystemToStop.stop(); // Detiene el video y el tracking
               }
               // Detener explícitamente el stream de la cámara
               if (arSystemToStop.video && arSystemToStop.video.srcObject) {
                  const stream = arSystemToStop.video.srcObject;
                  const tracks = stream.getTracks();
                  tracks.forEach((track) => {
                     track.stop();
                     console.log("ARScene: Camera track stopped.");
                  });
                  arSystemToStop.video.srcObject = null; // Liberar el objeto
               }
               arSystemRef.current = null;
            }
            // Forzar la eliminación de la UI de MindAR del DOM si persiste
            // Esto es un poco más agresivo, usar con precaución.
            setTimeout(() => {
               const mindarOverlays = document.querySelectorAll(".mindar-ui-overlay");
               mindarOverlays.forEach((overlay) => overlay.remove());
               console.log("ARScene: Attempted to remove MindAR UI overlays.");
            }, 100); // Pequeño delay para asegurar que A-Frame/MindAR hayan terminado su ciclo
         };
      }
   }, [pointData?.targetSrc]); // Dependencia clave

   if (!pointData || !pointData.targetSrc) {
      // ... (manejo de error si no hay pointData)
      return (
         <div>
            Error AR: Faltan datos. <button onClick={onClose}>Cerrar</button>
         </div>
      );
   }

   return (
      <div className="ar-container">
         <button onClick={onClose} className="ar-close-button">
            Cerrar AR
         </button>
         <a-scene
            key={pointData.targetSrc} // Fuerza re-montaje
            ref={sceneRef}
            mindar-image={`imageTargetSrc: ${pointData.targetSrc}; autoStart: true; uiScanning: yes; uiLoading: yes; maxTrack: 1; filterMinCF:0.001; filterBeta: 10; warmupTolerance: 2; missTolerance: 2;`}
            color-space="sRGB"
            renderer="colorManagement: true, physicallyCorrectLights"
            vr-mode-ui="enabled: false"
            device-orientation-permission-ui="enabled: false"
            embedded
            style={{ width: "100%", height: "100%" }}
            loading-screen="enabled: false" // Intenta deshabilitar la pantalla de carga de A-Frame
         >
            {/* ... (a-assets, a-camera, a-entity) ... */}
            <a-assets>
               <a-asset-item id={`targetModel-${pointData.targetSrc}`} src={pointData.modelSrc}></a-asset-item>
            </a-assets>
            <a-camera position="0 0 0" look-controls="enabled: false" cursor="fuse: false; rayOrigin: mouse;" active="true"></a-camera>
            <a-entity mindar-image-target="targetIndex: 0">
               <a-gltf-model
                  id={`model-${pointData.targetSrc}`} // Darle un ID para referenciarlo
                  rotation={pointData.rotation || "0 0 0"}
                  position={pointData.position || "0 0 0"}
                  scale={pointData.scale || "1 1 1"}
                  src={`#targetModel-${pointData.targetSrc}`}
                  // Quitar animation-mixer si no tienes animaciones definidas en el GLB que quieras usar
                  // animation-mixer

                  // Añadir animación de A-Frame
                  animation="property: rotation; to: 0 360 0; loop: true; dur: 10000; easing: linear; startEvents: model-loaded"
                  // 'model-loaded' es un evento que A-Frame dispara para gltf-model cuando está listo
                  // Otra opción para startEvents: 'targetFound' (si quieres que empiece a animar cuando se detecta el target)
                  // O si el modelo ya tiene una animación llamada "spin" dentro del GLB:
                  // animation-mixer="clip: spin; loop: repeat"
               ></a-gltf-model>
            </a-entity>
         </a-scene>
      </div>
   );
};

export default ARScene;
