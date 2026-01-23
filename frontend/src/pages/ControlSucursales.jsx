import React, { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Search,
  Building2,
  Camera,
  Volume2,
  MapPin,
  Server,
  Pencil,
  Trash2,
  X,
  Save,
  Monitor,
  Cable,
  Hash,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ControlSucursales = ({ token, userRole }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedSucursal, setSelectedSucursal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editData, setEditData] = useState({});

  const isAdmin = userRole === "admin";

  const axiosAuth = axios.create({
    headers: { Authorization: `Bearer ${token}` },
  });

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast.error("Ingrese un término de búsqueda");
      return;
    }

    setLoading(true);
    try {
      const response = await axiosAuth.get(`${API}/search?sucursal=${encodeURIComponent(searchTerm)}`);
      setSearchResults(response.data);
      setSelectedSucursal(null);
      if (response.data.length === 0) {
        toast.info("No se encontraron sucursales");
      } else {
        toast.success(`Se encontraron ${response.data.length} sucursal(es)`);
      }
    } catch (error) {
      console.error("Error searching:", error);
      toast.error("Error en la búsqueda");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSucursal = (sucursal) => {
    setSelectedSucursal(sucursal);
  };

  const openEditDialog = () => {
    if (selectedSucursal) {
      setEditData({ ...selectedSucursal });
      setShowEditDialog(true);
    }
  };

  const handleUpdate = async () => {
    try {
      const response = await axiosAuth.put(`${API}/sucursal/${selectedSucursal.id}`, editData);
      toast.success("Sucursal actualizada correctamente");
      setSelectedSucursal(response.data);
      setSearchResults(searchResults.map(s => s.id === response.data.id ? response.data : s));
      setShowEditDialog(false);
    } catch (error) {
      const message = error.response?.data?.detail || "Error al actualizar";
      toast.error(message);
    }
  };

  const handleDelete = async () => {
    try {
      await axiosAuth.delete(`${API}/sucursal/${selectedSucursal.id}`);
      toast.success("Sucursal eliminada correctamente");
      setSearchResults(searchResults.filter(s => s.id !== selectedSucursal.id));
      setSelectedSucursal(null);
      setShowDeleteDialog(false);
    } catch (error) {
      const message = error.response?.data?.detail || "Error al eliminar";
      toast.error(message);
    }
  };

  const clearSelection = () => {
    setSelectedSucursal(null);
  };

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <Card className="bg-slate-950/50 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" strokeWidth={1.5} />
            Control de Sucursales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                data-testid="sucursal-search-input"
                placeholder="Buscar sucursal por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10 bg-slate-950 border-slate-800 focus:border-blue-500"
              />
            </div>
            <Button
              data-testid="sucursal-search-btn"
              onClick={handleSearch}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Buscar
                </>
              )}
            </Button>
          </div>

          {/* Search Results List */}
          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-slate-400">
                {searchResults.length} resultado(s) encontrado(s):
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {searchResults.map((sucursal) => (
                  <button
                    key={sucursal.id}
                    data-testid={`sucursal-result-${sucursal.id}`}
                    onClick={() => handleSelectSucursal(sucursal)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      selectedSucursal?.id === sucursal.id
                        ? "bg-blue-600/20 border-blue-500"
                        : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <p className="font-medium text-slate-200 truncate">{sucursal.sucursal}</p>
                    <p className="text-xs text-slate-400 truncate">{sucursal.empresa}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500">{sucursal.region}</span>
                      <span className="text-xs text-blue-400">{sucursal.cams_instaladas} cámaras</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Sucursal Detail Card */}
      {selectedSucursal && (
        <Card className="bg-slate-950/50 border-slate-800 animate-fade-in">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-slate-50">
                  {selectedSucursal.sucursal}
                </CardTitle>
                <p className="text-sm text-slate-400 mt-1">{selectedSucursal.empresa}</p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <>
                    <Button
                      data-testid="edit-sucursal-btn"
                      variant="outline"
                      size="sm"
                      onClick={openEditDialog}
                      className="border-slate-700 hover:bg-slate-800"
                    >
                      <Pencil className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      data-testid="delete-sucursal-btn"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                      className="border-red-700/50 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Eliminar
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* ID */}
              <InfoItem
                icon={Hash}
                label="ID"
                value={selectedSucursal.id}
                color="slate"
              />
              
              {/* Región */}
              <InfoItem
                icon={MapPin}
                label="Región"
                value={selectedSucursal.region || "No especificada"}
                color="purple"
              />

              {/* Tipo de Instalación */}
              <InfoItem
                icon={Cable}
                label="Tipo de Instalación"
                value={selectedSucursal.tipo_instalacion || "No especificado"}
                color="teal"
              />

              {/* Serie DVR */}
              <InfoItem
                icon={Server}
                label="Serie DVR"
                value={selectedSucursal.serie_dvr || "No especificada"}
                color="blue"
                mono
              />

              {/* Modelo DVR */}
              <InfoItem
                icon={Monitor}
                label="Modelo DVR"
                value={selectedSucursal.modelo_dvr || "No especificado"}
                color="indigo"
              />

              {/* Puertos DVR */}
              <InfoItem
                icon={Server}
                label="Puertos DVR"
                value={selectedSucursal.puertos_dvr || 0}
                color="cyan"
              />

              {/* Cámaras Instaladas */}
              <InfoItem
                icon={Camera}
                label="Cámaras Instaladas"
                value={selectedSucursal.cams_instaladas || 0}
                color="emerald"
                highlight
              />

              {/* Cámaras con Audio */}
              <InfoItem
                icon={Volume2}
                label="Cámaras con Audio"
                value={selectedSucursal.cam_audio || 0}
                color="amber"
                highlight
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-slate-950 border-slate-800 text-slate-50 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Sucursal</DialogTitle>
            <DialogDescription className="text-slate-400">
              Modifique la información de la sucursal
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Input
                data-testid="edit-empresa"
                value={editData.empresa || ""}
                onChange={(e) => setEditData({ ...editData, empresa: e.target.value })}
                className="bg-slate-900 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label>Sucursal</Label>
              <Input
                data-testid="edit-sucursal-name"
                value={editData.sucursal || ""}
                onChange={(e) => setEditData({ ...editData, sucursal: e.target.value })}
                className="bg-slate-900 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label>Región</Label>
              <Input
                data-testid="edit-region"
                value={editData.region || ""}
                onChange={(e) => setEditData({ ...editData, region: e.target.value })}
                className="bg-slate-900 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Instalación</Label>
              <Select
                value={editData.tipo_instalacion || ""}
                onValueChange={(value) => setEditData({ ...editData, tipo_instalacion: value })}
              >
                <SelectTrigger data-testid="edit-tipo" className="bg-slate-900 border-slate-800">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  <SelectItem value="BALUMS ETHERNET">BALUMS ETHERNET</SelectItem>
                  <SelectItem value="TRANSCEPTORES">TRANSCEPTORES</SelectItem>
                  <SelectItem value="MIXTA">MIXTA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Serie DVR</Label>
              <Input
                data-testid="edit-serie-dvr"
                value={editData.serie_dvr || ""}
                onChange={(e) => setEditData({ ...editData, serie_dvr: e.target.value })}
                className="bg-slate-900 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label>Modelo DVR</Label>
              <Input
                data-testid="edit-modelo-dvr"
                value={editData.modelo_dvr || ""}
                onChange={(e) => setEditData({ ...editData, modelo_dvr: e.target.value })}
                className="bg-slate-900 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label>Puertos DVR</Label>
              <Input
                data-testid="edit-puertos"
                type="number"
                value={editData.puertos_dvr || ""}
                onChange={(e) => setEditData({ ...editData, puertos_dvr: parseInt(e.target.value) || 0 })}
                className="bg-slate-900 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label>Cámaras Instaladas</Label>
              <Input
                data-testid="edit-cams"
                type="number"
                value={editData.cams_instaladas || ""}
                onChange={(e) => setEditData({ ...editData, cams_instaladas: parseInt(e.target.value) || 0 })}
                className="bg-slate-900 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label>Cámaras con Audio</Label>
              <Input
                data-testid="edit-audio"
                type="number"
                value={editData.cam_audio || ""}
                onChange={(e) => setEditData({ ...editData, cam_audio: parseInt(e.target.value) || 0 })}
                className="bg-slate-900 border-slate-800"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              className="border-slate-700 hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              data-testid="confirm-edit-sucursal"
              onClick={handleUpdate}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="w-4 h-4 mr-2" />
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-slate-950 border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-50">¿Eliminar sucursal?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Esta acción no se puede deshacer. Se eliminará permanentemente la sucursal{" "}
              <span className="font-semibold text-slate-300">{selectedSucursal?.sucursal}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 hover:bg-slate-800 text-slate-300">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirm-delete-sucursal"
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Info Item Component
const InfoItem = ({ icon: Icon, label, value, color, mono, highlight }) => {
  const colorClasses = {
    slate: "text-slate-400 bg-slate-500/20",
    blue: "text-blue-400 bg-blue-500/20",
    emerald: "text-emerald-400 bg-emerald-500/20",
    amber: "text-amber-400 bg-amber-500/20",
    purple: "text-purple-400 bg-purple-500/20",
    indigo: "text-indigo-400 bg-indigo-500/20",
    cyan: "text-cyan-400 bg-cyan-500/20",
    teal: "text-teal-400 bg-teal-500/20",
  };

  return (
    <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-800">
      <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
        <Icon className="w-4 h-4" strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
        <p className={`text-sm font-medium text-slate-200 truncate ${mono ? "font-mono" : ""} ${highlight ? "text-lg" : ""}`}>
          {value}
        </p>
      </div>
    </div>
  );
};

export default ControlSucursales;
