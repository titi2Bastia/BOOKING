import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Mail, Lock, Globe, Calendar, Music, CheckCircle, XCircle } from 'lucide-react';
import axios from 'axios';

const InvitePage = ({ onRegister }) => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [invitationData, setInvitationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [timezone, setTimezone] = useState('Europe/Paris');
  const [validToken, setValidToken] = useState(false);

  useEffect(() => {
    verifyToken();
  }, [token]);

  const verifyToken = async () => {
    try {
      const response = await axios.get(`/invitations/verify/${token}`);
      setInvitationData(response.data);
      setEmail(response.data.email);
      setValidToken(true);
    } catch (error) {
      console.error('Token verification failed:', error);
      setValidToken(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      alert('Les mots de passe ne correspondent pas');
      return;
    }

    if (password.length < 6) {
      alert('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setRegistering(true);
    try {
      await onRegister(email, password, timezone, token);
      // Redirect to login page after successful registration
      setTimeout(() => navigate('/login'), 2000);
    } catch (error) {
      console.error('Registration failed:', error);
    } finally {
      setRegistering(false);
    }
  };

  const timezones = [
    { value: 'Europe/Paris', label: 'Europe/Paris (UTC+1)' },
    { value: 'Europe/London', label: 'Europe/London (UTC+0)' },
    { value: 'Europe/Berlin', label: 'Europe/Berlin (UTC+1)' },
    { value: 'Europe/Madrid', label: 'Europe/Madrid (UTC+1)' },
    { value: 'America/New_York', label: 'America/New_York (UTC-5)' },
    { value: 'America/Los_Angeles', label: 'America/Los_Angeles (UTC-8)' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!validToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md glass">
          <CardContent className="text-center pt-6">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Invitation invalide
            </h2>
            <p className="text-gray-600 mb-6">
              Ce lien d'invitation n'est plus valide ou a expiré.
            </p>
            <Button 
              onClick={() => navigate('/login')}
              className="btn-primary"
            >
              Retour à la connexion
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center fade-in">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-3 rounded-full">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
            <Music className="h-6 w-6 text-green-600 ml-2" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Créer votre compte
          </h1>
          <p className="text-gray-600">
            Vous avez été invité(e) à rejoindre le calendrier des disponibilités
          </p>
        </div>

        {/* Registration Form */}
        <Card className="glass card-hover fade-in">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-semibold text-gray-900">
              Inscription
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Adresse email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    className="form-input pl-10 bg-gray-50"
                    disabled
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Mot de passe
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Au moins 6 caractères"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input pl-10"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                  Confirmer le mot de passe
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Répétez votre mot de passe"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="form-input pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Fuseau horaire
                </Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 z-10" />
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger className="form-input pl-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full btn-primary"
                disabled={registering || !password || password !== confirmPassword || password.length < 6}
              >
                {registering ? (
                  <div className="flex items-center justify-center">
                    <div className="spinner h-5 w-5 mr-2"></div>
                    Création du compte...
                  </div>
                ) : (
                  'Créer mon compte'
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200 text-center">
              <p className="text-sm text-gray-600">
                Vous avez déjà un compte ?{' '}
                <button
                  onClick={() => navigate('/login')}
                  className="text-indigo-600 hover:text-indigo-500 font-medium"
                >
                  Se connecter
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InvitePage;