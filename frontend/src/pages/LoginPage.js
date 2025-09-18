import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Mail, Lock, Calendar, Music } from 'lucide-react';

const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    try {
      await onLogin(email, password);
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center fade-in">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-3 rounded-full">
              <Calendar className="h-8 w-8 text-white" />
            </div>
            <Music className="h-6 w-6 text-indigo-600 ml-2" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Calendrier Artistes
          </h1>
          <p className="text-gray-600">
            Gérez vos disponibilités en toute simplicité
          </p>
        </div>

        {/* Login Form */}
        <Card className="glass card-hover fade-in">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-semibold text-gray-900">
              Connexion
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
                    placeholder="votre@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="form-input pl-10"
                    required
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
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input pl-10"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full btn-primary"
                disabled={loading || !email || !password}
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="spinner h-5 w-5 mr-2"></div>
                    Connexion...
                  </div>
                ) : (
                  'Se connecter'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Demo accounts info */}
        <Card className="glass fade-in">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-gray-900 mb-3">Comptes de démonstration :</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                <span className="text-blue-900">Admin :</span>
                <span className="font-mono text-blue-700">admin@demo.app</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                <span className="text-green-900">DJ Alex :</span>
                <span className="font-mono text-green-700">dj.alex@demo.app</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-purple-50 rounded">
                <span className="text-purple-900">Marie Beats :</span>
                <span className="font-mono text-purple-700">marie.beats@demo.app</span>
              </div>
              <p className="text-gray-500 text-xs mt-2">
                Mot de passe pour tous : <span className="font-mono">demo123</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;