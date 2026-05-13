import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import {
  AlertTriangle,
  WifiOff,
  VolumeX,
  CameraOff,
  History,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
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
import { Skeleton } from "../components/ui/skeleton";
import { logError } from "../lib/logger";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const actionMeta = {
  CREATE: { label: "Creación", color: "bg-emerald-600", icon: Plus },
  UPDATE: { label: "Actualización", color: "bg-blue-600", icon: Pencil },
  DELETE: { label: "Eliminación", color: "bg-red-600", icon: Trash2 },
};

const formatDate = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-MX", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const renderChangedFields = (fields) => {
  if (!fields || typeof fields !== "object") return "—";
  const entries = Object.entries(fields);
  if (entries.length === 0) return "—";
  return entries
    .map(([k, v]) => `${k}: ${v === null ? "null" : String(v)}`)
    .join(", ");
};

const AlertasHistorial = ({ token }) => {
  const [alerts, setAlerts] = useState({
    offline: [],
    no_audio: [],
    no_cams: [],
    total_alerts: 0,
  });
  const [audit, setAudit] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [actionFilter, setActionFilter] = useState("all");

  const axiosAuth = useMemo(
    () => axios.create({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  const fetchAlerts = useCallback(async () => {
    setLoadingAlerts(true);
    try {
      const res = await axiosAuth.get(`${API}/alerts`);
      setAlerts(res.data);
    } catch (error) {
      logError("Error fetching alerts:", error);
    } finally {
      setLoadingAlerts(false);
    }
  }, [axiosAuth]);

  const fetchAudit = useCallback(async () => {
    setLoadingAudit(true);
    try {
      const params = actionFilter !== "all" ? `?action=${actionFilter}&limit=200` : `?limit=200`;
      const res = await axiosAuth.get(`${API}/audit${params}`);
      setAudit(res.data);
    } catch (error) {
      logError("Error fetching audit log:", error);
    } finally {
      setLoadingAudit(false);
    }
  }, [axiosAuth, actionFilter]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  const refreshAll = () => {
    fetchAlerts();
    fetchAudit();
  };

  return (
    <div data-testid="alertas-historial-page" className="space-y-6">
      {/* Summary Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          icon={WifiOff}
          label="Sucursales Offline"
          value={alerts.offline.length}
          color="from-red-500/20 to-red-600/5 border-red-500/30"
          iconColor="text-red-400"
          testId="alert-offline-count"
        />
        <SummaryCard
          icon={VolumeX}
          label="Sin audio"
          value={alerts.no_audio.length}
          color="from-amber-500/20 to-amber-600/5 border-amber-500/30"
          iconColor="text-amber-400"
          testId="alert-no-audio-count"
        />
        <SummaryCard
          icon={CameraOff}
          label="Sin cámaras"
          value={alerts.no_cams.length}
          color="from-purple-500/20 to-purple-600/5 border-purple-500/30"
          iconColor="text-purple-400"
          testId="alert-no-cams-count"
        />
      </section>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          Alertas e Historial de Cambios
        </h2>
        <Button
          data-testid="refresh-alerts-btn"
          onClick={refreshAll}
          variant="outline"
          className="border-slate-700 hover:bg-slate-800"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refrescar
        </Button>
      </div>

      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger
            data-testid="tab-alerts"
            value="alerts"
            className="data-[state=active]:bg-amber-600 data-[state=active]:text-white"
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Alertas activas
          </TabsTrigger>
          <TabsTrigger
            data-testid="tab-history"
            value="history"
            className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
          >
            <History className="w-4 h-4 mr-2" />
            Historial de cambios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-6">
          <AlertSection
            title="Sucursales Offline"
            icon={WifiOff}
            iconColor="text-red-400"
            rows={alerts.offline}
            loading={loadingAlerts}
            columns={[
              { key: "sucursal", label: "Sucursal" },
              { key: "empresa", label: "Empresa" },
              { key: "region", label: "Región" },
              { key: "last_check", label: "Última verificación", render: (r) => formatDate(r.last_check) },
            ]}
            testId="offline-alerts-table"
            emptyText="No hay sucursales offline. ¡Todo en orden!"
          />
          <AlertSection
            title="Sucursales sin audio"
            icon={VolumeX}
            iconColor="text-amber-400"
            rows={alerts.no_audio}
            loading={loadingAlerts}
            columns={[
              { key: "sucursal", label: "Sucursal" },
              { key: "empresa", label: "Empresa" },
              { key: "region", label: "Región" },
              { key: "cams_instaladas", label: "Cámaras instaladas" },
            ]}
            testId="no-audio-alerts-table"
            emptyText="Todas las sucursales con cámaras tienen audio configurado."
          />
          <AlertSection
            title="Sucursales sin cámaras instaladas"
            icon={CameraOff}
            iconColor="text-purple-400"
            rows={alerts.no_cams}
            loading={loadingAlerts}
            columns={[
              { key: "sucursal", label: "Sucursal" },
              { key: "empresa", label: "Empresa" },
              { key: "region", label: "Región" },
              { key: "cams_instaladas", label: "Cámaras", render: (r) => r.cams_instaladas ?? 0 },
            ]}
            testId="no-cams-alerts-table"
            emptyText="Todas las sucursales tienen cámaras registradas."
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card className="bg-slate-950/50 border-slate-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <CardTitle className="text-base text-slate-200 flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-400" />
                  Bitácora de cambios (últimos 200)
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <Select value={actionFilter} onValueChange={setActionFilter}>
                    <SelectTrigger
                      data-testid="audit-action-filter"
                      className="bg-slate-950 border-slate-800 w-[180px]"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800">
                      <SelectItem value="all">Todas las acciones</SelectItem>
                      <SelectItem value="CREATE">Creaciones</SelectItem>
                      <SelectItem value="UPDATE">Actualizaciones</SelectItem>
                      <SelectItem value="DELETE">Eliminaciones</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingAudit ? (
                <div className="space-y-2">
                  {["a1", "a2", "a3", "a4", "a5"].map((k) => (
                    <Skeleton key={k} className="h-10 bg-slate-800" />
                  ))}
                </div>
              ) : audit.length === 0 ? (
                <p data-testid="audit-empty" className="text-sm text-slate-400 py-6 text-center">
                  No hay registros de cambios todavía.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table data-testid="audit-table">
                    <TableHeader>
                      <TableRow className="border-slate-800">
                        <TableHead className="text-slate-400">Fecha</TableHead>
                        <TableHead className="text-slate-400">Acción</TableHead>
                        <TableHead className="text-slate-400">Sucursal</TableHead>
                        <TableHead className="text-slate-400">Cambios</TableHead>
                        <TableHead className="text-slate-400">Usuario</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {audit.map((entry) => {
                        const meta = actionMeta[entry.action] || actionMeta.UPDATE;
                        const Icon = meta.icon;
                        return (
                          <TableRow
                            key={entry.id}
                            data-testid={`audit-row-${entry.id}`}
                            className="border-slate-800 hover:bg-slate-900/40"
                          >
                            <TableCell className="text-slate-300 text-xs whitespace-nowrap">
                              {formatDate(entry.created_at)}
                            </TableCell>
                            <TableCell>
                              <Badge className={`${meta.color} text-white border-0 gap-1`}>
                                <Icon className="w-3 h-3" />
                                {meta.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-200">
                              {entry.sucursal_name || "—"}
                              {entry.sucursal_id && (
                                <span className="text-slate-500 text-xs ml-1">
                                  ({entry.sucursal_id})
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-slate-400 text-xs max-w-md truncate">
                              {renderChangedFields(entry.changed_fields)}
                            </TableCell>
                            <TableCell className="text-slate-300 text-xs">
                              {entry.user_email || "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const SummaryCard = ({ icon: Icon, label, value, color, iconColor, testId }) => (
  <Card
    data-testid={testId}
    className={`bg-gradient-to-br ${color} border`}
  >
    <CardContent className="p-5 flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">{label}</p>
        <p className="text-3xl font-bold text-slate-50">{value}</p>
      </div>
      <Icon className={`w-10 h-10 ${iconColor} opacity-80`} />
    </CardContent>
  </Card>
);

const AlertSection = ({ title, icon: Icon, iconColor, rows, loading, columns, testId, emptyText }) => (
  <Card className="bg-slate-950/50 border-slate-800">
    <CardHeader className="pb-3">
      <CardTitle className="text-base text-slate-200 flex items-center gap-2">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        {title}
        <Badge className="bg-slate-800 text-slate-300 border-0 ml-1">{rows.length}</Badge>
      </CardTitle>
    </CardHeader>
    <CardContent>
      {loading ? (
        <div className="space-y-2">
          {["s1", "s2", "s3"].map((k) => (
            <Skeleton key={k} className="h-8 bg-slate-800" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <Table data-testid={testId}>
            <TableHeader>
              <TableRow className="border-slate-800">
                {columns.map((c) => (
                  <TableHead key={c.key} className="text-slate-400">{c.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className="border-slate-800 hover:bg-slate-900/40">
                  {columns.map((c) => (
                    <TableCell key={c.key} className="text-slate-200">
                      {c.render ? c.render(row) : (row[c.key] ?? "—")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </CardContent>
  </Card>
);

export default AlertasHistorial;
