import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Calendar, Clock, Music, User, Phone, Link as LinkIcon, Plus, Edit, Trash2, LogOut, Info, Settings } from 'lucide-react';
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/fr';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import axios from 'axios';
import { toast } from 'sonner';
import ArtistProfileForm from '../components/ArtistProfileForm';

// Configure moment for French locale
moment.locale('fr');
const localizer = momentLocalizer(moment);

const ArtistDashboard = ({ user, onLogout }) => {
  const [profile, setProfile] = useState(null);
  const [availabilityDays, setAvailabilityDays] = useState([]);
  const [blockedDates, setBlockedDates] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showDayDialog, setShowDayDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dayNote, setDayNote] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await Promise.all([
        loadProfile(),
        loadAvailabilityDays(),
        loadBlockedDates()
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
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error('Error loading profile:', error);
      }
    }
  };

  const loadAvailabilityDays = async () => {
    try {
      // Load availability days for the current year and next year
      const startDate = moment().startOf('year').format('YYYY-MM-DD');
      const endDate = moment().add(2, 'years').endOf('year').format('YYYY-MM-DD');
      
      const response = await axios.get(`/availability-days?start_date=${startDate}&end_date=${endDate}`);
      setAvailabilityDays(response.data);
      
      updateCalendarEvents(response.data, blockedDates);
    } catch (error) {
      console.error('Error loading availability days:', error);
      toast.error('Erreur lors du chargement des disponibilités');
    }
  };

  const loadBlockedDates = async () => {
    try {
      // Load blocked dates for the same period
      const startDate = moment().startOf('year').format('YYYY-MM-DD');
      const endDate = moment().add(2, 'years').endOf('year').format('YYYY-MM-DD');
      
      const response = await axios.get(`/blocked-dates?start_date=${startDate}&end_date=${endDate}`);
      setBlockedDates(response.data);
      
      updateCalendarEvents(availabilityDays, response.data);
    } catch (error) {
      console.error('Error loading blocked dates:', error);
      // Don't show error toast for blocked dates as it's not critical
    }
  };

  const updateCalendarEvents = (availabilities, blocked) => {
    const calendarEvents = [];
    
    // Add availability events
    availabilities.forEach(day => {
      calendarEvents.push({
        id: day.id,
        title: day.note || 'Disponible',
        start: new Date(`${day.date}T00:00:00`),
        end: new Date(`${day.date}T23:59:59`),
        allDay: true,
        resource: { ...day, type: 'availability' }
      });
    });
    
    // Add blocked date events (for visual display)
    blocked.forEach(blockedDate => {
      calendarEvents.push({
        id: `blocked-${blockedDate.id}`,
        title: `🚫 Bloqué par l'admin`,
        start: new Date(`${blockedDate.date}T00:00:00`),
        end: new Date(`${blockedDate.date}T23:59:59`),
        allDay: true,
        resource: { ...blockedDate, type: 'blocked' }
      });
    });
    
    setEvents(calendarEvents);
  };

  const handleProfileUpdate = (updatedProfile) => {
    setProfile(updatedProfile);
  };

  const toggleAvailabilityDay = async (date, note = '') => {
    try {
      const dateStr = moment(date).format('YYYY-MM-DD');
      
      const response = await axios.post('/availability-days/toggle', {
        date: dateStr,
        note: note.trim(),
        color: '#3b82f6'
      });

      if (response.data.action === 'added') {
        toast.success('Disponibilité ajoutée');
      } else {
        toast.success('Disponibilité supprimée');
      }

      loadAvailabilityDays();
    } catch (error) {
      console.error('Error toggling availability:', error);
      const message = error.response?.data?.detail || 'Erreur lors de la modification';
      toast.error(message);
    }
  };

  const handleDateClick = (date) => {
    const clickedDate = moment(date).format('YYYY-MM-DD');
    const today = moment().format('YYYY-MM-DD');
    
    // Don't allow clicking on past dates
    if (clickedDate < today) {
      toast.error('Impossible de modifier une date passée');
      return;
    }

    // Check if day is already available
    const existingDay = availabilityDays.find(day => day.date === clickedDate);
    
    if (existingDay) {
      // Remove availability
      toggleAvailabilityDay(date);
    } else {
      // Add new availability - show dialog for optional note
      setSelectedDate(date);
      setDayNote('');
      setShowDayDialog(true);
    }
  };

  const handleSelectSlot = ({ start }) => {
    handleDateClick(start);
  };

  const handleSelectEvent = (event) => {
    const eventDate = event.resource.date;
    setSelectedDate(new Date(`${eventDate}T12:00:00`));
    setDayNote(event.resource.note || '');
    setShowDayDialog(true);
  };

  const saveDayAvailability = () => {
    if (selectedDate) {
      toggleAvailabilityDay(selectedDate, dayNote);
      setShowDayDialog(false);
      setSelectedDate(null);
      setDayNote('');
    }
  };

  const removeDayAvailability = () => {
    if (selectedDate) {
      toggleAvailabilityDay(selectedDate);
      setShowDayDialog(false);
      setSelectedDate(null);
      setDayNote('');
    }
  };

  const isDateInPast = (date) => {
    return moment(date).isBefore(moment(), 'day');
  };

  const isDateTooFar = (date) => {
    return moment(date).isAfter(moment().add(18, 'months'), 'day');
  };

  const dayPropGetter = (date) => {
    if (isDateInPast(date)) {
      return {
        className: 'past-date',
        style: {
          backgroundColor: '#f3f4f6',
          color: '#9ca3af',
          cursor: 'not-allowed'
        }
      };
    }
    
    if (isDateTooFar(date)) {
      return {
        className: 'far-date',
        style: {
          backgroundColor: '#fef3c7',
          color: '#92400e',
          cursor: 'not-allowed'
        }
      };
    }

    return {};
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
                  EasyBookEvent
                </h1>
                <p className="text-sm text-gray-600">
                  {profile?.nom_de_scene || user.email} • Journées entières uniquement
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Mon Profil
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Mon profil artiste</DialogTitle>
                  </DialogHeader>
                  <ArtistProfileForm 
                    profile={profile} 
                    onProfileUpdate={handleProfileUpdate}
                  />
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
        <Tabs defaultValue="calendar" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="calendar">Calendrier</TabsTrigger>
            <TabsTrigger value="profile">Mon Profil</TabsTrigger>
          </TabsList>

          {/* Calendar Tab */}
          <TabsContent value="calendar" className="space-y-6">
            {/* Info Card */}
            <Card className="border-blue-200 bg-blue-50 fade-in">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-blue-900 mb-2">Comment ça fonctionne</h3>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• <strong>Cliquez sur un jour</strong> pour basculer votre disponibilité (ON/OFF)</li>
                      <li>• <strong>Journées entières uniquement</strong> - pas de créneaux horaires</li>
                      <li>• <strong>Dates passées :</strong> grisées et non modifiables</li>
                      <li>• <strong>Fenêtre d'édition :</strong> jusqu'à 18 mois dans le futur</li>
                      <li>• Vous pouvez ajouter une note optionnelle à chaque jour</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Calendar */}
            <Card className="fade-in">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center">
                    <Calendar className="h-5 w-5 mr-2" />
                    Calendrier de disponibilités ({availabilityDays.length} jours)
                  </CardTitle>
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
                    views={['month']}
                    view="month"
                    date={currentDate}
                    onNavigate={setCurrentDate}
                    dayPropGetter={dayPropGetter}
                    messages={{
                      next: 'Suivant',
                      previous: 'Précédent',
                      today: "Aujourd'hui",
                      month: 'Mois',
                      date: 'Date',
                      event: 'Événement',
                      noEventsInRange: 'Aucune disponibilité dans cette période'
                    }}
                    culture="fr"
                    popup
                    popupOffset={30}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card className="fade-in">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Mon profil artiste
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ArtistProfileForm 
                  profile={profile} 
                  onProfileUpdate={handleProfileUpdate}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Day Dialog */}
        <Dialog open={showDayDialog} onOpenChange={setShowDayDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Disponibilité du {selectedDate && moment(selectedDate).format('dddd DD MMMM YYYY')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Note optionnelle (280 caractères max)</Label>
                <Textarea
                  value={dayNote}
                  onChange={(e) => setDayNote(e.target.value)}
                  placeholder="Ex: Disponible pour concert, événement privé, etc."
                  maxLength={280}
                  rows={3}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {dayNote.length}/280 caractères
                </p>
              </div>

              <div className="flex justify-between">
                {availabilityDays.find(day => day.date === moment(selectedDate).format('YYYY-MM-DD')) && (
                  <Button
                    variant="destructive"
                    onClick={removeDayAvailability}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer
                  </Button>
                )}
                <div className="flex space-x-2 ml-auto">
                  <Button
                    variant="outline"
                    onClick={() => setShowDayDialog(false)}
                  >
                    Annuler
                  </Button>
                  <Button onClick={saveDayAvailability}>
                    <Plus className="h-4 w-4 mr-2" />
                    Confirmer
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ArtistDashboard;