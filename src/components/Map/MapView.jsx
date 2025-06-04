// src/components/Map/MapView.jsx
import React, { useRef, useEffect, useState, useCallback } from "react";
import ReactDOMServer from "react-dom/server";
import mapboxgl from "mapbox-gl"; // mapboxgl ya incluye GeolocateControl
import "mapbox-gl/dist/mapbox-gl.css";
import "./MapView.css";

import { AR as ARÍcono } from "../../../public/assets/icons/AR";
import { Audio as AudioÍcono } from "../../../public/assets/icons/Audio";

const MapView = ({
   mapboxToken,
   points,
   onMarkerClick,
   onPopupAction,
   currentlyPlayingAudioPointId,
   selectedPointForPopup,
   isPlayingAudioForSelectedPoint,
}) => {
   const mapContainerRef = useRef(null);
   const mapRef = useRef(null);
   const markersRef = useRef({});
   const popupsRef = useRef({});
   const buttonListenersRef = useRef({});
   const geolocateControlRef = useRef(null); // Para guardar la instancia del control de geolocalización
   const [mapLoaded, setMapLoaded] = useState(false);
   const activatedPointsRef = useRef(new Set());

   const updatePopupButtonText = useCallback(
      /* ... (sin cambios) ... */ (pointId, isPlaying) => {
         const popupInstance = popupsRef.current[pointId];
         if (popupInstance && popupInstance.isOpen()) {
            const popupElement = popupInstance.getElement();
            const button = popupElement?.querySelector(".popup-action-button");
            if (button) {
               const point = points.find((p) => p.id === pointId);
               if (point?.type === "audio") {
                  button.textContent = isPlaying ? "Detener Sonido" : "Reproducir Sonido";
               } else if (point?.type === "ar") {
                  button.textContent = "Iniciar AR";
               }
            }
         }
      },
      [points]
   );

   // Efecto para inicializar el mapa, marcadores, popups y control de geolocalización
   useEffect(() => {
      if (mapRef.current || !points || points.length === 0) {
         if (!mapboxToken) console.warn("MapView: Mapbox token no proporcionado.");
         return;
      }

      mapboxgl.accessToken = mapboxToken;
      const map = new mapboxgl.Map({
         container: mapContainerRef.current,
         style: "mapbox://styles/mapbox/streets-v11",
         center: points[0].coordinates,
         zoom: 12,
      });
      mapRef.current = map;

      // --- INICIO: Añadir GeolocateControl ---
      const geolocate = new mapboxgl.GeolocateControl({
         positionOptions: {
            enableHighAccuracy: true, // Intenta obtener la ubicación más precisa
         },
         trackUserLocation: true, // Sigue al usuario en el mapa
         showUserHeading: true, // Muestra la dirección a la que mira el usuario (si el dispositivo lo soporta)
         showUserLocation: true, // Muestra el punto de ubicación del usuario
         fitBoundsOptions: {
            maxZoom: 15, // Zoom máximo al centrar en el usuario
         },
      });
      map.addControl(geolocate, "top-right"); // Añade el control al mapa (puedes cambiar la posición)
      geolocateControlRef.current = geolocate; // Guardar referencia si necesitas interactuar con él

      // Opcional: Escuchar eventos del GeolocateControl

      geolocate.on("geolocate", (e) => {
         const userLat = e.coords.latitude;
         const userLng = e.coords.longitude;
         const MAX_DISTANCE_METERS = 50;

         const haversineDistance = (lat1, lon1, lat2, lon2) => {
            const R = 6371e3;
            const toRad = (x) => (x * Math.PI) / 180;
            const dLat = toRad(lat2 - lat1);
            const dLon = toRad(lon2 - lon1);
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
         };

         let closestPoint = null;
         let minDistance = Infinity;

         for (const point of points) {
            if (point.type !== "audio" || !point.coordinates) continue;
            if (activatedPointsRef.current.has(point.id)) continue;

            const [lng, lat] = point.coordinates;
            const distance = haversineDistance(userLat, userLng, lat, lng);

            if (distance < MAX_DISTANCE_METERS && distance < minDistance) {
               closestPoint = point;
               minDistance = distance;
            }
         }

         if (closestPoint && closestPoint.id !== currentlyPlayingAudioPointId) {
            activatedPointsRef.current.add(closestPoint.id);
            console.log(
               `MapView: Audio '${closestPoint.name}' detectado por proximidad (${minDistance.toFixed(1)}m). Solicitando reproducción.`
            );
            // MODIFICACIÓN AQUÍ: Pasa un objeto de opciones
            onPopupAction(closestPoint, { isProximity: true });
         }
      });

      geolocate.on("error", (e) => {
         console.error("Error de geolocalización:", e.message);
         // Informar al usuario que la geolocalización falló o no está disponible.
         // Esto puede pasar si el usuario deniega el permiso, o si el navegador no soporta la API.
         // También si no estás en un contexto seguro (HTTPS), excepto localhost.
      });
      // --- FIN: Añadir GeolocateControl ---

      map.on("load", () => {
         // Disparar la geolocalización automáticamente al cargar el mapa (opcional)
         geolocate.trigger(); // Descomenta si quieres que intente localizar al usuario al inicio

         points.forEach((point) => {
            // ... (código de creación de marcadores y popups sin cambios) ...
            if (!point.coordinates || point.coordinates.length !== 2) {
               console.error("MapView: Coordenadas inválidas para el punto", point);
               return;
            }

            const el = document.createElement("div");
            el.className = "custom-marker-wrapper";
            const iconSize = 32;
            let iconHtmlString = "";

            if (point.type === "ar") {
               iconHtmlString = ReactDOMServer.renderToString(<ARÍcono size={iconSize} color="#007bff" strokeWidth={1.5} />);
               el.title = `AR: ${point.name}`;
            } else if (point.type === "audio") {
               iconHtmlString = ReactDOMServer.renderToString(<AudioÍcono size={iconSize} color="#28a745" />);
               el.title = `Audio: ${point.name}`;
            }
            el.innerHTML = iconHtmlString;

            const markerInstance = new mapboxgl.Marker(el).setLngLat(point.coordinates).addTo(map);
            markersRef.current[point.id] = markerInstance;

            const popupContentHTML = `
          <div class="mapboxgl-popup-custom-content">
            <h4>${point.name}</h4>
            <p>${point.description}</p>
            <button class="popup-action-button" data-point-id="${point.id}">
              ${point.type === "ar" ? "Iniciar AR" : "Reproducir Sonido"}
            </button>
          </div>
        `;
            const popupInstance = new mapboxgl.Popup({
               offset: 25,
               closeButton: true,
               closeOnClick: false,
            }).setHTML(popupContentHTML);
            popupsRef.current[point.id] = popupInstance;

            markerInstance.getElement().addEventListener("click", (e) => {
               e.stopPropagation();
               onMarkerClick(point);
            });
         });
         setMapLoaded(true);
         console.log("MapView: Mapa y elementos inicializados.");
      });

      map.on("error", (e) => console.error("Mapbox GL Error:", e.error?.message || e));

      // Limpieza al desmontar MapView
      return () => {
         console.log("MapView: Desmontando MapView y limpiando recursos de Mapbox.");
         if (geolocateControlRef.current && mapRef.current && mapRef.current.hasControl(geolocateControlRef.current)) {
            // mapRef.current.removeControl(geolocateControlRef.current); // No es estrictamente necesario si el mapa se destruye
         }
         Object.values(buttonListenersRef.current).forEach(({ button, handler }) => {
            if (button && handler) button.removeEventListener("click", handler);
         });
         buttonListenersRef.current = {};

         Object.values(popupsRef.current).forEach((p) => {
            if (p.isOpen()) p.remove();
         });
         Object.values(markersRef.current).forEach((m) => m.remove());
         popupsRef.current = {};
         markersRef.current = {};
         if (mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
         }
         setMapLoaded(false);
      };
   }, [mapboxToken, points, onMarkerClick]);

   // ... (useEffect para selectedPointForPopup sin cambios en su lógica interna, pero puede
   //      tener `onPopupAction` y `updatePopupButtonText` como dependencias si vienen de App.jsx
   //      y pueden cambiar, aunque con useCallback deberían ser estables)
   useEffect(() => {
      if (!mapLoaded || !mapRef.current) return;

      Object.entries(popupsRef.current).forEach(([pointId, p]) => {
         const isSelected = selectedPointForPopup && pointId === selectedPointForPopup.id;
         if (!isSelected) {
            if (p.isOpen()) {
               p.remove();
            }
            const listenerInfo = buttonListenersRef.current[pointId];
            if (listenerInfo) {
               listenerInfo.button.removeEventListener("click", listenerInfo.handler);
               delete listenerInfo.button.dataset.listenerAttached;
               delete buttonListenersRef.current[pointId];
            }
         }
      });

      if (selectedPointForPopup) {
         const pointId = selectedPointForPopup.id;
         const popupInstance = popupsRef.current[pointId];

         if (popupInstance) {
            if (!popupInstance.isOpen()) {
               popupInstance.setLngLat(selectedPointForPopup.coordinates).addTo(mapRef.current);
               const currentBounds = mapRef.current.getBounds();
               if (!currentBounds.contains(selectedPointForPopup.coordinates)) {
                  mapRef.current.flyTo({
                     center: selectedPointForPopup.coordinates,
                     zoom: Math.max(mapRef.current.getZoom(), 14),
                     essential: true,
                  });
               }
            }

            updatePopupButtonText(pointId, isPlayingAudioForSelectedPoint && selectedPointForPopup.type === "audio");

            const popupElement = popupInstance.getElement();
            const button = popupElement?.querySelector(".popup-action-button");

            if (button && !button.dataset.listenerAttached) {
               const handleButtonClick = (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onPopupAction(selectedPointForPopup);
               };
               button.addEventListener("click", handleButtonClick);
               button.dataset.listenerAttached = "true";
               buttonListenersRef.current[pointId] = { button, handler: handleButtonClick };
            }
         }
      }
   }, [mapLoaded, selectedPointForPopup, isPlayingAudioForSelectedPoint, onPopupAction, updatePopupButtonText, points]);

   // ... (useEffect para currentlyPlayingAudioPointId sin cambios)
   useEffect(() => {
      if (!mapLoaded || !points || points.length === 0) return;

      Object.entries(markersRef.current).forEach(([pointId, markerInstance]) => {
         const markerElementWrapper = markerInstance.getElement();
         if (markerElementWrapper) {
            const point = points.find((p) => p.id === pointId);
            if (point?.type === "audio") {
               if (pointId === currentlyPlayingAudioPointId) {
                  markerElementWrapper.classList.add("playing-svg");
               } else {
                  markerElementWrapper.classList.remove("playing-svg");
               }
            } else {
               markerElementWrapper.classList.remove("playing-svg");
            }
         }
      });
   }, [mapLoaded, currentlyPlayingAudioPointId, points]);

   return <div ref={mapContainerRef} className="map-container-wrapper" style={{ width: "100%", height: "100vh" }} />;
};

export default MapView;
