import React from 'react';
export function DarkContainer({ children, className = "" }) {
    return (
        <div className={`bg-gray-900 text-gray-100 min-h-screen p-6 ${className}`}>
            {children}
        </div>
    );
}

export const Section = ({ title, children }) => (
    <div className="mb-6">
        <h2 className="text-xl font-bold mb-2">{title}</h2>
        <div className="space-y-4">{children}</div>
    </div>
);

export const StyledInput = (props) => (
    <input
        {...props}
        className="border border-gray-600 bg-gray-700 text-white rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
    />
);

export const StyledButton = ({ children, className = '', ...props }) => (
    <button
        {...props}
        className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 ${className}`}
    >
        {children}
    </button>
);

// New StyledSelect component for dark theme dropdowns
export const StyledSelect = ({ children, className = '', ...props }) => (
    <select
        {...props}
        className={`border border-gray-600 bg-gray-800 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
        style={{
            backgroundColor: "#1f2937", // bg-gray-800
            color: "#f9fafb", // text-white
            // Override Firefox's default styling
            WebkitAppearance: "none",
            MozAppearance: "none",
            appearance: "none",
            backgroundImage: "url(\"data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23FFFFFF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E\")",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 0.7rem top 50%",
            backgroundSize: "0.65rem auto",
            paddingRight: "2rem"
        }}
    >
        {React.Children.map(children, child => {
            if (!child) return child;

            // Apply styling to option elements
            if (child.type === 'option') {
                return React.cloneElement(child, {
                    className: "bg-gray-800 text-white"
                });
            }

            return child;
        })}
    </select>
);

// StyledOption component for individual options if needed
export const StyledOption = ({ children, className = '', ...props }) => (
    <option
        {...props}
        className={`bg-gray-800 text-white ${className}`}
    >
        {children}
    </option>
);

/** 
 * If you want a basic table style:
 * We don't strictly need these for the dark theme,
 * but you can keep them if you want your <table> 
 * usage to look consistent.
 */

export const StyledTable = ({ children }) => (
    <table className="min-w-full border border-gray-300 text-sm">
        {children}
    </table>
);

export const TableHeader = ({ children }) => (
    <thead className="bg-gray-100">
        <tr>{children}</tr>
    </thead>
);

export const TableCell = ({ children }) => (
    <td className="border px-3 py-2 text-left">{children}</td>
);

export const TableRow = ({ children }) => (
    <tr>{children}</tr>
);

export const ResponsivePlayerName = ({ name, className = "" }) => {
    return (
        <div className={`flex items-center min-w-0 ${className}`}>
            <span className="truncate text-sm sm:text-base md:text-lg">
                {name}
            </span>
        </div>
    );
};