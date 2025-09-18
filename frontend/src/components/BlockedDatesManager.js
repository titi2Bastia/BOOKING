import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { 
  Ban, 
  Plus, 
  Edit, 
  Trash2, 
  Calendar,
  AlertTriangle
} from 'lucide-react';
import moment from 'moment';
import axios from 'axios';
import { toast } from 'sonner';

const BlockedDatesManager = ({ onBlockedDatesChange }) => {
  const [blockedDates, setBlockedDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingBlocked, setEditingBlocked] = useState(null);
  const [formData, setFormData] = useState({
    date: '',
    note: ''
  });

  useEffect(() => {
    loadBlockedDates();
  }, []);

  const loadBlockedDates = async () => {
    setLoading(true);
    try {
      // Load blocked dates for current year and next year
      const startDate = moment().startOf('year').format('YYYY-MM-DD');
      const endDate = moment().add(2, 'years').endOf('year').format('YYYY-MM-DD');
      
      const response = await axios.get(`/blocked-dates?start_date=${startDate}&end_date=${endDate}`);
      setBlockedDates(response.data);
      
      // Notify parent component of changes
      if (onBlockedDatesChange) {
        onBlockedDatesChange(response.data);
      }
    } catch (error) {
      console.error('Error loading blocked dates:', error);
      toast.error('Erreur lors du chargement des dates bloquées');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.date) {
      toast.error('La date est obligatoire');
      return;
    }

    // Validate date is not in the past
    const selectedDate = moment(formData.date);
    if (selectedDate.isBefore(moment(), 'day')) {
      toast.error('Impossible de bloquer une date passée');
      return;
    }

    try {
      if (editingBlocked) {
        // Update existing blocked date
        await axios.put(`/blocked-dates/${editingBlocked.id}`, formData);
        toast.success('Date bloquée modifiée');
      } else {
        // Create new blocked date
        await axios.post('/blocked-dates', formData);
        toast.success('Date bloquée ajoutée');
      }

      setShowDialog(false);
      setEditingBlocked(null);
      resetForm();
      loadBlockedDates();
    } catch (error) {
      console.error('Error saving blocked date:', error);
      const message = error.response?.data?.detail || 'Erreur lors de la sauvegarde';
      toast.error(message);
    }
  };

  const handleEdit = (blocked) => {
    setEditingBlocked(blocked);
    setFormData({
      date: blocked.date,
      note: blocked.note || ''
    });
    setShowDialog(true);
  };

  const handleDelete = async (blockedId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir débloquer cette date ?')) {
      return;
    }

    try {
      await axios.delete(`/blocked-dates/${blockedId}`);
      toast.success('Date débloquée');
      loadBlockedDates();
    } catch (error) {
      console.error('Error deleting blocked date:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const resetForm = () => {
    setFormData({
      date: '',
      note: ''
    });
  };

  const handleNewBlocked = () => {
    setEditingBlocked(null);
    resetForm();
    setShowDialog(true);
  };

  const getTodayDate = () => {
    return moment().format('YYYY-MM-DD');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-4">
            <div className="spinner"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center">
            <Ban className="h-5 w-5 mr-2 text-red-600" />
            Dates bloquées ({blockedDates.length})
          </CardTitle>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={handleNewBlocked} className="bg-red-600 hover:bg-red-700">
                <Plus className="h-4 w-4 mr-2" />
                Bloquer une date
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingBlocked ? 'Modifier la date bloquée' : 'Bloquer une nouvelle date'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    min={getTodayDate()}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Seules les dates futures peuvent être bloquées
                  </p>
                </div>

                <div>
                  <Label htmlFor="note">Raison du blocage (optionnelle)</Label>
                  <Textarea
                    id="note"
                    value={formData.note}
                    onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                    placeholder="Ex: Maintenance, congés, événement spécial..."
                    maxLength={280}
                    rows={3}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.note.length}/280 caractères
                  </p>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-orange-900">Attention</h4>
                      <p className="text-sm text-orange-800 mt-1">
                        Bloquer cette date supprimera automatiquement toutes les disponibilités 
                        des artistes pour ce jour.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  {editingBlocked && (
                    <Button
                      variant="destructive"
                      onClick={() => handleDelete(editingBlocked.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Débloquer
                    </Button>
                  )}
                  <div className="flex space-x-2 ml-auto">
                    <Button
                      variant="outline"
                      onClick={() => setShowDialog(false)}
                    >
                      Annuler
                    </Button>
                    <Button onClick={handleSave} disabled={!formData.date}>
                      {editingBlocked ? 'Modifier' : 'Bloquer'}
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {blockedDates.length > 0 ? (
          <div className="space-y-3">
            {blockedDates
              .sort((a, b) => moment(a.date).diff(moment(b.date)))
              .map((blocked) => (
                <div key={blocked.id} className="flex items-center justify-between p-4 border border-red-200 bg-red-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Ban className="h-5 w-5 text-red-600" />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-red-900">
                          {moment(blocked.date).format('dddd DD MMMM YYYY')}
                        </span>
                        <Badge variant="destructive" className="text-xs">
                          Bloquée
                        </Badge>
                      </div>
                      {blocked.note && (
                        <p className="text-sm text-red-700 mt-1">{blocked.note}</p>
                      )}
                      <p className="text-xs text-red-600 mt-1">
                        Créée le {moment(blocked.created_at).format('DD/MM/YYYY à HH:mm')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(blocked)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(blocked.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Ban className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune date bloquée</h3>
            <p className="text-gray-600 mb-6">
              Vous pouvez bloquer des dates pour empêcher les artistes d'y ajouter leurs disponibilités.
            </p>
            <Button onClick={handleNewBlocked} className="bg-red-600 hover:bg-red-700">
              <Plus className="h-4 w-4 mr-2" />
              Bloquer la première date
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BlockedDatesManager;