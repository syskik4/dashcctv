import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Wifi,
  WifiOff,
  HelpCircle,
  RefreshCw,
  Search,
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const StatusSucursales = ({ token, userRole }) => {
  const [statusData, setStatusData] = useState([]);
  const [stats, setStats] = useState({ Online: 0, Offline: 0, Unknown: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = userRole === "admin";

  const axiosAuth = axios.create({
    headers: { Authorization: `Bearer ${token}` },
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statusRes, statsRes] = await Promise.all([
        axiosAuth.get(`${API}/status/all`),
        axiosAuth.get(`${API}/status/stats`),
      ]);
      setStatusData(statusRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error("Error fetching status:", error);
      toast.error("Error al cargar el estado de sucursales");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    toast.success("Datos actualizados");
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await axiosAuth.put(`${API}/status/${id}`, { status: newStatus });
      toast.success("Estado actualizado");
      fetchData();
    } catch (error) {
      toast.error("Error al actualizar estado");
    }
  };

  const filteredData = statusData.filter((item) => {
    const matchesSearch =
      item.sucursal?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.empresa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.region?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === "all" || item.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const formatLastCheck = (dateStr) => {
    if (!dateStr) return "Sin verificar";
    const date = new Date(dateStr);
    return date.toLocaleString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "Online":
        return <Wifi className="w-4 h-4 text-emerald-400" />;
      case "Offline":
        return <WifiOff className="w-4 h-4 text-red-400" />;
      default:
        return <HelpCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      Online: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      Offline: "bg-red-500/20 text-red-400 border-red-500/30",
      Unknown: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    };
    return styles[status] || styles.Unknown;
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Sucursales"
          value={stats.total}
          icon={Building2}
          color="blue"
        />
        <StatsCard
          title="En Línea"
          value={stats.Online}
          icon={CheckCircle2}
          color="emerald"
          percentage={stats.total > 0 ? ((stats.Online / stats.total) * 100).toFixed(1) : 0}
        />
        <StatsCard
          title="Fuera de Línea"
          value={stats.Offline}
          icon={XCircle}
          color="red"
          percentage={stats.total > 0 ? ((stats.Offline / stats.total) * 100).toFixed(1) : 0}
        />
        <StatsCard
          title="Sin Verificar"
          value={stats.Unknown}
          icon={AlertCircle}
          color="slate"
          percentage={stats.total > 0 ? ((stats.Unknown / stats.total) * 100).toFixed(1) : 0}
        />
      </div>

      {/* Filters and Actions */}
      <Card className="bg-slate-950/50 border-slate-800">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Wifi className="w-5 h-5 text-blue-400" strokeWidth={1.5} />
              Status de Sucursales
            </CardTitle>
            <Button
              data-testid="refresh-status-btn"
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              className="border-slate-700 hover:bg-slate-800"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                data-testid="status-search-input"
                placeholder="Buscar por sucursal, empresa o región..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-950 border-slate-800 focus:border-blue-500"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger data-testid="status-filter" className="w-full sm:w-48 bg-slate-950 border-slate-800">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800">
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="Online">En Línea</SelectItem>
                <SelectItem value="Offline">Fuera de Línea</SelectItem>
                <SelectItem value="Unknown">Sin Verificar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Info Banner */}
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-sm text-blue-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                Para sincronizar automáticamente con Hik-Connect, ejecute el script{" "}
                <code className="bg-slate-800 px-1 rounded">sync_hikvision.py</code> en un servidor con Chrome instalado.
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Status Table */}
      <Card className="bg-slate-950/50 border-slate-800 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400">ID</TableHead>
                  <TableHead className="text-slate-400">Sucursal</TableHead>
                  <TableHead className="text-slate-400">Empresa</TableHead>
                  <TableHead className="text-slate-400">Región</TableHead>
                  <TableHead className="text-slate-400">Estado</TableHead>
                  <TableHead className="text-slate-400">Última Verificación</TableHead>
                  {isAdmin && <TableHead className="text-slate-400 text-right">Acción</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-slate-400">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-slate-400">
                      No se encontraron sucursales
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((item, idx) => (
                    <TableRow
                      key={item.id}
                      data-testid={`status-row-${idx}`}
                      className="border-slate-800 hover:bg-slate-900/50"
                    >
                      <TableCell className="font-mono text-xs text-slate-400">{item.id}</TableCell>
                      <TableCell className="font-medium">{item.sucursal || "-"}</TableCell>
                      <TableCell className="text-slate-300">{item.empresa || "-"}</TableCell>
                      <TableCell className="text-slate-300">{item.region || "-"}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${getStatusBadge(
                            item.status
                          )}`}
                        >
                          {getStatusIcon(item.status)}
                          {item.status === "Online" ? "En Línea" : item.status === "Offline" ? "Fuera de Línea" : "Sin Verificar"}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {formatLastCheck(item.last_check)}
                        </div>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <Select
                            value={item.status || "Unknown"}
                            onValueChange={(value) => handleStatusChange(item.id, value)}
                          >
                            <SelectTrigger className="w-32 h-8 bg-slate-900 border-slate-700 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800">
                              <SelectItem value="Online">En Línea</SelectItem>
                              <SelectItem value="Offline">Fuera de Línea</SelectItem>
                              <SelectItem value="Unknown">Sin Verificar</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Stats Card Component
const StatsCard = ({ title, value, icon: Icon, color, percentage }) => {
  const colorClasses = {
    blue: "text-blue-400 bg-blue-500/20",
    emerald: "text-emerald-400 bg-emerald-500/20",
    red: "text-red-400 bg-red-500/20",
    slate: "text-slate-400 bg-slate-500/20",
  };

  const progressColors = {
    blue: "bg-blue-500",
    emerald: "bg-emerald-500",
    red: "bg-red-500",
    slate: "bg-slate-500",
  };

  return (
    <Card className="bg-slate-950/50 border-slate-800 hover:border-slate-700 transition-all">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-slate-400 uppercase tracking-wider">{title}</p>
            <p className="text-2xl md:text-3xl font-bold tracking-tight">{value}</p>
          </div>
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
            <Icon className="w-5 h-5" strokeWidth={1.5} />
          </div>
        </div>
        {percentage !== undefined && (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Porcentaje</span>
              <span className={colorClasses[color].split(" ")[0]}>{percentage}%</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${progressColors[color]} transition-all duration-500 rounded-full`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StatusSucursales;
