import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * This component protects routes that require authentication and, optionally, admin privileges.
 * @param {object} props - The component's props.
 * @param {React.ReactNode} props.children - The component(s) to render if the user is authorized.
 * @param {boolean} [props.requireAdmin=false] - If true, the user must be an admin to access the route.
 */
const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const location = useLocation();

  // Check for the authentication token in local storage.
  const token = localStorage.getItem('token');
  
  // Check for the admin flag in local storage. It must be the string 'true'.
  const isAdmin = localStorage.getItem('is_admin') === 'true';

  // 1. If no token exists, the user is not logged in. Redirect to the login page.
  // We pass the current location in the state so we can redirect back after a successful login.
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // 2. If the route requires admin access AND the user is not an admin, deny access.
  // Redirecting to the main user dashboard is a safe default.
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }
  
  // 3. If all security checks pass, render the child components.
  return children;
};

export default ProtectedRoute;
