import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Calendar, 
  Users, 
  Mail, 
  Plus, 
  Filter, 
  Download, 
  LogOut, 
  Shield,
  Clock,
  Music,
  Phone,
  Link as LinkIcon
} from 'lucide-react';
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/fr';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import axios from 'axios';
import { toast } from 'sonner';

// Configure moment for French locale
moment.locale('fr');
const localizer = momentLocalizer(moment);

const AdminDashboard = ({ user, onLogout }) => {
  const [artists, setArtists] = useState([]);
  const [availabilities, setAvailabilities] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [filteredArtists, setFilteredArtists] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await Promise.all([
        loadArtists(),
        loadAvailabilities(),
        loadInvitations()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadArtists = async () => {
    try {
      const response = await axios.get('/artists');
      setArtists(response.data);
    } catch (error) {
      console.error('Error loading artists:', error);
      toast.error('Erreur lors du chargement des artistes');
    }
  };

  const loadAvailabilities = async () => {
    try {
      const response = await axios.get('/availabilities');
      setAvailabilities(response.data);
      
      // Convert to calendar events with artist info
      const calendarEvents = [];
      
      for (const avail of response.data) {
        // Find artist info
        const artist = artists.find(a => a.id === avail.artist_id);
        const artistName = artist?.nom_de_scene || 'Artiste inconnu';
        
        calendarEvents.push({
          id: avail.id,
          title: `Disponible — ${artistName}`,
          start: new Date(avail.start_datetime),
          end: new Date(avail.end_datetime),
          resource: {
            ...avail,
            artist_name: artistName,
            artist: artist
          },
          allDay: avail.type === 'journée_entière'
        });
      }
      
      setEvents(calendarEvents);
    } catch (error) {
      console.error('Error loading availabilities:', error);
      toast.error('Erreur lors du chargement des disponibilités');
    }
  };

  const loadInvitations = async () => {
    try {
      const response = await axios.get('/invitations');
      setInvitations(response.data);
    } catch (error) {
      console.error('Error loading invitations:', error);
    }
  };

  const sendInvitation = async () => {
    try {
      await axios.post('/invitations', { email: inviteEmail });
      toast.success('Invitation envoyée avec succès');
      setShowInviteDialog(false);
      setInviteEmail('');
      loadInvitations();
    } catch (error) {
      console.error('Error sending invitation:', error);
      const message = error.response?.data?.detail || 'Erreur lors de l\'envoi de l\'invitation';
      toast.error(message);
    }
  };

  const getAvailableArtistsForDate = (date) => {
    const startOfDay = moment(date).startOf('day');
    const endOfDay = moment(date).endOf('day');
    
    const availableArtists = [];
    
    for (const avail of availabilities) {
      const availStart = moment(avail.start_datetime);
      const availEnd = moment(avail.end_datetime);
      
      // Check if availability overlaps with selected date
      if (availStart.isSameOrBefore(endOfDay) && availEnd.isSameOrAfter(startOfDay)) {
        const artist = artists.find(a => a.id === avail.artist_id);
        if (artist && !availableArtists.find(a => a.id === artist.id)) {
          availableArtists.push({
            ...artist,
            availability: avail
          });
        }
      }
    }
    
    return availableArtists.sort((a, b) => a.nom_de_scene.localeCompare(b.nom_de_scene));
  };

  const handleSelectSlot = ({ start }) => {
    setSelectedDate(start);
    const available = getAvailableArtistsForDate(start);
    setFilteredArtists(available);
  };

  const getStatusBadge = (status) => {
    const styles = {
      'envoyée': 'bg-yellow-100 text-yellow-800',
      'acceptée': 'bg-green-100 text-green-800',
      'expirée': 'bg-red-100 text-red-800'
    };
    
    return (
      <Badge className={`${styles[status] || 'bg-gray-100 text-gray-800'} status-badge`}>
        {status}
      </Badge>
    );
  };

  const exportToCSV = () => {
    const csvData = availabilities.map(avail => {
      const artist = artists.find(a => a.id === avail.artist_id);
      return {
        'Artiste': artist?.nom_de_scene || 'Inconnu',
        'Email': artist?.email || '',
        'Début': moment(avail.start_datetime).format('DD/MM/YYYY HH:mm'),
        'Fin': moment(avail.end_datetime).format('DD/MM/YYYY HH:mm'),
        'Type': avail.type,
        'Note': avail.note || ''
      };
    });

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).map(value => `"${value}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `disponibilites_${moment().format('YYYY-MM-DD')}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-2 rounded-full">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Administration
                </h1>
                <p className="text-sm text-gray-600">
                  Gestion du calendrier des disponibilités
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button
                onClick={exportToCSV}
                variant="outline"
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              
              <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Inviter
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Inviter un artiste</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Adresse email</Label>
                      <Input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="artiste@email.com"
                      />
                    </div>
                    <Button onClick={sendInvitation} className="w-full" disabled={!inviteEmail}>
                      Envoyer l'invitation
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
        <Tabs defaultValue="calendar" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="calendar">Calendrier</TabsTrigger>
            <TabsTrigger value="artists">Artistes</TabsTrigger>
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
          </TabsList>

          {/* Calendar Tab */}
          <TabsContent value="calendar" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Calendar */}
              <div className="lg:col-span-2">
                <Card className="fade-in">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Calendar className="h-5 w-5 mr-2" />
                      Calendrier agrégé
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div style={{ height: '600px' }}>
                      <BigCalendar
                        localizer={localizer}
                        events={events}
                        startAccessor="start"
                        endAccessor="end"
                        onSelectSlot={handleSelectSlot}
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

              {/* Available Artists for Selected Date */}
              <div>
                <Card className="fade-in">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Users className="h-5 w-5 mr-2" />
                      Artistes disponibles
                    </CardTitle>
                    {selectedDate && (
                      <p className="text-sm text-gray-600">
                        {moment(selectedDate).format('dddd DD MMMM YYYY')}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    {selectedDate ? (
                      <div className="space-y-3">
                        {filteredArtists.length > 0 ? (
                          filteredArtists.map((artist) => (
                            <div key={artist.id} className="p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center space-x-2">
                                <Music className="h-4 w-4 text-purple-600" />
                                <h4 className="font-medium">{artist.nom_de_scene}</h4>
                              </div>
                              <p className="text-sm text-gray-600 mt-1">{artist.email}</p>
                              {artist.availability?.note && (
                                <p className="text-sm text-blue-600 mt-1">
                                  {artist.availability.note}
                                </p>
                              )}
                              <div className="flex items-center space-x-2 mt-2 text-xs text-gray-500">
                                <Clock className="h-3 w-3" />
                                <span>
                                  {moment(artist.availability.start_datetime).format('HH:mm')} - 
                                  {moment(artist.availability.end_datetime).format('HH:mm')}
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-gray-500 text-center py-4">
                            Aucun artiste disponible ce jour
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">
                        Cliquez sur une date pour voir les artistes disponibles
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Artists Tab */}
          <TabsContent value="artists" className="space-y-6">
            <Card className="fade-in">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Artistes inscrits ({artists.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {artists.map((artist) => (
                    <Card key={artist.id} className="card-hover">
                      <CardContent className="pt-6">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-2 rounded-full">
                            <Music className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{artist.nom_de_scene || 'Profil incomplet'}</h3>
                            <p className="text-sm text-gray-600">{artist.email}</p>
                          </div>
                        </div>
                        
                        {artist.telephone && (
                          <div className="flex items-center text-sm text-gray-600 mb-1">
                            <Phone className="h-4 w-4 mr-2" />
                            {artist.telephone}
                          </div>
                        )}
                        
                        {artist.lien && (
                          <div className="flex items-center text-sm text-gray-600">
                            <LinkIcon className="h-4 w-4 mr-2" />
                            <a 
                              href={artist.lien} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline truncate"
                            >
                              Lien
                            </a>
                          </div>
                        )}
                        
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs text-gray-500">
                            {availabilities.filter(a => a.artist_id === artist.id).length} disponibilités
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invitations Tab */}
          <TabsContent value="invitations" className="space-y-6">
            <Card className="fade-in">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Mail className="h-5 w-5 mr-2" />
                  Invitations ({invitations.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {invitations.map((invitation) => (
                    <div key={invitation.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <p className="font-medium">{invitation.email}</p>
                        <p className="text-sm text-gray-600">
                          Créée le {moment(invitation.created_at).format('DD/MM/YYYY à HH:mm')}
                        </p>
                        <p className="text-sm text-gray-600">
                          Expire le {moment(invitation.expires_at).format('DD/MM/YYYY à HH:mm')}
                        </p>
                      </div>
                      <div>
                        {getStatusBadge(invitation.status)}
                      </div>
                    </div>
                  ))}
                  
                  {invitations.length === 0 && (
                    <p className="text-gray-500 text-center py-8">
                      Aucune invitation envoyée
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;