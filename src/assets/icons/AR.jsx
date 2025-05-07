export const AR = ({ size = 24, color = "#000000", strokeWidth = 2 }) => {
   // Añade props para flexibilidad
   return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
         <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
         <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
         <g id="SVGRepo_iconCarrier">
            {" "}
            <path
               d="M7 9.5L12 12M7 9.5V14.5L12 17M7 9.5L12 7L17 9.5M12 12L17 9.5M12 12V17M17 9.5V14.5L12 17M8 4H6C4.89543 4 4 4.89543 4 6V8M8 20H6C4.89543 20 4 19.1046 4 18V16M16 4H18C19.1046 4 20 4.89543 20 6V8M16 20H18C19.1046 20 20 19.1046 20 18V16"
               stroke={color} // Usa la prop color
               strokeWidth={strokeWidth} // Usa la prop strokeWidth
               strokeLinecap="round"
               strokeLinejoin="round"
            ></path>{" "}
         </g>
      </svg>
   );
};
