"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Battery, 
  Sun, 
  Wind,
  Zap,
  AlertTriangle
} from "lucide-react"
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area,
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
  Legend
} from "recharts"

// Map backend source IDs to display info (matching actual backend sources)
const SOURCE_INFO = {
  SOLAR_001: { name: "Solar Array", color: "#fbbf24", icon: Sun },
  BATTERY_001: { name: "Battery Storage", color: "#10b981", icon: Battery },
  GAS_GEN_001: { name: "Natural Gas", color: "#6366f1", icon: Zap },
  GRID_001: { name: "Grid Connection", color: "#8b5cf6", icon: Zap },
  WIND_001: { name: "Wind Turbine", color: "#06b6d4", icon: Wind },
  DIESEL_001: { name: "Diesel Backup", color: "#ef4444", icon: AlertTriangle },
}

type Snapshot = {
  timestamp: number
  nodes: Array<{
    id: number
    type: "power" | "consumer"
    demand: number
    fulfillment: number
  }>
  optimization_time_ms?: number
  confidence_score?: number
  dispatch_count?: number
  economic?: {
    total_cost_per_second: number
    cost_per_amp: number
    total_demand: number
    total_supply: number
    unmet_demand: number
    efficiency_percent: number
    green_energy_percent: number
    source_usage: Record<string, {
      amps: number
      cost: number
      cost_per_amp: number
      max_capacity: number
    }>
    dispatch_details: Array<{
      id: string
      supply_amps: number
      source_id: string
    }>
  }
}

interface EconomicInsightsProps {
  history: Snapshot[]
  latest: Snapshot
}

