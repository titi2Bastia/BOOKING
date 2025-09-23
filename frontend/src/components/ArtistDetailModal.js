import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  User, 
  DollarSign, 
  Phone, 
  Link as LinkIcon, 
  FileText, 
  Calendar,
  Mail,
  Image as ImageIcon,
  X,
  Tag,
  Edit,
  Save,
  XCircle
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const ArtistDetailModal = ({ artistId, isOpen, onClose, onArtistUpdated }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [updatingCategory, setUpdatingCategory] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && artistId) {
      loadArtistProfile();
    }
  }, [isOpen, artistId]);

  const loadArtistProfile = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/artists/${artistId}/profile`);
      setProfile(response.data);
      setEditedProfile(response.data); // Initialize edited profile
    } catch (error) {
      console.error('Error loading artist profile:', error);
      toast.error('Erreur lors du chargement du profil artiste');
    } finally {
      setLoading(false);
    }
  };

  const updateCategory = async (newCategory) => {
    setUpdatingCategory(true);
    try {
      await axios.patch(`/artists/${artistId}/category`, {
        category: newCategory
      });
      
      // Update local state
      setProfile(prev => ({
        ...prev,
        category: newCategory
      }));
      
      setEditedProfile(prev => ({
        ...prev,
        category: newCategory
      }));
      
      toast.success(`Catégorie mise à jour : ${newCategory}`);
      
      // Add delay to ensure MongoDB write consistency before refreshing calendar
      setTimeout(() => {
        if (onArtistUpdated) {
          onArtistUpdated();
        }
      }, 300); // 300ms delay for MongoDB consistency
      
    } catch (error) {
      console.error('Error updating category:', error);
      const message = error.response?.data?.detail || 'Erreur lors de la mise à jour';
      toast.error(message);
    } finally {
      setUpdatingCategory(false);
    }
  };

  const handleEditStart = () => {
    setIsEditing(true);
    setEditedProfile({ ...profile });
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditedProfile({ ...profile });
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      // Use the existing update profile endpoint
      const updateData = {
        nom_de_scene: editedProfile.nom_de_scene || '',
        telephone: editedProfile.telephone || '',
        lien: editedProfile.lien || '',
        tarif_soiree: editedProfile.tarif_soiree || '',
        bio: editedProfile.bio || ''
      };

      await axios.put(`/artist-profile`, updateData, {
        headers: {
          'artist-id': artistId
        }
      });
      
      // Update category if changed
      if (editedProfile.category !== profile.category) {
        await axios.patch(`/artists/${artistId}/category`, {
          category: editedProfile.category
        });
      }
      
      // Update local state
      setProfile(editedProfile);
      setIsEditing(false);
      
      toast.success('Profil artiste mis à jour avec succès');
      
      // Refresh parent data
      setTimeout(() => {
        if (onArtistUpdated) {
          onArtistUpdated();
        }
      }, 300);
      
    } catch (error) {
      console.error('Error updating profile:', error);
      const message = error.response?.data?.detail || 'Erreur lors de la mise à jour du profil';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (field, value) => {
    setEditedProfile(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getCategoryColor = (category) => {
    switch(category) {
      case 'DJ': return 'bg-blue-100 text-blue-800';
      case 'Groupe': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <User className="h-5 w-5 mr-2" />
                Fiche Artiste Détaillée
                {profile?.category && (
                  <Badge className={`ml-3 ${getCategoryColor(profile.category)}`}>
                    {profile.category === 'DJ' ? '🎧' : '🎵'} {profile.category}
                  </Badge>
                )}
              </div>
              {!isEditing ? (
                <Button
                  onClick={handleEditStart}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Modifier
                </Button>
              ) : (
                <div className="flex space-x-2">
                  <Button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                  </Button>
                  <Button
                    onClick={handleEditCancel}
                    disabled={saving}
                    size="sm"
                    variant="outline"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Annuler
                  </Button>
                </div>
              )}
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="spinner"></div>
            </div>
          ) : profile ? (
            <div className="space-y-6">
              {/* Artist Header */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start space-x-6">
                    {/* Logo */}
                    <div className="flex-shrink-0">
                      {profile.logo_url ? (
                        <img
                          src={profile.logo_url}
                          alt={`Logo ${profile.nom_de_scene}`}
                          className="w-24 h-24 object-cover rounded-lg border shadow-md cursor-pointer hover:opacity-75 transition-opacity"
                          onClick={() => setSelectedImage(profile.logo_url)}
                        />
                      ) : (
                        <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-gray-400" />
                        </div>
                      )}
                    </div>

                    {/* Basic Info */}
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        {profile.nom_de_scene}
                      </h2>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center text-gray-600">
                            <Mail className="h-4 w-4 mr-2" />
                            <span className="text-sm">{profile.user_id}</span>
                          </div>
                          
                          {profile.telephone && (
                            <div className="flex items-center text-gray-600">
                              <Phone className="h-4 w-4 mr-2" />
                              <span className="text-sm">{profile.telephone}</span>
                            </div>
                          )}
                          
                          {profile.lien && (
                            <div className="flex items-center text-gray-600">
                              <LinkIcon className="h-4 w-4 mr-2" />
                              <a 
                                href={profile.lien} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline"
                              >
                                Voir le lien
                              </a>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          {profile.tarif_soiree && (
                            <div className="flex items-center">
                              <DollarSign className="h-4 w-4 mr-2 text-green-600" />
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                {profile.tarif_soiree}
                              </Badge>
                            </div>
                          )}
                          
                          {/* Category Section */}
                          <div className="flex items-center space-x-2">
                            <Tag className="h-4 w-4 mr-2 text-purple-600" />
                            <span className="text-sm text-gray-600 mr-2">Catégorie :</span>
                            <Select 
                              value={profile.category || ''} 
                              onValueChange={updateCategory}
                              disabled={updatingCategory}
                            >
                              <SelectTrigger className="w-32 h-8">
                                <SelectValue placeholder="Choisir" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="DJ">DJ</SelectItem>
                                <SelectItem value="Groupe">Groupe</SelectItem>
                              </SelectContent>
                            </Select>
                            {profile.category && (
                              <Badge className={getCategoryColor(profile.category)}>
                                {profile.category}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center text-gray-600">
                            <Calendar className="h-4 w-4 mr-2" />
                            <span className="text-sm">
                              Profil créé le {new Date(profile.created_at).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Bio */}
              {profile.bio && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start space-x-3">
                      <FileText className="h-5 w-5 text-gray-600 mt-0.5" />
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-2">Description / Bio</h3>
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {profile.bio}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Gallery */}
              {profile.gallery_urls && profile.gallery_urls.length > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center space-x-3 mb-4">
                      <ImageIcon className="h-5 w-5 text-gray-600" />
                      <h3 className="font-semibold text-gray-900">
                        Galerie photos ({profile.gallery_urls.length})
                      </h3>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {profile.gallery_urls.map((imageUrl, index) => (
                        <img
                          key={index}
                          src={imageUrl}
                          alt={`Galerie ${profile.nom_de_scene} ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg border shadow-sm cursor-pointer hover:opacity-75 transition-opacity"
                          onClick={() => setSelectedImage(imageUrl)}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button variant="outline" onClick={onClose}>
                  Fermer
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">Aucun profil trouvé pour cet artiste</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Preview Modal */}
      {selectedImage && (
        <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Aperçu de l'image</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedImage(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </DialogTitle>
            </DialogHeader>
            <div className="flex justify-center">
              <img
                src={selectedImage}
                alt="Aperçu"
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default ArtistDetailModal;