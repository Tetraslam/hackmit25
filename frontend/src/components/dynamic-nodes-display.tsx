"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Activity, Zap, Plus, Settings, Trash2, AlertTriangle } from "lucide-react"
import { ConsumerManager } from "./consumer-manager"
import { toast } from "sonner"

type NodeReading = {
  id: number
  type: "power" | "consumer"
  demand: number
  fulfillment: number
  isNew?: boolean
}

interface DynamicNodesDisplayProps {
  nodes: NodeReading[]
  onUpdateNodes?: (nodes: NodeReading[]) => void
}

interface Consumer {
  id: number
  name: string
  demand: number
  fulfillment: number
  isNew?: boolean
}

export function DynamicNodesDisplay({ nodes, onUpdateNodes }: DynamicNodesDisplayProps) {
  const [consumers, setConsumers] = useState<Consumer[]>([])
  const [showManager, setShowManager] = useState(false)
  const [nextId, setNextId] = useState(1)

  // Convert nodes to consumers and track changes
  useEffect(() => {
    const consumerNodes = nodes.filter(n => n.type === "consumer")
    const updatedConsumers = consumerNodes.map(node => ({
      id: node.id,
      name: `Consumer ${node.id}`, // Default name, could be enhanced
      demand: node.demand,
      fulfillment: node.fulfillment,
      isNew: node.isNew
    }))
    
    // Update next ID to avoid conflicts
    if (consumerNodes.length > 0) {
      const maxId = Math.max(...consumerNodes.map(n => n.id))
      setNextId(maxId + 1)
    }
    
    setConsumers(updatedConsumers)
  }, [nodes])

  // Remove the "isNew" flag after animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setConsumers(prev => prev.map(c => ({ ...c, isNew: false })))
    }, 600) // Slightly longer than animation duration

    return () => clearTimeout(timer)
  }, [consumers.some(c => c.isNew)])

  const handleAddConsumer = (newConsumer: Omit<Consumer, 'id' | 'fulfillment' | 'isNew'>) => {
    const consumer: Consumer = {
      id: nextId,
      name: newConsumer.name,
      demand: newConsumer.demand,
      fulfillment: 0, // Initial fulfillment
      isNew: true
    }

    const updatedConsumers = [...consumers, consumer]
    setConsumers(updatedConsumers)
    setNextId(nextId + 1)

    // Update parent nodes if callback provided
    if (onUpdateNodes) {
      const updatedNodes = [
        ...nodes.filter(n => n.type !== "consumer"),
        ...updatedConsumers.map(c => ({
          id: c.id,
          type: "consumer" as const,
          demand: c.demand,
          fulfillment: c.fulfillment,
          isNew: c.isNew
        }))
      ]
      onUpdateNodes(updatedNodes)
    }

    // Send to backend (simulated for now)
    // TODO: Implement actual API call to backend
    console.log('Adding consumer to backend:', consumer)
  }

  const handleRemoveConsumer = (id: number) => {
    const updatedConsumers = consumers.filter(c => c.id !== id)
    setConsumers(updatedConsumers)

    // Update parent nodes if callback provided
    if (onUpdateNodes) {
      const updatedNodes = [
        ...nodes.filter(n => n.type !== "consumer" || n.id !== id)
      ]
      onUpdateNodes(updatedNodes)
    }

    // Send to backend (simulated for now)
    // TODO: Implement actual API call to backend
    console.log('Removing consumer from backend:', id)
  }

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 90) return "text-green-600"
    if (efficiency >= 70) return "text-yellow-600"
    return "text-red-600"
  }

  const getEfficiencyBadge = (efficiency: number) => {
    if (efficiency >= 90) return "default"
    if (efficiency >= 70) return "secondary"
    return "destructive"
  }

  return (
    <div className="space-y-6">
      {/* Header with Add Consumer Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Active Nodes</h3>
          <p className="text-sm text-muted-foreground">
            Real-time power consumer monitoring
          </p>
        </div>
        <Button
          onClick={() => setShowManager(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Consumer
        </Button>
      </div>

      {/* Consumer Manager Modal/Drawer */}
      {showManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg max-w-md w-full mx-4 max-h-[90vh] overflow-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Consumer Management</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowManager(false)}
              >
                ✕
              </Button>
            </div>
            <div className="p-4">
              <ConsumerManager
                consumers={consumers}
                onAddConsumer={handleAddConsumer}
                onRemoveConsumer={handleRemoveConsumer}
              />
            </div>
          </div>
        </div>
      )}

      {/* Nodes Grid Display */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {consumers.map((consumer) => {
          const efficiency = consumer.demand > 0 
            ? (consumer.fulfillment / consumer.demand) * 100 
            : 100

          return (
            <Card 
              key={consumer.id}
              className={`
                transition-all duration-500 ease-out
                ${consumer.isNew ? 'animate-slide-in-right border-green-500 shadow-lg' : ''}
                hover:shadow-md
              `}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${consumer.isNew ? 'animate-pulse-green' : 'bg-green-500'}`} />
                    <CardTitle className="text-base">{consumer.name}</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    ID: {consumer.id}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Power Consumer Node
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Power Demand */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Power Demand</span>
                    <span className="font-mono">{consumer.demand.toFixed(1)}A</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Fulfillment</span>
                    <span className={`font-mono ${getEfficiencyColor(efficiency)}`}>
                      {efficiency.toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(efficiency, 100)} 
                    className="h-2"
                  />
                </div>

                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <Badge 
                    variant={getEfficiencyBadge(efficiency)}
                    className="text-xs"
                  >
                    {efficiency >= 90 ? (
                      <>
                        <Activity className="h-3 w-3 mr-1" />
                        Optimal
                      </>
                    ) : efficiency >= 70 ? (
                      <>
                        <Zap className="h-3 w-3 mr-1" />
                        Moderate
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Critical
                      </>
                    )}
                  </Badge>
                  
                  {consumer.isNew && (
                    <Badge variant="secondary" className="text-xs animate-fade-in">
                      New
                    </Badge>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => {
                      toast.info(`Consumer ${consumer.name}`, {
                        description: `Demand: ${consumer.demand}A, Efficiency: ${efficiency.toFixed(1)}%`
                      })
                    }}
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    Details
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveConsumer(consumer.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {/* Empty State */}
        {consumers.length === 0 && (
          <div className="col-span-full">
            <Card className="p-8 text-center border-dashed">
              <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No Consumers Active</h3>
              <p className="text-muted-foreground mb-4">
                Add your first power consumer to start monitoring
              </p>
              <Button onClick={() => setShowManager(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Consumer
              </Button>
            </Card>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {consumers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">System Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">
                  {consumers.length}
                </div>
                <div className="text-xs text-muted-foreground">
                  Active Consumers
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {consumers.reduce((sum, c) => sum + c.demand, 0).toFixed(1)}A
                </div>
                <div className="text-xs text-muted-foreground">
                  Total Demand
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {consumers.length > 0 
                    ? ((consumers.reduce((sum, c) => sum + (c.fulfillment / c.demand * 100), 0) / consumers.length) || 0).toFixed(1)
                    : 0
                  }%
                </div>
                <div className="text-xs text-muted-foreground">
                  Avg Efficiency
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
