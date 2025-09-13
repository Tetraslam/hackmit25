"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody as Tbody, TableCell as Td, TableHead as Th, TableHeader as Thead, TableRow as Tr } from "@/components/ui/table"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Line, LineChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Area, AreaChart } from "recharts"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Activity, Zap, Brain, Clock, Wifi, AlertTriangle } from "lucide-react"

type NodeReading = {
  id: number
  type: "power" | "consumer"
  demand: number
  fulfillment: number
}

type Snapshot = {
  timestamp: number
  nodes: NodeReading[]
  optimization_time_ms?: number
  confidence_score?: number
  dispatch_count?: number
}

const POLL_MS = 2000

export default function MetricsPage() {
  const [history, setHistory] = useState<Snapshot[]>([])
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchLoop() {
      try {
        const res = await fetch("/api/metrics", { cache: "no-store" })
        if (res.ok) {
          const data: Snapshot = await res.json()
          if (!cancelled) {
            setHistory((h) => [...h.slice(-200), data])  // Keep more history for better charts
            setConnectionStatus('connected')
            setLastUpdate(new Date())
          }
        } else {
          setConnectionStatus('error')
        }
      } catch (error) {
        setConnectionStatus('error')
        console.error('Metrics fetch failed:', error)
      }
      if (!cancelled) setTimeout(fetchLoop, POLL_MS)
    }
    fetchLoop()
    return () => {
      cancelled = true
    }
  }, [])

  const latest = history[history.length - 1]
  
  // Chart data with proper time formatting and better data aggregation
  const chartData = useMemo(() => {
    if (history.length === 0) return []
    
    return history.map((s, index) => {
      const totalDemand = s.nodes.filter((n) => n.type === "consumer").reduce((sum, n) => sum + n.demand, 0)
      const totalSupply = s.nodes.filter((n) => n.type === "power").reduce((sum, n) => sum + n.fulfillment, 0)
      const totalRouted = s.nodes.filter((n) => n.type === "consumer").reduce((sum, n) => sum + n.fulfillment, 0)
      
      return {
        time: new Date(s.timestamp).toLocaleTimeString('en-US', { 
          hour12: false, 
          minute: '2-digit', 
          second: '2-digit' 
        }),
        timestamp: s.timestamp,
        demand: Number(totalDemand.toFixed(2)),
        supply: Number(totalSupply.toFixed(2)),
        routed: Number(totalRouted.toFixed(2)),
        index
      }
    })
  }, [history])
  
  // Performance metrics
  const performanceData = useMemo(() => {
    if (history.length === 0) return []
    
    return history.slice(-50).map((s, index) => ({
      time: new Date(s.timestamp).toLocaleTimeString('en-US', { 
        hour12: false, 
        minute: '2-digit', 
        second: '2-digit' 
      }),
      optimizationTime: s.optimization_time_ms || 0,
      confidence: (s.confidence_score || 0) * 100,
      dispatches: s.dispatch_count || 0,
      index
    }))
  }, [history])

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      {/* Header with Status */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Griddy Dashboard</h1>
          <p className="text-muted-foreground">ESP32 hardware telemetry → MILP optimization → dispatch commands (24Hz)</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' : 
              connectionStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'
            }`} />
            <span className="text-sm text-muted-foreground">
              {connectionStatus === 'connected' ? 'Connected' : 
               connectionStatus === 'error' ? 'Error' : 'Connecting...'}
            </span>
          </div>
          {lastUpdate && (
            <span className="text-xs text-muted-foreground">
              {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Connection Status Alert */}
      {connectionStatus === 'error' && (
        <Alert className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription>
            Unable to connect to backend. Make sure the backend is running on port 8000.
          </AlertDescription>
        </Alert>
      )}

      {/* System Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Demand</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latest ? latest.nodes.filter(n => n.type === "consumer").reduce((sum, n) => sum + n.demand, 0).toFixed(2) : "0.00"}A
            </div>
            <p className="text-xs text-muted-foreground">
              {latest ? latest.nodes.filter(n => n.type === "consumer").length : 0} consumers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Optimization Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latest?.optimization_time_ms?.toFixed(1) || "0.0"}ms
            </div>
            <p className="text-xs text-muted-foreground">
              Target: &lt;50ms for 24Hz
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Confidence</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latest?.confidence_score ? (latest.confidence_score * 100).toFixed(0) : "0"}%
            </div>
            <p className="text-xs text-muted-foreground">
              {(latest?.confidence_score || 0) < 0.5 ? "Cerebras escalation" : "MILP only"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Dispatches</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latest?.dispatch_count || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Commands sent to ESP32
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts */}
      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        {/* Power Flow Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Power Flow Over Time</CardTitle>
            <CardDescription>Real-time demand vs supply optimization (Amps)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <defs>
                    <linearGradient id="demandGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="supplyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="time" 
                    className="text-xs"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    className="text-xs"
                    tickLine={false}
                    axisLine={false}
                    width={35}
                  />
                  <ChartTooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg">
                            <p className="font-medium">{label}</p>
                            {payload.map((entry, index) => (
                              <p key={index} className="text-sm" style={{ color: entry.color }}>
                                {entry.name}: {entry.value}A
                              </p>
                            ))}
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="demand"
                    stroke="hsl(var(--destructive))"
                    fill="url(#demandGradient)"
                    strokeWidth={2}
                    name="Demand"
                  />
                  <Area
                    type="monotone"
                    dataKey="routed"
                    stroke="hsl(var(--primary))"
                    fill="url(#supplyGradient)"
                    strokeWidth={2}
                    name="Routed"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics Chart */}
        <Card>
          <CardHeader>
            <CardTitle>System Performance</CardTitle>
            <CardDescription>MILP optimization time and AI confidence</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="time" 
                    className="text-xs"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    yAxisId="left"
                    className="text-xs"
                    tickLine={false}
                    axisLine={false}
                    width={35}
                    domain={[0, 100]}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    className="text-xs"
                    tickLine={false}
                    axisLine={false}
                    width={35}
                    domain={[0, 100]}
                  />
                  <ChartTooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg">
                            <p className="font-medium">{label}</p>
                            {payload.map((entry, index) => (
                              <p key={index} className="text-sm" style={{ color: entry.color }}>
                                {entry.name}: {entry.value}{entry.dataKey === 'optimizationTime' ? 'ms' : '%'}
                              </p>
                            ))}
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="optimizationTime"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    dot={false}
                    name="Opt Time"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="confidence"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    dot={false}
                    name="Confidence"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Node Status */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Node Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              Live Node Telemetry
            </CardTitle>
            <CardDescription>
              {latest ? `Last update: ${new Date(latest.timestamp).toLocaleTimeString()}` : "Waiting for ESP32..."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {latest?.nodes.length ? (
              <div className="overflow-x-auto">
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Node ID</Th>
                      <Th>Type</Th>
                      <Th className="text-right">Demand (A)</Th>
                      <Th className="text-right">Fulfillment</Th>
                      <Th>Status</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {latest.nodes.map((node) => {
                      const efficiency = node.type === "consumer" 
                        ? (node.fulfillment / Math.max(node.demand, 0.1)) * 100
                        : node.fulfillment
                      
                      return (
                        <Tr key={node.id}>
                          <Td className="font-mono font-semibold">{node.id}</Td>
                          <Td>
                            <Badge variant={node.type === "consumer" ? "default" : "secondary"}>
                              {node.type}
                            </Badge>
                          </Td>
                          <Td className="text-right font-mono">
                            {node.demand.toFixed(3)}
                          </Td>
                          <Td className="text-right font-mono">
                            {node.fulfillment.toFixed(3)}
                          </Td>
                          <Td>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${
                                efficiency > 90 ? 'bg-green-500' :
                                efficiency > 70 ? 'bg-yellow-500' : 'bg-red-500'
                              }`} />
                              <span className="text-xs text-muted-foreground">
                                {efficiency.toFixed(0)}%
                              </span>
                            </div>
                          </Td>
                        </Tr>
                      )
                    })}
                  </Tbody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No telemetry data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Stats */}
        <Card>
          <CardHeader>
            <CardTitle>System Statistics</CardTitle>
            <CardDescription>Performance and efficiency metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Optimization Performance */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Optimization Time</span>
                <span className="font-mono">{latest?.optimization_time_ms?.toFixed(1) || "0.0"}ms</span>
              </div>
              <Progress 
                value={Math.min(100, ((latest?.optimization_time_ms || 0) / 50) * 100)} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Target: &lt;50ms for real-time operation
              </p>
            </div>

            {/* AI Confidence */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>AI Confidence</span>
                <span className="font-mono">{latest?.confidence_score ? (latest.confidence_score * 100).toFixed(0) : "0"}%</span>
              </div>
              <Progress 
                value={(latest?.confidence_score || 0) * 100} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {(latest?.confidence_score || 0) < 0.5 ? "🧠 Cerebras AI escalation active" : "✅ MILP optimization sufficient"}
              </p>
            </div>

            {/* Data Flow */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Data Points</span>
                <span className="font-mono">{history.length}</span>
              </div>
              <Progress 
                value={Math.min(100, (history.length / 200) * 100)} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Buffer: {history.length}/200 snapshots
              </p>
            </div>

            {/* Protocol Efficiency */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Protocol Efficiency</span>
                <span className="font-mono text-green-600">58%</span>
              </div>
              <Progress value={58} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                Binary vs JSON bandwidth savings
              </p>
            </div>

            {/* Supply vs Demand Balance */}
            {latest && (
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Supply Balance</span>
                  <span className="font-mono">
                    {(() => {
                      const demand = latest.nodes.filter(n => n.type === "consumer").reduce((sum, n) => sum + n.demand, 0)
                      const supply = latest.nodes.filter(n => n.type === "power").reduce((sum, n) => sum + n.fulfillment, 0)
                      const ratio = demand > 0 ? (supply / demand) * 100 : 100
                      return `${ratio.toFixed(0)}%`
                    })()}
                  </span>
                </div>
                <Progress 
                  value={(() => {
                    const demand = latest.nodes.filter(n => n.type === "consumer").reduce((sum, n) => sum + n.demand, 0)
                    const supply = latest.nodes.filter(n => n.type === "power").reduce((sum, n) => sum + n.fulfillment, 0)
                    return demand > 0 ? Math.min(100, (supply / demand) * 100) : 100
                  })()} 
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Supply capacity vs total demand
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}


