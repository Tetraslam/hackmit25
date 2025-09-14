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
  Sun
} from "lucide-react"
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from "recharts"


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
    total_cost: number  // Cumulative total cost
    cycle_cost: number  // Cost for this optimization cycle
    cost_per_second: number  // Cost per second rate
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
        totalCost: economic.total_cost,  // Use cumulative total cost
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
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(latest?.economic?.total_cost || 0).toFixed(4)}
            </div>
            <p className="text-xs text-muted-foreground">
              ${(latest?.economic?.cost_per_second || 0).toFixed(4)}/s current rate
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
      
      {/* Real-Time Cost Analysis */}
      <div className="grid gap-6">
        {/* Money Saved/Spent Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Real-Time Cost Tracking</CardTitle>
            <CardDescription>MILP optimization cost performance ($/second)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={economicData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <defs>
                    <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
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
                    width={50}
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg">
                            <p className="font-medium">{label}</p>
                            <p className="text-sm text-red-600">
                              Total Cost: ${data.totalCost}
                            </p>
                            <p className="text-sm text-blue-600">
                              Cost/Amp: ${data.costPerAmp}/A
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Demand: {data.demand}A | Supply: {data.supply}A
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Efficiency: {data.efficiency}%
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
                    stroke="#ef4444"
                    fill="url(#costGradient)"
                    strokeWidth={2}
                    name="Total Cost"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        {/* Cost Efficiency Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Optimization Performance</CardTitle>
            <CardDescription>Cost per amp and system efficiency over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={economicData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
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
                    width={40}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    className="text-xs"
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    domain={[0, 100]}
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg">
                            <p className="font-medium">{label}</p>
                            {payload.map((entry, index) => (
                              <p key={index} className="text-sm" style={{ color: entry.color }}>
                                {entry.name}: {entry.value}{entry.dataKey === 'efficiency' ? '%' : '/A'}
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
                    dataKey="costPerAmp"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={false}
                    name="Cost per Amp ($)"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="efficiency"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    name="Efficiency"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Cost Savings Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Economic Summary</CardTitle>
          <CardDescription>Current optimization impact from MILP algorithm</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Current Period */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Current Period</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm">Total Cost:</span>
                  <span className="text-sm font-mono">${(latest?.economic?.total_cost || 0).toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Demand Met:</span>
                  <span className="text-sm font-mono">{(latest?.economic?.efficiency_percent || 0).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Green Energy:</span>
                  <span className="text-sm font-mono">{(latest?.economic?.green_energy_percent || 0).toFixed(1)}%</span>
                </div>
              </div>
            </div>
            
            {/* Optimization Impact */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Optimization Impact</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm">Cost Trend:</span>
                  <div className="flex items-center gap-1">
                    {costTrends.trend === 'down' ? (
                      <TrendingDown className="h-3 w-3 text-green-500" />
                    ) : costTrends.trend === 'up' ? (
                      <TrendingUp className="h-3 w-3 text-red-500" />
                    ) : (
                      <div className="h-3 w-3 rounded-full bg-gray-400" />
                    )}
                    <span className={`text-sm font-mono ${
                      costTrends.trend === 'down' ? 'text-green-600' : 
                      costTrends.trend === 'up' ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {costTrends.trend === 'down' ? '-' : costTrends.trend === 'up' ? '+' : ''}{Math.abs(Number(costTrends.change))}%
                    </span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Avg Cost:</span>
                  <span className="text-sm font-mono">${costTrends.avg}/s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Unmet Demand:</span>
                  <span className="text-sm font-mono">{(latest?.economic?.unmet_demand || 0).toFixed(2)}A</span>
                </div>
              </div>
            </div>
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
