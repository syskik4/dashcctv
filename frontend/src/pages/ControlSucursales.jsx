import React, { useState, useEffect, useMemo } from "react";
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
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  User,
  Lock,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
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
import { logError } from "../lib/logger";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ControlSucursales = ({ token, userRole }) => {
  const [allData, setAllData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [selectedSucursal, setSelectedSucursal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editData, setEditData] = useState({});
  const [createData, setCreateData] = useState({
    empresa: "",
    sucursal: "",
    region: "",
    serie_dvr: "",
    modelo_dvr: "",
    puertos_dvr: "",
    cams_instaladas: "",
    cam_audio: false,
    cod_verif: "",
    usuario: "",
    password: "",
    tipo_instalacion: "",
    ubi_dvr_aprox: ""
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [filterEmpresa, setFilterEmpresa] = useState("all");
  const [filterRegion, setFilterRegion] = useState("all");
  const [filterDate, setFilterDate] = useState("all"); // all | 24h | 7d | 30d | unchecked
  const itemsPerPage = 10;

  const isAdmin = userRole === "admin";

  const axiosAuth = axios.create({
    headers: { Authorization: `Bearer ${token}` },
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const response = await axiosAuth.get(`${API}/control`);
      setAllData(response.data);
    } catch (error) {
      logError("Error fetching data:", error);
      toast.error("Error al cargar los datos");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setSearchResults(null);
      setSelectedSucursal(null);
      return;
    }

    setLoading(true);
    try {
      const response = await axiosAuth.get(`${API}/search?sucursal=${encodeURIComponent(searchTerm)}`);
      setSearchResults(response.data);
      setSelectedSucursal(null);
      setCurrentPage(1);
      if (response.data.length === 0) {
        toast.info("No se encontraron sucursales");
      } else {
        toast.success(`Se encontraron ${response.data.length} sucursal(es)`);
      }
    } catch (error) {
      logError("Error searching:", error);
      toast.error("Error en la búsqueda");
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchTerm("");
    setSearchResults(null);
    setSelectedSucursal(null);
  };

  const handleSelectSucursal = (sucursal) => {
    setSelectedSucursal(sucursal);
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const displayData = searchResults || allData;

  // Unique empresa / region for filter dropdowns
  const uniqueEmpresas = useMemo(() => {
    const set = new Set(allData.map((s) => s.empresa).filter(Boolean));
    return Array.from(set).sort();
  }, [allData]);

  const uniqueRegiones = useMemo(() => {
    const set = new Set(allData.map((s) => s.region).filter(Boolean));
    return Array.from(set).sort();
  }, [allData]);

  const filteredData = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    return displayData.filter((s) => {
      if (filterEmpresa !== "all" && s.empresa !== filterEmpresa) return false;
      if (filterRegion !== "all" && s.region !== filterRegion) return false;
      if (filterDate !== "all") {
        if (filterDate === "unchecked") {
          if (s.last_check) return false;
        } else {
          if (!s.last_check) return false;
          const ts = new Date(s.last_check).getTime();
          if (filterDate === "24h" && now - ts > dayMs) return false;
          if (filterDate === "7d" && now - ts > 7 * dayMs) return false;
          if (filterDate === "30d" && now - ts > 30 * dayMs) return false;
        }
      }
      return true;
    });
  }, [displayData, filterEmpresa, filterRegion, filterDate]);

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.key] ?? "";
      const bVal = b[sortConfig.key] ?? "";
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);

  const clearFilters = () => {
    setFilterEmpresa("all");
    setFilterRegion("all");
    setFilterDate("all");
    setCurrentPage(1);
  };

  const filtersActive =
    filterEmpresa !== "all" || filterRegion !== "all" || filterDate !== "all";

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const paginatedData = sortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const openEditDialog = (sucursal) => {
    setSelectedSucursal(sucursal);
    setEditData({ ...sucursal });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (sucursal) => {
    setSelectedSucursal(sucursal);
    setShowDeleteDialog(true);
  };

  const handleUpdate = async () => {
    try {
      const response = await axiosAuth.put(`${API}/sucursal/${selectedSucursal.id}`, editData);
      toast.success("Sucursal actualizada correctamente");
      
      // Update local data
      setAllData(allData.map(s => s.id === response.data.id ? response.data : s));
      if (searchResults) {
        setSearchResults(searchResults.map(s => s.id === response.data.id ? response.data : s));
      }
      setSelectedSucursal(null);
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
      
      // Update local data
      setAllData(allData.filter(s => s.id !== selectedSucursal.id));
      if (searchResults) {
        setSearchResults(searchResults.filter(s => s.id !== selectedSucursal.id));
      }
      setSelectedSucursal(null);
      setShowDeleteDialog(false);
    } catch (error) {
      const message = error.response?.data?.detail || "Error al eliminar";
      toast.error(message);
    }
  };

  const handleCreate = async () => {
    if (!createData.empresa || !createData.sucursal) {
      toast.error("Empresa y Sucursal son campos requeridos");
      return;
    }

    try {
      const payload = {
        ...createData,
        puertos_dvr: createData.puertos_dvr ? parseInt(createData.puertos_dvr) : null,
        cams_instaladas: createData.cams_instaladas ? parseInt(createData.cams_instaladas) : null,
      };
      
      const response = await axiosAuth.post(`${API}/sucursal`, payload);
      toast.success("Sucursal creada correctamente");
      
      // Add to local data
      setAllData([response.data, ...allData]);
      setShowCreateDialog(false);
      setCreateData({
        empresa: "",
        sucursal: "",
        region: "",
        serie_dvr: "",
        modelo_dvr: "",
        puertos_dvr: "",
        cams_instaladas: "",
        cam_audio: false,
        cod_verif: "",
        usuario: "",
        password: "",
        tipo_instalacion: "",
        ubi_dvr_aprox: ""
      });
    } catch (error) {
      const message = error.response?.data?.detail || "Error al crear sucursal";
      toast.error(message);
    }
  };

  const closeDetailCard = () => {
    setSelectedSucursal(null);
  };

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <Card className="bg-slate-950/50 border-slate-800">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-400" strokeWidth={1.5} />
              Control de Sucursales
            </CardTitle>
            {isAdmin && (
              <Button
                data-testid="create-sucursal-btn"
                onClick={() => setShowCreateDialog(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nueva Sucursal
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                data-testid="sucursal-search-input"
                placeholder="Buscar por nombre de sucursal..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10 bg-slate-950 border-slate-800 focus:border-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <Button
                data-testid="sucursal-search-btn"
                onClick={handleSearch}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]"
              >
                <Search className="w-4 h-4 mr-2" />
                Buscar
              </Button>
              {searchResults && (
                <Button
                  data-testid="clear-search-btn"
                  onClick={clearSearch}
                  variant="outline"
                  className="border-slate-700 hover:bg-slate-800"
                >
                  Limpiar
                </Button>
              )}
            </div>
          </div>
          {searchResults && (
            <p className="text-sm text-slate-400 mt-3">
              Mostrando {searchResults.length} resultado(s) para "{searchTerm}"
            </p>
          )}

          {/* Filters */}
          <div className="mt-4 flex flex-col lg:flex-row gap-3 items-start lg:items-end">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 w-full">
              <div>
                <Label className="text-xs text-slate-400 mb-1 block">Empresa</Label>
                <Select value={filterEmpresa} onValueChange={(v) => { setFilterEmpresa(v); setCurrentPage(1); }}>
                  <SelectTrigger data-testid="filter-empresa" className="bg-slate-950 border-slate-800">
                    <SelectValue placeholder="Todas las empresas" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="all">Todas las empresas</SelectItem>
                    {uniqueEmpresas.map((e) => (
                      <SelectItem key={e} value={e}>{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-slate-400 mb-1 block">Región</Label>
                <Select value={filterRegion} onValueChange={(v) => { setFilterRegion(v); setCurrentPage(1); }}>
                  <SelectTrigger data-testid="filter-region" className="bg-slate-950 border-slate-800">
                    <SelectValue placeholder="Todas las regiones" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="all">Todas las regiones</SelectItem>
                    {uniqueRegiones.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-slate-400 mb-1 block">Última verificación</Label>
                <Select value={filterDate} onValueChange={(v) => { setFilterDate(v); setCurrentPage(1); }}>
                  <SelectTrigger data-testid="filter-date" className="bg-slate-950 border-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="all">Cualquier fecha</SelectItem>
                    <SelectItem value="24h">Últimas 24 h</SelectItem>
                    <SelectItem value="7d">Últimos 7 días</SelectItem>
                    <SelectItem value="30d">Últimos 30 días</SelectItem>
                    <SelectItem value="unchecked">Sin verificación</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {filtersActive && (
              <Button
                data-testid="clear-filters-btn"
                onClick={clearFilters}
                variant="outline"
                className="border-slate-700 hover:bg-slate-800 whitespace-nowrap"
              >
                <X className="w-4 h-4 mr-2" />
                Limpiar filtros
              </Button>
            )}
          </div>
          {filtersActive && (
            <p data-testid="filter-summary" className="text-xs text-slate-500 mt-2">
              {sortedData.length} sucursal(es) coinciden con los filtros aplicados
            </p>
          )}
        </CardContent>
      </Card>

      {/* Selected Sucursal Detail Card */}
      {selectedSucursal && !showEditDialog && (
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
                      onClick={() => openEditDialog(selectedSucursal)}
                      className="border-slate-700 hover:bg-slate-800"
                    >
                      <Pencil className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      data-testid="delete-sucursal-btn"
                      variant="outline"
                      size="sm"
                      onClick={() => openDeleteDialog(selectedSucursal)}
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
                  onClick={closeDetailCard}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <InfoItem icon={Hash} label="ID" value={selectedSucursal.id} color="slate" />
              <InfoItem icon={MapPin} label="Región" value={selectedSucursal.region || "No especificada"} color="purple" />
              <InfoItem icon={Cable} label="Tipo de Instalación" value={selectedSucursal.tipo_instalacion || "No especificado"} color="teal" />
              <InfoItem icon={Server} label="Serie DVR" value={selectedSucursal.serie_dvr || "No especificada"} color="blue" mono />
              <InfoItem icon={Monitor} label="Modelo DVR" value={selectedSucursal.modelo_dvr || "No especificado"} color="indigo" />
              <InfoItem icon={Server} label="Puertos DVR" value={selectedSucursal.puertos_dvr || 0} color="cyan" />
              <InfoItem icon={Camera} label="Cámaras Instaladas" value={selectedSucursal.cams_instaladas || 0} color="emerald" highlight />
              <InfoItem 
                icon={Volume2} 
                label="Cámaras con Audio" 
                value={selectedSucursal.cam_audio === true ? "Sí" : selectedSucursal.cam_audio === false ? "No" : (selectedSucursal.cam_audio ?? 0)} 
                color="amber" 
                highlight 
              />
              <InfoItem icon={Hash} label="Código Verificación" value={selectedSucursal.cod_verif || "No especificado"} color="blue" mono />
              <InfoItem icon={User} label="Usuario" value={selectedSucursal.usuario || "No especificado"} color="indigo" />
              <InfoItem icon={Lock} label="Contraseña" value={selectedSucursal.password || "No especificada"} color="rose" mono />
              <InfoItem icon={MapPin} label="Ubicación DVR Aprox" value={selectedSucursal.ubi_dvr_aprox || "No especificada"} color="teal" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Table */}
      <Card className="bg-slate-950/50 border-slate-800 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">
            Registro de Cámaras
            <span className="text-sm font-normal text-slate-400 ml-2">
              ({sortedData.length} registros)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  {[
                    { key: "id", label: "ID" },
                    { key: "empresa", label: "Empresa" },
                    { key: "sucursal", label: "Sucursal" },
                    { key: "serie_dvr", label: "Serie DVR" },
                    { key: "modelo_dvr", label: "Modelo DVR" },
                    { key: "puertos_dvr", label: "Puertos" },
                    { key: "cams_instaladas", label: "Cámaras" },
                    { key: "cam_audio", label: "Audio" },
                  ].map((col) => (
                    <TableHead
                      key={col.key}
                      className="text-slate-400 font-medium cursor-pointer hover:text-slate-200 transition-colors"
                      onClick={() => handleSort(col.key)}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </TableHead>
                  ))}
                  {isAdmin && <TableHead className="text-slate-400 font-medium text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 9 : 8} className="text-center py-8 text-slate-400">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 9 : 8} className="text-center py-8 text-slate-400">
                      No se encontraron registros
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((row, idx) => (
                    <TableRow
                      key={row.id || idx}
                      data-testid={`table-row-${idx}`}
                      className={`border-slate-800 hover:bg-slate-900/50 transition-colors cursor-pointer ${
                        selectedSucursal?.id === row.id ? "bg-blue-600/10" : ""
                      }`}
                      onClick={() => handleSelectSucursal(row)}
                    >
                      <TableCell className="font-mono text-xs text-slate-400">{row.id}</TableCell>
                      <TableCell className="font-medium">{row.empresa || "-"}</TableCell>
                      <TableCell>{row.sucursal || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{row.serie_dvr || "-"}</TableCell>
                      <TableCell className="text-sm">{row.modelo_dvr || "-"}</TableCell>
                      <TableCell className="text-center">{row.puertos_dvr || "-"}</TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-500/20 text-blue-400">
                          {row.cams_instaladas || 0}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                          row.cam_audio === true || (typeof row.cam_audio === 'number' && row.cam_audio > 0)
                            ? "bg-emerald-500/20 text-emerald-400" 
                            : "bg-slate-700/50 text-slate-400"
                        }`}>
                          {row.cam_audio === true ? "Sí" : row.cam_audio === false ? "No" : (row.cam_audio || 0)}
                        </span>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button
                              data-testid={`edit-row-${row.id}`}
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(row)}
                              className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 w-8 p-0"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              data-testid={`delete-row-${row.id}`}
                              variant="ghost"
                              size="sm"
                              onClick={() => openDeleteDialog(row)}
                              className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 h-8 w-8 p-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
              <p className="text-sm text-slate-400">
                Página {currentPage} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  data-testid="prev-page-btn"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="border-slate-700 hover:bg-slate-800 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  data-testid="next-page-btn"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="border-slate-700 hover:bg-slate-800 disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
                value={editData.cam_audio ?? ""}
                onChange={(e) => setEditData({ ...editData, cam_audio: parseInt(e.target.value) || 0 })}
                className="bg-slate-900 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label>Código Verificación</Label>
              <Input
                data-testid="edit-cod-verif"
                value={editData.cod_verif || ""}
                onChange={(e) => setEditData({ ...editData, cod_verif: e.target.value })}
                className="bg-slate-900 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label>Usuario</Label>
              <Input
                data-testid="edit-usuario"
                value={editData.usuario || ""}
                onChange={(e) => setEditData({ ...editData, usuario: e.target.value })}
                className="bg-slate-900 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label>Contraseña</Label>
              <Input
                data-testid="edit-password"
                value={editData.password || ""}
                onChange={(e) => setEditData({ ...editData, password: e.target.value })}
                className="bg-slate-900 border-slate-800"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Ubicación DVR Aproximada</Label>
              <Input
                data-testid="edit-ubi-dvr"
                value={editData.ubi_dvr_aprox || ""}
                onChange={(e) => setEditData({ ...editData, ubi_dvr_aprox: e.target.value })}
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

      {/* Create Sucursal Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-slate-950 border-slate-800 text-slate-50 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-400" />
              Nueva Sucursal
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Complete la información para registrar una nueva sucursal
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Empresa *</Label>
              <Input
                data-testid="create-empresa"
                value={createData.empresa}
                onChange={(e) => setCreateData({ ...createData, empresa: e.target.value })}
                placeholder="Nombre de la empresa"
                className="bg-slate-900 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label>Sucursal *</Label>
              <Input
                data-testid="create-sucursal"
                value={createData.sucursal}
                onChange={(e) => setCreateData({ ...createData, sucursal: e.target.value })}
                placeholder="Nombre de la sucursal"
                className="bg-slate-900 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label>Región</Label>
              <Input
                data-testid="create-region"
                value={createData.region}
                onChange={(e) => setCreateData({ ...createData, region: e.target.value })}
                placeholder="Ej: CDMX, HIDALGO, etc."
                className="bg-slate-900 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Instalación</Label>
              <Select
                value={createData.tipo_instalacion}
                onValueChange={(value) => setCreateData({ ...createData, tipo_instalacion: value })}
              >
                <SelectTrigger data-testid="create-tipo" className="bg-slate-900 border-slate-800">
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
                data-testid="create-serie-dvr"
                value={createData.serie_dvr}
                onChange={(e) => setCreateData({ ...createData, serie_dvr: e.target.value })}
                placeholder="Número de serie del DVR"
                className="bg-slate-900 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label>Modelo DVR</Label>
              <Input
                data-testid="create-modelo-dvr"
                value={createData.modelo_dvr}
                onChange={(e) => setCreateData({ ...createData, modelo_dvr: e.target.value })}
                placeholder="Modelo del DVR"
                className="bg-slate-900 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label>Puertos DVR</Label>
              <Input
                data-testid="create-puertos"
                type="number"
                value={createData.puertos_dvr}
                onChange={(e) => setCreateData({ ...createData, puertos_dvr: e.target.value })}
                placeholder="Número de puertos"
                className="bg-slate-900 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label>Cámaras Instaladas</Label>
              <Input
                data-testid="create-cams"
                type="number"
                value={createData.cams_instaladas}
                onChange={(e) => setCreateData({ ...createData, cams_instaladas: e.target.value })}
                placeholder="Cantidad de cámaras"
                className="bg-slate-900 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label>¿Tiene Audio?</Label>
              <Select
                value={createData.cam_audio ? "true" : "false"}
                onValueChange={(value) => setCreateData({ ...createData, cam_audio: value === "true" })}
              >
                <SelectTrigger data-testid="create-audio" className="bg-slate-900 border-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  <SelectItem value="true">Sí</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Código Verificación</Label>
              <Input
                data-testid="create-cod-verif"
                value={createData.cod_verif}
                onChange={(e) => setCreateData({ ...createData, cod_verif: e.target.value })}
                placeholder="Código de verificación"
                className="bg-slate-900 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label>Usuario</Label>
              <Input
                data-testid="create-usuario"
                value={createData.usuario}
                onChange={(e) => setCreateData({ ...createData, usuario: e.target.value })}
                placeholder="Usuario del DVR"
                className="bg-slate-900 border-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label>Contraseña</Label>
              <Input
                data-testid="create-password"
                value={createData.password}
                onChange={(e) => setCreateData({ ...createData, password: e.target.value })}
                placeholder="Contraseña del DVR"
                className="bg-slate-900 border-slate-800"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Ubicación DVR Aproximada</Label>
              <Input
                data-testid="create-ubi-dvr"
                value={createData.ubi_dvr_aprox}
                onChange={(e) => setCreateData({ ...createData, ubi_dvr_aprox: e.target.value })}
                placeholder="Descripción de la ubicación física del DVR"
                className="bg-slate-900 border-slate-800"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              className="border-slate-700 hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              data-testid="confirm-create-sucursal"
              onClick={handleCreate}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Crear Sucursal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