export function EconomicInsights({ history, latest }: EconomicInsightsProps) {
  // Extract real economic data from backend
  const economicData = useMemo(() => {
    if (history.length === 0) return []
    
    return history.slice(-50).map((snapshot) => {
      const economic = snapshot.economic
      if (!economic) {
        return {
          time: new Date(snapshot.timestamp).toLocaleTimeString('en-US', { 
            hour12: false, 
            minute: '2-digit', 
            second: '2-digit' 
          }),
          timestamp: snapshot.timestamp,
          totalCost: 0,
          costPerAmp: 0,
          demand: 0,
          supply: 0,
          unmetDemand: 0,
          efficiency: 100,
          greenPercent: 0,
          sourceUsage: {}
        }
      }
      
      return {
        time: new Date(snapshot.timestamp).toLocaleTimeString('en-US', { 
          hour12: false, 
          minute: '2-digit', 
          second: '2-digit' 
        }),
        timestamp: snapshot.timestamp,
        totalCost: economic.total_cost_per_second,
        costPerAmp: economic.cost_per_amp,
        demand: economic.total_demand,
        supply: economic.total_supply,
        unmetDemand: economic.unmet_demand,
        efficiency: economic.efficiency_percent,
        greenPercent: economic.green_energy_percent,
        sourceUsage: economic.source_usage
      }
    })
  }, [history])
  
  // Calculate source distribution for pie chart from real backend data
  const sourceDistribution = useMemo(() => {
    if (!latest?.economic?.source_usage) return []
    
    return Object.entries(latest.economic.source_usage)
      .filter(([_, usage]) => usage.amps > 0)
      .map(([sourceId, usage]) => ({
        name: SOURCE_INFO[sourceId as keyof typeof SOURCE_INFO]?.name || sourceId,
        value: usage.amps,
        cost: usage.cost,
        costPerAmp: usage.cost_per_amp,
        color: SOURCE_INFO[sourceId as keyof typeof SOURCE_INFO]?.color || "#6b7280"
      }))
  }, [latest])
  
  // Calculate cost trends from real data
  const costTrends = useMemo(() => {
    if (economicData.length < 2) return { trend: 'stable', change: 0, avg: 0 }
    
    const recent = economicData.slice(-10)
    const older = economicData.slice(-20, -10)
    
    const recentAvg = recent.reduce((sum, d) => sum + d.totalCost, 0) / recent.length
    const olderAvg = older.length > 0 
      ? older.reduce((sum, d) => sum + d.totalCost, 0) / older.length
      : recentAvg
    
    const change = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0
    
    return {
      trend: change > 5 ? 'up' : change < -5 ? 'down' : 'stable',
      change: change.toFixed(1),
      avg: recentAvg.toFixed(4)
    }
  }, [economicData])
  
  const currentData = economicData[economicData.length - 1]
  
  return (
    <div className="space-y-6">
      {/* Economic Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Cost Rate</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(latest?.economic?.total_cost_per_second || 0).toFixed(4)}/s
            </div>
            <p className="text-xs text-muted-foreground">
              ${(latest?.economic?.cost_per_amp || 0).toFixed(4)} per amp
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost Trend</CardTitle>
            {costTrends.trend === 'up' ? (
              <TrendingUp className="h-4 w-4 text-red-500" />
            ) : costTrends.trend === 'down' ? (
              <TrendingDown className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {costTrends.trend === 'up' ? '+' : ''}{costTrends.change}%
            </div>
            <p className="text-xs text-muted-foreground">
              Avg: ${costTrends.avg}/s
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Green Energy %</CardTitle>
            <Sun className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(latest?.economic?.green_energy_percent || 0).toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Low-cost renewable sources
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Efficiency</CardTitle>
            <Battery className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(latest?.economic?.efficiency_percent || 100).toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Demand fulfillment rate
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Cost Analysis Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Cost Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Energy Cost Analysis</CardTitle>
            <CardDescription>Real-time cost optimization ($/second)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={economicData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <defs>
                    <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
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
                    width={40}
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg">
                            <p className="font-medium">{label}</p>
                            <p className="text-sm text-green-600">
                              Cost: ${payload[0].value}/s
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Demand: {payload[0].payload.demand}A
                            </p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalCost"
                    stroke="#10b981"
                    fill="url(#costGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        {/* Source Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Energy Source Mix</CardTitle>
            <CardDescription>Current dispatch by source (Amps)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {sourceDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg">
                            <p className="font-medium">{data.name}</p>
                            <p className="text-sm">Supply: {data.value.toFixed(1)}A</p>
                            <p className="text-sm">Cost: ${data.cost.toFixed(2)}/s</p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Source Priority List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Energy Sources</CardTitle>
          <CardDescription>Real-time dispatch from MILP optimization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {latest?.economic?.source_usage && Object.keys(latest.economic.source_usage).length > 0 ? (
              Object.entries(latest.economic.source_usage).map(([sourceId, usage]) => {
                const sourceInfo = SOURCE_INFO[sourceId as keyof typeof SOURCE_INFO]
                const utilization = (usage.amps / usage.max_capacity) * 100
                const Icon = sourceInfo?.icon || Zap
                
                return (
                  <div key={sourceId} className="flex items-center gap-4">
                    <Icon className="h-5 w-5" style={{ color: sourceInfo?.color || "#6b7280" }} />
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">{sourceInfo?.name || sourceId}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={usage.amps > 0 ? "default" : "secondary"}>
                            ${usage.cost_per_amp.toFixed(3)}/A
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {usage.amps.toFixed(2)}A / {usage.max_capacity.toFixed(1)}A
                          </span>
                        </div>
                      </div>
                      <Progress value={utilization} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">
                        Cost: ${usage.cost.toFixed(4)}/s
                      </p>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                No active energy sources
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Real-time Optimization Status */}
      {latest?.economic && (
        <Card className={`${
          latest.economic.unmet_demand > 0 
            ? "border-yellow-500/50 bg-yellow-500/5" 
            : costTrends.trend === 'down' 
            ? "border-green-500/50 bg-green-500/5"
            : "border-blue-500/50 bg-blue-500/5"
        }`}>
          <CardHeader>
            <CardTitle className={`${
              latest.economic.unmet_demand > 0 
                ? "text-yellow-600" 
                : costTrends.trend === 'down' 
                ? "text-green-600"
                : "text-blue-600"
            }`}>
              {latest.economic.unmet_demand > 0 
                ? "⚠️ Capacity Alert" 
                : costTrends.trend === 'down' 
                ? "💰 Cost Optimization Active"
                : "⚡ System Operating Normally"
              }
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {latest.economic.unmet_demand > 0 
                ? `${latest.economic.unmet_demand.toFixed(2)}A of demand cannot be met with current sources. Consider adding capacity.`
                : costTrends.trend === 'down' 
                ? `MILP optimization reducing costs by ${Math.abs(Number(costTrends.change))}% through intelligent source selection.`
                : `System efficiently meeting ${latest.economic.total_demand.toFixed(2)}A demand with ${latest.economic.efficiency_percent.toFixed(0)}% efficiency.`
              }
            </p>
            {latest.economic.dispatch_details.length > 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                Active dispatches: {latest.economic.dispatch_details.length} commands to nodes
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
