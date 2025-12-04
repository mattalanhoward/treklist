// //src/pages/Login.jsx
// import React, { useState } from "react";
// import { useNavigate, useLocation } from "react-router-dom";
// import useAuth from "../hooks/useAuth";

// export default function Login() {
//   const { login, loading } = useAuth();
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const navigate = useNavigate();
//   const location = useLocation();
//   const [error, setError] = useState("");

//   const sanitizeNext = (n) => {
//     if (!n || typeof n !== "string") return null;
//     // prevent open redirects; only allow same-origin paths
//     return n.startsWith("/") ? n : null;
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     try {
//       await login(email, password);
//       const params = new URLSearchParams(location.search);
//       const next = sanitizeNext(params.get("next"));
//       navigate(next || "/dashboard", { replace: true });
//     } catch (err) {
//       setError(err.response?.data?.message || "Login failed");
//     }
//   };

//   return (
//     <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
//       {" "}
//       <form
//         onSubmit={handleSubmit}
//         className="bg-white p-6 rounded shadow-md w-full max-w-sm"
//       >
//         <h1 className="text-2xl mb-4 text-center">Log In</h1>
//         {error && <p className="text-red-500 mb-2">{error}</p>}
//         <label className="block mb-2">
//           Email
//           <input
//             type="email"
//             value={email}
//             onChange={(e) => setEmail(e.target.value)}
//             className="mt-1 p-2 w-full border rounded"
//             required
//           />
//         </label>
//         <label className="block mb-4">
//           Password
//           <input
//             type="password"
//             value={password}
//             onChange={(e) => setPassword(e.target.value)}
//             className="mt-1 p-2 w-full border rounded"
//             required
//           />
//         </label>
//         <button
//           type="submit"
//           disabled={loading}
//           className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
//         >
//           {loading ? "Logging in…" : "Log In"}
//         </button>
//       </form>
//       <div className="mt-4 text-center">
//         <a href="/forgot-password" className="text-blue-600 hover:underline">
//           Forgot password?
//         </a>
//         <span className="mx-2">|</span>
//         <a href="/register" className="text-blue-600 hover:underline">
//           Create an account
//         </a>
//       </div>
//     </div>
//   );
// }
