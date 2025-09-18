import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import './App.css';

// Import pages
import LoginPage from './pages/LoginPage';
import InvitePage from './pages/InvitePage';
import ArtistDashboard from './pages/ArtistDashboard';
import AdminDashboard from './pages/AdminDashboard';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Configure axios defaults
axios.defaults.baseURL = API;

// Add request interceptor for auth token
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for handling errors
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post('/auth/login', { email, password });
      const { access_token } = response.data;
      
      localStorage.setItem('access_token', access_token);
      
      // Get user info
      const userResponse = await axios.get('/auth/me');
      setUser(userResponse.data);
      localStorage.setItem('user', JSON.stringify(userResponse.data));
      
      toast.success('Connexion réussie !');
      return userResponse.data;
    } catch (error) {
      const message = error.response?.data?.detail || 'Erreur de connexion';
      toast.error(message);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setUser(null);
    toast.success('Déconnexion réussie');
  };

  const register = async (email, password, timezone, token) => {
    try {
      const response = await axios.post(`/auth/register?token=${token}`, {
        email,
        password,
        timezone
      });
      
      toast.success('Compte créé avec succès ! Vous pouvez maintenant vous connecter.');
      return response.data;
    } catch (error) {
      const message = error.response?.data?.detail || 'Erreur lors de la création du compte';
      toast.error(message);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Routes>
          <Route 
            path="/login" 
            element={
              user ? (
                <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />
              ) : (
                <LoginPage onLogin={login} />
              )
            } 
          />
          
          <Route 
            path="/invite/:token" 
            element={<InvitePage onRegister={register} />} 
          />
          
          <Route 
            path="/dashboard" 
            element={
              user && user.role === 'artist' ? (
                <ArtistDashboard user={user} onLogout={logout} />
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          
          <Route 
            path="/admin" 
            element={
              user && user.role === 'admin' ? (
                <AdminDashboard user={user} onLogout={logout} />
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          
          <Route 
            path="/" 
            element={
              user ? (
                <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
        </Routes>
        
        <Toaster position="top-right" />
      </div>
    </Router>
  );
}

export default App;