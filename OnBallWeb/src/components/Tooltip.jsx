import { useState, useEffect } from "react";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/outline";

export default function Tooltip({ text, position = "top" }) {
    const [show, setShow] = useState(false);

    // Auto-hide tooltip after 3s on mobile click
    useEffect(() => {
        let timer;
        if (show && window.innerWidth < 768) {
            timer = setTimeout(() => {
                setShow(false);
            }, 3000);
        }
        return () => clearTimeout(timer);
    }, [show]);

    // Determine positioning class based on available space
    const getPositionClass = () => {
        switch (position) {
            case "right":
                return "left-full ml-2 top-0";
            case "left":
                return "right-full mr-2 top-0";
            case "bottom":
                return "top-full mt-2 left-1/2 transform -translate-x-1/2";
            case "top":
            default:
                return "bottom-full mb-2 left-1/2 transform -translate-x-1/2";
        }
    };

    // Get arrow position class
    const getArrowClass = () => {
        switch (position) {
            case "right":
                return "absolute left-0 top-1/2 transform -translate-x-full -translate-y-1/2 w-0 h-0 border-t-8 border-b-8 border-r-8 border-transparent border-r-black";
            case "left":
                return "absolute right-0 top-1/2 transform translate-x-full -translate-y-1/2 w-0 h-0 border-t-8 border-b-8 border-l-8 border-transparent border-l-black";
            case "bottom":
                return "absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-transparent border-b-black";
            case "top":
            default:
                return "absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-black";
        }
    };

    return (
        <div
            className="relative group inline-block"
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
            onClick={() => setShow(true)} // show on mobile click
        >
            <QuestionMarkCircleIcon className="w-4 h-4 text-blue-400 cursor-pointer inline" />
            {/* Tooltip container with dynamic positioning */}
            <div
                className={`fixed z-[1000] w-64 bg-black text-white text-sm px-3 py-2 rounded shadow-lg ${show ? "block" : "hidden"
                    }`}
                style={{
                    left: show && window.event?.clientX && !isNaN(window.event.clientX) ? window.event.clientX + 10 : '50%',
                    top: show && window.event?.clientY && !isNaN(window.event.clientY) ? window.event.clientY - 10 : '50%',
                    transform: (!window.event?.clientX || isNaN(window.event.clientX)) ? 'translate(-50%, -50%)' : 'none'
                }}
            >
                {text}
            </div>
        </div>
    );
}