import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Calendar, Clock, Music, User, Phone, Link as LinkIcon, Plus, Edit, Trash2, LogOut } from 'lucide-react';
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/fr';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import axios from 'axios';
import { toast } from 'sonner';

// Configure moment for French locale
moment.locale('fr');
const localizer = momentLocalizer(moment);

const ArtistDashboard = ({ user, onLogout }) => {
  const [profile, setProfile] = useState(null);
  const [availabilities, setAvailabilities] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showAvailabilityDialog, setShowAvailabilityDialog] = useState(false);
  const [editingAvailability, setEditingAvailability] = useState(null);
  
  // Profile form state
  const [profileForm, setProfileForm] = useState({
    nom_de_scene: '',
    telephone: '',
    lien: ''
  });

  // Availability form state
  const [availabilityForm, setAvailabilityForm] = useState({
    start_datetime: '',
    end_datetime: '',
    type: 'créneau',
    note: '',
    color: '#3b82f6'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await Promise.all([
        loadProfile(),
        loadAvailabilities()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProfile = async () => {
    try {
      const response = await axios.get('/profile');
      setProfile(response.data);
      setProfileForm({
        nom_de_scene: response.data.nom_de_scene || '',
        telephone: response.data.telephone || '',
        lien: response.data.lien || ''
      });
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error('Error loading profile:', error);
      }
    }
  };

  const loadAvailabilities = async () => {
    try {
      const response = await axios.get('/availabilities');
      setAvailabilities(response.data);
      
      // Convert to calendar events
      const calendarEvents = response.data.map(avail => ({
        id: avail.id,
        title: avail.note || 'Disponible',
        start: new Date(avail.start_datetime),
        end: new Date(avail.end_datetime),
        resource: avail,
        allDay: avail.type === 'journée_entière'
      }));
      
      setEvents(calendarEvents);
    } catch (error) {
      console.error('Error loading availabilities:', error);
      toast.error('Erreur lors du chargement des disponibilités');
    }
  };

  const saveProfile = async () => {
    try {
      const response = await axios.post('/profile', profileForm);
      setProfile(response.data);
      setShowProfileDialog(false);
      toast.success('Profil mis à jour avec succès');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Erreur lors de la sauvegarde du profil');
    }
  };

  const saveAvailability = async () => {
    try {
      // Validate dates
      const start = new Date(availabilityForm.start_datetime);
      const end = new Date(availabilityForm.end_datetime);
      
      if (start >= end) {
        toast.error('La date de fin doit être après la date de début');
        return;
      }

      const payload = {
        ...availabilityForm,
        start_datetime: start.toISOString(),
        end_datetime: end.toISOString()
      };

      if (editingAvailability) {
        await axios.put(`/availabilities/${editingAvailability.id}`, payload);
        toast.success('Disponibilité mise à jour');
      } else {
        await axios.post('/availabilities', payload);
        toast.success('Disponibilité créée');
      }

      setShowAvailabilityDialog(false);
      setEditingAvailability(null);
      resetAvailabilityForm();
      loadAvailabilities();
    } catch (error) {
      console.error('Error saving availability:', error);
      const message = error.response?.data?.detail || 'Erreur lors de la sauvegarde';
      toast.error(message);
    }
  };

  const deleteAvailability = async (id) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette disponibilité ?')) {
      return;
    }

    try {
      await axios.delete(`/availabilities/${id}`);
      toast.success('Disponibilité supprimée');
      loadAvailabilities();
    } catch (error) {
      console.error('Error deleting availability:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const resetAvailabilityForm = () => {
    setAvailabilityForm({
      start_datetime: '',
      end_datetime: '',
      type: 'créneau',
      note: '',
      color: '#3b82f6'
    });
  };

  const handleSelectSlot = ({ start, end }) => {
    setAvailabilityForm({
      start_datetime: moment(start).format('YYYY-MM-DDTHH:mm'),
      end_datetime: moment(end).format('YYYY-MM-DDTHH:mm'),
      type: 'créneau',
      note: '',
      color: '#3b82f6'
    });
    setEditingAvailability(null);
    setShowAvailabilityDialog(true);
  };

  const handleSelectEvent = (event) => {
    const avail = event.resource;
    setAvailabilityForm({
      start_datetime: moment(avail.start_datetime).format('YYYY-MM-DDTHH:mm'),
      end_datetime: moment(avail.end_datetime).format('YYYY-MM-DDTHH:mm'),
      type: avail.type,
      note: avail.note || '',
      color: avail.color || '#3b82f6'
    });
    setEditingAvailability(avail);
    setShowAvailabilityDialog(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-2 rounded-full">
                <Music className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Tableau de bord Artiste
                </h1>
                <p className="text-sm text-gray-600">
                  {profile?.nom_de_scene || user.email}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <User className="h-4 w-4 mr-2" />
                    Profil
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Mon profil</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Nom de scène *</Label>
                      <Input
                        value={profileForm.nom_de_scene}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, nom_de_scene: e.target.value }))}
                        placeholder="Votre nom d'artiste"
                      />
                    </div>
                    <div>
                      <Label>Téléphone</Label>
                      <Input
                        value={profileForm.telephone}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, telephone: e.target.value }))}
                        placeholder="Votre numéro de téléphone"
                      />
                    </div>
                    <div>
                      <Label>Lien (site web, réseaux sociaux)</Label>
                      <Input
                        value={profileForm.lien}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, lien: e.target.value }))}
                        placeholder="https://..."
                      />
                    </div>
                    <Button onClick={saveProfile} className="w-full">
                      Sauvegarder
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Button
                onClick={onLogout}
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Déconnexion
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Info */}
        {profile && (
          <Card className="mb-8 fade-in">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-4">
                <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-3 rounded-full">
                  <Music className="h-8 w-8 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900">{profile.nom_de_scene}</h2>
                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                    {profile.telephone && (
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 mr-1" />
                        {profile.telephone}
                      </div>
                    )}
                    {profile.lien && (
                      <div className="flex items-center">
                        <LinkIcon className="h-4 w-4 mr-1" />
                        <a href={profile.lien} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          Lien
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Calendar */}
        <Card className="fade-in">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Mes disponibilités
              </CardTitle>
              <Dialog open={showAvailabilityDialog} onOpenChange={setShowAvailabilityDialog}>
                <DialogTrigger asChild>
                  <Button onClick={() => { resetAvailabilityForm(); setEditingAvailability(null); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingAvailability ? 'Modifier la disponibilité' : 'Nouvelle disponibilité'}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Date et heure de début</Label>
                        <Input
                          type="datetime-local"
                          value={availabilityForm.start_datetime}
                          onChange={(e) => setAvailabilityForm(prev => ({ ...prev, start_datetime: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Date et heure de fin</Label>
                        <Input
                          type="datetime-local"
                          value={availabilityForm.end_datetime}
                          onChange={(e) => setAvailabilityForm(prev => ({ ...prev, end_datetime: e.target.value }))}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label>Type</Label>
                      <Select value={availabilityForm.type} onValueChange={(value) => setAvailabilityForm(prev => ({ ...prev, type: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="créneau">Créneau horaire</SelectItem>
                          <SelectItem value="journée_entière">Journée entière</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Note (optionnelle)</Label>
                      <Textarea
                        value={availabilityForm.note}
                        onChange={(e) => setAvailabilityForm(prev => ({ ...prev, note: e.target.value }))}
                        placeholder="Description, lieu, etc."
                        maxLength={280}
                      />
                    </div>

                    <div className="flex justify-between">
                      {editingAvailability && (
                        <Button
                          variant="destructive"
                          onClick={() => deleteAvailability(editingAvailability.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Supprimer
                        </Button>
                      )}
                      <div className="flex space-x-2 ml-auto">
                        <Button
                          variant="outline"
                          onClick={() => setShowAvailabilityDialog(false)}
                        >
                          Annuler
                        </Button>
                        <Button onClick={saveAvailability}>
                          {editingAvailability ? 'Modifier' : 'Créer'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div style={{ height: '600px' }}>
              <BigCalendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                onSelectSlot={handleSelectSlot}
                onSelectEvent={handleSelectEvent}
                selectable
                views={['month', 'week', 'day']}
                messages={{
                  next: 'Suivant',
                  previous: 'Précédent',
                  today: "Aujourd'hui",
                  month: 'Mois',
                  week: 'Semaine',
                  day: 'Jour',
                  agenda: 'Agenda',
                  date: 'Date',
                  time: 'Heure',
                  event: 'Événement',
                  noEventsInRange: 'Aucune disponibilité dans cette période'
                }}
                culture="fr"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ArtistDashboard;