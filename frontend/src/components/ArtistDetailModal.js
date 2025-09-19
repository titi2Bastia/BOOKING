import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { 
  User, 
  DollarSign, 
  Phone, 
  Link as LinkIcon, 
  FileText, 
  Calendar,
  Mail,
  Image as ImageIcon,
  X
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const ArtistDetailModal = ({ artistId, isOpen, onClose }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

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
    } catch (error) {
      console.error('Error loading artist profile:', error);
      toast.error('Erreur lors du chargement du profil artiste');
    } finally {
      setLoading(false);
    }
  };

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <User className="h-5 w-5 mr-2" />
              Fiche Artiste Détaillée
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