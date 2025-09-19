import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Upload, X, Image, DollarSign, User, Phone, Link as LinkIcon, FileText } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const ArtistProfileForm = ({ profile, onProfileUpdate }) => {
  const [formData, setFormData] = useState({
    nom_de_scene: profile?.nom_de_scene || '',
    telephone: profile?.telephone || '',
    lien: profile?.lien || '',
    tarif_soiree: profile?.tarif_soiree || '',
    bio: profile?.bio || ''
  });

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const logoInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = async () => {
    if (!formData.nom_de_scene.trim()) {
      toast.error('Le nom de scène est obligatoire');
      return;
    }

    setSaving(true);
    try {
      const response = await axios.post('/profile', formData);
      onProfileUpdate(response.data);
      toast.success('Profil mis à jour avec succès');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Erreur lors de la sauvegarde du profil');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image (JPG, PNG)');
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('L\'image ne doit pas dépasser 2MB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post('/profile/upload-logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Update profile with new logo
      const updatedProfile = { ...profile, logo_url: response.data.logo_url };
      onProfileUpdate(updatedProfile);
      toast.success('Logo uploadé avec succès');
    } catch (error) {
      console.error('Error uploading logo:', error);
      const message = error.response?.data?.detail || 'Erreur lors de l\'upload du logo';
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const handleGalleryUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image (JPG, PNG)');
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('L\'image ne doit pas dépasser 2MB');
      return;
    }

    // Check gallery limit
    if (profile?.gallery_urls?.length >= 5) {
      toast.error('Maximum 5 images autorisées dans la galerie');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post('/profile/upload-gallery', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Update profile with new gallery image
      const updatedGallery = [...(profile?.gallery_urls || []), response.data.image_url];
      const updatedProfile = { ...profile, gallery_urls: updatedGallery };
      onProfileUpdate(updatedProfile);
      toast.success('Image ajoutée à la galerie');
    } catch (error) {
      console.error('Error uploading gallery image:', error);
      const message = error.response?.data?.detail || 'Erreur lors de l\'upload de l\'image';
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveGalleryImage = async (index) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette image ?')) {
      return;
    }

    try {
      await axios.delete(`/profile/remove-gallery/${index}`);
      
      // Update profile by removing the image
      const updatedGallery = profile.gallery_urls.filter((_, i) => i !== index);
      const updatedProfile = { ...profile, gallery_urls: updatedGallery };
      onProfileUpdate(updatedProfile);
      toast.success('Image supprimée de la galerie');
    } catch (error) {
      console.error('Error removing gallery image:', error);
      toast.error('Erreur lors de la suppression de l\'image');
    }
  };

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <User className="h-5 w-5 mr-2" />
            Informations principales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="nom_de_scene">Nom de scène / Nom du groupe *</Label>
            <Input
              id="nom_de_scene"
              value={formData.nom_de_scene}
              onChange={(e) => handleInputChange('nom_de_scene', e.target.value)}
              placeholder="Votre nom d'artiste ou de groupe"
              required
            />
          </div>

          <div>
            <Label htmlFor="tarif_soiree">Tarif pour une soirée</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="tarif_soiree"
                value={formData.tarif_soiree}
                onChange={(e) => handleInputChange('tarif_soiree', e.target.value)}
                placeholder="€"
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="telephone">Téléphone</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="telephone"
                value={formData.telephone}
                onChange={(e) => handleInputChange('telephone', e.target.value)}
                placeholder="Votre numéro de téléphone"
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="lien">Site web ou réseaux sociaux</Label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="lien"
                value={formData.lien}
                onChange={(e) => handleInputChange('lien', e.target.value)}
                placeholder="https://..."
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="bio">Description / Bio courte</Label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                placeholder="Décrivez votre style musical, votre expérience..."
                maxLength={500}
                rows={4}
                className="pl-10 resize-none"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {formData.bio.length}/500 caractères
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Logo Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Image className="h-5 w-5 mr-2" />
            Logo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {profile?.logo_url ? (
              <div className="flex items-center space-x-4">
                <img
                  src={profile.logo_url?.startsWith('http') ? profile.logo_url : `${BACKEND_URL}/${profile.logo_url}`}
                  alt="Logo"
                  className="w-20 h-20 object-cover rounded-lg border"
                />
                <div>
                  <p className="text-sm text-gray-600 mb-2">Logo actuel</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? 'Upload...' : 'Changer le logo'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Image className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">Aucun logo uploadé</p>
                <Button
                  variant="outline"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? 'Upload...' : 'Uploader un logo'}
                </Button>
              </div>
            )}
            
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
            
            <p className="text-xs text-gray-500">
              JPG, PNG - Maximum 2MB
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Gallery Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Image className="h-5 w-5 mr-2" />
              Galerie photos ({profile?.gallery_urls?.length || 0}/5)
            </div>
            {(profile?.gallery_urls?.length || 0) < 5 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => galleryInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Upload...' : 'Ajouter'}
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {profile?.gallery_urls?.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {profile.gallery_urls.map((imageUrl, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={imageUrl?.startsWith('http') ? imageUrl : `${BACKEND_URL}/${imageUrl}`}
                      alt={`Galerie ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                    <button
                      onClick={() => handleRemoveGalleryImage(index)}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Image className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">Aucune photo dans la galerie</p>
                <Button
                  variant="outline"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? 'Upload...' : 'Ajouter des photos'}
                </Button>
              </div>
            )}
            
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handleGalleryUpload}
              className="hidden"
            />
            
            <p className="text-xs text-gray-500">
              JPG, PNG - Maximum 2MB chacune - Maximum 5 photos
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSaveProfile}
          disabled={saving || !formData.nom_de_scene.trim()}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
        >
          {saving ? 'Sauvegarde...' : 'Sauvegarder le profil'}
        </Button>
      </div>
    </div>
  );
};

export default ArtistProfileForm;