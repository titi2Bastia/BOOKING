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
  Music,
  Phone,
  Link as LinkIcon,
  Info,
  Eye,
  DollarSign,
  Image as ImageIcon,
  Ban,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  RefreshCw
} from 'lucide-react';
import moment from 'moment';
import 'moment/locale/fr';
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '../calendar-colors.css';
import axios from 'axios';
import { toast } from 'sonner';
import ArtistDetailModal from '../components/ArtistDetailModal';
import BlockedDatesManager from '../components/BlockedDatesManager';

// Configure moment for French locale
moment.locale('fr');
const localizer = momentLocalizer(moment);

const AdminDashboard = ({ user, onLogout }) => {
  const [artists, setArtists] = useState([]);
  const [availabilityDays, setAvailabilityDays] = useState([]);
  const [blockedDates, setBlockedDates] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [availableArtists, setAvailableArtists] = useState([]);
  const [selectedArtistId, setSelectedArtistId] = useState(null);
  const [showArtistDetail, setShowArtistDetail] = useState(false);
  const [invitationLink, setInvitationLink] = useState(null);
  const [showInvitationLink, setShowInvitationLink] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedEventForCategory, setSelectedEventForCategory] = useState(null);
  const [artistSearchFilter, setArtistSearchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load base data in parallel
      await Promise.all([
        loadArtists(),
        loadInvitations()
      ]);
      
      // Load calendar data sequentially to ensure proper updating
      const availabilityData = await loadAvailabilityDays();
      const blockedData = await loadBlockedDates();
      
      // Final update with both datasets
      updateCalendarEvents(availabilityData, blockedData);
      
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

  const loadAvailabilityDays = async () => {
    try {
      // Load availability days for extended period (2 years back and 3 years forward)
      const startDate = moment().subtract(1, 'years').startOf('year').format('YYYY-MM-DD');
      const endDate = moment().add(3, 'years').endOf('year').format('YYYY-MM-DD');
      
      // Add cache busting parameter to force refresh
      const timestamp = Date.now();
      const response = await axios.get(`/availability-days?start_date=${startDate}&end_date=${endDate}&_t=${timestamp}`);
      const newAvailabilityDays = response.data;
      setAvailabilityDays(newAvailabilityDays);
      
      // Update calendar with current blocked dates and new availability data
      updateCalendarEvents(newAvailabilityDays, blockedDates);
      return newAvailabilityDays;
    } catch (error) {
      console.error('Error loading availability days:', error);
      toast.error('Erreur lors du chargement des disponibilités');
      return [];
    }
  };

  const loadBlockedDates = async () => {
    try {
      // Load blocked dates for extended period (2 years back and 3 years forward)
      const startDate = moment().subtract(1, 'years').startOf('year').format('YYYY-MM-DD');
      const endDate = moment().add(3, 'years').endOf('year').format('YYYY-MM-DD');
      
      const response = await axios.get(`/blocked-dates?start_date=${startDate}&end_date=${endDate}`);
      const newBlockedDates = response.data;
      setBlockedDates(newBlockedDates);
      
      // Update calendar with current availability data and new blocked dates
      updateCalendarEvents(availabilityDays, newBlockedDates);
      return newBlockedDates;
    } catch (error) {
      console.error('Error loading blocked dates:', error);
      toast.error('Erreur lors du chargement des dates bloquées');
      return [];
    }
  };

  const updateCalendarEvents = (availabilities, blocked) => {
    const calendarEvents = [];
    
    // Add availability events
    availabilities.forEach(day => {
      calendarEvents.push({
        id: `avail-${day.id}`,
        title: day.artist_name || 'Artiste inconnu',
        start: new Date(`${day.date}T00:00:00`),
        end: new Date(`${day.date}T23:59:59`),
        allDay: true,
        resource: {
          ...day,
          type: 'availability',
          artist_name: day.artist_name || 'Artiste inconnu',
          artist_category: day.artist_category
        }
      });
    });
    
    // Add blocked date events
    blocked.forEach(blockedDate => {
      calendarEvents.push({
        id: `blocked-${blockedDate.id}`,
        title: `🚫 Date bloquée ${blockedDate.note ? `(${blockedDate.note})` : ''}`,
        start: new Date(`${blockedDate.date}T00:00:00`),
        end: new Date(`${blockedDate.date}T23:59:59`),
        allDay: true,
        resource: {
          ...blockedDate,
          type: 'blocked'
        }
      });
    });
    
    setEvents(calendarEvents);
    
    // Force DOM color override after render
    setTimeout(() => {
      applyEventColors(availabilities, blocked);
    }, 100);
  };

  const applyEventColors = (availabilities, blocked) => {
    try {
      // Force apply colors to calendar events via DOM manipulation as backup
      const eventElements = document.querySelectorAll('.rbc-event');
      
      eventElements.forEach(element => {
        const eventText = (element.textContent || '').trim();
        
        // Apply colors based on text content
        if (eventText.includes('🚫')) {
          // Blocked dates - RED
          element.style.setProperty('background', 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)', 'important');
          element.style.setProperty('border-color', '#b91c1c', 'important');
          element.style.setProperty('color', 'white', 'important');
        } else {
          // Find matching availability by artist name
          const matchingAvailability = availabilities.find(avail => {
            const artistName = (avail.artist_name || '').trim().toLowerCase();
            const eventName = eventText.toLowerCase();
            return artistName === eventName || eventName.includes(artistName) || artistName.includes(eventName);
          });
          
          if (matchingAvailability) {
            if (matchingAvailability.artist_category === 'DJ') {
              // DJ - BLUE
              element.style.setProperty('background', 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 'important');
              element.style.setProperty('border-color', '#2563eb', 'important');
              element.style.setProperty('color', 'white', 'important');
            } else if (matchingAvailability.artist_category === 'Groupe') {
              // Groupe - GREEN
              element.style.setProperty('background', 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 'important');
              element.style.setProperty('border-color', '#059669', 'important');
              element.style.setProperty('color', 'white', 'important');
            } else {
              // Uncategorized - GRAY
              element.style.setProperty('background', 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)', 'important');
              element.style.setProperty('border-color', '#4b5563', 'important');
              element.style.setProperty('color', 'white', 'important');
            }
          } else {
            // Default gray for unmatched events
            element.style.setProperty('background', 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)', 'important');
            element.style.setProperty('border-color', '#4b5563', 'important');
            element.style.setProperty('color', 'white', 'important');
          }
        }
      });
    } catch (error) {
      console.error('Error applying event colors:', error);
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

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Lien copié dans le presse-papiers !');
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Erreur lors de la copie');
    }
  };

  const deleteInvitation = async (invitationId) => {
    try {
      await axios.delete(`/invitations/${invitationId}`);
      toast.success('Invitation supprimée avec succès');
      loadInvitations();
    } catch (error) {
      console.error('Error deleting invitation:', error);
      const message = error.response?.data?.detail || 'Erreur lors de la suppression';
      toast.error(message);
    }
  };

  const deleteArtist = async (artistId, artistName) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'artiste "${artistName}" ?\n\nCela supprimera :\n- Son profil complet\n- Toutes ses disponibilités\n- Son compte utilisateur\n\nCette action est irréversible.`)) {
      return;
    }

    try {
      const response = await axios.delete(`/artists/${artistId}`);
      toast.success(`Artiste "${artistName}" supprimé avec succès`);
      
      // Show details of what was deleted
      const { deleted_availabilities } = response.data;
      if (deleted_availabilities > 0) {
        toast.success(`${deleted_availabilities} disponibilité(s) supprimée(s)`);
      }
      
      // Reload data
      loadArtists();
      loadAvailabilityDays();
    } catch (error) {
      console.error('Error deleting artist:', error);
      const message = error.response?.data?.detail || 'Erreur lors de la suppression de l\'artiste';
      toast.error(message);
    }
  };

  const sendInvitation = async () => {
    try {
      const response = await axios.post('/invitations', { email: inviteEmail });
      
      // Get the invitation token from the response
      const invitationToken = response.data.token;
      const frontendUrl = process.env.REACT_APP_BACKEND_URL || 'https://gig-calendar-1.preview.emergentagent.com';
      const fullInvitationLink = `${frontendUrl}/invite/${invitationToken}`;
      
      setInvitationLink({
        email: inviteEmail,
        link: fullInvitationLink,
        token: invitationToken
      });
      
      toast.success('Invitation créée avec succès');
      setShowInviteDialog(false);
      setShowInvitationLink(true);
      setInviteEmail('');
      loadInvitations();
    } catch (error) {
      console.error('Error sending invitation:', error);
      const message = error.response?.data?.detail || 'Erreur lors de l\'envoi de l\'invitation';
      toast.error(message);
    }
  };

  const loadAvailableArtistsForDate = async (dateStr) => {
    try {
      const response = await axios.get(`/availability-days/${dateStr}`);
      setAvailableArtists(response.data);
    } catch (error) {
      console.error('Error loading available artists:', error);
      setAvailableArtists([]);
    }
  };

  const handleSelectSlot = ({ start }) => {
    const dateStr = moment(start).format('YYYY-MM-DD');
    setSelectedDate(start);
    loadAvailableArtistsForDate(dateStr);
  };

  const handleViewArtistDetail = (artistId) => {
    setSelectedArtistId(artistId);
    setShowArtistDetail(true);
  };

  const handleBlockedDatesChange = (newBlockedDates) => {
    setBlockedDates(newBlockedDates);
    updateCalendarEvents(availabilityDays, newBlockedDates);
  };

  const quickChangeCategory = async (artistId, newCategory, artistName) => {
    try {
      await axios.patch(`/artists/${artistId}/category`, {
        category: newCategory
      });
      
      toast.success(`${artistName} → ${newCategory}`);
      
      // Close modal first
      setShowCategoryModal(false);
      setSelectedEventForCategory(null);
      
      // Force complete data reload to ensure colors update
      setTimeout(async () => {
        const freshAvailabilityData = await loadAvailabilityDays();
        const freshBlockedData = await loadBlockedDates();
        updateCalendarEvents(freshAvailabilityData, freshBlockedData);
      }, 100);
      
    } catch (error) {
      console.error('Error updating category:', error);
      const message = error.response?.data?.detail || 'Erreur lors de la mise à jour';
      toast.error(message);
    }
  };

  const refreshCalendarData = async () => {
    try {
      // Force reload with timestamp to bypass any cache
      const timestamp = Date.now();
      
      const availabilityData = await loadAvailabilityDays();
      const blockedData = await loadBlockedDates();
      updateCalendarEvents(availabilityData, blockedData);
      
      // Force a second refresh after short delay to ensure fresh data
      setTimeout(async () => {
        try {
          const freshAvailabilityData = await loadAvailabilityDays();
          const freshBlockedData = await loadBlockedDates();
          updateCalendarEvents(freshAvailabilityData, freshBlockedData);
        } catch (error) {
          console.error('Error in delayed refresh:', error);
        }
      }, 500);
      
    } catch (error) {
      console.error('Error refreshing calendar data:', error);
    }
  };

  const handleNavigate = (newDate) => {
    setCurrentDate(newDate);
    // Refresh data when navigating to ensure all events are visible
    if (Math.abs(moment(newDate).diff(moment(), 'months')) > 1) {
      refreshCalendarData();
    }
  };

  const handleSelectEvent = (event) => {
    // Handle clicks on availability events for quick category change
    if (event.resource?.type === 'availability' && event.resource?.artist_id) {
      // Open quick category change modal instead of artist detail
      setSelectedEventForCategory(event.resource);
      setShowCategoryModal(true);
    }
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

  const exportToCSV = async () => {
    try {
      const startDate = moment().startOf('year').format('YYYY-MM-DD');
      const endDate = moment().add(1, 'year').endOf('year').format('YYYY-MM-DD');
      
      const response = await axios.get(`/export/csv?start_date=${startDate}&end_date=${endDate}`);
      
      // Create and download CSV file
      const blob = new Blob([response.data.csv_content], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = response.data.filename;
      link.click();
      
      toast.success('Export CSV généré avec succès');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Erreur lors de l\'export CSV');
    }
  };

  const eventStyleGetter = (event) => {
    // Use INLINE STYLES for calendar event colors
    if (event.resource?.type === 'blocked') {
      return {
        style: {
          backgroundColor: '#dc2626',
          borderColor: '#b91c1c',
          color: 'white',
          fontWeight: 'bold'
        }
      };
    }
    
    if (event.resource?.type === 'availability') {
      const category = event.resource?.artist_category;
      
      if (category === 'DJ') {
        return {
          style: {
            backgroundColor: '#3b82f6',
            borderColor: '#2563eb', 
            color: 'white',
            fontWeight: 'bold'
          }
        };
      }
      
      if (category === 'Groupe') {
        return {
          style: {
            backgroundColor: '#10b981',
            borderColor: '#059669',
            color: 'white',
            fontWeight: 'bold'
          }
        };
      }
      
      // Default uncategorized style
      return {
        style: {
          backgroundColor: '#6b7280',
          borderColor: '#4b5563',
          color: 'white',
          fontWeight: 'bold'
        }
      };
    }
    
    return {};
  };

  // Filter and sort artists with category filtering
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  const filteredAndSortedArtists = artists
    .filter(artist => {
      // Search term filter
      const searchTerm = artistSearchFilter.toLowerCase();
      const name = (artist.nom_de_scene || artist.email || '').toLowerCase();
      const email = (artist.email || '').toLowerCase();
      const matchesSearch = name.includes(searchTerm) || email.includes(searchTerm);
      
      // Category filter
      const matchesCategory = categoryFilter === 'all' || 
                             (categoryFilter === 'DJ' && artist.category === 'DJ') ||
                             (categoryFilter === 'Groupe' && artist.category === 'Groupe') ||
                             (categoryFilter === 'uncategorized' && !artist.category);
      
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      const nameA = (a.nom_de_scene || a.email || '').toLowerCase();
      const nameB = (b.nom_de_scene || b.email || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

  // Count artists by category
  const artistCounts = {
    total: artists.length,
    dj: artists.filter(a => a.category === 'DJ').length,
    groupe: artists.filter(a => a.category === 'Groupe').length,
    uncategorized: artists.filter(a => !a.category).length
  };

  // Get category color for artist cards (enhanced)
  const getArtistCategoryColor = (category) => {
    switch(category) {
      case 'DJ': 
        return 'border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 shadow-blue-100';
      case 'Groupe': 
        return 'border-green-500 bg-gradient-to-br from-green-50 to-green-100 shadow-green-100';
      default: 
        return 'border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100';
    }
  };

  const getCategoryBadgeColor = (category) => {
    switch(category) {
      case 'DJ': 
        return 'bg-blue-500 text-white border-blue-600 shadow-lg';
      case 'Groupe': 
        return 'bg-green-500 text-white border-green-600 shadow-lg';
      default: 
        return 'bg-gray-400 text-white border-gray-500';
    }
  };

  const getCategoryIcon = (category) => {
    switch(category) {
      case 'DJ': 
        return '🎧';
      case 'Groupe': 
        return '🎵';
      default: 
        return '🎤';
    }
  };

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

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
                  EasyBookEvent Admin
                </h1>
                <p className="text-sm text-gray-600">
                  Gestion des artistes et disponibilités
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
                  <Button size="sm" className="bg-gradient-to-r from-indigo-600 to-purple-600">
                    <Plus className="h-4 w-4 mr-2" />
                    Inviter un artiste
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
                      <p className="text-xs text-gray-500 mt-1">
                        L'artiste recevra un email avec un lien pour créer son profil complet.
                      </p>
                    </div>
                    <Button onClick={sendInvitation} className="w-full" disabled={!inviteEmail}>
                      Envoyer l'invitation
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Modal pour afficher le lien d'invitation */}
              <Dialog open={showInvitationLink} onOpenChange={setShowInvitationLink}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center">
                      <Mail className="h-5 w-5 mr-2 text-green-600" />
                      Invitation créée avec succès !
                    </DialogTitle>
                  </DialogHeader>
                  {invitationLink && (
                    <div className="space-y-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="text-sm text-green-800 mb-2">
                          <strong>Email destinataire :</strong> {invitationLink.email}
                        </p>
                        <p className="text-sm text-green-800 mb-3">
                          Copiez ce lien et envoyez-le à l'artiste par email, SMS ou chat :
                        </p>
                        
                        <div className="bg-white border border-green-300 rounded p-3 break-all text-sm font-mono">
                          {invitationLink.link}
                        </div>
                        
                        <div className="flex space-x-2 mt-3">
                          <Button
                            onClick={() => copyToClipboard(invitationLink.link)}
                            size="sm"
                            className="flex-1 bg-green-600 hover:bg-green-700"
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Copier le lien
                          </Button>
                          <Button
                            onClick={() => window.open(invitationLink.link, '_blank')}
                            size="sm"
                            variant="outline"
                            className="flex-1"
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Tester le lien
                          </Button>
                        </div>
                      </div>
                      
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs text-blue-800">
                          💡 <strong>Conseil :</strong> Ce lien expire dans 7 jours. L'artiste pourra créer son compte et gérer ses disponibilités en journées entières.
                        </p>
                      </div>
                    </div>
                  )}
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="calendar">Calendrier</TabsTrigger>
            <TabsTrigger value="blocked">Dates bloquées</TabsTrigger>
            <TabsTrigger value="artists">Artistes</TabsTrigger>
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
          </TabsList>

          {/* Calendar Tab */}
          <TabsContent value="calendar" className="space-y-6">
            {/* Info Card */}
            <Card className="border-purple-200 bg-purple-50 fade-in">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <Info className="h-5 w-5 text-purple-600 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-purple-900 mb-2">Vue Administrateur</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <ul className="text-sm text-purple-800 space-y-1">
                          <li>• <strong>Calendrier agrégé</strong> de tous les artistes (journées entières)</li>
                          <li>• <strong>Dates bloquées</strong> apparaissent en rouge avec 🚫</li>
                          <li>• <strong>Cliquez sur une date</strong> pour voir qui est disponible ce jour</li>
                          <li>• Export CSV avec disponibilités et dates bloquées</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold text-purple-900 mb-2">Code couleur :</h4>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 bg-blue-500 rounded"></div>
                            <span className="text-sm text-purple-800">DJ</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 bg-emerald-500 rounded"></div>
                            <span className="text-sm text-purple-800">Groupe</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 bg-gray-500 rounded"></div>
                            <span className="text-sm text-purple-800">Non catégorisé</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 bg-red-600 rounded"></div>
                            <span className="text-sm text-purple-800">🚫 Date bloquée</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Calendar */}
              <div className="lg:col-span-2">
                <Card className="fade-in">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Calendar className="h-5 w-5 mr-2" />
                        Calendrier agrégé ({availabilityDays.length} dispos, {blockedDates.length} bloquées)
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-4 text-sm">
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
                            <span>Disponibilités</span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-3 h-3 bg-red-600 rounded mr-2"></div>
                            <span>Dates bloquées</span>
                          </div>
                        </div>
                        <Button
                          variant="outline" 
                          size="sm"
                          onClick={refreshCalendarData}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Actualiser
                        </Button>
                      </div>
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
                        onSelectEvent={handleSelectEvent}
                        eventStyleGetter={eventStyleGetter}
                        selectable
                        views={['month']}
                        view="month"
                        date={currentDate}
                        onNavigate={handleNavigate}
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
                        {/* Check if selected date is blocked */}
                        {blockedDates.some(blocked => blocked.date === moment(selectedDate).format('YYYY-MM-DD')) ? (
                          <div className="text-center py-6">
                            <Ban className="h-12 w-12 text-red-500 mx-auto mb-3" />
                            <h4 className="font-medium text-red-900 mb-2">Date bloquée</h4>
                            <p className="text-red-700 text-sm">
                              Cette date est bloquée par l'administration.
                            </p>
                            {blockedDates.find(blocked => blocked.date === moment(selectedDate).format('YYYY-MM-DD'))?.note && (
                              <p className="text-red-600 text-sm mt-1">
                                {blockedDates.find(blocked => blocked.date === moment(selectedDate).format('YYYY-MM-DD')).note}
                              </p>
                            )}
                          </div>
                        ) : availableArtists.length > 0 ? (
                          availableArtists.map((artist) => (
                            <div key={artist.id} className="p-3 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center space-x-3">
                                  {artist.logo_url ? (
                                    <img
                                      src={artist.logo_url}
                                      alt={artist.nom_de_scene}
                                      className="w-8 h-8 object-cover rounded-full"
                                    />
                                  ) : (
                                    <Music className="h-8 w-8 text-purple-600" />
                                  )}
                                  <div>
                                    <h4 className="font-medium">{artist.nom_de_scene || artist.email}</h4>
                                    <p className="text-sm text-gray-600">{artist.email}</p>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewArtistDetail(artist.id)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                              
                              {artist.tarif_soiree && (
                                <div className="flex items-center mt-2">
                                  <DollarSign className="h-3 w-3 mr-1 text-green-600" />
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                                    {artist.tarif_soiree}
                                  </Badge>
                                </div>
                              )}
                              
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                                  Disponible toute la journée
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

          {/* Blocked Dates Tab */}
          <TabsContent value="blocked" className="space-y-6">
            <BlockedDatesManager onBlockedDatesChange={handleBlockedDatesChange} />
          </TabsContent>

          {/* Artists Tab */}
          <TabsContent value="artists" className="space-y-6">
            <Card className="fade-in">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    Artistes inscrits ({filteredAndSortedArtists.length}/{artists.length})
                  </div>
                </CardTitle>
                
                {/* Enhanced Filters */}
                <div className="mt-4 space-y-4">
                  {/* Category Statistics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-blue-600">🎧 {artistCounts.dj}</div>
                      <div className="text-sm text-blue-800">DJs</div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-green-600">🎵 {artistCounts.groupe}</div>
                      <div className="text-sm text-green-800">Groupes</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-gray-600">🎤 {artistCounts.uncategorized}</div>
                      <div className="text-sm text-gray-800">Non catégorisé</div>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-purple-600">👥 {artistCounts.total}</div>
                      <div className="text-sm text-purple-800">Total</div>
                    </div>
                  </div>
                  
                  {/* Search and Category Filters */}
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Search Filter */}
                    <div className="relative flex-1 max-w-md">
                      <input
                        type="text"
                        placeholder="Rechercher par nom ou email..."
                        value={artistSearchFilter}
                        onChange={(e) => setArtistSearchFilter(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                      <div className="absolute left-3 top-2.5">
                        <Filter className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                    
                    {/* Category Filter Buttons */}
                    <div className="flex gap-2">
                      <Button
                        variant={categoryFilter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCategoryFilter('all')}
                        className={categoryFilter === 'all' ? 'bg-purple-600' : ''}
                      >
                        Tous ({artistCounts.total})
                      </Button>
                      <Button
                        variant={categoryFilter === 'DJ' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCategoryFilter('DJ')}
                        className={categoryFilter === 'DJ' ? 'bg-blue-500 hover:bg-blue-600' : 'border-blue-300 text-blue-700 hover:bg-blue-50'}
                      >
                        🎧 DJs ({artistCounts.dj})
                      </Button>
                      <Button
                        variant={categoryFilter === 'Groupe' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCategoryFilter('Groupe')}
                        className={categoryFilter === 'Groupe' ? 'bg-green-500 hover:bg-green-600' : 'border-green-300 text-green-700 hover:bg-green-50'}
                      >
                        🎵 Groupes ({artistCounts.groupe})
                      </Button>
                      <Button
                        variant={categoryFilter === 'uncategorized' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCategoryFilter('uncategorized')}
                        className={categoryFilter === 'uncategorized' ? 'bg-gray-500 hover:bg-gray-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}
                      >
                        🎤 Non catégorisé ({artistCounts.uncategorized})
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredAndSortedArtists.length > 0 ? (
                  <div className="grid gap-4">
                    {filteredAndSortedArtists.map((artist) => (
                      <div 
                        key={artist.id} 
                        className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all hover:scale-[1.02] hover:shadow-lg ${getArtistCategoryColor(artist.category)}`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center space-x-3">
                            {artist.logo_url ? (
                              <img
                                src={artist.logo_url}
                                alt={artist.nom_de_scene || 'Artiste'}
                                className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-md"
                              />
                            ) : (
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-md ${
                                artist.category === 'DJ' ? 'bg-blue-500' : 
                                artist.category === 'Groupe' ? 'bg-green-500' : 'bg-gray-500'
                              }`}>
                                {getCategoryIcon(artist.category)}
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="flex items-center space-x-3">
                                <h3 className="font-bold text-lg">{artist.nom_de_scene || 'Profil incomplet'}</h3>
                                {artist.category && (
                                  <Badge className={`text-sm font-bold px-3 py-1 ${getCategoryBadgeColor(artist.category)}`}>
                                    {getCategoryIcon(artist.category)} {artist.category}
                                  </Badge>
                                )}
                                {!artist.category && (
                                  <Badge className="text-sm font-bold px-3 py-1 bg-orange-500 text-white border-orange-600 shadow-lg">
                                    🎤 À catégoriser
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mt-1">{artist.email}</p>
                              {artist.tarif_soiree && (
                                <div className="flex items-center mt-2">
                                  <DollarSign className="h-4 w-4 mr-1 text-green-600" />
                                  <span className="text-sm font-semibold text-green-700">{artist.tarif_soiree}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewArtistDetail(artist.id)}
                              className="hover:bg-white/80"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteArtist(artist.id, artist.nom_de_scene || artist.email)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : artistSearchFilter || categoryFilter !== 'all' ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun artiste trouvé</h3>
                    <p className="text-gray-600 mb-6">
                      {artistSearchFilter ? `Aucun résultat pour "${artistSearchFilter}"` : `Aucun artiste dans la catégorie sélectionnée`}
                    </p>
                    <Button 
                      onClick={() => {
                        setArtistSearchFilter('');
                        setCategoryFilter('all');
                      }}
                      variant="outline"
                    >
                      Réinitialiser les filtres
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun artiste inscrit</h3>
                    <p className="text-gray-600 mb-6">
                      Commencez par inviter vos premiers artistes pour qu'ils créent leur profil.
                    </p>
                    <Button 
                      onClick={() => setShowInviteDialog(true)}
                      className="bg-gradient-to-r from-indigo-600 to-purple-600"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Inviter le premier artiste
                    </Button>
                  </div>
                )}
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
                {invitations.length > 0 ? (
                  <div className="space-y-3">
                    {invitations.map((invitation) => (
                      <div key={invitation.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{invitation.email}</p>
                          <p className="text-sm text-gray-600">
                            Créée le {moment(invitation.created_at).format('DD/MM/YYYY à HH:mm')}
                          </p>
                          <p className="text-sm text-gray-600">
                            Expire le {moment(invitation.expires_at).format('DD/MM/YYYY à HH:mm')}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getStatusBadge(invitation.status)}
                          <Button
                            onClick={() => deleteInvitation(invitation.id)}
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune invitation envoyée</h3>
                    <p className="text-gray-600 mb-6">
                      Invitez des artistes pour qu'ils puissent créer leur profil et gérer leurs disponibilités.
                    </p>
                    <Button 
                      onClick={() => setShowInviteDialog(true)}
                      className="bg-gradient-to-r from-indigo-600 to-purple-600"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Envoyer la première invitation
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Artist Detail Modal */}
      <ArtistDetailModal
        artistId={selectedArtistId}
        isOpen={showArtistDetail}
        onClose={() => {
          setShowArtistDetail(false);
          setSelectedArtistId(null);
        }}
        onArtistUpdated={refreshCalendarData}
      />

      {/* Quick Category Change Modal */}
      <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Music className="h-5 w-5 mr-2 text-purple-600" />
              Changer la catégorie
            </DialogTitle>
          </DialogHeader>
          {selectedEventForCategory && (
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-800 mb-2">
                  <strong>Artiste :</strong> {selectedEventForCategory.artist_name}
                </p>
                <p className="text-sm text-gray-800 mb-2">
                  <strong>Date :</strong> {moment(selectedEventForCategory.date).format('dddd DD MMMM YYYY')}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Catégorie actuelle :</strong> {selectedEventForCategory.artist_category || 'Non définie'}
                </p>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900">Nouvelle catégorie :</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => quickChangeCategory(
                      selectedEventForCategory.artist_id,
                      'DJ',
                      selectedEventForCategory.artist_name
                    )}
                    className="bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    DJ
                  </Button>
                  <Button
                    onClick={() => quickChangeCategory(
                      selectedEventForCategory.artist_id,
                      'Groupe',
                      selectedEventForCategory.artist_name
                    )}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white"
                  >
                    Groupe
                  </Button>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCategoryModal(false);
                    setSelectedEventForCategory(null);
                  }}
                >
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;