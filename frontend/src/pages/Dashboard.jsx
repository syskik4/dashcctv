import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Building2,
  Camera,
  Volume2,
  VolumeX,
  Search,
  ChevronLeft,
  ChevronRight,
  Shield,
  TrendingUp,
  ArrowUpDown,
  LogOut,
  Users,
  LayoutDashboard,
  User,
  MapPin,
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
import { Skeleton } from "../components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import UserManagement from "./UserManagement";
import ControlSucursales from "./ControlSucursales";
import Login from "./Login";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [stats, setStats] = useState(null);
  const [regions, setRegions] = useState([]);
  const [tiposInstalacion, setTiposInstalacion] = useState([]);
  const [controlData, setControlData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [activeTab, setActiveTab] = useState("dashboard");
  const itemsPerPage = 10;

  useEffect(() => {
    // Check for existing session
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchAllData();
    }
  }, [token]);

  const axiosAuth = axios.create({
    headers: { Authorization: `Bearer ${token}` },
  });

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [statsRes, regionsRes, tiposRes, controlRes] = await Promise.all([
        axiosAuth.get(`${API}/stats`),
        axiosAuth.get(`${API}/regions`),
        axiosAuth.get(`${API}/tipos-instalacion`),
        axiosAuth.get(`${API}/control`),
      ]);
      setStats(statsRes.data);
      setRegions(regionsRes.data);
      setTiposInstalacion(tiposRes.data);
      setControlData(controlRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      if (error.response?.status === 401) {
        handleLogout();
        toast.error("Sesión expirada, por favor inicie sesión nuevamente");
      } else {
        toast.error("Error al cargar los datos");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (userData, accessToken) => {
    setUser(userData);
    setToken(accessToken);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setToken(null);
    setStats(null);
    setControlData([]);
    toast.success("Sesión cerrada");
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      const response = await axiosAuth.get(`${API}/search?sucursal=${encodeURIComponent(searchTerm)}`);
      setSearchResults(response.data);
      if (response.data.length === 0) {
        toast.info("No se encontraron resultados");
      } else {
        toast.success(`Se encontraron ${response.data.length} resultado(s)`);
      }
    } catch (error) {
      console.error("Error searching:", error);
      toast.error("Error en la búsqueda");
    }
  };

  const clearSearch = () => {
    setSearchTerm("");
    setSearchResults(null);
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const displayData = searchResults || controlData;

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return displayData;
    return [...displayData].sort((a, b) => {
      const aVal = a[sortConfig.key] ?? "";
      const bVal = b[sortConfig.key] ?? "";
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [displayData, sortConfig]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const paginatedData = sortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const pieData = tiposInstalacion.map((item) => ({
    name: item.tipo,
    value: item.count,
  }));

  // Show login if not authenticated
  if (!user || !token) {
    return <Login onLogin={handleLogin} />;
  }

  if (loading && !stats) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600/20 rounded-lg">
                <Shield className="w-6 h-6 text-blue-400" strokeWidth={1.5} />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight">
                  Control de Cámaras
                </h1>
                <p className="text-xs text-slate-400 hidden sm:block">
                  Sistema de monitoreo empresarial
                </p>
              </div>
            </div>
            
            {/* User Menu */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="hidden sm:inline">Sistema activo</span>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    data-testid="user-menu-btn"
                    variant="ghost"
                    className="flex items-center gap-2 hover:bg-slate-800"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-600/30 flex items-center justify-center">
                      <User className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="hidden sm:block text-left">
                      <p className="text-sm font-medium text-slate-200">{user.nombre}</p>
                      <p className="text-xs text-slate-400">
                        {user.rol === "admin" ? "Administrador" : "Usuario"}
                      </p>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-slate-950 border-slate-800">
                  <DropdownMenuLabel className="text-slate-400">Mi Cuenta</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-800" />
                  <DropdownMenuItem className="text-slate-300">
                    <User className="w-4 h-4 mr-2" />
                    {user.email}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-slate-800" />
                  <DropdownMenuItem
                    data-testid="logout-btn"
                    onClick={handleLogout}
                    className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Cerrar Sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tabs for Dashboard and Users (Admin only) */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger
              data-testid="tab-dashboard"
              value="dashboard"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger
              data-testid="tab-sucursales"
              value="sucursales"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              <MapPin className="w-4 h-4 mr-2" />
              Control Sucursales
            </TabsTrigger>
            {user.rol === "admin" && (
              <TabsTrigger
                data-testid="tab-users"
                value="users"
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                <Users className="w-4 h-4 mr-2" />
                Usuarios
              </TabsTrigger>
            )}
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Cards */}
            <section data-testid="stats-section" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard
                title="Sucursales Activas"
                value={stats?.total_sucursales || 0}
                icon={Building2}
                color="blue"
                delay={0}
                testId="stat-sucursales"
              />
              <StatsCard
                title="Cámaras Totales"
                value={stats?.total_camaras || 0}
                icon={Camera}
                color="emerald"
                delay={1}
                testId="stat-camaras"
              />
              <StatsCard
                title="Sucursales con Audio"
                value={stats?.camaras_con_audio || 0}
                icon={Volume2}
                color="amber"
                percentage={stats?.porcentaje_audio || 0}
                delay={2}
                testId="stat-audio"
              />
              <StatsCard
                title="Sucursales sin Audio"
                value={stats?.camaras_sin_audio || 0}
                icon={VolumeX}
                color="rose"
                percentage={stats?.porcentaje_sin_audio || 0}
                delay={3}
                testId="stat-sin-audio"
              />
            </section>

            {/* Charts Section */}
            <section data-testid="charts-section" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Bar Chart */}
              <Card className="lg:col-span-2 bg-slate-950/50 border-slate-800 hover:border-slate-700 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-400" strokeWidth={1.5} />
                    Distribución por Región
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]" data-testid="bar-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={regions} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis
                          dataKey="region"
                          tick={{ fill: "#94a3b8", fontSize: 11 }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          interval={0}
                        />
                        <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0f172a",
                            border: "1px solid #1e293b",
                            borderRadius: "8px",
                            color: "#f8fafc",
                          }}
                          formatter={(value, name) => [
                            value,
                            name === "count" ? "Sucursales" : "Cámaras",
                          ]}
                        />
                        <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="count" />
                        <Bar dataKey="total_camaras" fill="#10b981" radius={[4, 4, 0, 0]} name="total_camaras" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Pie Chart */}
              <Card className="bg-slate-950/50 border-slate-800 hover:border-slate-700 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold">Tipo de Instalación</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]" data-testid="pie-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="45%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${(percent * 100).toFixed(0)}%`
                          }
                          labelLine={false}
                        >
                          {pieData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={CHART_COLORS[index % CHART_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                          formatter={(value) => (
                            <span className="text-xs text-slate-300">{value}</span>
                          )}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0f172a",
                            border: "1px solid #1e293b",
                            borderRadius: "8px",
                            color: "#f8fafc",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Search and Table Section */}
            <section data-testid="table-section" className="space-y-4">
              {/* Search Bar */}
              <Card className="bg-slate-950/50 border-slate-800">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        data-testid="search-input"
                        placeholder="Buscar por nombre de sucursal..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        className="pl-10 bg-slate-950 border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        data-testid="search-btn"
                        onClick={handleSearch}
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
                </CardContent>
              </Card>

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
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedData.map((row, idx) => (
                          <TableRow
                            key={row.id || idx}
                            data-testid={`table-row-${idx}`}
                            className="border-slate-800 hover:bg-slate-900/50 transition-colors"
                          >
                            <TableCell className="font-mono text-xs text-slate-400">
                              {row.id}
                            </TableCell>
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
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                                  row.cam_audio > 0
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : "bg-slate-700/50 text-slate-400"
                                }`}
                              >
                                {row.cam_audio || 0}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
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
            </section>
          </TabsContent>

          {/* Users Management Tab (Admin only) */}
          {user.rol === "admin" && (
            <TabsContent value="users">
              <UserManagement token={token} />
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-xs text-slate-500">
            Sistema de Control de Cámaras © {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
};

// Stats Card Component
const StatsCard = ({ title, value, icon: Icon, color, percentage, delay, testId }) => {
  const colorClasses = {
    blue: "text-blue-400 bg-blue-500/20",
    emerald: "text-emerald-400 bg-emerald-500/20",
    amber: "text-amber-400 bg-amber-500/20",
    rose: "text-rose-400 bg-rose-500/20",
  };

  const progressColors = {
    blue: "bg-blue-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
  };

  return (
    <Card
      data-testid={testId}
      className="bg-slate-950/50 border-slate-800 hover:border-slate-700 transition-all duration-200 hover:-translate-y-0.5"
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-slate-400 uppercase tracking-wider">{title}</p>
            <p className="text-2xl md:text-3xl font-bold tracking-tight">{value.toLocaleString()}</p>
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

// Loading Skeleton
const LoadingSkeleton = () => (
  <div className="min-h-screen bg-[#020617] p-6">
    <div className="max-w-7xl mx-auto space-y-6">
      <Skeleton className="h-16 w-full bg-slate-800" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 bg-slate-800" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="h-80 lg:col-span-2 bg-slate-800" />
        <Skeleton className="h-80 bg-slate-800" />
      </div>
      <Skeleton className="h-96 bg-slate-800" />
    </div>
  </div>
);

export default Dashboard;
