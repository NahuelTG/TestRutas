// src/components/Map/MapView.jsx
import { useRef, useEffect, useState } from "react";
import ReactDOMServer from "react-dom/server"; // Importante
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "./MapView.css";

// Importa tus componentes SVG
import { AR } from "../../assets/icons/AR";
import { Audio } from "../../assets/icons/Audio";

const MapView = ({ mapboxToken, points, onSelectPoint, currentlyPlayingAudioPointId, selectedPointForPopup }) => {
   const mapContainerRef = useRef(null);
   const mapRef = useRef(null);
   const [markers, setMarkers] = useState([]);
   const [popups, setPopups] = useState([]);

   useEffect(() => {
      if (!points) {
         console.warn("MapView: No points data provided.");
         return;
      }

      mapboxgl.accessToken = mapboxToken;
      const map = new mapboxgl.Map({
         container: mapContainerRef.current,
         style: "mapbox://styles/mapbox/streets-v11",
         center: points.length > 0 ? points[0].coordinates : [-74.006, 40.7128],
         zoom: 12,
      });
      mapRef.current = map;

      map.on("load", () => {
         const newMarkers = [];
         const newPopups = [];

         points.forEach((point) => {
            if (!point.coordinates || point.coordinates.length !== 2) {
               console.error("MapView: Invalid coordinates for point", point);
               return;
            }

            const el = document.createElement("div");
            el.className = "custom-marker-wrapper"; // Un wrapper para el SVG

            let iconHtmlString;
            const iconSize = 32;
            if (point.type === "ar") {
               // Renderiza el componente JSX a un string HTML
               iconHtmlString = ReactDOMServer.renderToString(
                  <AR size={iconSize} color="#007bff" strokeWidth={1.5} /> // Ajusta props como necesites
               );
               el.title = `AR: ${point.name}`;
            } else if (point.type === "audio") {
               iconHtmlString = ReactDOMServer.renderToString(<Audio size={iconSize} color="#28a745" />);
               el.title = `Audio: ${point.name}`;
            }

            el.innerHTML = iconHtmlString; // Inserta el SVG renderizado

            // Añade un estilo base al wrapper si es necesario,
            // aunque el SVG mismo define su tamaño
            el.style.width = "auto"; // El SVG ya tiene tamaño
            el.style.height = "auto";
            el.style.cursor = "pointer";

            const markerInstance = new mapboxgl.Marker(el).setLngLat(point.coordinates).addTo(map);
            newMarkers.push({ id: point.id, instance: markerInstance, type: point.type, el: el }); // Guardar 'el' para estilizar

            const popupContent = `
          <div class="mapboxgl-popup-custom-content">
            <h4>${point.name}</h4>
            <p>${point.description}</p>
            <button class="popup-action-button" data-point-id="${point.id}">
              ${point.type === "ar" ? "Iniciar AR" : "Reproducir Sonido"}
            </button>
          </div>
        `;

            const popup = new mapboxgl.Popup({ offset: 25, closeButton: true, closeOnClick: false }).setHTML(popupContent);

            markerInstance.setPopup(popup);
            newPopups.push({ id: point.id, instance: popup });

            markerInstance.getElement().addEventListener("click", (e) => {
               e.stopPropagation();
               popups.forEach((p) => {
                  if (p.id !== point.id && p.instance.isOpen()) {
                     p.instance.remove();
                  }
               });
               if (!popup.isOpen()) {
                  popup.setLngLat(point.coordinates).addTo(map);
               }
            });

            popup.on("open", () => {
               const button = popup.getElement().querySelector(".popup-action-button");
               if (button) {
                  const newButton = button.cloneNode(true);
                  button.parentNode.replaceChild(newButton, button);
                  newButton.addEventListener("click", () => {
                     onSelectPoint(point);
                     popup.remove();
                  });
               }
            });
         });
         setMarkers(newMarkers);
         setPopups(newPopups);
      });

      map.on("error", (e) => console.error("Mapbox error:", e.error));

      return () => {
         popups.forEach((p) => {
            if (p.instance.isOpen()) p.instance.remove();
         });
         markers.forEach((m) => m.instance.remove());
         if (mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
         }
      };
   }, [mapboxToken, points, onSelectPoint]);

   useEffect(() => {
      if (selectedPointForPopup && popups.length > 0 && mapRef.current) {
         const associatedPopup = popups.find((p) => p.id === selectedPointForPopup.id);
         if (associatedPopup && !associatedPopup.instance.isOpen()) {
            popups.forEach((p) => {
               if (p.id !== selectedPointForPopup.id && p.instance.isOpen()) {
                  p.instance.remove();
               }
            });
            mapRef.current.flyTo({ center: selectedPointForPopup.coordinates, zoom: 15 });
            associatedPopup.instance.setLngLat(selectedPointForPopup.coordinates).addTo(mapRef.current);
         }
      }
   }, [selectedPointForPopup, popups]);

   useEffect(() => {
      markers.forEach((markerData) => {
         const markerElementWrapper = markerData.el; // Usar el 'el' guardado
         if (markerElementWrapper) {
            // Asegurarse de que el elemento existe
            if (markerData.type === "audio") {
               if (markerData.id === currentlyPlayingAudioPointId) {
                  markerElementWrapper.classList.add("playing-svg");
               } else {
                  markerElementWrapper.classList.remove("playing-svg");
               }
            }
         }
      });
   }, [currentlyPlayingAudioPointId, markers]);

   return <div ref={mapContainerRef} style={{ width: "100%", height: "100vh" }} />;
};

export default MapView;
